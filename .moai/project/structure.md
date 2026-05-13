# 프로젝트 구조

## 아키텍처 개요

모바일 클라이언트 - REST API 서버 - PostgreSQL 데이터베이스의 **3계층 구조**로 구성된다.

```
┌─────────────────────────────────┐
│  Mobile Client (Android)        │
│  React Native + Expo SDK        │
│  Zustand + TanStack Query       │
└────────────────┬────────────────┘
                 │ REST API (HTTPS)
┌────────────────▼────────────────┐
│  Backend Server                 │
│  NestJS 10                      │
│  Railway Hobby Plan             │
└────────────────┬────────────────┘
                 │ Prisma ORM
┌────────────────▼────────────────┐
│  Database                       │
│  PostgreSQL 15                  │
│  Railway (같은 플랫폼)            │
└─────────────────────────────────┘
```

외부 서비스 연동:
- **Anthropic API**: Claude Haiku 4.5 AI 추천 기능
- **Expo Push Notifications**: FCM/APNs 추상화 푸시 알림
- **Resend**: 초대 코드 및 인증 이메일
- **Sentry (Free tier)**: 에러 트래킹 및 모니터링

---

## 모노레포 구조 (Turborepo + pnpm)

```
workout/                          # 프로젝트 루트
├── apps/
│   ├── mobile/                   # React Native + Expo 앱 (Android)
│   └── backend/                  # NestJS 10 REST API 서버
├── packages/
│   ├── types/                    # 공유 TypeScript 타입 정의
│   ├── utils/                    # 공유 유틸리티 함수
│   └── constants/                # 공유 상수 (운동 태그, 근육 부위 등)
├── .moai/                        # MoAI 프로젝트 설정
│   ├── project/                  # 프로젝트 문서
│   ├── specs/                    # SPEC 문서
│   └── config/                   # MoAI 설정
├── .claude/                      # Claude Code 설정
├── turbo.json                    # Turborepo 파이프라인 설정
├── pnpm-workspace.yaml           # pnpm 워크스페이스 설정
├── package.json                  # 루트 패키지 설정
└── .env.example                  # 환경 변수 템플릿
```

---

## apps/mobile 구조

React Native + Expo (SDK 최신) 기반 Android 전용 앱.

```
apps/mobile/
├── app/                          # Expo Router 파일 기반 라우팅
│   ├── (auth)/                   # 인증 관련 화면 그룹
│   │   ├── login.tsx             # 로그인 화면
│   │   ├── register.tsx          # 회원가입 (초대 코드 입력)
│   │   └── onboarding.tsx        # 온보딩 (신체 정보 입력)
│   ├── (tabs)/                   # 하단 탭 네비게이션
│   │   ├── index.tsx             # [홈] 탭 - 오늘의 운동, 대시보드 요약
│   │   ├── workout/              # [운동] 탭
│   │   │   ├── index.tsx         # 운동 도감 목록
│   │   │   ├── [id].tsx          # 운동 상세
│   │   │   └── session/          # 운동 세션
│   │   │       ├── index.tsx     # 세션 시작
│   │   │       └── [sessionId].tsx # 세션 진행 화면
│   │   ├── program/              # [프로그램] 탭
│   │   │   ├── index.tsx         # 프로그램 목록 (카탈로그 + 내 프로그램)
│   │   │   ├── [id].tsx          # 프로그램 상세
│   │   │   └── ai-create.tsx     # AI 맞춤 프로그램 생성 (Premium)
│   │   ├── my/                   # [마이] 탭
│   │   │   ├── index.tsx         # 마이페이지 메인
│   │   │   ├── dashboard.tsx     # 대시보드 (4종 차트)
│   │   │   ├── records.tsx       # 운동 기록 (캘린더/리스트)
│   │   │   ├── 1rm.tsx           # 1RM 관리
│   │   │   └── body.tsx          # 체성분 기록
│   │   └── admin/                # [관리자] 탭 (Admin 전용)
│   │       ├── index.tsx         # 관리자 메인
│   │       ├── users.tsx         # 사용자 관리
│   │       ├── invite-codes.tsx  # 초대 코드 관리
│   │       └── ai-usage.tsx      # AI 사용량 모니터링
│   ├── _layout.tsx               # 루트 레이아웃
│   └── +not-found.tsx            # 404 화면
├── components/                   # 재사용 UI 컴포넌트
│   ├── common/                   # 공통 컴포넌트 (Button, Input, Card 등)
│   ├── workout/                  # 운동 관련 컴포넌트
│   │   ├── ExerciseCard.tsx      # 운동 카드
│   │   ├── SetRow.tsx            # 세트 입력 행
│   │   ├── RestTimer.tsx         # 휴식 타이머
│   │   └── PlateCalculator.tsx   # 플레이트 계산기
│   ├── program/                  # 프로그램 관련 컴포넌트
│   └── charts/                   # 차트 컴포넌트 (1RM, 체성분, 볼륨, 빈도)
├── stores/                       # Zustand 전역 상태
│   ├── authStore.ts              # 인증 상태 (토큰, 사용자 정보)
│   ├── sessionStore.ts           # 진행 중인 운동 세션 상태
│   └── settingsStore.ts          # 앱 설정 (알림 시간 등)
├── services/                     # TanStack Query + API 호출
│   ├── api.ts                    # Axios 인스턴스 + 인터셉터
│   ├── auth.ts                   # 인증 API
│   ├── exercises.ts              # 운동 도감 API
│   ├── programs.ts               # 프로그램 API
│   ├── sessions.ts               # 운동 세션 API
│   ├── users.ts                  # 사용자 데이터 API
│   ├── dashboard.ts              # 대시보드 API
│   └── ai.ts                     # AI 추천 API
├── hooks/                        # 커스텀 훅
│   ├── useAuth.ts                # 인증 훅
│   ├── useSession.ts             # 세션 관리 훅
│   └── useTimer.ts               # 타이머 훅
├── constants/                    # 앱 상수
│   └── colors.ts                 # 색상 팔레트
├── utils/                        # 유틸리티 함수
│   ├── 1rm.ts                    # Epley/Brzycki 공식
│   └── volume.ts                 # 볼륨 계산
├── app.json                      # Expo 설정
├── eas.json                      # EAS Build 설정
└── package.json
```

---

## apps/backend 구조

NestJS 10 기반 REST API 서버.

```
apps/backend/
├── src/
│   ├── app.module.ts             # 루트 모듈
│   ├── main.ts                   # 진입점 (포트 설정, CORS, Helmet)
│   ├── auth/                     # 인증 모듈
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts    # POST /auth/*
│   │   ├── auth.service.ts       # JWT 발급, 소셜 로그인 처리
│   │   ├── strategies/           # Passport 전략 (JWT, Kakao, Google)
│   │   ├── guards/               # JwtAuthGuard, RolesGuard
│   │   └── decorators/           # @Roles(), @CurrentUser()
│   ├── users/                    # 사용자 모듈
│   │   ├── users.module.ts
│   │   ├── users.controller.ts   # GET/PATCH /users/me/*
│   │   └── users.service.ts
│   ├── exercises/                # 운동 도감 모듈
│   │   ├── exercises.module.ts
│   │   ├── exercises.controller.ts # GET /exercises/*
│   │   └── exercises.service.ts
│   ├── programs/                 # 프로그램 모듈
│   │   ├── programs.module.ts
│   │   ├── programs.controller.ts # GET/POST /programs/*
│   │   └── programs.service.ts
│   ├── workout-sessions/         # 운동 세션 모듈
│   │   ├── workout-sessions.module.ts
│   │   ├── workout-sessions.controller.ts # /workout-sessions/*
│   │   └── workout-sessions.service.ts
│   ├── dashboard/                # 대시보드 모듈
│   │   ├── dashboard.module.ts
│   │   ├── dashboard.controller.ts # GET /dashboard/*
│   │   └── dashboard.service.ts
│   ├── ai/                       # AI 추천 모듈
│   │   ├── ai.module.ts
│   │   ├── ai.controller.ts      # POST /ai/recommendations/*
│   │   ├── ai.service.ts         # Claude Haiku 4.5 연동
│   │   └── ai.validator.ts       # JSON 스키마 검증, 운동 ID 존재 확인
│   ├── notifications/            # 알림 모듈
│   │   ├── notifications.module.ts
│   │   ├── notifications.service.ts # Expo Push 발송
│   │   └── notifications.scheduler.ts # NestJS Schedule cron
│   ├── admin/                    # 관리자 모듈
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts   # /admin/*
│   │   └── admin.service.ts
│   ├── prisma/                   # Prisma 모듈
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts     # PrismaClient 싱글톤
│   └── common/                   # 공통 모듈
│       ├── filters/              # 전역 예외 필터
│       ├── interceptors/         # 응답 변환 인터셉터
│       ├── pipes/                # ValidationPipe
│       └── decorators/
├── prisma/
│   ├── schema.prisma             # Prisma 스키마 (전체 데이터 모델)
│   ├── migrations/               # 마이그레이션 파일
│   └── seed.ts                   # 운동 도감 시드 데이터 (800+)
├── test/                         # E2E 테스트
├── .env                          # 환경 변수 (gitignore)
├── .env.example                  # 환경 변수 템플릿
├── nest-cli.json
└── package.json
```

---

## 공유 패키지 (packages/)

```
packages/
├── types/                        # 공유 TypeScript 타입
│   ├── src/
│   │   ├── user.ts               # User, Role 타입
│   │   ├── exercise.ts           # Exercise, MuscleGroup 타입
│   │   ├── program.ts            # Program, ProgramDay 타입
│   │   ├── session.ts            # WorkoutSession, WorkoutSet 타입
│   │   ├── ai.ts                 # AI 추천 요청/응답 타입
│   │   └── index.ts              # 전체 export
│   ├── package.json
│   └── tsconfig.json
├── utils/                        # 공유 유틸리티
│   ├── src/
│   │   ├── 1rm.ts                # Epley/Brzycki 공식 (앱/백엔드 공유)
│   │   ├── volume.ts             # 볼륨 계산 (세트 x 반복 x 무게)
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
└── constants/                    # 공유 상수
    ├── src/
    │   ├── muscle-groups.ts      # 근육 부위 목록 (가슴, 등, 어깨 등)
    │   ├── equipment.ts          # 기구 목록 (바벨, 덤벨, 케이블 등)
    │   ├── exercise-tags.ts      # 운동 태그 (대체 운동 매칭용)
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

---

## 주요 모듈/도메인 경계

| 도메인 | 위치 | 설명 |
|--------|------|------|
| **Auth** | backend/auth | 인증/인가 — JWT 발급, 소셜 로그인, RBAC 가드 |
| **Exercise** | backend/exercises | 운동 도감 — 800+ 운동 CRUD, 필터, 검색 |
| **Program** | backend/programs | 운동 프로그램 — 카탈로그 6종, 사용자 프로그램 관리 |
| **Session** | backend/workout-sessions | 운동 세션 — 세트 기록, PR 감지, 볼륨 계산 |
| **Dashboard** | backend/dashboard | 통계/시각화 — 1RM 이력, 체성분, 볼륨, 빈도 데이터 |
| **AI** | backend/ai | AI 추천 — Claude Haiku 4.5 연동, 사용량 제한, 응답 검증 |
| **Notification** | backend/notifications | 알림 — Expo Push, cron 스케줄러 |
| **Admin** | backend/admin | 관리자 — 사용자/초대코드/AI 사용량 관리 |

---

## API 엔드포인트 구조

```
/auth/*               - 인증 (로그인, 회원가입, 토큰 갱신, 소셜 로그인)
/exercises/*          - 운동 도감 (목록, 상세, 검색, 필터)
/programs/*           - 프로그램 (카탈로그, 내 프로그램, 활성화)
/workout-sessions/*   - 운동 세션 (시작, 세트 기록, 완료)
/users/me/*           - 개인 데이터 (1RM, 체성분, AI 사용량, 알림 설정)
/dashboard/*          - 대시보드 데이터 (차트용 집계 데이터)
/ai/recommendations/* - AI 추천 (카탈로그 추천, 맞춤 생성, 재평가)
/admin/*              - 관리자 기능 (사용자, 초대코드, AI 모니터링)
```

---

## 주요 데이터 엔티티

```
User                  - 사용자 (프로필, 권한, 온보딩 정보)
InviteCode            - 초대 코드 (생성/사용 이력)
Exercise              - 운동 도감 항목 (이미지, 근육, 기구, 태그)
ExerciseTag           - 운동 태그 (대체 운동 매칭용)
ExerciseRatio         - 근육 동원 비율
Program               - 운동 프로그램 (카탈로그 또는 맞춤)
ProgramDay            - 프로그램 요일
ProgramExercise       - 프로그램 내 운동 항목
UserProgram           - 사용자-프로그램 연결 (활성 프로그램)
WorkoutSession        - 운동 세션 (날짜, 완료 여부)
WorkoutExercise       - 세션 내 운동 항목
WorkoutSet            - 세트 기록 (무게, 횟수, RPE, 휴식 시간)
OneRepMax             - 1RM 이력 (컴파운드 5종 + 추정값)
BodyComposition       - 체성분 기록 (몸무게, 골격근량, 체지방)
NotificationSetting   - 알림 설정 (시간, 공백 기준)
DeviceToken           - Expo Push 디바이스 토큰
AiRecommendation      - AI 추천 결과 이력
AiUsageLog            - AI 사용량 로그 (월별 제한 추적)
RoleChangeLog         - 권한 변경 이력 (Admin 감사 로그)
```
