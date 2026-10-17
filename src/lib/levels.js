import fs from 'node:fs/promises';
import path from 'node:path';

export function xpForLevel(level) {
  return Math.max(0, Math.trunc(level)) ** 2 * 100;
}

export function levelFromXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

export function levelProgress(xp) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  return {
    level,
    current: xp - floor,
    needed: ceiling - floor,
    totalXp: xp
  };
}

export class LevelStore {
  constructor(filePath, { cooldownMs = 60_000, random = Math.random } = {}) {
    this.filePath = filePath;
    this.cooldownMs = cooldownMs;
    this.random = random;
    this.guilds = {};
    this.cooldowns = new Map();
    this.writeQueue = Promise.resolve();
  }

  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.guilds = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.guilds = {};
    }
  }

  get(guildId, userId) {
    const stored = this.guilds[guildId]?.[userId];
    return stored ? { ...stored } : { xp: 0, messages: 0 };
  }

  top(guildId, limit = 10) {
    return Object.entries(this.guilds[guildId] ?? {})
      .map(([userId, stats]) => ({ userId, ...stats, level: levelFromXp(stats.xp) }))
      .sort((left, right) => right.xp - left.xp)
      .slice(0, limit);
  }

  async award(guildId, userId, now = Date.now()) {
    const key = `${guildId}:${userId}`;
    if ((this.cooldowns.get(key) ?? 0) > now) return null;
    this.cooldowns.set(key, now + this.cooldownMs);

    this.guilds[guildId] ??= {};
    const stats = this.guilds[guildId][userId] ?? { xp: 0, messages: 0 };
    const previousLevel = levelFromXp(stats.xp);
    const gained = 8 + Math.floor(this.random() * 8);
    const updated = { xp: stats.xp + gained, messages: stats.messages + 1 };
    this.guilds[guildId][userId] = updated;
    const level = levelFromXp(updated.xp);
    await this.save();

    return { gained, level, leveledUp: level > previousLevel, ...updated };
  }

  async addXp(guildId, userId, amount) {
    this.guilds[guildId] ??= {};
    const stats = this.guilds[guildId][userId] ?? { xp: 0, messages: 0 };
    const previousLevel = levelFromXp(stats.xp);
    const gained = Math.max(0, Math.round(amount));
    const updated = { ...stats, xp: stats.xp + gained };
    this.guilds[guildId][userId] = updated;
    const level = levelFromXp(updated.xp);
    await this.save();
    return { gained, level, leveledUp: level > previousLevel, ...updated };
  }

  save() {
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(this.guilds, null, 2)}\n`, 'utf8');
      await fs.rename(temporaryPath, this.filePath);
    });
    return this.writeQueue;
  }
}
