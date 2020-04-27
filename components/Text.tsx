import React, { FunctionComponent } from 'react';
import {
  Text as PrimitiveText,
  TextProps as PrimitiveTextProps,
  StyleSheet,
} from 'react-native';

import { useDarkMode } from '../useDarkMode';
import { colors } from '../colors';

export interface TextProps extends PrimitiveTextProps {
  heading?: boolean;
  color?: {
    lightMode: string;
    darkMode: string;
  };
}
export const Text: FunctionComponent<TextProps> = ({
  heading,
  style,
  color,
  ...props
}) => {
  const darkMode = useDarkMode();

  const lightModeColor = color?.lightMode ?? colors.dark;
  const darkModeColor = color?.darkMode ?? colors.light;
  return (
    <PrimitiveText
      style={[
        { color: darkMode ? darkModeColor : lightModeColor },
        heading ? typographyStyles.heading : null,
        ...(Array.isArray(style) ? style : [style]),
      ]}
      {...props}
    />
  );
};

const typographyStyles = StyleSheet.create({
  heading: {
    fontFamily: 'Syncopate',
    textTransform: 'uppercase',
    fontSize: 18,
  },
});
