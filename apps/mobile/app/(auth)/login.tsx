// 로그인 화면 — 이메일/비밀번호 + 소셜 로그인 진입점
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { login } from '../../services/auth';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const loginMutation = useMutation({
    mutationFn: async () => login(email.trim(), password),
    onSuccess: async (data) => {
      // 토큰 저장 후 사용자 정보 반영
      await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setUser(data.user);
      router.replace('/');
    },
    onError: (err: unknown) => {
      const message = extractErrorMessage(err, '로그인에 실패했습니다.');
      setErrorMessage(message);
    },
  });

  const handleLogin = () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    loginMutation.mutate();
  };

  const handleSocial = (provider: 'kakao' | 'google') => {
    // 실제 SDK 미설치 — 준비중 안내
    Alert.alert('준비중', `${provider === 'kakao' ? '카카오' : '구글'} 로그인은 곧 지원됩니다.`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>로그인</Text>
        <Text style={styles.subtitle}>Workout Tracker에 오신 것을 환영합니다.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            secureTextEntry
            style={styles.input}
          />
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, loginMutation.isPending && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="로그인"
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>로그인</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.socialButton, styles.kakaoButton]}
          onPress={() => handleSocial('kakao')}
          accessibilityRole="button"
          accessibilityLabel="카카오 로그인"
        >
          <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialButton, styles.googleButton]}
          onPress={() => handleSocial('google')}
          accessibilityRole="button"
          accessibilityLabel="구글 로그인"
        >
          <Text style={styles.googleButtonText}>구글로 시작하기</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>계정이 없으신가요?</Text>
          <Link href="/register" style={styles.link}>
            <Text style={styles.linkText}>회원가입</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as { response?: { data?: { message?: string | string[] } } };
    const msg = anyErr.response?.data?.message;
    if (Array.isArray(msg)) return msg.join('\n');
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, color: '#111' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  error: { color: '#dc2626', marginBottom: 12, fontSize: 13 },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 12, color: '#9ca3af', fontSize: 13 },
  socialButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  kakaoButton: { backgroundColor: '#FEE500' },
  kakaoButtonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  googleButtonText: { color: '#111', fontSize: 16, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: { color: '#666', fontSize: 14 },
  link: { marginLeft: 4 },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
