/**
 * Calendar view.
 *
 * NOTE — this is an *agenda*, not a time grid. Things with a start, grouped by day, in
 * chronological order. A real timeline renderer (proportional hour rows, overlapping event
 * layout, drag-to-move) is a substantial piece of work in its own right, and a half-built one
 * would misrepresent durations rather than communicate them. Revisit once the model settles.
 */

import { useMemo } from 'react';
import { SectionList, StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThingRow } from '@/components/thing-row';
import { Spacing } from '@/constants/theme';
import { formatDayHeading } from '@/lib/format';
import { groupByDay, hasStart } from '@/lib/views';
import { useThings } from '@/store/things-provider';

export default function CalendarScreen() {
  const { things } = useThings();

  const sections = useMemo(
    () =>
      groupByDay(things.filter(hasStart)).map((group) => ({
        key: group.key,
        title: formatDayHeading(group.day),
        data: group.things,
      })),
    [things]
  );

  return (
    <Screen title="Calendar" subtitle="Things with a start — Events and Anchors">
      <SectionList
        sections={sections}
        keyExtractor={(thing) => thing.id}
        renderItem={({ item }) => <ThingRow thing={item} />}
        renderSectionHeader={({ section }) => (
          <ThemedView style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {section.title}
            </ThemedText>
          </ThemedView>
        )}
        ListEmptyComponent={
          <ThemedView style={styles.empty}>
            <ThemedText type="small" themeColor="textSecondary">
              {'Nothing scheduled. Try capturing "dentist fri 3pm-4pm".'}
            </ThemedText>
          </ThemedView>
        }
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.five,
  },
  header: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  empty: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
});
