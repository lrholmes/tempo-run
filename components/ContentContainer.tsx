import React, { FunctionComponent } from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';

export const ContentContainer: FunctionComponent<ViewProps> = ({
  style,
  ...props
}) => (
  <View
    style={[styles.content, ...(Array.isArray(style) ? style : [style])]}
    {...props}
  />
);

const styles = StyleSheet.create({
  content: {
    padding: 24,
    flex: 1,
    height: '100%',
  },
});
