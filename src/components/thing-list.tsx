import { FlatList, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThingRow } from '@/components/thing-row';
import { Spacing } from '@/constants/theme';
import type { Thing } from '@/types/thing';

type ThingListProps = {
  things: Thing[];
  /** Shown when the filter matches nothing — phrase it per view, not generically. */
  emptyMessage: string;
  ListHeaderComponent?: React.ComponentProps<typeof FlatList>['ListHeaderComponent'];
};

export function ThingList({ things, emptyMessage, ListHeaderComponent }: ThingListProps) {
  return (
    <FlatList
      data={things}
      keyExtractor={(thing) => thing.id}
      renderItem={({ item }) => <ThingRow thing={item} />}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        <ThemedView style={styles.empty}>
          <ThemedText type="small" themeColor="textSecondary">
            {emptyMessage}
          </ThemedText>
        </ThemedView>
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.five,
  },
  empty: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
});
