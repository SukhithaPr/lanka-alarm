import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Home from './src/screens/Home';
import Saved from './src/screens/Saved';
import Ringing from './src/screens/Ringing';
import Onboarding from './src/screens/Onboarding';
import { Issue, findIssues } from './src/permissions';
import { onRingingChange, setupNotifications, stopRinging } from './src/alarm';
import { startTestAlarm, startTracking, stopTracking } from './src/tracking';
import { getActive, getOnboarded, getRinging, getSaved, getSettings, setOnboarded, setSettings, toggleSaved } from './src/storage';
import { ActiveAlarm, DEFAULT_SETTINGS, Place, Settings } from './src/types';

export default function App() {
  const [screen, setScreen] = useState<'home' | 'saved'>('home');
  const [selected, setSelected] = useState<Place | null>(null);
  const [saved, setSaved] = useState<Place[]>([]);
  const [active, setActive] = useState<ActiveAlarm | null>(null);
  const [ringing, setRinging] = useState(false);
  // null until storage has been read, so returning users never see a flash of onboarding.
  const [onboarded, setOnboardedState] = useState<boolean | null>(null);
  const [rerunSetup, setRerunSetup] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  // Background task writes to storage, so re-read whenever we come back to the foreground.
  const refresh = useCallback(async () => {
    const [a, r] = await Promise.all([getActive(), getRinging()]);
    setActive(a);
    setRinging(r);
    setIssues(findIssues());
  }, []);

  useEffect(() => {
    setupNotifications();
    getOnboarded().then(setOnboardedState);
    getSaved().then(setSaved);
    getSettings().then(setSettingsState);
    refresh();
    const unsub = onRingingChange(setRinging);
    const appState = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const poll = setInterval(() => getActive().then(setActive), 5000);
    return () => {
      unsub();
      appState.remove();
      clearInterval(poll);
    };
  }, [refresh]);

  const onStart = async (dest: Place, radiusM: number) => {
    const alarm: ActiveAlarm = { dest, radiusM, startedAt: Date.now(), fired: false };
    const res = await startTracking(alarm);
    if (!res.ok) return res.reason;
    setActive(alarm);
    const problems = findIssues();
    setIssues(problems);
    if (problems.length) {
      Alert.alert(
        'Fix this so the alarm works',
        problems.map((p) => `• ${p.title}`).join('\n'),
        [{ text: 'Later' }, { text: 'Fix now', onPress: problems[0].fix }],
      );
    }
    return null;
  };

  const onTest = async () => {
    const res = await startTestAlarm();
    if (!res.ok) return res.reason;
    setActive(await getActive());
    return null;
  };

  const onCancel = async () => {
    await stopTracking();
    setActive(null);
  };

  const finishOnboarding = async () => {
    await setOnboarded();
    setOnboardedState(true);
    setRerunSetup(false);
    setIssues(findIssues());
  };

  const dismiss = async () => {
    await stopRinging();
    await onCancel();
  };

  const updateSettings = (s: Settings) => {
    setSettingsState(s);
    setSettings(s);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={ringing ? 'light' : 'dark'} />
      {ringing ? (
        <Ringing dest={active?.dest ?? null} onDismiss={dismiss} />
      ) : onboarded === null ? null : !onboarded || rerunSetup ? (
        <Onboarding onFinish={finishOnboarding} onTest={onTest} />
      ) : screen === 'saved' ? (
        <Saved
          saved={saved}
          onClose={() => setScreen('home')}
          onSetup={() => setRerunSetup(true)}
          onPick={(p) => {
            setSelected(p);
            setScreen('home');
          }}
          onRemove={async (p) => setSaved(await toggleSaved(p))}
        />
      ) : (
        <Home
          selected={selected}
          setSelected={setSelected}
          saved={saved}
          onToggleSave={async (p) => setSaved(await toggleSaved(p))}
          openSaved={() => setScreen('saved')}
          active={active}
          onStart={onStart}
          onCancel={onCancel}
          onTest={onTest}
          issues={issues}
          settings={settings}
          onSettings={updateSettings}
        />
      )}
    </SafeAreaProvider>
  );
}
