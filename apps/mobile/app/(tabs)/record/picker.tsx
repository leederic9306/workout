// 운동 선택 화면 - 활성 세션에 추가할 운동을 선택
import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useExercises } from '../../../hooks/useExercises';
import { useActiveSession } from '../../../hooks/useWorkouts';
import { AddSetModal } from '../../../components/workout/AddSetModal';
import type { ExerciseListItem } from '@workout/types';

interface PickedExercise {
  id: string;
  name: string;
  category: string;
}

export default function ExercisePickerScreen() {
  const router = useRouter();
  const [primaryMuscle] = useState<string | undefined>();
  const exercisesQuery = useExercises({ primaryMuscle });
  const activeQuery = useActiveSession();
  const session = activeQuery.data?.active ?? null;

  const [picked, setPicked] = useState<PickedExercise | null>(null);
  const [search, setSearch] = useState('');

  const allItems: ExerciseListItem[] = exercisesQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = search
    ? allItems.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : allItems;

  const nextSetNumber = (() => {
    if (!session || !picked) return 1;
    const setsForExercise = session.sets.filter((s) => s.exerciseId === picked.id);
    return setsForExercise.length + 1;
  })();

  const handleSelect = useCallback(async (item: ExerciseListItem) => {
    // category가 list item에 있으므로 그대로 사용
    setPicked({ id: item.id, name: item.name, category: item.category });
  }, []);

  const handleEndReached = useCallback(() => {
    if (exercisesQuery.hasNextPage && !exercisesQuery.isFetchingNextPage) {
      exercisesQuery.fetchNextPage();
    }
  }, [exercisesQuery]);

  const handleClose = () => {
    setPicked(null);
    router.back();
  };

  const renderItem = useCallback(
    ({ item }: { item: ExerciseListItem }) => (
      <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemMeta}>
          {item.primaryMuscles.slice(0, 2).map((m) => (
            <View key={m} style={styles.badge}>
              <Text style={styles.badgeText}>{m}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    ),
    [handleSelect],
  );

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
        <Text style={styles.title}>운동 선택</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="운동 이름 검색"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {exercisesQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            exercisesQuery.isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>운동이 없습니다.</Text>
            </View>
          }
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      {picked && (
        <AddSetModal
          visible={!!picked}
          sessionId={session.id}
          exerciseId={picked.id}
          exerciseName={picked.name}
          exerciseCategory={picked.category}
          nextSetNumber={nextSetNumber}
          onClose={handleClose}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1 },
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
  searchBox: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  searchInput: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 15,
    color: '#111827',
  },
  item: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    borderRadius: 10,
  },
  itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemMeta: { flexDirection: 'row', gap: 4, marginTop: 6 },
  badge: { backgroundColor: '#dbeafe', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, color: '#1e40af' },
  emptyText: { color: '#6b7280', fontSize: 16, marginBottom: 8 },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
});
