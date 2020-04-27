import React, { useState, useEffect, ReactElement } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  Linking,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { AppearanceProvider, useColorScheme } from 'react-native-appearance';
import * as WebBrowser from 'expo-web-browser';
import * as Font from 'expo-font';
import * as R from 'remeda';
import { Helmet } from 'react-helmet';

import posed, { Transition } from './pose';
import { colors } from './colors';
import { useSpotifyAuthentication } from './useSpotifyAuthentication';
import { Text } from './components/Text';
import { InitialScreen } from './screens/InitialScreen';
import { PaceScreen } from './screens/PaceScreen';
import { PlaylistTypeScreen } from './screens/PlaylistTypeScreen';
import { DiscoverOptionsScreen } from './screens/DiscoverOptionsScreen';
import { CreatePlaylistScreen } from './screens/CreatePlaylistScreen';

if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export const useDarkMode = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark';
};

const WebMeta = () => (
  <Helmet>
    <meta name="apple-itunes-app" content="app-id=1509999732" />
    <meta name="twitter:card" content="summary" />
  </Helmet>
);

export type PlaylistType = 'DISCOVER' | 'MY_TRACKS';

const TitleSection = () => (
  <View style={styles.title}>
    <Text style={styles.titleText}>Tempo</Text>
    <Text style={[styles.titleText, { letterSpacing: -4 }]}>>>> Run</Text>
  </View>
);

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
      name: 'createPlaylist',
      include: true,
      component: (
        <CreatePlaylistScreen
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
