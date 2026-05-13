import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useWorkoutFrequency } from '../../hooks/useDashboard';

interface Props {
  weeks: number;
}

// @MX:NOTE: [AUTO] 주간 운동 빈도 막대 차트 (COMPLETED 세션 수)
export function WorkoutFrequencyChart({ weeks }: Props) {
  const { data, isLoading, error } = useWorkoutFrequency(weeks);

  if (isLoading) return <ActivityIndicator />;
  if (error) {
    return <Text style={styles.error}>운동 빈도를 불러오지 못했습니다</Text>;
  }
  if (!data || data.points.every((p) => p.sessionCount === 0)) {
    return <Text style={styles.empty}>기록된 데이터가 없습니다</Text>;
  }

  const barData = data.points.map((p) => ({
    value: p.sessionCount,
    label: new Date(p.weekStart).toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
    }),
  }));

  return (
    <View>
      <Text style={styles.title}>주간 운동 빈도 (회)</Text>
      <BarChart data={barData} barWidth={18} frontColor="#16a34a" />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: '#dc2626', padding: 16 },
  empty: { color: '#6b7280', padding: 16, textAlign: 'center' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
});
