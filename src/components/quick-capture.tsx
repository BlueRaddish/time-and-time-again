/**
 * The quick-capture bar — the whole app, for a light user.
 *
 * Type a title, press enter, done. No modal, no type selector, nothing mandatory but the
 * title. A user who never writes a date never learns that types exist.
 *
 * The preview line under the input is the one concession to teaching: when the parser finds a
 * date or time, it shows what will be created before you commit to it. When it finds nothing,
 * the preview stays out of the way.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatThingTime } from '@/lib/format';
import { parseCapture } from '@/lib/nl-parse';
import { useThings } from '@/store/things-provider';
import { deriveThingType, THING_TYPE_LABEL } from '@/types/thing';

export function QuickCapture() {
  const theme = useTheme();
  const { addThing } = useThings();
  const [text, setText] = useState('');

  const parsed = useMemo(() => parseCapture(text), [text]);
  const hasTime = parsed.start !== null || parsed.end !== null;

  const preview = useMemo(() => {
    if (!hasTime) return null;
    const type = deriveThingType(parsed);
    const when = formatThingTime(parsed);
    return `${THING_TYPE_LABEL[type]} · ${when}`;
  }, [parsed, hasTime]);

  async function submit() {
    // Fall back to the raw text if parsing consumed the entire title (e.g. just "tomorrow").
    const title = parsed.title.trim() || text.trim();
    if (!title) return;

    setText('');
    await addThing({ title, start: parsed.start, end: parsed.end });
  }

  return (
    <View style={styles.wrapper}>
      <ThemedView type="backgroundElement" style={styles.bar}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="Add anything…"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="done"
          submitBehavior="submit"
          accessibilityLabel="Quick capture"
          style={[styles.input, { color: theme.text }]}
        />
        {text.trim() ? (
          <Pressable onPress={submit} accessibilityRole="button" hitSlop={Spacing.two}>
            <ThemedText type="smallBold">Add</ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>

      {preview ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.preview}>
          {preview}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: Spacing.one,
  },
  preview: {
    paddingHorizontal: Spacing.two,
  },
});
