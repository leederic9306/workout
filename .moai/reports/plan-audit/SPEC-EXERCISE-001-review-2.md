# SPEC Review Report: SPEC-EXERCISE-001
Iteration: 2/3
Verdict: FAIL
Overall Score: 0.82

---

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: REQ 그룹별 순번이 연속적이다. 이번 버전에서는 REQ-EX-FAV-012가 신규 추가되어 REQ-EX-FAV-001~012 전체가 갭 없이 순차적이다. 다른 모든 그룹도 동일하게 확인됨.
  - REQ-EX-LIST: 001~007 (spec.md:L82~L104) — 갭 없음
  - REQ-EX-DETAIL: 001~005 (spec.md:L108~L121) — 갭 없음
  - REQ-EX-FILTER: 001~006 (spec.md:L125~L141) — 갭 없음
  - REQ-EX-FAV: 001~012 (spec.md:L145~L179) — 갭 없음 (012 신규 추가 확인)
  - REQ-EX-SEED: 001~006 (spec.md:L183~L199) — 갭 없음
  - REQ-EX-IMG: 001~003 (spec.md:L203~L211) — 갭 없음

- [PASS] MP-2 EARS format compliance: spec.md의 모든 REQ 항목이 EARS 5종 패턴(Ubiquitous, Event-Driven, State-driven, Optional, Unwanted) 중 하나로 레이블되어 있다. 이전 버전의 `(Complex)` 레이블이 `(Event-Driven)`으로 수정됨(spec.md:L131 참조). acceptance.md는 Given/When/Then 테스트 시나리오 문서로 운영되며, 이번 버전의 acceptance.md:L1에서 "EARS 요구사항에 대한 검증 가능한 Given/When/Then 시나리오를 정의한다"고 명시하여 spec.md(EARS REQ)와 acceptance.md(G/W/T 시나리오)의 분리 구조가 문서 내 공식적으로 선언되어 있다.
  - spec.md:L131 — REQ-EX-FILTER-003: `(Event-Driven)` — 수정 확인

- [PASS] MP-3 YAML frontmatter validity: spec.md:L1~L11에 모든 필수 필드가 존재한다.
  - `id: SPEC-EXERCISE-001` (string) — 존재 (spec.md:L2)
  - `version: "1.0.1"` (string) — 존재 (spec.md:L3)
  - `status: draft` (string) — 존재 (spec.md:L4)
  - `created_at: "2026-05-11"` (ISO date string) — 존재 (spec.md:L5)
  - `priority: high` (string) — 존재 (spec.md:L8)
  - `labels: ["exercise", "library", "backend", "mobile"]` (array) — 존재 (spec.md:L10)

- [N/A] MP-4 Section 22 language neutrality: 본 SPEC은 단일 언어(TypeScript/NestJS) 프로젝트를 명시적으로 스코핑하고 있으므로 N/A.

---

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 band | 대부분의 요구사항이 명확하게 표현되어 있다. REQ-EX-FAV-001(spec.md:L145~L146)에서 201/200 구분이 명확히 서술되었으며, REQ-EX-FAV-012(spec.md:L178~L179)에서 라우트 충돌 방지 요구사항이 EARS Unwanted 패턴으로 명시되었다. 그러나 REQ-EX-FAV-012의 본문이 구현 세부사항("NestJS 컨트롤러에서는 `@Get('favorites')` 메서드를 `@Get(':id')` 메서드보다 위에 정의하여...")을 포함하고 있어 HOW/WHAT 경계를 침범하는 문제가 잔존한다. |
| Completeness | 0.75 | 0.75 band | 모든 주요 섹션이 존재한다(HISTORY, 개요, 목표/비목표, EARS 요구사항, NFR, 데이터 모델, API 명세, 제외 사항, MX 계획, 추적성 매트릭스). acceptance.md에 Section 8a(수동 검증 시나리오)가 신설되어 AC-IMAGE-02/AC-IMAGE-03을 분리했고, DoD에서도 이를 제외 처리했다. spec.md:L220(NFR-EX-SEC-003)이 수정되어 completeness 점수에 기여. |
| Testability | 0.85 | 0.75~1.0 band | acceptance.md의 자동화 대상 AC 전체가 이진 테스트 가능하다. AC-IMAGE-02/AC-IMAGE-03이 Section 8a(수동 검증)로 분리되어 DoD와의 모순이 해소되었다(acceptance.md:L545~L582). DoD Section 12 항목 6(acceptance.md:L686)에서 수동 검증 항목 명시적 제외 확인. AC-FAV-ADD-01(acceptance.md:L286)에서 `201 Created`만 명시하고, AC-FAV-ADD-02(acceptance.md:L306)에서 `200 OK`만 명시하여 이진 테스트 가능. 단, AC-LIST-04(acceptance.md:L70~L80)의 픽스처 수치(`total=850`, `totalPages=43`) 하드코딩이 여전히 잔존한다. |
| Traceability | 0.90 | 0.75~1.0 band | 추적성 매트릭스(spec.md:L533~L578)가 REQ-EX-FAV-012까지 모두 포함하여 업데이트되었다(spec.md:L566). AC-FAV-LIST-04(acceptance.md:L419~L436)가 REQ-EX-FAV-012와 1:1 매핑된다. REQ-EX-FAV-011(spec.md:L565)은 여전히 "(계약, 자동 테스트 불요)"로 표시되나 이는 의도적 정책이다. 모든 REQ에 AC가 존재하고, 고아 AC 없음이 확인된다. |

---

## Regression Check (Iteration 2)

Defects from previous iteration and resolution status:

- **D1**: spec.md:L130~L131 — REQ-EX-FILTER-003 레이블 `(Complex)` 사용
  [RESOLVED]: spec.md:L131에서 `(Event-Driven)`으로 수정 확인. "사용자가 `GET /exercises?primaryMuscle=chest&equipment=barbell`처럼 두 필터를 동시에 지정하여 요청했을 때" 트리거 있는 Event-Driven 패턴으로 올바르게 표현됨.

- **D2**: acceptance.md 전체가 EARS가 아닌 Given/When/Then으로 작성
  [RESOLVED]: acceptance.md:L1(iteration 1에서 L3로 기록)에서 "EARS 요구사항에 대한 검증 가능한 Given/When/Then 시나리오를 정의한다"고 명시하여 acceptance.md는 테스트 시나리오 문서임이 공식 선언되어 있다. spec.md REQ(EARS)와 acceptance.md AC(G/W/T 시나리오)의 분리 구조가 의도적 설계임을 확인. MP-2는 spec.md의 REQ에 적용하며, spec.md의 모든 REQ는 유효한 EARS 패턴을 사용하고 있다.

- **D3**: REQ-EX-FAV-001의 이중 응답 코드 불명확성
  [RESOLVED]: spec.md:L145~L146에서 "신규 레코드를 생성한 경우 `201 Created`, 기존 레코드를 반환한 경우 `200 OK`"로 명확히 구분 서술됨. acceptance.md:L286에서 AC-FAV-ADD-01이 `201 Created`만, acceptance.md:L303에서 AC-FAV-ADD-02가 `200 OK`만 명시하여 테스트 가능한 이진 조건이 확립됨.

- **D4**: 라우트 충돌 문제가 요구사항이 아닌 주석으로만 처리
  [RESOLVED]: spec.md:L178~L179에서 REQ-EX-FAV-012로 Unwanted EARS 패턴 요구사항이 신설됨. acceptance.md:L419~L436에서 AC-FAV-LIST-04로 E2E 검증 시나리오가 추가됨. 추적성 매트릭스(spec.md:L566)에 REQ-EX-FAV-012 → AC-FAV-LIST-04 매핑 확인.

- **D5**: REQ-EX-LIST-004, REQ-EX-DETAIL-004의 EARS 패턴 레이블 불일치
  [UNRESOLVED]: spec.md:L91에서 REQ-EX-LIST-004는 여전히 `(Event-Driven)`으로 레이블되어 있다. 내용은 "시스템은 `GET /exercises` 응답의 모든 운동 객체에 현재 인증된 사용자의 즐겨찾기 여부(`isFavorite: boolean`)를 항상 포함해야 한다" — "항상"이라는 단어와 명시적 트리거 부재는 Ubiquitous 패턴에 해당한다. 이 결함은 minor이고 iteration 1에서도 minor로 분류되었으므로 FAIL 판정에는 영향 없으나 미수정.

- **D6**: AC-IMAGE-02, AC-IMAGE-03이 수동 검증으로 표시되면서 DoD 자동화 요건과 모순
  [RESOLVED]: acceptance.md:L545~L582에서 Section 8a "수동 검증 시나리오(Manual Verification Scenarios)"가 신설되어 AC-IMAGE-02, AC-IMAGE-03이 이 절로 분리됨. acceptance.md:L547에서 "Definition of Done의 자동화 검증 요구(Section 12 항목 6)에서 명시적으로 제외된다"고 선언. DoD(acceptance.md:L686, L690)에서도 수동 검증 항목의 제외가 명확히 기술됨.

- **D7**: REQ-EX-LIST-006의 조건 목록 임베딩
  [UNRESOLVED]: spec.md:L97~L101에서 REQ-EX-LIST-006은 여전히 불릿 목록을 내장하고 있다. Minor 결함으로 분류된 항목이며 iteration 1 권고 사항이었으나 수정되지 않았다.

- **D8**: REQ-EX-FAV-011에 대한 AC 부재
  [UNRESOLVED]: spec.md:L565에서 REQ-EX-FAV-011은 여전히 "(계약, 자동 테스트 불요)"로 표시됨. Minor 결함으로 분류된 항목이며 수정되지 않았다.

- **D9**: 목록 응답의 images 필드 명세 불일치
  [RESOLVED]: spec.md:L89에서 "운동이 0개의 이미지를 가진 경우(`images` 원본 배열이 비어 있는 경우) `images` 필드는 빈 배열 `[]`로 반환되며 `null`이 아니어야 한다"는 명시가 추가됨. acceptance.md:L539에서도 동일한 검증 조건이 포함됨.

- **D10**: NFR-EX-SCALE-003의 인덱스 전략 미결정
  [RESOLVED]: spec.md:L236에서 "PostgreSQL 15의 GIN 인덱스를 raw migration으로 적용한다"고 결정이 확정됨. 이전 "plan.md에서 결정"이라는 미결정 표현이 제거됨.

- **D11**: AC-FILTER-01의 픽스처 수치 하드코딩
  [PARTIALLY RESOLVED]: AC-FILTER-01(acceptance.md:L128~L141)에서 "1건 이상 존재"로 유연하게 수정된 것이 확인됨. 단, AC-LIST-04(acceptance.md:L70~L80)에서 `N = 850`, `total=850`, `totalPages=43`이 여전히 하드코딩되어 있다. D11의 핵심 지적은 FILTER 시나리오였으므로 RESOLVED로 분류하되 AC-LIST-04의 새로운 동일 유형 문제가 잔존함 — 아래 Chain-of-Verification 참조.

- **D12**: REQ-EX-IMG-002의 구현 세부사항
  [UNRESOLVED]: spec.md:L207에서 REQ-EX-IMG-002는 여전히 "Expo Image 컴포넌트를 사용하여 이미지를 표시하고, 디스크 캐싱(`cachePolicy="disk"`)으로..."라고 특정 prop을 명시한다. Minor 결함이며 수정되지 않았다.

- **D13**: NFR-EX-SEC-003과 REQ-EX-FILTER-005 간 "차단 또는 무시" 모순
  [RESOLVED]: spec.md:L220에서 NFR-EX-SEC-003이 "`ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })`로 화이트리스트 외 쿼리 파라미터를 조용히 무시(strip)한다. `whitelist: true`는 알 수 없는 필드를 자동 제거하고, `forbidNonWhitelisted: false`는 알 수 없는 필드 존재 시 400 에러를 발생시키지 않도록 한다 (REQ-EX-FILTER-005와 일관)"으로 수정 확인됨.

---

## Defects Found

**D14. spec.md:L178~L179 — REQ-EX-FAV-012가 구현 세부사항(HOW)을 요구사항 본문에 포함**
Severity: minor

REQ-EX-FAV-012(spec.md:L178~L179)는 EARS Unwanted 패턴으로 라우트 충돌 방지를 선언하는 것은 적절하나, 본문 마지막 문장에서 "NestJS 컨트롤러에서는 `@Get('favorites')` 메서드를 `@Get(':id')` 메서드보다 위(또는 앞)에 정의하여 라우트 등록 순서를 보장해야 한다"고 명시한다. 이는 구체적인 구현 방법(HOW: NestJS 데코레이터 배치 순서)을 요구사항 수준에서 강제한다. RQ-3/RQ-4 위반으로, 구현 세부사항이 아닌 관찰 가능한 동작("시스템은 `GET /exercises/favorites` 경로가 `:id` 파라미터로 오해석되지 않아야 한다")만 요구사항으로 표현해야 한다.

**D15. acceptance.md:L70~L80 — AC-LIST-04에 픽스처 수치 하드코딩 잔존**
Severity: minor

AC-LIST-04(acceptance.md:L70~L80)에서 "시드 후 활성 운동 수 `N = 850`", "total=850", "totalPages=43"이 하드코딩되어 있다. 이는 iteration 1의 D11(AC-FILTER-01 픽스처 수치 하드코딩)에서 지적된 동일 패턴이 다른 AC에도 잔존하는 것이다. Free Exercise DB 데이터 갱신 시 850이라는 수치가 실제 시드 결과와 다르면 테스트가 깨진다. AC-LIST-01(acceptance.md:L29)에서 "total >= 800"으로 유연하게 처리한 패턴을 AC-LIST-04에도 일관 적용해야 한다.

**D16. spec.md:L91 — REQ-EX-LIST-004가 `(Event-Driven)`으로 레이블되었으나 내용은 Ubiquitous**
Severity: minor

(Iteration 1 D5 미수정 재확인) REQ-EX-LIST-004(spec.md:L91)는 "시스템은 `GET /exercises` 응답의 **모든** 운동 객체에 현재 인증된 사용자의 즐겨찾기 여부(`isFavorite: boolean`)를 **항상** 포함해야 한다"고 기술한다. "항상"이라는 부사와 명시적 트리거 부재는 Ubiquitous EARS 패턴("The [system] shall [response]")에 해당한다. 동일 문제가 REQ-EX-DETAIL-004(spec.md:L117)에도 잔존한다.

**D17. spec.md:L97~L101 — REQ-EX-LIST-006에 불릿 목록 임베딩**
Severity: minor

(Iteration 1 D7 미수정 재확인) REQ-EX-LIST-006(spec.md:L97~L101)은 검증 규칙을 불릿 목록으로 포함하고 있어 단일 EARS 조건-반응 쌍 형식을 벗어난다.

**D18. spec.md:L565, acceptance.md 전체 — REQ-EX-FAV-011에 대한 AC 부재**
Severity: minor

(Iteration 1 D8 미수정 재확인) REQ-EX-FAV-011은 "(계약, 자동 테스트 불요)"로 표시되어 있으며 수동 검증 시나리오도 존재하지 않는다. 데이터 무결성 계약 사항임에도 검증 방법이 완전히 누락되어 있다.

**D19. spec.md:L207 — REQ-EX-IMG-002가 특정 라이브러리 prop을 요구사항에 명시**
Severity: minor

(Iteration 1 D12 미수정 재확인) REQ-EX-IMG-002(spec.md:L207)는 여전히 "Expo Image 컴포넌트"와 `cachePolicy="disk"` prop을 구체적으로 명시하고 있다. 이는 WHAT이 아닌 HOW를 요구사항에 강제하는 RQ-4 위반이다.

---

## Chain-of-Verification Pass

두 번째 자기 검증 패스를 수행한다.

**재검증 영역:**

1. REQ 번호 순서 end-to-end 재확인:
   - REQ-EX-FAV: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012 — 순차, 갭 없음. 012 신규 추가 확인.
   - 다른 모든 그룹 순차 확인 완료.

2. EARS 패턴 전수 재검사:
   - REQ-EX-FILTER-003(spec.md:L131): `(Event-Driven)` — 수정 확인. "사용자가 `GET /exercises?primaryMuscle=chest&equipment=barbell`처럼 두 필터를 동시에 지정하여 요청했을 때" 트리거 있는 Event-Driven 패턴 유효.
   - REQ-EX-LIST-004(spec.md:L91): `(Event-Driven)` 레이블이지만 내용은 Ubiquitous — D16으로 등록.
   - REQ-EX-FAV-012(spec.md:L178): `(Unwanted)` 패턴 — "시스템은 ... 하지 않아야 한다" 형식. Unwanted 패턴으로는 유효하나 구현 세부사항 임베딩 문제는 D14로 등록.
   - REQ-EX-FAV-009(spec.md:L169): "(Unwanted)" — "시스템은 다른 사용자의 즐겨찾기 데이터를 조회·수정·삭제할 수 있는 엔드포인트를 노출하지 않아야 한다" — Unwanted 패턴으로 유효.

3. 추적성 전수 재검사:
   - spec.md:L533~L578 추적성 매트릭스 전체 검토: REQ-EX-FAV-012 → AC-FAV-LIST-04 매핑 추가됨(spec.md:L566). 모든 REQ에 AC 매핑 존재.
   - NFR 항목들: 여전히 묶음 처리(spec.md:L576~L578). Major 이슈는 아님.

4. Exclusions 섹션 특이성 검사:
   - spec.md Section 7(L478~L494): 14개 항목이 각각 후속 SPEC ID 또는 명시적 이유와 함께 열거됨. 특이성 기준 충족.

5. 모순 검사:
   - NFR-EX-SEC-003(spec.md:L220)과 REQ-EX-FILTER-005(spec.md:L137~L138) 일관성 확인: 수정으로 일관됨. RESOLVED.
   - AC-LIST-04(acceptance.md:L70~L80)의 픽스처 수치 하드코딩 발견 — D15로 등록.

6. REQ-EX-FAV-001 응답 코드 구분 검증:
   - spec.md:L145~L146: "신규 레코드를 생성한 경우 `201 Created`, 기존 레코드를 반환한 경우 `200 OK`"로 명확히 구분됨.
   - acceptance.md:L286: AC-FAV-ADD-01에서 `201 Created`만 명시.
   - acceptance.md:L303/306: AC-FAV-ADD-02에서 `200 OK`만 명시하며 "어떤 경우에도 `201 Created`가 반환되지 않음" 추가 확인. RESOLVED.

7. Section 8a 수동 검증 분리 검증:
   - acceptance.md:L545~L582: Section 8a에 AC-IMAGE-02(L549~L564), AC-IMAGE-03(L565~L582)이 분리됨.
   - acceptance.md:L547: "Definition of Done의 자동화 검증 요구(Section 12 항목 6)에서 명시적으로 제외된다" 명시 확인.
   - acceptance.md:L686: DoD 항목 6에서 수동 검증 AC 명시 제외 확인. RESOLVED.

8. 새로 발견된 결함: D14~D19 (D15가 새로 발견된 실질 결함, D16~D19는 이전 미수정 minor 결함).

**결론**: 5개의 critical/major 결함(D1, D3, D4, D6, D13)이 모두 RESOLVED되었다. 남은 결함은 D14(minor), D15(minor), D16/D17/D18/D19(minor, 이전 minor 결함 미수정)이다. MP 위반은 없으며 전체적으로 품질이 크게 개선되었으나, minor 결함들이 다수 잔존한다.

---

## Recommendation

Critical/major 결함이 모두 해소되어 PASS에 근접했으나, 다음 minor 결함들이 잔존한다. 이 결함들 중 D14는 요구사항 품질에 직접 영향을 주므로 수정을 권고한다.

1. **[Minor] D14 수정 권고**: spec.md:L179의 REQ-EX-FAV-012에서 NestJS 구현 세부사항을 제거한다. "NestJS 컨트롤러에서는 `@Get('favorites')` 메서드를 `@Get(':id')` 메서드보다 위에 정의하여..." 문장을 삭제하거나, 별도 구현 노트(예: Section 8 mx_plan) 또는 API 명세 섹션으로 이동한다. 요구사항 본문에는 관찰 가능한 동작만 남긴다.

2. **[Minor] D15 수정 권고**: acceptance.md:L70의 AC-LIST-04에서 `N = 850`, `total=850`, `totalPages=43`을 "N >= 800", "total >= 800", "totalPages = ceil(total / 20)" 형태로 수정하여 데이터 갱신에 강건하게 만든다.

3. **[Minor] D16 수정 권고**: spec.md:L91의 REQ-EX-LIST-004 레이블을 `(Event-Driven)`에서 `(Ubiquitous)`로 수정한다. 동일하게 spec.md:L117의 REQ-EX-DETAIL-004도 `(Ubiquitous)`로 수정한다.

4. **[Minor] D17 수정 권고**: spec.md:L97~L101의 REQ-EX-LIST-006을 단일 EARS 문장으로 리팩터링하거나, 검증 규칙을 두 개의 별도 REQ로 분리한다.

5. **[Minor] D18 수정 권고**: REQ-EX-FAV-011에 대한 수동 검증 시나리오를 Section 8a에 추가하거나, 추적성 매트릭스에서 명시적으로 "검증 불요 계약(외래키 cascade 정책, DB 스키마 레벨 검증)"임을 선언한다.

6. **[Minor] D19 수정 권고**: spec.md:L207의 REQ-EX-IMG-002를 구현 독립적으로 재작성한다. 예: "모바일 클라이언트는 동일한 이미지 URL에 대한 반복 요청 시 이전에 캐싱된 결과를 사용하여 네트워크 호출을 발생시키지 않아야 한다."

---

Verdict: FAIL
