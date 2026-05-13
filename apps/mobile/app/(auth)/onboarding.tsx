// 온보딩 화면 — 소셜 로그인 등 신체 정보가 누락된 사용자가 채우는 보조 화면
// 백엔드 PATCH /auth/onboarding 호출 후 user.onboardingCompleted 를 true 로 갱신
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
import { router } from 'expo-router';
import { Gender, ExperienceLevel } from '@workout/types';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface OnboardingPayload {
  nickname: string;
  gender: Gender;
  birthDate: string;
  height: number;
  experienceLevel: ExperienceLevel;
}

export default function OnboardingScreen() {
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    ExperienceLevel.BEGINNER,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: OnboardingPayload = {
        nickname: nickname.trim(),
        gender,
        birthDate,
        height: Number(height),
        experienceLevel,
      };
      await api.patch('/auth/onboarding', payload);
    },
    onSuccess: () => {
      if (user) {
        setUser({ ...user, nickname: nickname.trim(), onboardingCompleted: true });
      }
      router.replace('/');
    },
    onError: (err: unknown) => {
      setErrorMessage(extractErrorMessage(err, '온보딩 정보를 저장하지 못했습니다.'));
    },
  });

  const handleSubmit = () => {
    setErrorMessage(null);
    const error = validate({ nickname, birthDate, height });
    if (error) {
      setErrorMessage(error);
      return;
    }
    submitMutation.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>프로필 설정</Text>
        <Text style={styles.subtitle}>맞춤 운동을 위해 기본 정보를 입력해주세요.</Text>

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

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, submitMutation.isPending && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="완료"
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>시작하기</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

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

function validate(input: { nickname: string; birthDate: string; height: string }): string | null {
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
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 8, color: '#111' },
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
});
