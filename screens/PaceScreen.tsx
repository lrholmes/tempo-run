import React, { FunctionComponent } from 'react';
import { View } from 'react-native';

import { colors } from '../colors';
import { BigButton, ButtonText } from '../components/Button';
import { Text } from '../components/Text';
import { ContentContainer } from '../components/ContentContainer';

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

interface PaceScreenProps {
  handleChooseTempo: (tempo: number) => void;
}
export const PaceScreen: FunctionComponent<PaceScreenProps> = ({
  handleChooseTempo,
}) => (
  <ContentContainer>
    <Text heading>What's your pace?</Text>
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
  </ContentContainer>
);
