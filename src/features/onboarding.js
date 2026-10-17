import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { JsonStore } from '../lib/json-store.js';

function privatePayload(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

export class OnboardingFeatures {
  constructor({ client, projectRoot, config, moderation }) {
    this.client = client;
    this.projectRoot = projectRoot;
    this.config = config;
    this.moderation = moderation;
    this.security = moderation.security;
    this.invites = new Map();
    this.challenges = new Map();
    this.inviteStats = new JsonStore(path.join(projectRoot, 'data', 'invite-stats.json'), {});
  }

  async load() {
    await this.inviteStats.load();
    for (const guild of this.client.guilds.cache.values()) {
      const invites = await guild.invites.fetch().catch(() => null);
      if (invites) this.invites.set(guild.id, new Map(invites.map((invite) => [invite.code, invite.uses ?? 0])));
    }
    await this.updateMemberCount();
  }

  verifiedRoleId() {
    return process.env.VERIFIED_ROLE_ID || this.security.verifiedRoleId;
  }

  async createWelcomeCard(member) {
    const width = 1000;
    const height = 360;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#09090f');
    gradient.addColorStop(0.55, '#2e1065');
    gradient.addColorStop(1, '#083344');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = '#22d3ee';
    context.lineWidth = 8;
    context.strokeRect(12, 12, width - 24, height - 24);

    const response = await fetch(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
    const avatar = await loadImage(Buffer.from(await response.arrayBuffer()));
    context.save();
    context.beginPath();
    context.arc(180, 180, 118, 0, Math.PI * 2);
    context.clip();
    context.drawImage(avatar, 62, 62, 236, 236);
    context.restore();
    context.strokeStyle = '#a855f7';
    context.lineWidth = 10;
    context.beginPath();
    context.arc(180, 180, 123, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = '#ffffff';
    context.font = 'bold 42px Arial';
    context.fillText('WELCOME TO THE WORKSHOP', 345, 115);
    context.fillStyle = '#67e8f9';
    context.font = 'bold 54px Arial';
    const name = member.displayName.length > 22 ? `${member.displayName.slice(0, 21)}…` : member.displayName;
    context.fillText(name, 345, 185);
    context.fillStyle = '#d8b4fe';
    context.font = '30px Arial';
    context.fillText(`Member #${member.guild.memberCount} • ${this.config.serverName}`, 345, 240);
    context.fillStyle = '#a3a3a3';
    context.font = '24px Arial';
    context.fillText('Run /start and get your bearings, legend.', 345, 292);
    return canvas.toBuffer('image/png');
  }

  async handleJoin(member) {
    await this.moderation.handleJoin(member);
    await this.trackInvite(member);
    await this.updateMemberCount(member.guild);

    const channelId = process.env.WELCOME_CHANNEL_ID;
    if (!channelId) return;
    const channel = await member.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    try {
      const card = new AttachmentBuilder(await this.createWelcomeCard(member), { name: `welcome-${member.id}.png` });
      await channel.send({
        content: `⚙️ ${member} joined the workshop. Use **/start** to get oriented.`,
        files: [card]
      });
    } catch (error) {
      console.error('Welcome card failed; using text fallback:', error);
      await channel.send(`⚙️ Welcome ${member}! Use **/start** to get oriented.`).catch(() => {});
    }
  }

  async handleLeave(member) {
    await this.updateMemberCount(member.guild);
    const channelId = process.env.GOODBYE_CHANNEL_ID;
    if (!channelId) return;
    const channel = await member.guild.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased()) await channel.send(`👋 **${member.user.tag}** left the workshop. One less wrench rattling around.`).catch(() => {});
  }

  async trackInvite(member) {
    const before = this.invites.get(member.guild.id) ?? new Map();
    const after = await member.guild.invites.fetch().catch(() => null);
    if (!after) return;
    const used = after.find((invite) => (invite.uses ?? 0) > (before.get(invite.code) ?? 0));
    this.invites.set(member.guild.id, new Map(after.map((invite) => [invite.code, invite.uses ?? 0])));
    if (!used?.inviterId) return;
    const key = `${member.guild.id}:${used.inviterId}`;
    const stats = this.inviteStats.get(key, { valid: 0, flagged: 0, joins: [] });
    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    const flagged = accountAgeDays < 7 || member.user.bot;
    stats.valid += 1;
    if (flagged) stats.flagged += 1;
    stats.joins.push({ userId: member.id, at: Date.now(), code: used.code, flagged, accountAgeDays });
    await this.inviteStats.set(key, stats);
    await this.moderation.log(member.guild, flagged ? '🚩 Suspicious invite join' : '📨 Invite tracked', `${member} joined using **${used.code}**, created by <@${used.inviterId}>. Account age: **${accountAgeDays} days**.`);
  }

  async updateMemberCount(guild = null) {
    const channelId = process.env.MEMBER_COUNT_CHANNEL_ID;
    if (!channelId) return;
    const targetGuilds = guild ? [guild] : [...this.client.guilds.cache.values()];
    for (const target of targetGuilds) {
      const channel = await target.channels.fetch(channelId).catch(() => null);
      if (channel) await channel.setName(`Members: ${target.memberCount}`).catch(() => {});
    }
  }

  async grantLevelReward(member, level) {
    const rewards = (this.security.levelRoleRewards ?? []).filter((reward) => reward.level <= level && reward.roleId);
    for (const reward of rewards) {
      if (!member.roles.cache.has(reward.roleId)) await member.roles.add(reward.roleId, `Level ${level} reward`).catch(() => {});
    }
  }

  rulesPanel() {
    const embed = new EmbedBuilder()
      .setColor(this.config.color)
      .setTitle('🛡️ Rules gate')
      .setDescription(`${this.config.rules.map((rule, index) => `**${index + 1}.** ${rule}`).join('\n\n')}\n\nClick below to accept the rules and complete a quick human check.`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify:start').setLabel('I Agree & Verify').setEmoji('✅').setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
  }

  rolePanel(kind) {
    const entries = kind === 'interests' ? this.security.interestRoles : this.security.selfRoles;
    if (!entries?.length) return null;
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`roles:${kind}`)
      .setPlaceholder(kind === 'interests' ? 'What are you into?' : 'Choose your roles')
      .setMinValues(0)
      .setMaxValues(Math.min(entries.length, 25))
      .addOptions(entries.slice(0, 25).map((entry) => ({
        label: entry.label,
        value: entry.roleId,
        description: entry.description?.slice(0, 100),
        emoji: entry.emoji || undefined
      })));
    return {
      embeds: [new EmbedBuilder().setColor(this.config.color).setTitle(kind === 'interests' ? '🧭 Pick your interests' : '🎭 Pick your roles').setDescription('Your selection updates immediately. Change it whenever you like.')],
      components: [new ActionRowBuilder().addComponents(menu)]
    };
  }

  async handleCommand(interaction) {
    if (interaction.commandName === 'panel') {
      const type = interaction.options.getSubcommand();
      const payload = type === 'rules' ? this.rulesPanel() : this.rolePanel(type);
      if (!payload) {
        await interaction.reply(privatePayload({ content: `No ${type} roles are configured in config/security.json.` }));
        return true;
      }
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      await channel.send(payload);
      await interaction.reply(privatePayload({ content: `✅ ${type} panel posted in ${channel}.` }));
      return true;
    }

    if (interaction.commandName === 'invites') {
      const target = interaction.options.getUser('member') ?? interaction.user;
      const stats = this.inviteStats.get(`${interaction.guildId}:${target.id}`, { valid: 0, flagged: 0, joins: [] });
      await interaction.reply(`📨 **${target.displayName}** has tracked **${stats.valid}** successful invite${stats.valid === 1 ? '' : 's'}; **${stats.flagged ?? 0}** were flagged as very new or bot accounts.`);
      return true;
    }

    return false;
  }

  async handleInteraction(interaction) {
    if (interaction.isButton() && interaction.customId === 'verify:start') {
      const left = 2 + Math.floor(Math.random() * 8);
      const right = 2 + Math.floor(Math.random() * 8);
      const token = randomUUID().slice(0, 8);
      this.challenges.set(token, { answer: left + right, userId: interaction.user.id, guildId: interaction.guildId, expiresAt: Date.now() + 300_000 });
      const modal = new ModalBuilder().setCustomId(`verify:answer:${token}`).setTitle('Human verification');
      const answer = new TextInputBuilder().setCustomId('answer').setLabel(`What is ${left} + ${right}?`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3);
      modal.addComponents(new ActionRowBuilder().addComponents(answer));
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('verify:answer:')) {
      const token = interaction.customId.split(':')[2];
      const challenge = this.challenges.get(token);
      this.challenges.delete(token);
      if (!challenge || challenge.userId !== interaction.user.id || challenge.guildId !== interaction.guildId || challenge.expiresAt < Date.now()) {
        await interaction.reply(privatePayload({ content: '❌ Verification expired. Click the button and try again.' }));
        return true;
      }
      if (Number(interaction.fields.getTextInputValue('answer')) !== challenge.answer) {
        await interaction.reply(privatePayload({ content: '❌ Wrong answer. Click the verification button and try again.' }));
        return true;
      }
      const roleId = this.verifiedRoleId();
      if (!roleId) {
        await interaction.reply(privatePayload({ content: '⚠️ You passed, but staff has not configured `VERIFIED_ROLE_ID` yet.' }));
        return true;
      }
      await interaction.member.roles.add(roleId, 'Passed Hatclanker verification');
      await interaction.reply(privatePayload({ content: '✅ Rules accepted, human confirmed, server unlocked. Welcome aboard.' }));
      return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('roles:')) {
      const kind = interaction.customId.split(':')[1];
      const entries = kind === 'interests' ? this.security.interestRoles : this.security.selfRoles;
      const allowedRoleIds = entries.map((entry) => entry.roleId);
      const toRemove = allowedRoleIds.filter((roleId) => interaction.member.roles.cache.has(roleId) && !interaction.values.includes(roleId));
      if (toRemove.length) await interaction.member.roles.remove(toRemove, 'Updated self roles');
      if (interaction.values.length) await interaction.member.roles.add(interaction.values, 'Updated self roles');
      await interaction.reply(privatePayload({ content: `✅ ${kind} updated.` }));
      return true;
    }

    return false;
  }
}
