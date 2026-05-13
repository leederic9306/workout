// 활성 세션 화면 - IN_PROGRESS 세션의 운동/세트를 표시 및 추가
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useActiveSession,
  useCompleteSession,
  useDeleteSet,
} from '../../../hooks/useWorkouts';
import { AddSetModal } from '../../../components/workout/AddSetModal';
import type { WorkoutSetItem } from '@workout/types';

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: string;
  sets: WorkoutSetItem[];
}

export default function ActiveSessionScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useActiveSession();
  const completeMutation = useCompleteSession();
  const session = data?.active ?? null;
  const deleteSetMutation = useDeleteSet(session?.id ?? '');

  const [addSetTarget, setAddSetTarget] = useState<ExerciseGroup | null>(null);

  const groups: ExerciseGroup[] = useMemo(() => {
    if (!session) return [];
    const map = new Map<string, ExerciseGroup>();
    for (const s of session.sets) {
      const g = map.get(s.exerciseId);
      if (g) {
        g.sets.push(s);
      } else {
        map.set(s.exerciseId, {
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          exerciseCategory: s.exerciseCategory,
          sets: [s],
        });
      }
    }
    for (const g of map.values()) {
      g.sets.sort((a, b) => a.setNumber - b.setNumber);
    }
    return Array.from(map.values());
  }, [session]);

  const handleComplete = () => {
    if (!session) return;
    Alert.alert('운동 완료', '이 운동을 완료하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '완료',
        onPress: () =>
          completeMutation.mutate(session.id, {
            onSuccess: () => router.replace(`/(tabs)/record/summary/${session.id}`),
            onError: () => Alert.alert('오류', '운동 완료에 실패했습니다.'),
          }),
      },
    ]);
  };

  const handleDeleteSet = (setId: string) => {
    Alert.alert('세트 삭제', '이 세트를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => deleteSetMutation.mutate(setId),
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>세션을 불러올 수 없습니다.</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.linkText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>진행 중인 운동이 없습니다.</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/record')}>
          <Text style={styles.linkText}>기록 홈으로</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.sessionName} numberOfLines={1}>
          {session.name ?? '운동 기록 중'}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>아직 기록된 세트가 없습니다</Text>
            <Text style={styles.emptySubtitle}>
              아래 &quot;운동 추가하기&quot; 버튼을 눌러 시작하세요.
            </Text>
          </View>
        ) : (
          groups.map((g) => {
            const nextSetNumber = g.sets.length + 1;
            return (
              <View key={g.exerciseId} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{g.exerciseName}</Text>
                {g.sets.map((s) => (
                  <View key={s.id} style={styles.setRow}>
                    <Text style={styles.setNumber}>{s.setNumber}세트</Text>
                    <Text style={styles.setDetail}>{formatSet(s)}</Text>
                    <TouchableOpacity onPress={() => handleDeleteSet(s.id)} hitSlop={8}>
                      <Text style={styles.deleteIcon}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addSetButton}
                  onPress={() => setAddSetTarget({ ...g })}
                >
                  <Text style={styles.addSetText}>+ 세트 추가 ({nextSetNumber})</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.addExerciseButton}
          onPress={() => router.push('/(tabs)/record/picker')}
        >
          <Text style={styles.addExerciseText}>+ 운동 추가하기</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.completeButton, completeMutation.isPending && styles.disabledButton]}
          onPress={handleComplete}
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.completeText}>운동 완료</Text>
          )}
        </TouchableOpacity>
      </View>

      {addSetTarget && (
        <AddSetModal
          visible={!!addSetTarget}
          sessionId={session.id}
          exerciseId={addSetTarget.exerciseId}
          exerciseName={addSetTarget.exerciseName}
          exerciseCategory={addSetTarget.exerciseCategory}
          nextSetNumber={addSetTarget.sets.length + 1}
          onClose={() => setAddSetTarget(null)}
        />
      )}
    </View>
  );
}

function formatSet(s: WorkoutSetItem): string {
  if (s.duration != null) return `${s.duration}초`;
  const reps = s.reps ?? 0;
  const weight = s.weight ?? 0;
  return weight > 0 ? `${reps}회 × ${weight}kg` : `${reps}회`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backText: { color: '#2563eb', fontSize: 15, fontWeight: '500', width: 50 },
  sessionName: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', marginTop: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 16, marginBottom: 8 },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  exerciseName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  setNumber: { width: 56, fontSize: 13, color: '#6b7280', fontWeight: '500' },
  setDetail: { flex: 1, fontSize: 15, color: '#111827' },
  deleteIcon: { fontSize: 22, color: '#9ca3af', paddingHorizontal: 8 },
  addSetButton: {
    marginTop: 10,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  addSetText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  addExerciseButton: {
    marginTop: 8,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addExerciseText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  completeButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.6 },
  completeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
