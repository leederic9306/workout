import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  current: number;
  limit: number;
}

export function AiUsageBadge({ current, limit }: Props) {
  const exceeded = current >= limit;
  return (
    <View style={[styles.badge, exceeded && styles.badgeExceeded]}>
      <Text style={[styles.text, exceeded && styles.textExceeded]}>
        이번 달 {current}/{limit}회 사용
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  badgeExceeded: {
    backgroundColor: '#fee2e2',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  textExceeded: {
    color: '#991b1b',
  },
});
