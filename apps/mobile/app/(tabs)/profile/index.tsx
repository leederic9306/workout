// 내 프로필 화면 (SPEC-USER-001 — GET /users/me)
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { useMe } from '../../../hooks/useUser';

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { data: profile, isLoading, isError, refetch } = useMe();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.error}>프로필을 불러오지 못했습니다.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isEmailUser = profile.socialProvider === null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>마이페이지</Text>

      <View style={styles.card}>
        <Text style={styles.email}>{profile.email}</Text>
        {profile.nickname && (
          <Text style={styles.nickname}>{profile.nickname}</Text>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>역할</Text>
          <Text style={styles.value}>{profile.role}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>온보딩</Text>
          <Text style={styles.value}>
            {profile.onboardingCompleted ? '완료' : '미완료'}
          </Text>
        </View>
        {profile.height !== null && (
          <View style={styles.row}>
            <Text style={styles.label}>키 (cm)</Text>
            <Text style={styles.value}>{profile.height}</Text>
          </View>
        )}
        {profile.experienceLevel && (
          <View style={styles.row}>
            <Text style={styles.label}>운동 경험</Text>
            <Text style={styles.value}>{profile.experienceLevel}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/(tabs)/profile/edit')}
      >
        <Text style={styles.menuLabel}>프로필 수정</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/(tabs)/profile/1rm')}
      >
        <Text style={styles.menuLabel}>1RM 관리</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      {isEmailUser && (
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/profile/change-password')}
        >
          <Text style={styles.menuLabel}>비밀번호 변경</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/(tabs)/profile/delete-account')}
      >
        <Text style={[styles.menuLabel, styles.danger]}>계정 삭제</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#111' },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  email: { fontSize: 16, color: '#374151', marginBottom: 8 },
  nickname: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 14, color: '#6b7280' },
  value: { fontSize: 14, color: '#111', fontWeight: '500' },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuLabel: { fontSize: 16, color: '#111', fontWeight: '500' },
  menuArrow: { fontSize: 20, color: '#9ca3af' },
  danger: { color: '#dc2626' },
  logoutButton: {
    marginTop: 32,
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, color: '#dc2626', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
