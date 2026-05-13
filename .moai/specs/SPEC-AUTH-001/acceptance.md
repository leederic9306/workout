# SPEC-AUTH-001 인수 기준 (Acceptance Criteria)

연관 SPEC: [`SPEC-AUTH-001`](./spec.md)
연관 구현 계획: [`plan.md`](./plan.md)

본 문서는 SPEC-AUTH-001의 모든 EARS 요구사항에 대응하는 Given-When-Then 시나리오와 정량적 품질 기준을 정의한다.

---

## 1. 인수 기준 (Acceptance Criteria)

### 1.1 초대 코드 시나리오

#### AC-INVITE-01: 유효한 초대 코드 검증 성공
**Given** Admin이 발급한 만료되지 않은 미사용 초대 코드 `"ABCD1234"`가 DB에 존재한다.
**When** 클라이언트가 `POST /auth/invite-codes/verify`에 `{ "code": "ABCD1234" }`를 전송한다.
**Then** 시스템은 `200 OK`와 `{ "valid": true }`를 반환한다.

연관 REQ: REQ-AUTH-INVITE-001, REQ-AUTH-INVITE-002

#### AC-INVITE-02: 만료된/사용된 초대 코드 거부
**Given** `expiresAt < now`인 초대 코드 또는 `usedBy != null`인 초대 코드가 존재한다.
**When** 클라이언트가 해당 코드로 `POST /auth/invite-codes/verify`를 전송한다.
**Then** 시스템은 `200 OK`와 `{ "valid": false, "reason": "EXPIRED" }` 또는 `{ "valid": false, "reason": "ALREADY_USED" }`를 반환한다.
**And** 해당 코드로 후속 `POST /auth/signup` 요청은 `400 Bad Request`로 거부된다.

연관 REQ: REQ-AUTH-INVITE-002, REQ-AUTH-INVITE-003

#### AC-INVITE-03: 회원가입 성공 시 초대 코드 소비 처리
**Given** 유효한 초대 코드 `"ABCD1234"`로 회원가입 트랜잭션이 시작되었다.
**When** 회원가입 트랜잭션이 성공적으로 커밋된다.
**Then** 해당 `InviteCode.usedBy`는 신규 사용자 ID로, `usedAt`은 현재 시각으로 갱신된다.
**And** 동일 코드를 재사용하는 후속 `POST /auth/signup`은 `400 Bad Request`로 거부된다.

연관 REQ: REQ-AUTH-INVITE-004

#### AC-INVITE-04: 초대 코드 기본 만료 기한 적용 (Optional)
**Given** Admin이 `expiresAt`을 지정하지 않은 채 초대 코드를 생성했다.
**When** `InviteCode`가 DB에 저장된다.
**Then** `expiresAt`은 발급 시각 + 7일로 자동 설정된다.

연관 REQ: REQ-AUTH-INVITE-005

---

### 1.2 이메일 회원가입 시나리오

#### AC-SIGNUP-01: 유효한 입력으로 회원가입 성공
**Given** 유효한 초대 코드 `"ABCD1234"`가 존재하고, 데이터베이스에 `test@example.com` 사용자는 없다.
**When** 클라이언트가 `POST /auth/signup`에 `{ "email": "test@example.com", "password": "Passw0rd!", "inviteCode": "ABCD1234", "onboarding": { "nickname": "테스터", "gender": "MALE", "birthDate": "1990-01-01", "height": 175, "experienceLevel": "INTERMEDIATE" } }`를 전송한다.
**Then** 시스템은 `201 Created`와 `{ "accessToken": "...", "refreshToken": "...", "user": { "id": "...", "role": "USER", ... } }`를 반환한다.
**And** `User.role`은 `USER`, `User.inviteCodeUsed`는 `"ABCD1234"`로 저장된다.

연관 REQ: REQ-AUTH-SIGNUP-001, REQ-AUTH-SIGNUP-005, REQ-AUTH-ONBOARD-001

#### AC-SIGNUP-02: 비밀번호 해싱 및 평문 미노출
**Given** AC-SIGNUP-01의 회원가입이 완료되었다.
**When** DB의 `User` 레코드를 조회하거나, API 응답 본문 및 로그를 검사한다.
**Then** `passwordHash` 컬럼 값은 `$2b$10$`로 시작하는 bcrypt 해시 형식이다.
**And** 어떤 응답 본문, 로그 출력, 에러 메시지에도 평문 비밀번호 `"Passw0rd!"`가 등장하지 않는다.

연관 REQ: REQ-AUTH-SIGNUP-002, REQ-AUTH-SIGNUP-003, NFR-SEC-004

#### AC-SIGNUP-03: 회원가입 후 이메일 인증 메일 발송
**Given** AC-SIGNUP-01의 회원가입이 성공한다.
**When** 회원가입 트랜잭션이 커밋된 직후 `ResendService.sendVerificationEmail(user)`이 호출된다.
**Then** Resend API에 `to=test@example.com` 메일 발송 요청이 1회 전송된다.
**And** Resend 발송이 실패하더라도 회원가입 응답은 `201 Created`를 유지한다(NFR-AVAIL-001).

연관 REQ: REQ-AUTH-SIGNUP-004

#### AC-SIGNUP-04: 입력 유효성 실패
**Given** 다음 중 하나에 해당하는 회원가입 요청을 전송한다:
- 이메일이 RFC 5322 형식 위반 (`"not-an-email"`)
- 비밀번호 7자 또는 영문/숫자 미혼합 (`"abcdefg"`)
- 이미 존재하는 이메일
- 무효한 초대 코드

**When** `POST /auth/signup`이 호출된다.
**Then** 시스템은 `400 Bad Request`와 위반 필드 정보를 반환한다.
**And** `User` 레코드는 생성되지 않으며, `InviteCode.usedBy`는 변경되지 않는다.

연관 REQ: REQ-AUTH-SIGNUP-001

---

### 1.3 로그인 시나리오

#### AC-LOGIN-01: 유효한 이메일/비밀번호 로그인 성공
**Given** AC-SIGNUP-01로 가입한 사용자 `test@example.com` / `"Passw0rd!"`가 존재한다.
**When** 클라이언트가 `POST /auth/login`에 동일 자격증명을 전송한다.
**Then** 시스템은 `200 OK`와 `{ "accessToken": "...", "refreshToken": "...", "user": {...} }`를 반환한다.
**And** Access Token을 디코드하면 `sub`, `role: "USER"`, `iat`, `exp`(iat+15분), `onboardingCompleted: true` 필드를 포함한다.

연관 REQ: REQ-AUTH-JWT-001, REQ-AUTH-JWT-002

#### AC-LOGIN-02: 잘못된 비밀번호 로그인 실패
**Given** AC-SIGNUP-01의 사용자가 존재한다.
**When** 클라이언트가 `POST /auth/login`에 `{ "email": "test@example.com", "password": "WrongPass1" }`를 전송한다.
**Then** 시스템은 `401 Unauthorized`와 사용자 존재 여부를 추론할 수 없는 일반 메시지를 반환한다.
**And** 토큰이 발급되지 않는다.

연관 REQ: REQ-AUTH-JWT-001 (보안 경계)

---

### 1.4 소셜 로그인 시나리오

#### AC-SOCIAL-01: 기존 Kakao 계정 로그인 성공
**Given** `User` 테이블에 `socialProvider="KAKAO"`, `socialId="kakao_123"`인 사용자가 존재한다.
**When** 클라이언트가 `POST /auth/social/kakao`에 유효한 Kakao Access Token을 전송하고, Kakao API가 `id=kakao_123`을 반환한다.
**Then** 시스템은 `200 OK`와 `{ "accessToken": "...", "refreshToken": "...", "user": {...} }`를 반환한다.

연관 REQ: REQ-AUTH-SOCIAL-001, REQ-AUTH-SOCIAL-002

#### AC-SOCIAL-02: 신규 Kakao 계정은 가입 안내
**Given** `(socialProvider, socialId)`가 매칭되는 사용자가 DB에 존재하지 않는다.
**When** 클라이언트가 `POST /auth/social/kakao`로 신규 Kakao 사용자의 토큰을 전송한다.
**Then** 시스템은 `200 OK`와 `{ "needSignup": true, "socialProvider": "KAKAO", "socialId": "kakao_NEW", "email": "...(있을 경우)" }`를 반환한다.
**And** 클라이언트는 초대 코드 입력 및 온보딩 화면으로 이동한다.

연관 REQ: REQ-AUTH-SOCIAL-001, REQ-AUTH-SOCIAL-003

#### AC-SOCIAL-03: Apple provider 요청 거부
**Given** 클라이언트가 임의로 `POST /auth/social/apple`을 호출한다.
**When** 서버가 요청을 수신한다.
**Then** 시스템은 `400 Bad Request`와 `{ "message": "Unsupported provider" }`를 반환한다.
**And** 어떤 검증 로직도 실행되지 않는다.

연관 REQ: REQ-AUTH-SOCIAL-004

---

### 1.5 JWT 토큰 시나리오

#### AC-JWT-01: 토큰 발급 시 payload 구조 검증
**Given** AC-LOGIN-01로 발급된 Access Token이 있다.
**When** Access Token을 base64 디코드한다.
**Then** payload는 `{ "sub": "<userId>", "role": "USER" | "PREMIUM" | "ADMIN", "onboardingCompleted": <bool>, "iat": <unix>, "exp": <iat+900> }` 구조이다.
**And** Refresh Token payload는 `{ "sub": "<userId>", "iat": <unix>, "exp": <iat+2592000> }` 구조이다(role 미포함).
**And** DB의 `User.refreshTokenHash`는 발급된 Refresh Token의 bcrypt 해시이다.

연관 REQ: REQ-AUTH-JWT-001, REQ-AUTH-JWT-002, REQ-AUTH-JWT-003

#### AC-JWT-02: Refresh Token Rotation 성공
**Given** 유효한 Refresh Token `RT_OLD`가 발급되어 있고 DB에 해당 해시가 저장되어 있다.
**When** 클라이언트가 `POST /auth/refresh`에 `{ "refreshToken": "RT_OLD" }`를 전송한다.
**Then** 시스템은 `200 OK`와 새로운 `{ "accessToken": "AT_NEW", "refreshToken": "RT_NEW" }`를 반환한다.
**And** DB의 `User.refreshTokenHash`는 `RT_NEW`의 해시로 갱신된다.
**And** 동일한 `RT_OLD`로 즉시 한 번 더 `POST /auth/refresh`를 호출하면 `401 Unauthorized`가 반환된다(이전 토큰 무효화 확인).

연관 REQ: REQ-AUTH-JWT-004

#### AC-JWT-03: 로그아웃 시 Refresh Token 무효화
**Given** 유효한 Access Token `AT`와 Refresh Token `RT`가 발급되어 있다.
**When** 클라이언트가 `POST /auth/logout`에 `AT`를 Authorization 헤더로 전송한다.
**Then** 시스템은 `200 OK`를 반환한다.
**And** DB의 `User.refreshTokenHash`는 `null`로 갱신된다.
**And** 후속 `POST /auth/refresh`(`RT` 사용)는 `401 Unauthorized`를 반환한다.

연관 REQ: REQ-AUTH-JWT-006

---

### 1.6 RBAC 시나리오

#### AC-RBAC-01: 미인증 요청(JWT 누락/만료)은 401 Unauthorized
**Given** 보호된 엔드포인트(예: `GET /exercises`)가 존재한다.
**When** 클라이언트가 (a) Authorization 헤더 없이, 또는 (b) 만료된 Access Token으로 해당 엔드포인트를 호출한다.
**Then** 시스템은 두 경우 모두 `401 Unauthorized`를 반환한다.
**And** 핸들러 본문은 실행되지 않는다(가드에서 차단).
**And** 응답 본문은 사용자 존재 여부나 토큰 내부 정보를 추론할 수 없는 일반 메시지여야 한다.

연관 REQ: REQ-AUTH-RBAC-001

#### AC-RBAC-02: premiumExpiresAt 만료 시 자동 강등
**Given** `User.role="PREMIUM"`이고 `premiumExpiresAt < now`인 사용자의 Access Token이 있다.
**When** 해당 사용자가 Premium 전용 엔드포인트를 호출한다.
**Then** `RolesGuard`는 유효 권한을 `USER`로 간주하고 `403 Forbidden`을 반환한다.
**And** User 권한 엔드포인트는 정상 동작한다.

연관 REQ: REQ-AUTH-RBAC-004

#### AC-RBAC-03: 권한 부족 요청은 403 Forbidden (User → Premium 전용 API)
**Given** `role="USER"`로 인증된 사용자의 유효한 Access Token이 있다.
**When** 클라이언트가 Premium 전용 엔드포인트(예: `POST /ai/recommendations/custom-program`)를 호출한다.
**Then** 시스템은 `403 Forbidden`을 반환한다.
**And** 핸들러 본문은 실행되지 않는다(가드에서 차단).
**And** 401과 403이 명확히 구분된다: JWT 자체는 유효하지만 역할이 부족한 경우에만 403을 사용한다.

연관 REQ: REQ-AUTH-RBAC-002, REQ-AUTH-RBAC-003

---

### 1.7 권한 변경 시나리오

#### AC-ROLE-CHANGE-01: Admin이 사용자 권한 변경 성공
**Given** Admin 사용자 `admin@example.com`의 Access Token과, 변경 대상 User `target@example.com`이 존재한다.
**When** Admin이 `PATCH /users/<target-id>/role`에 `{ "role": "PREMIUM", "reason": "베타 테스터 보상" }`를 전송한다.
**Then** 시스템은 `200 OK`와 갱신된 `user` 객체를 반환한다.
**And** `User.role`은 `PREMIUM`으로 갱신된다.
**And** `RoleChangeLog` 테이블에 `{ targetUserId, changedByUserId=adminId, fromRole="USER", toRole="PREMIUM", reason="베타 테스터 보상", createdAt }`이 1건 추가된다.

연관 REQ: REQ-AUTH-RBAC-005, REQ-AUTH-RBAC-006

#### AC-ROLE-CHANGE-02: 일반 User의 권한 변경 시도 차단
**Given** `role="USER"`인 사용자의 Access Token이 있다.
**When** 해당 사용자가 자신 또는 타인의 `PATCH /users/:id/role`을 호출한다.
**Then** 시스템은 `403 Forbidden`을 반환한다.
**And** `User.role` 및 `RoleChangeLog`는 변경되지 않는다.

연관 REQ: REQ-AUTH-RBAC-005, REQ-AUTH-RBAC-007

---

### 1.8 온보딩 시나리오

#### AC-ONBOARD-01: 온보딩 완료 후 보호 엔드포인트 접근 허용
**Given** AC-SIGNUP-01의 회원가입이 온보딩 정보를 포함하여 완료되었다.
**When** 해당 사용자의 Access Token으로 보호된 엔드포인트(예: `GET /exercises`)를 호출한다.
**Then** 시스템은 `200 OK`와 정상 응답을 반환한다.

**And (보조 시나리오)** 온보딩 필수 필드(`nickname`, `gender`, `birthDate`, `height`, `experienceLevel`) 중 하나라도 누락된 사용자가 보호된 엔드포인트를 호출하면, 시스템은 `403 Forbidden` 또는 `409 Conflict`와 `{ "code": "ONBOARDING_REQUIRED" }`를 반환한다.

**And** 입력 유효성 위반(닉네임 1자, 키 50cm, `experienceLevel="EXPERT"` 등)은 `400 Bad Request`로 거부된다.

연관 REQ: REQ-AUTH-ONBOARD-001, REQ-AUTH-ONBOARD-002, REQ-AUTH-ONBOARD-003, REQ-AUTH-ONBOARD-004

---

### 1.9 보안 경계 시나리오

#### AC-SECURITY-01: 만료/변조 토큰 거부 및 JWT 시크릿 비노출
**Given** 다음 토큰이 각각 준비되어 있다:
- `AT_EXPIRED`: 만료 시각이 과거인 Access Token
- `RT_EXPIRED`: 만료 시각이 과거인 Refresh Token
- `JWT_TAMPERED`: payload가 변조되어 서명 불일치인 Access Token

**When** 각 토큰으로 보호된 엔드포인트 또는 `POST /auth/refresh`를 호출한다.
**Then** 모든 경우 `401 Unauthorized`가 반환된다.
**And** 어떤 핸들러 본문도 실행되지 않는다.
**And** 로그에는 토큰 원문 또는 사용자 PII가 노출되지 않는다.

**And (JWT 시크릿 비노출 보조 시나리오, REQ-AUTH-JWT-007)** 다음 검증이 모두 통과한다:
- 소스 트리(`apps/backend/src/**`) grep `JWT_SECRET`/`JWT_REFRESH_SECRET` 결과 평문 값 0건 (환경 변수 참조만 존재)
- 회원가입/로그인/토큰 갱신 API 응답 본문 어디에도 시크릿 값이 포함되지 않는다
- 애플리케이션 로그(stdout/stderr) 샘플 수집 시 시크릿 값과 매칭되는 문자열이 0건이다
- `.env`, `.env.local` 등 시크릿 파일은 `.gitignore`에 포함되며 커밋 이력에 존재하지 않는다

연관 REQ: REQ-AUTH-JWT-005, REQ-AUTH-RBAC-001, REQ-AUTH-JWT-007, NFR-SEC-004

---

## 2. 성능 기준 (Performance Criteria)

| 지표 | 목표값 | 측정 방법 |
|------|--------|-----------|
| `POST /auth/login` P95 응답 시간 | ≤ 500ms (bcrypt 비교 포함) | Railway Hobby Plan 환경, k6 부하 테스트 (50 vCPU sec) |
| `POST /auth/refresh` P95 응답 시간 | ≤ 200ms | k6 부하 테스트 |
| `POST /auth/invite-codes/verify` P95 응답 시간 | ≤ 100ms | k6 부하 테스트 |
| JWT 검증(`JwtAuthGuard`) P95 처리 시간 | ≤ 10ms | NestJS 인터셉터 측정 |
| 동시 사용자 5명 기준 인증 처리 무오류 | 100% 성공 | k6 시나리오(가입 1회 + 로그인 5회) |

연관 NFR: NFR-PERF-001, NFR-PERF-002, NFR-PERF-003

---

## 3. 보안 기준 (Security Criteria)

| 카테고리 | 기준 | 검증 방법 |
|----------|------|-----------|
| 비밀번호 해싱 | bcrypt cost factor = 10, 평문 미저장 | DB 컬럼 패턴(`$2b$10$`) 자동 검증 E2E 테스트 (AC-SIGNUP-02) |
| Refresh Token 저장 | DB에 bcrypt 해시 저장, 평문 미저장 | DB 컬럼 패턴 검증 (AC-JWT-01) |
| JWT 만료 | Access 15분(900s), Refresh 30일(2,592,000s) | 발급 직후 payload `exp - iat` 검증 (AC-JWT-01) |
| Refresh Token Rotation | 갱신 후 이전 토큰 즉시 무효 | AC-JWT-02 |
| 시크릿 노출 | 코드/로그/응답에 시크릿 0건 | grep `JWT_SECRET`/`REFRESH` 시 소스 미존재, 로그 샘플 수동 점검 |
| PII 로그 노출 | 이메일, 비밀번호, 토큰 로그 0건 | NestJS Logger 출력 수집 → 정규식 매칭 0건 (NFR-SEC-004) |
| HTTPS 강제 | 모든 인증 엔드포인트 HTTP 차단 | Railway 자동 SSL + 헬멧 HSTS 헤더 확인 (NFR-SEC-001) |
| CORS 화이트리스트 | 모바일 도메인만 허용 | 임의 Origin 요청 시 `403 Forbidden` (NFR-SEC-002) |
| 입력 검증 | DTO 미적용 필드 차단 | `whitelist: true, forbidNonWhitelisted: true` ValidationPipe (NFR-SEC-003) |
| 권한 우회 차단 | RBAC 가드를 거치지 않은 보호 엔드포인트 0건 | 컨트롤러 자동 audit 테스트 |
| Apple provider 거부 | `POST /auth/social/apple` → 400 | AC-SOCIAL-03 |
| 초대 코드 중복 사용 차단 | 동일 코드 2회 가입 시도 차단 | AC-INVITE-03 |

---

## 4. 완료 정의 (Definition of Done)

다음 조건이 모두 충족될 때 SPEC-AUTH-001은 완료된 것으로 간주한다:

- [ ] 모든 EARS 요구사항(REQ-AUTH-INVITE-*, REQ-AUTH-SIGNUP-*, REQ-AUTH-SOCIAL-*, REQ-AUTH-JWT-*, REQ-AUTH-RBAC-*, REQ-AUTH-ONBOARD-*)에 대응하는 인수 시나리오가 자동 E2E 테스트로 통과한다.
- [ ] 본 문서의 모든 AC-* 시나리오가 `apps/backend/test/auth.e2e-spec.ts`에서 PASS한다.
- [ ] 단위 테스트 커버리지 ≥ 85% (TRUST 5 Tested).
- [ ] 성능 기준(Section 2)이 Railway 스테이징 환경에서 충족된다.
- [ ] 보안 기준(Section 3) 항목 모두 검증 완료.
- [ ] `prisma migrate dev` 및 시드(`prisma db seed`)가 정상 동작하여 Admin 시드 계정이 생성된다.
- [ ] 모바일 클라이언트에서 회원가입 → 온보딩 → 로그인 → 토큰 갱신 → 로그아웃 시나리오가 일관되게 동작한다.
- [ ] `.env.example`이 모든 필수 환경 변수를 포함하고, 비어 있어도 `pnpm start:dev`가 의미 있는 에러 메시지를 출력한다.
- [ ] 코드 리뷰 체크리스트 통과 (PII 로깅 없음, 시크릿 하드코딩 없음, DTO 적용 누락 없음).
- [ ] `spec.md` Section 7의 모든 @MX:ANCHOR 함수에 태그가 부착되어 있다.
