# SPEC-AUTH-001 (Compact)

압축 버전: EARS 요구사항, 인수 시나리오, 영향 파일, 제외 사항만 포함.

---

## 1. EARS 요구사항

### REQ-AUTH-INVITE: 초대 코드

- **REQ-AUTH-INVITE-001** (Ubiquitous): 시스템은 신규 사용자 회원가입 요청 시 유효한 초대 코드 입력을 요구해야 한다.
- **REQ-AUTH-INVITE-002** (Event-Driven): 사용자가 `POST /auth/invite-codes/verify`로 초대 코드를 제출했을 때, 시스템은 존재/만료/미사용 상태를 검증하고 결과를 반환해야 한다.
- **REQ-AUTH-INVITE-003** (Unwanted): 시스템은 만료되었거나 이미 사용된 초대 코드로의 회원가입을 허용하지 않아야 한다.
- **REQ-AUTH-INVITE-004** (Event-Driven): 회원가입이 성공적으로 완료되었을 때, 시스템은 사용된 초대 코드의 `usedBy`/`usedAt`을 설정하여 재사용을 차단해야 한다.
- **REQ-AUTH-INVITE-005** (Optional): 초대 코드 생성 시 `expiresAt`이 지정되지 않은 경우, 시스템은 기본 만료 기한을 발급 시점으로부터 7일 후로 설정해야 한다.

### REQ-AUTH-SIGNUP: 이메일 회원가입

- **REQ-AUTH-SIGNUP-001** (Event-Driven): 사용자가 `POST /auth/signup` 요청을 보냈을 때, 시스템은 이메일 형식, 비밀번호 강도, 초대 코드 유효성, 이메일 중복 여부를 순차 검증해야 한다. 가입 요청 본문은 인증 자격증명과 온보딩 데이터를 **단일 요청에서 함께 제출**하는 인라인(one-step) 플로우이다.
- **REQ-AUTH-SIGNUP-002** (Ubiquitous): 시스템은 회원가입 시 비밀번호를 bcrypt(cost factor 10)로 해싱하여 저장해야 한다.
- **REQ-AUTH-SIGNUP-003** (Unwanted): 시스템은 평문 비밀번호를 DB, 로그, 응답 본문 어디에도 노출하지 않아야 한다.
- **REQ-AUTH-SIGNUP-004** (Event-Driven): 회원가입이 완료되었을 때, 시스템은 Resend를 통해 이메일 인증 메일을 발송해야 한다.
- **REQ-AUTH-SIGNUP-005** (Ubiquitous): 시스템은 신규 회원가입 시 `User.role`을 `USER`로 자동 설정해야 한다.

### REQ-AUTH-SOCIAL: 소셜 로그인

- **REQ-AUTH-SOCIAL-001** (Event-Driven): 사용자가 `POST /auth/social/:provider` (`kakao`/`google`)로 OAuth 토큰을 제출했을 때, 시스템은 provider API로 토큰을 검증하고 `socialId`를 획득해야 한다.
- **REQ-AUTH-SOCIAL-002** (Complex): 소셜 로그인 검증에 성공한 상태에서 `(socialProvider, socialId)` 매칭 사용자가 존재할 때, 시스템은 즉시 JWT 토큰을 발급해야 한다.
- **REQ-AUTH-SOCIAL-003** (Complex): 소셜 로그인 검증에 성공한 상태에서 매칭 사용자가 없을 때, 시스템은 초대 코드 입력 및 온보딩 플로우로 클라이언트를 안내해야 한다.
- **REQ-AUTH-SOCIAL-004** (Unwanted): 시스템은 Apple OAuth(`provider=apple`) 요청을 본 SPEC 범위에서 수용하지 않아야 하며, `400 Bad Request`로 거부해야 한다.

### REQ-AUTH-JWT: 토큰 관리

- **REQ-AUTH-JWT-001** (Ubiquitous): 시스템은 인증 성공 시 Access Token(만료 15분)과 Refresh Token(만료 30일)을 함께 발급해야 한다.
- **REQ-AUTH-JWT-002** (Ubiquitous): 시스템은 JWT(Access Token) payload에 `sub`, `role`, `onboardingCompleted`, `iat`, `exp` 필드를 포함해야 한다. `onboardingCompleted`는 boolean이며 클라이언트가 온보딩 재진입 여부를 토큰만으로 판단할 수 있게 한다.
- **REQ-AUTH-JWT-003** (Ubiquitous): 시스템은 Refresh Token을 DB에 저장할 때 bcrypt 해시 형태로 저장해야 하며, 평문을 저장하지 않아야 한다.
- **REQ-AUTH-JWT-004** (Event-Driven): 사용자가 `POST /auth/refresh`로 유효한 Refresh Token을 제출했을 때, 시스템은 새 Access/Refresh Token을 발급하고 이전 Refresh Token을 즉시 무효화해야 한다.
- **REQ-AUTH-JWT-005** (Unwanted): 시스템은 만료되었거나 무효화된 Refresh Token에 대한 갱신 요청을 허용하지 않아야 하며, `401 Unauthorized`로 거부해야 한다.
- **REQ-AUTH-JWT-006** (Event-Driven): 사용자가 `POST /auth/logout` 요청을 보냈을 때, 시스템은 해당 사용자의 Refresh Token을 즉시 무효화해야 한다.
- **REQ-AUTH-JWT-007** (Unwanted): 시스템은 JWT 시크릿을 코드, 로그, 응답에 노출하지 않아야 하며, 환경 변수로만 관리해야 한다.

### REQ-AUTH-RBAC: 역할 기반 접근 제어

- **REQ-AUTH-RBAC-001** (Ubiquitous): 시스템은 모든 보호된 API에 대해 JWT 검증을 수행하고, 누락 또는 만료 시 `401`을 반환해야 한다.
- **REQ-AUTH-RBAC-002** (Ubiquitous): 시스템은 사용자 권한을 `Admin`, `Premium`, `User` 세 단계로만 관리해야 한다.
- **REQ-AUTH-RBAC-003** (Event-Driven): 사용자가 자신의 권한 범위를 초과한 엔드포인트에 접근했을 때, 시스템은 `403 Forbidden`을 반환해야 한다.
- **REQ-AUTH-RBAC-004** (Optional): 사용자의 `premiumExpiresAt`이 만료된 경우, 시스템은 해당 사용자의 유효 권한을 `User`로 강등하여 평가해야 한다.
- **REQ-AUTH-RBAC-005** (Ubiquitous): 시스템은 Admin만 `PATCH /users/:id/role` 엔드포인트를 호출할 수 있도록 제한해야 한다.
- **REQ-AUTH-RBAC-006** (Event-Driven): Admin이 사용자 권한을 변경했을 때, 시스템은 `RoleChangeLog`에 `targetUserId, changedByUserId, fromRole, toRole, reason, createdAt`을 기록해야 한다.
- **REQ-AUTH-RBAC-007** (Unwanted): 시스템은 Admin이 아닌 사용자가 자신의 권한을 직접 변경하는 요청을 허용하지 않아야 한다.

### REQ-AUTH-ONBOARD: 온보딩

- **REQ-AUTH-ONBOARD-001** (Ubiquitous): 시스템은 최초 가입 사용자에 대해 닉네임, 성별, 생년월일, 키, 운동 경력 수준 입력을 요구해야 한다.
- **REQ-AUTH-ONBOARD-002** (Event-Driven): 사용자가 온보딩 신체 정보를 제출했을 때, 시스템은 닉네임(2-20자), 생년월일(ISO 8601, 과거 100년 이내), 키(100-250cm), `experienceLevel ∈ {BEGINNER, INTERMEDIATE, ADVANCED}`를 검증해야 한다.
- **REQ-AUTH-ONBOARD-003** (Unwanted): 시스템은 온보딩이 완료되지 않은 사용자에 대해 본 인증 모듈 외의 보호된 엔드포인트 접근을 허용하지 않아야 한다.
- **REQ-AUTH-ONBOARD-004** (Complex): 가입은 인라인 플로우로 처리되어 정상 경로에서는 `onboardingCompleted=true`로 발급된다. 다만 `onboardingCompleted=false`인 토큰이 발급된 경우, 클라이언트는 JWT payload의 해당 필드를 검사하여 온보딩 화면으로 재진입하도록 라우팅해야 한다.

---

## 2. 인수 기준 (Given-When-Then)

### AC-INVITE-01: 유효한 초대 코드 검증 성공
- **Given** Admin이 발급한 만료되지 않은 미사용 초대 코드 `"ABCD1234"`가 존재한다.
- **When** 클라이언트가 `POST /auth/invite-codes/verify`에 `{ "code": "ABCD1234" }`를 전송한다.
- **Then** 시스템은 `200 OK`와 `{ "valid": true }`를 반환한다.

### AC-INVITE-02: 만료된/사용된 초대 코드 거부
- **Given** `expiresAt < now` 또는 `usedBy != null`인 초대 코드가 존재한다.
- **When** 클라이언트가 해당 코드로 검증/회원가입을 시도한다.
- **Then** 시스템은 검증 API에서 `{ "valid": false, "reason": "EXPIRED" | "ALREADY_USED" }`를 반환하고, 회원가입은 `400 Bad Request`로 거부한다.

### AC-INVITE-03: 회원가입 성공 시 초대 코드 소비 처리
- **Given** 유효한 초대 코드로 회원가입 트랜잭션이 시작된다.
- **When** 트랜잭션이 성공적으로 커밋된다.
- **Then** 해당 `InviteCode.usedBy`/`usedAt`이 갱신되고, 동일 코드를 재사용하는 후속 가입은 `400`으로 거부된다.

### AC-INVITE-04: 초대 코드 기본 만료 기한 적용
- **Given** Admin이 `expiresAt`을 지정하지 않은 채 초대 코드를 생성한다.
- **When** `InviteCode`가 DB에 저장된다.
- **Then** `expiresAt`은 발급 시각 + 7일로 자동 설정된다.

### AC-SIGNUP-01: 유효한 입력으로 회원가입 성공
- **Given** 유효 초대 코드 + 미사용 이메일 + 강도 충족 비밀번호 + 온보딩 필드가 모두 제공된다.
- **When** 클라이언트가 `POST /auth/signup`을 호출한다.
- **Then** `201 Created`와 `{ accessToken, refreshToken, user }`가 반환되고, `User.role="USER"`, `User.inviteCodeUsed=<code>`로 저장된다.

### AC-SIGNUP-02: 비밀번호 해싱 및 평문 미노출
- **Given** 회원가입이 완료된다.
- **When** DB의 `passwordHash`와 응답/로그를 검사한다.
- **Then** `passwordHash`는 `$2b$10$`로 시작하는 bcrypt 해시이며, 평문 비밀번호는 어디에도 노출되지 않는다.

### AC-SIGNUP-03: 회원가입 후 이메일 인증 메일 발송
- **Given** 회원가입이 성공한다.
- **When** 트랜잭션 커밋 직후 `ResendService.sendVerificationEmail(user)`이 호출된다.
- **Then** Resend API에 1회 메일 발송 요청이 전송되며, Resend 실패 시에도 회원가입 응답은 `201`을 유지한다.

### AC-SIGNUP-04: 입력 유효성 실패
- **Given** 잘못된 이메일/약한 비밀번호/중복 이메일/무효한 초대 코드 중 하나가 포함된 요청을 전송한다.
- **When** `POST /auth/signup`이 호출된다.
- **Then** `400 Bad Request`가 반환되며, `User` 생성과 초대 코드 갱신이 모두 롤백된다.

### AC-LOGIN-01: 유효한 이메일/비밀번호 로그인 성공
- **Given** 가입된 사용자의 자격증명을 보유한다.
- **When** `POST /auth/login`을 호출한다.
- **Then** `200 OK`와 `{ accessToken(15분 만료), refreshToken(30일 만료), user }`이 반환되고, Access Token payload는 `sub, role, iat, exp, onboardingCompleted`를 포함한다.

### AC-LOGIN-02: 잘못된 비밀번호 로그인 실패
- **Given** 가입된 사용자의 이메일과 잘못된 비밀번호를 보유한다.
- **When** `POST /auth/login`을 호출한다.
- **Then** `401 Unauthorized`와 사용자 존재 여부를 추론할 수 없는 일반 메시지가 반환되며, 토큰은 발급되지 않는다.

### AC-SOCIAL-01: 기존 Kakao 계정 로그인 성공
- **Given** `(socialProvider="KAKAO", socialId="kakao_123")`인 사용자가 DB에 존재한다.
- **When** 클라이언트가 `POST /auth/social/kakao`에 유효한 Kakao 토큰을 전송한다.
- **Then** `200 OK`와 `{ accessToken, refreshToken, user }`가 반환된다.

### AC-SOCIAL-02: 신규 Kakao 계정은 가입 안내
- **Given** 매칭 사용자가 DB에 존재하지 않는다.
- **When** 클라이언트가 `POST /auth/social/kakao`로 신규 Kakao 토큰을 전송한다.
- **Then** `200 OK`와 `{ needSignup: true, socialProvider, socialId, email? }`이 반환되어 클라이언트가 가입/온보딩 화면으로 이동한다.

### AC-SOCIAL-03: Apple provider 요청 거부
- **Given** 클라이언트가 `POST /auth/social/apple`을 호출한다.
- **When** 서버가 요청을 수신한다.
- **Then** `400 Bad Request`와 `{ "message": "Unsupported provider" }`가 반환되며 검증 로직은 실행되지 않는다.

### AC-JWT-01: 토큰 발급 시 payload 구조 검증
- **Given** 인증에 성공한 사용자.
- **When** 발급된 토큰을 디코드한다.
- **Then** Access payload는 `{ sub, role, onboardingCompleted, iat, exp(iat+900) }`, Refresh payload는 `{ sub, iat, exp(iat+2592000) }`이며, DB의 `User.refreshTokenHash`는 해당 Refresh의 bcrypt 해시이다.

### AC-JWT-02: Refresh Token Rotation 성공
- **Given** 유효 Refresh Token `RT_OLD`가 발급되어 있다.
- **When** `POST /auth/refresh`에 `RT_OLD`를 전송한다.
- **Then** 새로운 `{ AT_NEW, RT_NEW }`가 반환되고 DB 해시가 `RT_NEW`로 갱신되며, 동일 `RT_OLD`의 재사용은 즉시 `401`로 거부된다.

### AC-JWT-03: 로그아웃 시 Refresh Token 무효화
- **Given** 유효 Access/Refresh Token이 발급되어 있다.
- **When** `POST /auth/logout`을 호출한다.
- **Then** `200 OK`가 반환되고 `User.refreshTokenHash`가 `null`로 갱신되며, 후속 `POST /auth/refresh`는 `401`을 반환한다.

### AC-RBAC-01: 미인증 요청(JWT 누락/만료)은 401 Unauthorized
- **Given** 보호된 엔드포인트가 존재한다.
- **When** 클라이언트가 Authorization 헤더 없이 또는 만료된 Access Token으로 호출한다.
- **Then** 두 경우 모두 `401 Unauthorized`가 반환되고, 핸들러 본문은 실행되지 않으며, 응답은 토큰/사용자 정보를 추론할 수 없는 일반 메시지여야 한다. (REQ-AUTH-RBAC-001)

### AC-RBAC-02: premiumExpiresAt 만료 시 자동 강등
- **Given** `role="PREMIUM"`이지만 `premiumExpiresAt < now`인 사용자.
- **When** Premium 전용 엔드포인트를 호출한다.
- **Then** RolesGuard가 유효 권한을 `USER`로 간주하여 `403 Forbidden`을 반환하고, User 권한 엔드포인트는 정상 동작한다.

### AC-RBAC-03: 권한 부족 요청은 403 Forbidden (User → Premium 전용 API)
- **Given** `role="USER"` 사용자의 유효 Access Token.
- **When** Premium 전용 엔드포인트를 호출한다.
- **Then** `403 Forbidden`이 반환되고 핸들러 본문은 실행되지 않는다. 401(미인증)과 403(권한 부족)이 명확히 구분된다. (REQ-AUTH-RBAC-002, REQ-AUTH-RBAC-003)

### AC-ROLE-CHANGE-01: Admin이 사용자 권한 변경 성공
- **Given** Admin 토큰과 변경 대상 User가 존재한다.
- **When** Admin이 `PATCH /users/<target-id>/role`에 `{ role: "PREMIUM", reason: "..." }`를 전송한다.
- **Then** `200 OK`가 반환되고, `User.role="PREMIUM"`으로 갱신되며, `RoleChangeLog`에 변경 이력이 1건 추가된다.

### AC-ROLE-CHANGE-02: 일반 User의 권한 변경 시도 차단
- **Given** `role="USER"` 사용자의 토큰.
- **When** 해당 사용자가 `PATCH /users/:id/role`을 호출한다.
- **Then** `403 Forbidden`이 반환되며 `User.role`과 `RoleChangeLog`는 변경되지 않는다.

### AC-ONBOARD-01: 온보딩 완료 후 보호 엔드포인트 접근 허용
- **Given** 온보딩 필수 필드가 모두 채워진 사용자의 토큰.
- **When** 보호된 엔드포인트(예: `GET /exercises`)를 호출한다.
- **Then** `200 OK`가 반환되며, 필수 필드가 누락된 사용자는 `403`/`409` + `{ code: "ONBOARDING_REQUIRED" }`로 차단되고, 입력 유효성 위반은 `400`으로 거부된다.

### AC-SECURITY-01: 만료/변조 토큰 거부 및 JWT 시크릿 비노출
- **Given** 만료된 Access Token, 만료된 Refresh Token, 서명 변조된 토큰.
- **When** 각 토큰으로 보호 엔드포인트 또는 `POST /auth/refresh`를 호출한다.
- **Then** 모든 경우 `401 Unauthorized`가 반환되고, 핸들러가 실행되지 않으며, 로그에 토큰 원문/PII가 노출되지 않는다.
- **And (REQ-AUTH-JWT-007 보조 시나리오)** 소스 트리 grep `JWT_SECRET`/`JWT_REFRESH_SECRET` 결과 평문 값 0건, 응답/로그에 시크릿 값 0건, `.env`는 gitignore 등록 및 커밋 이력 부재.

---

## 3. 영향 파일 (Affected Files)

### 백엔드 (apps/backend/)

- `prisma/schema.prisma` (수정): `User`, `InviteCode`, `RoleChangeLog` 모델 및 enum 추가
- `prisma/migrations/` (생성): 초기 마이그레이션
- `prisma/seed.ts` (수정): Admin 시드 계정
- `src/auth/auth.module.ts` (생성)
- `src/auth/auth.controller.ts` (생성): `POST /auth/*` 엔드포인트
- `src/auth/auth.service.ts` (생성): JWT 발급/갱신, 비밀번호 검증, 소셜 토큰 검증
- `src/auth/strategies/jwt.strategy.ts` (생성)
- `src/auth/strategies/jwt-refresh.strategy.ts` (생성)
- `src/auth/strategies/kakao.strategy.ts` (생성)
- `src/auth/strategies/google.strategy.ts` (생성)
- `src/auth/guards/jwt-auth.guard.ts` (생성)
- `src/auth/guards/roles.guard.ts` (생성)
- `src/auth/guards/onboarding-complete.guard.ts` (생성)
- `src/auth/decorators/roles.decorator.ts` (생성)
- `src/auth/decorators/current-user.decorator.ts` (생성)
- `src/auth/dto/signup.dto.ts` (생성)
- `src/auth/dto/login.dto.ts` (생성)
- `src/auth/dto/verify-invite-code.dto.ts` (생성)
- `src/auth/dto/social-login.dto.ts` (생성)
- `src/auth/dto/refresh-token.dto.ts` (생성)
- `src/auth/dto/onboarding.dto.ts` (생성)
- `src/users/users.service.ts` (수정): `updateRole`, `findBySocialId`
- `src/users/users.controller.ts` (수정): `PATCH /users/:id/role`
- `src/common/services/resend.service.ts` (생성)
- `src/main.ts` (수정): Helmet, CORS, 전역 ValidationPipe
- `.env.example` (수정): JWT 및 소셜/Resend 시크릿

### 모바일 클라이언트 (apps/mobile/)

- `app/(auth)/login.tsx` (생성)
- `app/(auth)/register.tsx` (생성)
- `app/(auth)/onboarding.tsx` (생성)
- `stores/authStore.ts` (생성)
- `services/api.ts` (생성): Axios + 401 인터셉터(자동 갱신)
- `services/auth.ts` (생성)
- `hooks/useAuth.ts` (생성)

### 공유 패키지 (packages/types/)

- `src/user.ts` (생성): `UserRole`, `Gender`, `ExperienceLevel`, `SocialProvider`
- `src/auth.ts` (생성): `AuthTokens`, `JwtPayload`

---

## 4. 제외 사항 (Exclusions)

1. **Apple OAuth 로그인**: iOS 미지원으로 본 SPEC 범위 제외.
2. **비밀번호 재설정 (Forgot Password)**: 별도 SPEC(SPEC-AUTH-RESET-XXX)에서 다룸.
3. **2단계 인증 (2FA / TOTP)**: 본 SPEC에서 제외.
4. **다중 디바이스 세션 관리**: 사용자당 단일 Refresh Token만 유효, 디바이스별 추적 미지원.
5. **이메일 인증 강제**: 메일은 발송하나 인증 미완료 사용자도 서비스 사용 가능. 강제화는 후속 SPEC.
6. **초대 코드 운영 UI**: Admin 발급/만료/회수 UI 및 `/admin/invite-codes/*` API는 SPEC-ADMIN-XXX.
7. **사용자 탈퇴 (Account Deletion)**: 계정 영구 삭제 및 GDPR 데이터 폐기 미포함.
8. **세션 동시 로그인 제한**: 동시 접속 디바이스 수 제한 미지원.
9. **CAPTCHA / Rate Limiting**: 브루트포스 방어 CAPTCHA 및 IP rate limiting 미포함(NestJS Throttler 도입은 후속 작업).
10. **OAuth 토큰 영구 저장**: 소셜 검증용 OAuth Access Token은 검증 후 즉시 폐기.
