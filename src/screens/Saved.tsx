import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, KIND_ICON, KIND_LABEL } from '../ui';
import type { Place } from '../types';

interface Props {
  saved: Place[];
  onPick: (p: Place) => void;
  onRemove: (p: Place) => void;
  onClose: () => void;
  onSetup: () => void;
}

export default function Saved({ saved, onPick, onRemove, onClose, onSetup }: Props) {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.h1}>Saved destinations</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Text style={s.close}>Done</Text></Pressable>
      </View>
      <FlatList
        data={saved}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={s.empty}>No saved stops yet. Pick a destination and tap ☆ to keep it here for next time.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Pressable style={{ flex: 1 }} onPress={() => onPick(item)}>
              <Text style={s.name}>{KIND_ICON[item.kind] ?? '📍'}  {item.name}</Text>
              <Text style={s.meta}>{item.sub || KIND_LABEL[item.kind]}</Text>
            </Pressable>
            <Pressable onPress={() => onRemove(item)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
              <Text style={s.remove}>Remove</Text>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <Pressable onPress={onSetup} style={s.setup} accessibilityRole="button">
            <Text style={s.setupTitle}>Setup and permissions</Text>
            <Text style={s.meta}>Re-check location, notifications and battery settings, or run a test alarm.</Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink },
  close: { color: C.blue, fontSize: 17, fontWeight: '600' },
  empty: { color: C.sub, fontSize: 16, lineHeight: 22, marginTop: 40, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line },
  name: { fontSize: 17, fontWeight: '700', color: C.ink },
  meta: { fontSize: 13, color: C.sub, marginTop: 2 },
  setup: { marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  setupTitle: { fontSize: 16, fontWeight: '700', color: C.blue },
  remove: { color: C.danger, fontWeight: '600' },
});
