# SPEC-USER-001 구현 계획 (Implementation Plan)

본 문서는 SPEC-USER-001(사용자 프로필 관리)의 구현 계획을 정의한다. 우선순위 기반(High/Medium)으로 페이즈가 정의되며, 시간 예측은 포함하지 않는다 (Agent Common Protocol 준수).

전제: SPEC-AUTH-001 v1.0.1이 이미 구현되어 있다. 즉, `User` 모델, `JwtAuthGuard`, `RolesGuard`, `JwtStrategy`, JWT payload(`{ sub, role, onboardingCompleted, iat, exp }`), `POST /auth/*` 엔드포인트가 존재한다.

---

## 1. 기술 접근 (Technical Approach)

### 1.1 백엔드 아키텍처

- **모듈 구조**: `UsersModule`을 확장하고 `UsersController`를 추가한다. `AuthModule`은 `UsersModule`을 import하여 `UsersService.findByEmail`, `UsersService.findById`를 활용한다 (순환 참조 시 `forwardRef` 사용).
- **응답 마스킹**: `UserResponseDto` 한 곳에서만 `passwordHash`, `refreshTokenHash`, `socialId`를 제외하도록 `class-transformer` `@Exclude()` 또는 정적 팩토리 메서드(`UserResponseDto.fromEntity(user)`)로 통제한다. 컨트롤러는 항상 이 DTO를 거쳐 응답을 반환한다.
- **온보딩 계산**: `onboardingCompleted = !!nickname && !!gender && !!birthDate && height !== null && !!experienceLevel`를 `UserResponseDto.fromEntity()` 내부에서 계산한다. 별도 DB 컬럼 추가 없음.
- **소프트 삭제**: `User.deletedAt DateTime?` 컬럼을 추가하고, Prisma 쿼리에서 명시적으로 `where: { deletedAt: null }`을 적용한다. Prisma 미들웨어를 통한 글로벌 필터링은 도입하지 않는다 (Admin 조회 시 의도적 가시성 제어를 위해).
- **JWT 가드 보강**: `JwtStrategy.validate(payload)`에서 사용자를 조회한 후 `user.deletedAt`이 `null`이 아니면 `UnauthorizedException`을 발생시킨다. 이 변경은 SPEC-AUTH-001 영향 범위에 속하지만 본 SPEC에서 단일 라인 패치로 적용한다 (AC-DELETE-02 통과 위함).
- **비밀번호 변경 트랜잭션**: `passwordHash` 갱신과 `refreshTokenHash = NULL`을 동일 Prisma 트랜잭션 내에서 처리하여 원자성을 보장한다.

### 1.2 모바일 아키텍처

- **상태 관리**: TanStack Query의 `useQuery(["me"], getMe)`로 본인 프로필을 캐싱하고, `useMutation`으로 수정/탈퇴 후 캐시 invalidation을 수행한다.
- **인증 정리**: `authStore.clearTokens()` 헬퍼를 추가하여 비밀번호 변경 후/탈퇴 후 공통으로 호출한다. 이후 Expo Router로 `/(auth)/login`으로 redirect.
- **조건부 UI**: `profile` 화면에서 `socialProvider`가 존재하면 "비밀번호 변경" 메뉴를 숨긴다 (소셜 전용 계정 UX).

### 1.3 공유 타입

`packages/types/src/user.ts`를 SPEC-AUTH-001 정의 위에서 확장한다. 백엔드 응답 DTO와 모바일 호출 함수가 동일 타입을 import하여 contract drift를 방지한다.

---

## 2. 마일스톤 (Milestones, Priority-based)

### Phase 1 [Priority: High] — 백엔드 본인 프로필 조회/수정

**목표**: `GET /users/me`, `PATCH /users/me/profile` 구현.

**작업**:
1. `prisma/schema.prisma`에 `User.deletedAt DateTime?` 컬럼 추가, migration 생성 (`pnpm prisma migrate dev --name add_user_deleted_at`).
2. `src/users/dto/user-response.dto.ts` 작성. `class-transformer` `@Exclude()`로 `passwordHash`/`refreshTokenHash`/`socialId` 제외, `onboardingCompleted` 계산 필드 포함. 정적 팩토리 `UserResponseDto.fromEntity(user)` 노출.
3. `src/users/dto/update-profile.dto.ts` 작성. `nickname`(2-20), `gender`(enum), `birthDate`(ISO 8601), `height`(100-250), `experienceLevel`(enum) 모두 `@IsOptional()` + `@Is*()`로 검증.
4. `src/users/users.service.ts`에 `getMe(userId)`, `updateProfile(userId, dto)` 추가.
5. `src/users/users.controller.ts` 생성. `@UseGuards(JwtAuthGuard)` 적용, `@CurrentUser() user: UserPayload` 데코레이터 활용.
6. `main.ts`(또는 `app.module.ts`)에서 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` 전역 등록 확인 (SPEC-AUTH-001에서 이미 적용되었을 수 있음).
7. 단위 테스트(`users.service.spec.ts`) 및 컨트롤러 테스트(`users.controller.spec.ts`) 작성.

**완료 기준**: AC-PROFILE-01, AC-PROFILE-02, AC-PROFILE-03, AC-UPDATE-01, AC-UPDATE-02, AC-UPDATE-03 통과.

**의존성**: SPEC-AUTH-001 인증 인프라.

### Phase 2 [Priority: High] — 백엔드 비밀번호 변경

**목표**: `PATCH /users/me/password` 구현.

**작업**:
1. `src/users/dto/change-password.dto.ts` 작성. `currentPassword`(`@IsString @IsNotEmpty`), `newPassword`(SPEC-AUTH-001 동일 강도 정책 — `@MinLength(8)` + `@Matches(/(?=.*[A-Za-z])(?=.*\d)/)`).
2. `users.service.ts`에 `changePassword(userId, currentPassword, newPassword)` 추가:
   - 사용자 조회.
   - `user.passwordHash === null` → `BadRequestException("Password change not allowed for social-only accounts")`.
   - `bcrypt.compare(currentPassword, user.passwordHash)` → false면 `UnauthorizedException`.
   - 트랜잭션 내에서 `passwordHash = bcrypt.hash(newPassword, 10)`, `refreshTokenHash = null` 동시 갱신.
3. 컨트롤러에 `@Patch("me/password")` 라우트 추가.
4. 테스트: AC-PASSWORD-01 ~ AC-PASSWORD-05.

**완료 기준**: AC-PASSWORD-01, AC-PASSWORD-02, AC-PASSWORD-03, AC-PASSWORD-04, AC-PASSWORD-05 통과.

**의존성**: Phase 1.

### Phase 3 [Priority: High] — 백엔드 계정 탈퇴 (소프트 삭제)

**목표**: `DELETE /users/me` 구현 및 인증 가드에서 소프트 삭제 사용자 차단.

**작업**:
1. `users.service.ts`에 `softDelete(userId)` 추가:
   - Prisma 트랜잭션 내에서 `deletedAt = new Date()`, `refreshTokenHash = null` 동시 갱신.
   - 응답은 `{ deletedAt: ISO8601 }` 또는 `void` (HTTP 204).
2. `src/auth/strategies/jwt.strategy.ts`의 `validate(payload)` 수정:
   - 기존 로직에 더하여 `if (user.deletedAt !== null) throw new UnauthorizedException()` 추가.
   - `@MX:WARN` + `@MX:REASON` 주석 추가 (REQ-USER-DELETE-003 불변식).
3. 컨트롤러에 `@Delete("me")` 라우트 추가.
4. 로그인 서비스(`auth.service.ts :: validateUser`)에서도 `deletedAt IS NOT NULL`이면 로그인 거부 (AC-DELETE-02 케이스 C). 이는 SPEC-AUTH-001 측 작은 패치로 처리한다.
5. 기존 사용자 조회 헬퍼 메서드 검토: `UsersService.findById`/`findByEmail`이 기본적으로 `deletedAt: null`을 필터하도록 변경. 단, Admin 조회용 별도 메서드(`findByIdAnyStatus`)는 두지 않음 (`GET /users/:id`에서도 deletedAt 제외, AC-ADMIN-05 케이스 B).
6. 테스트: AC-DELETE-01 ~ AC-DELETE-04. 특히 외래 참조 보존 검증(`RoleChangeLog`, `InviteCode.usedBy`)을 E2E로 확인.

**완료 기준**: AC-DELETE-01, AC-DELETE-02, AC-DELETE-03, AC-DELETE-04 통과.

**의존성**: Phase 1, SPEC-AUTH-001 `JwtStrategy`/`auth.service` 협업.

### Phase 4 [Priority: Medium] — 백엔드 Admin 엔드포인트

**목표**: `GET /users`, `GET /users/:id` 구현.

**작업**:
1. `src/users/dto/list-users-query.dto.ts` 작성. `page`(`@IsInt @Min(1)`, 기본 1, `@Type(() => Number)`), `limit`(`@IsInt @Min(1) @Max(100)`, 기본 20).
2. `src/users/dto/paginated-users-response.dto.ts` 작성. `items: UserResponseDto[]`, `total`, `page`, `limit`, `totalPages`.
3. `users.service.ts`에 `findAll(page, limit)`, `findById(id)` 추가:
   - `findAll`: `prisma.user.findMany({ where: { deletedAt: null }, skip, take, orderBy: { createdAt: "desc" } })` + `prisma.user.count({ where: { deletedAt: null } })`.
   - `findById`: 활성 사용자만 조회, 없으면 `NotFoundException`.
4. 컨트롤러에 `@Get()`, `@Get(":id")` 라우트 추가. 각각 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`.
5. 테스트: AC-ADMIN-01 ~ AC-ADMIN-05.

**완료 기준**: AC-ADMIN-01, AC-ADMIN-02, AC-ADMIN-03, AC-ADMIN-04, AC-ADMIN-05 통과.

**의존성**: Phase 1 (DTO 재사용).

### Phase 5 [Priority: Medium] — 모바일 프로필 조회 화면

**목표**: 본인 프로필 조회 UI 구현.

**작업**:
1. `packages/types/src/user.ts`에 `UserProfile`, `UpdateProfilePayload`, `ChangePasswordPayload`, `PaginatedUsersResponse` 타입 추가 (Phase 8과 병행).
2. `apps/mobile/services/users.ts` 작성: `getMe()`, `updateProfile(payload)`, `changePassword(payload)`, `deleteAccount()` 함수.
3. `apps/mobile/hooks/useUser.ts` 작성:
   - `useMe()`: `useQuery(["users", "me"], getMe)`.
   - `useUpdateProfile()`: `useMutation` + `queryClient.invalidateQueries(["users", "me"])`.
   - `useChangePassword()`, `useDeleteAccount()`: 성공 시 `authStore.clearTokens()` + 로그인 화면 redirect.
4. `apps/mobile/app/(tabs)/profile.tsx` 작성: `useMe()` 호출, 닉네임/이메일/role/신체정보/`createdAt` 표시. "프로필 수정", "비밀번호 변경"(소셜 가입자 숨김), "계정 탈퇴" 메뉴 라우팅.

**완료 기준**: 모바일에서 `GET /users/me`가 성공적으로 표시되고, 소셜 가입자에게 "비밀번호 변경" 메뉴가 숨겨진다.

**의존성**: Phase 1, Phase 8.

### Phase 6 [Priority: Medium] — 모바일 프로필 수정 폼

**목표**: 프로필 편집 및 비밀번호 변경 UI.

**작업**:
1. `apps/mobile/app/profile/edit.tsx` 작성:
   - 폼 상태 관리: React Hook Form 또는 단순 useState.
   - 필드: `nickname`, `gender` (segmented control), `birthDate` (DatePicker), `height` (numeric), `experienceLevel` (segmented control).
   - 클라이언트 사이드 검증을 위해 `packages/types`의 zod 스키마 또는 백엔드와 동일 정책 적용.
   - 제출 시 `useUpdateProfile()` 호출.
2. `apps/mobile/app/profile/change-password.tsx` 작성 (이메일 가입자만 진입):
   - `currentPassword`, `newPassword`, `newPasswordConfirm` 필드.
   - 검증 통과 시 `useChangePassword()` 호출.
   - 성공 후 "비밀번호가 변경되어 재로그인이 필요합니다" 안내 표시 후 로그인 화면으로 이동.

**완료 기준**: 모바일에서 프로필 부분 수정 및 비밀번호 변경 성공 후 적절한 후처리(캐시 갱신/로그아웃).

**의존성**: Phase 5.

### Phase 7 [Priority: Medium] — 모바일 계정 탈퇴 플로우

**목표**: 안전한 탈퇴 UX 제공.

**작업**:
1. `apps/mobile/app/profile/delete-account.tsx` 작성:
   - 2단계 확인: (1) 경고 페이지 + 체크박스("탈퇴 시 데이터는 30일 후 영구 삭제될 수 있으며..."), (2) 최종 확인 모달.
   - 이메일 가입자의 경우 비밀번호 재입력 요구는 본 SPEC 범위가 아님(추후 보안 강화로 고려). 본 SPEC에서는 단순 두 번 확인만 수행.
   - 확정 시 `useDeleteAccount()` 호출.
2. 탈퇴 성공 시 `authStore.clearTokens()` → Expo SecureStore 정리 → `/(auth)/login` redirect → 토스트 "계정이 삭제되었습니다" 표시.

**완료 기준**: 사용자가 탈퇴 후 로그인 화면으로 자동 이동하며, 같은 디바이스에서 잔존 토큰으로 재인증이 불가능하다.

**의존성**: Phase 3, Phase 5.

### Phase 8 [Priority: Medium] — 공유 타입 정합

**목표**: `packages/types/src/user.ts` 타입 정의를 백엔드/모바일 모두에서 import 가능하게 한다.

**작업**:
1. `packages/types/src/user.ts`에 다음 타입 추가 (SPEC-AUTH-001 정의 위에서):
   ```
   UserProfile (id, email, role, nickname, gender, birthDate, height, experienceLevel, premiumExpiresAt, socialProvider, onboardingCompleted, createdAt)
   UpdateProfilePayload (Partial<Pick<UserProfile, "nickname" | "gender" | "birthDate" | "height" | "experienceLevel">>)
   ChangePasswordPayload (currentPassword, newPassword)
   PaginatedUsersResponse (items: UserProfile[], total, page, limit, totalPages)
   ```
2. 백엔드 `UserResponseDto`가 `UserProfile`을 구조적으로 만족하도록 정의 (tsc structural typing).
3. 모바일 `services/users.ts`의 함수 반환 타입을 `UserProfile`/`PaginatedUsersResponse`로 명시.
4. Turborepo + pnpm workspaces 설정에서 `@workout/types` 패키지가 양쪽 워크스페이스에 dependency로 추가되었는지 확인.

**완료 기준**: 백엔드/모바일이 동일 타입을 import하며, 타입 불일치로 인한 빌드 에러가 없다.

**의존성**: Phase 1 (백엔드 DTO 정의가 선행되어야 정확한 타입 도출 가능). Phase 5/6/7과 병행 가능.

---

## 3. 위험 요소 (Risks)

### Risk 1: JWT의 `onboardingCompleted` 동기화 누락

- **상황**: 사용자가 `PATCH /users/me/profile`로 마지막 누락 필드를 채워 온보딩이 완료됐을 때, 기존 JWT에는 `onboardingCompleted=false`가 남아있다.
- **완화**: 본 SPEC에서는 백엔드가 새 JWT를 강제 재발급하지 않는다. 클라이언트는 (1) 다음 `/auth/refresh` 시점에 갱신된 토큰을 받거나, (2) 프로필 갱신 mutation 성공 시 명시적으로 `/auth/refresh`를 호출하여 새 Access Token을 받도록 한다. 모바일 Phase 6에서 후자를 구현.

### Risk 2: 소프트 삭제 사용자의 잔존 JWT

- **상황**: JWT는 stateless이므로 탈퇴 직후에도 만료 전(최대 15분) 형식적으로 유효.
- **완화**: `JwtStrategy.validate()`에서 매 요청마다 DB 조회로 `deletedAt`을 확인 (Phase 3). 이로 인한 성능 비용은 P95 +5ms 이내로 추정되며, NFR-PERF-001(P95 ≤ 100ms)을 침해하지 않는다. SPEC-AUTH-001은 이미 `validate()`에서 사용자 조회를 수행하므로 추가 쿼리 없음.

### Risk 3: 비밀번호 변경 후 즉시 다른 디바이스가 만료 안 된 Access Token으로 접근

- **상황**: 비밀번호 변경 시 Refresh Token만 무효화되고 Access Token은 여전히 유효 (최대 15분).
- **완화**: 본 SPEC은 Access Token 즉시 폐기를 의무화하지 않는다 (Token Revocation List 도입은 후속 SPEC 검토). 15분 윈도우 이후 자연 만료되며 `refresh`가 차단되어 실질적 차단이 이뤄진다. 즉시 차단이 필요한 경우 SPEC-AUTH-REVOKE-XXX에서 도입.

### Risk 4: Admin 페이지네이션 성능

- **상황**: 사용자가 늘어남에 따라 `OFFSET` 페이지네이션의 비용 증가.
- **완화**: 현재 사용자 수가 ~5명이므로 즉각 문제는 없음. 100명 이상 시 cursor-based 페이지네이션으로 전환을 검토 (후속 SPEC).

### Risk 5: 동시 탈퇴/비밀번호 변경 경합

- **상황**: 동일 사용자가 두 디바이스에서 동시에 탈퇴와 비밀번호 변경을 시도.
- **완화**: 양 경로 모두 단일 트랜잭션 내 `refreshTokenHash = NULL` + (`deletedAt` 또는 `passwordHash`) 갱신을 수행. Prisma의 기본 격리 수준(Read Committed)에서 마지막 커밋이 승리. 비즈니스적으로 둘 다 무효 토큰 + 차단 상태로 수렴하므로 사용자에게 불일치는 없다.

### Risk 6: 이메일 재가입 정책 미정

- **상황**: 탈퇴 후 같은 이메일로 재가입 시도 시 `409 Conflict`인데, 이를 사용자에게 "이미 가입된 이메일"로 노출할지 "탈퇴한 계정"임을 알릴지 결정 필요.
- **완화**: 본 SPEC은 "이미 가입된 이메일" 동일 메시지로 통일한다 (사용자 열거 방지). 후속 SPEC에서 재가입 정책을 명시화.

---

## 4. 의존성 (Dependencies)

### 4.1 선행 SPEC

- **SPEC-AUTH-001 v1.0.1**: 본 SPEC의 모든 엔드포인트가 `JwtAuthGuard`/`RolesGuard`/`JwtStrategy`에 의존. `JwtStrategy.validate()` 한 곳에 `deletedAt` 검사 추가는 본 SPEC에서 수행하지만, 그 외 인증 인프라는 그대로 사용.

### 4.2 외부 라이브러리 (이미 SPEC-AUTH-001에서 설치)

- `bcrypt`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`
- `class-validator`, `class-transformer`
- Prisma 5, PostgreSQL 15

### 4.3 추가 라이브러리

- 없음. 본 SPEC은 새로운 dependency를 도입하지 않는다.

### 4.4 후행 SPEC (본 SPEC 완료가 트리거)

- **SPEC-ADMIN-001 (초대 코드 관리 UI)**: Admin이 본 SPEC의 `GET /users`로 사용자 식별 후 초대 코드 발급/회수 등 추가 운영 작업 가능.
- **SPEC-OPS-XXX (30일 후 하드 삭제 배치)**: 본 SPEC의 소프트 삭제 사용자를 영구 삭제하는 운영 SPEC.

---

## 5. 검증 전략 (Verification Strategy)

### 5.1 단위 테스트 (Jest)

- `users.service.spec.ts`: 모든 서비스 메서드의 정상/예외 경로 커버.
- `users.controller.spec.ts`: 라우트별 가드 적용/응답 형식 검증.
- 모킹 전략: Prisma는 `jest-mock-extended`로 모킹.

### 5.2 통합 테스트 (NestJS Testing module + 실제 PostgreSQL)

- `users.e2e-spec.ts`: 실제 DB 트랜잭션으로 다음 시나리오 검증:
  - 소프트 삭제 후 JWT 차단 (AC-DELETE-02)
  - 외래 참조 보존 (AC-DELETE-03)
  - 비밀번호 변경 후 Refresh Token 무효화 (AC-PASSWORD-05)
  - Admin 페이지네이션 정확도 (AC-ADMIN-01)

### 5.3 수동 검증 (모바일)

- iOS 시뮬레이터/Android 에뮬레이터 (Expo)에서 4개 화면 흐름 점검 (Phase 5~7 완료 후).
- 본 앱은 Android-only이므로 Android 실기기 또는 에뮬레이터를 우선.

### 5.4 보안 검증

- AC-SECURITY-01: 응답 스키마 grep으로 `passwordHash`/`refreshTokenHash`/`socialId` 노출 0건 확인.
- OWASP A01(Broken Access Control): AC-ADMIN-02 통과로 검증.
- OWASP A07(Authentication Failures): AC-PASSWORD-02 통과로 검증.

---

## 6. 롤백 계획 (Rollback Plan)

본 SPEC의 변경은 다음과 같이 롤백 가능하다:

1. **DB 마이그레이션 롤백**: `prisma migrate resolve --rolled-back add_user_deleted_at` 후 `deletedAt` 컬럼을 dropping하는 reverse migration 작성. 단, 이미 탈퇴한 사용자 데이터가 있는 경우 별도 처리 필요.
2. **API 라우트 롤백**: `UsersController`의 라우트들을 주석 처리하거나 git revert.
3. **JwtStrategy 변경 롤백**: `deletedAt` 검사 라인 제거 시, 탈퇴 후 잔존 토큰이 다시 유효해진다 (보안 회귀). 이 경우 Refresh Token 무효화만으로 보호되며 Access Token은 자연 만료에 의존하게 된다 — 명시적 알림 필요.
4. **모바일 화면 롤백**: 해당 라우트 파일 제거 또는 라우터에서 등록 해제.

---

## 7. 운영 고려사항 (Operational Considerations)

### 7.1 로깅

- `info` 레벨: 비밀번호 변경 성공, 계정 탈퇴 성공 (사용자 ID + 타임스탬프 + IP, 민감 정보 제외).
- `warn` 레벨: `currentPassword` 불일치 시도 (사용자 ID + 시도 횟수 누적은 후속 SPEC에서 IP 기반 카운터로 구현).

### 7.2 모니터링 지표

- `users_profile_get_p95_ms`
- `users_profile_update_p95_ms`
- `users_password_change_p95_ms`
- `users_account_deleted_total` (counter, 일별 집계)
- `users_password_change_failed_total` (counter, 잠재적 공격 시도 감지)

### 7.3 데이터 보존

- 소프트 삭제 사용자: 본 SPEC 범위에서 무기한 보존. 후속 SPEC-OPS-XXX에서 `deletedAt + 30 days` 경과 시 하드 삭제 배치 설계.
- `RoleChangeLog`: SPEC-AUTH-001 NFR-AUDIT-001에 따라 영구 보존 (탈퇴와 무관).

---

## 8. 페이즈 실행 순서 요약

```
Phase 1 (High) ────► Phase 2 (High) ────► Phase 3 (High)
   │                                            │
   ├────► Phase 4 (Medium) ────────────────────┘
   │                                            │
   └────► Phase 8 (Medium) ──┐                 │
                              ├────► Phase 5 ──┴──► Phase 6
                                                 │
                                                 └──► Phase 7
```

- **High Priority 완료 후 베타 배포 가능**: Phase 1+2+3+8까지 완료되면 백엔드 API + 공유 타입이 갖춰져 SPEC-AUTH-001 의존 기능과 함께 베타 테스트 가능.
- **Medium Priority는 모바일 UI 및 Admin 운영 기능**: Phase 4~7은 베타 운영 중 병행 작업 가능.

---

## 9. 완료 후 다음 단계 (Post-completion)

1. `/moai sync SPEC-USER-001`로 API 문서 및 README 동기화.
2. SPEC-ADMIN-001(초대 코드 관리) 또는 운동 도메인 SPEC 진행.
3. 본 SPEC의 운영 데이터를 바탕으로 SPEC-OPS-XXX(30일 후 하드 삭제 배치) 작성.
4. (선택) 토큰 즉시 폐기가 필요하다고 판단되면 SPEC-AUTH-REVOKE-XXX(Access Token Revocation List) 작성.
