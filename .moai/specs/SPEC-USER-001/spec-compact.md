---
id: SPEC-USER-001
version: "1.0.1"
status: draft
created_at: "2026-05-11"
updated_at: "2026-05-11"
labels: ["user", "profile", "backend", "mobile"]
---

# SPEC-USER-001 (Compact)

사용자 프로필 관리 — SPEC-AUTH-001 위에서 동작하는 프로필 레이어. 본인 프로필 조회/수정, 비밀번호 변경(이메일 가입자 한정), 계정 탈퇴(소프트 삭제), Admin 사용자 조회를 정의한다.

---

## EARS 요구사항

### REQ-USER-PROFILE: 본인 프로필 조회

- **REQ-USER-PROFILE-001** (Event-Driven): 인증된 사용자가 `GET /users/me`를 호출했을 때, 시스템은 프로필(`id`, `email`, `role`, `nickname`, `gender`, `birthDate`, `height`, `experienceLevel`, `premiumExpiresAt`, `socialProvider`, `onboardingCompleted`, `createdAt`)을 200으로 반환해야 한다.
- **REQ-USER-PROFILE-002** (Unwanted): 시스템은 응답에 `passwordHash`, `refreshTokenHash`, `socialId`를 포함하지 않아야 한다.
- **REQ-USER-PROFILE-003** (Ubiquitous): `onboardingCompleted`는 5개 온보딩 필드(`nickname`, `gender`, `birthDate`, `height`, `experienceLevel`)가 모두 non-null일 때만 `true`로 계산되어야 한다.
- **REQ-USER-PROFILE-004** (Ubiquitous): 본 엔드포인트는 `JwtAuthGuard`로 보호되어 JWT 누락/만료 시 `401`을 반환해야 한다.
- **REQ-USER-PROFILE-005** (Optional): 응답의 `socialProvider`는 enum 문자열로 반환하되 `socialId`는 노출하지 않아야 한다.

### REQ-USER-UPDATE: 프로필 수정

- **REQ-USER-UPDATE-001** (Event-Driven): 사용자가 `PATCH /users/me/profile`로 부분 페이로드를 제출했을 때, 시스템은 제공된 필드(`nickname`, `gender`, `birthDate`, `height`, `experienceLevel`)만 갱신해야 한다.
- **REQ-USER-UPDATE-002** (Event-Driven): 시스템은 `nickname`(2-20자), `gender`(enum), `birthDate`(ISO 8601, 100년 이내), `height`(100-250cm), `experienceLevel`(enum)을 검증해야 한다.
- **REQ-USER-UPDATE-003** (Unwanted): 시스템은 `email`, `role`, `passwordHash`, `refreshTokenHash`, `socialProvider`, `socialId`, `premiumExpiresAt`, `createdAt`, `updatedAt`, `deletedAt` 수정을 허용하지 않아야 한다 (`forbidNonWhitelisted: true`).
- **REQ-USER-UPDATE-004** (Event-Driven): 수정 성공 시 시스템은 `GET /users/me`와 동일 스키마로 갱신된 프로필을 200으로 반환해야 한다.
- **REQ-USER-UPDATE-005** (Ubiquitous): 시스템은 `User.updatedAt`을 현재 시각으로 자동 갱신해야 한다.
- **REQ-USER-UPDATE-006** (Complex): 온보딩 미완료 사용자가 마지막 누락 필드를 채워 5개가 모두 채워진 상태에서, 응답의 `onboardingCompleted`는 `true`로 평가되어야 한다 (JWT 재발급은 트리거하지 않음).
- **REQ-USER-UPDATE-007** (Event-Driven): `onboardingCompleted`가 `false→true`로 전환되었을 때, 시스템은 응답에 `onboardingJustCompleted: true` 플래그를 포함하여 클라이언트의 즉시 `POST /auth/refresh` 호출을 신호해야 한다.

### REQ-USER-PASSWORD: 비밀번호 변경

- **REQ-USER-PASSWORD-001** (Event-Driven): 이메일 가입자가 `PATCH /users/me/password`로 `{ currentPassword, newPassword }`를 제출했을 때, 시스템은 `currentPassword`를 bcrypt 비교하고 일치할 때만 새 비밀번호로 교체해야 한다.
- **REQ-USER-PASSWORD-002** (Unwanted): 시스템은 `currentPassword` 불일치 시 `401 Unauthorized`로 거부해야 한다.
- **REQ-USER-PASSWORD-003** (Unwanted): 시스템은 `passwordHash IS NULL`인 소셜 전용 계정의 비밀번호 변경 요청을 `400 Bad Request`로 거부해야 한다 (메시지에 소셜 계정임을 명시).
- **REQ-USER-PASSWORD-004** (Event-Driven): 시스템은 `newPassword`에 SPEC-AUTH-001과 동일한 강도 정책(최소 8자, 영문+숫자 혼합)을 적용해야 한다.
- **REQ-USER-PASSWORD-005** (Ubiquitous): 새 비밀번호는 bcrypt(cost factor 10)로 해싱되어 저장되어야 한다.
- **REQ-USER-PASSWORD-006** (Event-Driven): 비밀번호 변경 성공 시 시스템은 `refreshTokenHash = NULL`로 모든 Refresh Token을 무효화해야 한다.
- **REQ-USER-PASSWORD-007** (Unwanted): 시스템은 `currentPassword`/`newPassword`/그 해시를 로그·응답·에러에 노출하지 않아야 한다.
- **REQ-USER-PASSWORD-008** (Event-Driven): 비밀번호 변경 성공 시 시스템은 `200 OK`와 `{ "message": "비밀번호가 변경되었습니다." }`만 반환하고, `passwordHash`/`refreshTokenHash`/평문 비밀번호를 응답에 포함하지 않아야 한다.

### REQ-USER-DELETE: 계정 탈퇴 (소프트 삭제)

- **REQ-USER-DELETE-001** (Event-Driven): 인증된 사용자가 `DELETE /users/me`를 호출했을 때, 시스템은 `User.deletedAt = now()`로 소프트 삭제를 수행해야 한다.
- **REQ-USER-DELETE-002** (Event-Driven): 탈퇴 시 시스템은 `User.refreshTokenHash = NULL`로 모든 Refresh Token을 무효화해야 한다.
- **REQ-USER-DELETE-003** (Unwanted): 시스템은 `deletedAt IS NOT NULL`인 사용자의 JWT가 만료 전이라도 보호된 API 요청을 허용하지 않아야 하며 `401`을 반환해야 한다.
- **REQ-USER-DELETE-004** (Unwanted): 시스템은 탈퇴 시 `RoleChangeLog`, `InviteCode.usedBy` 등 외래 참조를 삭제·NULL 처리하지 않아야 한다 (감사 추적 보존).
- **REQ-USER-DELETE-005** (Ubiquitous): 시스템은 소프트 삭제된 사용자의 `email`을 보존하며, 동일 이메일 재가입은 본 SPEC에서 허용하지 않는다 (UNIQUE 제약 유지).
- **REQ-USER-DELETE-006** (Event-Driven): 탈퇴 성공 시 시스템은 `200`/`204`로 본문 없이 또는 `{ deletedAt }`만 반환하고, 프로필 데이터를 노출하지 않아야 한다.
- **REQ-USER-DELETE-008** (Unwanted): 시스템은 소프트 삭제된 사용자가 `POST /auth/login`으로 로그인을 시도하는 경우 `401 Unauthorized`로 차단해야 한다.
- **REQ-USER-DELETE-009** (Unwanted): 시스템은 `role=ADMIN` 사용자가 `DELETE /users/me`로 자기 자신을 소프트 삭제하는 요청을 `403 Forbidden`과 `{ "code": "ADMIN_SELF_DELETE_NOT_ALLOWED" }`로 차단해야 한다.

### REQ-USER-ADMIN: Admin 사용자 조회

- **REQ-USER-ADMIN-001** (Ubiquitous): 시스템은 `GET /users`, `GET /users/:id`를 `@Roles(UserRole.ADMIN)` 가드로 보호하여 비-Admin에게 `403`을 반환해야 한다.
- **REQ-USER-ADMIN-002** (Event-Driven): Admin이 `GET /users?page=N&limit=M`을 호출했을 때, 시스템은 페이지네이션된 목록을 반환해야 한다 (기본 `page=1, limit=20`, `limit ≤ 100`).
- **REQ-USER-ADMIN-003** (Ubiquitous): 응답은 `items`, `total`, `page`, `limit`, `totalPages`를 포함해야 한다.
- **REQ-USER-ADMIN-004** (Ubiquitous): 기본 응답에서 소프트 삭제된 사용자(`deletedAt IS NOT NULL`)는 제외되어야 한다.
- **REQ-USER-ADMIN-005** (Event-Driven): Admin이 `GET /users/:id`를 호출했을 때, 활성 사용자(`deletedAt IS NULL`)는 200으로, 비존재 또는 소프트 삭제된 사용자(`deletedAt IS NOT NULL`)는 `404`를 반환해야 한다.
- **REQ-USER-ADMIN-006** (Unwanted): Admin 응답에도 `passwordHash`, `refreshTokenHash`, `socialId`를 포함하지 않아야 한다.
- **REQ-USER-ADMIN-007** (Ubiquitous): Admin은 본인을 포함한 모든 활성 사용자를 조회할 수 있어야 한다.

---

## 인수 시나리오 요약 (Given-When-Then)

### AC-PROFILE-01: GET /users/me 정상 조회
- Given: 온보딩 완료 사용자 U1 + 유효한 토큰
- When: `GET /users/me` 호출
- Then: 200 + 전체 프로필(`passwordHash`/`refreshTokenHash`/`socialId` 제외) + `onboardingCompleted=true`

### AC-PROFILE-02: 토큰 누락/만료 시 401
- Given: 토큰 없음 / 만료 / 변조
- When: `GET /users/me` 호출
- Then: 401 Unauthorized, 프로필 데이터 없음

### AC-PROFILE-03: 온보딩 미완료 사용자
- Given: `height`만 NULL인 사용자
- When: `GET /users/me` 호출
- Then: 200, `onboardingCompleted=false`, `height=null`

### AC-UPDATE-01: 정상 부분 수정
- Given: U1 + 유효 토큰
- When: `PATCH /users/me/profile` `{ nickname, height, experienceLevel }`
- Then: 200, 갱신된 필드 반영, 미수정 필드 유지, `updatedAt` 갱신

### AC-UPDATE-02: 검증 실패
- When: `nickname="a"`, `height=500`, `experienceLevel="EXPERT"`, `birthDate="not-a-date"`, `gender="ALIEN"`
- Then: 모두 400, DB 변경 없음

### AC-UPDATE-03: 화이트리스트 외 필드 차단
- When: `{ nickname: "valid", role: "ADMIN", email: "x", passwordHash: "y" }`
- Then: 400, `role`/`email`/`passwordHash` 변경 없음

### AC-PASSWORD-01: 정상 변경
- Given: 이메일 가입자, `currentPassword="OldPass123"` 일치
- When: `PATCH /users/me/password` `{ currentPassword, newPassword: "NewPass456" }`
- Then: 200, `passwordHash` 갱신(bcrypt cost 10), `refreshTokenHash=NULL`

### AC-PASSWORD-02: currentPassword 불일치
- When: 잘못된 `currentPassword`
- Then: 401, `passwordHash`/`refreshTokenHash` 변경 없음

### AC-PASSWORD-03: 소셜 전용 계정 차단
- Given: `passwordHash=NULL` 소셜 계정
- When: `PATCH /users/me/password` 시도
- Then: 400, 소셜 계정 메시지

### AC-PASSWORD-04: newPassword 강도 검증
- When: `"short1"`, `"onlyletters"`, `"12345678"`, `""`
- Then: 모두 400

### AC-PASSWORD-05: 변경 후 Refresh Token 무효화
- Given: AC-PASSWORD-01 직후, 이전 Refresh Token 보유
- When: `POST /auth/refresh` 호출
- Then: 401

### AC-DELETE-01: 정상 탈퇴 (소프트 삭제)
- Given: U1 활성 사용자
- When: `DELETE /users/me`
- Then: 200/204, `deletedAt = now()`, `refreshTokenHash = NULL`, 응답에 프로필 데이터 없음

### AC-DELETE-02: 탈퇴 후 인증 차단
- Given: 탈퇴 직후, 기존 Access Token / Refresh Token 보유
- When: (A) `GET /users/me`, (B) `POST /auth/refresh`, (C) `POST /auth/login`
- Then: 모두 401

### AC-DELETE-03: 외래 참조 보존
- Given: U1의 `RoleChangeLog` 참조, `InviteCode.usedBy=U1.id` 존재
- When: U1 탈퇴
- Then: `RoleChangeLog`/`InviteCode.usedBy` 변경 없음, `User.id`/`email` DB 보존

### AC-DELETE-04: 동일 이메일 재가입 차단
- When: 같은 이메일로 재가입 시도
- Then: 409 또는 400 (이메일 중복)

### AC-DELETE-05: Admin 자기 삭제 차단
- Given: Admin `A1`의 유효한 Access Token
- When: `DELETE /users/me`를 Admin 토큰으로 호출
- Then: 403 Forbidden, `A1.deletedAt`은 `null` 유지, `refreshTokenHash` 변경 없음

### AC-ADMIN-01: Admin 페이지네이션 조회
- Given: 활성 25명 + 소프트 삭제 3명
- When: `GET /users?page=1&limit=20`
- Then: 200, `items.length=20`, `total=25`, `totalPages=2`, 시크릿 필드 없음

### AC-ADMIN-02: Non-Admin 차단
- When: USER/PREMIUM 토큰으로 `GET /users`
- Then: 403 (토큰 없으면 401)

### AC-ADMIN-03: Admin 특정 사용자 조회
- When: `GET /users/:id` (다른 사용자 또는 본인)
- Then: 200 + 프로필, 시크릿 필드 없음

### AC-ADMIN-04: limit 경계 검증
- When: `limit=100`, `limit=101`, `limit=0`, `limit=-1`, 쿼리 없음
- Then: 100 OK, 101/0/-1 400, 없음 200(기본 20)

### AC-ADMIN-05: 존재하지 않는 ID / 소프트 삭제된 ID
- When: 비존재 ID 또는 소프트 삭제된 사용자 ID 조회
- Then: 모두 404

### AC-SECURITY-01: 시크릿/PII 노출 차단 (통합)
- When: 모든 6개 엔드포인트 호출 (성공/실패)
- Then: 응답·로그 어디에도 `passwordHash`, `refreshTokenHash`, `socialId`, JWT secret, 평문 비밀번호 없음

### AC-PERF-01: 성능 기준선
- Given: 1,000명 시드
- Then: P95 — `/users/me` ≤ 100ms, `/users/me/profile` ≤ 200ms, `/users/me/password` ≤ 500ms, `/users` ≤ 300ms

---

## 변경 대상 파일 요약

### 백엔드 (apps/backend/)

- `prisma/schema.prisma` — `User.deletedAt DateTime?` 추가
- `prisma/migrations/` — `add_user_deleted_at`
- `src/users/users.module.ts` — Controller 등록
- `src/users/users.controller.ts` — 6개 라우트 (`me` 4개 + Admin 2개)
- `src/users/users.service.ts` — `getMe`, `updateProfile`, `changePassword`, `softDelete`, `findAll`, `findById`
- `src/users/dto/update-profile.dto.ts`
- `src/users/dto/change-password.dto.ts`
- `src/users/dto/user-response.dto.ts` (시크릿 마스킹 + `onboardingCompleted` 계산)
- `src/users/dto/list-users-query.dto.ts`
- `src/users/dto/paginated-users-response.dto.ts`
- `src/auth/strategies/jwt.strategy.ts` — `deletedAt IS NOT NULL` 시 401
- 테스트 3종(`*.spec.ts`, `*.e2e-spec.ts`)

### 모바일 (apps/mobile/)

- `app/(tabs)/profile.tsx` — 프로필 조회 화면
- `app/profile/edit.tsx` — 프로필 수정 폼
- `app/profile/change-password.tsx` — 비밀번호 변경 (이메일 가입자 한정 노출)
- `app/profile/delete-account.tsx` — 계정 탈퇴 (2단계 확인)
- `services/users.ts`, `hooks/useUser.ts`
- `stores/authStore.ts` — `clearTokens()` 헬퍼

### 공유 타입 (packages/types/)

- `src/user.ts` — `UserProfile`, `UpdateProfilePayload`, `ChangePasswordPayload`, `PaginatedUsersResponse`

---

## 제외 사항 (Exclusions)

1. `PATCH /users/:id/role` — SPEC-AUTH-001에서 정의됨, 본 SPEC 범위 밖.
2. 프로필 사진/아바타 업로드 — PRD 미정의, 비공개 앱이므로 제외.
3. 공개 사용자 프로필 — 비공개 초대제 앱이므로 불필요.
4. 이메일 변경 / 이메일 인증 메일 재발송 — 후속 SPEC.
5. 소셜 계정 연동/해제 — 후속 SPEC.
6. 30일 후 하드 삭제 배치 — SPEC-OPS-XXX.
7. Admin이 타 사용자 프로필 직접 수정 / 비밀번호 재설정 — 본 SPEC 범위 밖.
8. Admin 초대 코드 관리 UI — SPEC-ADMIN-001.
9. 운동 라이브러리, 운동 세션, AI 추천 — 각 별도 SPEC.
10. `UserChangeLog` / 통합 `AuditLog` — 후속 SPEC 검토.
11. CSV/Excel 사용자 목록 export — 후속 SPEC.
12. Access Token 즉시 폐기(Revocation List) — 후속 SPEC-AUTH-REVOKE-XXX.
13. 비밀번호 변경 Rate Limiting — `PATCH /users/me/password` 반복 실패에 대한 IP/사용자 기반 rate limiting은 SPEC-AUTH-REVOKE-XXX에서 NestJS Throttler와 함께 처리. 현재는 경고 레벨 로깅만 수행.
