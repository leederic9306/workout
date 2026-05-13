import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { CatalogItemDto } from '@workout/types';

interface ProgramCardProps {
  program: CatalogItemDto;
  onPress: () => void;
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
};

function levelStyle(level: string) {
  switch (level) {
    case 'beginner':
      return { bg: '#d1fae5', fg: '#065f46' };
    case 'intermediate':
      return { bg: '#fef3c7', fg: '#92400e' };
    case 'advanced':
      return { bg: '#fee2e2', fg: '#991b1b' };
    default:
      return { bg: '#e5e7eb', fg: '#374151' };
  }
}

export function ProgramCard({ program, onPress }: ProgramCardProps) {
  const lv = levelStyle(program.level);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>{program.title}</Text>
        <View style={[styles.badge, { backgroundColor: lv.bg }]}>
          <Text style={[styles.badgeText, { color: lv.fg }]}>
            {LEVEL_LABEL[program.level] ?? program.level}
          </Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>{program.description}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>주 {program.frequency}일</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.meta}>{program.dayCount}일 분할</Text>
      </View>
      <Text style={styles.summary} numberOfLines={2}>{program.exerciseSummary}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  dot: {
    marginHorizontal: 6,
    color: '#9ca3af',
  },
  summary: {
    fontSize: 12,
    color: '#6b7280',
  },
});
