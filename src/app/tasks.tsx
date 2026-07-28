import { useMemo } from 'react';

import { Screen } from '@/components/screen';
import { ThingList } from '@/components/thing-list';
import { byCompletion, byDueDate, isTask, sortBy } from '@/lib/views';
import { useThings } from '@/store/things-provider';

export default function TasksScreen() {
  const { things } = useThings();

  const visible = useMemo(
    () => things.filter(isTask).sort(sortBy(byCompletion, byDueDate)),
    [things]
  );

  return (
    <Screen title="Tasks" subtitle="Things with an end and no start">
      <ThingList
        things={visible}
        emptyMessage={'No tasks. Try capturing "essay due friday".'}
      />
    </Screen>
  );
}
