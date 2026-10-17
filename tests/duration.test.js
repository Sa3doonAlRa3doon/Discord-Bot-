import { describe, expect, it } from 'vitest';
import { humanizeDuration, parseDuration } from '../src/lib/duration.js';

describe('duration parser', () => {
  it.each([
    ['10m', 600_000],
    ['2 hours', 7_200_000],
    ['1.5d', 129_600_000],
    ['1 week', 604_800_000]
  ])('parses %s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it('rejects unclear or unsafe durations', () => {
    expect(parseDuration('tomorrow')).toBeNull();
    expect(parseDuration('2ms')).toBeNull();
    expect(parseDuration('31d')).toBeNull();
  });

  it('formats friendly durations', () => {
    expect(humanizeDuration(7_200_000)).toBe('2 hours');
  });
});
