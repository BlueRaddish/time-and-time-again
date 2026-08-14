/**
 * Signing out, and deleting the account.
 *
 * ## Why deletion is here at all
 *
 * Google Play requires any app that lets you create an account to let you delete it **from
 * inside the app** — not by emailing support. Dropping iOS did not remove that obligation, and
 * it is checked at review. It is also the one destructive action in the whole app, so it gets
 * the only two-step confirmation.
 *
 * ## Why the confirmation is inline and not an Alert
 *
 * `Alert.alert` maps to a blocking `window.confirm` on web and is inconsistently implemented
 * across React Native Web versions — a destructive confirmation that silently no-ops on one
 * platform is worse than none. Inline state behaves identically everywhere and is testable.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { needsRecentLogin } from '@/lib/auth-errors';
import { useAuth } from '@/store/auth-provider';

export function AccountSection() {
  const theme = useTheme();
  const { user, signOut, deleteAccount, busy, error } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [staleLogin, setStaleLogin] = useState(false);

  async function handleDelete() {
    setStaleLogin(false);
    try {
      await deleteAccount();
      // On success the auth listener clears the user and the gate swaps to sign-in. Nothing
      // to navigate: this component is about to unmount.
    } catch (caught) {
      // Firebase refuses to delete an account whose session is old. The fix is a fresh
      // sign-in, so say that rather than showing a raw failure.
      if (needsRecentLogin(caught)) setStaleLogin(true);
      setConfirming(false);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Account</ThemedText>

      {user?.email ? (
        <ThemedText type="small" themeColor="textSecondary">
          Signed in as {user.email}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={() => signOut().catch(() => {})}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}>
        <ThemedView type="backgroundElement" style={styles.button}>
          <ThemedText type="smallBold">Sign out</ThemedText>
        </ThemedView>
      </Pressable>

      <View style={styles.danger}>
        {!confirming ? (
          <Pressable
            onPress={() => setConfirming(true)}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText type="smallBold">Delete account</ThemedText>
            </ThemedView>
          </Pressable>
        ) : (
          <View style={styles.confirmBlock}>
            <ThemedText type="small">
              This permanently deletes your account and every Thing in it. It cannot be undone.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Events and tasks already written to Google Calendar or Google Tasks stay there —
              they belong to your Google account, and you can delete them from Google.
            </ThemedText>

            <View style={styles.confirmRow}>
              <Pressable
                onPress={() => setConfirming(false)}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [styles.grow, pressed && styles.pressed]}>
                <ThemedView type="backgroundElement" style={styles.button}>
                  <ThemedText type="smallBold">Keep my account</ThemedText>
                </ThemedView>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Permanently delete my account"
                style={({ pressed }) => [styles.grow, pressed && styles.pressed]}>
                <ThemedView type="backgroundSelected" style={styles.button}>
                  {busy ? (
                    <ActivityIndicator color={theme.text} />
                  ) : (
                    <ThemedText type="smallBold">Delete everything</ThemedText>
                  )}
                </ThemedView>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {staleLogin ? (
        <ThemedText type="small">
          For safety this needs a fresh sign-in. Sign out, sign back in, then delete.
        </ThemedText>
      ) : error ? (
        <ThemedText type="small">{error}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  danger: { paddingTop: Spacing.three },
  confirmBlock: { gap: Spacing.two },
  confirmRow: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
