import { describe, expect, it } from 'vitest';
import { formatTime } from './format';

describe('formatTime', () => {
  it('форматирует секунды как в плеере', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(72)).toBe('1:12');
    expect(formatTime(605)).toBe('10:05');
  });

  it('не показывает мусор, пока длительность неизвестна', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
