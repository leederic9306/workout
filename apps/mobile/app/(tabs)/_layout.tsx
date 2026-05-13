import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="workout" options={{ title: '운동 도감', tabBarIcon: () => null }} />
      <Tabs.Screen name="programs" options={{ title: '프로그램', tabBarIcon: () => null }} />
      <Tabs.Screen name="record" options={{ title: '운동 기록', tabBarIcon: () => null }} />
      <Tabs.Screen name="profile" options={{ title: '마이페이지', tabBarIcon: () => null }} />
      <Tabs.Screen name="my" options={{ title: '마이', tabBarIcon: () => null }} />
    </Tabs>
  );
}
