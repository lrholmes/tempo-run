import React, { FunctionComponent, useEffect, useState } from 'react';
import { View, TouchableOpacity, TouchableOpacityProps } from 'react-native';

import { colors } from '../colors';
import { spotifyApi } from '../spotify';
import { useDarkMode, Seed } from '../App';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { ContentContainer } from '../components/ContentContainer';

interface SeedProps extends TouchableOpacityProps {
  disabled: boolean;
  isSelected: boolean;
}
const SeedOption: FunctionComponent<SeedProps> = ({
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
export const DiscoverOptionsScreen: FunctionComponent<DiscoverOptionsScreenProps> = ({
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
    <ContentContainer>
      <Text heading>Discover</Text>
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
            <SeedOption
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
            </SeedOption>
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
    </ContentContainer>
  );
};
