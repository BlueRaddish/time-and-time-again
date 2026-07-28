import { StyleSheet, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = ViewProps & {
  title: string;
  /** Optional one-line explanation of what this view filters. */
  subtitle?: string;
};

/** Shared shell so the five view screens don't each re-declare the same layout. */
export function Screen({ title, subtitle, children, style, ...rest }: ScreenProps) {
  return (
    <ThemedView style={styles.root} {...rest}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </ThemedView>
        <ThemedView style={[styles.body, style]}>{children}</ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  header: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.half,
  },
  body: {
    flex: 1,
    paddingBottom: BottomTabInset,
  },
});
