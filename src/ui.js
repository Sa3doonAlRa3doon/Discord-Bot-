import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} from 'discord.js';

export const TOPICS = {
  start: { label: 'Start Here', emoji: '🚀', description: 'Your 60-second server launch sequence.' },
  channels: { label: 'Channel Map', emoji: '🗺️', description: 'What goes where, without wandering.' },
  rules: { label: 'Rules', emoji: '🛡️', description: 'The short version of staying cool.' },
  faq: { label: 'Quick Answers', emoji: '⚡', description: 'Answers to the usual server mysteries.' },
  support: { label: 'Get Help', emoji: '🔧', description: 'How to reach a human when metal fails.' }
};

function tone(config, clean, spicy) {
  return clean;
}

function baseEmbed(config) {
  return new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({ name: 'FANBOT // HATCLANKER' })
    .setFooter({ text: 'Hatclanker online • guidance with extra torque' })
    .setTimestamp();
}

export function buildHomeEmbed(config, displayName) {
  return baseEmbed(config)
    .setTitle(`⚙️ Welcome to ${config.serverName}, ${displayName}`)
    .setDescription(`${config.welcome}\n\n**${config.tagline}**`)
    .addFields(
      { name: '01 // Get oriented', value: 'Pick a topic below. I’ll keep it quick.', inline: true },
      { name: '02 // Ask anything', value: 'Use `/ask` and I’ll search the server guide.', inline: true },
      { name: '03 // Don’t forget', value: 'Use `/remind` for a personal reminder.', inline: true }
    );
}

export function buildTopicEmbed(config, topic) {
  if (topic === 'channels') {
    return baseEmbed(config)
      .setTitle('🗺️ Channel map')
      .setDescription(config.channels.map((channel) => `**${channel.name}**\n${channel.purpose}`).join('\n\n'));
  }

  if (topic === 'rules') {
    return baseEmbed(config)
      .setTitle('🛡️ House rules')
      .setDescription(config.rules.map((rule, index) => `**${index + 1}.** ${rule}`).join('\n\n'));
  }

  if (topic === 'faq') {
    return baseEmbed(config)
      .setTitle('⚡ Quick answers')
      .setDescription(config.faqs.map((faq) => `**${faq.question}**\n${faq.answer}`).join('\n\n'));
  }

  if (topic === 'support') {
    return baseEmbed(config)
      .setTitle('🔧 Need a human?')
      .setDescription(
        `Post in **#help-desk** with the details. Mention ${config.supportRole} only when the issue is urgent or private.\n\n**Good support request:** what you tried, what you expected, what happened, and a screenshot if useful.`,
      );
  }

  return baseEmbed(config)
    .setTitle('🚀 Your launch sequence')
    .setDescription([
      '**1.** Read the server rules.',
      '**2.** Complete any verification or role selection in #start-here.',
      '**3.** Check #announcements for the latest news.',
      '**4.** Say hello in #general.',
      '**5.** Use `/ask` whenever you get lost.'
    ].join('\n\n'));
}

export function buildGuideComponents() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('guide:topic')
    .setPlaceholder('Choose your route…')
    .addOptions(Object.entries(TOPICS).map(([value, topic]) => ({
      label: topic.label,
      value,
      description: topic.description,
      emoji: topic.emoji
    })));

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('guide:rules').setLabel('Rules').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('guide:channels').setLabel('Map').setEmoji('🗺️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('guide:support').setLabel('Help').setEmoji('🔧').setStyle(ButtonStyle.Primary)
  );

  return [new ActionRowBuilder().addComponents(select), buttons];
}

export function buildAnswerEmbed(config, question, match) {
  return baseEmbed(config)
    .setTitle('🔩 Hatclanker found a match')
    .setDescription(`**You asked**\n${question}\n\n**Best answer**\n${match.faq.answer}`)
    .addFields({ name: 'Matched guide entry', value: match.faq.question });
}

export function buildNoMatchEmbed(config) {
  return baseEmbed(config)
    .setTitle('🧰 That one needs a human')
    .setDescription(`I couldn’t find a confident answer in my server guide. Try \`/guide\`, or post in **#help-desk** and ping ${config.supportRole} if needed.`);
}
