import { DashboardPeriod } from './dto/dashboard-query.dto';

// 기간 enum → 일 단위
const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  [DashboardPeriod.ONE_MONTH]: 30,
  [DashboardPeriod.THREE_MONTHS]: 90,
  [DashboardPeriod.SIX_MONTHS]: 180,
  [DashboardPeriod.ONE_YEAR]: 365,
};

// 기간 시작 시각 (now - days)
export function periodStart(
  period: DashboardPeriod,
  now: Date = new Date(),
): Date {
  const days = PERIOD_DAYS[period];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// UTC 기준 월요일 00:00:00 (date 이 속한 주의 시작)
export function startOfWeekUtcMonday(date: Date): Date {
  const d = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  // getUTCDay: 0=Sunday, 1=Monday, ..., 6=Saturday
  const day = d.getUTCDay();
  // Monday까지의 거리 (Sunday=6, Monday=0, ..., Saturday=5)
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

// 직전 N주의 월요일 시작 시각 배열 (오래된 → 최신)
export function weekStarts(weeks: number, now: Date = new Date()): Date[] {
  const currentWeekStart = startOfWeekUtcMonday(now);
  const list: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const w = new Date(currentWeekStart);
    w.setUTCDate(w.getUTCDate() - i * 7);
    list.push(w);
  }
  return list;
}

// Epley 공식: weight * (1 + reps/30)
export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}
