// 회원가입 화면 — 2단계 플로우 (초대 코드 검증 → 계정/신체 정보 입력)
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Gender, ExperienceLevel } from '@workout/types';
import { signup, verifyInviteCode, type SignupRequest } from '../../services/auth';
import { useAuthStore } from '../../stores/authStore';

type Step = 1 | 2;

export default function RegisterScreen() {
  const [step, setStep] = useState<Step>(1);
  const [inviteCode, setInviteCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Step 2 폼 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [birthDate, setBirthDate] = useState(''); // YYYY-MM-DD
  const [height, setHeight] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    ExperienceLevel.BEGINNER,
  );
  const [signupError, setSignupError] = useState<string | null>(null);

  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const verifyMutation = useMutation({
    mutationFn: async () => verifyInviteCode(inviteCode.trim()),
    onSuccess: (data) => {
      if (data.valid) {
        setVerifyError(null);
        setStep(2);
      } else {
        setVerifyError(data.reason ?? '유효하지 않은 초대 코드입니다.');
      }
    },
    onError: (err: unknown) => {
      setVerifyError(extractErrorMessage(err, '초대 코드 확인에 실패했습니다.'));
    },
  });

  const signupMutation = useMutation({
    mutationFn: async () => {
      const payload: SignupRequest = {
        email: email.trim(),
        password,
        inviteCode: inviteCode.trim(),
        nickname: nickname.trim(),
        gender,
        birthDate,
        height: Number(height),
        experienceLevel,
      };
      return signup(payload);
    },
    onSuccess: async (data) => {
      await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setUser(data.user);
      router.replace('/');
    },
    onError: (err: unknown) => {
      setSignupError(extractErrorMessage(err, '회원가입에 실패했습니다.'));
    },
  });

  const handleVerify = () => {
    setVerifyError(null);
    if (!inviteCode.trim()) {
      setVerifyError('초대 코드를 입력해주세요.');
      return;
    }
    verifyMutation.mutate();
  };

  const handleSignup = () => {
    setSignupError(null);
    const error = validateStep2({
      email,
      password,
      passwordConfirm,
      nickname,
      birthDate,
      height,
    });
    if (error) {
      setSignupError(error);
      return;
    }
    signupMutation.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>회원가입</Text>
        <Text style={styles.subtitle}>
          {step === 1 ? '초대 코드를 입력해주세요.' : '계정 정보를 입력해주세요.'}
        </Text>

        {step === 1 ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>초대 코드</Text>
              <TextInput
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="예: WORKOUT2026"
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            {verifyError ? <Text style={styles.error}>{verifyError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, verifyMutation.isPending && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={verifyMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="초대 코드 확인"
            >
              {verifyMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>코드 확인</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Field label="이메일">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </Field>

            <Field label="비밀번호 (대문자/숫자/특수문자 포함 8자 이상)">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호"
                secureTextEntry
                style={styles.input}
              />
            </Field>

            <Field label="비밀번호 확인">
              <TextInput
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="비밀번호 다시 입력"
                secureTextEntry
                style={styles.input}
              />
            </Field>

            <Field label="닉네임 (2~20자)">
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임"
                style={styles.input}
              />
            </Field>

            <Field label="성별">
              <RadioGroup
                value={gender}
                onChange={setGender}
                options={[
                  { value: Gender.MALE, label: '남성' },
                  { value: Gender.FEMALE, label: '여성' },
                  { value: Gender.OTHER, label: '기타' },
                ]}
              />
            </Field>

            <Field label="생년월일 (YYYY-MM-DD)">
              <TextInput
                value={birthDate}
                onChangeText={setBirthDate}
                placeholder="1990-01-01"
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                style={styles.input}
              />
            </Field>

            <Field label="키 (cm)">
              <TextInput
                value={height}
                onChangeText={setHeight}
                placeholder="175"
                keyboardType="numeric"
                style={styles.input}
              />
            </Field>

            <Field label="운동 경력">
              <RadioGroup
                value={experienceLevel}
                onChange={setExperienceLevel}
                options={[
                  { value: ExperienceLevel.BEGINNER, label: '초보자' },
                  { value: ExperienceLevel.INTERMEDIATE, label: '중급자' },
                  { value: ExperienceLevel.ADVANCED, label: '고급자' },
                ]}
              />
            </Field>

            {signupError ? <Text style={styles.error}>{signupError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, signupMutation.isPending && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={signupMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="가입하기"
            >
              {signupMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>가입하기</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setStep(1)}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>초대 코드 다시 입력</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>이미 계정이 있으신가요?</Text>
          <Link href="/login" style={styles.linkSpace}>
            <Text style={styles.linkText}>로그인</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// 공용 라벨 + 필드 래퍼
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

// 간단한 라디오 그룹 (외부 UI 라이브러리 미사용)
function RadioGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View style={styles.radioRow}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.radioItem, selected && styles.radioItemSelected]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.radioText, selected && styles.radioTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// 클라이언트 측 1차 검증 — 서버 측 검증과 별개로 UX 개선용
function validateStep2(input: {
  email: string;
  password: string;
  passwordConfirm: string;
  nickname: string;
  birthDate: string;
  height: string;
}): string | null {
  if (!input.email.trim()) return '이메일을 입력해주세요.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return '올바른 이메일 형식이 아닙니다.';
  }
  if (input.password.length < 8) return '비밀번호는 최소 8자 이상이어야 합니다.';
  if (!/[A-Z]/.test(input.password) || !/\d/.test(input.password) || !/[^A-Za-z0-9]/.test(input.password)) {
    return '비밀번호는 대문자/숫자/특수문자를 각 1개 이상 포함해야 합니다.';
  }
  if (input.password !== input.passwordConfirm) return '비밀번호가 일치하지 않습니다.';
  if (input.nickname.trim().length < 2 || input.nickname.trim().length > 20) {
    return '닉네임은 2~20자여야 합니다.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
    return '생년월일은 YYYY-MM-DD 형식이어야 합니다.';
  }
  const h = Number(input.height);
  if (!Number.isFinite(h) || h < 100 || h > 250) {
    return '키는 100~250cm 사이여야 합니다.';
  }
  return null;
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
  container: { flexGrow: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, color: '#111' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: '#333', marginBottom: 6, fontWeight: '600' },
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
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
  radioRow: { flexDirection: 'row', gap: 8 },
  radioItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  radioItemSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  radioText: { fontSize: 14, color: '#333' },
  radioTextSelected: { color: '#2563eb', fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: { color: '#666', fontSize: 14 },
  linkSpace: { marginLeft: 4 },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
