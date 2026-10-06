export type PlaceKind = 'station' | 'place' | 'pin';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lon: number;
  sub?: string;
  /** Other spellings (e.g. the official Sri Lanka Railways name) so search finds either. */
  alt?: string;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface ActiveAlarm {
  dest: Place;
  radiusM: number;
  startedAt: number;
  fired: boolean;
  lastDistanceM?: number;
  /** Test alarms ignore location updates until this time so you can lock the phone first. */
  notBefore?: number;
}

export interface Settings {
  radiusM: number;
  /** Road route preview calls a public routing server with your position. Off by default. */
  roadRoute: boolean;
}

export const DEFAULT_SETTINGS: Settings = { radiusM: 1000, roadRoute: false };
