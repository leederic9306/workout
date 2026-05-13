# 기술 스택

## 기술 스택 표

| 계층 | 기술 | 버전/플랜 | 비고 |
|------|------|-----------|------|
| **Frontend** | React Native + Expo | SDK 최신 | Android 전용 |
| **상태 관리** | Zustand | 최신 | 전역 클라이언트 상태 |
| **서버 상태** | TanStack Query | 최신 | 서버 상태 + 캐싱 분리 |
| **네비게이션** | Expo Router | 최신 | 파일 기반 라우팅 |
| **Backend** | NestJS | 10 | REST API |
| **Database** | PostgreSQL | 15 | 관계형 데이터 |
| **ORM** | Prisma | 5 | 타입 안전 ORM |
| **인증** | JWT (Access + Refresh) | — | 이메일/소셜 로그인 |
| **소셜 로그인** | Kakao, Google, Apple | — | Passport.js 전략 |
| **푸시 알림** | Expo Push Notifications | — | FCM/APNs 추상화 |
| **배포 (BE)** | Railway | Hobby Plan | NestJS + PostgreSQL |
| **배포 (앱)** | EAS Build | — | APK 직접 배포 |
| **AI** | Anthropic Claude API | Haiku 4.5 | 프로그램 추천/생성 |
| **모니터링** | Sentry | Free tier | 에러 트래킹 |
| **이메일** | Resend | Free tier | 초대 코드, 인증 메일 |
| **모노레포** | Turborepo + pnpm | 최신 | 워크스페이스 관리 |
| **언어** | TypeScript | 5.x | 앱/백엔드 공통 |

---

## 프론트엔드

### React Native + Expo

- **이유**: Android 전용이지만 Expo SDK를 통해 빠른 개발 사이클과 EAS Build로 APK 직접 배포 가능. React Native CLI 대비 환경 설정 오버헤드 최소화.
- **타겟**: Android 전용 (iOS 미지원)
- **배포**: EAS Build로 APK 생성 후 직접 배포 (Google Play 미사용)

### 상태 관리 분리 전략

```
클라이언트 상태 (Zustand)
  - 인증 상태 (토큰, 사용자 정보)
  - 진행 중인 운동 세션 (실시간 세트 입력)
  - 앱 설정 (알림 시간 등)

서버 상태 (TanStack Query)
  - 운동 도감 목록/상세
  - 프로그램 목록
  - 대시보드 데이터
  - AI 추천 결과
```

- **이유**: 전역 상태와 서버 캐시를 명확히 분리하여 불필요한 재렌더링 방지 및 캐싱 전략 단순화.

### Expo Router (파일 기반 라우팅)

- `app/` 디렉토리 구조가 곧 URL/화면 구조
- Route Groups `(auth)`, `(tabs)` 로 레이아웃 분리
- 하단 탭 5개: 홈, 운동, 프로그램, 마이, 관리자(Admin 전용)

### 성능 요구사항

- 주요 화면 응답: 1초 이내
- 세트 입력 반응: 200ms 이내

---

## 백엔드

### NestJS 10

- **이유**: TypeScript 기반의 구조화된 모듈 시스템, Prisma/Passport.js/Schedule 등 생태계 통합 용이. Express 대비 DI 컨테이너와 데코레이터 패턴으로 도메인 경계 명확화.
- **아키텍처**: 모듈 기반 레이어드 아키텍처 (Controller - Service - Repository 패턴)

### 핵심 NestJS 모듈

| 모듈 | 역할 |
|------|------|
| `@nestjs/passport` | Passport.js 전략 통합 (JWT, Kakao, Google) |
| `@nestjs/jwt` | JWT Access/Refresh 토큰 발급 |
| `@nestjs/schedule` | cron 기반 알림 스케줄러 |
| `@nestjs/config` | 환경 변수 관리 |
| `class-validator` | DTO 입력 검증 |
| `@sentry/nestjs` | 에러 트래킹 |

### REST API 설계 원칙

- RESTful 자원 중심 URL 설계
- DTO(Data Transfer Object) 패턴으로 요청/응답 타입 강제
- 전역 `ValidationPipe`로 입력 검증 자동화
- RBAC(Role-Based Access Control) 가드로 권한 분리

---

## 데이터베이스

### PostgreSQL 15

- **이유**: 복잡한 관계형 데이터(사용자-프로그램-세션-세트) 처리에 최적. JSON 컬럼으로 운동 태그 유연 저장, 집계 쿼리(대시보드 차트)에 강점.
- **호스팅**: Railway (백엔드와 동일 플랫폼)

### Prisma 5

- **이유**: TypeScript 타입 안전 ORM으로 schema.prisma가 단일 진실 소스(SSoT). 마이그레이션 자동 생성, IDE 자동완성, 런타임 타입 추론.
- **주요 기능 활용**:
  - `prisma migrate` — 스키마 변경 추적
  - `prisma db seed` — 운동 도감 800+ 초기 데이터 적재
  - `prisma generate` — 타입 자동 생성

### 주요 Prisma 스키마 관계

```
User
  ├── UserProgram (1:N)
  │     └── Program (N:1)
  ├── WorkoutSession (1:N)
  │     └── WorkoutExercise (1:N)
  │           └── WorkoutSet (1:N)
  ├── OneRepMax (1:N)
  ├── BodyComposition (1:N)
  ├── AiUsageLog (1:N)
  └── NotificationSetting (1:1)

Exercise
  ├── ExerciseTag (N:M)
  ├── ExerciseRatio (1:N)
  └── ProgramExercise (1:N)
```

---

## 인증

### JWT 전략

| 토큰 | 유효 기간 | 저장 위치 |
|------|-----------|-----------|
| Access Token | 15분 | 메모리 (AsyncStorage X) |
| Refresh Token | 30일 | SecureStore (Expo) |

- **Refresh Token Rotation**: 갱신 시 이전 토큰 무효화 → 토큰 탈취 피해 최소화
- **시크릿 관리**: JWT_SECRET, JWT_REFRESH_SECRET 환경 변수로 분리

### 소셜 로그인

- **Kakao**: Passport-Kakao 전략, 한국 사용자 주요 플랫폼
- **Google**: Passport-Google-OAuth2 전략
- **Apple**: Passport-Apple 전략 (iOS 미지원이지만 Apple ID 연동 가능성 고려)

### 초대 코드 기반 가입 제한

- Admin이 생성한 초대 코드(InviteCode)를 입력해야만 회원가입 가능
- 코드별 사용 횟수 제한 및 만료일 설정 가능
- 초대 코드 사용 이력 AuditLog 유지

### 보안 설정

- bcrypt 해싱 (saltRounds: 10)
- HTTPS 강제 (Railway 자동 SSL)
- CORS 화이트리스트 설정
- Helmet 미들웨어 (HTTP 헤더 보안)
- PII(개인정보) 응답 미노출 처리

---

## AI 통합

### Anthropic Claude API — Haiku 4.5

- **선택 이유**: 비용 효율성 ($3/월 예산), 빠른 응답 속도, 구조화된 JSON 출력 지원

### AI 모드 및 사용량 제한

| 모드 | 대상 | 월 제한 | 설명 |
|------|------|---------|------|
| **모드 1**: 카탈로그 추천 | 모든 사용자 | 5회 | 기존 카탈로그 중 사용자에게 적합한 프로그램 추천 |
| **모드 2**: 맞춤 프로그램 생성 | Premium/Admin | 10회 | 사용자 데이터 기반 완전 맞춤 프로그램 JSON 생성 |
| **모드 3**: 프로그램 재평가 | Premium/Admin | 10회 | 기존 프로그램 진행 상황 분석 및 조정 제안 |

### AI 응답 처리 파이프라인

```
1. 사용자 데이터 수집 (1RM, 운동 경력, 목표, 가용 기구)
2. Claude Haiku 4.5 API 호출 (구조화 JSON 출력 요청)
3. 응답 검증:
   - JSON 스키마 유효성 검사
   - 운동 ID 존재 여부 확인 (DB 대조)
   - 무게/세트/횟수 합리성 검증
4. AiRecommendation 저장 (이력 관리)
5. AiUsageLog 업데이트 (월별 카운터)
```

### AI 입력 데이터 (프롬프트 컨텍스트)

- 사용자 프로필: 성별, 운동 경력, 1RM 5종
- 현재 활성 프로그램 및 진행 상황
- 가용 기구 목록 (헬스장 환경)
- 운동 목표 (근력 증가, 근비대, 체력 향상)

---

## 외부 데이터 소스

### Free Exercise DB

- **출처**: GitHub의 `yuhonas/free-exercise-db` 오픈소스 데이터셋
- **규모**: 800+ 운동 항목
- **포함 데이터**: 운동명, 설명, 주동근, 협력근, 기구, 카테고리, 이미지/GIF
- **사용 방식**: `prisma db seed`로 초기 적재 후 DB에서 관리

### 운동 분류 체계

| 분류 기준 | 항목 |
|-----------|------|
| **부위** | 가슴, 등, 어깨, 하체, 팔 (이두/삼두), 코어 |
| **기구** | 바벨, 덤벨, 케이블, 머신, 맨몸, 기타 |
| **난이도** | 초급, 중급, 고급 |
| **태그** | 대체 운동 매칭용 (동작 패턴, 근육 동원 패턴) |

---

## 배포 및 인프라

### Railway (Hobby Plan)

- **백엔드**: NestJS 10 컨테이너 배포
- **데이터베이스**: PostgreSQL 15 매니지드 서비스
- **환경 변수**: Railway 대시보드에서 시크릿 관리
- **비용**: $10/월 (BE + DB 합산)

### EAS Build (Expo Application Services)

- **대상**: Android APK 빌드
- **배포 방식**: APK 파일 직접 배포 (Google Play 미사용)
- **이유**: 소규모(5명) 사용자에게 Play Store 정식 등록 과정 불필요
- **빌드 설정**: `eas.json`에 production/preview 프로파일 분리

### Expo Push Notifications

- **역할**: FCM(Android) / APNs(iOS) 추상화 레이어
- **서버 측**: NestJS에서 Expo Push API 호출
- **스케줄러**: NestJS Schedule cron으로 일일 알림 / 공백 알림 발송

### Sentry (에러 트래킹)

- **플랜**: Free tier
- **연동**: `@sentry/nestjs` (백엔드), `@sentry/react-native` (앱)
- **목적**: 프로덕션 에러 자동 수집 및 스택 트레이스 확인

### Resend (이메일)

- **플랜**: Free tier
- **용도**: 초대 코드 발송, 이메일 인증 메일
- **연동**: NestJS 서비스에서 Resend SDK 호출

---

## 비용 설계

월 예산 한도: **$50/월**

| 항목 | 비용 | 설명 |
|------|------|------|
| Railway (BE + DB) | $10/월 | NestJS + PostgreSQL Hobby Plan |
| Anthropic Claude Haiku 4.5 | $3/월 | AI 추천 (~200회/월 기준 추정) |
| 도메인 | $1/월 | 연간 $12 도메인 |
| **합계** | **$14/월** | 예산 대비 72% 여유 |

- EAS Build: Free tier 월 빌드 횟수 내 사용
- Sentry: Free tier (5,000 이벤트/월)
- Resend: Free tier (3,000 이메일/월)
- Expo Push: 무료

---

## 개발 환경

### 필수 도구

| 도구 | 버전 | 용도 |
|------|------|------|
| Node.js | 20 LTS | 런타임 |
| pnpm | 9.x | 패키지 매니저 |
| Turborepo | 최신 | 모노레포 빌드 |
| Android Studio | 최신 | Android 에뮬레이터 |
| Expo CLI | 최신 | 앱 개발 서버 |
| EAS CLI | 최신 | APK 빌드 |
| PostgreSQL | 15 | 로컬 개발 DB |

### 환경 변수 (필수)

```bash
# 백엔드 (.env)
DATABASE_URL=postgresql://...
JWT_SECRET=
JWT_REFRESH_SECRET=
ANTHROPIC_API_KEY=
KAKAO_CLIENT_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
SENTRY_DSN=

# 앱 (.env 또는 app.config.js)
EXPO_PUBLIC_API_URL=
SENTRY_DSN=
```

### 권장 LSP 및 개발 도구 설정

- **TypeScript**: `strict: true` 모드 활성화
- **ESLint**: `@typescript-eslint` + Prettier 통합
- **Prisma Extension**: VS Code Prisma 확장 (스키마 자동완성)
- **REST Client**: `.http` 파일로 API 로컬 테스트

### 로컬 개발 플로우

```bash
# 의존성 설치
pnpm install

# DB 마이그레이션 + 시드 (운동 도감 800+)
cd apps/backend && pnpm prisma migrate dev && pnpm prisma db seed

# 전체 개발 서버 시작 (Turborepo 병렬 실행)
pnpm dev

# 앱만 실행 (Android 에뮬레이터)
pnpm --filter mobile start

# 백엔드만 실행
pnpm --filter backend start:dev
```
