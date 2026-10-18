import 'dotenv/config';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  AuditLogEvent,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  PermissionFlagsBits
} from 'discord.js';
import { CommunityFeatures } from './features/community.js';
import { AiMediaFeatures } from './features/ai-media.js';
import { FunSystemFeatures } from './features/fun-system.js';
import { MediaFeatures } from './features/media.js';
import { OnboardingFeatures } from './features/onboarding.js';
import { ProductivityFeatures } from './features/productivity.js';
import { UtilityFeatures } from './features/utility.js';
import { GoogleFeatures } from './features/google.js';
import { loadServerConfig, projectRoot } from './lib/config.js';
import { parseChoices, rollDice } from './lib/dice.js';
import { parseDuration, humanizeDuration } from './lib/duration.js';
import { LevelStore, levelProgress } from './lib/levels.js';
import { findBestFaq } from './lib/matcher.js';
import { ReminderStore } from './lib/reminders.js';
import { ModerationEngine } from './lib/moderation.js';
import {
  formatPermissionReport,
  missingEssentialPermissions
} from './lib/permissions.js';
import {
  buildAnswerEmbed,
  buildGuideComponents,
  buildHomeEmbed,
  buildNoMatchEmbed,
  buildTopicEmbed
} from './ui.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and add your Discord bot token.');
  process.exit(1);
}

const config = loadServerConfig();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

const reminders = new ReminderStore(
  path.join(projectRoot, 'data', 'reminders.json'),
  async (reminder) => {
    const user = await client.users.fetch(reminder.userId);
    await user.send(`⏰ **CLANK! Reminder:** ${reminder.message}`);
  }
);

const levels = new LevelStore(
  path.join(projectRoot, 'data', 'levels.json'),
  { cooldownMs: config.features.xpCooldownSeconds * 1_000 }
);

const moderation = new ModerationEngine({ client, projectRoot, color: config.color });
const community = new CommunityFeatures({ client, projectRoot, config });
const onboarding = new OnboardingFeatures({ client, projectRoot, config, moderation });
const media = new MediaFeatures({ client, config });
const utility = new UtilityFeatures({ client, projectRoot, config, moderation });
const googleWorkspace = new GoogleFeatures({ config });
const productivity = new ProductivityFeatures({ client, projectRoot, config, moderation });
const aiMedia = new AiMediaFeatures({ client, projectRoot, config, media });
const funSystem = new FunSystemFeatures({ client, projectRoot, config, moderation, media });
const voiceSessions = new Map();

const pollEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

function privateReply(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function progressBar(current, needed, size = 12) {
  const filled = Math.min(size, Math.max(0, Math.round((current / needed) * size)));
  return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)}`;
}

async function handleCommand(interaction) {
  const name = interaction.commandName;

  if (name === 'start') {
    await interaction.reply(privateReply({
      embeds: [buildHomeEmbed(config, interaction.user.displayName)],
      components: buildGuideComponents()
    }));
    return;
  }

  if (name === 'guide') {
    const topic = interaction.options.getString('topic');
    await interaction.reply(privateReply(topic
      ? { embeds: [buildTopicEmbed(config, topic)], components: buildGuideComponents() }
      : { embeds: [buildHomeEmbed(config, interaction.user.displayName)], components: buildGuideComponents() }
    ));
    return;
  }

  if (name === 'rules' || name === 'faq') {
    await interaction.reply(privateReply({
      embeds: [buildTopicEmbed(config, name)],
      components: buildGuideComponents()
    }));
    return;
  }

  if (name === 'ask') {
    const question = interaction.options.getString('question', true);
    const match = findBestFaq(question, config.faqs);
    await interaction.reply(privateReply({
      embeds: [match ? buildAnswerEmbed(config, question, match) : buildNoMatchEmbed(config)],
      components: buildGuideComponents()
    }));
    return;
  }

  if (name === 'remind') {
    const durationText = interaction.options.getString('in', true);
    const message = interaction.options.getString('message', true);
    const duration = parseDuration(durationText);

    if (!duration) {
      await interaction.reply(privateReply({
        content: '🔧 I couldn’t read that time. Try `10m`, `2 hours`, or `3d` (between 5 seconds and 30 days).'
      }));
      return;
    }

    await reminders.add({
      id: randomUUID(),
      userId: interaction.user.id,
      guildId: interaction.guildId,
      message,
      dueAt: Date.now() + duration
    });

    await interaction.reply(privateReply({
      content: `⏰ Bolts tightened. I’ll DM you in **${humanizeDuration(duration)}** about: **${message}**`
    }));
    return;
  }

  if (name === 'server') {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`📡 ${guild.name} status`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'Members', value: String(guild.memberCount), inline: true },
        { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: 'Systems nominal. Swag levels acceptable.' });
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (name === 'rank') {
    if (!config.features.leveling) {
      await interaction.reply(privateReply({ content: '📉 Leveling is disabled in `config/server.json`.' }));
      return;
    }

    const target = interaction.options.getUser('member') ?? interaction.user;
    const stats = levels.get(interaction.guildId, target.id);
    const progress = levelProgress(stats.xp);
    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setAuthor({ name: `${target.displayName} // RANK CARD`, iconURL: target.displayAvatarURL() })
      .setTitle(`⚡ Level ${progress.level}`)
      .setDescription(`${progressBar(progress.current, progress.needed)}\n**${progress.current} / ${progress.needed} XP** to the next level`)
      .addFields(
        { name: 'Total XP', value: String(progress.totalXp), inline: true },
        { name: 'Rewarded messages', value: String(stats.messages), inline: true }
      )
      .setThumbnail(target.displayAvatarURL({ size: 256 }));
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (name === 'leaderboard') {
    if (!config.features.leveling) {
      await interaction.reply(privateReply({ content: '📉 Leveling is disabled in `config/server.json`.' }));
      return;
    }

    const leaders = levels.top(interaction.guildId);
    const description = leaders.length === 0
      ? 'Nobody has earned XP yet. Go say something useful—or at least funny.'
      : leaders.map((entry, index) => `${index + 1}. <@${entry.userId}> — **Level ${entry.level}** · ${entry.xp} XP`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle('🏁 Server leaderboard')
      .setDescription(description)
      .setFooter({ text: 'XP is awarded once per cooldown; spam does not pay.' });
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (name === 'poll') {
    const question = interaction.options.getString('question', true);
    const choices = parseChoices(interaction.options.getString('choices', true), 2, 5);
    if (!choices) {
      await interaction.reply(privateReply({ content: '🗳️ Give me **2–5 choices**, separated with `|`. Each choice must be 80 characters or less.' }));
      return;
    }

    const permissions = interaction.channel.permissionsFor(interaction.guild.members.me);
    if (!permissions?.has(PermissionFlagsBits.AddReactions)) {
      await interaction.reply(privateReply({ content: '❌ I need **Add Reactions** in this channel to run a poll. Ask an admin to fix it, then use `/doctor`.' }));
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setAuthor({ name: `Poll by ${interaction.user.displayName}`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`🗳️ ${question}`)
      .setDescription(choices.map((choice, index) => `${pollEmoji[index]}  ${choice}`).join('\n\n'))
      .setFooter({ text: 'React below to vote. Democracy, but shinier.' });
    await interaction.reply({ embeds: [embed] });
    const message = await interaction.fetchReply();
    for (const emoji of pollEmoji.slice(0, choices.length)) await message.react(emoji);
    return;
  }

  if (name === 'suggest') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const configuredChannelId = process.env.SUGGESTIONS_CHANNEL_ID;
    const channel = configuredChannelId
      ? await interaction.guild.channels.fetch(configuredChannelId).catch(() => null)
      : interaction.channel;

    if (!channel?.isTextBased()) {
      await interaction.editReply('❌ `SUGGESTIONS_CHANNEL_ID` does not point to a usable text channel.');
      return;
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    const missing = missingEssentialPermissions(permissions);
    if (missing.length > 0 || !permissions?.has(PermissionFlagsBits.AddReactions)) {
      const names = [...missing.map((item) => item.label)];
      if (!permissions?.has(PermissionFlagsBits.AddReactions)) names.push('Add Reactions');
      await interaction.editReply(`❌ I can’t use ${channel}. Missing: **${[...new Set(names)].join(', ')}**.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('💡 New server suggestion')
      .setDescription(interaction.options.getString('idea', true))
      .setFooter({ text: `Suggested by ${interaction.user.username}` })
      .setTimestamp();
    const suggestion = await channel.send({ embeds: [embed] });
    await suggestion.react('👍');
    await suggestion.react('👎');
    await interaction.editReply(`✅ Suggestion delivered to ${channel}. Let the people judge your brilliant nonsense.`);
    return;
  }

  if (name === 'roll') {
    const notation = interaction.options.getString('dice', true);
    const result = rollDice(notation);
    if (!result) {
      await interaction.reply(privateReply({ content: '🎲 Use dice notation like `d20`, `2d6`, or `4d8+2`. Limits: 20 dice and 1,000 sides.' }));
      return;
    }

    const modifier = result.modifier === 0 ? '' : ` ${result.modifier > 0 ? '+' : '-'} ${Math.abs(result.modifier)}`;
    await interaction.reply(`🎲 **${interaction.user.displayName} rolled ${result.count}d${result.sides}${result.modifier ? `${result.modifier > 0 ? '+' : ''}${result.modifier}` : ''}:** [${result.rolls.join(', ')}]${modifier} = **${result.total}**`);
    return;
  }

  if (name === 'choose') {
    const choices = parseChoices(interaction.options.getString('options', true));
    if (!choices) {
      await interaction.reply(privateReply({ content: '🔀 Give me 2–20 choices separated with `|`.' }));
      return;
    }
    const choice = choices[Math.floor(Math.random() * choices.length)];
    await interaction.reply(`🔩 Hatclanker chooses: **${choice}**. No whining; the machine has spoken.`);
    return;
  }

  if (name === 'member') {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || config.color)
      .setAuthor({ name: `${user.displayName} // MEMBER FILE`, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joined this server', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
        { name: 'Highest role', value: member?.roles.highest?.toString() ?? 'None', inline: true }
      )
      .setFooter({ text: `User ID: ${user.id}` });
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (name === 'about') {
    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle('⚙️ FANBOT // HATCLANKER')
      .setDescription('A friendly server mechanic built to guide members, answer the repeat questions, remember the important stuff, and keep the whole place feeling less like a maze.')
      .addFields(
        { name: 'Vibe', value: 'Neon workshop gremlin', inline: true },
        { name: 'Job', value: 'Server co-pilot', inline: true },
        { name: 'Mouth', value: config.swearMode ? 'Unsupervised' : 'Family-friendly', inline: true }
      );
    await interaction.reply(privateReply({ embeds: [embed] }));
    return;
  }

  if (name === 'doctor') {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const botMember = interaction.guild.members.me;
    const permissions = channel?.permissionsFor?.(botMember);
    await interaction.reply(privateReply({
      content: formatPermissionReport(channel?.toString?.() ?? 'this channel', permissions)
    }));
    return;
  }

  if (name === 'setup') {
    const channel = interaction.options.getChannel('channel', true);
    const botMember = interaction.guild.members.me;
    const missing = missingEssentialPermissions(channel.permissionsFor(botMember));

    if (missing.length > 0) {
      await interaction.reply(privateReply({
        content: `❌ I can’t post in ${channel}. Missing: **${missing.map((item) => item.label).join(', ')}**. Fix the bot role or channel overrides, then run \`/setup\` again.`
      }));
      return;
    }

    await channel.send({
      embeds: [buildHomeEmbed(config, 'new arrival')],
      components: buildGuideComponents()
    });
    await interaction.reply(privateReply({
      content: `✅ Hatclanker’s welcome cockpit is live in ${channel}.`
    }));
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Hatclanker online as ${readyClient.user.tag} ⚙️`);
  readyClient.user.setActivity('/start • server co-pilot');
  await Promise.all([
    reminders.load(),
    levels.load(),
    moderation.load(),
    community.load(),
    onboarding.load(),
    utility.load(),
    productivity.load(),
    aiMedia.load(),
    funSystem.load()
  ]);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (await community.handleCommand(interaction)) return;
      if (await onboarding.handleCommand(interaction)) return;
      if (await media.handleCommand(interaction)) return;
      if (await utility.handleCommand(interaction)) return;
      if (await googleWorkspace.handleCommand(interaction)) return;
      if (await productivity.handleCommand(interaction)) return;
      if (await aiMedia.handleCommand(interaction)) return;
      if (await funSystem.handleCommand(interaction)) return;
      await handleCommand(interaction);
      return;
    }

    if (await community.handleInteraction(interaction)) return;
    if (await onboarding.handleInteraction(interaction)) return;
    if (await productivity.handleInteraction(interaction)) return;
    if (await funSystem.handleInteraction(interaction)) return;

    if (interaction.isStringSelectMenu() && interaction.customId === 'guide:topic') {
      await interaction.update({
        embeds: [buildTopicEmbed(config, interaction.values[0])],
        components: buildGuideComponents()
      });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('guide:')) {
      const topic = interaction.customId.split(':')[1];
      await interaction.update({
        embeds: [buildTopicEmbed(config, topic)],
        components: buildGuideComponents()
      });
    }
  } catch (error) {
    console.error('Interaction failed:', error);
    const response = privateReply({
      content: '⚠️ A bolt came loose. Please try that again.'
    });
    try {
      if (interaction.deferred) await interaction.editReply({ content: response.content, embeds: [], components: [] });
      else if (interaction.replied) await interaction.followUp(response);
      else await interaction.reply(response);
    } catch (replyError) {
      console.error('Discord also blocked the error response. Run /doctor after fixing channel visibility:', replyError);
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!client.user) return;

  if (!message.author.bot && await moderation.handleMessage(message)) return;
  if (await funSystem.handleMessage(message)) return;
  if (message.author.bot) return;
  await utility.handleMessage(message);

  if (message.inGuild() && config.features.leveling) {
    const award = await levels.award(message.guildId, message.author.id).catch((error) => {
      console.error('Could not award XP:', error);
      return null;
    });

    if (award?.leveledUp && config.features.levelUpAnnouncements) {
      await onboarding.grantLevelReward(message.member, award.level);
      await message.channel.send(`⚡ ${message.author}, level **${award.level}** unlocked. Nice work!`)
        .catch((error) => console.error('Could not send level-up message:', error));
    }
  }

  if (await community.handleMessage(message)) return;

  if (!message.mentions.has(client.user)) return;
  const question = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

  const payload = !question
    ? {
        embeds: [buildHomeEmbed(config, message.member?.displayName ?? message.author.globalName ?? message.author.username)],
        components: buildGuideComponents()
      }
    : {
        embeds: [
          (() => {
            const match = findBestFaq(question, config.faqs);
            return match ? buildAnswerEmbed(config, question, match) : buildNoMatchEmbed(config);
          })()
        ]
      };

  try {
    await message.reply(payload);
  } catch (error) {
    console.error(`Could not reply in ${message.channelId}:`, error);
    await message.author.send({
      content: '🔧 I saw your message, but Discord blocked me from replying in that channel. Ask an admin to run `/doctor` there.',
      ...payload
    }).catch((dmError) => console.error(`Could not DM ${message.author.tag}:`, dmError));
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  await onboarding.handleJoin(member);
  try {
    await member.send({
      embeds: [buildHomeEmbed(config, member.displayName)],
      components: buildGuideComponents()
    });
  } catch {
    console.log(`Could not DM welcome to ${member.user.tag}.`);
  }

});

client.on(Events.GuildMemberRemove, async (member) => {
  await onboarding.handleLeave(member);
  await moderation.log(member.guild, '👋 Member left', `**${member.user.tag}** (${member.id}) left or was removed.`);
});

client.on(Events.MessageDelete, (message) => moderation.onDelete(message));
client.on(Events.MessageUpdate, (oldMessage, newMessage) => moderation.onUpdate(oldMessage, newMessage));

client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
  if (![AuditLogEvent.MemberKick, AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberBanRemove].includes(entry.action)) return;
  const label = entry.action === AuditLogEvent.MemberKick ? 'Kick' : entry.action === AuditLogEvent.MemberBanAdd ? 'Ban' : 'Unban';
  await moderation.log(guild, `🔨 ${label} action`, `Target: <@${entry.targetId}>\nExecutor: <@${entry.executorId}>\nReason: ${entry.reason || 'No reason provided.'}`);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const key = `${newState.guild.id}:${newState.id}`;
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    voiceSessions.set(key, Date.now());
    return;
  }
  if (oldState.channelId && !newState.channelId) {
    const joinedAt = voiceSessions.get(key);
    voiceSessions.delete(key);
    if (!joinedAt || newState.member.user.bot || !config.features.leveling) return;
    const minutes = Math.floor((Date.now() - joinedAt) / 60_000);
    const earned = Math.min(240, Math.floor(minutes / 5) * 10);
    if (earned <= 0) return;
    const award = await levels.addXp(newState.guild.id, newState.id, earned);
    if (award.leveledUp) await onboarding.grantLevelReward(newState.member, award.level);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  await funSystem.handleReaction(reaction, user).catch((error) => console.error('V4 reaction handler failed:', error));
  if (reaction.partial) await reaction.fetch().catch(() => null);
  const settings = moderation.security.reactionThread;
  if (!settings?.enabled || reaction.emoji.name !== settings.emoji || reaction.count < settings.threshold) return;
  const message = reaction.message;
  if (!message.inGuild() || message.hasThread || !message.channel?.threads) return;
  await message.startThread({ name: `Side thread: ${message.author?.username ?? 'discussion'}`.slice(0, 90), reason: `Reaction threshold ${settings.threshold} reached` }).catch(() => {});
});

process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error));
process.on('SIGINT', () => {
  client.destroy();
  process.exit(0);
});

await client.login(token);
