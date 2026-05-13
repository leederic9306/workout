import { Link, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

// 마이 탭 진입점 — 체성분/대시보드 진입 카드
export default function MyTabIndex() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '마이', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.list}>
        <Link href="/(tabs)/my/dashboard" style={styles.card}>
          <Text style={styles.cardTitle}>대시보드</Text>
          <Text style={styles.cardDesc}>1RM/체성분/볼륨/빈도 차트</Text>
        </Link>
        <Link href="/(tabs)/my/body" style={styles.card}>
          <Text style={styles.cardTitle}>체성분 기록</Text>
          <Text style={styles.cardDesc}>체중·근육량·체지방률 관리</Text>
        </Link>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardDesc: { fontSize: 13, color: '#6b7280', marginTop: 4 },
});
