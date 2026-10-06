import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { PlaceKind } from './types';

export const C = {
  ink: '#122038',
  sub: '#5b6b82',
  line: '#e3e9f1',
  bg: '#f5f7fb',
  card: '#ffffff',
  accent: '#ff5a36',
  blue: '#2f80ed',
  danger: '#d92d20',
};

export const KIND_ICON: Record<PlaceKind, string> = { station: '🚆', place: '📍', pin: '📌' };
export const KIND_LABEL: Record<PlaceKind, string> = { station: 'Railway station', place: 'Place', pin: 'Your pin' };

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress, kind = 'primary', style }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost'; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.btn, kind === 'ghost' && s.btnGhost, style]}>
      <Text style={[s.btnText, kind === 'ghost' && { color: C.ink }]}>{label}</Text>
    </Pressable>
  );
}

export const Row = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>
);

const s = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { color: C.ink, fontWeight: '600', fontSize: 14 },
  btn: { backgroundColor: C.accent, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  btnGhost: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
