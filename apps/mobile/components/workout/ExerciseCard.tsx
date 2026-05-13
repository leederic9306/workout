import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import type { ExerciseListItem } from '@workout/types';

interface ExerciseCardProps {
  exercise: ExerciseListItem;
  onPress: () => void;
  onToggleFavorite: () => void;
}

export function ExerciseCard({ exercise, onPress, onToggleFavorite }: ExerciseCardProps) {
  const thumbnailUrl = exercise.images[0] ?? null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.placeholderText}>{exercise.category[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>{exercise.name}</Text>
        <View style={styles.badges}>
          {exercise.primaryMuscles.slice(0, 2).map((m) => (
            <View key={m} style={styles.badge}>
              <Text style={styles.badgeText}>{m}</Text>
            </View>
          ))}
          {exercise.equipment ? (
            <View style={[styles.badge, styles.badgeSecondary]}>
              <Text style={styles.badgeText}>{exercise.equipment}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <TouchableOpacity style={styles.favoriteButton} onPress={onToggleFavorite} hitSlop={8}>
        <Text style={[styles.heart, exercise.isFavorite && styles.heartActive]}>
          {exercise.isFavorite ? '♥' : '♡'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  image: {
    width: 80,
    height: 80,
  },
  imagePlaceholder: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 28,
    color: '#9ca3af',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  badge: {
    backgroundColor: '#dbeafe',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeSecondary: {
    backgroundColor: '#f3f4f6',
  },
  badgeText: {
    fontSize: 10,
    color: '#1e40af',
  },
  favoriteButton: {
    padding: 12,
    justifyContent: 'center',
  },
  heart: {
    fontSize: 22,
    color: '#d1d5db',
  },
  heartActive: {
    color: '#ef4444',
  },
});
