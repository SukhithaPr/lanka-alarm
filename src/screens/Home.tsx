import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import LeafletMap from '../LeafletMap';
import { distanceM, formatDistance, formatDuration, inSriLanka } from '../geo';
import { Filter, RoadRoute, fetchRoadRoute, nearestStations, searchLocal, searchOnline } from '../places';
import { Button, C, Chip, KIND_ICON, KIND_LABEL, Row } from '../ui';
import type { Issue } from '../permissions';
import type { ActiveAlarm, LatLon, Place, Settings } from '../types';

interface Props {
  selected: Place | null;
  setSelected: (p: Place | null) => void;
  saved: Place[];
  onToggleSave: (p: Place) => void;
  openSaved: () => void;
  active: ActiveAlarm | null;
  onStart: (dest: Place, radiusM: number) => Promise<string | null>;
  onCancel: () => void;
  onTest: () => Promise<string | null>;
  issues: Issue[];
  settings: Settings;
  onSettings: (s: Settings) => void;
}

const RADII = [500, 1000, 2000, 5000];
const FILTERS: [Filter, string][] = [['all', 'All'], ['station', '🚆 Train']];
const HINT: Record<Filter, string> = {
  all: '',
  station: 'Search a railway station.',
};

export default function Home(p: Props) {
  const { selected, setSelected, active, settings } = p;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [online, setOnline] = useState<Place[]>([]);
  const [me, setMe] = useState<LatLon | null>(null);
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bottomH, setBottomH] = useState(0);
  const [submitted, setSubmitted] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  // Foreground position, used only to draw the map and show the distance.
  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const watch = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || stopped) return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
          (l) => setMe({ lat: l.coords.latitude, lon: l.coords.longitude }),
        );
      } catch {
        // Location switched off or no fix yet: keep trying quietly instead of crashing.
        if (!stopped) retry = setTimeout(watch, 5000);
      }
    };
    watch();
    return () => {
      stopped = true;
      clearTimeout(retry);
      sub?.remove();
    };
  }, []);

  const local = useMemo(() => searchLocal(query, filter, me), [query, filter, me]);

  // Keyboards auto-capitalise or trim on submit, so compare case-insensitively.
  const queryKey = query.trim().toLowerCase();

  // Genuinely new text or a new filter invalidates earlier online results.
  useEffect(() => {
    setOnline([]);
    setSubmitted('');
    setSearching(false);
    setSearchFailed(false);
  }, [queryKey, filter]);

  // Online lookup runs only when the user presses Search (the public server bans autocomplete).
  useEffect(() => {
    if (!submitted || filter === 'station') return;
    const ctl = new AbortController();
    setSearching(true);
    searchOnline(submitted, ctl.signal)
      .then(setOnline)
      .catch((e) => !ctl.signal.aborted && setSearchFailed(true))
      .finally(() => !ctl.signal.aborted && setSearching(false));
    return () => ctl.abort();
  }, [submitted, filter]);

  useEffect(() => {
    setRoute(null);
    if (!settings.roadRoute || !me || !selected) return;
    let live = true;
    fetchRoadRoute(me, selected).then((r) => live && setRoute(r));
    return () => {
      live = false;
    };
    // Re-route only when the destination changes, not on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, settings.roadRoute, !!me]);

  const pick = (place: Place) => {
    Keyboard.dismiss();
    setQuery('');
    setSelected(place);
    setFitKey((k) => k + 1);
  };

  const onMapTap = (pt: LatLon) => {
    if (active) return;
    if (!inSriLanka(pt)) return Alert.alert('Sri Lanka only', 'This version only works inside Sri Lanka.');
    pick({ id: `pin-${pt.lat.toFixed(5)},${pt.lon.toFixed(5)}`, name: 'My stop', kind: 'pin', lat: pt.lat, lon: pt.lon });
  };

  const results = [...local, ...online.filter((o) => !local.some((l) => l.name === o.name))];
  const dest = active?.dest ?? selected;
  const radiusM = active?.radiusM ?? settings.radiusM;
  const liveDist = dest && me ? distanceM(me, dest) : active?.lastDistanceM;
  const isSaved = !!selected && p.saved.some((x) => x.id === selected.id);
  const nearby = selected?.kind === 'pin' ? nearestStations(selected, 3).filter((n) => n.distM < 3000) : [];

  const test = async () => {
    const err = await p.onTest();
    if (err) return Alert.alert('Cannot run test', err);
    Alert.alert('Test started', 'Lock your phone now. The alarm should ring in about 10 seconds, over the lock screen.');
  };

  const start = async () => {
    if (!selected) return;
    setBusy(true);
    const err = await p.onStart(selected, settings.radiusM);
    setBusy(false);
    if (err) Alert.alert('Cannot start alarm', err);
  };

  return (
    <View style={{ flex: 1 }}>
      <LeafletMap
        state={{ me, dest: dest ? { lat: dest.lat, lon: dest.lon } : null, radiusM, route: route?.line ?? null, fitKey }}
        onTap={onMapTap}
      />

      <SafeAreaView pointerEvents="box-none" style={s.top}>
        {!active && (
          <View style={s.card}>
            <Row>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Where are you going?"
                placeholderTextColor={C.sub}
                style={s.input}
                returnKeyType="search"
                onSubmitEditing={(e) => {
                  const text = e.nativeEvent.text.trim();
                  if (text.length >= 2) setSubmitted(text);
                }}
                autoCorrect={false}
                accessibilityLabel="Search destination"
              />
              <Pressable onPress={p.openSaved} hitSlop={8} accessibilityRole="button" accessibilityLabel="Saved destinations">
                <Text style={s.star}>★ {p.saved.length}</Text>
              </Pressable>
            </Row>
            <Row style={{ marginTop: 10 }}>
              {FILTERS.map(([f, label]) => (
                <Chip key={f} label={label} active={filter === f} onPress={() => setFilter(f)} />
              ))}
            </Row>
            {query.trim().length === 0 && HINT[filter] !== '' && <Text style={s.chipHint}>{HINT[filter]}</Text>}
            {query.trim().length > 0 && (
              <ScrollView keyboardShouldPersistTaps="handled" style={s.results}>
                {searching && <Text style={s.none}>Searching…</Text>}
                {!searching && searchFailed && <Text style={s.none}>Search unavailable right now. Tap the map to set your stop yourself.</Text>}
                {!searching && !searchFailed && filter !== 'station' && !submitted && (
                  <Text style={s.none}>Press Search on the keyboard to look up towns, junctions and places.</Text>
                )}
                {!searching && !searchFailed && results.length === 0 && (filter === 'station' || submitted) && (
                  <Text style={s.none}>No match. Tap the map to set your stop yourself.</Text>
                )}
                {results.map((r) => (
                  <Pressable key={r.id} style={s.result} onPress={() => pick(r)}>
                    <Text style={s.rName}>{KIND_ICON[r.kind]}  {r.name}</Text>
                    <Text style={s.rSub} numberOfLines={1}>{r.sub || KIND_LABEL[r.kind]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </SafeAreaView>

      {me && (
        <Pressable
          onPress={() => setFitKey((k) => k + 1)}
          style={[s.locate, { bottom: bottomH + 12 }]}
          accessibilityRole="button"
          accessibilityLabel="Centre map on my location"
        >
          <Text style={s.locateIcon}>◎</Text>
        </Pressable>
      )}

      <SafeAreaView edges={['bottom']} style={s.bottom} onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}>
        <View style={s.card}>
          {!dest && <Text style={s.hint}>Search a station or place, or tap the map to set your own stop. Your location never leaves this phone.</Text>}
          {!active && p.issues.map((i) => (
            <Pressable key={i.key} onPress={i.fix} style={s.issue} accessibilityRole="button">
              <Text style={s.issueTitle}>⚠️ {i.title}</Text>
              <Text style={s.issueDetail}>{i.detail} <Text style={s.link}>Fix</Text></Text>
            </Pressable>
          ))}
          {!dest && !active && (
            <Pressable onPress={test} style={{ paddingTop: 12 }} accessibilityRole="button">
              <Text style={s.link}>Test the alarm (rings in 10 s)</Text>
            </Pressable>
          )}

          {dest && (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title} numberOfLines={1}>{KIND_ICON[dest.kind]}  {dest.name}</Text>
                  <Text style={s.meta}>
                    {liveDist != null ? `${formatDistance(liveDist)} away` : 'Waiting for GPS…'}
                    {route ? ` · by road ${formatDistance(route.distanceM)}, ${formatDuration(route.durationS)}` : ''}
                  </Text>
                </View>
                {!active && selected && (
                  <Pressable onPress={() => p.onToggleSave(selected)} hitSlop={10} accessibilityRole="button" accessibilityLabel={isSaved ? 'Unsave destination' : 'Save destination'}>
                    <Text style={s.starBig}>{isSaved ? '★' : '☆'}</Text>
                  </Pressable>
                )}
              </Row>

              {!active && selected?.kind === 'pin' && (
                <TextInput
                  value={selected.name}
                  onChangeText={(name) => setSelected({ ...selected, name })}
                  placeholder="Name this stop"
                  placeholderTextColor={C.sub}
                  style={s.nameInput}
                  accessibilityLabel="Name this stop"
                />
              )}

              {active ? (
                <>
                  <Text style={s.armed}>Alarm is on. It rings within {formatDistance(active.radiusM)} of the stop. You can lock your phone.</Text>
                  <Button label="Cancel alarm" kind="ghost" onPress={p.onCancel} />
                </>
              ) : (
                <>
                  {nearby.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={s.label}>Railway station nearby</Text>
                      {nearby.map((n) => (
                        <Pressable key={n.id} onPress={() => pick(n)} style={{ paddingVertical: 6 }}>
                          <Text style={s.link}>{KIND_ICON[n.kind]} {n.name} · {formatDistance(n.distM)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <Text style={s.label}>Wake me when I'm within</Text>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {RADII.map((r) => (
                      <Chip key={r} label={formatDistance(r)} active={settings.radiusM === r} onPress={() => p.onSettings({ ...settings, radiusM: r })} />
                    ))}
                  </Row>
                  <Text style={s.tip}>Trains move fast: pick 2–5 km to leave time to gather your things.</Text>
                  <Row style={{ justifyContent: 'space-between', marginVertical: 10 }}>
                    <Text style={[s.tip, { flex: 1, marginTop: 0 }]}>Road route preview. Sends your position to a public routing server.</Text>
                    <Switch value={settings.roadRoute} onValueChange={(v) => p.onSettings({ ...settings, roadRoute: v })} />
                  </Row>
                  <Button label={busy ? 'Starting…' : 'Wake me up'} onPress={start} />
                  <Pressable onPress={() => setSelected(null)} style={{ alignItems: 'center', paddingTop: 10 }}>
                    <Text style={s.link}>Clear</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, paddingTop: 4 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 8 },
  locate: { position: 'absolute', right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  locateIcon: { fontSize: 26, color: C.blue },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  input: { flex: 1, fontSize: 17, color: C.ink, paddingVertical: 8 },
  star: { color: C.accent, fontWeight: '700', fontSize: 16 },
  starBig: { color: C.accent, fontSize: 30 },
  results: { maxHeight: 280, marginTop: 8 },
  result: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line },
  rName: { fontSize: 16, fontWeight: '600', color: C.ink },
  rSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  none: { color: C.sub, paddingVertical: 12 },
  chipHint: { color: C.sub, fontSize: 13, marginTop: 10 },
  nameInput: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, color: C.ink, marginTop: 10 },
  hint: { color: C.sub, fontSize: 15, lineHeight: 21 },
  title: { fontSize: 20, fontWeight: '800', color: C.ink },
  meta: { fontSize: 14, color: C.sub, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', color: C.sub, marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  tip: { fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 17 },
  armed: { color: C.ink, fontSize: 15, lineHeight: 21, marginVertical: 14 },
  issue: { backgroundColor: '#fff4ed', borderRadius: 12, padding: 12, marginTop: 10 },
  issueTitle: { color: C.ink, fontWeight: '700', fontSize: 14 },
  issueDetail: { color: C.sub, fontSize: 13, lineHeight: 18, marginTop: 2 },
  link: { color: C.blue, fontSize: 15, fontWeight: '600' },
});
