import React, {
  useState,
  useEffect,
  FunctionComponent,
  ReactElement,
} from 'react';
import {
  Platform,
  StyleSheet,
  Text as PrimitiveText,
  TextProps as PrimitiveTextProps,
  View,
  TouchableOpacity,
  ScrollView,
  Linking,
  SafeAreaView,
  StatusBar,
  TouchableOpacityProps,
} from 'react-native';
import { AppearanceProvider, useColorScheme } from 'react-native-appearance';
import * as WebBrowser from 'expo-web-browser';
import * as Font from 'expo-font';
import * as R from 'remeda';
import { Helmet } from 'react-helmet';

import posed, { Transition } from './pose';
import {
  FullTrackObjectWithAudioFeatures,
  spotifyApi,
  getMySavedTracksWithAudioFeatures,
  getMyRecommendedTracks,
  createPlaylist,
} from './spotify';
import { useSpotifyAuthentication } from './useSpotifyAuthentication';

if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

const colors = {
  light: '#fff',
  dark: '#222',
  lightGray: '#f5f5f5',
  darkGray: '#444',
};

const useDarkMode = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark';
};

const WebMeta = () => (
  <Helmet>
    <meta name="apple-itunes-app" content="app-id=1509999732" />
    <meta name="twitter:card" content="summary" />
  </Helmet>
);

type PlaylistType = 'DISCOVER' | 'MY_TRACKS';

interface TextProps extends PrimitiveTextProps {
  color?: {
    lightMode: string;
    darkMode: string;
  };
}
const Text: FunctionComponent<TextProps> = ({ style, color, ...props }) => {
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

const ButtonText: FunctionComponent<PrimitiveTextProps> = ({
  style,
  ...props
}: PrimitiveTextProps) => {
  const darkMode = useDarkMode();
  return (
    <Text
      style={[
        buttonStyles.buttonText,
        ...(Array.isArray(style) ? style : [style]),
        { color: darkMode ? colors.dark : colors.light },
      ]}
      {...props}
    />
  );
};

interface ButtonProps extends TouchableOpacityProps {
  disabled?: boolean;
}
const Button: FunctionComponent<ButtonProps> = ({
  disabled,
  onPress,
  style,
  children,
  ...props
}) => {
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
      onPress={disabled ? undefined : onPress}
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

interface TrackProps {
  track: FullTrackObjectWithAudioFeatures | SpotifyApi.TrackObjectSimplified;
}
const Track: FunctionComponent<TrackProps> = ({ track }) => (
  <View style={{ marginBottom: 8 }}>
    <Text style={{ fontWeight: 'bold' }}>{track.name}</Text>
    <Text>{track.artists.map(({ name }) => name).join(', ')}</Text>
  </View>
);

interface ListTracksProps {
  seeds: Seed[];
  playlistType: PlaylistType;
  minTempo: number;
  goToFirstScreen: () => void;
}
const ListTracks: FunctionComponent<ListTracksProps> = ({
  seeds,
  playlistType,
  minTempo,
  goToFirstScreen,
}) => {
  const [playlist, setPlaylist] = useState<
    SpotifyApi.PlaylistObjectFull | undefined
  >(undefined);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracks, setTracks] = useState<
    (FullTrackObjectWithAudioFeatures | SpotifyApi.TrackObjectSimplified)[]
  >([]);

  useEffect(() => {
    const getTracks =
      playlistType === 'DISCOVER'
        ? getMyRecommendedTracks(seeds, minTempo)
        : getMySavedTracksWithAudioFeatures(minTempo);
    getTracks.then((tracks) => {
      setTracks(tracks);
      setTracksLoading(false);
    });
  }, []);

  const handleCreatePlaylist = () => {
    createPlaylist(R.map(tracks, ({ uri }) => uri)).then((playlist) => {
      setPlaylist(playlist);
    });
  };

  return (
    <View style={[styles.content, { padding: 0, position: 'relative' }]}>
      <ScrollView style={{ padding: 24, flex: 1, paddingBottom: 64 }}>
        <Text style={[typographyStyles.heading, { marginBottom: 16 }]}>
          {tracksLoading ? 'Loading Tracks...' : 'Your Playlist'}
        </Text>
        {!tracksLoading && tracks.length === 0 && (
          <Text>
            Sorry. No tracks could be found. Please try starting again with
            different options.
          </Text>
        )}
        {tracks.map((track) => (
          <Track key={track.id} track={track} />
        ))}
        <View style={{ paddingBottom: 128 }} />
      </ScrollView>
      <View
        // @ts-ignore - complains about position: 'fixed'
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
            onPress={() => Linking.openURL(playlist.external_urls.spotify)}
          >
            Listen to playlist
          </Button>
        ) : (
          <Button
            disabled={tracksLoading || tracks.length < 1}
            onPress={() => handleCreatePlaylist()}
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

interface InitialScreenProps {
  isLoggedIn: boolean;
  onButtonClick: () => void;
}
const InitialScreen: FunctionComponent<InitialScreenProps> = ({
  isLoggedIn,
  onButtonClick,
}) => (
  <View style={styles.content}>
    <Text style={{ fontSize: 18, marginBottom: 100, fontWeight: '500' }}>
      Create personalised playlists tailored to your pace and taste
    </Text>
    <Button style={{ marginTop: 'auto' }} onPress={onButtonClick}>
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

const BigButton: FunctionComponent<ButtonProps> = ({ children, onPress }) => {
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

interface PaceScreenProps {
  handleChooseTempo: (tempo: number) => void;
}
const PaceScreen: FunctionComponent<PaceScreenProps> = ({
  handleChooseTempo,
}) => (
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

interface PlaylistTypeScreenProps {
  handleChoosePlaylistType: (playlistType: PlaylistType) => void;
}
const PlaylistTypeScreen: FunctionComponent<PlaylistTypeScreenProps> = ({
  handleChoosePlaylistType,
}) => (
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

interface SeedProps extends TouchableOpacityProps {
  disabled: boolean;
  isSelected: boolean;
}
const Seed: FunctionComponent<SeedProps> = ({
  disabled,
  isSelected,
  children,
  onPress,
}) => {
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

interface DiscoverOptionsScreenProps {
  seeds: Seed[];
  addSeed: (seed: Seed) => void;
  removeSeed: (seedId: string) => void;
  confirmSeeds: () => void;
  goToPreviousScreen: () => void;
}
const DiscoverOptionsScreen: FunctionComponent<DiscoverOptionsScreenProps> = ({
  seeds = [],
  addSeed,
  removeSeed,
  confirmSeeds,
  goToPreviousScreen,
}) => {
  const [artists, setArtists] = useState<SpotifyApi.ArtistObjectFull[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    spotifyApi.getMyTopArtists({ limit: 50 }).then(({ body: { items } }) => {
      setArtists(items);
      setArtistsLoading(false);
    });
  }, []);

  const maxSelected = seeds.length > 4;
  const confirmButtonValid = seeds.length > 0;

  const numPages = Math.ceil(artists.length / SEEDS_TO_SHOW);
  const firstIndex = (page % numPages) * SEEDS_TO_SHOW;
  const lastIndex = firstIndex + SEEDS_TO_SHOW;

  const selectedArtistIds = seeds.map(({ id }) => id);
  const artistsToShow: Seed[] = artists
    .slice(firstIndex, lastIndex)
    .filter(({ id }) => !selectedArtistIds.includes(id))
    .map(({ id, name }) => ({ id, name, type: 'ARTIST' }));

  return (
    <View style={styles.content}>
      <Text style={typographyStyles.heading}>Discover</Text>
      <Text style={{ marginTop: 8 }}>
        What do you like to run to? Choose up to 5 artists.
      </Text>
      <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap' }}>
        {artists.length === 0 && !artistsLoading && (
          <Text
            onPress={goToPreviousScreen}
            style={{ textDecorationLine: 'underline' }}
          >
            Couldn't fetch your top artists. Go back and try the 'My Tracks'
            option.
          </Text>
        )}
        {[...seeds, ...artistsToShow].map((seed: Seed) => {
          const isSelected = Boolean(
            seeds.find(({ name }) => name === seed.name),
          );
          return (
            <Seed
              key={seed.id}
              isSelected={isSelected}
              disabled={!isSelected && maxSelected}
              onPress={() =>
                isSelected
                  ? removeSeed(seed.id)
                  : maxSelected
                  ? undefined
                  : addSeed({
                      id: seed.id,
                      name: seed.name,
                      type: 'ARTIST',
                    })
              }
            >
              {seed.name}
            </Seed>
          );
        })}
      </View>
      {!artistsLoading && artists.length > SEEDS_TO_SHOW && (
        <Text
          style={{ textDecorationLine: 'underline' }}
          onPress={() => setPage(page + 1)}
        >
          Refresh
        </Text>
      )}
      <Button
        style={{ marginTop: 'auto' }}
        onPress={confirmSeeds}
        disabled={!confirmButtonValid}
      >
        Confirm >>>
      </Button>
    </View>
  );
};

export interface Seed {
  id: string;
  name: string;
  type: 'ARTIST' | 'GENRE';
}

const AnimateComponent = Platform.OS === 'web' ? 'div' : View;

interface ProgressProps {
  progress: string;
}
const Progress = posed(AnimateComponent)({
  progress: {
    width: ({ progress }: ProgressProps) => `${progress}`,
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

interface Screen {
  name: string;
  include: boolean;
  component: ReactElement;
}

const App = () => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const { token, expires, handleLogin } = useSpotifyAuthentication();

  const [playlistType, setPlaylistType] = useState<PlaylistType>('MY_TRACKS');
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
  const goToPreviousScreen = () => {
    setScreenIndex(screenIndex - 1);
  };

  const addSeed = (seed: Seed) => {
    setSeeds([...seeds, seed]);
  };

  const removeSeed = (seedId: string) => {
    setSeeds(R.reject(({ id }) => id === seedId));
  };

  const handleChoosePlaylistType = (playlistType: PlaylistType) => {
    setPlaylistType(playlistType);
    goToNextScreen();
  };

  const handleChooseTempo = (tempo: number) => {
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

  const screens: Screen[] = [
    {
      name: 'initial',
      include: true,
      component: (
        <InitialScreen
          isLoggedIn={Boolean(token)}
          onButtonClick={() => {
            const currentTime = new Date().getTime();
            if (token && expires && expires > currentTime) {
              goToNextScreen();
              return;
            }
            handleLogin().then(({ type }) =>
              type === 'success' ? goToNextScreen() : null,
            );
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
          goToPreviousScreen={goToPreviousScreen}
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
  ].filter(({ include }) => include);

  const currentScreen = screens[screenIndex];

  const shownNumber = screens.slice(0, screenIndex + 1).length;

  const progressPercentage = (shownNumber / screens.length) * 100;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: darkMode ? colors.dark : colors.light,
      }}
    >
      {Platform.OS === 'web' && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            padding: 16,
            width: '100%',
            minWidth: 700,
            zIndex: -1,
            alignItems: 'flex-end',
          }}
        >
          <Text
            onPress={() =>
              Linking.openURL('https://github.com/lrholmes/tempo-run')
            }
            style={{ textDecorationLine: 'underline' }}
          >
            GitHub
          </Text>
        </View>
      )}
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
    {Platform.OS === 'web' && <WebMeta />}
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
