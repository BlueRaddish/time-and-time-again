import { useMemo } from 'react';

import { Screen } from '@/components/screen';
import { ThingList } from '@/components/thing-list';
import { byChronology, byCompletion, sortBy } from '@/lib/views';
import { useThings } from '@/store/things-provider';

export default function EverythingScreen() {
  const { things } = useThings();

  const visible = useMemo(
    () => [...things].sort(sortBy(byCompletion, byChronology)),
    [things]
  );

  return (
    <Screen title="Everything" subtitle="One flat list, no filter">
      <ThingList things={visible} emptyMessage="Nothing captured yet." />
    </Screen>
  );
}
