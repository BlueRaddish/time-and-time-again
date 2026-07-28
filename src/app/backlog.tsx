import { useMemo } from 'react';

import { Screen } from '@/components/screen';
import { ThingList } from '@/components/thing-list';
import { byCompletion, isBacklog, sortBy } from '@/lib/views';
import { useThings } from '@/store/things-provider';

export default function BacklogScreen() {
  const { things } = useThings();

  const visible = useMemo(
    () =>
      things
        .filter(isBacklog)
        .sort(sortBy(byCompletion, (a, b) => b.createdAt.localeCompare(a.createdAt))),
    [things]
  );

  return (
    <Screen title="Backlog" subtitle="Things with no start and no end — someday, maybe">
      <ThingList
        things={visible}
        emptyMessage="Nothing parked here. Anything captured without a date lands in this view."
      />
    </Screen>
  );
}
