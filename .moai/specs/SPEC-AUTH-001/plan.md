# SPEC-AUTH-001 구현 계획 (Implementation Plan)

연관 SPEC: [`SPEC-AUTH-001`](./spec.md)
연관 인수 기준: [`acceptance.md`](./acceptance.md)

---

## 1. 구현 접근 방식 (Implementation Approach)

### 1.1 아키텍처 패턴

- **레이어드 아키텍처**: NestJS 표준 패턴(Controller → Service → Repository(Prisma))을 따른다.
- **단일 책임 모듈**: `AuthModule`은 인증/인가 전반을 책임지며, 사용자 프로필 CRUD는 `UsersModule`에서 분리하여 의존한다.
- **Passport 전략 패턴**: JWT, Refresh JWT, Kakao, Google 각각 독립된 Strategy 클래스로 구현하여 책임을 분리한다.
- **DTO + class-validator**: 모든 입력은 DTO를 통하며 ValidationPipe가 자동 검증한다. NFR-SEC-003 충족 수단.
- **데코레이터 기반 RBAC**: `@Roles(UserRole.ADMIN)` + `RolesGuard` 조합으로 컨트롤러 또는 메서드 단위 권한 게이팅.

### 1.2 토큰 관리 전략

- Access Token: stateless, DB 조회 없음, JWT 검증만으로 인증 처리. `role` claim 포함하여 RBAC 가드가 즉시 사용.
- Refresh Token: stateful, `User.refreshTokenHash` 컬럼(또는 별도 `RefreshToken` 엔티티)에 bcrypt 해시 저장. Rotation 시 트랜잭션 내 즉시 교체.
- 시크릿 분리: `JWT_SECRET`(Access), `JWT_REFRESH_SECRET`(Refresh) 두 환경 변수로 분리하여 한쪽 노출 시 영향 최소화.

### 1.3 RBAC 평가 로직

- `RolesGuard.canActivate`는 JWT payload의 `role`을 1차 신뢰원으로 사용한다.
- `Premium` 권한 검증 시 `premiumExpiresAt`을 추가 확인하여 만료된 경우 실효 권한을 `User`로 강등한다 (REQ-AUTH-RBAC-004).
- 토큰의 `role`이 DB와 다를 수 있으므로(권한 변경 직후), 토큰 갱신 시점에 최신 `role`로 재발급한다.

### 1.4 초대 코드 사용 트랜잭션

- 회원가입은 단일 Prisma 트랜잭션으로 처리한다:
  1. 초대 코드 재검증 (`SELECT ... FOR UPDATE`)
  2. 이메일 중복 재검사
  3. `User` 생성
  4. `InviteCode.usedBy`, `usedAt` 업데이트
- 트랜잭션 실패 시 모든 변경을 롤백하여 중복 사용 방지.

### 1.5 온보딩 상태 추적

- `User` 엔티티의 `nickname`, `gender`, `birthDate`, `height`, `experienceLevel` 컬럼 모두 채워졌는지로 온보딩 완료 판정한다.
- 별도 `onboardingCompleted` boolean 컬럼을 두지 않고, 필수 필드 null 체크로 간소화한다(데이터 무결성과 단순성).
- JWT payload에 `onboardingCompleted` boolean을 포함하여 클라이언트가 매 요청마다 재조회하지 않도록 한다.

---

## 2. 단계별 구현 계획 (Phase-by-Phase Plan)

우선순위는 의존성 순서와 사용자 가치 순으로 결정한다. 시간 추정 대신 단계 간 의존성으로 표현한다.

### Phase 1 (Priority: High) — 데이터 모델 및 기반 인프라

목표: 후속 단계의 토대가 되는 스키마/모듈을 확정한다.

1. `prisma/schema.prisma`에 `User`, `InviteCode`, `RoleChangeLog`, enum(`UserRole`, `SocialProvider`, `Gender`, `ExperienceLevel`) 정의
2. `prisma migrate dev --name init-auth` 실행 및 마이그레이션 파일 커밋
3. `seed.ts`에 Admin 시드 계정(데릭) 추가 (PRD 3.1.5)
4. `PrismaModule`, `AuthModule`, `UsersModule` 스켈레톤 생성
5. `main.ts`에 Helmet, CORS 화이트리스트, 전역 ValidationPipe 등록 (NFR-SEC-001, 002, 003, 005)

완료 조건: `pnpm prisma migrate dev` 성공, Admin 시드 계정 DB에 존재, `pnpm start:dev` 기동.

### Phase 2 (Priority: High) — 이메일 회원가입 및 로그인

목표: 가장 기본적인 가입/로그인 플로우를 동작시킨다.

1. `signup.dto.ts`, `login.dto.ts`, `verify-invite-code.dto.ts`, `onboarding.dto.ts` 작성
2. `auth.service.ts`에 `verifyInviteCode`, `signup`, `login`, `validateUser`, `hashPassword`, `comparePassword` 구현
3. `auth.controller.ts`에 `POST /auth/invite-codes/verify`, `POST /auth/signup`, `POST /auth/login` 라우트 등록
4. `jwt.strategy.ts` 구현 (`JwtStrategy`, payload 추출 → `User` 조회)
5. `JwtAuthGuard` 구현 및 보호된 엔드포인트 데모로 검증
6. `ResendService` 작성 및 회원가입 완료 후 이메일 인증 메일 발송 (실패 무시 + 로깅)

완료 조건: AC-INVITE-01~04, AC-SIGNUP-01~04, AC-LOGIN-01 통과.

### Phase 3 (Priority: High) — JWT Refresh Token Rotation 및 로그아웃

목표: 30일 세션 유지 + 보안성 확보.

1. `User` 엔티티에 `refreshTokenHash` 컬럼 추가(또는 별도 모델) — 마이그레이션
2. `auth.service.ts`에 `issueTokens`, `rotateRefreshToken`, `invalidateRefreshToken` 구현
3. `jwt-refresh.strategy.ts` 구현 (Refresh Token 전용 가드)
4. `auth.controller.ts`에 `POST /auth/refresh`, `POST /auth/logout` 라우트 등록
5. 트랜잭션 내 Rotation 동작 검증

완료 조건: AC-JWT-01~03, AC-SECURITY-01 통과.

### Phase 4 (Priority: High) — RBAC 가드 및 권한 변경 감사 로그

목표: 권한 분리와 운영 책임 추적.

1. `roles.decorator.ts`, `current-user.decorator.ts`, `roles.guard.ts` 구현
2. `premiumExpiresAt` 만료 시 강등 로직 (REQ-AUTH-RBAC-004) — `RolesGuard` 내부 또는 별도 헬퍼
3. `UsersService.updateRole(targetUserId, newRole, adminUserId, reason)` 구현 — 트랜잭션 내 `RoleChangeLog` 기록
4. `users.controller.ts`에 `PATCH /users/:id/role` 라우트 추가 (Admin only)
5. 데모 컨트롤러(`@Roles(UserRole.PREMIUM)`)로 게이팅 동작 검증

완료 조건: AC-RBAC-01, AC-RBAC-02, AC-ROLE-CHANGE-01, AC-ROLE-CHANGE-02 통과.

### Phase 5 (Priority: Medium) — 소셜 로그인 (Kakao, Google)

목표: 한국 사용자 주요 가입 경로 확보.

1. `passport-kakao`, `passport-google-oauth20` 의존성 추가
2. `kakao.strategy.ts`, `google.strategy.ts` 구현 — provider별 사용자 정보 추출
3. `social-login.dto.ts` 작성 (OAuth Access Token 또는 인가 코드)
4. `auth.service.ts`에 `socialLogin(provider, token)` 구현 — `(socialProvider, socialId)` 매칭, 신규 시 가입 안내
5. `auth.controller.ts`에 `POST /auth/social/:provider` 라우트 등록
6. Apple provider 요청은 400으로 거부 (REQ-AUTH-SOCIAL-004)

완료 조건: AC-SOCIAL-01, AC-SOCIAL-02, AC-SOCIAL-03 통과.

### Phase 6 (Priority: Medium) — 온보딩 플로우

목표: 신체 정보 수집 강제 및 차후 AI 추천 입력값 확보.

1. `onboarding.dto.ts` 검증 규칙 완성 (REQ-AUTH-ONBOARD-002)
2. `POST /auth/onboarding` 또는 `PATCH /users/me/onboarding` 엔드포인트 추가
3. 온보딩 미완료 사용자를 가드(`OnboardingCompleteGuard`)로 차단 — 다른 모듈에서 활용
4. JWT payload에 `onboardingCompleted` 포함

완료 조건: AC-ONBOARD-01 통과.

### Phase 7 (Priority: Medium) — 모바일 클라이언트 통합

목표: 백엔드와 모바일 앱의 인증 흐름 연결.

1. `services/api.ts`에 Axios 인스턴스 + 401 인터셉터 (자동 Refresh) 구현
2. `stores/authStore.ts` 작성 — Access Token은 메모리, 사용자 정보 보관
3. Expo SecureStore로 Refresh Token 영속화
4. `app/(auth)/login.tsx`, `register.tsx`, `onboarding.tsx` 화면 작성
5. Kakao/Google SDK 연동 → OAuth Access Token 획득 → 백엔드로 전달

완료 조건: 앱에서 가입/로그인/온보딩 일관 동작.

### Phase 8 (Priority: Low) — 안정화 및 회귀 테스트

목표: 운영 진입 전 위험 최소화.

1. E2E 테스트 (`test/auth.e2e-spec.ts`) — 모든 acceptance 시나리오 자동화
2. Bruteforce/만료 토큰 등 보안 경계 테스트
3. 로그 점검 (PII 노출 0건 확인)
4. `.env.example` 최종화 및 README 업데이트

완료 조건: E2E 전부 PASS, 보안 점검 통과.

---

## 3. 파일 변경 목록 (File Changes)

상세 목록은 `spec.md` Section 5(변경 대상 파일 목록)를 참조한다. 본 절은 구현 순서와 매핑하여 요약한다.

| Phase | 주요 변경 파일 | 변경 유형 |
|-------|---------------|-----------|
| 1 | `prisma/schema.prisma`, `prisma/seed.ts`, `src/main.ts`, `src/auth/auth.module.ts` (스켈레톤) | 생성/수정 |
| 2 | `src/auth/auth.controller.ts`, `auth.service.ts`, `dto/*.dto.ts`, `strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts`, `src/common/services/resend.service.ts` | 생성 |
| 3 | `auth.service.ts`(rotation), `strategies/jwt-refresh.strategy.ts`, 마이그레이션(refreshTokenHash) | 생성/수정 |
| 4 | `decorators/roles.decorator.ts`, `decorators/current-user.decorator.ts`, `guards/roles.guard.ts`, `users.service.ts`(updateRole) | 생성/수정 |
| 5 | `strategies/kakao.strategy.ts`, `strategies/google.strategy.ts`, `dto/social-login.dto.ts`, `auth.service.ts`(socialLogin) | 생성/수정 |
| 6 | `dto/onboarding.dto.ts`, `auth.controller.ts`(onboarding), `guards/onboarding-complete.guard.ts` | 생성 |
| 7 | `apps/mobile/services/api.ts`, `services/auth.ts`, `stores/authStore.ts`, `app/(auth)/*.tsx` | 생성 |
| 8 | `test/auth.e2e-spec.ts`, `.env.example`, `README.md` | 생성/수정 |

---

## 4. 기술 의존성 (Dependencies)

### 4.1 백엔드 추가 패키지

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@nestjs/jwt` | latest (NestJS 10 호환) | JWT 발급/검증 |
| `@nestjs/passport` | latest | Passport 통합 |
| `passport` | latest | 전략 패턴 인증 |
| `passport-jwt` | latest | JWT Strategy |
| `passport-kakao` | latest | Kakao OAuth |
| `passport-google-oauth20` | latest | Google OAuth |
| `bcrypt` | latest (or `bcryptjs`) | 비밀번호 해싱 cost factor 10 |
| `class-validator` | latest | DTO 입력 검증 |
| `class-transformer` | latest | DTO 변환 |
| `helmet` | latest | 보안 헤더 |
| `resend` | latest | 이메일 발송 SDK |

### 4.2 기존 인프라 의존성

- NestJS 10 (`tech.md`)
- Prisma 5 + PostgreSQL 15 (`tech.md`)
- Railway Hobby Plan (배포)
- Resend Free tier (`tech.md`)

### 4.3 SPEC 의존성

- 본 SPEC은 다른 SPEC에 의존하지 않는 기반 SPEC이다.
- 후속 의존 SPEC: 모든 보호된 API SPEC(SPEC-EXERCISE-*, SPEC-PROGRAM-*, SPEC-SESSION-*, SPEC-AI-*, SPEC-ADMIN-*)이 본 SPEC의 `JwtAuthGuard`/`RolesGuard`/`@CurrentUser()`를 재사용한다.

---

## 5. 위험 분석 (Risk Analysis)

| ID | 위험 | 영향도 | 발생 가능성 | 완화 전략 |
|----|------|--------|-------------|-----------|
| R-01 | JWT 시크릿 노출 | High | Low | 환경 변수 분리(`JWT_SECRET`, `JWT_REFRESH_SECRET`), Railway 시크릿 매니저 사용, `.env`는 gitignore, 로그 필터링 |
| R-02 | Refresh Token Rotation 경합 (동시 다중 갱신 요청) | Medium | Medium | DB 트랜잭션 + `SELECT ... FOR UPDATE`, Axios 인터셉터에서 단일 갱신 요청 큐잉 (NFR-COMPAT-002) |
| R-03 | 초대 코드 중복 사용 (race condition) | Medium | Low | 회원가입 트랜잭션 내 `SELECT ... FOR UPDATE`로 코드 잠금 |
| R-04 | 소셜 로그인 provider API 다운 | Medium | Medium | 단순 에러 응답 반환, Circuit Breaker는 본 SPEC 비포함(@MX:TODO) |
| R-05 | bcrypt cost factor 부적절 | Low | Low | cost=10 고정 (PRD 8.2), Railway Hobby Plan 부하 테스트 결과 검증 |
| R-06 | 로그에 PII/시크릿 노출 | High | Medium | NestJS 전역 로거 필터, DTO 직렬화 시 password/token 필드 제외, 로깅 코드 리뷰 체크리스트 |
| R-07 | 권한 변경 후 토큰의 stale role | Medium | High | 토큰 갱신 시 최신 role 재로딩, 권한 강등 시 강제 로그아웃은 미지원(후속 SPEC) |
| R-08 | Resend 무료 한도 초과(3,000/월) | Low | Low | 사용자 수 5명 기준 임계 도달 가능성 매우 낮음, 한도 도달 시 회원가입은 성공/메일은 실패 처리 |
| R-09 | Apple OAuth 요청 우회 시도 | Low | Low | provider whitelist 검증으로 400 반환 (REQ-AUTH-SOCIAL-004) |
| R-10 | premiumExpiresAt 시각대 오류 | Medium | Medium | 모든 비교는 UTC 기준, Prisma DateTime 자동 변환 사용 |

---

## 6. 참고 구현 (Reference Implementations from PRD)

### 6.1 PRD 4. 데이터 모델 (Prisma)

```prisma
model User {
  id               String         @id @default(cuid())
  email            String         @unique
  passwordHash     String?
  socialProvider   SocialProvider?
  socialId         String?
  nickname         String
  gender           Gender
  birthDate        DateTime
  height           Float
  experienceLevel  ExperienceLevel
  role             UserRole       @default(USER)
  premiumExpiresAt DateTime?
  createdAt        DateTime       @default(now())
  inviteCodeUsed   String?
}

model InviteCode {
  id        String   @id @default(cuid())
  code      String   @unique
  createdBy String
  usedBy    String?
  expiresAt DateTime
  usedAt    DateTime?
}

model RoleChangeLog {
  id              String   @id @default(cuid())
  targetUserId    String
  changedByUserId String
  fromRole        UserRole
  toRole          UserRole
  reason          String?
  createdAt       DateTime @default(now())
}
```

본 SPEC은 위 스키마에 다음을 추가한다(구현 상세):

- `User.refreshTokenHash: String?` — bcrypt 해시 저장 (REQ-AUTH-JWT-003)
- 인덱스: `User.email` unique, `User(socialProvider, socialId)` composite unique
- enum: `UserRole { ADMIN, PREMIUM, USER }`, `SocialProvider { KAKAO, GOOGLE }`, `Gender { MALE, FEMALE }`, `ExperienceLevel { BEGINNER, INTERMEDIATE, ADVANCED }`

### 6.2 PRD 5.1 API 엔드포인트

| 메서드 | 경로 | 권한 | 요청 본문 | 응답 |
|--------|------|------|-----------|------|
| POST | `/auth/invite-codes/verify` | Public | `{ code: string }` | `{ valid: boolean, reason?: string }` |
| POST | `/auth/signup` | Public | `{ email, password, inviteCode, onboarding: {...} }` | `{ accessToken, refreshToken, user }` |
| POST | `/auth/login` | Public | `{ email, password }` | `{ accessToken, refreshToken, user }` |
| POST | `/auth/social/:provider` | Public | `{ accessToken }` 또는 `{ code }` | 기존 사용자: 토큰 / 신규: `{ needSignup: true }` |
| POST | `/auth/refresh` | Refresh Token | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | JWT | — | `{ success: true }` |
| PATCH | `/users/:id/role` | Admin | `{ role, reason }` | `{ user }` |

### 6.3 PRD 8.2 보안 요구사항 대응

- bcrypt cost 10 (REQ-AUTH-SIGNUP-002)
- 환경 변수 시크릿 (REQ-AUTH-JWT-007)
- Refresh Token DB 해시 저장 (REQ-AUTH-JWT-003)
- class-validator + DTO (NFR-SEC-003)
- HTTPS 강제 (NFR-SEC-001)
- CORS 화이트리스트 (NFR-SEC-002)
- PII 로그 미노출 (NFR-SEC-004)

---

## 7. MX 태그 전략 (MX Tag Strategy)

### 7.1 @MX:ANCHOR (불변식 보장 지점)

| 함수 | 불변식 | 호출 출처 |
|------|--------|-----------|
| `AuthService.validateUser(email, password)` | "유효한 이메일/비밀번호 조합이면 User 반환, 아니면 null" | login, social-link |
| `AuthService.issueTokens(user)` | "Access(15분) + Refresh(30일) 쌍을 항상 함께 발급, role/onboardingCompleted 포함" | signup, login, refresh, social |
| `AuthService.rotateRefreshToken(oldToken)` | "이전 Refresh Token은 반환 직후 무효화된다" | refresh |
| `RolesGuard.canActivate(context)` | "요청 사용자 권한이 요구 권한 집합에 포함될 때만 통과" | 모든 보호된 엔드포인트 |
| `JwtStrategy.validate(payload)` | "JWT가 유효하고 DB에 존재하는 사용자만 통과" | 모든 보호된 엔드포인트 |

### 7.2 @MX:WARN + @MX:REASON

| 함수 | 위험 | 이유(REASON) |
|------|------|--------------|
| `AuthService.hashPassword(plain)` | cost factor 변경 시 기존 사용자 영향 | "PRD 8.2 cost=10 고정. 변경 시 마이그레이션 전략 필요." |
| `AuthService.rotateRefreshToken()` | 동시 갱신 경합 | "트랜잭션 + SELECT FOR UPDATE 필수. 미적용 시 양쪽 토큰이 동시 유효해질 수 있음." |
| `RolesGuard` premium 만료 강등 | 시각 비교 오류 시 권한 우회 | "모든 비교는 서버 UTC 기준. 클라이언트 시각 신뢰 금지." |

### 7.3 @MX:NOTE

- `KakaoStrategy`: provider별 응답 필드명 차이(`id` vs `sub`) 명시
- `GoogleStrategy`: ID Token 검증 vs Access Token 검증 차이 명시
- `SignupDto`: 비밀번호 강도 정규식 명시 (`/^(?=.*[A-Za-z])(?=.*\d).{8,}$/`)

### 7.4 @MX:TODO (Run 단계 GREEN에서 해소 또는 후속 SPEC)

- Resend 발송 실패 재시도 큐
- IP 기반 로그인 실패 카운터 (NestJS Throttler 도입 — 후속 SPEC)
- OAuth provider Circuit Breaker (후속 SPEC)

### 7.5 @MX:LEGACY

- 본 SPEC은 신규 모듈이므로 LEGACY 태그 대상 없음.
