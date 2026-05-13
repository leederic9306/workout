import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { CreateAiProgramRequest } from '@workout/types';

interface Props {
  loading?: boolean;
  onSubmit: (dto: CreateAiProgramRequest) => void;
}

type Goal = 'muscle_gain' | 'strength' | 'endurance';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'muscle_gain', label: '근비대' },
  { value: 'strength', label: '근력' },
  { value: 'endurance', label: '지구력' },
];

const EQUIPMENTS = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Kettlebell',
  'Resistance Band',
];

const FOCUS_AREAS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];

const DAYS = [3, 4, 5, 6];

export function AiProgramForm({ loading = false, onSubmit }: Props) {
  const [goal, setGoal] = useState<Goal>('muscle_gain');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipment, setEquipment] = useState<string[]>(['Barbell', 'Dumbbell']);
  const [focus, setFocus] = useState<string[]>([]);

  const toggle = (arr: string[], v: string, setter: (s: string[]) => void) => {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const canSubmit = !loading && equipment.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      goal,
      daysPerWeek,
      availableEquipment: equipment,
      focusAreas: focus.length > 0 ? focus : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>목표</Text>
      <View style={styles.row}>
        {GOALS.map((g) => (
          <TouchableOpacity
            key={g.value}
            style={[styles.chip, goal === g.value && styles.chipActive]}
            onPress={() => setGoal(g.value)}
            disabled={loading}
          >
            <Text style={[styles.chipText, goal === g.value && styles.chipTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>주당 운동 일수</Text>
      <View style={styles.row}>
        {DAYS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, daysPerWeek === d && styles.chipActive]}
            onPress={() => setDaysPerWeek(d)}
            disabled={loading}
          >
            <Text style={[styles.chipText, daysPerWeek === d && styles.chipTextActive]}>
              {d}일
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>사용 가능한 장비 (1개 이상)</Text>
      <View style={styles.row}>
        {EQUIPMENTS.map((e) => (
          <TouchableOpacity
            key={e}
            style={[styles.chip, equipment.includes(e) && styles.chipActive]}
            onPress={() => toggle(equipment, e, setEquipment)}
            disabled={loading}
          >
            <Text
              style={[styles.chipText, equipment.includes(e) && styles.chipTextActive]}
            >
              {e}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>집중 부위 (선택)</Text>
      <View style={styles.row}>
        {FOCUS_AREAS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, focus.includes(f) && styles.chipActive]}
            onPress={() => toggle(focus, f, setFocus)}
            disabled={loading}
          >
            <Text style={[styles.chipText, focus.includes(f) && styles.chipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
        onPress={submit}
        disabled={!canSubmit}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.submitText}>  AI가 프로그램을 생성 중입니다...</Text>
          </View>
        ) : (
          <Text style={styles.submitText}>AI 프로그램 생성</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#dbeafe',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  submit: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
