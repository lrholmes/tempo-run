import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View, Button } from 'react-native';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

if (Platform.OS === 'web') {
  // @ts-ignore
  Constants.manifest.id = '@lawrenceholmes/running-playlist';
  WebBrowser.maybeCompleteAuthSession();
}

const SCOPE = [
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'ugc-image-upload',
].join('%20');

const SPOTIFY_CLIENT_ID = '27aa5044b27d4f349c7eb7c513faa50c';
export const LOGIN_URL = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&scope=${SCOPE}`;

export const login = async () => {
  const redirectUrl = AuthSession.getRedirectUrl();
  const result = await AuthSession.startAsync({
    authUrl: `${LOGIN_URL}&redirect_uri=${encodeURIComponent(redirectUrl)}`,
    returnUrl: Constants.linkingUri,
  });
  return result;
};

export default function App() {
  const [token, setToken] = useState('');
  const [authState, setAuthState] = useState('');

  const handleLogin = () => {
    login().then((result) => {
      if (result.type === 'success') {
        setToken(result.params.access_token);
      }
      setAuthState(result.type);
    });
  };

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <Button title="login" onPress={handleLogin}>
        login
      </Button>
      <Text>state: {authState}</Text>
      <Text>token: {token}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
