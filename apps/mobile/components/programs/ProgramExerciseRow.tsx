import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ProgramExerciseDto } from '@workout/types';

interface Props {
  exercise: ProgramExerciseDto;
}

export function ProgramExerciseRow({ exercise }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.orderBadge}>
        <Text style={styles.orderText}>{exercise.orderIndex + 1}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{exercise.exerciseName}</Text>
        <Text style={styles.meta}>
          {exercise.sets}세트 × {exercise.reps}회
        </Text>
        {exercise.weightNote ? (
          <Text style={styles.weight}>{exercise.weightNote}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  orderBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  orderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 3,
  },
  meta: {
    fontSize: 13,
    color: '#374151',
  },
  weight: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
