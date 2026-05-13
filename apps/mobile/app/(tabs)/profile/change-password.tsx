// 비밀번호 변경 화면 (SPEC-USER-001 — PATCH /users/me/password)
// 이메일 가입자만 접근 가능 (소셜 계정은 진입 자체를 차단)
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useChangeMyPassword, useMe } from '../../../hooks/useUser';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { data: profile, isLoading } = useMe();
  const change = useChangeMyPassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // 소셜 가입자는 진입을 차단하고 안내
  useEffect(() => {
    if (profile && profile.socialProvider !== null) {
      Alert.alert(
        '사용 불가',
        '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.',
        [{ text: '확인', onPress: () => router.back() }],
      );
    }
  }, [profile, router]);

  if (isLoading || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const onSubmit = () => {
    if (newPassword.length < 8) {
      Alert.alert('오류', '새 비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert('오류', '새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          Alert.alert(
            '완료',
            '비밀번호가 변경되었습니다. 다시 로그인해 주세요.',
          );
          // useChangeMyPassword 가 logout 처리 → _layout 이 로그인 화면으로 이동
        },
        onError: (err) => {
          Alert.alert('오류', err.message);
        },
      },
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>비밀번호 변경</Text>

      <Text style={styles.label}>현재 비밀번호</Text>
      <TextInput
        style={styles.input}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="현재 비밀번호"
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={styles.label}>새 비밀번호 (최소 8자)</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="새 비밀번호"
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={styles.label}>새 비밀번호 확인</Text>
      <TextInput
        style={styles.input}
        value={confirm}
        onChangeText={setConfirm}
        placeholder="새 비밀번호 확인"
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.submitBtn, change.isPending && styles.disabled]}
        onPress={onSubmit}
        disabled={change.isPending}
      >
        <Text style={styles.submitText}>
          {change.isPending ? '변경 중...' : '비밀번호 변경'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>취소</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: '#fff' },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24, color: '#111' },
  label: { fontSize: 14, color: '#374151', marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
  },
  submitBtn: {
    marginTop: 32,
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  cancelBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#6b7280', fontSize: 14 },
});
