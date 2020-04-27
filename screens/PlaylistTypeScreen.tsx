import React, { FunctionComponent } from 'react';
import { View } from 'react-native';

import { colors } from '../colors';
import { PlaylistType } from '../App';
import { BigButton, ButtonText } from '../components/Button';
import { Text } from '../components/Text';
import { ContentContainer } from '../components/ContentContainer';

interface PlaylistTypeScreenProps {
  handleChoosePlaylistType: (playlistType: PlaylistType) => void;
}
export const PlaylistTypeScreen: FunctionComponent<PlaylistTypeScreenProps> = ({
  handleChoosePlaylistType,
}) => (
  <ContentContainer>
    <Text heading>Playlist Type</Text>
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
  </ContentContainer>
);
