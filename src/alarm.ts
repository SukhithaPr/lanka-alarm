import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { setRinging } from './storage';
import { cancelFullScreenAlarm, isFullScreenAvailable, showFullScreenAlarm, startSiren, stopSiren } from '../modules/full-screen-alarm';
import type { Place } from './types';

const CHANNEL = 'alarm';
let player: AudioPlayer | null = null;
const listeners = new Set<(ringing: boolean) => void>();

export const onRingingChange = (fn: (ringing: boolean) => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const emit = (v: boolean) => listeners.forEach((fn) => fn(v));

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Arrival alarm',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 400, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
}

/** Loud looping siren + repeating vibration + max-priority notification. Safe to call from the background task. */
export async function startRinging(dest: Place) {
  await setRinging(true);
  emit(true);

  // Android: native siren on the alarm stream. Elsewhere (or on failure): expo-audio.
  let audioOk = startSiren();
  if (!audioOk) try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    player?.remove();
    player = createAudioPlayer(require('../assets/alarm.wav'));
    player.loop = true;
    player.volume = 1;
    player.play();
    audioOk = true;
  } catch {
    // The notification's own alarm sound is the fallback.
  }

  Vibration.vibrate([0, 800, 400, 800, 400], true);

  const title = `Wake up! Nearly at ${dest.name}`;
  const body = 'Tap to open and turn the alarm off.';

  // Android: native full-screen-intent notification takes over the lock screen.
  if (isFullScreenAvailable) {
    showFullScreenAlarm(title, body, !audioOk);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: 'timeSensitive',
      sticky: true,
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

export async function stopRinging() {
  Vibration.cancel();
  try {
    player?.pause();
    player?.remove();
  } catch {}
  player = null;
  stopSiren();
  cancelFullScreenAlarm();
  await Notifications.dismissAllNotificationsAsync();
  await setRinging(false);
  emit(false);
}
