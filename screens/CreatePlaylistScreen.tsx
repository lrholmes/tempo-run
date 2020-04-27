import React, { useState, useEffect, FunctionComponent } from 'react';
import { View, ScrollView, Platform, Linking } from 'react-native';
import * as R from 'remeda';

import { Seed, PlaylistType } from '../App';
import {
  FullTrackObjectWithAudioFeatures,
  createPlaylist,
  getMyRecommendedTracks,
  getMySavedTracksWithAudioFeatures,
} from '../spotify';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { ContentContainer } from '../components/ContentContainer';

interface TrackProps {
  track: FullTrackObjectWithAudioFeatures | SpotifyApi.TrackObjectSimplified;
}
const Track: FunctionComponent<TrackProps> = ({ track }) => (
  <View style={{ marginBottom: 8 }}>
    <Text style={{ fontWeight: 'bold' }}>{track.name}</Text>
    <Text>{track.artists.map(({ name }) => name).join(', ')}</Text>
  </View>
);

interface CreatePlaylistScreenProps {
  seeds: Seed[];
  playlistType: PlaylistType;
  minTempo: number;
  goToFirstScreen: () => void;
}
export const CreatePlaylistScreen: FunctionComponent<CreatePlaylistScreenProps> = ({
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
    <ContentContainer style={{ padding: 0, position: 'relative' }}>
      <ScrollView style={{ padding: 24, flex: 1, paddingBottom: 64 }}>
        <Text heading style={{ marginBottom: 16 }}>
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
    </ContentContainer>
  );
};
