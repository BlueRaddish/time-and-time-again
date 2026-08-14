import { ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AccountSection } from '@/components/settings/account-section';
import { GoogleSyncSection } from '@/components/settings/google-sync-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth-provider';

/**
 * Layer 2 in the disclosure model: preferences that apply to the whole app rather than to one
 * Thing. Only what already exists is here — account and sync. Week start, default view and
 * default precision belong here too and are not built.
 */
export default function SettingsScreen() {
  const { requiresAuth } = useAuth();

  return (
    <Screen title="Settings" subtitle="Account and sync">
      <ScrollView contentContainerStyle={styles.body}>
        {requiresAuth ? (
          <>
            <AccountSection />
            <ThemedView type="backgroundElement" style={styles.divider} />
            <GoogleSyncSection />
          </>
        ) : (
          <View style={styles.local}>
            <ThemedText type="smallBold">This device only</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              No account is configured, so your Things are stored on this device and nothing
              leaves it. There is nothing to sign in to and nothing to sync.
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.four, paddingBottom: Spacing.six },
  divider: { height: 1 },
  local: { gap: Spacing.two },
});
