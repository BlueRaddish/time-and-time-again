/**
 * One Thing in a list.
 *
 * Collapsed, this is Layer 0: a checkbox, a title, and whatever time the Thing happens to
 * have. Tapping it opens Layer 1 — the start and end chips.
 *
 * Editing those chips changes the derived type live, and the badge updates as you do it.
 * That is the interaction that teaches the model without ever explaining it: a user who adds
 * an end to a Note watches it become a Task.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatThingTime, formatTimePoint } from '@/lib/format';
import { addDays, dateOnly, startOfDay, toDate } from '@/lib/time';
import { useThings } from '@/store/things-provider';
import {
  deriveThingType,
  THING_TYPE_LABEL,
  type Thing,
  type TimePoint,
} from '@/types/thing';

/** Default clock time when a user promotes a date-only point to a timed one. */
const DEFAULT_HOUR = 9;

function withPrecision(tp: TimePoint, precision: TimePoint['precision']): TimePoint {
  if (tp.precision === precision) return tp;
  const date = toDate(tp);
  if (precision === 'date') return dateOnly(date);

  const timed = startOfDay(date);
  timed.setHours(DEFAULT_HOUR, 0, 0, 0);
  return { at: timed.toISOString(), precision: 'time' };
}

export function ThingRow({ thing }: { thing: Thing }) {
  const theme = useTheme();
  const { toggleComplete, updateThing, removeThing } = useThings();
  const [expanded, setExpanded] = useState(false);

  const type = deriveThingType(thing);
  const done = thing.completedAt !== null;
  const summary = formatThingTime(thing);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.row}>
        <Pressable
          onPress={() => toggleComplete(thing.id)}
          hitSlop={Spacing.two}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? `Mark ${thing.title} incomplete` : `Complete ${thing.title}`}
          style={[
            styles.checkbox,
            { borderColor: theme.textSecondary },
            done && { backgroundColor: theme.text, borderColor: theme.text },
          ]}
        />

        <Pressable
          style={styles.main}
          onPress={() => setExpanded((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${thing.title}, ${THING_TYPE_LABEL[type]}`}>
          <ThemedText
            themeColor={done ? 'textSecondary' : 'text'}
            style={done ? styles.doneTitle : undefined}>
            {thing.title}
          </ThemedText>
          {summary ? (
            <ThemedText type="small" themeColor="textSecondary">
              {summary}
            </ThemedText>
          ) : null}
        </Pressable>

        <ThemedText type="code" themeColor="textSecondary">
          {THING_TYPE_LABEL[type]}
        </ThemedText>
      </View>

      {expanded ? (
        <View style={styles.editor}>
          <FieldEditor
            label="Start"
            value={thing.start}
            onChange={(start) => updateThing(thing.id, { start })}
          />
          <FieldEditor
            label="End"
            value={thing.end}
            onChange={(end) => updateThing(thing.id, { end })}
          />

          <Pressable
            onPress={() => removeThing(thing.id)}
            accessibilityRole="button"
            style={styles.deleteRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Delete
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

/**
 * One temporal field. Nothing here is mandatory, and clearing both fields takes a Thing all
 * the way back to a Note — the model stays reversible in both directions.
 */
function FieldEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TimePoint | null;
  onChange: (value: TimePoint | null) => void;
}) {
  const now = new Date();

  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {value ? formatTimePoint(value) : 'not set'}
        </ThemedText>
      </View>

      <View style={styles.chips}>
        <Chip label="Today" onPress={() => onChange(dateOnly(now))} />
        <Chip label="Tomorrow" onPress={() => onChange(dateOnly(addDays(now, 1)))} />
        <Chip label="Next week" onPress={() => onChange(dateOnly(addDays(now, 7)))} />

        {value ? (
          <>
            <Chip
              label={value.precision === 'date' ? 'Add time' : 'Date only'}
              selected
              onPress={() =>
                onChange(withPrecision(value, value.precision === 'date' ? 'time' : 'date'))
              }
            />
            <Chip label="Clear" onPress={() => onChange(null)} />
          </>
        ) : null}
      </View>
    </View>
  );
}

function Chip({
  label,
  onPress,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <ThemedView
        type={selected ? 'backgroundSelected' : 'background'}
        style={styles.chip}>
        <ThemedText type="small">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  main: {
    flex: 1,
    paddingVertical: Spacing.one,
    gap: Spacing.half,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
  },
  editor: {
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  deleteRow: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
});
