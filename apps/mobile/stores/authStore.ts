// 인증 상태 관리 Zustand 스토어
// Access Token은 메모리(state)에만 보관하고, Refresh Token은 SecureStore에 영속화한다.
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { UserRole } from '@workout/types';

const REFRESH_TOKEN_KEY = 'refresh_token';

export interface UserInfo {
  id: string;
  email: string;
  nickname?: string;
  role: UserRole;
  onboardingCompleted: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isOnboardingCompleted: boolean;
  isInitializing: boolean;

  setTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  setUser: (user: UserInfo) => void;
  clearAccessToken: () => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  getAccessToken: () => string | null;
  getRefreshToken: () => Promise<string | null>;
}

// @MX:ANCHOR: [AUTO] 앱 전역 인증 상태 진입점 (services/api.ts 인터셉터에서 참조)
// @MX:REASON: 다수의 services/auth.ts, services/api.ts, app/_layout.tsx, 화면 컴포넌트가 직접 의존 (fan_in >= 3)
export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isOnboardingCompleted: false,
  isInitializing: true,

  setTokens: async ({ accessToken, refreshToken }) => {
    // Refresh Token은 SecureStore에 안전하게 저장
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, isAuthenticated: true });
  },

  setUser: (user) => {
    set({
      user,
      isAuthenticated: true,
      isOnboardingCompleted: user.onboardingCompleted,
    });
  },

  clearAccessToken: () => {
    set({ accessToken: null });
  },

  logout: async () => {
    // SecureStore의 Refresh Token 삭제 및 메모리 상태 초기화
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      // 키가 없어도 무시
    }
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isOnboardingCompleted: false,
    });
  },

  initialize: async () => {
    // 앱 시작 시 SecureStore에서 Refresh Token을 읽어 자동 로그인 시도
    set({ isInitializing: true });
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        set({ isInitializing: false });
        return;
      }

      // 동적 import로 순환 의존성 방지 (api.ts가 authStore를 임포트하므로)
      const { refreshAccessToken } = await import('../services/auth');
      const result = await refreshAccessToken(refreshToken);
      if (result) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
        set({
          accessToken: result.accessToken,
          user: result.user,
          isAuthenticated: true,
          isOnboardingCompleted: result.user.onboardingCompleted,
        });
      } else {
        // 토큰 갱신 실패 → 로그아웃 상태로 진입
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch {
      // 네트워크 오류 등은 무시하고 비로그인 상태로 진행
    } finally {
      set({ isInitializing: false });
    }
  },

  getAccessToken: () => get().accessToken,

  getRefreshToken: async () => {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
}));
