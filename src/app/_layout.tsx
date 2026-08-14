import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthGate } from '@/components/auth/auth-gate';
import { deleteAllUserData } from '@/data/delete-user-data';
import { getFirebase } from '@/lib/firebase';
import { AuthProvider } from '@/store/auth-provider';
import { UserThingsProvider } from '@/store/user-things-provider';

SplashScreen.preventAutoHideAsync();

/**
 * Provider order matters: `AuthProvider` sits outside the Things layer because which Things
 * exist depends on who is signed in. `UserThingsProvider` reads that and picks the repository.
 */
export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Runs while the user's credentials are still valid — after the auth record is gone their
  // documents are unreachable under the uid-scoped rules, so this cannot be deferred.
  const wipeUserData = useCallback(async (uid: string) => {
    const firebase = getFirebase();
    if (!firebase) return;
    await deleteAllUserData(firebase.db, uid);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider onBeforeDeleteAccount={wipeUserData}>
        <AnimatedSplashOverlay />
        <AuthGate>
          <UserThingsProvider>
            <AppTabs />
          </UserThingsProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
