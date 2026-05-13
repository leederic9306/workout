# SPEC Audit: SPEC-AUTH-001
Iteration: 1
Auditor: plan-auditor
Date: 2026-05-11

---

## Verdict: FAIL

---

## Must-Pass Criteria

- [FAIL] All 5 EARS types present — State-Driven type absent; "Complex" is not a valid EARS type and is used 3 times
- [FAIL] Every REQ has acceptance criterion — REQ-AUTH-JWT-007 absent from traceability matrix; REQ-AUTH-RBAC-001 mapped to wrong AC
- [PASS] Minimum 8 Given/When/Then scenarios — acceptance.md contains 19 named AC scenarios
- [PASS] Exclusions section has 1+ entries — Section 6 contains 10 specific exclusion entries
- [FAIL] No implementation code in spec.md — plan.md Section 6.1 contains a full Prisma schema code block; spec.md Section 7 contains implementation-level function names, file names, and column names inside requirement section

---

## Must-Pass Firewall Results

### MP-1: REQ Number Consistency — FAIL

spec.md uses a domain-prefixed hierarchical naming scheme (REQ-AUTH-INVITE-001, REQ-AUTH-SIGNUP-001, etc.) instead of the required sequential flat format (REQ-001, REQ-002, ..., REQ-N). The required format per MP-1 is "REQ-{NUM}" with zero-padded sequential integers. Within each domain group the numbering is sequential and gap-free, but the format itself does not conform to MP-1. Additionally, the SPEC uses "Complex" as a 6th REQ type label on three requirements (spec.md:L103, L106, L169) — a label that does not exist in EARS and cannot be validated as conforming to any of the five required patterns.

### MP-2: EARS Format Compliance — FAIL

**Defect 1 — Invalid EARS type "Complex" used three times:**
- spec.md:L103-104 REQ-AUTH-SOCIAL-002 labeled "(Complex)"
- spec.md:L106-107 REQ-AUTH-SOCIAL-003 labeled "(Complex)"
- spec.md:L169-170 REQ-AUTH-ONBOARD-004 labeled "(Complex)"

"Complex" is not one of the five EARS patterns (Ubiquitous, Event-Driven, State-Driven, Optional, Unwanted). These three requirements combine State-Driven and Event-Driven constructs but do not conform to any single EARS pattern.

**Defect 2 — State-Driven EARS type entirely absent:**
No requirement in Section 3 uses the State-Driven pattern ("While [condition], the [system] shall [response]"). All five EARS types must be present. State-Driven is applicable to this SPEC — for example, "While a user's premium subscription is active, the system shall grant access to AI recommendation endpoints" — but no such requirement appears. The custom audit criterion explicitly requires all 5 EARS types to be present.

### MP-3: YAML Frontmatter Validity — FAIL

spec.md:L1-10 frontmatter:

**Defect 1 — `created_at` field named `created`:**
The field at spec.md:L5 is `created: "2026-05-11"`. The required field name is `created_at`. This is a type/key mismatch; the required field is absent, an undeclared field `created` is present instead.

**Defect 2 — `labels` field entirely absent:**
The frontmatter contains: id, version, status, created, updated, author, priority, issue_number. The required `labels` field (array or string) does not appear anywhere in the frontmatter block.

### MP-4: Section 22 Language Neutrality — N/A

This SPEC targets a single-application stack (NestJS/TypeScript workout tracker). It is not a multi-language tooling SPEC. MP-4 auto-passes per the N/A rule for single-language scoped SPECs.

---

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.50 | 0.50 — multiple requirements require interpretation | Onboarding inline-vs-separate ambiguity (spec.md:L84 vs L163-170); `onboardingCompleted` field in AC but absent from REQ-AUTH-JWT-002 (spec.md:L118); AC-ONBOARD-01 allows "403 OR 409" making outcome ambiguous |
| Completeness | 0.50 | 0.50 — multiple sections affected; frontmatter missing two required fields | MP-3 failures (two frontmatter fields); REQ-AUTH-JWT-007 absent from traceability matrix; State-Driven EARS type absent; REQ-AUTH-JWT-002 missing `onboardingCompleted` field |
| Testability | 0.75 | 0.75 — one AC not precisely binary-testable | AC-ONBOARD-01 (acceptance.md:L212-213) states "`403 Forbidden` 또는 `409 Conflict`" — a tester cannot determine PASS/FAIL when two status codes are equally acceptable; "의미 있는 에러 메시지" in Definition of Done (acceptance.md:L282) is subjective |
| Traceability | 0.50 | 0.50 — multiple REQs lack ACs or have incorrect AC mappings | REQ-AUTH-JWT-007 has no entry in traceability matrix (spec.md Section 8); REQ-AUTH-RBAC-001 mapped only to AC-RBAC-01 which tests 403, not the 401-for-missing-JWT behavior the REQ defines; REQ-AUTH-ONBOARD-004 re-login redirect scenario not substantively tested in AC-ONBOARD-01 |

---

## Findings

### Critical (blocks PASS)

**C1. spec.md:L5 — YAML frontmatter field `created_at` named `created`**
Required field `created_at` is absent. A field named `created` is present instead. MP-3 violation.

**C2. spec.md:L1-10 — YAML frontmatter `labels` field entirely absent**
The required `labels` field (array or string type) does not appear in the frontmatter. MP-3 violation.

**C3. spec.md:L103-104, L106-107, L169-170 — Three REQs use non-existent EARS type "Complex"**
REQ-AUTH-SOCIAL-002, REQ-AUTH-SOCIAL-003, and REQ-AUTH-ONBOARD-004 are labeled "(Complex)" which is not one of the five valid EARS types. MP-2 violation.

**C4. spec.md Section 3 (all) — State-Driven EARS type entirely absent**
None of the 27 requirements uses the State-Driven pattern ("While [condition], the [system] shall [response]"). All five EARS types must be present per the must-pass criterion. MP-2 violation.

**C5. spec.md:L305-325 — REQ-AUTH-JWT-007 has no row in traceability matrix**
The traceability table in Section 8 covers REQ-AUTH-JWT-001~003 (row 1), REQ-AUTH-JWT-004 (row 2), REQ-AUTH-JWT-005 (row 3), REQ-AUTH-JWT-006 (row 4) — but REQ-AUTH-JWT-007 (JWT secrets not exposed) has no traceability entry. AC-5 violation.

**C6. spec.md:L305-325 (traceability) / acceptance.md:L167-173 — REQ-AUTH-RBAC-001 mapped to wrong AC**
The traceability matrix maps REQ-AUTH-RBAC-001 ("JWT validation on all protected APIs → 401 for missing/expired token") to AC-RBAC-01. But AC-RBAC-01 tests a User calling a Premium endpoint (→ 403). The 401-for-missing-JWT scenario is tested by AC-SECURITY-01, which is NOT listed as an AC for REQ-AUTH-RBAC-001. The mapping is incorrect, leaving this requirement without proper traceability.

---

### Major (degrades quality)

**M1. spec.md:L84-88, L118, L121, L133 — Implementation HOW details embedded in normative requirements**
Multiple REQs name specific implementation artifacts:
- spec.md:L84: `POST /auth/signup` endpoint path, "RFC 5322" standard, "영문/숫자 혼합" (algorithm detail), sequential validation order
- spec.md:L87: "`User.passwordHash` 컬럼" (DB schema column name), "bcrypt(cost factor 10)" (specific algorithm and parameter)
- spec.md:L121: "bcrypt 해시 형태" (specific algorithm)
- spec.md:L133: "`JWT_SECRET`, `JWT_REFRESH_SECRET`" (specific env var names)
Requirements should specify WHAT the system must do, not HOW it must implement it. Naming specific columns, env var names, and library algorithms constrains implementation unnecessarily.

**M2. spec.md:L118 vs acceptance.md:L93 — `onboardingCompleted` field required by ACs but missing from REQ-AUTH-JWT-002**
REQ-AUTH-JWT-002 (spec.md:L117-118) defines JWT payload fields as: `sub`, `role`, `iat`, `exp`. However, AC-LOGIN-01 (acceptance.md:L93) and AC-JWT-01 (acceptance.md:L139) both require `onboardingCompleted` in the Access Token payload. This field is tested by the ACs but not declared in the normative requirement, creating an undocumented requirement that could be missed in implementation.

**M3. spec.md:L160-170 vs acceptance.md:L50-54 — Ambiguity: onboarding inline-with-signup vs. separate step**
REQ-AUTH-SIGNUP-001 (spec.md:L84) and AC-SIGNUP-01 (acceptance.md:L50) show onboarding data sent inline within the `POST /auth/signup` body. However, REQ-AUTH-ONBOARD-004 (spec.md:L169-170) describes a flow where "신규 사용자가 회원가입을 완료한 상태에서, 온보딩이 미완료된 채로 다시 로그인했을 때" — meaning a user can complete signup WITHOUT completing onboarding. These two flows are contradictory: AC-SIGNUP-01 embeds onboarding inside signup, yet REQ-AUTH-ONBOARD-004 assumes onboarding can be incomplete post-signup. A developer must guess which model to implement.

**M4. acceptance.md:L212-213 — AC-ONBOARD-01 uses ambiguous HTTP status code ("403 Forbidden 또는 409 Conflict")**
The criterion states: "시스템은 `403 Forbidden` 또는 `409 Conflict`와 `{ "code": "ONBOARDING_REQUIRED" }`를 반환한다." A tester cannot determine PASS or FAIL when two different status codes are both acceptable. This violates binary testability (AC-2). The status code must be specified unambiguously.

**M5. spec.md:L103-107 — REQ-AUTH-SOCIAL-002 and REQ-AUTH-SOCIAL-003 cannot be decomposed into single EARS patterns**
These two requirements describe compound conditions (State-Driven + conditional). They should be split into proper EARS patterns:
- REQ-AUTH-SOCIAL-002: "While social login verification has succeeded, if the user exists, the system shall issue JWT tokens" — State-Driven + Unwanted/Optional composition.
- REQ-AUTH-SOCIAL-003: Same structure, opposite condition.
As currently written they are not mappable to any single valid EARS type.

**M6. spec.md:L1 format — REQ numbering format deviates from required REQ-{NUM} pattern**
The required format is REQ-001, REQ-002, ..., REQ-N (MP-1). The SPEC uses REQ-AUTH-INVITE-001, REQ-AUTH-SIGNUP-001, etc. While the numbering within each group is sequential with no gaps, the format itself does not match the required pattern. If the project convention allows domain-prefixed IDs, this should be documented and adopted consistently — but as written it fails MP-1's format check.

**M7. plan.md:L219-255 — Full Prisma schema code block in implementation plan**
plan.md Section 6.1 contains a full Prisma schema code block with model definitions. While plan.md is a separate document, it is part of the SPEC artifact set and should not contain production implementation schema. Schema belongs in the codebase, not in the SPEC plan.

**M8. plan.md:L41-43 vs plan.md:L224-228 — Internal contradiction in onboarding completion approach**
plan.md:L41 states: "별도 `onboardingCompleted` boolean 컬럼을 두지 않고, 필수 필드 null 체크로 간소화한다." However, plan.md:L224 shows the Prisma User model with `nickname String` (non-nullable, no `?`). A non-nullable column cannot be null-checked for onboarding completion. This contradiction would cause a runtime error or require a schema redesign during implementation.

---

### Minor (suggestions)

**m1. acceptance.md:L282 — Definition of Done uses subjective language "의미 있는 에러 메시지"**
"비어 있어도 `pnpm start:dev`가 의미 있는 에러 메시지를 출력한다" — "의미 있는" (meaningful) is subjective. Replace with a concrete criterion, e.g., "모든 필수 환경 변수가 누락된 경우 `ConfigService` 오류와 누락된 변수명을 포함한 에러 메시지를 출력한다."

**m2. spec.md:L325 — Traceability grouping "REQ-AUTH-ONBOARD-001~004 → AC-ONBOARD-01" maps 4 REQs to a single AC**
REQ-AUTH-ONBOARD-004 (re-login redirect flow) is substantively different from the others and should have its own dedicated AC. A single AC testing onboarding completion does not adequately verify the re-login mid-onboarding redirect scenario.

**m3. acceptance.md:L103 — AC-LOGIN-02 trace reference is unusual**
`연관 REQ: REQ-AUTH-JWT-001 (보안 경계)` — REQ-AUTH-JWT-001 is about token issuance, not about login failure security. The natural REQ for failed-login → 401 behavior is REQ-AUTH-RBAC-001. Consider revising this reference.

**m4. spec.md:L49 — `REQ-AUTH-JWT-003` requirement partially duplicates REQ-AUTH-SIGNUP-002/003**
REQ-AUTH-SIGNUP-002 and REQ-AUTH-SIGNUP-003 cover password hashing at signup. REQ-AUTH-JWT-003 covers Refresh Token hashing at token issuance. While distinct, the spec bundles them into the JWT section which might lead to confusion. Consider clarifying the scope distinction in the requirement text.

**m5. spec.md:L56-58 — Non-Goals section refers to rate limiting exclusion but NFR-AUDIT-002 in Section 4.5 proposes IP-based logging**
NFR-AUDIT-002 (spec.md:L203) states "IP 기반 카운트로 로깅" for failed authentication — which partially overlaps with the excluded "CAPTCHA / Rate Limiting" in Section 2.2 Non-Goals. The boundary between "IP-based logging for detection" (included) and "IP-based rate limiting middleware" (excluded) should be made explicit to avoid implementation scope creep.

---

## Chain-of-Verification Pass

Second-look findings (new defects discovered during re-examination):

1. **NEW — REQ-AUTH-JWT-007 missing from traceability matrix (C5):** Discovered during second pass verification of the full traceability table against all defined REQs. First pass had noted this possibility but confirmed it definitively on re-read.

2. **NEW — REQ-AUTH-RBAC-001 incorrect AC mapping (C6):** First pass checked that AC-RBAC-01 exists; second pass verified the AC's actual CONTENT does not exercise REQ-AUTH-RBAC-001's 401 scenario. Confirmed defect.

3. **NEW — onboardingCompleted in AC but absent from REQ-AUTH-JWT-002 (M2):** Discovered during cross-reference between spec.md:L118 and acceptance.md:L93/L139. First pass noted payload fields; second pass caught the omission.

4. **NEW — plan.md non-nullable schema vs null-check approach contradiction (M8):** Discovered during second pass review of plan.md section 6.1 against plan.md section 1.5.

Sections verified in second pass: all 27 REQ entries re-read for EARS compliance; full traceability table cross-referenced against complete REQ list; acceptance.md all AC entries re-read for binary testability; plan.md sections 1.5 and 6.1 cross-referenced.

---

## Recommendation

The SPEC fails on three must-pass criteria (MP-1, MP-2, MP-3) and has significant traceability gaps. The following numbered fixes are required before re-audit:

**Fix 1 (MP-3, Critical):** Rename `created` to `created_at` in spec.md YAML frontmatter (line 5). Add `labels` field as an array, e.g., `labels: ["auth", "jwt", "rbac", "onboarding"]`.

**Fix 2 (MP-2, Critical):** Replace the three "(Complex)" labels with valid EARS types. REQ-AUTH-SOCIAL-002 and REQ-AUTH-SOCIAL-003 should each be decomposed into two separate EARS requirements: one State-Driven ("While social login has been verified for provider P...") and one Optional or Unwanted capturing the user-exists / user-not-exists condition. REQ-AUTH-ONBOARD-004 can be rewritten as Event-Driven: "When a user whose onboarding is incomplete submits `POST /auth/login`, the system shall respond with an onboarding redirect indicator."

**Fix 3 (MP-2, Critical):** Add at least one State-Driven requirement. A natural candidate: "While a Premium user's `premiumExpiresAt` is greater than the current UTC time, the system shall grant access to AI recommendation endpoints." This satisfies the all-5-EARS-types criterion.

**Fix 4 (Traceability, Critical):** Add a traceability entry for REQ-AUTH-JWT-007 in spec.md Section 8. Either create a dedicated AC in acceptance.md that verifies JWT secrets are absent from source code, logs, and API responses, or explicitly map REQ-AUTH-JWT-007 to the security criteria table in acceptance.md Section 3.

**Fix 5 (Traceability, Critical):** Correct the traceability entry for REQ-AUTH-RBAC-001. Map it to AC-SECURITY-01 (which tests 401 for expired/tampered tokens) in addition to or instead of AC-RBAC-01.

**Fix 6 (Clarity, Major):** Resolve the onboarding inline-vs-separate ambiguity. Either:
   - Option A: Specify that onboarding data is always submitted inline within `POST /auth/signup` and remove REQ-AUTH-ONBOARD-004.
   - Option B: Specify that `POST /auth/signup` creates the account without onboarding data, and a separate `POST /auth/onboarding` step completes onboarding — then add a dedicated AC for the re-login-before-onboarding redirect scenario.

**Fix 7 (Testability, Major):** In AC-ONBOARD-01 (acceptance.md:L212-213), specify a single HTTP status code for the "ONBOARDING_REQUIRED" response. Remove "또는 `409 Conflict`" ambiguity.

**Fix 8 (Completeness, Major):** Add `onboardingCompleted: <bool>` to the REQ-AUTH-JWT-002 payload field list (spec.md:L118) since this field is tested in AC-JWT-01 and AC-LOGIN-01.

**Fix 9 (Consistency, Major):** Reconcile the onboarding completion detection approach in plan.md. Either make the nullable fields nullable in the Prisma schema (`nickname String?`) to support null-check completion detection, or introduce an explicit `onboardingCompleted Boolean @default(false)` column. Either approach is acceptable but must be consistent between plan.md:L41 and the schema in plan.md:L224.

**Fix 10 (REQ Quality, Major):** Remove specific implementation artifacts from normative requirements text. Move bcrypt algorithm names, env var names, DB column names, and endpoint paths to a separate "Implementation Notes" section rather than embedding them in the REQ body text.

---

Verdict: FAIL
