import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  useBodyCompositions,
  useCreateBodyComposition,
  useDeleteBodyComposition,
} from '../../../hooks/useBodyComposition';
import type { BodyCompositionRecord } from '@workout/types';

// 체성분 입력 + 히스토리 + 삭제 화면
export default function BodyCompositionScreen() {
  const [weight, setWeight] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');

  const listQuery = useBodyCompositions(20);
  const createMut = useCreateBodyComposition();
  const deleteMut = useDeleteBodyComposition();

  const items: BodyCompositionRecord[] =
    listQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const handleSubmit = () => {
    const w = Number(weight);
    if (!Number.isFinite(w) || w < 40 || w > 300) {
      Alert.alert('체중은 40 ~ 300 kg 사이여야 합니다');
      return;
    }
    const mm = muscleMass ? Number(muscleMass) : undefined;
    const bf = bodyFatPct ? Number(bodyFatPct) : undefined;
    if (mm !== undefined && mm > w) {
      Alert.alert('근육량은 체중보다 작아야 합니다');
      return;
    }
    createMut.mutate(
      { weight: w, muscleMass: mm, bodyFatPct: bf },
      {
        onSuccess: () => {
          setWeight('');
          setMuscleMass('');
          setBodyFatPct('');
        },
        onError: () => Alert.alert('저장에 실패했습니다'),
      },
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert('삭제', '이 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => deleteMut.mutate(id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '체성분 기록', headerShown: true }} />

      <View style={styles.form}>
        <Text style={styles.label}>체중 (kg) *</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
          placeholder="예: 75.5"
        />
        <Text style={styles.label}>근육량 (kg)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={muscleMass}
          onChangeText={setMuscleMass}
          placeholder="예: 35.2 (선택)"
        />
        <Text style={styles.label}>체지방률 (%)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={bodyFatPct}
          onChangeText={setBodyFatPct}
          placeholder="예: 18.5 (선택)"
        />
        <TouchableOpacity
          style={[styles.button, createMut.isPending && styles.buttonDisabled]}
          disabled={createMut.isPending}
          onPress={handleSubmit}
        >
          <Text style={styles.buttonText}>
            {createMut.isPending ? '저장 중...' : '기록 저장'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>최근 기록</Text>
      {listQuery.isLoading ? (
        <ActivityIndicator />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>기록된 데이터가 없습니다</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          onEndReached={() => listQuery.fetchNextPage()}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDate}>
                  {new Date(item.recordedAt).toLocaleDateString('ko-KR')}
                </Text>
                <Text style={styles.itemValues}>
                  체중 {item.weight}kg
                  {item.muscleMass != null ? ` · 근육 ${item.muscleMass}kg` : ''}
                  {item.bodyFatPct != null ? ` · 체지방 ${item.bodyFatPct}%` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.delete}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: { fontSize: 13, color: '#374151', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  empty: { color: '#6b7280', padding: 16, textAlign: 'center' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemDate: { fontSize: 13, color: '#6b7280' },
  itemValues: { fontSize: 15, marginTop: 2 },
  delete: { color: '#dc2626', paddingHorizontal: 8 },
});
