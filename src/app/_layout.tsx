import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthGate } from '@/components/auth/auth-gate';
import { AuthProvider } from '@/store/auth-provider';
import { ThingsProvider } from '@/store/things-provider';

SplashScreen.preventAutoHideAsync();

/**
 * Provider order matters: `AuthProvider` sits outside `ThingsProvider` because which Things
 * exist depends on who is signed in. Phase 3 reads the uid here to pick the repository.
 */
export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <AuthGate>
          <ThingsProvider>
            <AppTabs />
          </ThingsProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
