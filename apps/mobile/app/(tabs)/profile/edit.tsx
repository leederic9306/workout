// 프로필 편집 화면 (SPEC-USER-001 — PATCH /users/me/profile)
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ExperienceLevel,
  Gender,
  type UpdateProfilePayload,
} from '@workout/types';
import { useMe, useUpdateMyProfile } from '../../../hooks/useUser';

const GENDER_OPTIONS: Gender[] = [Gender.MALE, Gender.FEMALE, Gender.OTHER];
const EXPERIENCE_OPTIONS: ExperienceLevel[] = [
  ExperienceLevel.BEGINNER,
  ExperienceLevel.INTERMEDIATE,
  ExperienceLevel.ADVANCED,
];

export default function ProfileEditScreen() {
  const router = useRouter();
  const { data: profile, isLoading } = useMe();
  const update = useUpdateMyProfile();

  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel | null>(null);

  useEffect(() => {
    if (!profile) return;
    setNickname(profile.nickname ?? '');
    setGender(profile.gender);
    setBirthDate(profile.birthDate ? profile.birthDate.split('T')[0] : '');
    setHeight(profile.height !== null ? String(profile.height) : '');
    setExperienceLevel(profile.experienceLevel);
  }, [profile]);

  if (isLoading || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const onSave = () => {
    const payload: UpdateProfilePayload = {};
    if (nickname && nickname !== profile.nickname) payload.nickname = nickname;
    if (gender && gender !== profile.gender) payload.gender = gender;
    if (birthDate && birthDate !== (profile.birthDate?.split('T')[0] ?? '')) {
      // ISO 형식으로 변환
      payload.birthDate = new Date(birthDate).toISOString();
    }
    const heightNum = Number(height);
    if (
      height &&
      !Number.isNaN(heightNum) &&
      heightNum !== profile.height
    ) {
      payload.height = heightNum;
    }
    if (experienceLevel && experienceLevel !== profile.experienceLevel) {
      payload.experienceLevel = experienceLevel;
    }

    if (Object.keys(payload).length === 0) {
      Alert.alert('변경 사항 없음', '수정할 내용이 없습니다.');
      return;
    }

    update.mutate(payload, {
      onSuccess: () => {
        Alert.alert('완료', '프로필이 업데이트되었습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      },
      onError: (err) => {
        Alert.alert('오류', err.message);
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>프로필 수정</Text>

      <Text style={styles.label}>닉네임 (2~20자)</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="닉네임"
        maxLength={20}
      />

      <Text style={styles.label}>성별</Text>
      <View style={styles.choiceRow}>
        {GENDER_OPTIONS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.choice, gender === g && styles.choiceActive]}
            onPress={() => setGender(g)}
          >
            <Text
              style={[
                styles.choiceText,
                gender === g && styles.choiceTextActive,
              ]}
            >
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>생년월일 (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder="1990-01-01"
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>키 (cm, 100~250)</Text>
      <TextInput
        style={styles.input}
        value={height}
        onChangeText={setHeight}
        placeholder="180"
        keyboardType="numeric"
      />

      <Text style={styles.label}>운동 경험</Text>
      <View style={styles.choiceRow}>
        {EXPERIENCE_OPTIONS.map((e) => (
          <TouchableOpacity
            key={e}
            style={[
              styles.choice,
              experienceLevel === e && styles.choiceActive,
            ]}
            onPress={() => setExperienceLevel(e)}
          >
            <Text
              style={[
                styles.choiceText,
                experienceLevel === e && styles.choiceTextActive,
              ]}
            >
              {e}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, update.isPending && styles.disabled]}
        onPress={onSave}
        disabled={update.isPending}
      >
        <Text style={styles.saveText}>
          {update.isPending ? '저장 중...' : '저장'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>취소</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#111' },
  label: { fontSize: 14, color: '#374151', marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
  },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  choiceActive: { borderColor: '#2563eb', backgroundColor: '#dbeafe' },
  choiceText: { color: '#6b7280', fontSize: 13 },
  choiceTextActive: { color: '#2563eb', fontWeight: '600' },
  saveBtn: {
    marginTop: 32,
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  cancelBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#6b7280', fontSize: 14 },
});
