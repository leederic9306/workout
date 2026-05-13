# SPEC Review Report: SPEC-PROGRAM-001
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.74

---

## Must-Pass Results

- [FAIL] MP-1 REQ Number Consistency: Namespaced scheme (REQ-PROG-CATALOG-001, REQ-PROG-DETAIL-001, REQ-PROG-ACTIVE-001, REQ-PROG-AI-001, REQ-PROG-SEED-001, REQ-PROG-VAL-001) is the declared project standard per spec.md:L21-24. Each namespace is internally sequential with no gaps or duplicates: CATALOG 001-005, DETAIL 001-007, ACTIVE 001-010, AI 001-012, SEED 001-005, VAL 001-005. **PASS per project convention note.**
- [FAIL] MP-2 EARS Format Compliance: Three requirements carry the "Unwanted" label but do NOT match the EARS Unwanted pattern ("If [undesired condition], then the [system] shall [response]"). See D1, D2, D3 below. **FAIL.**
- [PASS] MP-3 YAML Frontmatter Validity: spec.md:L1-11 contains all required fields — `id: SPEC-PROGRAM-001` (string), `version: "1.0.0"` (string), `status: draft` (string), `created_at: "2026-05-11"` (ISO date), `priority: high` (string), `labels: ["program", "ai", "backend", "mobile"]` (array). All fields present with correct types.
- [N/A] MP-4 Section 22 Language Neutrality: This SPEC is scoped to a single NestJS/TypeScript backend project. It is not a multi-language tooling SPEC. N/A: single-language SPEC.

---

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | Most requirements are unambiguous. Two requirements contain open-ended response codes deferred to plan.md (spec.md:L160 "200 OK 또는 201 Created", spec.md:L218 "502 또는 503, plan.md에서 확정"). A reasonable engineer might implement either. |
| Completeness | 1.0 | 1.0 | All required sections present: HISTORY (L15-18), WHY/Goals (Section 2.1), WHAT/Overview (Section 1), REQUIREMENTS (Section 3), ACCEPTANCE CRITERIA cross-referenced to acceptance.md with full traceability matrix (Section 9), Exclusions (Section 7, 13 entries). YAML frontmatter complete. |
| Testability | 0.75 | 0.75 | Most ACs are binary-testable. NFR-PROG-AI-COST-003 (spec.md:L298) uses "합리적 상한" (reasonable upper limit) without fixing the value in spec.md itself. REQ-PROG-AI-001 (spec.md:L160) leaves response code ambiguous ("200 OK 또는 201 Created") — a tester cannot determine PASS/FAIL without consulting plan.md. |
| Traceability | 0.95 | 1.0 | Every REQ has at least one AC in the traceability matrix (spec.md:L769-820). Every AC-ID referenced in the matrix exists in acceptance.md. One minor issue: NFR-PROG-PERF-001~006 maps to AC-PROG-PERF-01, but NFR-PROG-PERF-006 (POST /ai/programs P95) is explicitly excluded from AC-PROG-PERF-01 (acceptance.md:L574-576) without a separate AC — the traceability matrix entry does not distinguish this gap. Downgraded from 1.0 to 0.95. |

---

## Defects Found

**D1. spec.md:L154-155 — REQ-PROG-ACTIVE-010 labeled (Unwanted) but does not follow EARS Unwanted pattern — Severity: major**

The requirement reads:
> "시스템은 활성 프로그램 관리 엔드포인트에서 JWT `sub` 외 다른 `userId`로 `UserProgram`을 조회·수정·삭제해서는 안 된다. 요청 바디·쿼리·path에 `userId`를 받을 수 있는 분기를 제공하지 않는다."

EARS Unwanted pattern requires: "If [undesired condition], then the [system] shall [response]." The actual sentence is a negative Ubiquitous constraint ("시스템은 ... 해서는 안 된다"). It does not specify the observable system response when the undesired condition occurs. A conformant Unwanted formulation would be, for example: "만약 요청 바디에 `userId` 필드가 포함된 경우, 시스템은 `400 Bad Request`를 반환해야 한다." Either relabel as Ubiquitous or rewrite in Unwanted pattern.

---

**D2. spec.md:L214-215 — REQ-PROG-AI-011 labeled (Unwanted) but does not follow EARS Unwanted pattern — Severity: major**

The requirement reads:
> "시스템이 `POST /ai/programs`를 처리할 때, 시스템은 요청 바디나 헤더의 `userId` 필드를 사용자 식별에 적용해서는 안 된다. 사용자 식별과 권한 검사는 JWT `sub` 클레임과 `role` 클레임으로만 수행된다."

This is a State-driven framing ("While processing...") combined with a negative Ubiquitous constraint. It does not define a testable "if undesired condition → observable response." The second sentence is a design constraint, not a behavior statement. Relabel as State-driven Ubiquitous, or rewrite in Unwanted pattern specifying what happens when a `userId` field is injected.

---

**D3. spec.md:L261-262 — REQ-PROG-VAL-005 labeled (Unwanted) but does not follow EARS Unwanted pattern — Severity: major**

The requirement reads:
> "시스템은 `Program.isPublic`을 `true`로 설정해서는 안 된다(본 SPEC 범위 내). 시드 및 AI 생성 모두 `false`로 고정한다."

This is a Ubiquitous constraint, not an Unwanted pattern. There is no "If [undesired condition]" trigger. Relabel as Ubiquitous, or rewrite: "If any code path attempts to set `Program.isPublic = true`, the system shall reject the operation / revert to `false`."

---

**D4. spec.md:L160 — REQ-PROG-AI-001 leaves success response code ambiguous within spec.md — Severity: major**

The requirement states: "시스템은 ... `200 OK` 또는 `201 Created`로 생성된 프로그램 상세를 반환해야 한다." The response code is left open to either value. A tester reading spec.md alone cannot determine whether a `200 OK` response is a PASS or FAIL. The API Spec section (spec.md:L636) states "Response 201 Created", and acceptance.md AC-PROG-AI-SUCCESS-01 (acceptance.md:L260) expects `201 Created` — this creates intra-document inconsistency within spec.md (REQ section vs API Spec section) and cross-document ambiguity. The REQ text must be updated to specify `201 Created` definitively, matching the API Spec and acceptance.md.

---

**D5. spec.md:L218 — REQ-PROG-AI-012 defers error response code determination to plan.md — Severity: minor**

The requirement states: "`502 Bad Gateway`(또는 `503 Service Unavailable`, plan.md에서 확정)". A requirement must be self-contained and testable from spec.md alone. Deferring the specific HTTP status code to plan.md means the SPEC is incomplete as a standalone specification document. plan.md:L646 and acceptance.md:L387 both list "502 Bad Gateway 또는 503 Service Unavailable" — still ambiguous. The spec.md requirement must specify which code is returned under which condition (e.g., 502 for 5xx upstream errors, 503 for planned unavailability, 504 for timeout).

---

**D6. spec.md:L251-252 — REQ-PROG-VAL-003 hardcodes implementation detail (NestJS ValidationPipe) in a normative requirement — Severity: minor**

The requirement states: "시스템은 모든 입력 본문 검증을 NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `class-validator`로 일관되게 수행해야 한다."

A requirement should specify WHAT the system does (validates input, rejects unknown fields → 400), not HOW it is implemented (which specific library and configuration option). The NestJS/class-validator specifics are implementation choices that belong in plan.md. This conflates behavior requirement with implementation constraint. Severity is minor because the behavior outcome (400 on invalid input) is separately stated in REQ-PROG-AI-008.

---

**D7. spec.md:L769-820 — Traceability matrix lists "NFR-PROG-PERF-001~006 → AC-PROG-PERF-01" but NFR-PROG-PERF-006 has no automated AC — Severity: minor**

NFR-PROG-PERF-006 concerns `POST /ai/programs` P95 ≤ 10s with a 30s timeout. acceptance.md:L574-576 explicitly excludes this from AC-PROG-PERF-01's automated measurement scope ("POST /ai/programs는 외부 API 의존이므로 본 자동화 시나리오에서는 측정 대상에서 제외"). The traceability matrix should either list a separate AC entry (e.g., a manual verification scenario) or note the exclusion explicitly. As written, a reader of the traceability matrix would conclude NFR-PROG-PERF-006 has automated coverage it does not have.

---

## Chain-of-Verification Pass

Second-look findings after re-reading each section:

**Re-read REQ-PROG-ACTIVE group (L125-155):** Confirmed REQ-PROG-ACTIVE-010's EARS Unwanted mislabeling (D1). Also noted: REQ-PROG-ACTIVE-006 (L142-143) includes a conditional clause "활성 프로그램이 있으면 시스템은" within an Event-Driven framing — technically this is a State+Event hybrid (event trigger + state guard). Acceptable in EARS as a compound condition. No new defect.

**Re-read REQ-PROG-AI group (L157-218):** Confirmed D2 (REQ-PROG-AI-011), D4 (REQ-PROG-AI-001 ambiguity), D5 (REQ-PROG-AI-012 deferral). Checked REQ-PROG-AI-004 (L168-169) labeled Ubiquitous but contains a conditional "AI 응답이 검증을 통과하여 프로그램이 실제로 생성된 경우에만" — this conditional makes it closer to Event-Driven or State-Driven. The behavior meaning is clear, so this is a minor labeling issue only. Already covered by the EARS compliance failure (D1-D3 are the critical defects; this is a fourth Ubiquitous mislabeling of lesser severity). Added as D8 below.

**Re-read traceability matrix (L769-820):** Confirmed D7. No additional orphaned ACs found. All 24 AC IDs in the matrix exist in acceptance.md.

**Re-read Exclusions (L707-724):** 13 exclusion entries are specific and actionable. No vague entries. PASS.

**Re-read API Spec (L456-662):** Confirmed the "200 OK 또는 201 Created" in REQ-PROG-AI-001 vs "Response 201 Created" in spec.md:L636 intra-document inconsistency (D4). Also noted plan.md:L509-515 introduces a new feature not in spec.md (usage meta field `{ usage: { programCreations, limit: 10 } }` added to POST /ai/programs response). This is a plan.md addition that has no corresponding REQ in spec.md and is not covered by any AC — flagged as D9.

**Additional defects discovered in second pass:**

**D8. spec.md:L168-169 — REQ-PROG-AI-004 labeled (Ubiquitous) but contains a conditional guard clause — Severity: minor**

"시스템은 AI 응답이 검증을 통과하여 프로그램이 실제로 생성된 경우에만 ... +1 해야 한다" — the phrase "경우에만 (only when)" introduces a condition. Pure Ubiquitous requires unconditional system behavior. This is more accurately Event-Driven ("When AI response passes validation and program is saved successfully, the system shall increment AiUsageLog.programCreations by 1") combined with an Unwanted constraint ("If the program is not saved, the system shall not increment the counter"). The behavioral intent is clear, but the EARS labeling is incorrect.

**D9. plan.md:L509-515 — plan.md introduces a response field (`usage: { programCreations, limit: 10 }`) for POST /ai/programs not covered by any spec.md REQ or acceptance.md AC — Severity: minor**

plan.md:L509-515 states: "POST /ai/programs 성공 응답에 메타 필드(`usage: { programCreations, limit: 10 }`)를 추가하는 것을 plan.md 수준에서 권장." This is an undocumented addition to the API contract: no REQ in spec.md requires it, no AC in acceptance.md verifies it. While labeled as a recommendation, if implemented it creates a gap between spec.md and the actual implementation. This field should either be added as a formal REQ/AC in spec.md, or explicitly labeled as out-of-scope in plan.md.

---

## Regression Check

Not applicable — this is iteration 1.

---

## Recommendation

The overall SPEC is well-structured, thorough, and covers the domain comprehensively. The primary defects requiring resolution before PASS are:

### Critical Fixes (must resolve for PASS):

**Fix D1 — REQ-PROG-ACTIVE-010 (spec.md:L154-155):**
Rewrite from negative Ubiquitous to proper Unwanted EARS pattern, or relabel as Ubiquitous. Example Unwanted rewrite:
> "만약 요청 바디, 쿼리, 또는 경로 파라미터에 `userId` 필드가 포함된 경우, 시스템은 `400 Bad Request`를 반환해야 한다."
Or relabel as `(Ubiquitous)` since the constraint is absolute regardless of trigger condition.

**Fix D2 — REQ-PROG-AI-011 (spec.md:L214-215):**
Relabel as `(State-driven)` ("While processing POST /ai/programs, the system shall...") or rewrite as proper Unwanted:
> "만약 요청 바디 또는 헤더에 `userId` 필드가 포함된 경우, 시스템은 해당 필드를 무시하고 JWT `sub` 클레임으로만 사용자를 식별해야 한다."

**Fix D3 — REQ-PROG-VAL-005 (spec.md:L261-262):**
Relabel as `(Ubiquitous)`. The constraint "시스템은 Program.isPublic을 true로 설정해서는 안 된다" is unconditional — it qualifies as a Ubiquitous negative constraint.

**Fix D4 — REQ-PROG-AI-001 (spec.md:L160):**
Replace "200 OK 또는 201 Created" with "201 Created" to match spec.md:L636 (API Spec section) and acceptance.md AC-PROG-AI-SUCCESS-01 (acceptance.md:L260). This eliminates intra-document inconsistency.

### Recommended Fixes (improve quality):

**Fix D5 — REQ-PROG-AI-012 (spec.md:L218):**
Remove the "plan.md에서 확정" deferral. Specify: "시스템은 `502 Bad Gateway`를 반환해야 한다" (for 5xx upstream), and verify that `503` and `504` cases are separately covered or explicitly excluded. The timeout case (504) is already covered by NFR-PROG-PERF-006.

**Fix D6 — REQ-PROG-VAL-003 (spec.md:L251-252):**
Replace the NestJS-specific implementation with behavioral language: "시스템은 DTO에 정의되지 않은 필드가 포함된 요청에 대해 `400 Bad Request`를 반환해야 한다."

**Fix D7 — Traceability matrix (spec.md:L815):**
Split the NFR-PROG-PERF entry: "NFR-PROG-PERF-001~005 | AC-PROG-PERF-01" and "NFR-PROG-PERF-006 | MV-PROG-AI-PROMPT-01 (수동 검증, staging)" to accurately reflect that PERF-006 has no automated coverage.

**Fix D8 — REQ-PROG-AI-004 (spec.md:L168):**
Change label from `(Ubiquitous)` to `(Event-Driven)` and split into two EARS statements: one Event-Driven for the increment case, one Unwanted for the non-increment case.

**Fix D9 — plan.md:L509-515:**
Either add a formal REQ (e.g., REQ-PROG-AI-013) and corresponding AC to spec.md/acceptance.md for the `usage` meta field, or explicitly mark it as "out of scope for this SPEC, deferred to SPEC-AI-001."

---

Verdict: FAIL
