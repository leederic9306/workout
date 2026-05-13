# SPEC Review Report: SPEC-1RM-001
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.52

---

## Must-Pass Results

- [FAIL] MP-1 REQ number consistency: The SPEC uses a domain-namespaced ID scheme (`REQ-ORM-INPUT-001`, `REQ-ORM-CALC-001`, etc.) rather than the flat sequential `REQ-001, REQ-002, ... REQ-N` format. Within each namespace the numbers are sequential and gapless, but the number suffix "001" is reused across four namespaces (INPUT, CALC, READ, VAL). MP-1 requires a single monotonic sequence with no duplicates. Evidence: spec.md:L76 `REQ-ORM-INPUT-001`, spec.md:L99 `REQ-ORM-CALC-001`, spec.md:L116 `REQ-ORM-READ-001`, spec.md:L133 `REQ-ORM-VAL-001` — four separate "001" entries.

- [FAIL] MP-2 EARS format compliance: Four requirements labeled "Unwanted" do not conform to the EARS Unwanted pattern "If [undesired condition], then the [system] shall [response]." They are stated as design prohibitions ("shall not") without a trigger-response structure. Specifically: spec.md:L91–L92 `REQ-ORM-INPUT-006`, spec.md:L105–L106 `REQ-ORM-CALC-003`, spec.md:L128–L129 `REQ-ORM-READ-005`, spec.md:L151–L152 `REQ-ORM-VAL-007`. Additionally, `REQ-ORM-VAL-007` is an implementation instruction (code ordering) rather than a behavioral requirement.

- [PASS] MP-3 YAML frontmatter validity: All six required fields present with correct types. Evidence: spec.md:L2 `id: SPEC-1RM-001` (string), spec.md:L3 `version: "1.0.0"` (string), spec.md:L4 `status: draft` (string), spec.md:L5 `created_at: "2026-05-11"` (ISO date string), spec.md:L8 `priority: high` (string), spec.md:L10 `labels: ["1rm", "workout", "backend", "mobile"]` (array).

- [N/A] MP-4 Section 22 language neutrality: N/A — this is a single-language (TypeScript) project SPEC for a NestJS backend and React Native mobile app. Multi-language LSP tooling enumeration does not apply.

---

## Category Scores (0.0–1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.50 | 0.50 | Multiple requirements require interpretation: spec.md:L112 REQ-ORM-CALC-005 has two mutually exclusive implementation paths; spec.md:L151 REQ-ORM-VAL-007 is a code-level implementation instruction rather than a behavioral statement; cross-document rounding ambiguity (spec.md:L389 vs acceptance.md:L105–L108) creates interpretive conflict. A reasonable engineer might implement the average rounding differently than intended. |
| Completeness | 0.75 | 0.75 | All required sections present and richly detailed. YAML frontmatter complete. 13 specific exclusion entries. Minor gap: plan.md:L96,L108 implements `maxDecimalPlaces: 2` for `value` and `weight` but spec.md requirements (REQ-ORM-VAL-001 through REQ-ORM-VAL-003) do not mention this constraint. Non-critical but a gap between spec and plan. |
| Testability | 0.50 | 0.50 | acceptance.md:L105–L108 AC-ORM-CALC-01 allows `average` to be either `114.58` or `114.59` — not binary-testable without specifying rounding order. acceptance.md:L186–L188 AC-ORM-CALC-INVALID-03 Case 2 is explicitly described as conditionally passing based on implementation policy. REQ-ORM-INPUT-006 and REQ-ORM-READ-005 do not specify what the system SHALL DO when a userId IS supplied — only that it shall not accept one. |
| Traceability | 0.75 | 0.75 | Comprehensive traceability matrix at spec.md:L503–L533. All 24 functional REQs have at least one AC. All ACs reference valid REQs. One weak mapping: spec.md:L528 REQ-ORM-VAL-007 mapped to AC-ORM-CALC-02 "간접 검증" — AC-ORM-CALC-02 tests DB write absence, not route ordering. No AC directly tests the route ordering behavior mandated by REQ-ORM-VAL-007. |

---

## Defects Found

**D1.** spec.md:L76–L152 — REQ numbering uses a domain-namespaced scheme (`REQ-ORM-INPUT-001`, `REQ-ORM-CALC-001`, `REQ-ORM-READ-001`, `REQ-ORM-VAL-001`) rather than the flat sequential `REQ-001, REQ-002, ... REQ-N` pattern required by MP-1. The number suffix "001" is reused across four namespaces. MP-1 requires no duplicates in the number sequence. — Severity: **critical** (MP-1 violation)

**D2.** spec.md:L85–L86 (REQ-ORM-INPUT-004), spec.md:L148–L149 (REQ-ORM-VAL-006), spec.md:L151–L152 (REQ-ORM-VAL-007), spec.md:L167 (NFR-ORM-SEC-004) — Requirements contain implementation details (HOW), violating RQ-3/RQ-4:
- L85: "Prisma `@@unique([userId, exerciseType])` 제약", "Prisma `upsert` 또는 PostgreSQL의 `ON CONFLICT`"
- L148: "NestJS `ValidationPipe` + `class-validator`(`@IsNumber`, `@IsInt`, `@Min`, `@Max`, `@IsPositive`)"
- L151: "컨트롤러 코드에서 `estimate` 고정 경로 라우트를 `:exerciseType` 동적 경로보다 먼저 정의한다" (implementation instruction)
- L167: "NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`"
— Severity: **major**

**D3.** spec.md:L112 (REQ-ORM-CALC-005) — Contains conditional language creating two mutually exclusive implementation paths in a normative requirement: "직접 import가 가능하면 import하여 사용하고, 모노레포 빌드 제약으로 import가 불가하면 동일한 알고리즘을 백엔드 내부에 재구현하되 단위 테스트로 모바일 측 결과와의 동등성을 검증한다." This is a design decision embedded in a requirement. Only one path is testable in any given implementation. — Severity: **minor**

**D4.** spec.md:L91–L92 (REQ-ORM-INPUT-006), spec.md:L105–L106 (REQ-ORM-CALC-003), spec.md:L128–L129 (REQ-ORM-READ-005), spec.md:L151–L152 (REQ-ORM-VAL-007) — Four requirements labeled "Unwanted" do not conform to the EARS Unwanted pattern "If [undesired condition], then the [system] shall [response]." All four are design prohibitions stating what the system SHALL NOT do, without specifying a trigger event or the system's response when the prohibited condition occurs. Specifically:
- REQ-ORM-INPUT-006: Does not specify what happens if a userId IS supplied in path/body (ignored silently? 400?)
- REQ-ORM-CALC-003: A system invariant (no DB writes), not a response to an unwanted event
- REQ-ORM-READ-005: A design prohibition, not a trigger-response pair
- REQ-ORM-VAL-007: An implementation code-ordering instruction, not a behavioral requirement at all
This is an MP-2 (EARS format compliance) violation. — Severity: **critical**

**D5.** acceptance.md:L105–L108 (AC-ORM-CALC-01) — The `average` field acceptance criterion explicitly allows either `114.58` or `114.59`, stating "반올림 방식(반올림 vs 절사)에 따라 `average`의 마지막 자리가 `.58` 또는 `.59`로 다를 수 있다." This makes the criterion non-binary-testable. A tester cannot determine PASS/FAIL for the `average` field without knowing which rounding convention was selected. Furthermore, spec.md:L389 definitively states `"average": 114.59` with no ambiguity qualifier — this is a cross-document inconsistency with acceptance.md. The correct value should be determined by specifying rounding order (round-then-average vs average-then-round). — Severity: **major**

**D6.** acceptance.md:L186–L188 (AC-ORM-CALC-INVALID-03, Case 2) — `reps="5"` (numeric string) is described as having conditional behavior: "NestJS 전역 `ValidationPipe({ transform: true })` 설정 시 자동 변환되어 `5`로 통과 가능. 구현 정책에 맞춰 테스트한다." This delegates the test criteria to implementation policy, making it non-binary-testable. The AC should specify a definitive PASS/FAIL expectation for this input, not "test according to policy." — Severity: **major**

**D7.** spec.md:L528 — REQ-ORM-VAL-007 is traced to AC-ORM-CALC-02 as "간접 검증." AC-ORM-CALC-02 (acceptance.md:L112–L128) tests that `POST /estimate` performs no DB writes — it does NOT test that `estimate` route ordering is correct, nor that routing ambiguity is resolved. No acceptance criterion directly verifies the route ordering behavior required by REQ-ORM-VAL-007. REQ-ORM-VAL-007 is thus effectively uncovered by testable criteria. — Severity: **minor**

**D8.** spec.md:L389 vs acceptance.md:L105–L108 — Cross-document inconsistency in the definitive `average` value for `weight=100, reps=5`. spec.md states `"average": 114.59`; plan.md:L471 states `average=114.59`; but the mathematical reality is: raw average = 114.5833..., which rounds to `114.58`. The `114.59` result requires rounding intermediate values first (round Epley to 116.67, then average). spec.md and plan.md present `114.59` as definitively correct without specifying the rounding order. acceptance.md correctly identifies the ambiguity but thereby contradicts the definitiveness of spec.md. The SPEC must explicitly define the rounding rule: either "round each intermediate value to 2 decimal places, then compute average" (→ 114.59) or "compute average from unrounded values, then round final result" (→ 114.58). — Severity: **major**

**D9.** plan.md:L96, L108 — The implementation plan uses `@IsNumber({ maxDecimalPlaces: 2 })` for both `value` (PUT body) and `weight` (POST estimate body), limiting input to at most 2 decimal places. This validation constraint does not appear in spec.md REQ-ORM-VAL-001, REQ-ORM-VAL-002, or REQ-ORM-VAL-003. A user submitting `value: 142.567` would be rejected by the implementation but accepted by spec.md requirements. The spec and plan are inconsistent on this validation boundary. — Severity: **minor**

---

## Chain-of-Verification Pass

Second-look findings:

Re-reading REQ-ORM-INPUT-006 more carefully (spec.md:L91–L92): The requirement states the system "should not receive userId." The acceptance criterion AC-ORM-SECURITY-02 (acceptance.md:L270–L293) tests that U2's token only affects U2's data, but does NOT test what happens when a client explicitly includes a userId field in the request body. NFR-ORM-SEC-004's `whitelist: true` would silently strip or reject extra fields — but this behavior is not specified in REQ-ORM-INPUT-006's normative text. The requirement is incomplete in not specifying the response to the prohibited input. This adds to the testability gap already noted in D4.

Re-reading the route ordering concern (REQ-ORM-VAL-007, spec.md:L151–L152): The spec explicitly acknowledges that `POST /estimate` and `PUT /:exerciseType` use different HTTP methods, so there is no actual NestJS routing conflict. The requirement is labeled as a precautionary measure for future-proofing. As a behavioral requirement, it cannot be tested against running behavior (there is no failing case to test against currently). As a code review requirement, it has no mapping to an automated AC. The combination of being an implementation instruction (D2), a misapplied EARS label (D4), and having no testable AC (D7) makes this one of the most problematic requirements in the SPEC.

No additional defects found beyond D1–D9.

Sections re-verified in second pass: YAML frontmatter (all fields confirmed), all Unwanted-labeled requirements (confirmed D4), acceptance.md rounding discussion (confirmed D5 and D8), plan.md DTO constraints (confirmed D9), traceability matrix end-to-end (confirmed D7).

---

## Recommendation

The SPEC fails on two must-pass criteria (MP-1 and MP-2) and has four major defects in addition to three minor ones. The following numbered, actionable fixes are required:

**Fix 1 (MP-1 — critical):** Renumber all requirements with a flat sequential scheme: REQ-001 through REQ-024 (or adjust the total count based on final requirements). The current namespaced scheme may be preserved as a cross-reference alias in the traceability matrix, but the primary IDs used in the EARS requirements section must be flat sequential.

*Alternative:* If the namespaced scheme is intentional for large-document readability, explicitly document the rationale in the SPEC and request a MP-1 waiver from the project SPEC governance — this audit cannot grant one unilaterally.

**Fix 2 (MP-2 — critical):** Reformulate all four Unwanted-labeled requirements to follow the EARS Unwanted pattern "If [undesired condition], then the [system] shall [response]":

- REQ-ORM-INPUT-006: "If a request to `PUT /users/me/1rm/:exerciseType` includes a `userId` field in the path parameters or request body, then the system shall reject the field (via `ValidationPipe` whitelist) and determine the target user solely from the JWT `sub` claim." — Note: the response to the prohibited field (silently ignored vs 400 rejected) must be explicitly specified.

- REQ-ORM-CALC-003: Convert from Unwanted to Ubiquitous — "The system shall not perform any database write operations when processing `POST /users/me/1rm/estimate` requests." (This is an invariant, not a response to a trigger, making Ubiquitous more appropriate than Unwanted.)

- REQ-ORM-READ-005: Similar to INPUT-006 — reformulate as: "If `GET /users/me/1rm` receives a userId query or path parameter, then the system shall ignore the parameter and return data for the user identified by the JWT `sub` claim only."

- REQ-ORM-VAL-007: This requirement is an implementation instruction, not a behavioral requirement. Either: (a) remove it from the REQUIREMENTS section and move it to plan.md as an implementation note, or (b) reformulate it as a behavioral Unwanted requirement: "If a request to `POST /users/me/1rm/estimate` is incorrectly routed as a `PUT` to `:exerciseType=estimate`, then the system shall return the correct estimate response (not attempt to upsert a 1RM for exerciseType 'estimate')." Note that as the SPEC itself acknowledges (spec.md:L402), this cannot happen with different HTTP methods, making option (a) preferable.

**Fix 3 (major — D5, D8):** Define the precise rounding order for `average` calculation. Choose one and update spec.md, plan.md, and acceptance.md consistently:
- Option A (spec.md L389 value of 114.59): "Epley and Brzycki are each rounded to 2 decimal places first, then averaged, and the average is rounded to 2 decimal places." Update acceptance.md:L105–L108 to state `average = 114.59` definitively and remove the `.58 or .59` ambiguity.
- Option B (mathematically purer): "Compute Epley, Brzycki, and average from unrounded values, then round each result independently to 2 decimal places." Update all documents to state `average = 114.58`.

**Fix 4 (major — D6):** AC-ORM-CALC-INVALID-03 Case 2 (`reps="5"` string): Decide and document definitively whether this input is accepted or rejected. If `ValidationPipe({ transform: true })` is the project standard (as implied by NFR-ORM-SEC-004), then `"5"` should be accepted (transformed to integer 5) and the AC should state `PASS`. If the project requires strict type enforcement, the AC should state `FAIL`. Remove the "구현 정책에 맞춰 테스트한다" ambiguity.

**Fix 5 (major — D2):** Move implementation details from normative requirements to plan.md or informational notes:
- REQ-ORM-INPUT-004: Remove "Prisma `@@unique`", "Prisma `upsert`", "PostgreSQL `ON CONFLICT`" — replace with behavioral: "The system shall ensure at most one 1RM record exists per user per compound type. Concurrent requests for the same user and compound must be handled atomically."
- REQ-ORM-VAL-006: Remove NestJS/class-validator specifics — replace with behavioral: "The system shall validate all request inputs and include the names of failing fields in error responses."
- NFR-ORM-SEC-004: Move to plan.md as implementation guidance.

**Fix 6 (minor — D3):** REQ-ORM-CALC-005: Replace the conditional two-path structure with a single behavioral requirement: "The system shall produce 1RM estimate results mathematically equivalent to the `calculateEpley`, `calculateBrzycki`, and `calculateAverage1RM` functions defined in `packages/utils/src/1rm.ts`." Remove the implementation decision logic (import vs re-implement) from the requirement body.

**Fix 7 (minor — D7):** Add a dedicated acceptance criterion for REQ-ORM-VAL-007 route ordering (if it is retained as a requirement). The criterion should verify, via E2E test, that `POST /users/me/1rm/estimate` is correctly routed and does not interact with `PUT /users/me/1rm/:exerciseType` routing logic.

**Fix 8 (minor — D9):** Decide whether `maxDecimalPlaces: 2` applies to `value` and `weight` inputs. If yes, add to spec.md REQ-ORM-VAL-001 and REQ-ORM-VAL-003: "Values must not exceed 2 decimal places." If no, remove the constraint from plan.md DTOs.

---

Verdict: FAIL
