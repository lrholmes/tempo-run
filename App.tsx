import React, { useState, useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  Text as PrimitiveText,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  SafeAreaView,
  AsyncStorage,
  StatusBar,
} from 'react-native';
import Constants from 'expo-constants';
import { AppearanceProvider, useColorScheme } from 'react-native-appearance';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Font from 'expo-font';
import SpotifyWebApi from 'spotify-web-api-node';
import * as R from 'ramda';

import posed, { Transition } from './pose';

if (Platform.OS === 'web') {
  Constants.manifest.id = `@lawrenceholmes/${Constants.manifest.slug}`;
  WebBrowser.maybeCompleteAuthSession();
}

const colors = {
  light: '#fff',
  dark: '#222',
  lightGray: '#f5f5f5',
  darkGray: '#444',
};

const SCOPE = [
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'ugc-image-upload',
  'user-follow-read',
  'user-library-read',
  'user-top-read',
  'user-read-recently-played',
];

const SPOTIFY_CLIENT_ID = '27aa5044b27d4f349c7eb7c513faa50c';
export const LOGIN_URL = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&scope=${SCOPE}`;

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
});

const redirectUrl = AuthSession.getRedirectUrl();

const persistAuthState = ({ token, expiresIn }) =>
  AsyncStorage.setItem('authState', JSON.stringify({ token, expiresIn }));

const getAuthState = async () => {
  const jsonString = await AsyncStorage.getItem('authState');
  try {
    return jsonString ? JSON.parse(jsonString) : null;
  } catch {
    return null;
  }
};

const useSpotifyAuthentication = () => {
  const [token, setToken] = useState('');
  const [expires, setExpires] = useState('');

  const [, result, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      redirectUri: redirectUrl,
      scopes: SCOPE,
      usePKCE: false,
      responseType: 'token',
    },
    {
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    },
  );

  useEffect(() => {
    if (result?.type === 'success') {
      const { access_token: token, expires_in: expiresIn } = result.params;
      const expires = new Date().getTime() + Number(expiresIn) * 1000;
      setToken(token);
      setExpires(expires);
      persistAuthState({
        token,
        expiresIn: expires,
      });
    }
  }, [result?.type]);

  useEffect(() => {
    getAuthState().then((authState) => {
      if (authState) {
        const timeNow = new Date().getTime();
        if (authState.expiresIn > timeNow) {
          setToken(authState.token);
          setExpires(authState.expiresIn);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (token && spotifyApi) {
      spotifyApi.setAccessToken(token);
    }
  }, [token, spotifyApi]);

  return {
    token,
    expires,
    handleLogin: () => promptAsync({ useProxy: Platform.OS !== 'web' }),
  };
};

interface FullTrackObjectWithAudioFeatures
  extends SpotifyApi.TrackObjectFull,
    SpotifyApi.AudioFeaturesObject {}

const mergeById = R.compose(
  R.map(R.mergeAll),
  R.values,
  R.groupBy(R.prop('id')),
);

const getAudioFeaturesForTracks = async (
  tracks: SpotifyApi.TrackObjectFull[] | SpotifyApi.TrackObjectSimplified[],
): SpotifyApi.AudioFeaturesObject[] => {
  // limit per request on fetching audio features is 100
  const groupedTrackIds = R.compose(R.splitEvery(100), R.pluck('id'))(tracks);

  const audioFeaturesData = await Promise.all(
    groupedTrackIds.map((trackIds) =>
      spotifyApi.getAudioFeaturesForTracks(trackIds),
    ),
  );

  const flattened = R.compose(
    R.flatten,
    R.map(R.path(['body', 'audio_features'])),
  )(audioFeaturesData);

  return flattened;
};

const addAudioFeaturesToTracks = async (
  tracks: SpotifyApi.TrackObjectSimplified[] | SpotifyApi.TrackObjectFull[],
) => {
  const audioFeatures = await getAudioFeaturesForTracks(tracks);

  return mergeById(R.concat(tracks, audioFeatures));
};

const getMyTopTracksWithAudioFeatures = async (): FullTrackObjectWithAudioFeatures[] => {
  const myTopTracksData = await Promise.all([
    spotifyApi.getMyTopTracks({ limit: 50, time_range: 'short_term' }),
    spotifyApi.getMyTopTracks({ limit: 50, time_range: 'medium_term' }),
    spotifyApi.getMyTopTracks({ limit: 50, time_range: 'long_term' }),
  ]);

  const myTopTracks = R.compose(
    R.uniqBy(R.prop('id')),
    R.flatten,
    R.map(R.path(['body', 'items'])),
  )(myTopTracksData);

  const withAudioFeatures = await addAudioFeaturesToTracks(myTopTracks);

  return withAudioFeatures;
};

const getSavedTracks = async (
  fetchUpTo: number,
  tracks: SpotifyApi.SavedTrackObject[] = [],
) => {
  const savedTrackData = await spotifyApi.getMySavedTracks({
    limit: 50,
    offset: tracks.length,
  });

  const hasNext = Boolean(savedTrackData.body.next);
  const newTracks = [...tracks, ...R.pluck('track', savedTrackData.body.items)];

  if (hasNext && newTracks.length < fetchUpTo) {
    return getSavedTracks(fetchUpTo, newTracks);
  }

  return newTracks;
};

const getMySavedTracksWithAudioFeatures = async (
  minTempo: number = 165,
): FullTrackObjectWithAudioFeatures[] => {
  const mySavedTracks = await getSavedTracks(1000);
  const withAudioFeatures = await addAudioFeaturesToTracks(mySavedTracks);

  const filtered = R.compose(
    R.filter(
      ({ tempo, energy, valence }) =>
        valence > 0.3 && energy > 0.5 && tempo > minTempo,
    ),
  )(withAudioFeatures);

  return filtered;
};

const getMyRecommendedTracksWithAudioFeatures = async ({
  seeds,
  minTempo,
}): SpotifyApi.TrackObjectSimplified[] => {
  const artists = R.compose(
    R.slice(0, 5),
    R.pluck('id'),
    R.filter(R.propEq('type', 'ARTIST')),
  )(seeds);

  const recommendedTracks = await spotifyApi.getRecommendations({
    min_energy: 0.5,
    min_valence: 0.3,
    min_tempo: minTempo,
    limit: 50,
    seed_artists: artists,
  });

  return recommendedTracks.body.tracks;
};

const createPlaylist = async (
  tracks:
    | SpotifyApi.TrackObjectSimplified[]
    | FullTrackObjectWithAudioFeatures[],
): SpotifyApi.PlaylistObjectFull => {
  const me = await spotifyApi.getMe();
  const newPlaylist = await spotifyApi.createPlaylist(
    me.body.id,
    'Running Playlist',
    {
      description: 'Your running playlist, create using Tempo Run.',
    },
  );

  await spotifyApi.addTracksToPlaylist(
    newPlaylist.body.id,
    R.pluck('uri', tracks),
  );

  return newPlaylist.body;
};

interface TrackProps {
  track: SpotifyApi.TrackObjectFull | SpotifyApi.TrackObjectSimplified;
}
const Track = ({ track }: TrackProps) => (
  <View style={{ marginBottom: 8 }}>
    {track.album && <Image source={{ uri: R.last(track.album.images)?.url }} />}
    <Text style={{ fontWeight: 'bold' }}>{track.name}</Text>
    <Text>{R.pluck('name', track.artists).join(', ')}</Text>
  </View>
);

const ListTracks = ({ seeds, playlistType, minTempo, goToFirstScreen }) => {
  const [playlist, setPlaylist] = useState<SpotifyApi.PlaylistObjectFull>(
    undefined,
  );
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracks, setTracks] = useState<
    FullTrackObjectWithAudioFeatures[] | SpotifyApi.TrackObjectSimplified[]
  >([]);

  useEffect(() => {
    const getTracks =
      playlistType === 'DISCOVER'
        ? getMyRecommendedTracksWithAudioFeatures({ seeds, minTempo })
        : getMySavedTracksWithAudioFeatures(minTempo);
    getTracks.then((tracks) => {
      setTracks(tracks);
      setTracksLoading(false);
    });
  }, []);

  const handleCreatePlaylist = (tracks) => {
    createPlaylist(tracks).then((playlist) => {
      setPlaylist(playlist);
    });
  };

  return (
    <View style={[styles.content, { padding: 0, position: 'relative' }]}>
      <ScrollView style={{ padding: 24, flex: 1, paddingBottom: 64 }}>
        <Text style={[typographyStyles.heading, { marginBottom: 16 }]}>
          {tracksLoading ? 'Loading Tracks...' : 'Your Playlist'}
        </Text>
        {tracks.map((track) => (
          <Track key={track.id} track={track} />
        ))}
        <View style={{ paddingBottom: 128 }} />
      </ScrollView>
      <View
        style={{
          position: Platform.OS === 'web' ? 'fixed' : 'absolute',
          maxWidth: 700,
          bottom: 0,
          left: 0,
          right: 0,
          padding: 24,
          marginHorizontal: 'auto',
        }}
      >
        {playlist ? (
          <Button
            title="Listen to playlist"
            onPress={() => Linking.openURL(playlist.external_urls.spotify)}
          >
            Listen to playlist
          </Button>
        ) : (
          <Button
            disabled={tracksLoading || tracks.length < 1}
            title="Create Playlist"
            onPress={() => handleCreatePlaylist(tracks)}
          >
            Create playlist
          </Button>
        )}
        <Text
          onPress={goToFirstScreen}
          style={{
            marginTop: 16,
            marginLeft: 'auto',
            fontWeight: 'bold',
            textDecorationStyle: 'solid',
            textDecorationLine: 'underline',
          }}
        >
          Start Again?
        </Text>
      </View>
    </View>
  );
};

const TitleSection = () => (
  <View style={styles.title}>
    <Text style={styles.titleText}>Tempo</Text>
    <Text style={[styles.titleText, { letterSpacing: -4 }]}>>>> Run</Text>
  </View>
);

const useDarkMode = () => {
  const colorScheme = useColorScheme();
  console.log({ colorScheme });
  return colorScheme === 'dark';
};

const Text = ({ style, color, ...props }) => {
  const darkMode = useDarkMode();

  const lightModeColor = color?.lightMode ?? colors.dark;
  const darkModeColor = color?.darkMode ?? colors.light;
  return (
    <PrimitiveText
      style={[
        { color: darkMode ? darkModeColor : lightModeColor },
        ...(Array.isArray(style) ? style : [style]),
      ]}
      {...props}
    />
  );
};

const ButtonText = ({ style, children }) => {
  const darkMode = useDarkMode();
  return (
    <Text
      style={[
        buttonStyles.buttonText,
        ...(Array.isArray(style) ? style : [style]),
        { color: darkMode ? colors.dark : colors.light },
      ]}
    >
      {children}
    </Text>
  );
};

const Button = ({ disabled, onPress, style, children, ...props }) => {
  const darkMode = useDarkMode();
  return (
    <TouchableOpacity
      {...props}
      style={[
        buttonStyles.button,
        {
          backgroundColor: darkMode ? colors.light : colors.dark,
          opacity: disabled ? 0.7 : 1,
        },
        style,
      ]}
      onPress={disabled ? null : onPress}
    >
      <ButtonText>{children}</ButtonText>
    </TouchableOpacity>
  );
};

const buttonStyles = StyleSheet.create({
  button: {
    backgroundColor: colors.dark,
    borderRadius: 0,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    textTransform: 'uppercase',
    fontFamily: 'Syncopate',
  },
});

const InitialScreen = ({ isLoggedIn, onButtonClick }) => (
  <View style={styles.content}>
    <Text style={{ fontSize: 18, marginBottom: 100, fontWeight: '500' }}>
      Create personalised playlists tailored to your pace and taste
    </Text>
    <Button style={{ marginTop: 'auto' }} title="login" onPress={onButtonClick}>
      Let's Go >>>
    </Button>
    {!isLoggedIn && (
      <Text style={{ fontSize: 12, marginTop: 4 }}>
        You will be prompted to login with Spotify
      </Text>
    )}
  </View>
);

// http://run2r.com/run2rhythm-home.aspx
const PACE_OPTIONS = [
  {
    kmMinsUpper: 10,
    kmMinsLower: 8,
    bpmUpper: 156,
    bpmLower: 150,
  },
  {
    kmMinsUpper: 8,
    kmMinsLower: 6,
    bpmUpper: 163,
    bpmLower: 156,
  },
  {
    kmMinsUpper: 6,
    kmMinsLower: 4,
    bpmUpper: 171,
    bpmLower: 163,
  },
];

const BigButton = ({ children, onPress }) => {
  const darkMode = useDarkMode();
  return (
    <View
      style={{
        flexBasis: '50%',
        flexGrow: 1,
        minWidth: 300,
        padding: 4,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        style={[
          buttonStyles.button,
          {
            backgroundColor: darkMode ? colors.light : colors.dark,
            alignItems: 'center',
          },
        ]}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
};

const PaceScreen = ({ handleChooseTempo }) => (
  <View style={styles.content}>
    <Text style={typographyStyles.heading}>What's your pace?</Text>
    <Text style={{ marginTop: 8 }}>Choose your average time per km</Text>
    <View
      style={{
        marginTop: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
      }}
    >
      {PACE_OPTIONS.map(({ kmMinsUpper, kmMinsLower, bpmLower }, index) => (
        <BigButton key={index} onPress={() => handleChooseTempo(bpmLower)}>
          <ButtonText>
            {kmMinsLower} - {kmMinsUpper} mins per km
          </ButtonText>
          <ButtonText style={{ marginTop: 8 }}>{bpmLower} BPM+</ButtonText>
          <ButtonText style={{ marginTop: 8, color: colors.lightGray }}>
            {'>'.repeat(index + 1)}
          </ButtonText>
        </BigButton>
      ))}
    </View>
  </View>
);

const PlaylistTypeScreen = ({ handleChoosePlaylistType }) => (
  <View style={styles.content}>
    <Text style={typographyStyles.heading}>Playlist Type</Text>
    <Text style={{ marginBottom: 16 }}>Choose one of the options below</Text>
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}
    >
      <BigButton onPress={() => handleChoosePlaylistType('DISCOVER')}>
        <View style={{ alignItems: 'flex-start' }}>
          <ButtonText>Discover >>></ButtonText>
          <Text
            color={{
              lightMode: colors.lightGray,
              darkMode: colors.darkGray,
            }}
            style={{ marginTop: 8 }}
          >
            Branch out. Get a playlist of tracks, some you might already know,
            most you probably haven’t heard before
          </Text>
        </View>
      </BigButton>
      <BigButton onPress={() => handleChoosePlaylistType('MY_TRACKS')}>
        <View style={{ alignItems: 'flex-start' }}>
          <ButtonText>My Tracks >>></ButtonText>
          <Text
            color={{
              lightMode: colors.lightGray,
              darkMode: colors.darkGray,
            }}
            style={{ marginTop: 8 }}
          >
            Get a playlist exclusively of tracks that you already love and
            listen to regularly
          </Text>
        </View>
      </BigButton>
    </View>
  </View>
);

const Seed = ({ disabled, isSelected, children, onPress }) => {
  const darkMode = useDarkMode();

  const color = darkMode ? colors.light : colors.dark;
  const contrastColor = darkMode ? colors.dark : colors.light;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginRight: 8,
        marginBottom: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: isSelected ? color : contrastColor,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: isSelected ? contrastColor : color }}>
        {children}
      </Text>
    </TouchableOpacity>
  );
};
const SEEDS_TO_SHOW = 15;

const DiscoverOptionsScreen = ({
  seeds = [],
  addSeed,
  removeSeed,
  confirmSeeds,
}) => {
  const [artists, setArtists] = useState<SpotifyApi.ArtistObjectFull[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    spotifyApi.getMyTopArtists({ limit: 50 }).then(({ body: { items } }) => {
      setArtists(items);
    });
  }, []);

  const maxSelected = seeds.length > 4;
  const confirmButtonValid = seeds.length > 0;

  const numPages = Math.ceil(artists.length / SEEDS_TO_SHOW);
  const firstIndex = (page % numPages) * SEEDS_TO_SHOW;
  const lastIndex = firstIndex + SEEDS_TO_SHOW;

  const artistsToShow = artists.slice(firstIndex, lastIndex);

  return (
    <View style={styles.content}>
      <Text style={typographyStyles.heading}>Discover</Text>
      <Text style={{ marginTop: 8 }}>
        What do you like to run to? Choose up to 5 artists or genres.
      </Text>
      <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap' }}>
        {R.unionWith(R.eqBy(R.prop('id')), seeds, artistsToShow).map(
          (artist) => {
            const isSelected = seeds.find(({ name }) => name === artist.name);
            return (
              <Seed
                key={artist.id}
                isSelected={isSelected}
                disabled={!isSelected && maxSelected}
                onPress={() =>
                  isSelected
                    ? removeSeed(artist.id)
                    : maxSelected
                    ? null
                    : addSeed({
                        id: artist.id,
                        name: artist.name,
                        type: 'ARTIST',
                      })
                }
              >
                {artist.name}
              </Seed>
            );
          },
        )}
      </View>
      <Text
        style={{ textDecorationLine: 'underline' }}
        onPress={() => setPage(page + 1)}
      >
        Refresh
      </Text>
      <Button
        style={{ marginTop: 'auto' }}
        title="confirm"
        onPress={confirmSeeds}
        disabled={!confirmButtonValid}
      >
        Confirm >>>
      </Button>
    </View>
  );
};

interface Seed {
  id: string;
  value: string;
  type: 'ARTIST' | 'GENRE';
}

const AnimateComponent = Platform.OS === 'web' ? 'div' : View;

const Progress = posed(AnimateComponent)({
  progress: {
    width: ({ progress }) => `${progress}`,
  },
});

const ScreenTransition = posed(AnimateComponent)({
  initial: {
    x: 600,
    opacity: 1,
  },
  enter: {
    x: 0,
    opacity: 1,
    transition: { duration: 300 },
  },
  exit: {
    x: -600,
    opacity: 0,
    transition: { duration: 300 },
  },
});

const App = () => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const { token, expires, handleLogin } = useSpotifyAuthentication();

  const [playlistType, setPlaylistType] = useState('');
  const [minTempo, setMinTempo] = useState(0);

  const [seeds, setSeeds] = useState<Seed[]>([]);

  const [screenIndex, setScreenIndex] = useState(0);

  const darkMode = useDarkMode();

  const themeStatusBarStyle = darkMode ? 'light-content' : 'dark-content';

  const goToFirstScreen = () => {
    setScreenIndex(0);
  };

  const goToNextScreen = () => {
    setScreenIndex(screenIndex + 1);
  };

  const addSeed = (seed: Seed) => {
    setSeeds(R.append(seed, seeds));
  };

  const removeSeed = (id: string) => {
    setSeeds(R.reject(R.propEq('id', id)));
  };

  const handleChoosePlaylistType = (playlistType) => {
    setPlaylistType(playlistType);
    goToNextScreen();
  };

  const handleChooseTempo = (tempo) => {
    setMinTempo(tempo);
    goToNextScreen();
  };

  useEffect(() => {
    Font.loadAsync({
      Syncopate: require('./assets/fonts/Syncopate-Bold.ttf'),
    }).then(() => setFontsLoaded(true));
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  const screens = R.filter(R.prop('include'))([
    {
      name: 'initial',
      include: true,
      component: (
        <InitialScreen
          isLoggedIn={Boolean(token)}
          onButtonClick={() => {
            const currentTime = new Date().getTime();
            if (token && expires > currentTime) {
              goToNextScreen();
              return;
            }
            handleLogin().then(goToNextScreen);
          }}
        />
      ),
    },
    {
      name: 'pace',
      include: true,
      component: <PaceScreen handleChooseTempo={handleChooseTempo} />,
    },
    {
      name: 'playlistType',
      include: true,
      component: (
        <PlaylistTypeScreen
          handleChoosePlaylistType={handleChoosePlaylistType}
        />
      ),
    },
    {
      name: 'discoverOptions',
      include: playlistType === 'DISCOVER',
      component: (
        <DiscoverOptionsScreen
          seeds={seeds}
          addSeed={addSeed}
          removeSeed={removeSeed}
          confirmSeeds={goToNextScreen}
        />
      ),
    },
    {
      name: 'listTracks',
      include: true,
      component: (
        <ListTracks
          playlistType={playlistType}
          seeds={seeds}
          minTempo={minTempo}
          goToFirstScreen={goToFirstScreen}
        />
      ),
    },
  ]);

  const currentScreen = screens[screenIndex];

  const shownNumber = R.compose(
    R.length,
    R.slice(0, R.inc(screenIndex)),
  )(screens);

  const progressPercentage = (shownNumber / screens.length) * 100;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: darkMode ? colors.dark : colors.light,
      }}
    >
      <StatusBar barStyle={themeStatusBarStyle} />
      <SafeAreaView style={[styles.container]}>
        <View style={styles.titleContainer}>
          <TitleSection />
        </View>
        <View style={styles.underlineContainer}>
          <Progress
            pose="progress"
            poseKey={progressPercentage}
            progress={
              currentScreen.name !== 'initial'
                ? `${progressPercentage}%`
                : '100%'
            }
            style={{
              height: 8,
              backgroundColor: darkMode ? colors.light : colors.dark,
            }}
          />
        </View>
        <View style={{ flex: 1, position: 'relative' }}>
          <Transition preEnterPose="initial" exitPose="exit">
            <ScreenTransition
              style={{
                flex: 1,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              key={screenIndex}
            >
              {currentScreen.component}
            </ScreenTransition>
          </Transition>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default () => (
  <AppearanceProvider>
    <App />
  </AppearanceProvider>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 700,
    width: '100%',
    height: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: 120,
  },
  titleContainer: {
    alignItems: 'flex-start',
    padding: 24,
  },
  title: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 48,
    lineHeight: 48,
    fontFamily: 'Syncopate',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  underlineContainer: {
    paddingHorizontal: 24,
  },
  content: {
    padding: 24,
    flex: 1,
    height: '100%',
  },
});

const typographyStyles = StyleSheet.create({
  heading: {
    fontFamily: 'Syncopate',
    textTransform: 'uppercase',
    fontSize: 18,
  },
});
