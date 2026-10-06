import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { startRinging } from './alarm';
import { distanceM } from './geo';
import { clearActive, getActive, setActive } from './storage';
import type { ActiveAlarm } from './types';

export const TASK = 'lanka-alarm-location';

// Must be defined at module scope so the OS can wake the JS runtime for it.
// All position handling stays on the device: nothing here makes a network call.
TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const here = locations[locations.length - 1];
  if (!here) return;

  const alarm = await getActive();
  if (!alarm || alarm.fired) return;
  if (alarm.notBefore && Date.now() < alarm.notBefore) return;

  const d = distanceM({ lat: here.coords.latitude, lon: here.coords.longitude }, alarm.dest);
  // Allow for GPS error so a noisy fix near the edge does not delay the alarm.
  const trigger = d - Math.min(here.coords.accuracy ?? 0, 100) <= alarm.radiusM;

  await setActive({ ...alarm, lastDistanceM: d, fired: trigger });
  if (trigger) await startRinging(alarm.dest);
});

export type StartResult = { ok: true } | { ok: false; reason: string };

export async function startTracking(alarm: ActiveAlarm, opts: { test?: boolean } = {}): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'Location permission is needed to measure distance.' };

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted')
    return { ok: false, reason: 'Choose "Allow all the time" so the alarm works while your screen is off.' };

  await Notifications.requestPermissionsAsync();

  await setActive(alarm);
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);

  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    // A stationary phone never moves 50 m, so tests must be driven by time alone.
    distanceInterval: opts.test ? 0 : 50,
    timeInterval: opts.test ? 3_000 : 10_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: `Alarm set for ${alarm.dest.name}`,
      notificationBody: 'Keeping watch. Your location stays on this phone.',
      notificationColor: '#ff5a36',
    },
  });
  return { ok: true };
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
  await clearActive();
}

/** Runs the real background path (task, siren, full-screen alert) against your current spot, after a short delay. */
export async function startTestAlarm(delayMs = 10_000): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'Location permission is needed to run the test.' };
  let pos: Location.LocationObject;
  try {
    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    return { ok: false, reason: 'Could not get your location. Turn on location services and try again.' };
  }
  return startTracking(
    {
      dest: { id: 'test', name: 'Test stop', kind: 'pin', lat: pos.coords.latitude, lon: pos.coords.longitude },
      radiusM: 1000,
      startedAt: Date.now(),
      fired: false,
      notBefore: Date.now() + delayMs,
    },
    { test: true },
  );
}
