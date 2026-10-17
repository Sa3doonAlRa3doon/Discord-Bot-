import { describe, expect, it } from 'vitest';
import { nextCount } from '../src/features/fun-system.js';
import { segmentsToSrt, topPalette } from '../src/features/ai-media.js';
import { solveMath, updateHabitCheck } from '../src/features/productivity.js';
import { cleanText } from '../src/lib/clean-language.js';

describe('v4 productivity helpers', () => {
  it('evaluates and performs calculus', () => {
    expect(solveMath('2 * (3 + 4)')).toBe('14');
    expect(solveMath('x^2 + 2*x', 'derivative', 'x')).toContain('x + 1');
    expect(solveMath('2*x', 'integral', 'x')).toContain('x^2');
  });

  it('continues or resets habit streaks by UTC date', () => {
    expect(updateHabitCheck({ name: 'Read', streak: 4, lastCheck: '2026-10-16' }, '2026-10-17').streak).toBe(5);
    expect(updateHabitCheck({ name: 'Read', streak: 4, lastCheck: '2026-10-10' }, '2026-10-17').streak).toBe(1);
    expect(updateHabitCheck({ name: 'Read', streak: 4, lastCheck: '2026-10-17' }, '2026-10-17').alreadyChecked).toBe(true);
  });
});

describe('v4 game and media helpers', () => {
  it('enforces sequential counting and different users', () => {
    expect(nextCount(4, '4', 'a', 'b').valid).toBe(true);
    expect(nextCount(4, '5', 'a', 'b').count).toBe(0);
    expect(nextCount(4, '4', 'a', 'a').valid).toBe(false);
  });

  it('creates timed SRT output', () => {
    const srt = segmentsToSrt([{ start: 1.25, end: 3.5, text: 'Hello world' }]);
    expect(srt).toContain('00:00:01,250 --> 00:00:03,500');
    expect(srt).toContain('Hello world');
  });

  it('extracts dominant quantized colors', () => {
    const pixels = Uint8ClampedArray.from([255, 0, 0, 255, 252, 1, 1, 255, 250, 2, 2, 255, 250, 0, 0, 255, 0, 0, 255, 255]);
    expect(topPalette(pixels, 2)).toEqual(['#F80808', '#0808F8']);
  });

  it('censors blocked language from providers and generated audio text', () => {
    expect(cleanText('that was damn bad')).toBe('that was •••• bad');
  });
});
