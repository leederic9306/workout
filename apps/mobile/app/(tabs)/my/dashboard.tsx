import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { CompoundType, type DashboardPeriod } from '@workout/types';
import { OneRepMaxChart } from '../../../components/charts/OneRepMaxChart';
import { BodyCompositionChart } from '../../../components/charts/BodyCompositionChart';
import { WeeklyVolumeChart } from '../../../components/charts/WeeklyVolumeChart';
import { WorkoutFrequencyChart } from '../../../components/charts/WorkoutFrequencyChart';

const PERIODS: DashboardPeriod[] = ['1m', '3m', '6m', '1y'];

// @MX:NOTE: [AUTO] 대시보드 — 4종 차트 + 기간 필터
export default function DashboardScreen() {
  const [period, setPeriod] = useState<DashboardPeriod>('3m');
  const [exerciseType, setExerciseType] = useState<CompoundType>(
    CompoundType.SQUAT,
  );

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: '대시보드', headerShown: true }} />

      <View style={styles.row}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, period === p && styles.chipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[styles.chipText, period === p && styles.chipTextActive]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          {Object.values(CompoundType).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, exerciseType === t && styles.chipActive]}
              onPress={() => setExerciseType(t)}
            >
              <Text
                style={[
                  styles.chipText,
                  exerciseType === t && styles.chipTextActive,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <OneRepMaxChart exerciseType={exerciseType} period={period} />
      </View>

      <View style={styles.card}>
        <BodyCompositionChart period={period} />
      </View>

      <View style={styles.card}>
        <WeeklyVolumeChart weeks={12} />
      </View>

      <View style={styles.card}>
        <WorkoutFrequencyChart weeks={12} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#374151', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 12,
  },
});
