import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import type { DashboardPeriod } from '@workout/types';
import { useBodyCompositionTrend } from '../../hooks/useDashboard';

interface Props {
  period: DashboardPeriod;
}

// @MX:NOTE: [AUTO] 체성분 추이 라인 차트 (체중/근육량/체지방률)
export function BodyCompositionChart({ period }: Props) {
  const { data, isLoading, error } = useBodyCompositionTrend(period);

  if (isLoading) return <ActivityIndicator />;
  if (error) {
    return <Text style={styles.error}>체성분 데이터를 불러오지 못했습니다</Text>;
  }
  if (!data || data.points.length === 0) {
    return <Text style={styles.empty}>기록된 데이터가 없습니다</Text>;
  }

  const weightData = data.points.map((p) => ({
    value: p.weight,
    label: new Date(p.recordedAt).toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
    }),
  }));

  return (
    <View>
      <Text style={styles.title}>체중 추이 (kg)</Text>
      <LineChart data={weightData} thickness={2} color="#16a34a" />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: '#dc2626', padding: 16 },
  empty: { color: '#6b7280', padding: 16, textAlign: 'center' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
});
