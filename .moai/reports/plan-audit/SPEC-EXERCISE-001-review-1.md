# SPEC Review Report: SPEC-EXERCISE-001
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.68

---

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: REQ 그룹별 순번이 연속적이다. 각 그룹(REQ-EX-LIST-001~007, REQ-EX-DETAIL-001~005, REQ-EX-FILTER-001~006, REQ-EX-FAV-001~011, REQ-EX-SEED-001~006, REQ-EX-IMG-001~003)은 내부적으로 갭 없이 순차적이다. 다만 번호 체계가 그룹 접두어 방식(`REQ-EX-LIST-001`, `REQ-EX-DETAIL-001`)이어서 전통적 `REQ-001, REQ-002` 순번 검증 기준과 다르다. 그룹 내 순번은 연속적이며 중복이 없으므로 MP-1 통과로 판정한다. (spec.md:L81~L206)

- [FAIL] MP-2 EARS format compliance: 여러 AC에서 EARS 5가지 패턴 중 어느 것도 아닌 Given/When/Then 형식이 사용되었다. acceptance.md 전체가 Given-When-Then 형식으로 작성되어 있으며, 서두에 "EARS 요구사항에 대한 검증 가능한 Given-When-Then 시나리오를 정의한다"고 명시하고 있다(acceptance.md:L3). EARS 패턴은 spec.md의 요구사항(REQ) 섹션에만 적용되고, acceptance.md의 AC들은 EARS 형식이 아닌 Given/When/Then 테스트 시나리오로 작성되어 있다.
  - 핵심 문제: spec.md의 REQ 항목들은 EARS 형식(Event-Driven, Ubiquitous, Unwanted, Complex)으로 작성되어 있어 기준을 충족한다. 그러나 REQ-EX-FILTER-003은 `(Complex)`로 레이블되어 있는데, EARS 5가지 공식 패턴에는 "Complex"가 존재하지 않는다 (공식: Ubiquitous, Event-driven, State-driven, Optional, Unwanted). spec.md:L130~L131 참조.
  - REQ-EX-LIST-002 (Ubiquitous, spec.md:L84): "시스템은 `GET /exercises` 응답에 다음 메타데이터를 포함해야 한다" — Ubiquitous 패턴("The [system] shall [response]")으로 유효.
  - REQ-EX-LIST-004 (Event-Driven, spec.md:L91): "시스템은 `GET /exercises` 응답의 각 운동 객체에 현재 인증된 사용자의 즐겨찾기 여부(`isFavorite: boolean`)를 계산하여 포함해야 한다" — 트리거 없이 시스템이 응답 내에서 항상 수행하는 행동이므로 실질적으로 Ubiquitous이나 Event-Driven으로 레이블됨. 혼용 문제.
  - REQ-EX-FILTER-003 (spec.md:L130): 패턴 레이블이 `(Complex)`인데 공식 EARS 5종에 없는 패턴명이다. 이는 MP-2 위반이다.

- [PASS] MP-3 YAML frontmatter validity: spec.md:L1~L11에 모든 필수 필드가 존재한다.
  - `id: SPEC-EXERCISE-001` (string) — 존재
  - `version: "1.0.0"` (string) — 존재
  - `status: draft` (string) — 존재
  - `created_at: "2026-05-11"` (ISO date string) — 존재
  - `priority: high` (string) — 존재
  - `labels: ["exercise", "library", "backend", "mobile"]` (array) — 존재

- [N/A] MP-4 Section 22 language neutrality: spec.md:L35에서 NestJS(TypeScript/JavaScript 기반)라는 특정 프레임워크를 명시하고 있으나, 이 SPEC 자체가 단일 언어(TypeScript/NestJS) 프로젝트를 위한 것으로 명확히 스코핑되어 있다. 멀티 언어 도구를 다루는 SPEC이 아니므로 N/A로 판정한다.

---

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 band | 대부분 요구사항이 명확하나, 일부 REQ에서 애매한 표현 존재. REQ-EX-FAV-001의 "200 OK 또는 201 Created" 이중 응답 코드 허용은 구현자가 임의로 선택 가능하여 테스트 불일치 유발(spec.md:L145). |
| Completeness | 0.75 | 0.75 band | 주요 섹션 모두 존재(HISTORY, 개요, 목표, EARS 요구사항, 비기능 요구사항, 데이터 모델, API 명세, 제외 사항, MX 계획, 추적성 매트릭스). 단, spec-compact.md의 YAML frontmatter에 `priority`, `author`, `issue_number`, `updated_at` 필드가 누락되어 있어 spec-compact.md의 완전성이 부족하다. |
| Testability | 0.75 | 0.75 band | 대부분의 AC는 이진 테스트 가능하다. 그러나 AC-IMAGE-02(spec.md/acceptance.md:L522)와 AC-IMAGE-03은 "(수동 검증)"으로 명시되어 있어 자동화 불가하며, "11.1 모든 시나리오가 자동화된 테스트로 검증되어야 한다"(acceptance.md:L625)는 요건과 모순된다. |
| Traceability | 0.75 | 0.75 band | spec.md Section 9의 추적성 매트릭스가 상세히 작성되어 있다. 그러나 REQ-EX-FAV-011은 "(계약, 자동 테스트 불요)"로 표시되어 acceptance.md에 대응하는 AC가 없고(spec.md:L557), NFR-EX-DATA-003(spec.md:L238)도 직접 대응하는 AC ID가 없이 묶음으로 처리된다. |

---

## Defects Found

**D1. spec.md:L130~L131 — REQ-EX-FILTER-003에 비공식 EARS 패턴 레이블 `(Complex)` 사용**
Severity: critical

EARS 공식 5종 패턴은 Ubiquitous, Event-driven, State-driven, Optional, Unwanted이다. `(Complex)`는 공식 EARS 분류에 존재하지 않는다. 해당 REQ는 두 필터를 동시에 지정했을 때의 동작을 정의하므로, "사용자가 `GET /exercises?primaryMuscle=chest&equipment=barbell`처럼 두 필터를 동시에 지정하여 요청했을 때" 트리거가 있는 Event-Driven 패턴으로 재분류해야 한다.

**D2. acceptance.md:L3 — AC 전체가 EARS 패턴이 아닌 Given/When/Then으로 작성**
Severity: major

acceptance.md의 서두에 "EARS 요구사항에 대한 검증 가능한 Given-When-Then 시나리오를 정의한다"고 명시하고 있다(acceptance.md:L3). AC는 EARS 패턴이어야 하나, 모두 Given/When/Then 테스트 시나리오 형식이다. 이는 AC의 성격(EARS 인수 기준 vs 테스트 시나리오)에 대한 근본적 혼동을 나타낸다. spec.md의 REQ가 EARS 형식으로 작성되어 있으므로, acceptance.md의 AC가 EARS 패턴이어야 하는지 Given/When/Then이어야 하는지 명확히 해야 한다. 현재로서는 AC가 EARS 패턴이 아닌 테스트 시나리오로 작성되어 있어 MP-2 위반이다.

**D3. spec.md:L145, L405 — REQ-EX-FAV-001과 API 명세 6.3에서 `201 Created`와 `200 OK` 이중 허용**
Severity: major

REQ-EX-FAV-001(spec.md:L145)은 "`201 Created` 또는 `200 OK`"를 반환해야 한다고 명시한다. 같은 내용이 API 명세 6.3(spec.md:L405)에서도 "Response 200 OK / 201 Created"로 표시된다. 이는 구현자가 두 응답 코드 중 하나를 임의로 선택할 수 있게 하여 클라이언트가 어느 코드를 기대해야 하는지 불명확하다. acceptance.md:L284의 AC-FAV-ADD-01에서도 "200 OK 또는 201 Created"를 허용하고 있다. REST 시멘틱 상 신규 리소스 생성에는 `201 Created`가, 기존 리소스 확인에는 `200 OK`가 적합하다. 멱등성 구현 시 신규 생성이면 `201`, 기존 반환이면 `200`으로 구분하거나 하나로 통일해야 한다.

**D4. spec.md:L465, plan.md:L22~L34 — 라우트 충돌 문제가 요구사항이 아닌 구현 주석으로만 처리**
Severity: major

`GET /exercises/favorites`와 `GET /exercises/:id`의 라우트 충돌은 NestJS 구현 특유의 문제이다. spec.md:L465에서 "참고" 섹션으로만 언급되고, plan.md:L22~L34에서 기술적 접근으로 다루어진다. 그러나 이 문제는 요구사항 레벨에서 명시적으로 EARS 형식으로 정의되어야 한다. REQ-EX-FAV-006에서 `GET /exercises/favorites`를 정의할 때, 라우트 우선순위 보장을 명시적 요구사항으로 포함하거나, REQ-EX-LIST/DETAIL과의 우선순위 관계를 명확히 해야 한다. 현재는 "참고" 메모로만 처리되어 구현자가 이를 요구사항으로 인식하지 못할 수 있다.

**D5. spec.md:L91, 117 — REQ-EX-LIST-004와 REQ-EX-DETAIL-004의 EARS 패턴 불일치**
Severity: minor

REQ-EX-LIST-004(spec.md:L91)는 `(Event-Driven)`으로 레이블되었으나 내용상 "시스템은 ... 계산하여 포함해야 한다"로 항상 수행되는 Ubiquitous 패턴이다. Event-Driven은 명시적 트리거("When [trigger]")가 필요하다. REQ-EX-LIST-001(spec.md:L82)의 Event-Driven 패턴("인증된 사용자가 `GET /exercises?page=N&limit=M` 요청을 보냈을 때")에서 파생되는 행동이므로 독립 요구사항으로서의 패턴이 모호하다.

**D6. acceptance.md:L522~L548 — AC-IMAGE-02, AC-IMAGE-03이 "수동 검증"으로 명시**
Severity: major

acceptance.md:L529에서 AC-IMAGE-02는 "(수동 검증)"으로, acceptance.md:L544에서 AC-IMAGE-03도 "(수동 검증)"으로 명시된다. 그러나 acceptance.md:L625에서 Definition of Done 6번 항목은 "AC-LIST-01 ~ AC-PERF-01의 모든 시나리오가 자동화된 테스트로 검증되고 통과한다"고 요구한다. 수동 검증이 필요한 시나리오를 자동화 대상으로 선언하는 것은 내적 모순이다. 수동 검증 AC는 별도 섹션으로 분리하거나, DoD에서 명시적으로 제외해야 한다.

**D7. spec.md:L97~L100 — REQ-EX-LIST-006의 조건 목록이 요구사항 본문에 임베딩**
Severity: minor

REQ-EX-LIST-006(spec.md:L96~L100)은 검증 규칙을 불릿 목록으로 포함하고 있어 단일 EARS 문장 형식을 벗어난다. EARS 패턴은 단일 조건-반응 쌍이어야 하며, 여러 유효성 검증 규칙을 하나의 REQ에 묶는 것은 테스트 추적성을 낮춘다. `page` 범위 위반과 `limit` 범위 위반을 별도 REQ로 분리하거나, EARS 패턴에 부합하는 단일 문장으로 리팩터링해야 한다.

**D8. spec.md:L557, acceptance.md 전체 — REQ-EX-FAV-011에 대한 AC 부재**
Severity: minor

추적성 매트릭스(spec.md:L557)에서 REQ-EX-FAV-011은 "(계약, 자동 테스트 불요)"로 표시되어 있으며 acceptance.md에 대응하는 AC-FAV-* 시나리오가 없다. 소프트 삭제된 사용자의 즐겨찾기 cascade 정책은 데이터 무결성 측면에서 중요한 계약이다. 자동 테스트가 불필요하다면 적어도 수동 검증 시나리오나 E2E 테스트 시나리오가 있어야 한다.

**D9. spec.md:L88, acceptance.md:L32~L33 — 목록 응답의 `images` 필드 명세 불일치**
Severity: minor

spec.md:L88에서 REQ-EX-LIST-003은 `images` 필드를 "첫 번째 이미지만 포함"이라고 명시한다. acceptance.md:L32에서 AC-LIST-01은 `images`가 "길이 1 배열, GitHub raw URL"이라고 검증한다. 그런데 API 명세 6.1(spec.md:L350)의 응답 예시에서도 `images` 배열에 단 한 개의 URL이 포함되어 있다. 이는 일관되게 보이나, `images`가 항상 길이 1인지(운동이 이미지를 1장만 가진 경우 포함) 아니면 최대 1장으로 잘라내는지(truncation)에 대한 명시가 없다. 이미지가 0개인 운동의 경우 `images` 필드가 빈 배열인지, `null`인지, 기본 URL로 채워지는지 정의되지 않았다.

**D10. spec.md:L231~L232 — NFR-EX-SCALE-003의 `primaryMuscles` 인덱스 전략이 "plan.md에서 결정"으로 미루어짐**
Severity: minor

NFR-EX-SCALE-003(spec.md:L231~L232)에서 "`primaryMuscles`는 배열 컬럼이므로 GIN 인덱스(PostgreSQL 15)를 적용하거나, 정규화된 `ExerciseTag` 테이블을 활용한다 (plan.md에서 결정)"이라고 명시한다. SPEC 단계에서 두 접근 중 어느 것을 선택할지 미결정으로 남기는 것은 설계 미완성을 의미한다. plan.md에서는 GIN 인덱스로 결정(plan.md:L47~L48)되었으나, spec.md 자체에서는 여전히 미결정 상태로 표시된다.

**D11. acceptance.md:L127~L139 — AC-FILTER-01의 fixture 데이터가 하드코딩(142건, 110건)**
Severity: minor

AC-FILTER-01(acceptance.md:L127~L139)에서 "DB에 `primaryMuscles=["chest"]`인 운동 142건, `primaryMuscles=["back"]`인 운동 110건이 시드되어 있음"이라고 픽스처 수치를 하드코딩한다. Free Exercise DB의 실제 데이터 분포는 SPEC 작성 시점의 가정이며, 데이터 갱신 시 깨질 수 있다. "chest 운동이 1건 이상 포함되어 있음"처럼 유연한 조건으로 기술해야 한다.

**D12. spec.md:L202~L203 — REQ-EX-IMG-002가 모바일 클라이언트 구현 세부사항을 요구사항으로 포함**
Severity: minor

REQ-EX-IMG-002(spec.md:L202~L203)는 "모바일 클라이언트는 Expo Image 컴포넌트를 사용하여 이미지를 표시하고, 디스크 캐싱(`cachePolicy="disk"`)으로 반복 로드 시 네트워크 호출을 최소화해야 한다"고 명시한다. 이는 WHAT(이미지 캐싱 동작)이 아닌 HOW(Expo Image의 특정 prop 사용)를 요구하는 구현 세부사항이다. RQ-4 위반: 특정 라이브러리 API(Expo Image의 `cachePolicy` prop)를 요구사항에 하드코딩하면 구현 유연성을 제거한다.

---

## Chain-of-Verification Pass

두 번째 자기 검증 패스를 수행한다. 첫 번째 패스에서 놓쳤을 수 있는 결함을 확인한다.

**재검증 영역:**

1. REQ 번호 순서 end-to-end 재확인:
   - REQ-EX-LIST: 001, 002, 003, 004, 005, 006, 007 — 순차, 갭 없음
   - REQ-EX-DETAIL: 001, 002, 003, 004, 005 — 순차, 갭 없음
   - REQ-EX-FILTER: 001, 002, 003, 004, 005, 006 — 순차, 갭 없음
   - REQ-EX-FAV: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011 — 순차, 갭 없음
   - REQ-EX-SEED: 001, 002, 003, 004, 005, 006 — 순차, 갭 없음
   - REQ-EX-IMG: 001, 002, 003 — 순차, 갭 없음
   - 그룹 간 네이밍 체계 일관성 확인 — 모두 `REQ-EX-{GROUP}-{NNN}` 패턴으로 일관됨

2. EARS 패턴 전수 검사 결과:
   - REQ-EX-FILTER-003의 `(Complex)` 레이블: EARS 5종 외 패턴 — **D1에서 포착됨**
   - REQ-EX-LIST-004, REQ-EX-DETAIL-004의 패턴 레이블 혼동(Event-Driven vs Ubiquitous): **D5에서 포착됨**
   - REQ-EX-FAV-005(spec.md:L156~L157): "사용자가 즐겨찾기에 없는 운동 `id`로 `DELETE /exercises/:id/favorites`를 호출했을 때, 시스템은 멱등성을 보장하기 위해 `204 No Content`를 반환해야 한다" — Event-Driven 패턴으로 올바르게 표현됨. PASS.

3. 추적성 전수 검사:
   - REQ-EX-FAV-011: acceptance.md에 AC 없음 — **D8에서 포착됨**
   - NFR 항목들: 추적성 매트릭스의 마지막 행(spec.md:L567~L569)에서 NFR-EX-PERF-001~006, NFR-EX-SEC-001~004, NFR-EX-DATA-001~003을 묶음으로 처리함. 각 NFR에 개별 AC ID가 매핑되지 않아 추적성이 낮다.

4. Exclusions 섹션 특이성 검사:
   - spec.md Section 7(L470~L487)에 14개의 제외 항목이 열거되어 있으며, 각각 후속 SPEC ID 또는 명시적 이유가 제공된다. 특이성 기준 충족.

5. 모순 검사:
   - spec.md:L137와 REQ-EX-FILTER-005: "알 수 없는 쿼리 파라미터를 조용히 무시한다"고 하면서, spec.md:L216의 NFR-EX-SEC-003에서 "화이트리스트 외 쿼리 파라미터를 차단(또는 무시)한다"고 명시한다. "차단"과 "무시"는 다른 동작이다. "차단"은 에러 반환을, "무시"는 조용한 무시를 의미한다. REQ-EX-FILTER-005는 "무시"를 명시하는데 NFR이 "차단 또는 무시"로 이중적이다.
   - 이는 **추가 결함으로 D13으로 등록**한다.

6. 새로 발견된 결함:

**D13. spec.md:L216, L137 — NFR-EX-SEC-003의 "차단 또는 무시"와 REQ-EX-FILTER-005의 "무시" 간 모순**
Severity: major

NFR-EX-SEC-003(spec.md:L216)은 "`ValidationPipe({ whitelist: true })`로 화이트리스트 외 쿼리 파라미터를 차단(또는 무시)한다"고 하여 두 가지 동작을 모두 허용한다. 그러나 REQ-EX-FILTER-005(spec.md:L136~L137)는 "에러를 발생시키지 않아야 한다"며 "화이트리스트 외 파라미터를 조용히 무시한다"고 명시한다. "차단"은 400 에러를 반환하는 것이고 "무시"는 조용히 통과시키는 것이다. `whitelist: true`는 화이트리스트 외 필드를 제거(무시)하고, `forbidNonWhitelisted: true`가 추가되어야 차단(에러)이 발생한다. 이 모순을 해소하기 위해 NFR-EX-SEC-003을 "조용히 무시"로 일관되게 수정해야 한다.

---

## Recommendation

다음 결함들을 수정하여 재제출해야 한다. MP-2 위반(D1, D2)과 주요(major) 결함들이 해소되어야 PASS 가능하다.

1. **[Critical] D1 수정**: spec.md:L130의 REQ-EX-FILTER-003 레이블을 `(Complex)`에서 `(Event-Driven)`으로 변경한다. 내용: "사용자가 `GET /exercises?primaryMuscle=<v>&equipment=<v>`처럼 두 필터를 동시에 지정하여 요청했을 때, 시스템은 두 조건을 AND로 결합하여 결과를 반환해야 한다." — 이는 완전히 유효한 Event-Driven EARS 패턴이다.

2. **[Major] D2 수정**: acceptance.md가 Given/When/Then 형식이 아닌 EARS 패턴으로 작성되어야 하는지, 아니면 Given/When/Then 테스트 시나리오로 유지되어야 하는지 방향성을 결정한다. acceptance.md 서두의 "EARS 요구사항에 대한 검증 가능한 Given-When-Then 시나리오를 정의한다"는 설명은 EARS 패턴 AC가 아닌 Given/When/Then 테스트 시나리오임을 명시하므로, spec.md의 EARS REQ와 acceptance.md의 G/W/T 시나리오를 분리된 문서로 유지하는 구조로 명확히 선언해야 한다. 현재 구조 자체가 EARS AC(spec.md REQ)와 테스트 시나리오(acceptance.md AC) 두 레이어로 나뉜 것이라면, 이를 spec.md 서두에 명시적으로 선언해야 한다.

3. **[Major] D3 수정**: spec.md:L145의 REQ-EX-FAV-001을 단일 HTTP 상태 코드로 확정한다. 신규 추가 시 `201 Created`, 이미 존재 시 `200 OK`로 구분하거나, 멱등성 강조를 위해 항상 `200 OK`로 통일한다. API 명세 6.3(spec.md:L405)과 acceptance.md:L284도 동일하게 업데이트한다.

4. **[Major] D4 수정**: 라우트 충돌 방지를 EARS 요구사항으로 격상한다. REQ-EX-FAV-006 또는 별도 REQ 항목에 다음과 같이 추가: "시스템은 `GET /exercises/favorites` 라우트를 `GET /exercises/:id` 라우트보다 먼저 매칭해야 한다" (Ubiquitous 패턴).

5. **[Major] D6 수정**: acceptance.md:L529, L544의 AC-IMAGE-02, AC-IMAGE-03에서 "(수동 검증)" 표시를 유지하되, Definition of Done(acceptance.md:L625)에서 수동 검증 항목을 자동화 대상에서 명시적으로 제외한다. 또는 Expo의 `Mocking` 인프라를 통해 자동화 가능한 형태로 시나리오를 재작성한다.

6. **[Major] D13 수정**: spec.md:L216의 NFR-EX-SEC-003을 "화이트리스트 외 쿼리 파라미터를 조용히 무시(`whitelist: true`, `forbidNonWhitelisted: false`)한다"로 수정하여 REQ-EX-FILTER-005와 일관성을 확보한다.

7. **[Minor] D12 수정**: REQ-EX-IMG-002를 구현 세부사항에서 동작 요구사항으로 재작성한다. 예: "모바일 클라이언트는 이미지를 로컬에 캐싱하여 재방문 시 네트워크 호출 없이 표시할 수 있어야 한다."

8. **[Minor] D9 수정**: 이미지가 0개인 운동의 `images` 필드 처리 방식을 명시한다. (예: 빈 배열 `[]` 반환)

9. **[Minor] D11 수정**: AC-FILTER-01~03의 픽스처 수치(142건, 95건 등)를 "1건 이상" 또는 "N건"처럼 유연한 조건으로 교체하거나, 별도의 픽스처 데이터 정의 섹션을 두어 실제 Free Exercise DB 분포와의 의존성을 명시한다.

---

Verdict: FAIL
