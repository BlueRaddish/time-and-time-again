import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The five views, in the order a user meets them: today, then the calendar, then the things
 * that don't have a place yet.
 *
 * Icons come from SF Symbols on iOS and Material icons on Android rather than bundled PNGs —
 * the template ships only two icon assets, and platform-native glyphs look right on both.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sun.max" md="today" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tasks">
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="backlog">
        <NativeTabs.Trigger.Label>Backlog</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="tray" md="inbox" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="everything">
        <NativeTabs.Trigger.Label>Everything</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.stack" md="list" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
