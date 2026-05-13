import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveProgram, useDeactivateProgram } from '../../../hooks/usePrograms';
import { ProgramDaySection } from '../../../components/programs/ProgramDaySection';

const LEVEL_LABEL: Record<string, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
};

export default function ActiveProgramScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useActiveProgram();
  const deactivate = useDeactivateProgram();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>활성 프로그램을 불러올 수 없습니다.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const active = data?.active;

  if (!active) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>활성 프로그램이 없습니다</Text>
        <Text style={styles.emptyText}>카탈로그에서 프로그램을 선택해주세요.</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/programs')}
        >
          <Text style={styles.primaryButtonText}>카탈로그 보기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleDeactivate = () => {
    Alert.alert('프로그램 해제', '활성 프로그램을 해제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        style: 'destructive',
        onPress: () =>
          deactivate.mutate(undefined, {
            onSuccess: () => Alert.alert('해제 완료', '활성 프로그램이 해제되었습니다.'),
            onError: () => Alert.alert('오류', '해제에 실패했습니다.'),
          }),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.metaCard}>
          <Text style={styles.activeLabel}>현재 활성 프로그램</Text>
          <Text style={styles.title}>{active.title}</Text>
          <Text style={styles.description}>{active.description}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>
              난이도: {LEVEL_LABEL[active.level] ?? active.level}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaItem}>주 {active.frequency}일</Text>
          </View>
        </View>

        {active.days
          .slice()
          .sort((a, b) => a.dayNumber - b.dayNumber)
          .map((day) => (
            <ProgramDaySection key={day.id} day={day} />
          ))}

        <View style={{ height: 96 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.deactivateButton, deactivate.isPending && styles.disabled]}
          onPress={handleDeactivate}
          disabled={deactivate.isPending}
        >
          <Text style={styles.deactivateText}>
            {deactivate.isPending ? '해제 중...' : '해제하기'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { paddingVertical: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#dc2626', fontSize: 15, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#6b7280', marginBottom: 16, textAlign: 'center' },
  metaCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  activeLabel: {
    fontSize: 11,
    color: '#065f46',
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  description: { fontSize: 13, color: '#4b5563', lineHeight: 20, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaItem: { fontSize: 12, color: '#374151', fontWeight: '500' },
  metaDot: { marginHorizontal: 6, color: '#9ca3af' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  deactivateButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deactivateText: { color: '#991b1b', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
