import { describe, expect, it } from 'vitest';
import { commandDefinitions } from '../src/commands.js';

describe('Discord command schema', () => {
  it('stays within Discord limits with unique names', () => {
    const names = commandDefinitions.map((command) => command.name);
    expect(commandDefinitions.length).toBeLessThanOrEqual(100);
    expect(new Set(names).size).toBe(names.length);
    expect(commandDefinitions.every((command) => command.description.length <= 100)).toBe(true);
  });

  it('contains the requested feature groups', () => {
    const names = new Set(commandDefinitions.map((command) => command.name));
    for (const name of ['moderate', 'security', 'panel', 'music', 'economy', 'ticket', 'event', 'giveaway', 'apply', 'tournament', 'ai', 'ai-status', 'ai-reset', 'translate', 'backup', 'pomodoro', 'flashcard', 'habit', 'math', 'weather', 'pet', 'purge-filter', 'dm-broadcast', 'self-destruct']) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('does not expose private Google tools through Discord', () => {
    const names = new Set(commandDefinitions.map((command) => command.name));
    expect(names.has('google')).toBe(false);
  });

  it('includes the expanded game modes', () => {
    const game = commandDefinitions.find((command) => command.name === 'game');
    const names = new Set(game.options.map((option) => option.name));
    for (const name of ['hangman', 'guess', 'rps', 'trivia', 'number-start', 'number-guess', 'scramble', 'solve', 'slots']) {
      expect(names.has(name)).toBe(true);
    }
  });
});
