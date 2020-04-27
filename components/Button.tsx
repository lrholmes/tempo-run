import React, { FunctionComponent } from 'react';
import {
  View,
  TouchableOpacityProps,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { colors } from '../colors';
import { useDarkMode } from '../App';
import { Text, TextProps } from './Text';

export const ButtonText: FunctionComponent<TextProps> = ({
  style,
  ...props
}) => {
  const darkMode = useDarkMode();
  return (
    <Text
      style={[
        buttonStyles.buttonText,
        ...(Array.isArray(style) ? style : [style]),
        { color: darkMode ? colors.dark : colors.light },
      ]}
      {...props}
    />
  );
};

interface ButtonProps extends TouchableOpacityProps {
  disabled?: boolean;
}
export const Button: FunctionComponent<ButtonProps> = ({
  disabled,
  onPress,
  style,
  children,
  ...props
}) => {
  const darkMode = useDarkMode();
  return (
    <TouchableOpacity
      {...props}
      style={[
        buttonStyles.button,
        {
          backgroundColor: darkMode ? colors.light : colors.dark,
          opacity: disabled ? 0.7 : 1,
        },
        style,
      ]}
      onPress={disabled ? undefined : onPress}
    >
      <ButtonText>{children}</ButtonText>
    </TouchableOpacity>
  );
};

export const BigButton: FunctionComponent<ButtonProps> = ({
  children,
  onPress,
}) => {
  const darkMode = useDarkMode();
  return (
    <View
      style={{
        flexBasis: '50%',
        flexGrow: 1,
        minWidth: 300,
        padding: 4,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        style={[
          buttonStyles.button,
          {
            backgroundColor: darkMode ? colors.light : colors.dark,
            alignItems: 'center',
          },
        ]}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
};

const buttonStyles = StyleSheet.create({
  button: {
    backgroundColor: colors.dark,
    borderRadius: 0,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    textTransform: 'uppercase',
    fontFamily: 'Syncopate',
  },
});
