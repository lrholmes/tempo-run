import * as R from 'ramda';
import SpotifyWebApi from 'spotify-web-api-node';

export const SPOTIFY_CLIENT_ID = '27aa5044b27d4f349c7eb7c513faa50c';

export const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
});

const mergeById = R.compose(
  R.map(R.mergeAll),
  R.values,
  R.groupBy(R.prop('id')),
);

const getAudioFeaturesForTracks = async (
  trackIds: string[],
): Promise<SpotifyApi.AudioFeaturesObject[]> => {
  // limit per request on fetching audio features is 100
  const groupedTrackIds = R.splitEvery(100, trackIds);

  const audioFeatureRequests = groupedTrackIds.map((tracks) =>
    spotifyApi.getAudioFeaturesForTracks(tracks),
  );

  const audioFeaturesData = await Promise.all(audioFeatureRequests);

  const flattened = R.compose(
    R.flatten,
    R.map(R.path(['body', 'audio_features'])),
  )(audioFeaturesData);

  return flattened;
};

type VariableTrackObject =
  | SpotifyApi.TrackObjectSimplified
  | SpotifyApi.TrackObjectFull
  | SpotifyApi.SavedTrackObject;

const addAudioFeaturesToTracks = async (
  tracks: VariableTrackObject[],
): Promise<VariableTrackObject[]> => {
  const audioFeatures = await getAudioFeaturesForTracks(R.pluck('id', tracks));

  return mergeById(R.concat(tracks, audioFeatures));
};

const getSavedTracks = async (
  fetchUpTo: number,
  tracks: SpotifyApi.SavedTrackObject[] = [],
): Promise<SpotifyApi.SavedTrackObject[]> => {
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

export type FullTrackObjectWithAudioFeatures = SpotifyApi.TrackObjectFull &
  SpotifyApi.AudioFeaturesObject;

export const getMySavedTracksWithAudioFeatures = async (
  minTempo: number = 165,
): Promise<FullTrackObjectWithAudioFeatures[]> => {
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

export const getMyRecommendedTracksWithAudioFeatures = async (
  seeds: Seed[],
  minTempo: number,
): Promise<SpotifyApi.TrackObjectSimplified[]> => {
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

export const createPlaylist = async (
  trackUris: string[],
): Promise<SpotifyApi.PlaylistObjectFull> => {
  const me = await spotifyApi.getMe();
  const newPlaylist = await spotifyApi.createPlaylist(
    me.body.id,
    'Running Playlist',
    {
      description: 'Your running playlist, created using Tempo Run.',
    },
  );

  await spotifyApi.addTracksToPlaylist(newPlaylist.body.id, trackUris);

  return newPlaylist.body;
};
