import { useColorScheme } from 'react-native-appearance';

export const useDarkMode = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark';
};
