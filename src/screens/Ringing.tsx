import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import type { Place } from '../types';

export default function Ringing({ dest, onDismiss }: { dest: Place | null; onDismiss: () => void }) {
  useKeepAwake();
  return (
    <View style={s.root}>
      <Text style={s.emoji}>⏰</Text>
      <Text style={s.title}>Wake up!</Text>
      <Text style={s.sub}>{dest ? `You're almost at ${dest.name}` : "You're almost there"}</Text>
      <Pressable onPress={onDismiss} style={s.btn} accessibilityRole="button" accessibilityLabel="Turn alarm off">
        <Text style={s.btnText}>I'm awake</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#d92d20', alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 88 },
  title: { color: '#fff', fontSize: 48, fontWeight: '800', marginTop: 8 },
  sub: { color: '#ffe3de', fontSize: 22, textAlign: 'center', marginTop: 12, marginBottom: 56 },
  btn: { backgroundColor: '#fff', alignSelf: 'stretch', paddingVertical: 22, borderRadius: 18, alignItems: 'center' },
  btnText: { color: '#d92d20', fontSize: 24, fontWeight: '800' },
});
