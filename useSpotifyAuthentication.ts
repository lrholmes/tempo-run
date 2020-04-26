import { useEffect, useState } from 'react';
import { Platform, AsyncStorage } from 'react-native';
import * as AuthSession from 'expo-auth-session';

import { SPOTIFY_CLIENT_ID, spotifyApi } from './spotify';

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

const redirectUrl = AuthSession.getRedirectUrl();

const persistAuthState = (token: string, expiresIn: number) =>
  AsyncStorage.setItem('authState', JSON.stringify({ token, expiresIn }));

const getLocalAuthState = async () => {
  const jsonString = await AsyncStorage.getItem('authState');
  try {
    return jsonString ? JSON.parse(jsonString) : null;
  } catch {
    return null;
  }
};

export const useSpotifyAuthentication = () => {
  const [token, setToken] = useState('');
  const [expires, setExpires] = useState<number | undefined>(undefined);

  const [, result, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      redirectUri: redirectUrl,
      scopes: SCOPE,
      usePKCE: false,
      responseType: AuthSession.ResponseType.Token,
    },
    {
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
      tokenEndpoint: '', // typed as required, but not used with implicit grant
    },
  );

  useEffect(() => {
    if (result?.type === 'success') {
      const { access_token: token, expires_in: expiresIn } = result.params;
      const expires = new Date().getTime() + Number(expiresIn) * 1000;
      setToken(token);
      setExpires(expires);
      persistAuthState(token, expires);
    }
  }, [result?.type]);

  useEffect(() => {
    getLocalAuthState().then((authState) => {
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
