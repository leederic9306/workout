---
id: SPEC-AUTH-001
version: "1.0.1"
status: draft
created: "2026-05-11"
updated: "2026-05-11"
author: leederic9306
priority: high
issue_number: 0
---

# SPEC-AUTH-001: 인증 및 권한 관리 시스템

## HISTORY

- 2026-05-11 v1.0.1 (draft): plan-auditor 1차 감사 결과 반영. JWT payload에 onboardingCompleted 추가, 추적성 매트릭스 REQ-AUTH-JWT-007 행 추가, AC-RBAC-01/AC-RBAC-03 분리, 온보딩 인라인 플로우 명확화.
- 2026-05-11 v1.0.0 (draft): 초기 작성 (leederic9306). PRD v1.4 Section 3.1 및 Section 8.2를 기반으로 초대 코드 가입 제한, JWT 인증, RBAC(Admin/Premium/User), 소셜 로그인(Kakao/Google), 온보딩 요구사항을 EARS 형식으로 정의.

---

## 1. 개요 (Overview)

근력 운동 트래커 앱의 **인증 및 권한 관리 시스템**을 정의한다. 본 SPEC은 비공개 소규모 사용자(약 5명, 개인 및 지인)를 대상으로 한 초대 기반 가입 통제, JWT 기반 무상태 인증, 세 단계 역할(Admin / Premium / User)에 따른 기능 게이팅을 다룬다.

### 핵심 가치

- **가입 통제**: Admin이 발급한 초대 코드를 통해서만 신규 가입을 허용하여 비공개 운영을 보장한다.
- **무상태 인증**: JWT Access Token(15분) + Refresh Token(30일, Rotation 적용)으로 모바일 클라이언트의 세션 부담을 줄인다.
- **권한 분리**: RBAC를 통해 무료 기능(User), 유료 AI 기능(Premium), 운영 기능(Admin)을 명확히 분리한다.
- **온보딩 데이터 수집**: 최초 가입 시 신체 정보(성별, 생년월일, 키)와 운동 경력 수준을 수집하여 AI 추천 입력값을 확보한다.
- **감사 추적성**: 권한 변경 이력을 `RoleChangeLog`로 보존하여 운영 책임을 명확히 한다.

### 범위

본 SPEC은 백엔드(NestJS 10) 측 인증 모듈, Prisma 스키마(User, InviteCode, RoleChangeLog), `POST /auth/*` API 엔드포인트, 모바일 클라이언트의 토큰 저장 및 갱신 동작을 포괄한다. 사용자 프로필 조회/수정(`/users/me/*`)과 Admin의 초대 코드 발급/사용자 관리 UI는 별도 SPEC(SPEC-USER-XXX, SPEC-ADMIN-XXX)에서 다룬다.

---

## 2. 목표와 비목표 (Goals & Non-Goals)

### 2.1 목표 (Goals)

1. 초대 코드 없이는 회원가입이 불가능하도록 강제한다.
2. 이메일 + 비밀번호 가입 및 Kakao/Google OAuth 소셜 로그인을 모두 지원한다.
3. Access Token 15분 / Refresh Token 30일 만료 및 Refresh Token Rotation을 적용한다.
4. JWT payload에 `role`을 포함하여 클라이언트 UI 분기를 가능하게 한다.
5. RBAC 가드(`@Roles()`)를 통해 권한별 API 접근을 제어한다.
6. Admin만 사용자 권한을 변경할 수 있으며, 모든 변경은 `RoleChangeLog`에 기록한다.
7. 최초 가입 시 온보딩 단계를 통해 닉네임/성별/생년월일/키/운동 경력 수준을 수집한다.
8. 비밀번호는 bcrypt(cost 10)로 해싱하고, Refresh Token은 DB에 hash 저장한다.

### 2.2 비목표 (Non-Goals)

- Apple OAuth는 본 SPEC 범위에서 제외한다(iOS 미지원, PRD 3.1.1).
- 비밀번호 재설정 플로우(이메일 토큰 기반)는 본 SPEC에서 제외하며, 후속 SPEC에서 다룬다.
- 2단계 인증(2FA), TOTP, 생체 인증은 다루지 않는다.
- 다중 디바이스 세션 관리(디바이스별 Refresh Token 추적)는 단순화한다(사용자당 최신 Refresh Token 1개만 유효).
- 초대 코드 발급/만료/회수 등 운영 UI는 SPEC-ADMIN-XXX에서 다룬다.
- 사용자 탈퇴(계정 삭제) 플로우는 본 SPEC 범위 밖이다.

---

## 3. EARS 요구사항 (Requirements)

### 3.1 REQ-AUTH-INVITE: 초대 코드 시스템

**REQ-AUTH-INVITE-001** (Ubiquitous)
시스템은 신규 사용자 회원가입 요청 시 유효한 초대 코드 입력을 요구해야 한다.

**REQ-AUTH-INVITE-002** (Event-Driven)
사용자가 `POST /auth/invite-codes/verify`로 초대 코드를 제출했을 때, 시스템은 코드의 존재 여부, 만료(`expiresAt > now`), 미사용(`usedBy IS NULL`) 상태를 검증하고 결과를 반환해야 한다.

**REQ-AUTH-INVITE-003** (Unwanted)
시스템은 만료되었거나 이미 사용된 초대 코드로의 회원가입을 허용하지 않아야 한다.

**REQ-AUTH-INVITE-004** (Event-Driven)
회원가입이 성공적으로 완료되었을 때, 시스템은 사용된 초대 코드의 `usedBy`를 신규 사용자 ID로, `usedAt`을 현재 시각으로 설정하여 재사용을 차단해야 한다.

**REQ-AUTH-INVITE-005** (Optional)
초대 코드 생성 시 `expiresAt`이 지정되지 않은 경우, 시스템은 기본 만료 기한을 발급 시점으로부터 7일 후로 설정해야 한다.

### 3.2 REQ-AUTH-SIGNUP: 이메일 회원가입

**REQ-AUTH-SIGNUP-001** (Event-Driven)
사용자가 `POST /auth/signup` 요청을 보냈을 때, 시스템은 이메일 형식(RFC 5322), 비밀번호 강도(최소 8자, 영문/숫자 혼합), 초대 코드 유효성, 이메일 중복 여부를 순차 검증해야 한다. 가입 요청 본문은 인증 자격증명(`email`, `password`, `inviteCode`)과 온보딩 데이터(`nickname`, `gender`, `birthDate`, `height`, `experienceLevel`)를 **단일 요청에서 함께 제출**하는 인라인(one-step) 플로우를 따른다(REQ-AUTH-ONBOARD-001과 일관).

**REQ-AUTH-SIGNUP-002** (Ubiquitous)
시스템은 회원가입 시 비밀번호를 bcrypt(cost factor 10)로 해싱하여 `User.passwordHash` 컬럼에 저장해야 한다.

**REQ-AUTH-SIGNUP-003** (Unwanted)
시스템은 평문(plain text) 비밀번호를 DB, 로그, 응답 본문 어디에도 노출하지 않아야 한다.

**REQ-AUTH-SIGNUP-004** (Event-Driven)
회원가입이 완료되었을 때, 시스템은 Resend를 통해 이메일 인증 메일을 발송해야 한다.

**REQ-AUTH-SIGNUP-005** (Ubiquitous)
시스템은 신규 회원가입 시 `User.role`을 `USER`로 자동 설정해야 한다.

### 3.3 REQ-AUTH-SOCIAL: 소셜 로그인 (Kakao, Google)

**REQ-AUTH-SOCIAL-001** (Event-Driven)
사용자가 `POST /auth/social/:provider` (provider ∈ {`kakao`, `google`})로 OAuth 토큰을 제출했을 때, 시스템은 해당 provider의 API로 토큰을 검증하고 `socialId`를 획득해야 한다.

**REQ-AUTH-SOCIAL-002** (Complex)
소셜 로그인 검증에 성공한 상태에서, `(socialProvider, socialId)` 조합으로 매칭되는 사용자가 존재할 때 시스템은 즉시 JWT 토큰을 발급해야 한다.

**REQ-AUTH-SOCIAL-003** (Complex)
소셜 로그인 검증에 성공한 상태에서, `(socialProvider, socialId)` 조합으로 매칭되는 사용자가 존재하지 않을 때 시스템은 초대 코드 입력 및 온보딩을 요구하는 신규 가입 플로우로 클라이언트를 안내해야 한다.

**REQ-AUTH-SOCIAL-004** (Unwanted)
시스템은 Apple OAuth(`provider=apple`) 요청을 본 SPEC 범위에서 수용하지 않아야 하며, `400 Bad Request`로 거부해야 한다.

### 3.4 REQ-AUTH-JWT: 토큰 관리

**REQ-AUTH-JWT-001** (Ubiquitous)
시스템은 인증 성공 시 Access Token(만료 15분)과 Refresh Token(만료 30일)을 함께 발급해야 한다.

**REQ-AUTH-JWT-002** (Ubiquitous)
시스템은 JWT(Access Token) payload에 `sub`(userId), `role`, `onboardingCompleted`, `iat`, `exp` 필드를 포함해야 한다. `onboardingCompleted`는 boolean이며, 클라이언트가 온보딩 재진입 여부를 토큰만으로 판단할 수 있게 한다(REQ-AUTH-ONBOARD-003, REQ-AUTH-ONBOARD-004 충족 수단).

**REQ-AUTH-JWT-003** (Ubiquitous)
시스템은 Refresh Token을 DB에 저장할 때 bcrypt 해시 형태로 저장해야 하며, 평문을 저장하지 않아야 한다.

**REQ-AUTH-JWT-004** (Event-Driven)
사용자가 `POST /auth/refresh`로 유효한 Refresh Token을 제출했을 때, 시스템은 새 Access Token과 새 Refresh Token을 발급하고 이전 Refresh Token을 즉시 무효화(Rotation)해야 한다.

**REQ-AUTH-JWT-005** (Unwanted)
시스템은 만료된(`exp < now`) 또는 무효화된 Refresh Token에 대한 갱신 요청을 허용하지 않아야 하며, `401 Unauthorized`로 거부해야 한다.

**REQ-AUTH-JWT-006** (Event-Driven)
사용자가 `POST /auth/logout` 요청을 보냈을 때, 시스템은 해당 사용자의 Refresh Token을 즉시 무효화해야 한다.

**REQ-AUTH-JWT-007** (Unwanted)
시스템은 JWT 시크릿(`JWT_SECRET`, `JWT_REFRESH_SECRET`)을 코드, 로그, 응답에 노출하지 않아야 하며, 환경 변수로만 관리해야 한다.

### 3.5 REQ-AUTH-RBAC: 역할 기반 접근 제어

**REQ-AUTH-RBAC-001** (Ubiquitous)
시스템은 모든 보호된 API 엔드포인트에 대해 JWT 검증을 수행하고, 누락 또는 만료 시 `401 Unauthorized`를 반환해야 한다.

**REQ-AUTH-RBAC-002** (Ubiquitous)
시스템은 사용자 권한을 `Admin`, `Premium`, `User` 세 단계로만 관리해야 한다.

**REQ-AUTH-RBAC-003** (Event-Driven)
사용자가 자신의 권한 범위를 초과한 엔드포인트에 접근했을 때, 시스템은 `403 Forbidden`을 반환해야 한다.

**REQ-AUTH-RBAC-004** (Optional)
사용자의 `premiumExpiresAt`이 설정되어 있고 `premiumExpiresAt < now`인 경우, 시스템은 해당 사용자의 유효 권한을 `User`로 강등하여 평가해야 한다.

**REQ-AUTH-RBAC-005** (Ubiquitous)
시스템은 Admin만 `PATCH /users/:id/role` 엔드포인트를 호출할 수 있도록 제한해야 한다.

**REQ-AUTH-RBAC-006** (Event-Driven)
Admin이 사용자 권한을 변경했을 때, 시스템은 `RoleChangeLog` 엔티티에 `targetUserId`, `changedByUserId`, `fromRole`, `toRole`, `reason`, `createdAt`을 기록해야 한다.

**REQ-AUTH-RBAC-007** (Unwanted)
시스템은 Admin이 아닌 사용자가 자신의 권한을 직접 변경하는 요청을 허용하지 않아야 한다.

### 3.6 REQ-AUTH-ONBOARD: 온보딩 (신체 정보 수집)

**REQ-AUTH-ONBOARD-001** (Ubiquitous)
시스템은 최초 가입 사용자에 대해 닉네임, 성별, 생년월일, 키, 운동 경력 수준 입력을 요구해야 한다.

**REQ-AUTH-ONBOARD-002** (Event-Driven)
사용자가 온보딩 단계에서 신체 정보를 제출했을 때, 시스템은 닉네임 길이(2-20자), 생년월일 형식(ISO 8601, 과거 100년 이내), 키 범위(100-250cm), `experienceLevel` ∈ {`BEGINNER`, `INTERMEDIATE`, `ADVANCED`}를 검증해야 한다.

**REQ-AUTH-ONBOARD-003** (Unwanted)
시스템은 온보딩이 완료되지 않은 사용자에 대해 본 인증 모듈 외의 보호된 엔드포인트 접근을 허용하지 않아야 한다.

**REQ-AUTH-ONBOARD-004** (Complex)
회원가입은 인라인(one-step) 플로우로 온보딩 데이터를 포함하여 처리되므로 정상 경로에서는 `onboardingCompleted=true`로 토큰이 발급된다. 다만 데이터 마이그레이션, 부분 실패 복구, 또는 후속 SPEC에서 도입될 수 있는 별도 온보딩 진입 경로로 인해 `onboardingCompleted=false` 상태로 로그인 토큰이 발급된 경우, 클라이언트는 JWT payload의 `onboardingCompleted` 필드를 검사하여 온보딩 화면으로 재진입하도록 라우팅해야 한다. 즉, "온보딩 재진입 트리거"는 JWT payload의 `onboardingCompleted=false`이다.

---

## 4. 비기능 요구사항 (Non-Functional Requirements)

### 4.1 보안 (Security)

- **NFR-SEC-001**: 모든 인증 API는 HTTPS 위에서만 동작해야 한다 (Railway 자동 SSL).
- **NFR-SEC-002**: CORS는 화이트리스트 방식으로 운영하며, 모바일 클라이언트 도메인만 허용한다.
- **NFR-SEC-003**: API 입력은 `class-validator` + DTO로 100% 검증한다. 미검증 필드는 ValidationPipe가 차단한다.
- **NFR-SEC-004**: 로그에 이메일, 비밀번호, JWT, Refresh Token, OAuth 토큰 등 PII/시크릿을 출력하지 않는다.
- **NFR-SEC-005**: Helmet 미들웨어로 보안 헤더(X-Frame-Options, X-Content-Type-Options 등)를 설정한다.
- **NFR-SEC-006**: bcrypt cost factor는 10으로 고정한다(성능과 보안의 균형, Railway Hobby Plan 기준 검증 응답 < 200ms).

### 4.2 성능 (Performance)

- **NFR-PERF-001**: `POST /auth/login` 응답 시간 P95 ≤ 500ms (bcrypt 비교 포함).
- **NFR-PERF-002**: `POST /auth/refresh` 응답 시간 P95 ≤ 200ms.
- **NFR-PERF-003**: JWT 검증(가드 통과 시간) P95 ≤ 10ms.

### 4.3 가용성 (Availability)

- **NFR-AVAIL-001**: Resend 이메일 발송 실패 시에도 회원가입 자체는 성공해야 하며, 인증 메일 재발송 큐 또는 재시도 메커니즘으로 처리한다(본 SPEC에서는 단순 로깅으로 대체).

### 4.4 호환성 (Compatibility)

- **NFR-COMPAT-001**: 모바일 클라이언트는 Access Token을 메모리(Zustand), Refresh Token을 Expo SecureStore에 저장한다.
- **NFR-COMPAT-002**: 토큰 갱신은 Axios 인터셉터를 통해 자동 처리되며, 동시 다중 401 응답에 대해 단일 갱신 요청으로 합쳐야 한다.

### 4.5 감사 가능성 (Auditability)

- **NFR-AUDIT-001**: 모든 권한 변경은 `RoleChangeLog`에 영구 보존된다(삭제 금지).
- **NFR-AUDIT-002**: 인증 실패(잘못된 비밀번호, 만료된 토큰)는 사용자 ID 없이 IP 기반 카운트로 로깅한다(브루트포스 탐지 기반 자료).

---

## 5. 변경 대상 파일 목록 (Affected Files)

### 5.1 백엔드 (apps/backend/)

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `prisma/schema.prisma` | 수정 | `User`, `InviteCode`, `RoleChangeLog` 모델 및 enum(`UserRole`, `SocialProvider`, `Gender`, `ExperienceLevel`) 추가 |
| `prisma/migrations/` | 생성 | 초기 마이그레이션 |
| `src/auth/auth.module.ts` | 생성 | 인증 모듈 정의 |
| `src/auth/auth.controller.ts` | 생성 | `POST /auth/*` 엔드포인트 |
| `src/auth/auth.service.ts` | 생성 | JWT 발급/갱신, 비밀번호 검증, 소셜 토큰 검증 |
| `src/auth/strategies/jwt.strategy.ts` | 생성 | Passport JWT 전략 |
| `src/auth/strategies/jwt-refresh.strategy.ts` | 생성 | Refresh Token 전략 |
| `src/auth/strategies/kakao.strategy.ts` | 생성 | passport-kakao 전략 |
| `src/auth/strategies/google.strategy.ts` | 생성 | passport-google-oauth20 전략 |
| `src/auth/guards/jwt-auth.guard.ts` | 생성 | JWT 검증 가드 |
| `src/auth/guards/roles.guard.ts` | 생성 | RBAC 가드 |
| `src/auth/decorators/roles.decorator.ts` | 생성 | `@Roles(...UserRole[])` |
| `src/auth/decorators/current-user.decorator.ts` | 생성 | `@CurrentUser()` |
| `src/auth/dto/signup.dto.ts` | 생성 | 회원가입 DTO |
| `src/auth/dto/login.dto.ts` | 생성 | 로그인 DTO |
| `src/auth/dto/verify-invite-code.dto.ts` | 생성 | 초대 코드 검증 DTO |
| `src/auth/dto/social-login.dto.ts` | 생성 | 소셜 로그인 DTO |
| `src/auth/dto/refresh-token.dto.ts` | 생성 | 토큰 갱신 DTO |
| `src/auth/dto/onboarding.dto.ts` | 생성 | 온보딩 DTO |
| `src/users/users.service.ts` | 수정 | `updateRole`, `findBySocialId` 메서드 추가 |
| `src/common/services/resend.service.ts` | 생성 | Resend 이메일 발송 래퍼 |
| `src/main.ts` | 수정 | Helmet, CORS, 전역 ValidationPipe 등록 |
| `.env.example` | 수정 | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `KAKAO_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` 추가 |

### 5.2 모바일 클라이언트 (apps/mobile/)

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `app/(auth)/login.tsx` | 생성 | 로그인 화면 (이메일/소셜) |
| `app/(auth)/register.tsx` | 생성 | 초대 코드 입력 → 이메일 가입 |
| `app/(auth)/onboarding.tsx` | 생성 | 신체 정보 입력 |
| `stores/authStore.ts` | 생성 | Zustand 인증 상태 (Access Token 메모리 보관) |
| `services/api.ts` | 생성 | Axios 인스턴스 + 401 인터셉터 (자동 토큰 갱신) |
| `services/auth.ts` | 생성 | 인증 API 호출 함수 |
| `hooks/useAuth.ts` | 생성 | 인증 훅 |

### 5.3 공유 패키지 (packages/types/)

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/user.ts` | 생성 | `UserRole`, `Gender`, `ExperienceLevel`, `SocialProvider` 타입 정의 |
| `src/auth.ts` | 생성 | `AuthTokens`, `JwtPayload` 타입 정의 |

---

## 6. 제외 사항 (Exclusions - What NOT to Build)

본 SPEC에서 **명시적으로 제외하는 항목**은 다음과 같다. 이는 후속 SPEC 또는 영구 비목표로 분류된다.

1. **Apple OAuth 로그인**: PRD 3.1.1에 따라 iOS 미지원이며, Apple 로그인은 본 SPEC 범위에서 제외한다.
2. **비밀번호 재설정 (Forgot Password)**: 이메일 토큰 기반 비밀번호 재설정 플로우는 별도 SPEC(SPEC-AUTH-RESET-XXX)에서 다룬다.
3. **2단계 인증 (2FA / TOTP)**: 다단계 인증은 본 SPEC에서 제외한다.
4. **다중 디바이스 세션 관리**: 사용자당 단일 Refresh Token만 유효하며, 디바이스별 토큰 추적 또는 "다른 디바이스 로그아웃" 기능은 다루지 않는다.
5. **이메일 인증 강제**: 이메일 인증 메일은 발송하나, 인증 미완료 사용자도 서비스 사용은 가능하다(인증 필수화는 후속 SPEC).
6. **초대 코드 운영 UI**: Admin이 초대 코드를 생성/만료/회수하는 UI 및 API(`/admin/invite-codes/*`)는 SPEC-ADMIN-XXX에서 다룬다.
7. **사용자 탈퇴 (Account Deletion)**: 계정 영구 삭제 및 GDPR 준수 데이터 폐기는 본 SPEC 범위 밖이다.
8. **세션 동시 로그인 제한**: 동시 접속 디바이스 수 제한은 다루지 않는다.
9. **CAPTCHA / Rate Limiting**: 브루트포스 방어를 위한 CAPTCHA 통합 및 IP 기반 rate limiting 미들웨어는 본 SPEC에서 제외한다(NestJS Throttler 도입은 후속 작업).
10. **OAuth 토큰 자체의 영구 저장**: 소셜 로그인 시 검증에 사용한 OAuth Access Token은 즉시 폐기하고 저장하지 않는다.

---

## 7. mx_plan (MX Tag Annotation Targets)

### 7.1 @MX:ANCHOR 대상 (high fan_in 함수)

- `auth.service.ts :: validateUser(email, password)`: 로그인 진입점, 다수 호출 예상
- `auth.service.ts :: issueTokens(user)`: 모든 인증 성공 경로의 단일 토큰 발급 지점
- `auth.service.ts :: rotateRefreshToken(oldToken)`: Refresh Token Rotation 불변식 (이전 토큰 즉시 무효화)
- `roles.guard.ts :: canActivate(context)`: 모든 보호된 엔드포인트가 통과하는 권한 검사 진입점
- `jwt.strategy.ts :: validate(payload)`: 모든 JWT 검증이 통과하는 지점

### 7.2 @MX:WARN 대상 (danger zone, requires @MX:REASON)

- `auth.service.ts :: hashPassword()`: bcrypt cost factor 변경 시 기존 사용자 영향 (REASON: cost factor 10 고정 — Railway Hobby Plan 성능 측정 결과)
- `auth.service.ts :: rotateRefreshToken()`: 동시 갱신 요청 경합 조건 (REASON: 트랜잭션 내 select-for-update 필요)
- `roles.guard.ts :: premiumExpiresAt 검증 로직`: 시점 비교 오류 시 권한 우회 가능 (REASON: 서버 시각 기준, UTC 통일)

### 7.3 @MX:NOTE 대상

- `kakao.strategy.ts`, `google.strategy.ts`: provider별 응답 스키마 차이 명시
- `verify-invite-code.dto.ts`: 코드 형식 정규식 명시 (영숫자 8자)
- `signup.dto.ts`: 비밀번호 강도 정책 명시 (최소 8자, 영문+숫자)

### 7.4 @MX:TODO 대상 (Run 단계 GREEN에서 해소)

- Resend 이메일 발송 실패 시 재시도 큐 — 현재는 단순 에러 로깅
- IP 기반 로그인 실패 카운터 — 후속 SPEC에서 NestJS Throttler 도입 예정
- OAuth provider API 다운 시 Circuit Breaker — 후속 SPEC

---

## 8. 추적성 (Traceability)

| REQ ID | acceptance.md 시나리오 | 출처 |
|--------|------------------------|------|
| REQ-AUTH-INVITE-001 | AC-INVITE-01 | PRD 3.1.1 |
| REQ-AUTH-INVITE-002 | AC-INVITE-01, AC-INVITE-02 | PRD 3.1.1 |
| REQ-AUTH-INVITE-003 | AC-INVITE-02 | PRD 3.1.1 |
| REQ-AUTH-INVITE-004 | AC-INVITE-03 | PRD 3.1.1 |
| REQ-AUTH-INVITE-005 | AC-INVITE-04 | PRD 3.1.1 |
| REQ-AUTH-SIGNUP-001 | AC-SIGNUP-01 | PRD 3.1.1 |
| REQ-AUTH-SIGNUP-002 | AC-SIGNUP-02 | PRD 8.2 |
| REQ-AUTH-SIGNUP-003 | AC-SIGNUP-02 | PRD 8.2 |
| REQ-AUTH-SIGNUP-004 | AC-SIGNUP-03 | PRD 3.1.1 |
| REQ-AUTH-SIGNUP-005 | AC-SIGNUP-04 | PRD 3.1.5 |
| REQ-AUTH-SOCIAL-001~004 | AC-SOCIAL-01, AC-SOCIAL-02, AC-SOCIAL-03 | PRD 3.1.1 |
| REQ-AUTH-JWT-001~003 | AC-JWT-01, AC-LOGIN-01 | PRD 3.1.2 |
| REQ-AUTH-JWT-004 | AC-JWT-02 | PRD 3.1.2 |
| REQ-AUTH-JWT-005 | AC-SECURITY-01 | PRD 3.1.2 |
| REQ-AUTH-JWT-006 | AC-JWT-03 | PRD 3.1.2 |
| REQ-AUTH-JWT-007 | AC-SECURITY-01 | PRD 8.2 |
| REQ-AUTH-RBAC-001 | AC-RBAC-01 (401 미인증), AC-SECURITY-01 (만료/변조 토큰 401) | PRD 3.1.3 |
| REQ-AUTH-RBAC-002~007 | AC-RBAC-02, AC-RBAC-03, AC-ROLE-CHANGE-01, AC-ROLE-CHANGE-02 | PRD 3.1.3, 3.1.5 |
| REQ-AUTH-ONBOARD-001~004 | AC-ONBOARD-01 | PRD 3.1.1 |
