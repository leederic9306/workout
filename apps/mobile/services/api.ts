// Axios 인스턴스 및 인증 인터셉터
// - 요청 시 Access Token을 Authorization 헤더에 주입
// - 401 응답 시 Refresh Token으로 토큰 갱신 후 재시도 (동시 요청 경합 방지)
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/authStore';

const REFRESH_TOKEN_KEY = 'refresh_token';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// @MX:ANCHOR: [AUTO] 모든 인증 호출의 단일 HTTP 게이트웨이
// @MX:REASON: services/auth.ts와 향후 도메인 서비스들이 공통 인스턴스로 사용 (fan_in >= 3)
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// 인터셉터에서 사용할 토큰 갱신 함수 (순환 의존 방지 목적)
let refreshTokenFn:
  | ((refreshToken: string) => Promise<{ accessToken: string; refreshToken: string } | null>)
  | null = null;

export function registerRefreshHandler(
  fn: (refreshToken: string) => Promise<{ accessToken: string; refreshToken: string } | null>,
) {
  refreshTokenFn = fn;
}

// Request 인터셉터: Access Token 주입
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// @MX:WARN: [AUTO] 동시 401 응답 경합 처리 — isRefreshing 플래그 + pending 큐로 단일 refresh 보장
// @MX:REASON: 다중 동시 요청이 401을 받으면 각자 refresh를 호출해 토큰 충돌이 발생할 수 있음
let isRefreshing = false;
type PendingRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};
const pendingQueue: PendingRequest[] = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error || !token) reject(error);
    else resolve(token);
  });
  pendingQueue.length = 0;
}

interface RetriableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

// Response 인터셉터: 401 자동 처리
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    // 토큰 갱신 자체에서 401이 난 경우는 즉시 로그아웃 처리
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshCall
    ) {
      if (isRefreshing) {
        // 이미 refresh 중이면 큐에 대기
        return new Promise<string>((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest._retry = true;
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>).Authorization =
                `Bearer ${newToken}`;
            }
            return api.request(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken || !refreshTokenFn) {
          throw new Error('No refresh token available');
        }

        const result = await refreshTokenFn(refreshToken);
        if (!result) {
          throw new Error('Refresh failed');
        }

        // 새 토큰 적용
        await useAuthStore
          .getState()
          .setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });

        flushQueue(null, result.accessToken);

        // 원래 요청 재시도
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>).Authorization =
            `Bearer ${result.accessToken}`;
        }
        return api.request(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        // 갱신 실패 시 로그아웃 처리 — 화면 전환은 _layout.tsx의 상태 감지로 처리
        await useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
