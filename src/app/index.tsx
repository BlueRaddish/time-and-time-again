import { useMemo } from 'react';

import { QuickCapture } from '@/components/quick-capture';
import { Screen } from '@/components/screen';
import { ThingList } from '@/components/thing-list';
import { byChronology, byCompletion, isToday, sortBy } from '@/lib/views';
import { useThings } from '@/store/things-provider';

export default function TodayScreen() {
  const { things } = useThings();

  const visible = useMemo(
    () => things.filter((thing) => isToday(thing)).sort(sortBy(byCompletion, byChronology)),
    [things]
  );

  return (
    <Screen title="Today" subtitle="Anything starting or due today">
      <QuickCapture />
      <ThingList
        things={visible}
        emptyMessage="Nothing today. Capture something above — a plain title is enough."
      />
    </Screen>
  );
}
