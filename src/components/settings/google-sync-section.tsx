/**
 * Connecting Google Calendar and Google Tasks.
 *
 * Sync is opt-in and separate from signing in — a user may sign in with Google and still never
 * want the app writing to their calendar. The two are different scopes and different consent,
 * so they are different buttons in different places.
 *
 * The button is hidden entirely when no Google client id is configured, rather than shown
 * broken. Until phase 0's OAuth client ids exist, that is the state.
 */

import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGoogleConnection } from '@/hooks/use-google-connection';

export function GoogleSyncSection() {
  const google = useGoogleConnection();

  if (!google.available) {
    return (
      <View style={styles.section}>
        <ThemedText type="smallBold">Google Calendar and Tasks</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Not available in this build — no Google client ID is configured.
        </ThemedText>
      </View>
    );
  }

  const disabled = google.preparing || google.connecting;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Google Calendar and Tasks</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Things with a start time become calendar events. Things with only a due date become
        Google tasks. Notes are never sent.
      </ThemedText>

      <View style={styles.row}>
        <Pressable
          onPress={() => google.connect()}
          disabled={disabled}
          accessibilityRole="button"
          style={({ pressed }) => [styles.grow, pressed && styles.pressed, disabled && styles.disabled]}>
          <ThemedView type="backgroundSelected" style={styles.button}>
            <ThemedText type="smallBold">{google.connecting ? 'Connecting…' : 'Connect'}</ThemedText>
          </ThemedView>
        </Pressable>

        <Pressable
          onPress={() => google.disconnect()}
          disabled={disabled}
          accessibilityRole="button"
          style={({ pressed }) => [styles.grow, pressed && styles.pressed, disabled && styles.disabled]}>
          <ThemedView type="backgroundElement" style={styles.button}>
            <ThemedText type="smallBold">Disconnect</ThemedText>
          </ThemedView>
        </Pressable>
      </View>

      {google.error ? <ThemedText type="small">{google.error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
