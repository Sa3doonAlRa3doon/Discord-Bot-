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
    for (const name of ['moderate', 'security', 'panel', 'music', 'economy', 'ticket', 'event', 'giveaway', 'apply', 'tournament', 'ai', 'translate', 'backup', 'pomodoro', 'flashcard', 'habit', 'math', 'weather', 'pet', 'purge-filter', 'dm-broadcast', 'self-destruct']) {
      expect(names.has(name)).toBe(true);
    }
  });
});
