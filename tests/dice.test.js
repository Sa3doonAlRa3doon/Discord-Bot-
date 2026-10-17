import { describe, expect, it } from 'vitest';
import { parseChoices, parseDiceNotation, rollDice } from '../src/lib/dice.js';

describe('dice and choices', () => {
  it('parses standard dice notation', () => {
    expect(parseDiceNotation('2d20+3')).toEqual({ count: 2, sides: 20, modifier: 3 });
    expect(parseDiceNotation('d6')).toEqual({ count: 1, sides: 6, modifier: 0 });
  });

  it('rejects oversized rolls', () => {
    expect(parseDiceNotation('21d6')).toBeNull();
    expect(parseDiceNotation('2d1')).toBeNull();
  });

  it('rolls deterministically when given a test random source', () => {
    expect(rollDice('2d6+1', () => 0.5)).toMatchObject({ rolls: [4, 4], total: 9 });
  });

  it('parses pipe-separated choices', () => {
    expect(parseChoices(' pizza | burgers | noodles ')).toEqual(['pizza', 'burgers', 'noodles']);
    expect(parseChoices('lonely')).toBeNull();
  });
});
