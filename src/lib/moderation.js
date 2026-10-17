import fs from 'node:fs';
import path from 'node:path';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { JsonStore } from './json-store.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function capsPercent(content) {
  const letters = content.match(/[a-z]/gi) ?? [];
  if (letters.length === 0) return 0;
  const capitals = letters.filter((letter) => letter === letter.toUpperCase()).length;
  return Math.round((capitals / letters.length) * 100);
}

export function extractDomains(content) {
  const matches = String(content).matchAll(/https?:\/\/([^/\s]+)/gi);
  return [...matches].map((match) => match[1].toLowerCase().replace(/^www\./, ''));
}

export function scanContent(content, security) {
  const normalized = String(content).toLowerCase();
  const bannedWord = (security.bannedWords ?? [])
    .filter((word) => word && !word.startsWith('replace-this'))
    .find((word) => new RegExp(`(?:^|\\W)${escapeRegex(word.toLowerCase())}(?:$|\\W)`, 'i').test(normalized));
  if (bannedWord) return { type: 'banned-word', detail: bannedWord };

  const blockedPhrase = (security.blockedPhrases ?? []).find((phrase) => normalized.includes(phrase.toLowerCase()));
  if (blockedPhrase) return { type: 'scam-phrase', detail: blockedPhrase };

  const blockedDomain = extractDomains(content).find((domain) =>
    (security.blockedDomains ?? []).some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))
  );
  if (blockedDomain) return { type: 'blocked-domain', detail: blockedDomain };

  const suspiciousBrandDomain = extractDomains(content).find((domain) =>
    ((domain.includes('discord') || domain.includes('nitro')) && !['discord.com', 'discord.gg', 'discordapp.com'].some((trusted) => domain === trusted || domain.endsWith(`.${trusted}`))) ||
    ((domain.includes('steam') || domain.includes('steampowered')) && !['steampowered.com', 'steamcommunity.com'].some((trusted) => domain === trusted || domain.endsWith(`.${trusted}`)))
  );
  if (suspiciousBrandDomain) return { type: 'possible-brand-impersonation', detail: suspiciousBrandDomain };

  return null;
}

export function isModerator(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.ManageMessages) ||
    member?.permissions?.has(PermissionFlagsBits.ModerateMembers) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

export class ModerationEngine {
  constructor({ client, projectRoot, color }) {
    this.client = client;
    this.color = color;
    this.security = JSON.parse(fs.readFileSync(path.join(projectRoot, 'config', 'security.json'), 'utf8'));
    this.infractions = new JsonStore(path.join(projectRoot, 'data', 'infractions.json'), {});
    this.runtime = new JsonStore(path.join(projectRoot, 'data', 'security-state.json'), {});
    this.messageWindows = new Map();
    this.joinWindows = new Map();
  }

  async load() {
    await Promise.all([this.infractions.load(), this.runtime.load()]);
  }

  async log(guild, title, description, fields = []) {
    const channelId = process.env.MOD_LOG_CHANNEL_ID;
    if (!channelId || !guild) return;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setColor(this.color)
      .setTitle(title)
      .setDescription(description || 'No additional details.')
      .addFields(fields)
      .setTimestamp();
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((error) => {
      console.error('Could not write moderation log:', error);
    });
  }

  getWarnings(guildId, userId) {
    return this.infractions.get(`${guildId}:${userId}`, []);
  }

  async warn(member, reason, moderator = 'Hatclanker') {
    const key = `${member.guild.id}:${member.id}`;
    const warnings = this.getWarnings(member.guild.id, member.id);
    const warning = { reason, moderator, at: Date.now() };
    warnings.push(warning);
    await this.infractions.set(key, warnings);
    const strikeCount = warnings.length;
    const actions = this.security.strikes ?? {};

    if (actions.timeoutAt > 0 && strikeCount >= actions.timeoutAt && member.moderatable) {
      await member.timeout((actions.timeoutMinutes ?? 10) * 60_000, `Automated strike ${strikeCount}: ${reason}`).catch(() => {});
    }
    if (actions.kickAt > 0 && strikeCount >= actions.kickAt && member.kickable) {
      await member.kick(`Automated strike ${strikeCount}: ${reason}`).catch(() => {});
    }
    if (actions.banAt > 0 && strikeCount >= actions.banAt && member.bannable) {
      await member.ban({ reason: `Automated strike ${strikeCount}: ${reason}` }).catch(() => {});
    }

    await this.log(member.guild, '⚠️ Warning issued', `${member} received strike **${strikeCount}**.`, [
      { name: 'Reason', value: reason.slice(0, 1024) },
      { name: 'Moderator', value: String(moderator).slice(0, 1024) }
    ]);
    return strikeCount;
  }

  spamViolation(message) {
    const settings = this.security.antiSpam ?? {};
    const now = Date.now();
    const key = `${message.guildId}:${message.author.id}`;
    const windowMs = (settings.windowSeconds ?? 10) * 1_000;
    const entries = (this.messageWindows.get(key) ?? []).filter((entry) => now - entry.at <= windowMs);
    entries.push({ at: now, content: message.content.toLowerCase().trim() });
    this.messageWindows.set(key, entries);

    if (entries.length > (settings.maxMessages ?? 6)) return 'rapid-fire spam';
    const duplicateCount = entries.filter((entry) => entry.content && entry.content === entries.at(-1).content).length;
    if (duplicateCount >= (settings.duplicateLimit ?? 3)) return 'repeated-message spam';
    if (message.content.length >= (settings.capsMinimumLength ?? 20) && capsPercent(message.content) >= (settings.capsPercent ?? 75)) {
      return 'excessive capital letters';
    }
    return null;
  }

  async handleMessage(message) {
    if (!this.security.enabled || !message.inGuild() || message.author.bot || isModerator(message.member)) return false;
    const contentViolation = scanContent(message.content, this.security);
    const spam = this.spamViolation(message);
    const violation = contentViolation ? `${contentViolation.type}: ${contentViolation.detail}` : spam;
    if (!violation) return false;

    const snapshot = message.content.slice(0, 800) || '[no text content]';
    await message.delete().catch(() => {});
    const strikes = await this.warn(message.member, violation);
    await message.author.send(`🛡️ Hatclanker removed a message in **${message.guild.name}**: ${violation}. Strike **${strikes}**.`).catch(() => {});
    await this.log(message.guild, '🗑️ Automated deletion', `Message from ${message.author} was removed.`, [
      { name: 'Reason', value: violation.slice(0, 1024) },
      { name: 'Content snapshot', value: snapshot || '[empty]' }
    ]);
    return true;
  }

  async handleJoin(member) {
    const settings = this.security.antiRaid ?? {};
    const now = Date.now();
    const windowMs = (settings.windowSeconds ?? 20) * 1_000;
    const joins = (this.joinWindows.get(member.guild.id) ?? []).filter((timestamp) => now - timestamp <= windowMs);
    joins.push(now);
    this.joinWindows.set(member.guild.id, joins);

    if (joins.length < (settings.joinThreshold ?? 8)) return false;
    const until = now + (settings.lockdownMinutes ?? 10) * 60_000;
    await this.runtime.set(`lockdown:${member.guild.id}`, until);
    if (member.moderatable) await member.timeout(until - now, 'Automatic anti-raid quarantine').catch(() => {});
    const channelIds = (process.env.RAID_LOCKDOWN_CHANNEL_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    for (const channelId of channelIds) {
      const channel = await member.guild.channels.fetch(channelId).catch(() => null);
      if (!channel?.permissionOverwrites) continue;
      const overwrite = channel.permissionOverwrites.resolve(member.guild.roles.everyone.id);
      const previous = overwrite?.deny?.has(PermissionFlagsBits.SendMessages) ? 'deny' : overwrite?.allow?.has(PermissionFlagsBits.SendMessages) ? 'allow' : 'inherit';
      await this.runtime.set(`channel-lock:${channel.id}`, previous);
      await channel.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false }, { reason: 'Automatic anti-raid lockdown' }).catch(() => {});
    }
    await this.log(member.guild, '🚨 Possible raid detected', `${joins.length} joins occurred inside ${settings.windowSeconds ?? 20} seconds. New arrivals are being quarantined temporarily.`);
    return true;
  }

  async onDelete(message) {
    if (!message.guild || message.author?.bot) return;
    await this.log(message.guild, '🗑️ Message deleted', `A message by ${message.author ?? 'an unknown member'} was deleted in ${message.channel}.`, [
      { name: 'Content snapshot', value: (message.content || '[uncached or empty]').slice(0, 1024) }
    ]);
  }

  async onUpdate(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
    await this.log(newMessage.guild, '✏️ Message edited', `${newMessage.author} edited a message in ${newMessage.channel}.`, [
      { name: 'Before', value: (oldMessage.content || '[uncached]').slice(0, 1024) },
      { name: 'After', value: (newMessage.content || '[empty]').slice(0, 1024) }
    ]);
  }
}
