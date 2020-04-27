import React, { FunctionComponent } from 'react';

import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { ContentContainer } from '../components/ContentContainer';

interface InitialScreenProps {
  isLoggedIn: boolean;
  onButtonClick: () => void;
}
export const InitialScreen: FunctionComponent<InitialScreenProps> = ({
  isLoggedIn,
  onButtonClick,
}) => (
  <ContentContainer>
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
  </ContentContainer>
);
