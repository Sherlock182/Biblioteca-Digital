import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    SystemUI.setBackgroundColorAsync('#2F1E12').catch(() => undefined);
  }, []);



  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chapter-reader" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      {Platform.OS === 'android' ? (
        <View
          pointerEvents="none"
          style={[
            styles.androidBottomFallback,
            { height: insets.bottom > 0 ? insets.bottom : 24 },
          ]}
        />
      ) : null}
      {Platform.OS === 'android' ? <NavigationBar style="dark" hidden={false} /> : null}
      <StatusBar style="auto" hidden={false} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  androidBottomFallback: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2F1E12',
  },
});
