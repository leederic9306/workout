# SPEC-USER-001 인수 기준 (Acceptance Criteria)

본 문서는 SPEC-USER-001의 모든 EARS 요구사항에 대한 검증 가능한 Given-When-Then 시나리오를 정의한다. 모든 시나리오는 단위 테스트, 통합 테스트, E2E 테스트 중 하나 이상으로 자동화되어야 한다.

전제: SPEC-AUTH-001 v1.0.1이 이미 구현되어 있으며, `JwtAuthGuard`, `RolesGuard`, `JwtStrategy.validate()`, `User`/`InviteCode`/`RoleChangeLog` 모델, JWT payload(`{ sub, role, onboardingCompleted, iat, exp }`)가 존재한다.

---

## 1. 본인 프로필 조회 (REQ-USER-PROFILE)

### AC-PROFILE-01: GET /users/me — 정상 조회

**Given**:
- 사용자 `U1`이 가입 및 온보딩을 완료한 상태(`nickname="alice"`, `gender=FEMALE`, `birthDate="1995-03-15"`, `height=165`, `experienceLevel=INTERMEDIATE`)
- `U1`의 유효한 Access Token `T1`을 보유

**When**:
- 클라이언트가 `GET /users/me` 요청을 `Authorization: Bearer T1` 헤더와 함께 전송

**Then**:
- 응답 상태 코드는 `200 OK`
- 응답 본문은 다음 필드를 포함:
  - `id`, `email`, `role`, `nickname="alice"`, `gender="FEMALE"`, `birthDate="1995-03-15"`, `height=165`, `experienceLevel="INTERMEDIATE"`
  - `premiumExpiresAt` (null 또는 ISO 8601 날짜)
  - `socialProvider` (null 또는 `"KAKAO"`/`"GOOGLE"`)
  - `onboardingCompleted=true`
  - `createdAt` (ISO 8601)
- 응답 본문은 다음 필드를 **절대 포함하지 않음**: `passwordHash`, `refreshTokenHash`, `socialId`

**검증 매핑**: REQ-USER-PROFILE-001, REQ-USER-PROFILE-002, REQ-USER-PROFILE-003, REQ-USER-PROFILE-005

### AC-PROFILE-02: GET /users/me — 토큰 누락/만료 시 401

**Given**:
- 사용자 `U1`이 가입한 상태
- 토큰이 없거나, 만료된 토큰 `T_expired`, 또는 변조된 토큰 `T_tampered`

**When**:
- `GET /users/me`를 다음 케이스로 호출:
  1. `Authorization` 헤더 없이
  2. `Authorization: Bearer T_expired`
  3. `Authorization: Bearer T_tampered`

**Then**:
- 모든 경우 응답 상태 코드는 `401 Unauthorized`
- 응답 본문에 사용자 프로필 데이터가 포함되지 않음

**검증 매핑**: REQ-USER-PROFILE-004, NFR-SEC-001

### AC-PROFILE-03: GET /users/me — 온보딩 미완료 사용자

**Given**:
- 사용자 `U2`가 가입했으나 `height`만 NULL인 상태 (`nickname`, `gender`, `birthDate`, `experienceLevel`은 채워짐)
- `U2`의 유효한 Access Token

**When**:
- `GET /users/me` 요청 전송

**Then**:
- 응답 상태 코드는 `200 OK` (조회는 허용됨, NFR-ONBOARD-001)
- `onboardingCompleted=false`
- `height=null`

**검증 매핑**: REQ-USER-PROFILE-003, NFR-ONBOARD-001, REQ-USER-UPDATE-006

---

## 2. 프로필 수정 (REQ-USER-UPDATE)

### AC-UPDATE-01: PATCH /users/me/profile — 정상 수정

**Given**:
- 사용자 `U1` (온보딩 완료, 닉네임 `"alice"`)
- `U1`의 유효한 Access Token

**When**:
- `PATCH /users/me/profile`을 다음 본문으로 호출:
  ```json
  { "nickname": "alice-new", "height": 168, "experienceLevel": "ADVANCED" }
  ```

**Then**:
- 응답 상태 코드는 `200 OK`
- 응답 본문은 `GET /users/me`와 동일 스키마이며 다음 값이 반영됨:
  - `nickname="alice-new"`, `height=168`, `experienceLevel="ADVANCED"`
  - 미수정 필드(`gender`, `birthDate`)는 기존 값 유지
- DB의 `User.updatedAt`이 현재 시각으로 갱신됨

**검증 매핑**: REQ-USER-UPDATE-001, REQ-USER-UPDATE-004, REQ-USER-UPDATE-005

### AC-UPDATE-02: PATCH /users/me/profile — 검증 실패 (400)

**Given**:
- 사용자 `U1`의 유효한 Access Token

**When**:
- 다음 페이로드들로 `PATCH /users/me/profile` 호출:
  1. `{ "nickname": "a" }` (1자, 최소 2자 위반)
  2. `{ "nickname": "" }` (빈 문자열)
  3. `{ "height": 500 }` (최대 250cm 위반)
  4. `{ "height": 50 }` (최소 100cm 위반)
  5. `{ "experienceLevel": "EXPERT" }` (enum 불일치)
  6. `{ "birthDate": "not-a-date" }` (ISO 8601 위반)
  7. `{ "gender": "ALIEN" }` (enum 불일치)

**Then**:
- 모든 경우 응답 상태 코드는 `400 Bad Request`
- 응답 본문에 `class-validator` 에러 메시지가 포함됨
- DB의 `User` 레코드는 변경되지 않음 (원자성)

**검증 매핑**: REQ-USER-UPDATE-002

### AC-UPDATE-03: PATCH /users/me/profile — 화이트리스트 외 필드 차단

**Given**:
- 사용자 `U1`의 유효한 Access Token

**When**:
- `PATCH /users/me/profile`을 다음 본문으로 호출:
  ```json
  { "nickname": "valid", "role": "ADMIN", "email": "hacker@example.com", "passwordHash": "injected", "id": "another-id" }
  ```

**Then**:
- 응답 상태 코드는 `400 Bad Request` (`ValidationPipe`의 `forbidNonWhitelisted: true`에 의해)
- DB의 `User.role`은 변경되지 않음 (원래 값 유지)
- DB의 `User.email`, `User.passwordHash`, `User.id`도 변경되지 않음

**검증 매핑**: REQ-USER-UPDATE-003, NFR-SEC-004

---

## 3. 비밀번호 변경 (REQ-USER-PASSWORD)

### AC-PASSWORD-01: PATCH /users/me/password — 정상 변경

**Given**:
- 이메일 가입자 `U1` (`email="alice@example.com"`, `passwordHash=bcrypt("OldPass123")`, `refreshTokenHash=bcrypt("rt_xxx")`)
- `U1`의 유효한 Access Token

**When**:
- `PATCH /users/me/password`를 다음 본문으로 호출:
  ```json
  { "currentPassword": "OldPass123", "newPassword": "NewPass456" }
  ```

**Then**:
- 응답 상태 코드는 `200 OK`
- DB의 `User.passwordHash`가 `bcrypt("NewPass456")`로 갱신됨 (cost factor 10)
- DB의 `User.refreshTokenHash`가 `NULL`로 설정됨 (REQ-USER-PASSWORD-006)
- 응답 본문에 `passwordHash`, `currentPassword`, `newPassword`, `refreshTokenHash` 어느 것도 포함되지 않음

**검증 매핑**: REQ-USER-PASSWORD-001, REQ-USER-PASSWORD-005, REQ-USER-PASSWORD-006, REQ-USER-PASSWORD-007

### AC-PASSWORD-02: PATCH /users/me/password — currentPassword 불일치

**Given**:
- 이메일 가입자 `U1` (`passwordHash=bcrypt("OldPass123")`)
- `U1`의 유효한 Access Token

**When**:
- `PATCH /users/me/password`를 다음 본문으로 호출:
  ```json
  { "currentPassword": "WrongPass", "newPassword": "NewPass456" }
  ```

**Then**:
- 응답 상태 코드는 `401 Unauthorized`
- DB의 `User.passwordHash`는 변경되지 않음
- DB의 `User.refreshTokenHash`는 변경되지 않음 (실패 시 토큰 유지)
- 응답 본문에 비밀번호 값이나 해시가 노출되지 않음

**검증 매핑**: REQ-USER-PASSWORD-002, REQ-USER-PASSWORD-007

### AC-PASSWORD-03: PATCH /users/me/password — 소셜 전용 계정 차단

**Given**:
- 소셜 전용 가입자 `U3` (`socialProvider="KAKAO"`, `passwordHash=null`)
- `U3`의 유효한 Access Token

**When**:
- `PATCH /users/me/password`를 다음 본문으로 호출:
  ```json
  { "currentPassword": "any", "newPassword": "NewPass456" }
  ```

**Then**:
- 응답 상태 코드는 `400 Bad Request`
- 응답 본문에 소셜 계정임을 명시하는 에러 메시지 포함 (예: `Password change not allowed for social-only accounts`)
- DB의 `User.passwordHash`는 여전히 `NULL`

**검증 매핑**: REQ-USER-PASSWORD-003

### AC-PASSWORD-04: PATCH /users/me/password — newPassword 강도 검증

**Given**:
- 이메일 가입자 `U1`의 유효한 Access Token, `currentPassword="OldPass123"` 일치

**When**:
- 다음 `newPassword`로 호출:
  1. `"short1"` (7자, 최소 8자 위반)
  2. `"onlyletters"` (숫자 없음)
  3. `"12345678"` (영문 없음)
  4. `""` (빈 문자열)

**Then**:
- 모든 경우 응답 상태 코드는 `400 Bad Request`
- DB의 `User.passwordHash`는 변경되지 않음

**검증 매핑**: REQ-USER-PASSWORD-004

### AC-PASSWORD-05: PATCH /users/me/password — 변경 후 Refresh Token 무효화 검증

**Given**:
- AC-PASSWORD-01을 수행한 직후 상태 (비밀번호 변경 성공, `refreshTokenHash=NULL`)
- 클라이언트가 보유한 이전 Refresh Token `RT_old`

**When**:
- 클라이언트가 `POST /auth/refresh`를 `{ refreshToken: RT_old }`로 호출

**Then**:
- 응답 상태 코드는 `401 Unauthorized` (SPEC-AUTH-001 REQ-AUTH-JWT-005에 의해)
- 새 Access/Refresh Token이 발급되지 않음

**검증 매핑**: REQ-USER-PASSWORD-006, NFR-COMPAT-001

---

## 4. 계정 탈퇴 (REQ-USER-DELETE)

### AC-DELETE-01: DELETE /users/me — 정상 탈퇴 (소프트 삭제)

**Given**:
- 사용자 `U1` (`deletedAt=null`, `refreshTokenHash=bcrypt("rt_xxx")`)
- `U1`의 유효한 Access Token `T1`

**When**:
- `DELETE /users/me` 요청을 `Authorization: Bearer T1`로 호출

**Then**:
- 응답 상태 코드는 `200 OK` 또는 `204 No Content`
- 응답 본문은 비어있거나 `{ "deletedAt": "<ISO8601>" }`만 포함
- 응답 본문에 사용자 프로필 데이터(닉네임/이메일 등)가 노출되지 않음
- DB의 `User.deletedAt`이 현재 시각으로 설정됨
- DB의 `User.refreshTokenHash`가 `NULL`로 설정됨

**검증 매핑**: REQ-USER-DELETE-001, REQ-USER-DELETE-002, REQ-USER-DELETE-006

### AC-DELETE-02: 탈퇴 후 인증 차단

**Given**:
- AC-DELETE-01을 수행한 직후 상태 (`U1.deletedAt IS NOT NULL`)
- 클라이언트가 여전히 보유한 Access Token `T1`(JWT는 stateless이므로 만료 전까지 형식상 유효)
- 클라이언트가 보유한 이전 Refresh Token `RT_old`

**When**:
- 케이스 A: `GET /users/me`를 `Authorization: Bearer T1`로 호출
- 케이스 B: `POST /auth/refresh`를 `{ refreshToken: RT_old }`로 호출
- 케이스 C: `POST /auth/login`을 `U1`의 이메일/비밀번호로 호출

**Then**:
- 케이스 A: 응답 상태 코드는 `401 Unauthorized` (`JwtStrategy.validate()`에서 `deletedAt IS NOT NULL` 검사 통과 불가)
- 케이스 B: 응답 상태 코드는 `401 Unauthorized` (`refreshTokenHash=NULL`)
- 케이스 C: 응답 상태 코드는 `401 Unauthorized` (소프트 삭제된 사용자 로그인 차단)

**검증 매핑**: REQ-USER-DELETE-002, REQ-USER-DELETE-003, NFR-SEC-007

### AC-DELETE-03: 탈퇴 후 외래 참조 보존

**Given**:
- 사용자 `U1`이 이전에 `RoleChangeLog` 항목의 `targetUserId` 또는 `changedByUserId`에 기록되어 있음
- `U1`이 초대 코드 `IC1`을 사용해 가입했으므로 `InviteCode.usedBy=U1.id`
- `U1`이 `DELETE /users/me`로 탈퇴

**When**:
- DB에서 `RoleChangeLog`, `InviteCode` 레코드 조회

**Then**:
- `RoleChangeLog` 항목들은 그대로 존재하며 `targetUserId`/`changedByUserId`는 `U1.id`를 계속 가리킴 (외래키 NULL 처리 안 됨)
- `InviteCode.usedBy`는 여전히 `U1.id`이며, `usedAt`도 그대로 유지됨
- `U1.id`, `U1.email`은 DB에 그대로 존재하며 단지 `deletedAt`만 설정됨

**검증 매핑**: REQ-USER-DELETE-004, REQ-USER-DELETE-005

### AC-DELETE-04: 탈퇴한 이메일로 재가입 차단

**Given**:
- 사용자 `U1`(`email="alice@example.com"`)이 탈퇴 완료 (`deletedAt IS NOT NULL`, 이메일은 DB에 보존)

**When**:
- 새 사용자가 같은 이메일 `"alice@example.com"`과 새 초대 코드로 `POST /auth/signup` 호출

**Then**:
- 응답 상태 코드는 `409 Conflict` 또는 `400 Bad Request` (이메일 중복)
- 새 `User` 레코드가 생성되지 않음

**검증 매핑**: REQ-USER-DELETE-005

### AC-DELETE-05: Admin 자기 삭제 차단

**Given**: Admin 사용자 `A1`의 유효한 Access Token `T_admin`이 있다.
**When**: 클라이언트가 `DELETE /users/me`를 `Authorization: Bearer T_admin`으로 호출한다.
**Then**: 응답 상태 코드는 `403 Forbidden`.
**And**: `A1.deletedAt`은 여전히 `null`이다.
**And**: `A1.refreshTokenHash`는 변경되지 않는다.

검증 매핑: REQ-USER-DELETE-009

---

## 5. Admin 사용자 조회 (REQ-USER-ADMIN)

### AC-ADMIN-01: GET /users — Admin 페이지네이션 조회

**Given**:
- Admin 사용자 `A1`의 유효한 Access Token
- DB에 활성 사용자 25명, 소프트 삭제된 사용자 3명 존재

**When**:
- `GET /users?page=1&limit=20`을 `A1`의 Access Token으로 호출

**Then**:
- 응답 상태 코드는 `200 OK`
- 응답 본문 구조:
  - `items`: 길이 20인 배열, 각 요소는 `GET /users/me`와 동일 스키마, 소프트 삭제 사용자 제외
  - `total=25` (소프트 삭제 제외 활성 사용자 수)
  - `page=1`, `limit=20`, `totalPages=2`
- `items`의 각 요소에 `passwordHash`, `refreshTokenHash`, `socialId` 없음
- `?page=2&limit=20` 호출 시 `items` 길이 5, `page=2`, `totalPages=2`

**검증 매핑**: REQ-USER-ADMIN-002, REQ-USER-ADMIN-003, REQ-USER-ADMIN-004, REQ-USER-ADMIN-006

### AC-ADMIN-02: GET /users — Non-Admin 차단

**Given**:
- 일반 사용자 `U1` (role=`USER`)의 유효한 Access Token
- Premium 사용자 `P1` (role=`PREMIUM`)의 유효한 Access Token

**When**:
- 케이스 A: `GET /users`를 `U1`의 토큰으로 호출
- 케이스 B: `GET /users`를 `P1`의 토큰으로 호출
- 케이스 C: `GET /users`를 토큰 없이 호출

**Then**:
- 케이스 A: `403 Forbidden`
- 케이스 B: `403 Forbidden`
- 케이스 C: `401 Unauthorized`
- 어느 경우에도 사용자 목록이 응답에 포함되지 않음

**검증 매핑**: REQ-USER-ADMIN-001

### AC-ADMIN-03: GET /users/:id — Admin 특정 사용자 조회

**Given**:
- Admin `A1`의 유효한 Access Token
- 활성 사용자 `U1`의 ID `"user-uuid-1"`

**When**:
- 케이스 A: `GET /users/user-uuid-1`을 `A1`의 토큰으로 호출
- 케이스 B: `GET /users/<A1.id>` (Admin 본인 조회)

**Then**:
- 케이스 A: 응답 상태 코드 `200 OK`, 본문은 `GET /users/me`와 동일 스키마의 `U1` 프로필
- 케이스 B: `200 OK`, Admin 본인 프로필 반환 (REQ-USER-ADMIN-007)
- 응답 본문에 `passwordHash`, `refreshTokenHash`, `socialId` 없음

**검증 매핑**: REQ-USER-ADMIN-005, REQ-USER-ADMIN-006, REQ-USER-ADMIN-007

### AC-ADMIN-04: GET /users — limit 경계 검증

**Given**:
- Admin `A1`의 유효한 Access Token

**When**:
- 케이스 A: `GET /users?limit=100` 호출
- 케이스 B: `GET /users?limit=101` 호출
- 케이스 C: `GET /users?limit=0` 호출
- 케이스 D: `GET /users?limit=-1` 호출
- 케이스 E: `GET /users` (쿼리 없이) 호출

**Then**:
- 케이스 A: `200 OK`, `limit=100`
- 케이스 B: `400 Bad Request` (limit 최대 100 위반)
- 케이스 C, D: `400 Bad Request` (limit 최소 1 위반)
- 케이스 E: `200 OK`, `page=1, limit=20` (기본값 적용)

**검증 매핑**: REQ-USER-ADMIN-002

### AC-ADMIN-05: GET /users/:id — 존재하지 않는 ID

**Given**:
- Admin `A1`의 유효한 Access Token
- DB에 존재하지 않는 ID `"non-existent-id"`

**When**:
- 케이스 A: `GET /users/non-existent-id`를 `A1`의 토큰으로 호출
- 케이스 B: `GET /users/<U_deleted.id>` (소프트 삭제된 사용자 ID)

**Then**:
- 케이스 A: `404 Not Found`
- 케이스 B: `404 Not Found` (소프트 삭제 사용자는 기본 조회에서 제외됨, REQ-USER-ADMIN-004와 일관)

**검증 매핑**: REQ-USER-ADMIN-005, REQ-USER-ADMIN-004

---

## 6. 보안 시나리오 (Security)

### AC-SECURITY-01: 시크릿/PII 노출 차단 (통합)

**Given**:
- 임의의 인증된 사용자 또는 Admin

**When**:
- 다음 엔드포인트 모두 호출:
  - `GET /users/me`
  - `PATCH /users/me/profile` (성공/실패)
  - `PATCH /users/me/password` (성공/실패)
  - `DELETE /users/me`
  - `GET /users` (Admin)
  - `GET /users/:id` (Admin)

**Then**:
- 어떤 응답에도 다음 필드/값이 평문 또는 해시 형태로 포함되지 않음:
  - `passwordHash`
  - `refreshTokenHash`
  - `socialId`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET` 등 환경 변수
  - 평문 비밀번호 (`currentPassword`, `newPassword`)
- 백엔드 로그에도 위 항목들이 출력되지 않음

**검증 매핑**: REQ-USER-PROFILE-002, REQ-USER-PASSWORD-007, REQ-USER-ADMIN-006, NFR-SEC-003, NFR-AUDIT-001

---

## 7. 성능 시나리오 (Performance)

### AC-PERF-01: 성능 기준선

**Given**:
- 로컬 또는 staging 환경에서 1,000개 사용자 데이터 시드
- 인증된 사용자

**When**:
- 각 엔드포인트를 100회 반복 호출하고 응답 시간 측정

**Then**:
- `GET /users/me` P95 ≤ 100ms
- `PATCH /users/me/profile` P95 ≤ 200ms
- `PATCH /users/me/password` P95 ≤ 500ms (bcrypt 비교 + 해싱 포함)
- `GET /users?limit=20` P95 ≤ 300ms

**검증 매핑**: NFR-PERF-001, NFR-PERF-002, NFR-PERF-003, NFR-PERF-004 (성능 NFR 검증)

---

## 8. 품질 게이트 (Quality Gate Criteria)

### 8.1 테스트 커버리지

- `apps/backend/src/users/` 라인 커버리지 ≥ 85%
- 다음 함수는 100% 분기 커버리지 필수:
  - `users.service.ts :: softDelete()`
  - `users.service.ts :: changePassword()`
  - `users.service.ts :: getMe()`
  - `users.service.ts :: updateProfile()`
  - `jwt.strategy.ts :: validate()` (soft-delete 검사 분기 포함)

### 8.2 TRUST 5 게이트

- **Tested**: 위 8.1 충족
- **Readable**: ESLint(@typescript-eslint) 0 error, Prettier 통과
- **Unified**: 백엔드는 NestJS 공식 컨벤션, 모바일은 ESLint Expo config 준수
- **Secured**: AC-SECURITY-01 통과, OWASP Top 10 관련 항목(A01 Broken Access Control, A02 Cryptographic Failures, A07 Identification and Authentication Failures) 점검 완료
- **Trackable**: 본 SPEC ID(SPEC-USER-001)를 모든 커밋 메시지에 포함, MX tag(`@MX:ANCHOR`, `@MX:WARN`) 적용

### 8.3 LSP 게이트 (Run Phase)

- TypeScript `tsc --noEmit` 0 error
- `pnpm lint` 0 error, 0 warning (백엔드 + 모바일)

---

## 9. Definition of Done (완료 정의)

본 SPEC은 다음 모든 조건을 만족할 때 완료된 것으로 간주한다:

1. **API 구현**: 6개 엔드포인트(`GET /users/me`, `PATCH /users/me/profile`, `PATCH /users/me/password`, `DELETE /users/me`, `GET /users`, `GET /users/:id`)가 모두 구현되어 동작한다.
2. **DB 마이그레이션**: `User.deletedAt` 컬럼이 추가되고 Prisma migration이 commit된다.
3. **인증 통합**: `JwtStrategy.validate()`가 소프트 삭제 사용자를 401로 차단한다 (AC-DELETE-02 통과).
4. **검증 통과**: AC-PROFILE-01 ~ AC-ADMIN-05, AC-SECURITY-01, AC-PERF-01의 모든 시나리오가 자동화된 테스트로 검증되고 통과한다.
5. **모바일 화면**: 프로필 조회/수정/비밀번호 변경/탈퇴 4개 화면이 구현되고 백엔드와 통합된다.
6. **공유 타입**: `packages/types/src/user.ts`에 `UserProfile`, `UpdateProfilePayload`, `ChangePasswordPayload`, `PaginatedUsersResponse` 타입이 export되며 백엔드/모바일이 동일 타입을 참조한다.
7. **품질 게이트**: 위 Section 8의 모든 기준 통과.
8. **문서 동기화**: API 문서(`/moai sync`로 생성)와 README가 갱신된다.
9. **MX tag**: `mx_plan` Section 7에 정의된 모든 `@MX:ANCHOR`, `@MX:WARN` 대상이 실제 코드에 적용된다.
10. **추적성**: 모든 REQ-USER-* 항목이 본 acceptance.md의 시나리오로 1:1 또는 1:N 매핑되며 추적성 매트릭스(spec.md Section 8)가 최신 상태로 유지된다.
