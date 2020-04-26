import * as R from 'remeda';
import SpotifyWebApi from 'spotify-web-api-node';

export const SPOTIFY_CLIENT_ID = '27aa5044b27d4f349c7eb7c513faa50c';

export const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
});

import { Seed } from './App';

// tracks should probably be at least a bit happy
const MIN_VALENCE = 0.3;
const MIN_ENERGY = 0.5;

const getAudioFeaturesForTracks = async (
  trackIds: string[],
): Promise<SpotifyApi.AudioFeaturesObject[]> => {
  // limit per request on fetching audio features is 100
  const groupedTrackIds = R.chunk(trackIds, 100);

  const audioFeatureRequests = groupedTrackIds.map((tracks) =>
    spotifyApi.getAudioFeaturesForTracks(tracks),
  );

  const audioFeaturesData = await Promise.all(audioFeatureRequests);

  const audioFeatures = audioFeaturesData.map(
    (audioFeaturesResponse) => audioFeaturesResponse.body?.audio_features,
  );

  return R.flatten(audioFeatures);
};

type VariableTrackObject =
  | SpotifyApi.TrackObjectSimplified
  | SpotifyApi.TrackObjectFull;

type VariableTrackObjectWithAudioFeatures = VariableTrackObject &
  SpotifyApi.AudioFeaturesObject;

const addAudioFeaturesToTracks = async (
  tracks: VariableTrackObject[],
): Promise<VariableTrackObjectWithAudioFeatures[]> => {
  const audioFeatures = await getAudioFeaturesForTracks(
    R.map(tracks, ({ id }) => id),
  );

  const mergedById: VariableTrackObjectWithAudioFeatures[] = R.pipe(
    R.concat(tracks, audioFeatures),
    R.groupBy(({ id }) => id),
    Object.values,
    R.map((value) => R.mergeAll(value)),
  );

  return mergedById;
};

const getSavedTracks = async (
  fetchUpTo: number,
  tracks: SpotifyApi.TrackObjectFull[] = [],
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const savedTrackData = await spotifyApi.getMySavedTracks({
    limit: 50,
    offset: tracks.length,
  });

  const hasNext = Boolean(savedTrackData.body.next);
  const newTracks = [
    ...tracks,
    ...savedTrackData.body.items.map(({ track }) => track),
  ];

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

  const filtered = withAudioFeatures.filter(
    ({ tempo, energy, valence }) =>
      valence > MIN_VALENCE && energy > MIN_ENERGY && tempo > minTempo,
  );

  return filtered as FullTrackObjectWithAudioFeatures[];
};

export const getMyRecommendedTracks = async (
  seeds: Seed[],
  minTempo: number,
): Promise<SpotifyApi.TrackObjectSimplified[]> => {
  const artistIds = seeds
    .filter(({ type }) => type === 'ARTIST')
    .map(({ id }) => id)
    .slice(0, 5);

  const recommendedTracks = await spotifyApi.getRecommendations({
    min_energy: MIN_ENERGY,
    min_valence: MIN_VALENCE,
    min_tempo: minTempo,
    limit: 50,
    seed_artists: artistIds,
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
