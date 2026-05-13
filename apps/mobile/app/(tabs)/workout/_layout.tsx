import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '운동 도감' }} />
      <Stack.Screen name="[id]" options={{ title: '운동 상세' }} />
    </Stack>
  );
}
