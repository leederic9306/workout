import { ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { CompoundType } from '@workout/types';
import { OneRepMaxCard } from '../../../components/profile/OneRepMaxCard';
import { useOneRepMaxes } from '../../../hooks/useOneRepMax';

const COMPOUND_ORDER: CompoundType[] = [
  CompoundType.SQUAT,
  CompoundType.DEADLIFT,
  CompoundType.BENCH_PRESS,
  CompoundType.BARBELL_ROW,
  CompoundType.OVERHEAD_PRESS,
];

export default function OneRepMaxScreen() {
  const { data, isLoading, error } = useOneRepMaxes();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '1RM 관리', headerShown: true }} />

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>1RM 데이터를 불러오지 못했습니다</Text>
        </View>
      )}

      {data && (
        <ScrollView style={styles.list}>
          <Text style={styles.subtitle}>
            5종 컴파운드 운동의 1RM (One Repetition Maximum)을 관리합니다
          </Text>
          {COMPOUND_ORDER.map((type) => (
            <OneRepMaxCard
              key={type}
              exerciseType={type}
              record={data[type]}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 16 },
  list: { flex: 1 },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    padding: 20,
    paddingBottom: 12,
  },
});
