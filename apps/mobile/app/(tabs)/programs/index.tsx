import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserRole } from '@workout/types';
import { ProgramCard } from '../../../components/programs/ProgramCard';
import { useCatalog } from '../../../hooks/usePrograms';
import { useAuthStore } from '../../../stores/authStore';

export default function CatalogScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useCatalog();
  const user = useAuthStore((s) => s.user);
  const canUseAi = user?.role === UserRole.PREMIUM || user?.role === UserRole.ADMIN;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>프로그램을 불러올 수 없습니다.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = data?.items ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProgramCard
            program={item}
            onPress={() => router.push(`/(tabs)/programs/${item.id}`)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={styles.activeLink}
              onPress={() => router.push('/(tabs)/programs/active')}
            >
              <Text style={styles.activeLinkText}>내 활성 프로그램 보기 →</Text>
            </TouchableOpacity>

            {canUseAi ? (
              <TouchableOpacity
                style={styles.aiButton}
                onPress={() => router.push('/(tabs)/programs/ai-create')}
              >
                <Text style={styles.aiButtonText}>✨ AI 맞춤 프로그램 만들기</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.upgradeCard}>
                <Text style={styles.upgradeTitle}>AI 맞춤 프로그램</Text>
                <Text style={styles.upgradeText}>
                  Premium 등급으로 업그레이드하면 AI가 나만의 운동 프로그램을 생성해드립니다.
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>프로그램이 없습니다.</Text>
          </View>
        }
        refreshing={isRefetching}
        onRefresh={() => refetch()}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { paddingVertical: 8, paddingBottom: 32 },
  headerSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  activeLink: {
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  activeLinkText: { color: '#007AFF', fontSize: 13, fontWeight: '600' },
  aiButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  aiButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  upgradeCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 12,
  },
  upgradeTitle: { fontSize: 14, fontWeight: '700', color: '#9a3412', marginBottom: 4 },
  upgradeText: { fontSize: 12, color: '#9a3412', lineHeight: 18 },
  errorText: { color: '#dc2626', fontSize: 15, marginBottom: 12 },
  emptyText: { color: '#6b7280', fontSize: 14 },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
