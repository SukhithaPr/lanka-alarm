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
  /** Position estimated from the official distance along the track, not mapped on the ground. */
  approx?: boolean;
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
  /** Alarm radius for places and pins. */
  radiusM: number;
  /** Alarm radius for railway stations: trains are fast, so this defaults larger. */
  trainRadiusM: number;
  /** Road route preview calls a public routing server with your position. Off by default. */
  roadRoute: boolean;
}

export const DEFAULT_SETTINGS: Settings = { radiusM: 1000, trainRadiusM: 2000, roadRoute: false };
