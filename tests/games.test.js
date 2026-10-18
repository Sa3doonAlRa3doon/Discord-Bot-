import { describe, expect, it } from 'vitest';
import { drawSlots, rpsOutcome, scrambleWord, slotOutcome } from '../src/features/community.js';

describe('expanded mini-games', () => {
  it('scores every rock-paper-scissors outcome', () => {
    expect(rpsOutcome('rock', 'scissors')).toBe('win');
    expect(rpsOutcome('paper', 'scissors')).toBe('lose');
    expect(rpsOutcome('rock', 'rock')).toBe('draw');
  });

  it('scrambles without losing letters', () => {
    const source = 'raspberry';
    const scrambled = scrambleWord(source, () => 0);
    expect(scrambled).not.toBe(source);
    expect([...scrambled].sort()).toEqual([...source].sort());
  });

  it('classifies slot spins', () => {
    expect(slotOutcome(['A', 'A', 'A'])).toBe('jackpot');
    expect(slotOutcome(['A', 'B', 'A'])).toBe('pair');
    expect(slotOutcome(['A', 'B', 'C'])).toBe('miss');
    expect(drawSlots(() => 0)).toHaveLength(3);
  });
});
