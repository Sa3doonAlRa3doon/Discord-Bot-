import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LevelStore, levelFromXp, levelProgress, xpForLevel } from '../src/lib/levels.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('level math', () => {
  it('uses predictable quadratic thresholds', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(3)).toBe(900);
  });

  it('finds the level from total XP', () => {
    expect(levelFromXp(99)).toBe(0);
    expect(levelFromXp(100)).toBe(1);
    expect(levelFromXp(899)).toBe(2);
  });

  it('reports progress inside the current level', () => {
    expect(levelProgress(150)).toEqual({ level: 1, current: 50, needed: 300, totalXp: 150 });
  });

  it('persists XP and blocks cooldown farming', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hatclanker-levels-'));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'levels.json');
    const store = new LevelStore(filePath, { cooldownMs: 60_000, random: () => 0 });
    await store.load();

    expect(await store.award('guild', 'user', 1_000)).toMatchObject({ gained: 8, xp: 8, messages: 1 });
    expect(await store.award('guild', 'user', 2_000)).toBeNull();

    const reloaded = new LevelStore(filePath);
    await reloaded.load();
    expect(reloaded.get('guild', 'user')).toEqual({ xp: 8, messages: 1 });
  });

  it('adds voice XP and reports level changes', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hatclanker-voice-levels-'));
    temporaryDirectories.push(directory);
    const store = new LevelStore(path.join(directory, 'levels.json'));
    await store.load();
    expect(await store.addXp('guild', 'user', 100)).toMatchObject({ gained: 100, level: 1, leveledUp: true, xp: 100 });
  });
});
