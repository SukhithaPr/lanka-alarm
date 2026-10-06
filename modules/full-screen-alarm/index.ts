import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface Native {
  show(title: string, body: string, withSound: boolean): void;
  cancel(): void;
  startSiren(): boolean;
  stopSiren(): void;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
}

// Android only. Elsewhere (iOS, Expo Go) every call is a harmless no-op.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('FullScreenAlarm') : null;

export const isFullScreenAvailable = native != null;
export const showFullScreenAlarm = (title: string, body: string, withSound = false) => native?.show(title, body, withSound);
export const cancelFullScreenAlarm = () => native?.cancel();
export const canUseFullScreenIntent = () => native?.canUseFullScreenIntent() ?? true;
export const openFullScreenIntentSettings = () => native?.openFullScreenIntentSettings();
export const isIgnoringBatteryOptimizations = () => native?.isIgnoringBatteryOptimizations() ?? true;
export const requestIgnoreBatteryOptimizations = () => native?.requestIgnoreBatteryOptimizations();
/** Loops the alarm tone on the alarm stream. False if unavailable or it failed to start. */
export const startSiren = () => native?.startSiren() ?? false;
export const stopSiren = () => native?.stopSiren();
