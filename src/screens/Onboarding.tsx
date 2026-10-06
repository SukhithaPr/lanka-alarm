import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  canUseFullScreenIntent,
  isIgnoringBatteryOptimizations,
  openFullScreenIntentSettings,
  requestIgnoreBatteryOptimizations,
} from '../../modules/full-screen-alarm';
import { Button, C } from '../ui';

interface Step {
  key: string;
  emoji: string;
  title: string;
  body: string;
  cta: string;
  check: () => Promise<boolean>;
  act: () => Promise<void>;
}

const android = Platform.OS === 'android';

function buildSteps(): Step[] {
  const steps: Step[] = [
    {
      key: 'location',
      emoji: '📍',
      title: 'Location, all the time',
      body:
        'To wake you while the screen is off, the app must read your position in the background. ' +
        'Choose "Allow all the time". Your position is only compared with your stop on this phone. It is never uploaded.',
      cta: 'Allow location',
      check: async () => (await Location.getBackgroundPermissionsAsync()).granted,
      act: async () => {
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.granted) await Location.requestBackgroundPermissionsAsync();
      },
    },
    {
      key: 'notifications',
      emoji: '🔔',
      title: 'Notifications',
      body: 'The alarm and the "tracking is on" notice are notifications. Without permission the alarm can stay silent.',
      cta: 'Allow notifications',
      check: async () => (await Notifications.getPermissionsAsync()).granted,
      act: async () => void (await Notifications.requestPermissionsAsync()),
    },
  ];
  if (android) {
    steps.push({
      key: 'battery',
      emoji: '🔋',
      title: 'Keep running with the screen off',
      body: 'Battery saver can silently stop tracking on a long ride. Allow the app to run unrestricted.',
      cta: 'Allow unrestricted',
      check: async () => isIgnoringBatteryOptimizations(),
      act: async () => requestIgnoreBatteryOptimizations(),
    });
    // Only Android 14+ can switch this off, so skip the step when it is already allowed.
    if (!canUseFullScreenIntent()) {
      steps.push({
        key: 'fullscreen',
        emoji: '📱',
        title: 'Show over the lock screen',
        body: 'Lets the alarm light up the screen and open on top of the lock screen instead of hiding as a small notification.',
        cta: 'Open settings',
        check: async () => canUseFullScreenIntent(),
        act: async () => openFullScreenIntentSettings(),
      });
    }
  }
  return steps;
}

interface Props {
  onFinish: () => void;
  onTest: () => Promise<string | null>;
}

export default function Onboarding({ onFinish, onTest }: Props) {
  const [steps] = useState(buildSteps);
  // 0 = welcome, 1..n = permission steps, n+1 = done
  const [page, setPage] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [testError, setTestError] = useState<string | null>(null);

  const recheck = useCallback(async () => {
    const entries = await Promise.all(steps.map(async (s) => [s.key, await s.check()] as const));
    setDone(Object.fromEntries(entries));
  }, [steps]);

  // Settings screens return to the app without a callback, so re-read on resume.
  useEffect(() => {
    recheck();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && recheck());
    return () => sub.remove();
  }, [recheck]);

  const last = steps.length + 1;
  const step = page >= 1 && page <= steps.length ? steps[page - 1] : null;
  const next = () => setPage((p) => Math.min(p + 1, last));

  const runTest = async () => {
    const err = await onTest();
    if (err) return setTestError(err);
    onFinish();
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.dots} accessibilityElementsHidden>
        {Array.from({ length: last + 1 }, (_, i) => (
          <View key={i} style={[s.dot, i === page && s.dotOn]} />
        ))}
      </View>

      <View style={s.body}>
        {page === 0 && (
          <>
            <Text style={s.emoji}>🚆</Text>
            <Text style={s.title}>Sleep through the ride</Text>
            <Text style={s.text}>
              Pick your stop in Sri Lanka and the phone wakes you when you get close. No account, no sign-in, and your location stays on this phone.
            </Text>
            <Text style={s.text}>{steps.length} quick settings make sure it works with the screen off.</Text>
          </>
        )}

        {step && (
          <>
            <Text style={s.emoji}>{step.emoji}</Text>
            <Text style={s.title}>{step.title}</Text>
            <Text style={s.text}>{step.body}</Text>
            {done[step.key] && <Text style={s.ok}>✓ Done</Text>}
          </>
        )}

        {page === last && (
          <>
            <Text style={s.emoji}>✅</Text>
            <Text style={s.title}>You're set</Text>
            <Text style={s.text}>
              Do a test run before your first trip: lock the phone and the alarm rings in about 10 seconds.
            </Text>
            {steps.some((x) => !done[x.key]) && (
              <Text style={s.warn}>
                Skipped: {steps.filter((x) => !done[x.key]).map((x) => x.title).join(', ')}. The home screen will remind you.
              </Text>
            )}
            {testError && <Text style={s.warn}>{testError}</Text>}
          </>
        )}
      </View>

      <View style={s.footer}>
        {page === 0 && <Button label="Get started" onPress={next} />}

        {step && (
          <>
            {done[step.key] ? (
              <Button label="Continue" onPress={next} />
            ) : (
              <>
                <Button
                  label={step.cta}
                  onPress={async () => {
                    await step.act();
                    await recheck();
                  }}
                />
                <Pressable onPress={next} style={s.skip} accessibilityRole="button">
                  <Text style={s.skipText}>Skip for now</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {page === last && (
          <>
            <Button label="Test the alarm" onPress={runTest} />
            <Pressable onPress={onFinish} style={s.skip} accessibilityRole="button">
              <Text style={s.skipText}>Done</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card, padding: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.line },
  dotOn: { backgroundColor: C.accent, width: 22 },
  body: { flex: 1, justifyContent: 'center' },
  emoji: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, marginBottom: 14 },
  text: { fontSize: 17, lineHeight: 25, color: C.sub, marginBottom: 12 },
  ok: { fontSize: 18, fontWeight: '700', color: '#12805c', marginTop: 8 },
  warn: { fontSize: 14, lineHeight: 20, color: C.danger, marginTop: 8 },
  footer: { paddingBottom: 8 },
  skip: { alignItems: 'center', paddingVertical: 16 },
  skipText: { color: C.sub, fontSize: 16, fontWeight: '600' },
});
