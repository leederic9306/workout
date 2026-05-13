import {
  calculateEpley,
  calculateBrzycki,
  calculateAverage1RM,
} from './1rm';

describe('1RM Calculation Utilities', () => {
  describe('calculateEpley', () => {
    it('100kg x 5reps -> 116.67 (반올림 2자리)', () => {
      expect(calculateEpley(100, 5)).toBe(116.67);
    });

    it('reps=1 일 때 weight * (1 + 1/30) ≈ weight * 1.033', () => {
      // 100 * (1 + 1/30) = 103.3333... -> 103.33
      expect(calculateEpley(100, 1)).toBe(103.33);
    });

    it('weight=50, reps=10 -> 50 * (1 + 10/30) = 66.6666... -> 66.67', () => {
      expect(calculateEpley(50, 10)).toBe(66.67);
    });
  });

  describe('calculateBrzycki', () => {
    it('100kg x 5reps -> 112.5', () => {
      // 100 * (36 / (37 - 5)) = 100 * (36/32) = 112.5
      expect(calculateBrzycki(100, 5)).toBe(112.5);
    });

    it('reps=1 일 때 weight * (36/36) = weight', () => {
      expect(calculateBrzycki(100, 1)).toBe(100);
    });

    it('weight=50, reps=10 -> 50 * (36/27) = 66.6666... -> 66.67', () => {
      expect(calculateBrzycki(50, 10)).toBe(66.67);
    });
  });

  describe('calculateAverage1RM', () => {
    it('100kg x 5reps -> 114.58 (반올림 전 평균을 반올림)', () => {
      // epley_raw = 116.6666..., brzycki_raw = 112.5
      // average_raw = (116.6666... + 112.5) / 2 = 114.5833...
      // -> 114.58 (NOT 114.59)
      expect(calculateAverage1RM(100, 5)).toBe(114.58);
    });

    it('반올림된 값의 평균이 아닌 raw 평균을 반올림한다', () => {
      // Verify: average = round((epley_raw + brzycki_raw)/2), NOT (round(epley) + round(brzycki))/2
      const result = calculateAverage1RM(100, 5);
      expect(result).toBe(114.58);
      expect(result).not.toBe(114.59);
    });
  });
});
