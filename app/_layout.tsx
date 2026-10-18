import { EBGaramond_400Regular, EBGaramond_700Bold, useFonts } from '@expo-google-fonts/eb-garamond';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppSettingsProvider } from '@/constants/app-settings';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppSettingsProvider>
        <RootLayoutContent />
      </AppSettingsProvider>
    </SafeAreaProvider>
  );
}


function RootLayoutContent() {
  const colorScheme = useColorScheme();
  // Book typeface for the "Libro" reading option; until it loads the reader uses the phone's font.
  useFonts({ EBGaramond_400Regular, EBGaramond_700Bold });

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chapter-reader" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
