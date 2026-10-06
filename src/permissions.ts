import {
  canUseFullScreenIntent,
  isIgnoringBatteryOptimizations,
  openFullScreenIntentSettings,
  requestIgnoreBatteryOptimizations,
} from '../modules/full-screen-alarm';

export interface Issue {
  key: 'battery' | 'fullscreen';
  title: string;
  detail: string;
  fix: () => void;
}

/** Android settings that can make the alarm fail silently. Empty on other platforms. */
export function findIssues(): Issue[] {
  const issues: Issue[] = [];
  if (!isIgnoringBatteryOptimizations()) {
    issues.push({
      key: 'battery',
      title: 'Battery saver may stop the alarm',
      detail: 'Allow the app to run unrestricted so your phone does not stop tracking while the screen is off.',
      fix: requestIgnoreBatteryOptimizations,
    });
  }
  if (!canUseFullScreenIntent()) {
    issues.push({
      key: 'fullscreen',
      title: 'Full-screen alerts are off',
      detail: 'Without this, the alarm only shows as a notification on a locked phone.',
      fix: openFullScreenIntentSettings,
    });
  }
  return issues;
}
