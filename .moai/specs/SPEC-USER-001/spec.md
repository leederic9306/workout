---
id: SPEC-USER-001
version: "1.0.1"
status: draft
created_at: "2026-05-11"
updated_at: "2026-05-11"
author: leederic9306
priority: medium
issue_number: 0
labels: ["user", "profile", "backend", "mobile"]
---

# SPEC-USER-001: 사용자 프로필 관리

## HISTORY

- 2026-05-11 v1.0.1 (draft): plan-auditor 1차 감사 결과 반영. REQ-USER-DELETE-008(소프트삭제 로그인 차단), REQ-USER-DELETE-009(Admin 자기삭제 차단), REQ-USER-UPDATE-007(온보딩 완료 전환 신호), REQ-USER-PASSWORD-008(응답 코드 명시) 추가. REQ-USER-ADMIN-005 소프트삭제 404 동작 명확화. EARS 패턴 정제 및 구현 세부사항 제거. NFR-ONBOARD-001/002 가드 기준 명확화. NFR-ONBOARD-003 추가. Section 6에 비밀번호 변경 rate limiting 제외 명시. 18개 결함 중 16개 수정 완료.
- 2026-05-11 v1.0.0 (draft): 초기 작성 (leederic9306). SPEC-AUTH-001 v1.0.1 위에서 동작하는 프로필 레이어로서, 본인 프로필 조회/수정, 비밀번호 변경(이메일 가입자 한정), 계정 탈퇴(소프트 삭제), Admin 사용자 조회 엔드포인트를 EARS 형식으로 정의. PRD v1.4 Section 3.2(프로필 관리) 및 Section 8.3(GDPR 데이터 보존)을 기반으로 함.

---

## 1. 개요 (Overview)

근력 운동 트래커 앱의 **사용자 프로필 관리 시스템**을 정의한다. 본 SPEC은 SPEC-AUTH-001(인증 및 권한 관리 시스템) 위에서 동작하는 **프로필 레이어**로서, 인증된 사용자가 자신의 프로필(닉네임, 신체 정보, 운동 경력 수준)을 조회/수정하고, 비밀번호를 변경하며, 계정을 탈퇴할 수 있게 한다. 또한 Admin 권한 사용자가 전체 사용자 목록 및 특정 사용자 프로필을 조회할 수 있는 운영용 엔드포인트를 포함한다.

### 핵심 가치

- **자기결정권**: 사용자가 자신의 프로필 데이터(닉네임, 신체 정보)와 인증 자격증명(비밀번호)을 자유롭게 수정할 수 있다.
- **소셜/이메일 가입자 차별 처리**: 비밀번호 변경은 이메일 가입자에게만 허용하고, 소셜 전용 계정(`passwordHash IS NULL`)은 변경 시도 자체를 차단한다.
- **소프트 삭제 + GDPR 경로**: 계정 탈퇴는 즉시 하드 삭제하지 않고 `deletedAt` 컬럼으로 소프트 삭제하여 `RoleChangeLog` 등 참조 무결성을 보존하면서, 30일 후 하드 삭제로 전환할 수 있는 경로를 열어 둔다.
- **즉시 세션 종료**: 탈퇴 시 `refreshTokenHash`를 즉시 NULL 처리하여 다른 디바이스에서의 재인증을 차단한다.
- **운영 가시성**: Admin은 페이지네이션된 사용자 목록과 특정 사용자 상세 프로필을 조회하여 권한 변경(SPEC-AUTH-001 `PATCH /users/:id/role`) 판단의 근거를 확보한다.

### 범위

본 SPEC은 백엔드(NestJS 10) 측 `UsersModule` 확장(서비스, 컨트롤러), Prisma 스키마의 `User.deletedAt` 컬럼 추가, `GET /users/me`, `PATCH /users/me/profile`, `PATCH /users/me/password`, `DELETE /users/me`, `GET /users` (Admin), `GET /users/:id` (Admin) 엔드포인트, 모바일 클라이언트의 프로필 화면/편집 폼/탈퇴 플로우를 포괄한다.

다음 항목은 본 SPEC 범위에서 명시적으로 제외된다 (Section 6 참조):
- `PATCH /users/:id/role` (Admin 권한 변경): SPEC-AUTH-001에서 이미 정의됨.
- 프로필 사진/아바타 업로드: PRD에 정의되지 않음, 사적 비공개 앱이므로 미포함.
- 공개 사용자 프로필: 비공개 초대제 앱 특성상 불필요.
- Admin 초대 코드 관리 UI: SPEC-ADMIN-001(별도)에서 다룸.
- 운동 라이브러리, 운동 세션 기록 등: 각 별도 SPEC.

---

## 2. 목표와 비목표 (Goals & Non-Goals)

### 2.1 목표 (Goals)

1. 인증된 사용자가 `GET /users/me`로 본인 프로필을 조회할 수 있게 한다 (온보딩 5필드 + 메타데이터 포함).
2. 인증된 사용자가 `PATCH /users/me/profile`로 닉네임, 성별, 생년월일, 키, 운동 경력 수준을 부분 수정할 수 있게 한다.
3. 이메일 가입자(`passwordHash IS NOT NULL`)가 `PATCH /users/me/password`로 비밀번호를 변경할 수 있게 한다. `currentPassword` 검증을 강제한다.
4. 소셜 전용 가입자(`passwordHash IS NULL`)가 비밀번호 변경을 시도하면 명확한 에러로 차단한다.
5. 사용자가 `DELETE /users/me`로 계정을 소프트 삭제(`deletedAt = now()`)할 수 있게 하고, 즉시 모든 세션을 종료(`refreshTokenHash = NULL`)한다.
6. 소프트 삭제된 사용자는 인증 가드에서 즉시 차단(`User.deletedAt IS NOT NULL` → 401)한다.
7. `RoleChangeLog` 등 외래 참조는 유지되어 감사 추적성이 보존되도록 한다.
8. Admin이 `GET /users`로 페이지네이션된 사용자 목록(기본 `page=1, limit=20`)을 조회할 수 있게 한다.
9. Admin이 `GET /users/:id`로 특정 사용자의 전체 프로필을 조회할 수 있게 한다.
10. `onboardingCompleted`는 저장 컬럼이 아닌 **계산 필드(computed)**로 응답에 포함하되, 5개 온보딩 필드(`nickname`, `gender`, `birthDate`, `height`, `experienceLevel`)가 모두 NULL이 아닌 경우에만 `true`로 평가한다 (SPEC-AUTH-001 JWT payload의 `onboardingCompleted`와 동일 계산식).

### 2.2 비목표 (Non-Goals)

- Admin 권한 변경(`PATCH /users/:id/role`)은 SPEC-AUTH-001에서 다룬다. 본 SPEC에서 중복 정의하지 않는다.
- 프로필 사진/아바타 업로드 및 이미지 호스팅은 본 SPEC 범위 밖이다.
- 공개 프로필(`GET /users/:nickname` 등 비인증 조회)은 다루지 않는다.
- 이메일 변경, 이메일 인증 재발송은 본 SPEC 범위 밖이며, 후속 SPEC에서 다룬다.
- 소셜 계정 연동/해제(같은 사용자에 이메일+Kakao 동시 연결)는 본 SPEC 범위 밖이다.
- 30일 후 하드 삭제 배치 작업은 별도 운영 SPEC(SPEC-OPS-XXX)에서 다룬다. 본 SPEC은 소프트 삭제 자체와 그에 따른 인증 차단까지만 정의한다.
- Admin이 다른 사용자의 프로필 데이터를 직접 수정하는 기능(예: 닉네임 강제 변경)은 본 SPEC 범위 밖이다.

---

## 3. EARS 요구사항 (Requirements)

### 3.1 REQ-USER-PROFILE: 본인 프로필 조회

**REQ-USER-PROFILE-001** (Event-Driven)
인증된 사용자가 `GET /users/me` 요청을 보냈을 때, 시스템은 해당 사용자의 프로필 정보(`id`, `email`, `role`, `nickname`, `gender`, `birthDate`, `height`, `experienceLevel`, `premiumExpiresAt`, `socialProvider`, `onboardingCompleted`, `createdAt`)를 200 응답으로 반환해야 한다.

**REQ-USER-PROFILE-002** (Unwanted)
시스템은 `GET /users/me` 응답 본문에 `passwordHash`, `refreshTokenHash`, `socialId`를 포함하지 않아야 한다.

**REQ-USER-PROFILE-003** (Ubiquitous)
시스템은 `GET /users/me` 응답의 `onboardingCompleted` 필드를 5개 온보딩 필드(`nickname`, `gender`, `birthDate`, `height`, `experienceLevel`)가 모두 NULL이 아닌 경우 `true`로, 하나라도 NULL이면 `false`로 계산해야 한다.

**REQ-USER-PROFILE-004** (Ubiquitous)
시스템은 `GET /users/me` 엔드포인트로의 요청에 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

**REQ-USER-PROFILE-005** (Optional)
응답 객체에 `socialProvider`가 포함되는 경우, 시스템은 enum 문자열(`KAKAO`, `GOOGLE`) 그대로 반환하되 `socialId`는 노출하지 않아야 한다. 이메일 전용 가입자(`socialProvider IS NULL`)의 경우 `socialProvider` 필드는 `null`로 반환한다. `socialId`는 모든 응답에서 제외한다.

### 3.2 REQ-USER-UPDATE: 프로필 수정

**REQ-USER-UPDATE-001** (Event-Driven)
인증된 사용자가 `PATCH /users/me/profile`로 부분 업데이트 페이로드를 제출했을 때, 시스템은 제공된 필드만 갱신하고 누락된 필드는 변경하지 않아야 한다. 수정 가능한 필드는 `nickname`, `gender`, `birthDate`, `height`, `experienceLevel`이다. 페이로드가 빈 객체(`{}`)인 경우, 시스템은 DB 변경 없이 현재 프로필을 `200 OK`로 반환해야 한다.

**REQ-USER-UPDATE-002** (Event-Driven)
사용자가 `PATCH /users/me/profile`을 호출했을 때, 시스템은 다음 검증을 수행해야 한다:
- `nickname`: 길이 2-20자
- `gender`: enum {`MALE`, `FEMALE`, `OTHER`}
- `birthDate`: ISO 8601 날짜 형식, 과거 100년 이내
- `height`: 100-250 (cm)
- `experienceLevel`: enum {`BEGINNER`, `INTERMEDIATE`, `ADVANCED`}

**REQ-USER-UPDATE-003** (Unwanted)
시스템은 `PATCH /users/me/profile`을 통한 `email`, `role`, `passwordHash`, `refreshTokenHash`, `socialProvider`, `socialId`, `premiumExpiresAt`, `createdAt`, `updatedAt`, `deletedAt` 수정 요청을 허용하지 않아야 한다. 화이트리스트 외 필드는 시스템이 차단하여 `400 Bad Request`를 반환한다.

**REQ-USER-UPDATE-004** (Event-Driven)
프로필 수정이 성공했을 때, 시스템은 갱신된 프로필 객체를 `GET /users/me` 응답 스키마와 동일한 형태로 200 응답에 반환해야 한다.

**REQ-USER-UPDATE-005** (Ubiquitous)
시스템은 프로필 수정 시 `User.updatedAt`을 현재 시각으로 자동 갱신해야 한다.

**REQ-USER-UPDATE-006** (Complex)
온보딩이 미완료된 사용자(`onboardingCompleted = false`)가 본 엔드포인트로 마지막 누락 필드를 채워 5개 필드가 모두 채워진 상태에서, 시스템은 응답의 `onboardingCompleted`를 `true`로 평가해야 한다. (단, 본 SPEC은 신규 토큰 재발급을 트리거하지 않는다 — 클라이언트는 다음 `/auth/refresh` 시점에 갱신된 JWT를 받는다.)

**REQ-USER-UPDATE-007** (Event-Driven)
사용자가 `PATCH /users/me/profile` 요청으로 인해 `onboardingCompleted`가 `false`에서 `true`로 전환되었을 때, 시스템은 응답 본문에 `onboardingJustCompleted: true` 플래그를 포함하여 클라이언트가 즉시 `POST /auth/refresh`를 호출하여 갱신된 JWT(onboardingCompleted=true)를 획득할 수 있도록 신호를 제공해야 한다. 전환이 없는 경우 해당 필드는 `false`로 포함된다.

### 3.3 REQ-USER-PASSWORD: 비밀번호 변경

**REQ-USER-PASSWORD-001** (Event-Driven)
이메일 가입자가 `PATCH /users/me/password`로 `{ currentPassword, newPassword }`를 제출했을 때, 시스템은 `currentPassword`를 `User.passwordHash`와 bcrypt 비교하고 일치할 때만 `newPassword`로 교체해야 한다.

**REQ-USER-PASSWORD-002** (Unwanted)
시스템은 `currentPassword`가 일치하지 않는 비밀번호 변경 요청을 허용하지 않아야 하며, `401 Unauthorized`로 거부해야 한다.

**REQ-USER-PASSWORD-003** (Unwanted)
시스템은 `User.passwordHash IS NULL`인 소셜 전용 계정의 비밀번호 변경 요청을 허용하지 않아야 하며, `400 Bad Request`로 거부해야 한다. 에러 메시지는 소셜 계정임을 명시해야 한다 (예: `Password change not allowed for social-only accounts`).

**REQ-USER-PASSWORD-004** (Event-Driven)
사용자가 `PATCH /users/me/password` 요청을 보냈을 때, 시스템은 `newPassword`에 대해 회원가입과 동일한 강도 정책(최소 8자, 영문 + 숫자 혼합)을 검증해야 한다.

**REQ-USER-PASSWORD-005** (Ubiquitous)
시스템은 비밀번호 변경 시 새 비밀번호를 안전한 단방향 해시(SPEC-AUTH-001 REQ-AUTH-SIGNUP-002와 동일한 해싱 정책 적용)로 변환하여 `User.passwordHash`에 저장해야 한다.

**REQ-USER-PASSWORD-006** (Event-Driven)
비밀번호 변경이 성공했을 때, 시스템은 보안상 모든 기존 Refresh Token을 무효화(`refreshTokenHash = NULL`)해야 한다. 클라이언트는 다시 로그인해야 한다.

**REQ-USER-PASSWORD-007** (Unwanted)
시스템은 `currentPassword`, `newPassword`, 또는 그 해시를 로그, 응답 본문, 에러 메시지에 노출하지 않아야 한다.

**REQ-USER-PASSWORD-008** (Event-Driven)
비밀번호 변경이 성공했을 때, 시스템은 `200 OK`와 `{ "message": "비밀번호가 변경되었습니다." }` 응답을 반환해야 한다. 응답 본문에 `passwordHash`, `refreshTokenHash`, `currentPassword`, `newPassword`를 포함하지 않아야 한다.

### 3.4 REQ-USER-DELETE: 계정 탈퇴 (소프트 삭제)

**REQ-USER-DELETE-001** (Event-Driven)
인증된 사용자가 `DELETE /users/me` 요청을 보냈을 때, 시스템은 `User.deletedAt`을 현재 시각으로 설정하여 소프트 삭제를 수행해야 한다.

**REQ-USER-DELETE-002** (Event-Driven)
계정 탈퇴가 처리되었을 때, 시스템은 해당 사용자의 `User.refreshTokenHash`를 NULL로 설정하여 모든 디바이스의 Refresh Token을 즉시 무효화해야 한다.

**REQ-USER-DELETE-003** (Unwanted)
시스템은 소프트 삭제된 사용자(`User.deletedAt IS NOT NULL`)의 JWT가 아직 만료되지 않았더라도, 해당 토큰으로의 모든 보호된 API 요청을 허용하지 않아야 하며 `401 Unauthorized`를 반환해야 한다.

**REQ-USER-DELETE-004** (Unwanted)
시스템은 계정 탈퇴 시 `RoleChangeLog`, `InviteCode.usedBy` 등 외래 참조 데이터를 삭제하거나 NULL 처리하지 않아야 한다. 감사 추적성을 위해 참조는 유지된다.

**REQ-USER-DELETE-005** (Ubiquitous)
시스템은 소프트 삭제된 사용자의 이메일(`User.email`)을 그대로 보존해야 한다. 동일 이메일로의 재가입은 본 SPEC 범위에서 허용하지 않는다 (`email` UNIQUE 제약 유지). 재가입 정책은 후속 SPEC에서 다룬다.

**REQ-USER-DELETE-006** (Event-Driven)
계정 탈퇴가 성공했을 때, 시스템은 `200 OK` 또는 `204 No Content`와 함께 본문 없이 (또는 `{ deletedAt: ISO8601 }`만 포함하여) 응답해야 한다. 사용자 프로필 데이터를 응답에 노출하지 않는다.

**REQ-USER-DELETE-008** (Unwanted)
시스템은 소프트 삭제된 사용자(`User.deletedAt IS NOT NULL`)가 `POST /auth/login`으로 로그인을 시도하는 경우, 해당 요청을 허용하지 않아야 하며 `401 Unauthorized`를 반환해야 한다. 이는 SPEC-AUTH-001의 `validateUser` 로직에서 `deletedAt` 체크를 추가하여 강제된다.

**REQ-USER-DELETE-009** (Unwanted)
시스템은 `role=ADMIN`인 사용자가 `DELETE /users/me`로 자신의 계정을 소프트 삭제하는 것을 허용하지 않아야 하며, `403 Forbidden`과 `{ "code": "ADMIN_SELF_DELETE_NOT_ALLOWED" }` 에러 메시지를 반환해야 한다.

### 3.5 REQ-USER-ADMIN: Admin 사용자 조회

**REQ-USER-ADMIN-001** (Ubiquitous)
시스템은 `GET /users`, `GET /users/:id` 엔드포인트를 `@Roles(UserRole.ADMIN)` 가드로 보호하여 Admin이 아닌 사용자가 호출하면 `403 Forbidden`을 반환해야 한다.

**REQ-USER-ADMIN-002** (Event-Driven)
Admin이 `GET /users?page=N&limit=M` 요청을 보냈을 때, 시스템은 페이지네이션된 사용자 목록을 반환해야 한다. 기본값은 `page=1, limit=20`이며, `limit`은 최대 100으로 제한한다. `limit`는 최소 1에서 최대 100 사이의 정수여야 하며, 범위를 벗어나면 `400 Bad Request`를 반환한다.

**REQ-USER-ADMIN-003** (Ubiquitous)
시스템은 `GET /users` 응답에 다음 메타데이터를 포함해야 한다: `items` (사용자 배열, `GET /users/me`와 동일 스키마), `total` (활성 사용자(소프트 삭제되지 않은 사용자)의 총 수), `page`, `limit`, `totalPages`.

**REQ-USER-ADMIN-004** (Ubiquitous)
시스템은 `GET /users` 기본 응답에서 소프트 삭제된 사용자(`deletedAt IS NOT NULL`)를 제외해야 한다. 향후 `?includeDeleted=true` 쿼리 파라미터 지원은 옵션이며 본 SPEC에서는 의무화하지 않는다.

**REQ-USER-ADMIN-005** (Event-Driven)
Admin이 `GET /users/:id` 요청을 보냈을 때, 시스템은 다음과 같이 동작해야 한다:
- 해당 `id`의 사용자가 존재하고 소프트 삭제되지 않은(`deletedAt IS NULL`) 경우: `200 OK`와 `GET /users/me`와 동일한 스키마로 프로필을 반환한다.
- 해당 `id`의 사용자가 존재하지 않거나 소프트 삭제된(`deletedAt IS NOT NULL`) 경우: `404 Not Found`를 반환한다.

**REQ-USER-ADMIN-006** (Unwanted)
시스템은 Admin 조회 응답에도 `passwordHash`, `refreshTokenHash`, `socialId`를 포함하지 않아야 한다 (REQ-USER-PROFILE-002와 동일 마스킹 정책).

**REQ-USER-ADMIN-007** (Ubiquitous)
시스템은 Admin이 본인을 포함한 모든 사용자를 조회할 수 있어야 한다 (자기 자신 조회 제한 없음).

---

## 4. 비기능 요구사항 (Non-Functional Requirements)

### 4.1 보안 (Security)

- **NFR-SEC-001**: 모든 `/users/me/*` 엔드포인트는 `JwtAuthGuard`로 보호되며, JWT 누락/만료 시 `401 Unauthorized`를 반환한다.
- **NFR-SEC-002**: 모든 `/users` (Admin) 엔드포인트는 `JwtAuthGuard` + `RolesGuard(@Roles(UserRole.ADMIN))`로 이중 보호된다.
- **NFR-SEC-003**: 응답 시리얼라이제이션은 DTO 기반 화이트리스트(`class-transformer` `@Expose()` 또는 명시적 매핑)로 수행하며, `passwordHash`, `refreshTokenHash`, `socialId`는 절대 노출하지 않는다.
- **NFR-SEC-004**: `PATCH /users/me/profile`은 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`로 화이트리스트 외 필드 주입을 차단한다.
- **NFR-SEC-005**: 비밀번호 변경 시 `newPassword`는 SPEC-AUTH-001 REQ-AUTH-SIGNUP-002와 동일하게 bcrypt(cost factor 10)로 해싱한다.
- **NFR-SEC-006**: 비밀번호 변경 후 모든 Refresh Token이 무효화되므로, 클라이언트는 명시적 재로그인을 요구받는다.
- **NFR-SEC-007**: 소프트 삭제 검사(`deletedAt IS NOT NULL → 401`)는 `JwtStrategy.validate()` 단계에서 수행되어, 캐시되거나 잔존하는 JWT가 즉시 무력화된다.

### 4.2 온보딩 가드 (Onboarding Guard)

- **NFR-ONBOARD-001**: 온보딩 가드는 **JWT payload의 `onboardingCompleted` 필드**를 기준으로 동작한다. `onboardingCompleted=false`인 사용자는 `GET /users/me`를 제외한 모든 `/users/me/*` 엔드포인트에 접근할 수 없으며, `403 Forbidden`과 `{ "code": "ONBOARDING_REQUIRED" }`를 반환한다. 온보딩 완료 직후에는 NFR-ONBOARD-003에 따라 클라이언트가 JWT를 갱신해야 한다.
- **NFR-ONBOARD-002**: Admin 권한 사용자는 `role=ADMIN` 클레임을 보유한 JWT로 인증된 경우, 온보딩 가드에서 면제된다. `JwtAuthGuard` 통과 후 `RolesGuard`에서 Admin 역할 확인 시 온보딩 가드를 건너뛴다.
- **NFR-ONBOARD-003**: 모바일 클라이언트는 `PATCH /users/me/profile` 응답의 `onboardingJustCompleted=true` 플래그를 감지하면 즉시 `POST /auth/refresh`를 호출하여 갱신된 JWT를 획득해야 한다. 이를 통해 JWT payload의 `onboardingCompleted` 값과 DB 실제 상태 간의 불일치 시간(최대 15분)을 최소화한다.

### 4.3 성능 (Performance)

- **NFR-PERF-001**: `GET /users/me` 응답 시간 P95 ≤ 100ms (단일 PK 조회).
- **NFR-PERF-002**: `PATCH /users/me/profile` 응답 시간 P95 ≤ 200ms.
- **NFR-PERF-003**: `PATCH /users/me/password` 응답 시간 P95 ≤ 500ms (bcrypt 비교 + 해싱 포함).
- **NFR-PERF-004**: `GET /users` (Admin 페이지네이션) 응답 시간 P95 ≤ 300ms (limit=20 기준).

### 4.4 감사 가능성 (Auditability)

- **NFR-AUDIT-001**: 비밀번호 변경 및 계정 탈퇴는 백엔드 로그(`info` 레벨)에 `{ userId, action, timestamp, ip }` 형태로 기록한다. 단, 비밀번호 평문이나 해시는 로그에 포함하지 않는다.
- **NFR-AUDIT-002**: `RoleChangeLog`는 SPEC-AUTH-001 소유이므로 본 SPEC에서 새 로그 모델을 추가하지 않는다. 향후 `UserChangeLog` 또는 `AuditLog` 통합 모델 도입은 후속 SPEC에서 검토한다.

### 4.5 호환성 (Compatibility)

- **NFR-COMPAT-001**: 모바일 클라이언트는 비밀번호 변경 성공 후 Refresh Token이 무효화됨을 인지하고, 사용자에게 재로그인을 안내해야 한다.
- **NFR-COMPAT-002**: 계정 탈퇴 성공 후 모바일 클라이언트는 로컬 토큰(Zustand 메모리 + Expo SecureStore)을 즉시 삭제하고 로그인 화면으로 리다이렉트해야 한다.

---

## 5. 변경 대상 파일 목록 (Affected Files)

### 5.1 백엔드 (apps/backend/)

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `prisma/schema.prisma` | 수정 | `User` 모델에 `deletedAt DateTime?` 컬럼 추가 |
| `prisma/migrations/` | 생성 | `User.deletedAt` 추가 마이그레이션 |
| `src/users/users.module.ts` | 수정 | `UsersController` 등록, `AuthModule` 의존성 확인 |
| `src/users/users.controller.ts` | 생성 | `GET /users/me`, `PATCH /users/me/profile`, `PATCH /users/me/password`, `DELETE /users/me`, `GET /users`, `GET /users/:id` 라우트 |
| `src/users/users.service.ts` | 수정 | `getMe`, `updateProfile`, `changePassword`, `softDelete`, `findAll`, `findById` 메서드 추가 |
| `src/users/dto/update-profile.dto.ts` | 생성 | `nickname`, `gender`, `birthDate`, `height`, `experienceLevel` 부분 업데이트 DTO |
| `src/users/dto/change-password.dto.ts` | 생성 | `currentPassword`, `newPassword` DTO + 강도 검증 |
| `src/users/dto/user-response.dto.ts` | 생성 | 응답 마스킹 DTO (`passwordHash`/`refreshTokenHash`/`socialId` 제외), `onboardingCompleted` 계산 필드 포함 |
| `src/users/dto/list-users-query.dto.ts` | 생성 | Admin 목록 조회 쿼리 DTO (`page`, `limit`) |
| `src/users/dto/paginated-users-response.dto.ts` | 생성 | `items`, `total`, `page`, `limit`, `totalPages` 응답 DTO |
| `src/auth/strategies/jwt.strategy.ts` | 수정 | `validate(payload)`에서 `deletedAt IS NOT NULL` 시 `UnauthorizedException` 발생 |
| `src/auth/guards/jwt-auth.guard.ts` | 수정 (선택) | 또는 `JwtStrategy.validate()`에서만 처리하면 변경 불요 |
| `test/users/users.controller.spec.ts` | 생성 | 컨트롤러 단위 테스트 |
| `test/users/users.service.spec.ts` | 생성 | 서비스 단위 테스트 (소프트 삭제, 비밀번호 변경 분기 포함) |
| `test/users/users.e2e-spec.ts` | 생성 | E2E 테스트 (인증/권한/소프트 삭제 후 차단 검증) |

### 5.2 모바일 클라이언트 (apps/mobile/)

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `app/(tabs)/profile.tsx` | 생성 | 프로필 조회 화면 (`GET /users/me` 표시) |
| `app/profile/edit.tsx` | 생성 | 프로필 수정 폼 (`PATCH /users/me/profile`) |
| `app/profile/change-password.tsx` | 생성 | 비밀번호 변경 폼 (이메일 가입자 한정 노출) |
| `app/profile/delete-account.tsx` | 생성 | 계정 탈퇴 확인 화면 + 2단계 확인 (`DELETE /users/me`) |
| `services/users.ts` | 생성 | `getMe`, `updateProfile`, `changePassword`, `deleteAccount` API 호출 함수 |
| `hooks/useUser.ts` | 생성 | TanStack Query 기반 사용자 프로필 훅 (`useMe`, `useUpdateProfile` 등) |
| `stores/authStore.ts` | 수정 | `clearTokens()` 헬퍼 추가 (탈퇴/비밀번호 변경 후 호출) |

### 5.3 공유 패키지 (packages/types/)

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/user.ts` | 수정 | `UserProfile`, `UpdateProfilePayload`, `ChangePasswordPayload`, `PaginatedUsersResponse` 타입 추가. SPEC-AUTH-001에서 정의된 `UserRole`/`Gender`/`ExperienceLevel`/`SocialProvider`를 재사용 |

---

## 6. 제외 사항 (Exclusions - What NOT to Build)

본 SPEC에서 **명시적으로 제외하는 항목**은 다음과 같다. 이는 후속 SPEC 또는 영구 비목표로 분류된다.

1. **Admin 권한 변경 (`PATCH /users/:id/role`)**: SPEC-AUTH-001 REQ-AUTH-RBAC-005~006에서 이미 정의됨. 본 SPEC에서 중복 정의하거나 변경하지 않는다.
2. **프로필 사진/아바타 업로드**: PRD에 정의되지 않았으며, 비공개 소규모 앱 특성상 우선순위가 낮다. 후속 SPEC(SPEC-USER-AVATAR-XXX)에서 검토 가능.
3. **공개 사용자 프로필**: 비공개 초대제 앱이므로 비인증 사용자가 다른 사용자 정보를 조회하는 엔드포인트는 만들지 않는다.
4. **이메일 변경**: `User.email` 수정은 본 SPEC 범위 밖이다. 변경 시 이메일 재인증 플로우가 필요하므로 후속 SPEC에서 다룬다.
5. **이메일 인증 메일 재발송**: 가입 시 발송된 인증 메일을 재발송하는 엔드포인트는 본 SPEC 범위 밖이다.
6. **소셜 계정 연동/해제**: 이메일 가입자에 Kakao/Google을 추가 연결하거나, 소셜 사용자에 비밀번호를 추가 설정하는 기능은 다루지 않는다.
7. **30일 후 하드 삭제 배치 작업**: 소프트 삭제 후 30일이 지난 계정의 영구 삭제는 본 SPEC 범위 밖이며, SPEC-OPS-XXX에서 다룬다. `deletedAt + 30 days < now()` 사용자의 영구 삭제 및 PII 폐기는 운영 SPEC에서 다룬다. 본 SPEC은 소프트 삭제 자체와 그에 따른 인증 차단까지만 정의한다.
8. **Admin이 다른 사용자 프로필 수정**: Admin이 다른 사용자의 닉네임/신체 정보를 강제로 변경하는 기능은 다루지 않는다. Admin은 조회와 권한 변경(SPEC-AUTH-001)만 수행한다.
9. **Admin이 다른 사용자 비밀번호 재설정**: 사용자를 대신해 비밀번호를 재설정하거나 임시 비밀번호를 발급하는 운영 기능은 본 SPEC 범위 밖이다.
10. **Admin 초대 코드 관리 UI/API**: 초대 코드 발급/만료/회수 등은 SPEC-ADMIN-001(별도)에서 다룬다.
11. **운동 라이브러리, 운동 세션 기록, AI 추천**: 각 도메인은 별도 SPEC에서 다룬다.
12. **사용자 활동 이력/감사 통합 로그**: `UserChangeLog` 또는 통합 `AuditLog` 모델 도입은 후속 SPEC에서 검토한다.
13. **CSV/Excel 사용자 목록 내보내기**: 운영 편의 기능으로 후속 SPEC에서 다룬다.
14. **비밀번호 변경 Rate Limiting**: `PATCH /users/me/password`의 `currentPassword` 반복 실패에 대한 IP 기반 또는 사용자 기반 rate limiting은 본 SPEC 범위 밖이다. 후속 SPEC-AUTH-REVOKE-XXX에서 NestJS Throttler 적용과 함께 다룬다. 현재는 실패 시도를 경고 레벨 로그(사용자 ID + 실패 횟수, PII 미포함)로 기록한다.

---

## 7. mx_plan (MX Tag Annotation Targets)

### 7.1 @MX:ANCHOR 대상 (high fan_in 함수)

- `users.service.ts :: getMe(userId)`: 본인 프로필 조회 진입점, 클라이언트의 모든 프로필 화면이 의존
- `users.service.ts :: softDelete(userId)`: 계정 탈퇴의 단일 진입점, 부수효과(refreshTokenHash 무효화) 보장 지점
- `users.service.ts :: changePassword(userId, current, next)`: 비밀번호 변경 진입점, bcrypt 비교 + 해싱 + 토큰 무효화 통합 지점
- `users.controller.ts :: PATCH /users/me/profile`: 프로필 수정 라우트, 화이트리스트 검증 통과 지점
- `jwt.strategy.ts :: validate(payload)`: 소프트 삭제 사용자 차단(`deletedAt IS NOT NULL → throw`)이 강제되는 단일 지점 (SPEC-AUTH-001과 공유)
- `user-response.dto.ts :: toResponse(user)`: 응답 마스킹 단일 지점, `passwordHash`/`refreshTokenHash`/`socialId` 노출 방지의 불변식 책임

### 7.2 @MX:WARN 대상 (danger zone, requires @MX:REASON)

- `users.service.ts :: softDelete()`: `refreshTokenHash` 무효화 누락 시 보안 사고 (REASON: 단일 트랜잭션 내에서 `deletedAt` 설정과 `refreshTokenHash = NULL`을 동시에 처리해야 함)
- `users.service.ts :: changePassword()`: 비밀번호 변경 후 Refresh Token 무효화 누락 시 토큰 탈취 시나리오에서 변경된 비밀번호 무용지물 (REASON: NFR-SEC-006 강제)
- `jwt.strategy.ts :: validate()`: `deletedAt` 검사 누락 시 탈퇴한 사용자가 잔존 JWT로 접근 가능 (REASON: REQ-USER-DELETE-003 불변식)
- `user-response.dto.ts :: toResponse()`: `class-transformer` `@Exclude()` 누락 시 시크릿 노출 (REASON: NFR-SEC-003 마스킹 정책)

### 7.3 @MX:NOTE 대상

- `change-password.dto.ts`: `newPassword` 강도 정책 명시 (SPEC-AUTH-001 REQ-AUTH-SIGNUP-001과 동일: 8자 이상, 영문+숫자 혼합)
- `update-profile.dto.ts`: 각 필드 검증 규칙 명시 (`nickname` 2-20자, `height` 100-250cm, `birthDate` 100년 이내)
- `user-response.dto.ts`: `onboardingCompleted` 계산식 명시 (5개 필드 AND)
- `users.service.ts :: findAll(page, limit)`: `deletedAt IS NULL` 기본 필터 명시
- `users.controller.ts`: 컨트롤러 단위 `@UseGuards(JwtAuthGuard)` 적용 및 Admin 엔드포인트의 `@Roles(ADMIN)` 추가 명시

### 7.4 @MX:TODO 대상 (Run 단계 GREEN에서 해소)

- 30일 후 하드 삭제 배치 작업 — 본 SPEC 범위 밖, SPEC-OPS-XXX로 이관
- `?includeDeleted=true` 쿼리 지원 (Admin 옵션) — 본 SPEC에서는 의무화하지 않음, 필요 시 후속 작업
- `UserChangeLog` 또는 통합 `AuditLog` 모델 — 후속 SPEC 검토
- 비밀번호 변경 후 클라이언트 강제 로그아웃 UX 통합 — 모바일 Phase 6에서 처리

---

## 8. 추적성 (Traceability)

| REQ ID | acceptance.md 시나리오 | 출처 |
|--------|------------------------|------|
| REQ-USER-PROFILE-001 | AC-PROFILE-01 | PRD 3.2.1 |
| REQ-USER-PROFILE-002 | AC-PROFILE-01, AC-SECURITY-01 | PRD 8.2 |
| REQ-USER-PROFILE-003 | AC-PROFILE-01, AC-PROFILE-03 | PRD 3.2.1, SPEC-AUTH-001 REQ-AUTH-JWT-002 |
| REQ-USER-PROFILE-004 | AC-PROFILE-02 | PRD 3.1.2 |
| REQ-USER-PROFILE-005 | AC-PROFILE-01 | PRD 3.2.1 |
| REQ-USER-UPDATE-001 | AC-UPDATE-01 | PRD 3.2.2 |
| REQ-USER-UPDATE-002 | AC-UPDATE-01, AC-UPDATE-02 | PRD 3.2.2 |
| REQ-USER-UPDATE-003 | AC-UPDATE-03, AC-SECURITY-01 | PRD 3.2.2, 8.2 |
| REQ-USER-UPDATE-004 | AC-UPDATE-01 | PRD 3.2.2 |
| REQ-USER-UPDATE-005 | AC-UPDATE-01 | PRD 3.2.2 |
| REQ-USER-UPDATE-006 | AC-PROFILE-03 | SPEC-AUTH-001 REQ-AUTH-ONBOARD-004 |
| REQ-USER-PASSWORD-001 | AC-PASSWORD-01 | PRD 3.2.3 |
| REQ-USER-PASSWORD-002 | AC-PASSWORD-02 | PRD 3.2.3 |
| REQ-USER-PASSWORD-003 | AC-PASSWORD-03 | PRD 3.2.3 |
| REQ-USER-PASSWORD-004 | AC-PASSWORD-04 | PRD 3.1.1, SPEC-AUTH-001 REQ-AUTH-SIGNUP-001 |
| REQ-USER-PASSWORD-005 | AC-PASSWORD-01 | PRD 8.2, SPEC-AUTH-001 REQ-AUTH-SIGNUP-002 |
| REQ-USER-PASSWORD-006 | AC-PASSWORD-05 | PRD 8.2 |
| REQ-USER-PASSWORD-007 | AC-SECURITY-01 | PRD 8.2 |
| REQ-USER-DELETE-001 | AC-DELETE-01 | PRD 3.2.4, 8.3 (GDPR) |
| REQ-USER-DELETE-002 | AC-DELETE-01, AC-DELETE-02 | PRD 8.3 |
| REQ-USER-DELETE-003 | AC-DELETE-02 | PRD 8.3 |
| REQ-USER-DELETE-004 | AC-DELETE-03 | PRD 8.3 (감사 보존) |
| REQ-USER-DELETE-005 | AC-DELETE-04 | PRD 3.2.4 |
| REQ-USER-DELETE-006 | AC-DELETE-01 | PRD 3.2.4 |
| REQ-USER-DELETE-008 | AC-DELETE-02 (케이스 C) | 소프트 삭제 사용자 로그인 차단 |
| REQ-USER-DELETE-009 | AC-DELETE-05 | 서비스 운영 연속성 보장 |
| REQ-USER-UPDATE-007 | AC-PROFILE-03 | 온보딩 완료 즉시 JWT 갱신 신호 |
| REQ-USER-PASSWORD-008 | AC-PASSWORD-01 | 비밀번호 변경 응답 명세 |
| REQ-USER-ADMIN-001 | AC-ADMIN-02 | PRD 3.3.1 |
| REQ-USER-ADMIN-002 | AC-ADMIN-01, AC-ADMIN-04 | PRD 3.3.1 |
| REQ-USER-ADMIN-003 | AC-ADMIN-01 | PRD 3.3.1 |
| REQ-USER-ADMIN-004 | AC-ADMIN-01 | PRD 8.3 (소프트 삭제 마스킹) |
| REQ-USER-ADMIN-005 | AC-ADMIN-03, AC-ADMIN-05 | PRD 3.3.1 |
| REQ-USER-ADMIN-006 | AC-ADMIN-01, AC-ADMIN-03, AC-SECURITY-01 | PRD 8.2 |
| REQ-USER-ADMIN-007 | AC-ADMIN-03 | PRD 3.3.1 |
