import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { UserRole, type CreateAiProgramRequest } from '@workout/types';
import { AiProgramForm } from '../../../components/programs/AiProgramForm';
import { AiUsageBadge } from '../../../components/programs/AiUsageBadge';
import { useCreateAiProgram } from '../../../hooks/usePrograms';
import { useAuthStore } from '../../../stores/authStore';

// @MX:NOTE: [AUTO] 월간 AI 사용량은 백엔드에서 별도 엔드포인트로 제공되기 전까지 0/10으로 표기
const MONTHLY_LIMIT = 10;

export default function AiCreateScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const createMutation = useCreateAiProgram();
  const [currentUsage] = useState(0);

  const canUseAi = user?.role === UserRole.PREMIUM || user?.role === UserRole.ADMIN;

  if (!canUseAi) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Premium 전용 기능</Text>
        <Text style={styles.errorText}>
          AI 맞춤 프로그램 기능은 Premium 등급에서만 이용할 수 있습니다.
        </Text>
      </View>
    );
  }

  const handleSubmit = (dto: CreateAiProgramRequest) => {
    createMutation.mutate(dto, {
      onSuccess: (program) => {
        router.replace(`/(tabs)/programs/${program.id}`);
      },
      onError: (err) => {
        let message = 'AI 프로그램 생성에 실패했습니다.';
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 403) {
            message = 'Premium 등급에서만 사용 가능한 기능입니다.';
          } else if (status === 429) {
            message = '이번 달 사용 한도를 초과했습니다. 다음 달에 다시 시도해주세요.';
          } else if (status === 422) {
            message = '입력값을 확인해주세요. 장비나 일수를 다시 선택해주세요.';
          } else if (status === 502) {
            message = 'AI 서비스 응답 오류입니다. 잠시 후 다시 시도해주세요.';
          } else if (status === 504 || err.code === 'ECONNABORTED') {
            message = 'AI 생성 시간이 초과되었습니다. 다시 시도해주세요.';
          }
        }
        Alert.alert('생성 실패', message);
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <AiUsageBadge current={currentUsage} limit={MONTHLY_LIMIT} />
      <View style={styles.intro}>
        <Text style={styles.introTitle}>나만의 AI 운동 프로그램</Text>
        <Text style={styles.introText}>
          목표, 운동 일수, 사용 가능한 장비를 알려주시면 AI가 맞춤 프로그램을 생성합니다.
          생성에는 최대 30초가 소요됩니다.
        </Text>
      </View>
      <AiProgramForm loading={createMutation.isPending} onSubmit={handleSubmit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  errorText: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  intro: {
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    marginTop: 4,
    padding: 14,
    borderRadius: 10,
  },
  introTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8', marginBottom: 4 },
  introText: { fontSize: 12, color: '#1e3a8a', lineHeight: 18 },
});
