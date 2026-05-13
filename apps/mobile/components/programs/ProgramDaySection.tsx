import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ProgramDayDto } from '@workout/types';
import { ProgramExerciseRow } from './ProgramExerciseRow';

interface Props {
  day: ProgramDayDto;
}

export function ProgramDaySection({ day }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.dayLabel}>Day {day.dayNumber}</Text>
        <Text style={styles.dayName}>{day.name}</Text>
      </View>
      <View style={styles.body}>
        {day.exercises.length === 0 ? (
          <Text style={styles.empty}>등록된 운동이 없습니다.</Text>
        ) : (
          day.exercises.map((ex) => <ProgramExerciseRow key={ex.id} exercise={ex} />)
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
    marginRight: 8,
  },
  dayName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  body: {
    paddingVertical: 4,
  },
  empty: {
    padding: 14,
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
