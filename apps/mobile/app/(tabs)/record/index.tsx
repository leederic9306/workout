// 운동 기록 홈 화면
// - 진행 중인 세션이 있으면 "이어서 기록하기" 카드 표시
// - 새 운동 시작 버튼 (옵션 이름 입력 모달)
// - 최근 완료 세션 5개 리스트
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { useActiveSession, useSessions, useCreateSession } from '../../../hooks/useWorkouts';
import { SessionStatus, type WorkoutSessionSummary } from '@workout/types';

export default function RecordHomeScreen() {
  const router = useRouter();
  const activeQuery = useActiveSession();
  const sessionsQuery = useSessions({ status: SessionStatus.COMPLETED, limit: 5 });
  const createMutation = useCreateSession();

  const [modalVisible, setModalVisible] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const active = activeQuery.data?.active ?? null;
  const recentSessions: WorkoutSessionSummary[] =
    sessionsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const handleStartSession = () => {
    setError(null);
    createMutation.mutate(
      { name: sessionName.trim() || undefined },
      {
        onSuccess: (session) => {
          setModalVisible(false);
          setSessionName('');
          router.push('/(tabs)/record/active');
        },
        onError: (err) => {
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setError('이미 진행 중인 운동이 있습니다.');
          } else {
            setError('운동 시작에 실패했습니다.');
          }
        },
      },
    );
  };

  const isLoading = activeQuery.isLoading || sessionsQuery.isLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={activeQuery.isRefetching || sessionsQuery.isRefetching}
          onRefresh={() => {
            activeQuery.refetch();
            sessionsQuery.refetch();
          }}
        />
      }
    >
      <Text style={styles.title}>운동 기록</Text>

      {active ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>진행 중인 운동</Text>
          <Text style={styles.activeName}>{active.name ?? '이름 없는 세션'}</Text>
          <Text style={styles.activeMeta}>
            세트 {active.totalSets} · 운동 {active.totalExercises}
          </Text>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push('/(tabs)/record/active')}
          >
            <Text style={styles.continueButtonText}>이어서 기록하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.startButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.startButtonText}>새 운동 시작</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>최근 운동</Text>
      {recentSessions.length === 0 ? (
        <Text style={styles.emptyText}>아직 완료한 운동이 없습니다.</Text>
      ) : (
        recentSessions.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={styles.historyCard}
            onPress={() => router.push(`/(tabs)/record/${s.id}`)}
          >
            <View style={styles.historyHeader}>
              <Text style={styles.historyName} numberOfLines={1}>
                {s.name ?? '이름 없는 세션'}
              </Text>
              <Text style={styles.historyDate}>{formatDate(s.startedAt)}</Text>
            </View>
            <Text style={styles.historyMeta}>
              세트 {s.totalSets} · 총 볼륨 {Math.round(s.totalVolume)}kg
            </Text>
          </TouchableOpacity>
        ))
      )}

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>새 운동 시작</Text>
            <Text style={styles.modalSubtitle}>운동 이름 (선택)</Text>
            <TextInput
              style={styles.input}
              value={sessionName}
              onChangeText={setSessionName}
              placeholder="예: 가슴 데이"
              placeholderTextColor="#9ca3af"
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setSessionName('');
                  setError(null);
                }}
                disabled={createMutation.isPending}
              >
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleStartSession}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmText}>시작</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
  activeCard: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  activeLabel: { color: '#dbeafe', fontSize: 12, fontWeight: '600' },
  activeName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 4 },
  activeMeta: { color: '#dbeafe', fontSize: 13, marginTop: 4 },
  continueButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  continueButtonText: { color: '#2563eb', fontSize: 15, fontWeight: '700' },
  startButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  emptyText: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 16 },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  historyDate: { fontSize: 12, color: '#6b7280', marginLeft: 8 },
  historyMeta: { fontSize: 13, color: '#6b7280', marginTop: 4 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  error: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { backgroundColor: '#f3f4f6' },
  confirmButton: { backgroundColor: '#2563eb' },
  cancelText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
