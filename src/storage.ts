import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveAlarm, DEFAULT_SETTINGS, Place, Settings } from './types';

const K = {
  saved: 'saved-destinations',
  active: 'active-alarm',
  ringing: 'ringing',
  settings: 'settings',
  onboarded: 'onboarded',
};

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const write = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

export const getSaved = () => read<Place[]>(K.saved, []);

export async function toggleSaved(place: Place): Promise<Place[]> {
  const list = await getSaved();
  const next = list.some((p) => p.id === place.id)
    ? list.filter((p) => p.id !== place.id)
    : [place, ...list];
  await write(K.saved, next);
  return next;
}

export const getActive = () => read<ActiveAlarm | null>(K.active, null);
export const setActive = (a: ActiveAlarm) => write(K.active, a);
export const clearActive = () => AsyncStorage.removeItem(K.active);

export const getRinging = () => read<boolean>(K.ringing, false);
export const setRinging = (v: boolean) => write(K.ringing, v);

export const getOnboarded = () => read<boolean>(K.onboarded, false);
export const setOnboarded = () => write(K.onboarded, true);

export const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await read<Partial<Settings>>(K.settings, {})) });
export const setSettings = (s: Settings) => write(K.settings, s);
