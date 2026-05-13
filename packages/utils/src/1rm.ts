// @MX:ANCHOR: [AUTO] 1RM 추정 공식 (Epley/Brzycki/Average) - 백엔드와 모바일 공유
// @MX:REASON: SPEC-1RM-001 REQ-ORM-CALC-005, NFR-ORM-CONSISTENCY-001 - 백엔드/모바일 양쪽에서 호출되는 단일 진실 공급원

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Epley 공식: weight * (1 + reps / 30)
// 반환값은 소수점 2자리로 반올림된 값
export function calculateEpley(weight: number, reps: number): number {
  const raw = weight * (1 + reps / 30);
  return round2(raw);
}

// @MX:WARN: [AUTO] reps >= 37 일 경우 분모가 0이 되어 Infinity 반환
// @MX:REASON: 호출자는 reps <= 10 (REQ-ORM-VAL-004) 범위 내에서만 호출해야 함
// Brzycki 공식: weight * (36 / (37 - reps))
// 반환값은 소수점 2자리로 반올림된 값
export function calculateBrzycki(weight: number, reps: number): number {
  const raw = weight * (36 / (37 - reps));
  return round2(raw);
}

// Average 공식: 반올림 전 Epley/Brzycki raw 값의 산술 평균을 반올림
// REQ-ORM-CALC-002: average = round2((epley_raw + brzycki_raw) / 2)
// NOT round2((round2(epley) + round2(brzycki)) / 2)
export function calculateAverage1RM(weight: number, reps: number): number {
  const epleyRaw = weight * (1 + reps / 30);
  const brzyckiRaw = weight * (36 / (37 - reps));
  const averageRaw = (epleyRaw + brzyckiRaw) / 2;
  return round2(averageRaw);
}
