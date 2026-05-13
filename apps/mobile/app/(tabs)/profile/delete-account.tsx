// 계정 삭제 화면 (SPEC-USER-001 — DELETE /users/me)
// 2단계 확인: 안내 확인 → 텍스트 입력 확인 → 실제 삭제
import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDeleteMyAccount } from '../../../hooks/useUser';

const CONFIRM_PHRASE = '계정 삭제';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const del = useDeleteMyAccount();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');

  const onFirstConfirm = () => {
    Alert.alert(
      '정말 계정을 삭제하시겠습니까?',
      '삭제 후에는 모든 세션이 종료되고 로그인할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '계속', style: 'destructive', onPress: () => setStep(2) },
      ],
    );
  };

  const onFinalDelete = () => {
    if (confirmText !== CONFIRM_PHRASE) {
      Alert.alert('확인 실패', `"${CONFIRM_PHRASE}"를 정확히 입력해 주세요.`);
      return;
    }
    del.mutate(undefined, {
      onSuccess: () => {
        Alert.alert('완료', '계정이 삭제되었습니다.');
        // useDeleteMyAccount 가 logout 호출 → _layout 이 인증 화면으로 라우팅
      },
      onError: (err) => {
        Alert.alert('오류', err.message);
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>계정 삭제</Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>주의</Text>
        <Text style={styles.warningText}>
          - 계정이 삭제되면 모든 세션이 즉시 종료됩니다.{'\n'}
          - 더 이상 로그인할 수 없으며, 같은 이메일로 재가입은 별도 정책에
          따릅니다.{'\n'}- 운동 기록과 즐겨찾기는 보관 정책에 따라 처리됩니다.
        </Text>
      </View>

      {step === 1 ? (
        <TouchableOpacity style={styles.deleteBtn} onPress={onFirstConfirm}>
          <Text style={styles.deleteText}>계정 삭제 시작</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Text style={styles.label}>
            확인을 위해 아래에 "{CONFIRM_PHRASE}"를 입력해 주세요.
          </Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={CONFIRM_PHRASE}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.deleteBtn, del.isPending && styles.disabled]}
            onPress={onFinalDelete}
            disabled={del.isPending}
          >
            <Text style={styles.deleteText}>
              {del.isPending ? '삭제 중...' : '영구 삭제'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>취소</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24, color: '#dc2626' },
  warningBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: { fontSize: 14, fontWeight: '700', color: '#dc2626', marginBottom: 6 },
  warningText: { fontSize: 13, color: '#7f1d1d', lineHeight: 20 },
  label: { fontSize: 14, color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
    marginBottom: 16,
  },
  deleteBtn: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  cancelBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#6b7280', fontSize: 14 },
});
