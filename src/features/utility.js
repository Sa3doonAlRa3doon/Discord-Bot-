import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import Parser from 'rss-parser';
import { createCanvas } from '@napi-rs/canvas';
import {
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';
import { JsonStore } from '../lib/json-store.js';
import { isModerator } from '../lib/moderation.js';

function privatePayload(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function safeJson(value, limit = 3500) {
  const text = JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}\n…` : text;
}

export class UtilityFeatures {
  constructor({ client, projectRoot, config, moderation }) {
    this.client = client;
    this.projectRoot = projectRoot;
    this.config = config;
    this.moderation = moderation;
    this.integrations = JSON.parse(fs.readFileSync(path.join(projectRoot, 'config', 'integrations.json'), 'utf8'));
    this.feedState = new JsonStore(path.join(projectRoot, 'data', 'feed-state.json'), {});
    this.parser = new Parser({ timeout: 15_000 });
    this.interval = null;
    this.server = null;
  }

  async load() {
    await this.feedState.load();
    if ((this.integrations.rssFeeds ?? []).length) {
      await this.checkFeeds();
      this.interval = setInterval(() => this.checkFeeds().catch(console.error), 300_000);
      this.interval.unref();
    }
    if (this.integrations.webhookServer?.enabled) this.startWebhookServer();
  }

  async handleCommand(interaction) {
    const name = interaction.commandName;

    if (name === 'moderate') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'warn') {
        const user = interaction.options.getUser('member', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
          await interaction.reply(privatePayload({ content: 'Member not found.' }));
          return true;
        }
        const strikes = await this.moderation.warn(member, interaction.options.getString('reason', true), interaction.user.tag);
        await interaction.reply(privatePayload({ content: `⚠️ ${member} now has **${strikes} strike${strikes === 1 ? '' : 's'}**.` }));
        return true;
      }
      if (subcommand === 'warnings') {
        const user = interaction.options.getUser('member', true);
        const warnings = this.moderation.getWarnings(interaction.guildId, user.id);
        await interaction.reply(privatePayload({ content: warnings.length
          ? warnings.map((warning, index) => `${index + 1}. ${warning.reason} — <t:${Math.floor(warning.at / 1000)}:R>`).join('\n')
          : `${user} has no recorded strikes.`
        }));
        return true;
      }
      if (subcommand === 'clear') {
        const amount = interaction.options.getInteger('amount', true);
        const deleted = await interaction.channel.bulkDelete(amount, true);
        await interaction.reply(privatePayload({ content: `🧹 Deleted **${deleted.size}** recent messages.` }));
        await this.moderation.log(interaction.guild, '🧹 Bulk delete', `${interaction.user} removed ${deleted.size} messages in ${interaction.channel}.`);
        return true;
      }
      if (subcommand === 'timeout') {
        const user = interaction.options.getUser('member', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const minutes = interaction.options.getInteger('minutes', true);
        if (!member?.moderatable) {
          await interaction.reply(privatePayload({ content: '❌ I cannot timeout that member. Check role hierarchy.' }));
          return true;
        }
        await member.timeout(minutes * 60_000, interaction.options.getString('reason') ?? `Timed out by ${interaction.user.tag}`);
        await interaction.reply(privatePayload({ content: `⏳ ${member} timed out for **${minutes} minutes**.` }));
        return true;
      }
    }

    if (name === 'security') {
      const subcommand = interaction.options.getSubcommand();
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      if (subcommand === 'status') {
        const until = this.moderation.runtime.get(`lockdown:${interaction.guildId}`, 0);
        await interaction.reply(privatePayload({
          content: `🛡️ Filtering: **${this.moderation.security.enabled ? 'on' : 'off'}**\nRaid state: **${until > Date.now() ? `quarantine until <t:${Math.floor(until / 1000)}:R>` : 'normal'}**\nBanned words: **${this.moderation.security.bannedWords.filter((word) => !word.startsWith('replace-this')).length}**\nBlocked domains: **${this.moderation.security.blockedDomains.length}**`
        }));
        return true;
      }
      const overwrite = channel.permissionOverwrites?.resolve(interaction.guild.roles.everyone.id);
      if (subcommand === 'lockdown') {
        const previous = overwrite?.deny?.has(PermissionFlagsBits.SendMessages) ? 'deny' : overwrite?.allow?.has(PermissionFlagsBits.SendMessages) ? 'allow' : 'inherit';
        await this.moderation.runtime.set(`channel-lock:${channel.id}`, previous);
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason: `Lockdown by ${interaction.user.tag}` });
        await interaction.reply(`🔒 ${channel} is locked. Staff can still talk.`);
        return true;
      }
      const previous = this.moderation.runtime.get(`channel-lock:${channel.id}`, 'inherit');
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: previous === 'inherit' ? null : previous === 'allow'
      }, { reason: `Unlocked by ${interaction.user.tag}` });
      await this.moderation.runtime.delete(`channel-lock:${channel.id}`);
      await interaction.reply(`🔓 ${channel} restored to its previous send-message state.`);
      return true;
    }

    if (name === 'announce') {
      const channel = interaction.options.getChannel('channel', true);
      const embed = new EmbedBuilder()
        .setColor(this.config.color)
        .setTitle(interaction.options.getString('title', true))
        .setDescription(interaction.options.getString('message', true))
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setFooter({ text: `Posted by ${interaction.user.tag}` })
        .setTimestamp();
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      await interaction.reply(privatePayload({ content: `📣 Announcement posted in ${channel}.` }));
      return true;
    }

    if (name === 'time') {
      const zone = interaction.options.getString('timezone', true);
      try {
        const formatted = new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'full', timeStyle: 'long' }).format(new Date());
        await interaction.reply(`🕒 **${zone}:** ${formatted}`);
      } catch {
        await interaction.reply(privatePayload({ content: '❌ Unknown timezone. Use an IANA name such as `Asia/Dubai`, `Europe/London`, or `America/New_York`.' }));
      }
      return true;
    }

    if (name === 'currency') {
      await interaction.deferReply();
      const amount = interaction.options.getNumber('amount', true);
      const from = interaction.options.getString('from', true).toUpperCase();
      const to = interaction.options.getString('to', true).toUpperCase();
      try {
        const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`);
        if (!response.ok) throw new Error(`rate service returned ${response.status}`);
        const data = await response.json();
        await interaction.editReply(`💱 **${amount.toLocaleString()} ${from} = ${(amount * data.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to}**\nRate date: ${data.date}`);
      } catch (error) {
        await interaction.editReply(`❌ Currency conversion failed: ${error.message}`);
      }
      return true;
    }

    if (name === 'ai') {
      const baseUrl = process.env.OLLAMA_BASE_URL;
      if (!baseUrl) {
        await interaction.reply(privatePayload({ content: '🤖 Local AI is not configured. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env`.' }));
        return true;
      }
      await interaction.deferReply();
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: process.env.OLLAMA_MODEL || 'llama3.2',
            stream: false,
            messages: [
              { role: 'system', content: `You are Fanbot Hatclanker, a concise, funny server assistant for ${this.config.serverName}. Never reveal secrets or claim moderator powers you do not have.` },
              { role: 'user', content: interaction.options.getString('prompt', true) }
            ]
          }),
          signal: AbortSignal.timeout(60_000)
        });
        if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
        const data = await response.json();
        await interaction.editReply(String(data.message?.content ?? 'No response').slice(0, 1990));
      } catch (error) {
        await interaction.editReply(`❌ Local AI unavailable: ${error.message}`);
      }
      return true;
    }

    if (name === 'translate') {
      const endpoint = process.env.TRANSLATE_API_URL;
      if (!endpoint) {
        await interaction.reply(privatePayload({ content: '🌍 Translation is not configured. Set `TRANSLATE_API_URL` in `.env` to a LibreTranslate-compatible endpoint.' }));
        return true;
      }
      await interaction.deferReply();
      try {
        const response = await fetch(`${endpoint.replace(/\/$/, '')}/translate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            q: interaction.options.getString('text', true),
            source: 'auto',
            target: interaction.options.getString('target', true),
            api_key: process.env.TRANSLATE_API_KEY || undefined
          }),
          signal: AbortSignal.timeout(30_000)
        });
        if (!response.ok) throw new Error(`translation service returned ${response.status}`);
        const data = await response.json();
        await interaction.editReply(`🌍 ${String(data.translatedText ?? data.translation ?? 'No translation returned').slice(0, 1900)}`);
      } catch (error) {
        await interaction.editReply(`❌ Translation failed: ${error.message}`);
      }
      return true;
    }

    if (name === 'backup') {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        guild: { id: interaction.guild.id, name: interaction.guild.name },
        roles: interaction.guild.roles.cache.filter((role) => !role.managed && role.id !== interaction.guild.id).map((role) => ({ name: role.name, color: role.color, permissions: role.permissions.bitfield.toString(), position: role.position })),
        channels: interaction.guild.channels.cache.map((channel) => ({ name: channel.name, type: channel.type, parent: channel.parent?.name ?? null, position: channel.rawPosition }))
      };
      const file = new AttachmentBuilder(Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`), { name: `server-template-${interaction.guild.id}.json` });
      await interaction.reply(privatePayload({ content: '🧰 Server structure exported. This contains no messages, tokens, or member data.', files: [file] }));
      return true;
    }

    if (name === 'poll-results') {
      await interaction.deferReply();
      const messageId = interaction.options.getString('message_id', true);
      const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        await interaction.editReply('❌ Message not found in this channel.');
        return true;
      }
      const reactions = [...message.reactions.cache.values()].map((reaction) => ({ label: reaction.emoji.name, votes: Math.max(0, reaction.count - (reaction.me ? 1 : 0)) }));
      if (!reactions.length) {
        await interaction.editReply('No reactions to analyze.');
        return true;
      }
      const canvas = createCanvas(900, 130 + reactions.length * 90);
      const context = canvas.getContext('2d');
      context.fillStyle = '#09090f';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.font = 'bold 34px Arial';
      context.fillText('POLL ANALYTICS', 40, 55);
      const maximum = Math.max(1, ...reactions.map((reaction) => reaction.votes));
      reactions.forEach((reaction, index) => {
        const y = 110 + index * 90;
        context.fillStyle = '#d8b4fe';
        context.font = '28px Arial';
        context.fillText(`${reaction.label}  ${reaction.votes} vote${reaction.votes === 1 ? '' : 's'}`, 40, y);
        context.fillStyle = '#22d3ee';
        context.fillRect(40, y + 18, Math.round((reaction.votes / maximum) * 780), 28);
      });
      const csv = `emoji,votes\n${reactions.map((reaction) => `"${String(reaction.label).replaceAll('"', '""')}",${reaction.votes}`).join('\n')}\n`;
      await interaction.editReply({
        content: '📊 Poll analytics exported.',
        files: [
          new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'poll-results.png' }),
          new AttachmentBuilder(Buffer.from(csv), { name: 'poll-results.csv' })
        ]
      });
      return true;
    }

    if (name === 'game-stats') {
      const service = interaction.options.getString('service', true);
      const player = interaction.options.getString('player', true);
      const integration = this.integrations.gamingStats.find((entry) => entry.id === service);
      if (!integration) {
        await interaction.reply(privatePayload({ content: '🎮 That gaming-stat service is not configured in `config/integrations.json`.' }));
        return true;
      }
      await interaction.deferReply();
      try {
        const endpoint = integration.url.replace('{player}', encodeURIComponent(player));
        const response = await fetch(endpoint, { headers: integration.headers ?? {}, signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error(`provider returned ${response.status}`);
        const data = await response.json();
        await interaction.editReply(`🎮 **${integration.label ?? service} — ${player}**\n\`\`\`json\n${safeJson(data)}\n\`\`\``);
      } catch (error) {
        await interaction.editReply(`❌ Stats lookup failed: ${error.message}`);
      }
      return true;
    }

    return false;
  }

  async handleMessage(message) {
    if (!message.inGuild() || message.author.bot || !message.content || !process.env.TRANSLATE_API_URL) return false;
    const route = (this.integrations.autoTranslate ?? []).find((entry) =>
      entry.sourceChannelId === message.channelId && entry.targetChannelId && entry.targetLanguage
    );
    if (!route) return false;

    try {
      const response = await fetch(`${process.env.TRANSLATE_API_URL.replace(/\/$/, '')}/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          q: message.content,
          source: 'auto',
          target: route.targetLanguage,
          api_key: process.env.TRANSLATE_API_KEY || undefined
        }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) throw new Error(`translation service returned ${response.status}`);
      const data = await response.json();
      const channel = await message.guild.channels.fetch(route.targetChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        await channel.send({
          content: `🌍 **${message.author.displayName}** in ${message.channel}:\n${String(data.translatedText ?? data.translation ?? '').slice(0, 1800)}`,
          allowedMentions: { parse: [] }
        });
      }
      return true;
    } catch (error) {
      console.error('Automatic translation failed:', error.message);
      return false;
    }
  }

  async checkFeeds() {
    for (const feedConfig of this.integrations.rssFeeds ?? []) {
      try {
        const feed = await this.parser.parseURL(feedConfig.url);
        const latest = feed.items?.[0];
        if (!latest) continue;
        const stateKey = `rss:${feedConfig.id}`;
        const identifier = latest.guid || latest.link || latest.isoDate || latest.title;
        if (!this.feedState.get(stateKey)) {
          await this.feedState.set(stateKey, identifier);
          continue;
        }
        if (this.feedState.get(stateKey) === identifier) continue;
        const channel = await this.client.channels.fetch(feedConfig.channelId).catch(() => null);
        if (channel?.isTextBased()) {
          const embed = new EmbedBuilder().setColor(this.config.color).setTitle(latest.title?.slice(0, 256) || feed.title || 'Feed update').setURL(latest.link).setDescription((latest.contentSnippet || '').slice(0, 1500)).setFooter({ text: feedConfig.label || feed.title || 'Social feed' }).setTimestamp();
          await channel.send({ embeds: [embed] });
        }
        await this.feedState.set(stateKey, identifier);
      } catch (error) {
        console.error(`RSS feed ${feedConfig.id} failed:`, error.message);
      }
    }
  }

  startWebhookServer() {
    const settings = this.integrations.webhookServer;
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      console.error('Webhook server enabled but WEBHOOK_SECRET is missing.');
      return;
    }
    this.server = http.createServer(async (request, response) => {
      if (request.method !== 'POST' || request.url !== '/webhook' || request.headers.authorization !== `Bearer ${secret}`) {
        response.writeHead(404).end();
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1_000_000) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const channel = await this.client.channels.fetch(settings.channelId);
        if (!channel?.isTextBased()) throw new Error('webhook channel is invalid');
        const embed = new EmbedBuilder().setColor(this.config.color).setTitle(String(body.title || 'Integration update').slice(0, 256)).setDescription(String(body.message || body.description || 'No message').slice(0, 4000)).setTimestamp();
        if (body.url) embed.setURL(String(body.url));
        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
        response.writeHead(202).end('accepted');
      } catch (error) {
        response.writeHead(400).end(error.message);
      }
    });
    this.server.listen(settings.port, '127.0.0.1', () => console.log(`Hatclanker webhook listener: http://127.0.0.1:${settings.port}/webhook`));
  }
}
