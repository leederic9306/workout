import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import type { CompoundType, DashboardPeriod } from '@workout/types';
import { COMPOUND_LABELS_KO } from '@workout/types';
import { useOneRepMaxHistory } from '../../hooks/useDashboard';

interface Props {
  exerciseType: CompoundType;
  period: DashboardPeriod;
}

// @MX:NOTE: [AUTO] 1RM 히스토리 라인 차트 (Epley 추정 기반)
export function OneRepMaxChart({ exerciseType, period }: Props) {
  const { data, isLoading, error } = useOneRepMaxHistory(exerciseType, period);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error) {
    return <Text style={styles.error}>1RM 데이터를 불러오지 못했습니다</Text>;
  }
  if (!data || data.points.length === 0) {
    return <Text style={styles.empty}>기록된 데이터가 없습니다</Text>;
  }

  const lineData = data.points.map((p) => ({
    value: p.estimated1RM,
    label: new Date(p.completedAt).toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
    }),
  }));

  return (
    <View>
      <Text style={styles.title}>
        {COMPOUND_LABELS_KO[exerciseType]} 1RM 추정 추이
      </Text>
      <LineChart data={lineData} thickness={2} color="#2563eb" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', padding: 20 },
  error: { color: '#dc2626', padding: 16 },
  empty: { color: '#6b7280', padding: 16, textAlign: 'center' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
});
