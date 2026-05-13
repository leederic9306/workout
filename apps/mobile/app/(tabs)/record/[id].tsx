// 완료된 세션 히스토리 상세 화면
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../../../hooks/useWorkouts';
import type { WorkoutSetItem } from '@workout/types';

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetItem[];
}

export default function SessionHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isLoading, isError } = useSession(id);

  const groups: ExerciseGroup[] = useMemo(() => {
    if (!session) return [];
    const map = new Map<string, ExerciseGroup>();
    for (const s of session.sets) {
      const g = map.get(s.exerciseId);
      if (g) g.sets.push(s);
      else map.set(s.exerciseId, { exerciseId: s.exerciseId, exerciseName: s.exerciseName, sets: [s] });
    }
    for (const g of map.values()) g.sets.sort((a, b) => a.setNumber - b.setNumber);
    return Array.from(map.values());
  }, [session]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError || !session) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>세션을 불러올 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {session.name ?? '이름 없는 세션'}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.dateText}>{formatDate(session.startedAt)}</Text>

        <View style={styles.statsRow}>
          <Stat label="시간" value={formatDuration(session.totalDuration)} />
          <Stat label="세트" value={`${session.totalSets}`} />
          <Stat label="볼륨" value={`${Math.round(session.totalVolume)}kg`} />
        </View>

        {groups.map((g) => (
          <View key={g.exerciseId} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{g.exerciseName}</Text>
            {g.sets.map((s) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.setNumber}>{s.setNumber}세트</Text>
                <Text style={styles.setDetail}>{formatSet(s)}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0분';
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}시간 ${m % 60}분`;
  return `${m}분`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
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
  errorText: { color: '#dc2626', fontSize: 16 },
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
  title: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  dateText: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  exerciseCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  exerciseName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  setNumber: { width: 56, fontSize: 13, color: '#6b7280', fontWeight: '500' },
  setDetail: { flex: 1, fontSize: 14, color: '#111827' },
});
