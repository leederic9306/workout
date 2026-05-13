import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface FavoriteButtonProps {
  isFavorite: boolean;
  isLoading?: boolean;
  onPress: () => void;
}

export function FavoriteButton({ isFavorite, isLoading, onPress }: FavoriteButtonProps) {
  return (
    <TouchableOpacity style={[styles.btn, isFavorite && styles.btnActive]} onPress={onPress} disabled={isLoading}>
      {isLoading ? (
        <ActivityIndicator size="small" color={isFavorite ? '#fff' : '#ef4444'} />
      ) : (
        <Text style={[styles.text, isFavorite && styles.textActive]}>
          {isFavorite ? '♥ 즐겨찾기 해제' : '♡ 즐겨찾기'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
    marginTop: 16,
  },
  btnActive: {
    backgroundColor: '#ef4444',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  textActive: {
    color: '#fff',
  },
});
