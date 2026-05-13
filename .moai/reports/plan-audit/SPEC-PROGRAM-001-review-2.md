# SPEC Review Report: SPEC-PROGRAM-001
Iteration: 2/3
Verdict: FAIL
Overall Score: 0.80

---

## Must-Pass Results

- [PASS] MP-1 REQ Number Consistency: Per project convention (namespaced REQ scheme declared at spec.md:L22-24), each namespace is internally sequential with no gaps or duplicates: CATALOG 001-005, DETAIL 001-007, ACTIVE 001-010, AI 001-012, SEED 001-005, VAL 001-005. PASS per caller-specified convention note.
- [FAIL] MP-2 EARS Format Compliance: Two requirements remain non-conformant. REQ-PROG-AI-011 (spec.md:L215-216) has a valid Unwanted first sentence followed by a freestanding Ubiquitous-negative second sentence — mixed patterns within a single criterion. REQ-PROG-VAL-005 (spec.md:L265-266) is labeled Unwanted but both clauses fail the pattern: clause 1 uses an Event-Driven trigger ("경로로 요청이 들어왔을 때"), not an undesired-condition trigger; clause 2 is a pure Ubiquitous negative constraint. FAIL.
- [PASS] MP-3 YAML Frontmatter Validity: spec.md:L1-11 — `id: SPEC-PROGRAM-001` (string), `version: "1.0.1"` (string), `status: draft` (string), `created_at: "2026-05-11"` (ISO date string), `priority: high` (string), `labels: ["program", "ai", "backend", "mobile"]` (array). All required fields present with correct types.
- [N/A] MP-4 Section 22 Language Neutrality: N/A — single-language NestJS/TypeScript backend SPEC. Not multi-language tooling.

---

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.90 | 0.75-1.0 | D4 (REQ-PROG-AI-001 ambiguous response code) resolved at spec.md:L161 — now definitively `201 Created`. D5 (REQ-PROG-AI-012 plan.md deferral) resolved at spec.md:L219-222 — all three error codes specified inline. Residual clarity issue: REQ-PROG-AI-011 (spec.md:L216) second sentence mixes two unrelated constraints (validation counter policy + userId injection prohibition) in one REQ, creating implementation ambiguity about scope. |
| Completeness | 1.0 | 1.0 | All required sections present: HISTORY (spec.md:L15-18), Goals/WHY (Section 2), Overview/WHAT (Section 1), REQUIREMENTS (Section 3), ACCEPTANCE CRITERIA cross-referenced via traceability matrix (Section 9), Exclusions (Section 7, 13 specific entries). YAML frontmatter complete with all required fields. |
| Testability | 0.85 | 0.75-1.0 | REQ-PROG-AI-001 (spec.md:L161) now definitively `201 Created` — tester can determine PASS/FAIL. REQ-PROG-AI-012 (spec.md:L219-222) now specifies 502/422/504 per branch — testable. Residual: NFR-PROG-AI-COST-003 (spec.md:L298) still uses "합리적 상한" without a concrete value. REQ-PROG-VAL-005 second clause ("항상 false로 고정") is testable via DB inspection. Score upgraded from 0.75 to 0.85 due to D4/D5 resolution. |
| Traceability | 0.95 | 1.0 | Every REQ has at least one AC in the traceability matrix (spec.md:L769-820). No orphaned ACs detected. The NFR-PROG-PERF-001~006 → AC-PROG-PERF-01 gap (D7 from iteration 1) remains in the matrix: NFR-PROG-PERF-006 has no automated AC but the traceability entry bundles it with 001-005. Held at 0.95. |

---

## Defects Found

**D1-RESOLVED. spec.md:L155-156 — REQ-PROG-ACTIVE-010 EARS Unwanted compliance — RESOLVED**

The iteration 1 defect required an "If [undesired condition], then the system shall [response]" pattern. The revised text reads: "사용자가 자신의 활성 프로그램이 아닌 타 사용자의 `UserProgram`에 접근하려 할 때, 시스템은 해당 요청을 거부하고 `403 Forbidden`을 반환해야 한다." This matches the Unwanted pattern (undesired condition: accessing another user's UserProgram; system response: reject + 403). RESOLVED.

**D2-UNRESOLVED. spec.md:L215-216 — REQ-PROG-AI-011 mixed EARS pattern — Severity: major**

The requirement now has two distinct sentences:
- Sentence 1: "AI 응답 검증이 실패한 경우 (...), 시스템은 `AiUsageLog.programCreations` 카운터를 증가시키지 않고 `422 Unprocessable Entity`를 반환해야 한다." — Valid Unwanted EARS ("If [AI validation fails], the system shall [not increment + return 422]").
- Sentence 2: "또한 시스템은 요청 바디나 헤더에 포함된 `userId` 필드를 사용자 식별에 적용해서는 안 되며, 사용자 식별과 권한 검사는 JWT `sub` 클레임과 `role` 클레임으로만 수행된다." — This is a Ubiquitous negative constraint with no "If [undesired condition]" trigger. There is no conditional structure; the system prohibition is absolute regardless of any trigger.

Per MP-2: "mixed informal/formal within a single criterion = FAIL." The second sentence is not EARS Unwanted. It is informal Ubiquitous language appended to an Unwanted-labeled requirement. The fix in iteration 1 addressed the first sentence but introduced a second non-conformant sentence. UNRESOLVED.

**D3-UNRESOLVED. spec.md:L265-266 — REQ-PROG-VAL-005 EARS pattern mismatch — Severity: major**

The requirement was revised to read: "`GET /programs/catalog` 또는 `GET /programs/active` 경로로 요청이 들어왔을 때, 시스템은 이를 `:id` 동적 라우트로 매칭하지 않아야 한다. 또한 본 SPEC 범위 내에서 카탈로그 시드와 AI 생성 모두 `Program.isPublic`을 `true`로 설정해서는 안 되며 항상 `false`로 고정해야 한다."

Still labeled `(Unwanted)`. Two issues remain:

1. Clause 1 trigger is "경로로 요청이 들어왔을 때" (when the request arrives on this path). This is an **Event-Driven** trigger structure — a normal, expected event — not an "undesired condition" that defines the Unwanted pattern. The EARS Unwanted pattern requires the trigger to be an undesired or abnormal condition. The routing misbehavior being described is a system implementation constraint, not a user-observable trigger. This clause belongs to REQ-PROG-VAL-001 conceptually (same routing subject); its inclusion here creates duplication.

2. Clause 2 ("카탈로그 시드와 AI 생성 모두 `Program.isPublic`을 `true`로 설정해서는 안 되며") is a Ubiquitous negative constraint — it applies unconditionally regardless of any trigger condition. This is not EARS Unwanted.

One requirement body now contains two unrelated subjects (routing + isPublic field constraint) expressed in two different non-Unwanted EARS patterns. UNRESOLVED.

**D4-RESOLVED. spec.md:L161 — REQ-PROG-AI-001 response code now definitively 201 Created — RESOLVED**

Old text: "`200 OK` 또는 `201 Created`로 생성된 프로그램 상세를 반환해야 한다."
New text: "`201 Created`로 생성된 프로그램 상세를 반환해야 한다."
Consistent with spec.md:L640 (API Spec section) and acceptance.md:L260. RESOLVED.

**D5-RESOLVED. spec.md:L218-222 — REQ-PROG-AI-012 upstream error codes definitively specified — RESOLVED**

Old text deferred to plan.md for code selection. New text at spec.md:L219-222 specifies all three branches inline:
- Network errors / API key invalid / 5xx → `502 Bad Gateway`
- Malformed response (JSON parsing failure) → `422 Unprocessable Entity`
- Response time > 30s → `504 Gateway Timeout`

No "plan.md에서 확정" deferral remains. RESOLVED.

**D6-CARRIED. spec.md:L254-256 — REQ-PROG-VAL-003 hardcodes NestJS implementation details — Severity: minor**

Not in the mandatory regression list but carried forward from iteration 1. The requirement still reads: "시스템은 모든 입력 본문 검증을 NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `class-validator`로 일관되게 수행해야 한다." This names specific library and configuration options (WHAT/HOW conflation). Per RQ-4, requirements must not specify function names, class names, or library versions. Severity remains minor because the behavioral outcome (400 on unknown fields) is also stated in REQ-PROG-AI-008 and verified in acceptance.md:L366-369.

**D7-CARRIED. spec.md:L821 — Traceability matrix bundles NFR-PROG-PERF-006 under AC-PROG-PERF-01 without noting it has no automated coverage — Severity: minor**

Not in the mandatory regression list but carried forward. The entry "NFR-PROG-PERF-001~006 | AC-PROG-PERF-01" remains. acceptance.md:L574-576 explicitly excludes PERF-006 from automated measurement. A reader of the traceability matrix would incorrectly conclude PERF-006 has automated coverage.

**D8-RESOLVED. spec.md:L169 — REQ-PROG-AI-004 reclassified to Event-Driven — RESOLVED**

Old label: `(Ubiquitous)`. New label at spec.md:L169: `(Event-Driven, 사용량 카운트 정책)`. The requirement now opens with "Premium 또는 Admin 사용자가 `POST /ai/programs`를 호출했을 때" (Event-Driven trigger). RESOLVED.

---

## Chain-of-Verification Pass

Second-look findings after re-reading each section:

**Re-read REQ-PROG-ACTIVE group (spec.md:L126-156):** Confirmed D1 RESOLVED. REQ-PROG-ACTIVE-010 now conforms to Unwanted EARS. No new defects in this group.

**Re-read REQ-PROG-AI group (spec.md:L158-222):** Confirmed D4 and D5 RESOLVED, D8 RESOLVED. Confirmed D2 UNRESOLVED — the second sentence of REQ-PROG-AI-011 remains a Ubiquitous-negative embedded in an Unwanted-labeled requirement.

Checked REQ-PROG-AI-004 (spec.md:L169-170) more carefully: Label is `(Event-Driven)` and the body opens with a proper Event-Driven trigger "호출했을 때". The body also contains "경우에만" conditional clauses, but these are sub-conditions within an Event-Driven trigger, which is acceptable EARS (compound conditions within a single pattern). No further issue.

**Re-read REQ-PROG-VAL group (spec.md:L248-266):** Confirmed D3 UNRESOLVED. REQ-PROG-VAL-005 at spec.md:L265-266 remains non-conformant Unwanted — dual subject matter (routing + isPublic) and Event-Driven trigger structure in clause 1.

**Re-read all REQ EARS labels end-to-end:**

- CATALOG-001 to 005: CATALOG-001 Event-Driven (valid); CATALOG-002 Ubiquitous (valid); CATALOG-003 Ubiquitous (valid); CATALOG-004 Ubiquitous (valid); CATALOG-005 Ubiquitous (valid).
- DETAIL-001 to 007: All Event-Driven or Ubiquitous — labels consistent with text. DETAIL-004 "사용자가 ... 호출한 경우, 시스템은 `404 Not Found`를 반환" — this is Event-Driven with embedded Unwanted-style trigger. Label is "(Event-Driven, 권한 검사)" which is acceptable.
- ACTIVE-001 to 010: Confirmed D1 resolved (ACTIVE-010). ACTIVE-001 labeled `(Event-Driven, 활성화)` — body says "200 OK 또는 201 Created." This mirrors the original REQ-PROG-ACTIVE-001 (spec.md:L129) which the caller did NOT flag as a defect in iteration 1. Checking now: spec.md:L129 reads "...`200 OK` 또는 `201 Created`로 `{ userProgramId, programId, startedAt }`을 반환해야 한다." This ambiguity (two valid status codes) still exists in REQ-PROG-ACTIVE-001 and creates a testability concern — a tester cannot determine which code constitutes PASS/FAIL without additional guidance. The API Spec at spec.md:L584-586 distinguishes the two cases (200 for replacement, 201 for new). However the REQ body does not provide the conditional split. This is a new finding not previously flagged. Catalogued as D-NEW-1 below.
- AI-001 to 012: Confirmed D4 resolved (AI-001), D5 resolved (AI-012), D8 resolved (AI-004), D2 unresolved (AI-011).
- SEED-001 to 005: All Ubiquitous or Event-Driven labels appear consistent with text.
- VAL-001 to 005: Confirmed D3 unresolved (VAL-005). VAL-001 uses Event-Driven correctly.

**Re-read Exclusions (spec.md:L706-729):** 13 entries, all specific and actionable. No vague entries. PASS.

**Re-read traceability matrix (spec.md:L768-826):** Confirmed D7. All REQ IDs in the matrix exist in Section 3. All AC IDs referenced match those in acceptance.md verified in iteration 1. PASS except D7.

**Additional defect discovered in second pass:**

**D-NEW-1. spec.md:L129 — REQ-PROG-ACTIVE-001 leaves activate response code ambiguous ("200 OK 또는 201 Created") in the REQ body — Severity: minor**

REQ-PROG-ACTIVE-001 states: "...`200 OK` 또는 `201 Created`로 `{ userProgramId, programId, startedAt }`을 반환해야 한다." The conditions under which each code applies are deferred to the API Spec section (spec.md:L584-586). The REQ text alone is non-binary-testable: a tester reading only this requirement cannot determine whether `200 OK` or `201 Created` is the expected response for a given scenario. The API Spec section does split the conditions (200 for replacement, 201 for new activation), but this split should be expressed in the normative REQ, not only in the descriptive API Spec section. Note: This ambiguity existed in iteration 1 (the original text was the same) but was not flagged because iteration 1 focus was on REQ-PROG-AI-001's ambiguity. The same class of defect exists here.

---

## Regression Check (Iteration 2)

Defects from iteration 1:

- D1 (REQ-PROG-ACTIVE-010 Unwanted pattern): RESOLVED — spec.md:L155-156 now uses proper Unwanted EARS with "접근하려 할 때 ... 거부하고 403 반환" trigger-response.
- D2 (REQ-PROG-AI-011 Unwanted pattern): UNRESOLVED — spec.md:L215-216 first sentence now conforms but second sentence ("또한 시스템은 ... JWT sub 클레임으로만 수행된다") is a non-Unwanted Ubiquitous-negative clause within the same requirement body. Mixed patterns in one criterion = EARS violation.
- D3 (REQ-PROG-VAL-005 Unwanted pattern): UNRESOLVED — spec.md:L265-266 clause 1 uses Event-Driven trigger ("경로로 요청이 들어왔을 때"), not an undesired condition; clause 2 is Ubiquitous-negative. Label remains `(Unwanted)`. Two different subjects in one body.
- D4 (REQ-PROG-AI-001 response code 201): RESOLVED — spec.md:L161 now reads `201 Created` only.
- D5 (REQ-PROG-AI-012 upstream error codes): RESOLVED — spec.md:L219-222 definitively specifies 502/422/504 per branch.
- D6 (REQ-PROG-VAL-003 NestJS implementation detail): NOT IN MANDATORY REGRESSION LIST — still present at spec.md:L254-256, minor.
- D7 (Traceability matrix PERF-006 gap): NOT IN MANDATORY REGRESSION LIST — still present at spec.md:L821, minor.
- D8 (REQ-PROG-AI-004 Event-Driven reclassification): RESOLVED — spec.md:L169 now labeled `(Event-Driven, 사용량 카운트 정책)`.
- D9 (plan.md usage meta field): NOT IN MANDATORY REGRESSION LIST — not audited in this pass as plan.md is not primary audit target.

---

## Recommendation

Two defects from iteration 1 remain unresolved and block PASS. Both involve MP-2 EARS format compliance.

### Fix D2 — REQ-PROG-AI-011 (spec.md:L215-216)

The second sentence "또한 시스템은 요청 바디나 헤더에 포함된 `userId` 필드를 사용자 식별에 적용해서는 안 되며, 사용자 식별과 권한 검사는 JWT `sub` 클레임과 `role` 클레임으로만 수행된다" must be removed from REQ-PROG-AI-011 and either:

Option A (recommended): Relabel REQ-PROG-AI-011 as two separate requirements:
- REQ-PROG-AI-011 (Unwanted): Retain only the first sentence — the validation failure → 422 / counter-no-increment rule.
- REQ-PROG-AI-013 (Ubiquitous, or relabel as NFR): "시스템은 모든 엔드포인트에서 사용자 식별을 JWT `sub` 클레임으로만 수행해야 하며, 요청 바디나 헤더의 `userId` 필드를 사용자 식별에 사용해서는 안 된다." — This belongs alongside NFR-PROG-SEC-003 (spec.md:L283) which already states the same principle and makes REQ-PROG-AI-011's second sentence redundant.

Option B: Delete the second sentence from REQ-PROG-AI-011 entirely, since NFR-PROG-SEC-003 (spec.md:L283) already covers the JWT-only identification constraint system-wide.

### Fix D3 — REQ-PROG-VAL-005 (spec.md:L265-266)

Two options:

Option A (recommended): Split into two requirements with correct labels:
- REQ-PROG-VAL-005 (Ubiquitous): "시스템은 카탈로그 시드와 AI 생성 프로그램 모두 `Program.isPublic`을 `false`로 저장해야 한다." — This is a pure Ubiquitous constraint matching the label format.
- The routing clause duplicates REQ-PROG-VAL-001 — consider removing it entirely, as REQ-PROG-VAL-001 already covers the routing constraint.

Option B: Relabel REQ-PROG-VAL-005 as `(Ubiquitous)` and rewrite to cover only the isPublic constraint (routing is already covered by REQ-PROG-VAL-001).

### Recommended additional fixes (minor, non-blocking for PASS):

**Fix D-NEW-1 — REQ-PROG-ACTIVE-001 (spec.md:L129):**
Add conditional split to the REQ body: "...기존 활성 프로그램이 있으면 `200 OK`로, 없으면 `201 Created`로 `{ userProgramId, programId, startedAt }`을 반환해야 한다." This mirrors the API Spec section and makes the requirement binary-testable without consulting other sections.

**Fix D6 — REQ-PROG-VAL-003 (spec.md:L254-256):**
Replace NestJS-specific implementation detail with behavioral language: "시스템은 DTO에 정의되지 않은 필드가 포함된 요청에 대해 `400 Bad Request`를 반환해야 한다." Move the NestJS/class-validator specifics to plan.md.

**Fix D7 — Traceability matrix (spec.md:L821):**
Split the entry to: "NFR-PROG-PERF-001~005 | AC-PROG-PERF-01" and "NFR-PROG-PERF-006 | MV-PROG-AI-PERF-01 (수동 검증, staging)" to accurately reflect that PERF-006 has no automated AC.

---

Verdict: FAIL
