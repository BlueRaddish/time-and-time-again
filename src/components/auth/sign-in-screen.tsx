/**
 * Sign in, or create an account — one screen, one toggle.
 *
 * Two screens for this would double the copy and the state for no gain: the fields are
 * identical, and the only real difference is which Firebase call runs. The toggle also makes
 * the "no account with that email" error actionable in place.
 *
 * Providers come from `AUTH_PROVIDERS` rather than being hard-coded here — see that file for
 * why the list shape matters.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';
import { useTheme } from '@/hooks/use-theme';
import { availableAuthProviders } from '@/lib/auth-providers';
import { useAuth } from '@/store/auth-provider';

type Intent = 'sign-in' | 'register';

const COPY: Record<Intent, { title: string; action: string; switchTo: string; switchCta: string }> =
  {
    'sign-in': {
      title: 'Welcome back',
      action: 'Sign in',
      switchTo: 'register',
      switchCta: 'No account yet? Create one',
    },
    register: {
      title: 'Create an account',
      action: 'Create account',
      switchTo: 'sign-in',
      switchCta: 'Already have an account? Sign in',
    },
  };

export function SignInScreen() {
  const theme = useTheme();
  const { signInWithEmail, registerWithEmail, busy, error, clearError } = useAuth();
  const google = useGoogleSignIn();

  const [intent, setIntent] = useState<Intent>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const copy = COPY[intent];
  const providers = availableAuthProviders();
  const hasPassword = providers.some((provider) => provider.id === 'password');
  const hasGoogle = providers.some((provider) => provider.id === 'google') && google.available;
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  function switchIntent() {
    clearError();
    setIntent(intent === 'sign-in' ? 'register' : 'sign-in');
  }

  async function submit() {
    if (!canSubmit) return;
    const run = intent === 'sign-in' ? signInWithEmail : registerWithEmail;
    // The provider has already turned this into `error`; nothing more to do here.
    await run(email, password).catch(() => {});
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <ThemedText type="title">{copy.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Your Things sync across every device you sign in on.
            </ThemedText>
          </View>

          {hasPassword ? (
            <View style={styles.form}>
              <ThemedView type="backgroundElement" style={styles.field}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  inputMode="email"
                  accessibilityLabel="Email"
                  style={[styles.input, { color: theme.text }]}
                />
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.field}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoComplete={intent === 'sign-in' ? 'current-password' : 'new-password'}
                  secureTextEntry
                  onSubmitEditing={submit}
                  returnKeyType="go"
                  accessibilityLabel="Password"
                  style={[styles.input, { color: theme.text }]}
                />
              </ThemedView>

              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && styles.pressed, !canSubmit && styles.disabled]}>
                <ThemedView type="backgroundSelected" style={styles.button}>
                  {busy ? (
                    <ActivityIndicator color={theme.text} />
                  ) : (
                    <ThemedText type="smallBold">{copy.action}</ThemedText>
                  )}
                </ThemedView>
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <ThemedText type="small" style={[styles.error, { color: theme.text }]}>
              {error}
            </ThemedText>
          ) : null}

          {hasGoogle ? (
            <View style={styles.alternatives}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.divider}>
                or
              </ThemedText>
              <Pressable
                onPress={() => google.signIn()}
                disabled={google.preparing || busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  pressed && styles.pressed,
                  (google.preparing || busy) && styles.disabled,
                ]}>
                <ThemedView type="backgroundElement" style={styles.button}>
                  <ThemedText type="smallBold">Continue with Google</ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          ) : null}

          <Pressable onPress={switchIntent} accessibilityRole="button" hitSlop={Spacing.two}>
            <ThemedText type="link" themeColor="textSecondary" style={styles.switch}>
              {copy.switchCta}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  content: { gap: Spacing.four, maxWidth: 380, width: '100%', alignSelf: 'center' },
  heading: { gap: Spacing.one },
  form: { gap: Spacing.two },
  field: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  input: { fontSize: 16, lineHeight: 24, paddingVertical: Spacing.three },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alternatives: { gap: Spacing.two },
  divider: { textAlign: 'center' },
  error: { paddingHorizontal: Spacing.two },
  switch: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
