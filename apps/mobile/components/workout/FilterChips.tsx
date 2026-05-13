import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'abdominals', 'legs'];
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'kettlebells'];

interface FilterChipsProps {
  selectedMuscle?: string;
  selectedEquipment?: string;
  showFavoritesOnly?: boolean;
  onMuscleChange: (muscle: string | undefined) => void;
  onEquipmentChange: (equipment: string | undefined) => void;
  onFavoritesToggle: () => void;
}

export function FilterChips({
  selectedMuscle,
  selectedEquipment,
  showFavoritesOnly,
  onMuscleChange,
  onEquipmentChange,
  onFavoritesToggle,
}: FilterChipsProps) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <TouchableOpacity
          style={[styles.chip, showFavoritesOnly && styles.chipActive]}
          onPress={onFavoritesToggle}
        >
          <Text style={[styles.chipText, showFavoritesOnly && styles.chipTextActive]}>♥ 즐겨찾기</Text>
        </TouchableOpacity>

        {MUSCLES.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, selectedMuscle === m && styles.chipActive]}
            onPress={() => onMuscleChange(selectedMuscle === m ? undefined : m)}
          >
            <Text style={[styles.chipText, selectedMuscle === m && styles.chipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.divider} />

        {EQUIPMENT.map((e) => (
          <TouchableOpacity
            key={e}
            style={[styles.chip, selectedEquipment === e && styles.chipActiveEquip]}
            onPress={() => onEquipmentChange(selectedEquipment === e ? undefined : e)}
          >
            <Text style={[styles.chipText, selectedEquipment === e && styles.chipTextActive]}>{e}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  chipActiveEquip: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#d1d5db',
    marginHorizontal: 4,
  },
});
