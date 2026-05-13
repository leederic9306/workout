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
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useProgramDetail,
  useActiveProgram,
  useActivateProgram,
  useDeactivateProgram,
} from '../../../hooks/usePrograms';
import { ProgramDaySection } from '../../../components/programs/ProgramDaySection';

const LEVEL_LABEL: Record<string, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
};

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const programId = typeof id === 'string' ? id : '';

  const detailQuery = useProgramDetail(programId);
  const activeQuery = useActiveProgram();
  const activate = useActivateProgram();
  const deactivate = useDeactivateProgram();

  if (detailQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>프로그램을 불러올 수 없습니다.</Text>
      </View>
    );
  }

  const program = detailQuery.data;
  const activeId = activeQuery.data?.active?.id ?? null;
  const isActive = activeId === program.id;

  const handleActivate = () => {
    activate.mutate(program.id, {
      onSuccess: () => {
        Alert.alert('활성화 완료', '이 프로그램이 활성화되었습니다.');
      },
      onError: () => {
        Alert.alert('오류', '프로그램 활성화에 실패했습니다.');
      },
    });
  };

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
          <Text style={styles.title}>{program.title}</Text>
          <Text style={styles.description}>{program.description}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>
              난이도: {LEVEL_LABEL[program.level] ?? program.level}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaItem}>주 {program.frequency}일</Text>
          </View>
        </View>

        {program.days
          .slice()
          .sort((a, b) => a.dayNumber - b.dayNumber)
          .map((day) => (
            <ProgramDaySection key={day.id} day={day} />
          ))}

        <View style={{ height: 96 }} />
      </ScrollView>

      <View style={styles.footer}>
        {isActive ? (
          <View style={styles.footerCol}>
            <View style={styles.activeBanner}>
              <Text style={styles.activeBannerText}>현재 활성 프로그램</Text>
            </View>
            <TouchableOpacity
              style={styles.deactivateButton}
              onPress={handleDeactivate}
              disabled={deactivate.isPending}
            >
              <Text style={styles.deactivateText}>
                {deactivate.isPending ? '해제 중...' : '해제하기'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, activate.isPending && styles.disabled]}
            onPress={handleActivate}
            disabled={activate.isPending}
          >
            <Text style={styles.primaryButtonText}>
              {activate.isPending ? '활성화 중...' : '이 프로그램 활성화'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { paddingVertical: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#dc2626', fontSize: 15 },
  metaCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
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
  footerCol: { gap: 8 },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { backgroundColor: '#9ca3af' },
  activeBanner: {
    backgroundColor: '#d1fae5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeBannerText: { color: '#065f46', fontSize: 13, fontWeight: '700' },
  deactivateButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deactivateText: { color: '#991b1b', fontSize: 14, fontWeight: '700' },
});
