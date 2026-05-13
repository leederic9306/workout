import React from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FavoriteButton } from '../../../components/workout/FavoriteButton';
import { useExerciseDetail, useToggleFavorite } from '../../../hooks/useExercises';

const { width } = Dimensions.get('window');

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: exercise, isLoading, isError } = useExerciseDetail(id);
  const toggleFavoriteMutation = useToggleFavorite();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError || !exercise) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>운동을 찾을 수 없습니다.</Text>
        <Text style={styles.backLink} onPress={() => router.back()}>← 돌아가기</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 이미지 carousel */}
      {exercise.images.length > 0 ? (
        <FlatList
          data={exercise.images}
          keyExtractor={(url) => url}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={styles.carouselImage} resizeMode="cover" />
          )}
          style={styles.carousel}
        />
      ) : (
        <View style={[styles.carouselImage, styles.imagePlaceholder]}>
          <Text style={styles.placeholderText}>{exercise.category}</Text>
        </View>
      )}

      {/* 제목 + 메타 */}
      <View style={styles.section}>
        <Text style={styles.name}>{exercise.name}</Text>
        <View style={styles.metaRow}>
          {[
            { label: '카테고리', value: exercise.category },
            { label: '레벨', value: exercise.level },
            { label: '부위', value: exercise.primaryMuscles.join(', ') },
            exercise.equipment ? { label: '기구', value: exercise.equipment } : null,
            exercise.mechanic ? { label: '메카닉', value: exercise.mechanic } : null,
            exercise.force ? { label: '동작', value: exercise.force } : null,
          ]
            .filter(Boolean)
            .map((item) => (
              <View key={item!.label} style={styles.metaItem}>
                <Text style={styles.metaLabel}>{item!.label}</Text>
                <Text style={styles.metaValue}>{item!.value}</Text>
              </View>
            ))}
        </View>
      </View>

      {/* 이차 근육 */}
      {exercise.secondaryMuscles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이차 근육</Text>
          <Text style={styles.bodyText}>{exercise.secondaryMuscles.join(', ')}</Text>
        </View>
      )}

      {/* 운동 방법 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>운동 방법</Text>
        {exercise.instructions.map((step, i) => (
          <View key={i} style={styles.instructionRow}>
            <Text style={styles.stepNumber}>{i + 1}.</Text>
            <Text style={styles.instructionText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* 즐겨찾기 버튼 */}
      <FavoriteButton
        isFavorite={exercise.isFavorite}
        isLoading={toggleFavoriteMutation.isPending}
        onPress={() =>
          toggleFavoriteMutation.mutate({ id: exercise.id, isFavorite: exercise.isFavorite })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  carousel: { width },
  carouselImage: { width, height: 240 },
  imagePlaceholder: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 24, color: '#9ca3af' },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: {},
  metaLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#374151' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  bodyText: { fontSize: 14, color: '#374151' },
  instructionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stepNumber: { fontSize: 14, fontWeight: '700', color: '#2563eb', width: 20 },
  instructionText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  errorText: { fontSize: 18, color: '#dc2626', marginBottom: 12 },
  backLink: { fontSize: 16, color: '#2563eb' },
});
