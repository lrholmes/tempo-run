import React, { useState, useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  SafeAreaView,
  AsyncStorage,
} from 'react-native';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Font from 'expo-font';
import { AuthSessionResult } from 'expo-auth-session/build/AuthSession.types';
import SpotifyWebApi from 'spotify-web-api-node';
import * as R from 'ramda';

import posed, { Transition } from './pose';

if (Platform.OS === 'web') {
  Constants.manifest.id = `@lawrenceholmes/${Constants.manifest.slug}`;
  WebBrowser.maybeCompleteAuthSession();
}

const SCOPE = [
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'ugc-image-upload',
  'user-follow-read',
  'user-library-read',
  'user-top-read',
  'user-read-recently-played',
].join('%20');

const SPOTIFY_CLIENT_ID = '27aa5044b27d4f349c7eb7c513faa50c';
export const LOGIN_URL = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&scope=${SCOPE}`;

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
});

export const login = async () => {
  const redirectUrl = AuthSession.getRedirectUrl();
  const result = await AuthSession.startAsync({
    authUrl: `${LOGIN_URL}&redirect_uri=${encodeURIComponent(redirectUrl)}`,
    returnUrl: Constants.linkingUri,
  });
  return result;
};

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
  const [authState, setAuthState] = useState<
    AuthSessionResult['type'] | undefined
  >(undefined);

  useEffect(() => {
    getAuthState().then((authState) => {
      console.log({ authState });
      if (authState) {
        const timeNow = new Date().getTime();
        if (authState.expiresIn > timeNow) {
          setToken(authState.token);
        }
      }
    });
  }, []);

  const handleLogin = () =>
    login().then((result) => {
      if (result.type === 'success') {
        const { access_token: token, expires_in: expiresIn } = result.params;
        setToken(token);
        persistAuthState({
          token,
          expiresIn: new Date().getTime() + expiresIn,
        });
      }
      setAuthState(result.type);
      return result;
    });

  useEffect(() => {
    if (token && spotifyApi) {
      spotifyApi.setAccessToken(token);
    }
  }, [token, spotifyApi]);

  return { token, authState, handleLogin };
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
    R.filter(({ tempo, energy }) => energy > 0.5 && tempo > minTempo),
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

const Button = ({ disabled, onPress, style, children, ...props }) => (
  <TouchableOpacity
    {...props}
    style={[buttonStyles.button, { opacity: disabled ? 0.7 : 1 }, style]}
    onPress={disabled ? null : onPress}
  >
    <Text style={buttonStyles.buttonText}>{children}</Text>
  </TouchableOpacity>
);

const buttonStyles = StyleSheet.create({
  button: {
    backgroundColor: '#000',
    borderRadius: 0,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    textTransform: 'uppercase',
    fontFamily: 'Syncopate',
    color: '#fff',
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
        <View
          key={index}
          style={{
            flexBasis: '50%',
            flexGrow: 1,
            minWidth: 300,
            padding: 4,
          }}
        >
          <TouchableOpacity
            onPress={() => handleChooseTempo(bpmLower)}
            style={[
              buttonStyles.button,
              {
                alignItems: 'center',
              },
            ]}
          >
            <Text style={buttonStyles.buttonText}>
              {kmMinsLower} - {kmMinsUpper} mins per km
            </Text>
            <Text style={[buttonStyles.buttonText, { marginTop: 8 }]}>
              {bpmLower} BPM+
            </Text>
            <Text
              style={[
                buttonStyles.buttonText,
                { marginTop: 8, color: '#f5f5f5' },
              ]}
            >
              {'>'.repeat(index + 1)}
            </Text>
          </TouchableOpacity>
        </View>
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
      <View
        style={{
          flexBasis: '50%',
          flexGrow: 1,
          minWidth: 300,
          padding: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => handleChoosePlaylistType('DISCOVER')}
          style={[
            buttonStyles.button,
            {
              alignItems: 'flex-start',
            },
          ]}
        >
          <Text style={buttonStyles.buttonText}>Discover >>></Text>
          <Text style={{ marginTop: 8, color: '#f5f5f5' }}>
            Branch out. Get a playlist of tracks, some you might already know,
            most you probably haven’t heard before
          </Text>
        </TouchableOpacity>
      </View>
      <View
        style={{
          flexBasis: '50%',
          flexGrow: 1,
          minWidth: 300,
          padding: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => handleChoosePlaylistType('MY_TRACKS')}
          style={[
            buttonStyles.button,
            {
              alignItems: 'flex-start',
            },
          ]}
        >
          <Text style={buttonStyles.buttonText}>My Tracks >>></Text>
          <Text style={{ marginTop: 8, color: '#f5f5f5' }}>
            Get a playlist exclusively of tracks that you already love and
            listen to regularly
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const Seed = ({ disabled, isSelected, children, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      marginRight: 8,
      marginBottom: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: '#000',
      backgroundColor: isSelected ? '#000' : '#fff',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <Text style={{ color: isSelected ? '#fff' : '#000' }}>{children}</Text>
  </TouchableOpacity>
);

const DiscoverOptionsScreen = ({
  seeds = [],
  addSeed,
  removeSeed,
  confirmSeeds,
}) => {
  const [artists, setArtists] = useState<SpotifyApi.ArtistObjectFull>([]);

  useEffect(() => {
    spotifyApi.getMyTopArtists().then(({ body: { items } }) => {
      setArtists(items);
    });
  }, []);

  const maxSelected = seeds.length > 4;

  return (
    <View style={styles.content}>
      <Text style={typographyStyles.heading}>Discover</Text>
      <Text style={{ marginTop: 8 }}>
        What do you like to run to? Choose up to 5 artists or genres.
      </Text>
      <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap' }}>
        {artists.map((artist) => {
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
        })}
      </View>
      <Button
        style={{ marginTop: 'auto' }}
        title="confirm"
        onPress={confirmSeeds}
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

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const { token, handleLogin } = useSpotifyAuthentication();

  const [playlistType, setPlaylistType] = useState('');
  const [minTempo, setMinTempo] = useState(0);

  const [seeds, setSeeds] = useState<Seed[]>([]);

  const [screenIndex, setScreenIndex] = useState(0);

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
          onButtonClick={
            token ? goToNextScreen : () => handleLogin().then(goToNextScreen)
          }
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
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <TitleSection />
      </View>
      <View style={styles.underlineContainer}>
        <Progress
          pose="progress"
          poseKey={progressPercentage}
          progress={
            currentScreen.name !== 'initial' ? `${progressPercentage}%` : '100%'
          }
          style={{
            height: 8,
            backgroundColor: '#000',
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  textInput: {
    padding: 8,
    backgroundColor: '#f5f5f5',
  },
});

const typographyStyles = StyleSheet.create({
  heading: {
    fontFamily: 'Syncopate',
    textTransform: 'uppercase',
    fontSize: 18,
  },
});
