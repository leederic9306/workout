import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ExerciseCard } from '../../../components/workout/ExerciseCard';
import { FilterChips } from '../../../components/workout/FilterChips';
import { useExercises, useFavoriteExercises, useToggleFavorite } from '../../../hooks/useExercises';
import type { ExerciseListItem } from '@workout/types';

export default function ExerciseListScreen() {
  const router = useRouter();
  const [primaryMuscle, setPrimaryMuscle] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>();
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const exercisesQuery = useExercises({ primaryMuscle, equipment });
  const favoritesQuery = useFavoriteExercises();
  const toggleFavoriteMutation = useToggleFavorite();

  const activeQuery = showFavoritesOnly ? favoritesQuery : exercisesQuery;
  const allItems: ExerciseListItem[] = activeQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const handleEndReached = useCallback(() => {
    if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
      activeQuery.fetchNextPage();
    }
  }, [activeQuery]);

  const handleRefresh = useCallback(() => {
    activeQuery.refetch();
  }, [activeQuery]);

  const renderItem = useCallback(
    ({ item }: { item: ExerciseListItem }) => (
      <ExerciseCard
        exercise={item}
        onPress={() => router.push(`/(tabs)/workout/${item.id}`)}
        onToggleFavorite={() =>
          toggleFavoriteMutation.mutate({ id: item.id, isFavorite: item.isFavorite })
        }
      />
    ),
    [router, toggleFavoriteMutation],
  );

  if (activeQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (activeQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>운동 목록을 불러올 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FilterChips
        selectedMuscle={primaryMuscle}
        selectedEquipment={equipment}
        showFavoritesOnly={showFavoritesOnly}
        onMuscleChange={setPrimaryMuscle}
        onEquipmentChange={setEquipment}
        onFavoritesToggle={() => setShowFavoritesOnly((v) => !v)}
      />
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={activeQuery.isRefetching} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>조건에 맞는 운동이 없습니다.</Text>
          </View>
        }
        ListFooterComponent={
          activeQuery.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          ) : null
        }
        contentContainerStyle={allItems.length === 0 ? styles.emptyContainer : styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1 },
  list: { paddingVertical: 8 },
  errorText: { color: '#dc2626', fontSize: 16 },
  emptyText: { color: '#6b7280', fontSize: 16 },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
});
