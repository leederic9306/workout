import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CompoundType, COMPOUND_LABELS_KO } from '@workout/types';
import type { OneRepMaxRecord } from '@workout/types';
import { useUpsertOneRepMax } from '../../hooks/useOneRepMax';

interface OneRepMaxCardProps {
  exerciseType: CompoundType;
  record: OneRepMaxRecord | null;
}

export function OneRepMaxCard({ exerciseType, record }: OneRepMaxCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [input, setInput] = useState(record ? String(record.value) : '');
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertOneRepMax();

  const openModal = () => {
    setInput(record ? String(record.value) : '');
    setError(null);
    setModalVisible(true);
  };

  const handleSave = () => {
    const value = parseFloat(input);
    if (!Number.isFinite(value) || value <= 0) {
      setError('0보다 큰 값을 입력하세요');
      return;
    }
    if (value > 500) {
      setError('최대 500kg까지 입력 가능합니다');
      return;
    }

    upsert.mutate(
      { exerciseType, value },
      {
        onSuccess: () => setModalVisible(false),
        onError: () => setError('저장에 실패했습니다'),
      },
    );
  };

  const label = COMPOUND_LABELS_KO[exerciseType];

  return (
    <>
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.enumName}>{exerciseType}</Text>
          </View>
          <View style={styles.right}>
            <Text style={record ? styles.value : styles.unset}>
              {record ? `${record.value} kg` : '미설정'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={openModal}>
              <Text style={styles.buttonText}>{record ? '편집' : '+ 추가'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label} 1RM 입력</Text>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={(text) => {
                setInput(text);
                setError(null);
              }}
              keyboardType="decimal-pad"
              placeholder="예: 140"
              autoFocus
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
                disabled={upsert.isPending}
              >
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
                disabled={upsert.isPending}
              >
                <Text style={styles.saveText}>
                  {upsert.isPending ? '저장 중...' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600', color: '#111' },
  enumName: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  unset: { fontSize: 14, color: '#9ca3af' },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  buttonText: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#111' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: '#dc2626', marginTop: 8, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
  cancelButton: { backgroundColor: '#f3f4f6' },
  saveButton: { backgroundColor: '#2563eb' },
  cancelText: { color: '#374151', fontSize: 14, fontWeight: '500' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
