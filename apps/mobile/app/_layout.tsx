// 루트 레이아웃 — QueryClient 제공 + 인증 상태 기반 라우팅 가드
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const initialize = useAuthStore((s) => s.initialize);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnboardingCompleted = useAuthStore((s) => s.isOnboardingCompleted);

  // 앱 시작 시 SecureStore에서 Refresh Token 복원 시도
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 인증 상태 변화에 따른 라우팅 가드
  useEffect(() => {
    if (isInitializing) return;

    const inAuthGroup = segments[0] === '(auth)';
    const currentRoute = segments[1];

    if (!isAuthenticated) {
      // 미인증 → auth 그룹으로 강제 이동
      if (!inAuthGroup) {
        router.replace('/login');
      }
      return;
    }

    // 인증되었지만 온보딩 미완료 → onboarding 으로
    if (!isOnboardingCompleted) {
      if (currentRoute !== 'onboarding') {
        router.replace('/onboarding');
      }
      return;
    }

    // 모두 완료된 사용자가 auth 그룹에 머물러 있으면 홈으로
    if (inAuthGroup) {
      router.replace('/');
    }
  }, [isInitializing, isAuthenticated, isOnboardingCompleted, segments, router]);

  if (isInitializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
