import { Stack } from 'expo-router';

export default function ProgramsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '운동 프로그램' }} />
      <Stack.Screen name="active" options={{ title: '활성 프로그램' }} />
      <Stack.Screen name="ai-create" options={{ title: 'AI 프로그램 생성' }} />
      <Stack.Screen name="[id]" options={{ title: '프로그램 상세' }} />
    </Stack>
  );
}
