// 세트 추가 모달
// 카테고리가 'cardio'면 duration(초) 입력, 그 외에는 reps + weight 입력
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAddSet } from '../../hooks/useWorkouts';

interface AddSetModalProps {
  visible: boolean;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: string;
  nextSetNumber: number;
  onClose: () => void;
}

export function AddSetModal({
  visible,
  sessionId,
  exerciseId,
  exerciseName,
  exerciseCategory,
  nextSetNumber,
  onClose,
}: AddSetModalProps) {
  const isCardio = exerciseCategory === 'cardio';
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addSetMutation = useAddSet(sessionId);

  const reset = () => {
    setReps('');
    setWeight('');
    setDuration('');
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    if (isCardio) {
      const d = parseInt(duration, 10);
      if (!d || d <= 0) {
        setError('시간(초)을 입력해주세요.');
        return;
      }
      addSetMutation.mutate(
        { exerciseId, setNumber: nextSetNumber, duration: d },
        {
          onSuccess: () => {
            reset();
            onClose();
          },
          onError: () => setError('세트 추가에 실패했습니다.'),
        },
      );
    } else {
      const r = parseInt(reps, 10);
      const w = weight ? parseFloat(weight) : 0;
      if (!r || r <= 0) {
        setError('횟수를 입력해주세요.');
        return;
      }
      addSetMutation.mutate(
        { exerciseId, setNumber: nextSetNumber, reps: r, weight: w },
        {
          onSuccess: () => {
            reset();
            onClose();
          },
          onError: () => setError('세트 추가에 실패했습니다.'),
        },
      );
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{exerciseName}</Text>
          <Text style={styles.subtitle}>{nextSetNumber}세트 추가</Text>

          {isCardio ? (
            <View style={styles.field}>
              <Text style={styles.label}>시간 (초)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={duration}
                onChangeText={setDuration}
                placeholder="예: 60"
                placeholderTextColor="#9ca3af"
              />
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>횟수 (회)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={reps}
                  onChangeText={setReps}
                  placeholder="예: 10"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>무게 (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="예: 20 (선택)"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={addSetMutation.isPending}
            >
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={addSetMutation.isPending}
            >
              {addSetMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>저장</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 16 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  error: { color: '#dc2626', fontSize: 13, marginTop: 4, marginBottom: 4 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { backgroundColor: '#f3f4f6' },
  saveButton: { backgroundColor: '#2563eb' },
  cancelText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
