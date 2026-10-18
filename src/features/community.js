import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { JsonStore } from '../lib/json-store.js';
import { parseDuration, humanizeDuration } from '../lib/duration.js';
import { isModerator } from '../lib/moderation.js';

const HANGMAN_WORDS = ['workshop', 'discord', 'clanker', 'turbine', 'server', 'mechanic', 'neon'];
const SCRAMBLE_WORDS = ['raspberry', 'robot', 'keyboard', 'galaxy', 'circuit', 'adventure', 'volcano', 'spaceship', 'diamond', 'sandwich'];
const RPS_MOVES = ['rock', 'paper', 'scissors'];
const SLOT_SYMBOLS = ['⚙️', '🔩', '💎', '⭐', '🍒'];
const TRIVIA_QUESTIONS = [
  { question: 'Which planet is known as the Red Planet?', choices: ['Venus', 'Mars', 'Jupiter', 'Mercury'], answer: 1, fact: 'Iron minerals in Martian soil give Mars its red appearance.' },
  { question: 'What is the largest ocean on Earth?', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3, fact: 'The Pacific is larger than all of Earth’s land area combined.' },
  { question: 'How many bits make one byte?', choices: ['4', '8', '16', '32'], answer: 1, fact: 'A standard byte contains 8 bits.' },
  { question: 'Which gas do plants absorb during photosynthesis?', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], answer: 2, fact: 'Plants use carbon dioxide, water, and light to produce sugars.' },
  { question: 'Who painted the Mona Lisa?', choices: ['Michelangelo', 'Leonardo da Vinci', 'Claude Monet', 'Vincent van Gogh'], answer: 1, fact: 'Leonardo da Vinci painted it during the Italian Renaissance.' },
  { question: 'What does CPU stand for?', choices: ['Central Processing Unit', 'Computer Power Utility', 'Core Program User', 'Central Pixel Unit'], answer: 0, fact: 'The CPU executes instructions and coordinates a computer’s operations.' },
  { question: 'Which animal is the fastest on land?', choices: ['Lion', 'Pronghorn', 'Cheetah', 'Horse'], answer: 2, fact: 'Cheetahs can briefly reach speeds above 90 km/h.' },
  { question: 'What is the capital of Japan?', choices: ['Kyoto', 'Osaka', 'Tokyo', 'Sapporo'], answer: 2, fact: 'Tokyo is Japan’s capital and largest metropolitan area.' },
  { question: 'Which instrument usually has 88 keys?', choices: ['Violin', 'Piano', 'Flute', 'Trumpet'], answer: 1, fact: 'A standard modern piano has 52 white and 36 black keys.' },
  { question: 'What is H2O commonly called?', choices: ['Salt', 'Hydrogen', 'Water', 'Oxygen'], answer: 2, fact: 'Each water molecule contains two hydrogen atoms and one oxygen atom.' }
];

export function rpsOutcome(player, bot) {
  if (player === bot) return 'draw';
  return (player === 'rock' && bot === 'scissors')
    || (player === 'paper' && bot === 'rock')
    || (player === 'scissors' && bot === 'paper') ? 'win' : 'lose';
}

export function scrambleWord(word, random = Math.random) {
  const letters = [...word];
  for (let index = letters.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [letters[index], letters[swap]] = [letters[swap], letters[index]];
  }
  const scrambled = letters.join('');
  return scrambled === word ? `${word.slice(1)}${word[0]}` : scrambled;
}

export function drawSlots(random = Math.random) {
  return Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(random() * SLOT_SYMBOLS.length)]);
}

export function slotOutcome(symbols) {
  const unique = new Set(symbols).size;
  if (unique === 1) return 'jackpot';
  if (unique === 2) return 'pair';
  return 'miss';
}

function privatePayload(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function maskWord(word, guesses) {
  return [...word].map((letter) => guesses.has(letter) ? letter.toUpperCase() : '＿').join(' ');
}

export class CommunityFeatures {
  constructor({ client, projectRoot, config }) {
    this.client = client;
    this.projectRoot = projectRoot;
    this.config = config;
    this.economyConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'config', 'economy.json'), 'utf8'));
    this.integrations = JSON.parse(fs.readFileSync(path.join(projectRoot, 'config', 'integrations.json'), 'utf8'));
    this.birthdays = new JsonStore(path.join(projectRoot, 'data', 'birthdays.json'), {});
    this.quotes = new JsonStore(path.join(projectRoot, 'data', 'quotes.json'), { items: [] });
    this.economy = new JsonStore(path.join(projectRoot, 'data', 'economy.json'), {});
    this.customCommands = new JsonStore(path.join(projectRoot, 'data', 'custom-commands.json'), {});
    this.characters = new JsonStore(path.join(projectRoot, 'data', 'characters.json'), {});
    this.giveaways = new JsonStore(path.join(projectRoot, 'data', 'giveaways.json'), {});
    this.events = new JsonStore(path.join(projectRoot, 'data', 'events.json'), {});
    this.tournaments = new JsonStore(path.join(projectRoot, 'data', 'tournaments.json'), {});
    this.hangman = new Map();
    this.numberGames = new Map();
    this.scrambleGames = new Map();
    this.triviaSessions = new Map();
    this.timer = null;
  }

  async load() {
    await Promise.all([
      this.birthdays.load(), this.quotes.load(), this.economy.load(), this.customCommands.load(),
      this.characters.load(), this.giveaways.load(), this.events.load(), this.tournaments.load()
    ]);
    await this.processTimers();
    this.timer = setInterval(() => this.processTimers().catch(console.error), 30_000);
    this.timer.unref();
  }

  userEconomy(guildId, userId) {
    return this.economy.get(`${guildId}:${userId}`, { coins: 0, lastDaily: 0, lastWork: 0, inventory: [] });
  }

  async setEconomy(guildId, userId, value) {
    await this.economy.set(`${guildId}:${userId}`, value);
  }

  async handleCommand(interaction) {
    const name = interaction.commandName;

    if (name === 'birthday') {
      const subcommand = interaction.options.getSubcommand();
      const key = `${interaction.guildId}:${interaction.user.id}`;
      if (subcommand === 'set') {
        const month = interaction.options.getInteger('month', true);
        const day = interaction.options.getInteger('day', true);
        const testDate = new Date(Date.UTC(2024, month - 1, day));
        if (testDate.getUTCMonth() !== month - 1 || testDate.getUTCDate() !== day) {
          await interaction.reply(privatePayload({ content: '🎂 That is not a real calendar date.' }));
          return true;
        }
        await this.birthdays.set(key, { guildId: interaction.guildId, userId: interaction.user.id, month, day, lastYear: 0 });
        await interaction.reply(privatePayload({ content: `🎂 Birthday saved for **${month}/${day}**. I’ll make an appropriately loud announcement.` }));
        return true;
      }
      if (subcommand === 'remove') {
        await this.birthdays.delete(key);
        await interaction.reply(privatePayload({ content: '🗑️ Birthday removed.' }));
        return true;
      }
      const entries = Object.values(this.birthdays.data).filter((entry) => entry.guildId === interaction.guildId);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(this.config.color).setTitle('🎂 Birthday board').setDescription(
          entries.length ? entries.map((entry) => `<@${entry.userId}> — **${entry.month}/${entry.day}**`).join('\n') : 'No birthdays saved yet.'
        )]
      });
      return true;
    }

    if (name === 'quote') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'add') {
        const text = interaction.options.getString('text', true);
        const items = this.quotes.get('items', []);
        items.push({ id: randomUUID(), text, authorId: interaction.user.id, guildId: interaction.guildId, at: Date.now() });
        await this.quotes.set('items', items);
        await interaction.reply(privatePayload({ content: `📌 Quote #${items.length} bolted into the archive.` }));
        return true;
      }
      if (subcommand === 'random') {
        const items = this.quotes.get('items', []).filter((item) => item.guildId === interaction.guildId);
        const item = items[Math.floor(Math.random() * items.length)];
        await interaction.reply(item ? `💬 “${item.text}” — <@${item.authorId}>` : 'The quote archive is empty.');
        return true;
      }
      const confession = interaction.options.getString('text', true);
      const channelId = process.env.CONFESSION_CHANNEL_ID;
      const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply(privatePayload({ content: '❌ The confession channel is not configured correctly.' }));
        return true;
      }
      const embed = new EmbedBuilder().setColor(this.config.color).setTitle('🎭 Anonymous confession').setDescription(confession).setTimestamp();
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      await interaction.reply(privatePayload({ content: '🎭 Confession posted anonymously. Your identity was not stored with it.' }));
      return true;
    }

    if (name === 'economy') {
      const subcommand = interaction.options.getSubcommand();
      const target = interaction.options.getUser('member') ?? interaction.user;
      const state = this.userEconomy(interaction.guildId, target.id);
      const currency = this.economyConfig.currencyName;

      if (subcommand === 'balance') {
        await interaction.reply(`🪙 **${target.displayName}** has **${state.coins} ${currency}**.`);
        return true;
      }
      if (subcommand === 'daily') {
        const remaining = 86_400_000 - (Date.now() - state.lastDaily);
        if (remaining > 0) {
          await interaction.reply(privatePayload({ content: `⏳ Daily already claimed. Come back in ${humanizeDuration(remaining)}.` }));
          return true;
        }
        state.coins += this.economyConfig.dailyReward;
        state.lastDaily = Date.now();
        await this.setEconomy(interaction.guildId, interaction.user.id, state);
        await interaction.reply(`🪙 ${interaction.user} collected **${this.economyConfig.dailyReward} ${currency}**.`);
        return true;
      }
      if (subcommand === 'work') {
        const remaining = 3_600_000 - (Date.now() - state.lastWork);
        if (remaining > 0) {
          await interaction.reply(privatePayload({ content: `🔧 Your shift cooldown has ${humanizeDuration(remaining)} left.` }));
          return true;
        }
        const earned = this.economyConfig.workMinimum + Math.floor(Math.random() * (this.economyConfig.workMaximum - this.economyConfig.workMinimum + 1));
        state.coins += earned;
        state.lastWork = Date.now();
        await this.setEconomy(interaction.guildId, interaction.user.id, state);
        await interaction.reply(`🔧 ${interaction.user} tightened suspicious bolts for an hour and earned **${earned} ${currency}**.`);
        return true;
      }
      if (subcommand === 'pay') {
        const recipient = interaction.options.getUser('member', true);
        const amount = interaction.options.getInteger('amount', true);
        if (recipient.bot || recipient.id === interaction.user.id || amount <= 0 || state.coins < amount) {
          await interaction.reply(privatePayload({ content: '❌ Invalid recipient, amount, or insufficient balance.' }));
          return true;
        }
        const recipientState = this.userEconomy(interaction.guildId, recipient.id);
        state.coins -= amount;
        recipientState.coins += amount;
        await this.setEconomy(interaction.guildId, interaction.user.id, state);
        await this.setEconomy(interaction.guildId, recipient.id, recipientState);
        await interaction.reply(`🪙 ${interaction.user} paid ${recipient} **${amount} ${currency}**.`);
        return true;
      }
      if (subcommand === 'shop') {
        const lines = this.economyConfig.shop.map((item) => `**${item.id}** — ${item.price} ${currency}\n${item.description}`);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle('🛒 Clanker shop').setDescription(lines.join('\n\n') || 'Shop empty.')] });
        return true;
      }
      if (subcommand === 'buy') {
        const itemId = interaction.options.getString('item', true);
        const item = this.economyConfig.shop.find((entry) => entry.id === itemId);
        if (!item || state.coins < item.price) {
          await interaction.reply(privatePayload({ content: '❌ Unknown item or insufficient clank-coins.' }));
          return true;
        }
        state.coins -= item.price;
        state.inventory.push(item.id);
        await this.setEconomy(interaction.guildId, interaction.user.id, state);
        if (item.roleId) await interaction.member.roles.add(item.roleId).catch(() => {});
        await interaction.reply(`🛒 ${interaction.user} bought **${item.name}**.`);
        return true;
      }
    }

    if (name === 'custom') {
      const subcommand = interaction.options.getSubcommand();
      const guildCommands = this.customCommands.get(interaction.guildId, {});
      if (subcommand === 'add') {
        const trigger = interaction.options.getString('trigger', true).toLowerCase().replace(/^!/, '');
        const response = interaction.options.getString('response', true);
        guildCommands[trigger] = response;
        await this.customCommands.set(interaction.guildId, guildCommands);
        await interaction.reply(privatePayload({ content: `✅ Custom command **!${trigger}** saved.` }));
        return true;
      }
      if (subcommand === 'remove') {
        const trigger = interaction.options.getString('trigger', true).toLowerCase().replace(/^!/, '');
        delete guildCommands[trigger];
        await this.customCommands.set(interaction.guildId, guildCommands);
        await interaction.reply(privatePayload({ content: `🗑️ Removed **!${trigger}**.` }));
        return true;
      }
      await interaction.reply(privatePayload({ content: Object.keys(guildCommands).length ? Object.keys(guildCommands).map((key) => `!${key}`).join(', ') : 'No custom commands yet.' }));
      return true;
    }

    if (name === 'character') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'set') {
        const game = interaction.options.getString('game', true);
        const url = interaction.options.getString('url', true);
        await this.characters.set(`${interaction.guildId}:${interaction.user.id}`, { game, url });
        await interaction.reply(privatePayload({ content: `🧙 Character sheet saved for **${game}**.` }));
        return true;
      }
      const target = interaction.options.getUser('member') ?? interaction.user;
      const sheet = this.characters.get(`${interaction.guildId}:${target.id}`);
      await interaction.reply(sheet ? `🧙 **${target.displayName} — ${sheet.game}:** ${sheet.url}` : 'No character sheet saved.');
      return true;
    }

    if (name === 'game') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'hangman') {
        const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
        this.hangman.set(interaction.channelId, { word, guesses: new Set(), misses: 0 });
        await interaction.reply(`🎮 **Hangman started**\n${maskWord(word, new Set())}\nUse \`/game guess\` — 6 wrong guesses allowed.`);
        return true;
      }

      if (subcommand === 'guess') {
        const game = this.hangman.get(interaction.channelId);
        if (!game) {
          await interaction.reply(privatePayload({ content: '🎮 No hangman game is running here.' }));
          return true;
        }
        const guess = interaction.options.getString('letter', true).toLowerCase();
        if (!/^[a-z]$/.test(guess)) {
          await interaction.reply(privatePayload({ content: 'Give me exactly one letter.' }));
          return true;
        }
        const repeated = game.guesses.has(guess);
        game.guesses.add(guess);
        if (!repeated && !game.word.includes(guess)) game.misses += 1;
        const masked = maskWord(game.word, game.guesses);
        const won = !masked.includes('＿');
        const lost = game.misses >= 6;
        if (won || lost) this.hangman.delete(interaction.channelId);
        await interaction.reply(won
          ? `🏆 ${interaction.user} solved it: **${game.word.toUpperCase()}**.`
          : lost
            ? `💀 Machine wins. The word was **${game.word.toUpperCase()}**.`
            : `🎮 ${masked}\nMisses: **${game.misses}/6** · Guessed: ${[...game.guesses].join(', ').toUpperCase()}${repeated ? '\nThat letter was already guessed.' : ''}`
        );
        return true;
      }

      if (subcommand === 'rps') {
        const player = interaction.options.getString('move', true);
        const bot = RPS_MOVES[Math.floor(Math.random() * RPS_MOVES.length)];
        const outcome = rpsOutcome(player, bot);
        const verdict = outcome === 'win' ? 'You win!' : outcome === 'lose' ? 'Hatclanker wins!' : 'Draw!';
        await interaction.reply(`✊ **Rock, paper, scissors**\nYou: **${player}** · Hatclanker: **${bot}**\n**${verdict}**`);
        return true;
      }

      if (subcommand === 'trivia') {
        const item = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
        const token = randomUUID().replaceAll('-', '').slice(0, 12);
        this.triviaSessions.set(token, { ...item, channelId: interaction.channelId, expiresAt: Date.now() + 120_000 });
        const labels = ['A', 'B', 'C', 'D'];
        const row = new ActionRowBuilder().addComponents(item.choices.map((choice, index) => new ButtonBuilder()
          .setCustomId(`trivia:${token}:${index}`)
          .setLabel(`${labels[index]}. ${choice}`.slice(0, 80))
          .setStyle(ButtonStyle.Primary)));
        const embed = new EmbedBuilder()
          .setColor(this.config.color)
          .setTitle('🧠 Quick trivia')
          .setDescription(`**${item.question}**\n\n${item.choices.map((choice, index) => `${labels[index]}. ${choice}`).join('\n')}`)
          .setFooter({ text: 'First answer wins the round · expires in 2 minutes' });
        await interaction.reply({ embeds: [embed], components: [row] });
        return true;
      }

      if (subcommand === 'number-start') {
        const maximum = interaction.options.getInteger('maximum') ?? 100;
        const secret = Math.floor(Math.random() * maximum) + 1;
        this.numberGames.set(interaction.channelId, { secret, maximum, attempts: 0 });
        await interaction.reply(`🔢 I picked a number from **1 to ${maximum}**. Use \`/game number-guess\` to find it.`);
        return true;
      }

      if (subcommand === 'number-guess') {
        const game = this.numberGames.get(interaction.channelId);
        if (!game) {
          await interaction.reply(privatePayload({ content: 'No number game is active here. Start one with `/game number-start`.' }));
          return true;
        }
        const guess = interaction.options.getInteger('number', true);
        if (guess > game.maximum) {
          await interaction.reply(privatePayload({ content: `Stay inside the range **1-${game.maximum}**.` }));
          return true;
        }
        game.attempts += 1;
        if (guess === game.secret) {
          this.numberGames.delete(interaction.channelId);
          await interaction.reply(`🏆 ${interaction.user} found **${game.secret}** in **${game.attempts}** attempt(s)!`);
        } else {
          await interaction.reply(`${interaction.user} guessed **${guess}** — go **${guess < game.secret ? 'higher' : 'lower'}**. Attempt **${game.attempts}**.`);
        }
        return true;
      }

      if (subcommand === 'scramble') {
        const word = SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)];
        this.scrambleGames.set(interaction.channelId, { word, attempts: 0 });
        await interaction.reply(`🔀 Unscramble this word: **${scrambleWord(word).toUpperCase()}**\nAnswer with \`/game solve\`.`);
        return true;
      }

      if (subcommand === 'solve') {
        const game = this.scrambleGames.get(interaction.channelId);
        if (!game) {
          await interaction.reply(privatePayload({ content: 'No word scramble is active here. Start one with `/game scramble`.' }));
          return true;
        }
        const answer = interaction.options.getString('word', true).trim().toLowerCase();
        game.attempts += 1;
        if (answer === game.word) {
          this.scrambleGames.delete(interaction.channelId);
          await interaction.reply(`🏆 ${interaction.user} solved **${game.word.toUpperCase()}** in **${game.attempts}** attempt(s)!`);
        } else {
          await interaction.reply(`${interaction.user}, that is not it. Try again.`);
        }
        return true;
      }

      if (subcommand === 'slots') {
        const symbols = drawSlots();
        const outcome = slotOutcome(symbols);
        const result = outcome === 'jackpot' ? '**JACKPOT!**' : outcome === 'pair' ? '**Nice pair!**' : 'No match—spin again.';
        await interaction.reply(`🎰 ┃ ${symbols.join(' ┃ ')} ┃\n${result}\n*Just for fun—no coins or real money.*`);
        return true;
      }
    }

    if (name === 'giveaway') {
      const durationText = interaction.options.getString('duration', true);
      const duration = parseDuration(durationText);
      if (!duration) {
        await interaction.reply(privatePayload({ content: '🎁 Use a duration like `30m`, `2h`, or `3d`.' }));
        return true;
      }
      const prize = interaction.options.getString('prize', true);
      const id = randomUUID();
      const endAt = Date.now() + duration;
      const button = new ButtonBuilder().setCustomId(`giveaway:enter:${id}`).setLabel('Enter giveaway').setEmoji('🎉').setStyle(ButtonStyle.Success);
      const embed = new EmbedBuilder().setColor(this.config.color).setTitle(`🎁 ${prize}`).setDescription(`Ends <t:${Math.floor(endAt / 1000)}:R>\nEntries: **0**`).setFooter({ text: `Hosted by ${interaction.user.username}` });
      await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
      const message = await interaction.fetchReply();
      await this.giveaways.set(id, { id, guildId: interaction.guildId, channelId: interaction.channelId, messageId: message.id, prize, hostId: interaction.user.id, endAt, entries: [], ended: false });
      return true;
    }

    if (name === 'event') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'create') {
        const duration = parseDuration(interaction.options.getString('in', true));
        if (!duration) {
          await interaction.reply(privatePayload({ content: '📅 Use a time like `30m`, `2h`, or `3d`.' }));
          return true;
        }
        const id = randomUUID();
        const title = interaction.options.getString('title', true);
        const details = interaction.options.getString('details') ?? 'No extra details.';
        const startsAt = Date.now() + duration;
        const button = new ButtonBuilder().setCustomId(`event:join:${id}`).setLabel('I’m interested').setEmoji('📅').setStyle(ButtonStyle.Primary);
        const embed = new EmbedBuilder().setColor(this.config.color).setTitle(`📅 ${title}`).setDescription(`${details}\n\nStarts <t:${Math.floor(startsAt / 1000)}:F> (<t:${Math.floor(startsAt / 1000)}:R>)\nInterested: **0**`);
        await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
        const message = await interaction.fetchReply();
        await this.events.set(id, { id, guildId: interaction.guildId, channelId: interaction.channelId, messageId: message.id, title, details, startsAt, attendees: [], announced: false });
        return true;
      }
      const events = Object.values(this.events.data).filter((event) => event.guildId === interaction.guildId && !event.announced);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle('📅 Upcoming events').setDescription(events.length ? events.map((event) => `**${event.title}** — <t:${Math.floor(event.startsAt / 1000)}:R>`).join('\n') : 'No upcoming events.')] });
      return true;
    }

    if (name === 'ticket') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'open') {
        const categoryId = process.env.TICKET_CATEGORY_ID || null;
        const existing = interaction.guild.channels.cache.find((channel) => channel.topic === `hatclanker-ticket:${interaction.user.id}`);
        if (existing) {
          await interaction.reply(privatePayload({ content: `🎫 You already have ${existing}.` }));
          return true;
        }
        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90),
          type: ChannelType.GuildText,
          parent: categoryId,
          topic: `hatclanker-ticket:${interaction.user.id}`,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
          ]
        });
        await channel.send(`🎫 ${interaction.user}, your private support ticket is open. Explain what happened and staff will join you.`);
        await interaction.reply(privatePayload({ content: `✅ Ticket created: ${channel}` }));
        return true;
      }
      if (!interaction.channel.topic?.startsWith('hatclanker-ticket:')) {
        await interaction.reply(privatePayload({ content: 'This is not a Hatclanker ticket channel.' }));
        return true;
      }
      const ownerId = interaction.channel.topic.split(':')[1];
      if (interaction.user.id !== ownerId && !isModerator(interaction.member)) {
        await interaction.reply(privatePayload({ content: 'Only the ticket owner or a moderator can close this.' }));
        return true;
      }
      await interaction.reply('🔒 Ticket closing in 5 seconds. Save anything important.');
      setTimeout(() => interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(console.error), 5_000);
      return true;
    }

    if (name === 'apply') {
      const modal = new ModalBuilder().setCustomId('application:submit').setTitle('Server application');
      const about = new TextInputBuilder().setCustomId('about').setLabel('Tell us about yourself').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
      const reason = new TextInputBuilder().setCustomId('reason').setLabel('Why are you applying?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
      modal.addComponents(new ActionRowBuilder().addComponents(about), new ActionRowBuilder().addComponents(reason));
      await interaction.showModal(modal);
      return true;
    }

    if (name === 'tournament') {
      const subcommand = interaction.options.getSubcommand();
      const key = interaction.guildId;
      if (subcommand === 'create') {
        const teams = interaction.options.getString('teams', true).split('|').map((team) => team.trim()).filter(Boolean);
        if (teams.length < 2 || teams.length > 32 || new Set(teams.map((team) => team.toLowerCase())).size !== teams.length) {
          await interaction.reply(privatePayload({ content: '🏆 Provide 2–32 unique teams separated with `|`.' }));
          return true;
        }
        const shuffled = teams.sort(() => Math.random() - 0.5);
        await this.tournaments.set(key, { name: interaction.options.getString('name', true), remaining: shuffled, eliminated: [], champion: null });
        await interaction.reply({ embeds: [this.tournamentEmbed(this.tournaments.get(key))] });
        return true;
      }
      const tournament = this.tournaments.get(key);
      if (!tournament) {
        await interaction.reply(privatePayload({ content: 'No active tournament.' }));
        return true;
      }
      if (subcommand === 'eliminate') {
        const team = interaction.options.getString('team', true);
        const actual = tournament.remaining.find((entry) => entry.toLowerCase() === team.toLowerCase());
        if (!actual || tournament.remaining.length <= 1) {
          await interaction.reply(privatePayload({ content: 'That team is not active, or the tournament already has a winner.' }));
          return true;
        }
        tournament.remaining = tournament.remaining.filter((entry) => entry !== actual);
        tournament.eliminated.push(actual);
        if (tournament.remaining.length === 1) tournament.champion = tournament.remaining[0];
        await this.tournaments.set(key, tournament);
      }
      await interaction.reply({ embeds: [this.tournamentEmbed(tournament)] });
      return true;
    }

    if (name === 'support-links') {
      const links = this.integrations.paymentLinks;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle('💳 Support the server').setDescription(links.length ? links.map((item) => `**${item.label}:** ${item.url}`).join('\n') : 'No payment or membership links have been configured.')] });
      return true;
    }

    return false;
  }

  tournamentEmbed(tournament) {
    const pairs = [];
    for (let index = 0; index < tournament.remaining.length; index += 2) {
      pairs.push(`${tournament.remaining[index]} **vs** ${tournament.remaining[index + 1] ?? 'BYE'}`);
    }
    return new EmbedBuilder()
      .setColor(this.config.color)
      .setTitle(`🏆 ${tournament.name}`)
      .setDescription(tournament.champion ? `Champion: **${tournament.champion}** 🎉` : pairs.join('\n'))
      .addFields({ name: 'Eliminated', value: tournament.eliminated.join(', ') || 'Nobody yet' });
  }

  async handleInteraction(interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('trivia:')) {
      const [, token, answerText] = interaction.customId.split(':');
      const session = this.triviaSessions.get(token);
      if (!session || session.expiresAt <= Date.now()) {
        this.triviaSessions.delete(token);
        await interaction.reply(privatePayload({ content: 'That trivia round expired. Start another with `/game trivia`.' }));
        return true;
      }
      if (session.channelId !== interaction.channelId) {
        await interaction.reply(privatePayload({ content: 'That trivia button belongs to another channel.' }));
        return true;
      }
      this.triviaSessions.delete(token);
      const answer = Number.parseInt(answerText, 10);
      const correct = answer === session.answer;
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(correct ? 0x22c55e : 0xef4444)
        .addFields({
          name: correct ? 'Correct!' : 'Not quite',
          value: `${interaction.user} chose **${session.choices[answer]}**. The answer is **${session.choices[session.answer]}**.\n${session.fact}`
        })
        .setFooter({ text: 'Round complete' });
      await interaction.update({ embeds: [embed], components: [] });
      return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('giveaway:enter:')) {
      const id = interaction.customId.split(':')[2];
      const giveaway = this.giveaways.get(id);
      if (!giveaway || giveaway.ended || giveaway.endAt <= Date.now()) {
        await interaction.reply(privatePayload({ content: 'This giveaway has ended.' }));
        return true;
      }
      if (!giveaway.entries.includes(interaction.user.id)) giveaway.entries.push(interaction.user.id);
      await this.giveaways.set(id, giveaway);
      const embed = EmbedBuilder.from(interaction.message.embeds[0]).setDescription(`Ends <t:${Math.floor(giveaway.endAt / 1000)}:R>\nEntries: **${giveaway.entries.length}**`);
      await interaction.update({ embeds: [embed] });
      await interaction.followUp(privatePayload({ content: '🎉 You’re entered.' }));
      return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('event:join:')) {
      const id = interaction.customId.split(':')[2];
      const event = this.events.get(id);
      if (!event || event.announced) {
        await interaction.reply(privatePayload({ content: 'That event is no longer open.' }));
        return true;
      }
      if (!event.attendees.includes(interaction.user.id)) event.attendees.push(interaction.user.id);
      await this.events.set(id, event);
      const embed = EmbedBuilder.from(interaction.message.embeds[0]).setDescription(`${event.details}\n\nStarts <t:${Math.floor(event.startsAt / 1000)}:F> (<t:${Math.floor(event.startsAt / 1000)}:R>)\nInterested: **${event.attendees.length}**`);
      await interaction.update({ embeds: [embed] });
      await interaction.followUp(privatePayload({ content: '📅 You’re on the event list.' }));
      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'application:submit') {
      const channelId = process.env.APPLICATION_CHANNEL_ID;
      const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
      if (!channel?.isTextBased()) {
        await interaction.reply(privatePayload({ content: 'Applications are not configured yet. Ask staff to set `APPLICATION_CHANNEL_ID`.' }));
        return true;
      }
      const embed = new EmbedBuilder()
        .setColor(this.config.color)
        .setTitle('📋 New application')
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .addFields(
          { name: 'About', value: interaction.fields.getTextInputValue('about') },
          { name: 'Reason', value: interaction.fields.getTextInputValue('reason') },
          { name: 'Applicant', value: `${interaction.user} (${interaction.user.id})` }
        )
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`application:accept:${interaction.user.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`application:reject:${interaction.user.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
      );
      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply(privatePayload({ content: '✅ Application sent to the review board.' }));
      return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('application:')) {
      if (!isModerator(interaction.member)) {
        await interaction.reply(privatePayload({ content: 'Moderator permission required.' }));
        return true;
      }
      const [, decision, userId] = interaction.customId.split(':');
      const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(decision === 'accept' ? 0x22c55e : 0xef4444).setFooter({ text: `${decision.toUpperCase()} by ${interaction.user.tag}` });
      await interaction.update({ embeds: [embed], components: [] });
      const user = await this.client.users.fetch(userId).catch(() => null);
      await user?.send(`📋 Your application to **${interaction.guild.name}** was **${decision}ed**.`).catch(() => {});
      return true;
    }

    return false;
  }

  async handleMessage(message) {
    if (!message.inGuild() || message.author.bot || !message.content.startsWith('!')) return false;
    const trigger = message.content.slice(1).trim().split(/\s+/)[0].toLowerCase();
    const response = this.customCommands.get(message.guildId, {})[trigger];
    if (!response) return false;
    await message.reply({ content: response, allowedMentions: { parse: [] } });
    return true;
  }

  async processTimers(now = Date.now()) {
    for (const giveaway of Object.values(this.giveaways.data)) {
      if (giveaway.ended || giveaway.endAt > now) continue;
      giveaway.ended = true;
      await this.giveaways.set(giveaway.id, giveaway);
      const channel = await this.client.channels.fetch(giveaway.channelId).catch(() => null);
      if (!channel?.isTextBased()) continue;
      const winner = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];
      await channel.send(winner ? `🎉 <@${winner}> won **${giveaway.prize}**!` : `🎁 Giveaway for **${giveaway.prize}** ended with no entries.`);
      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (message) await message.edit({ components: [] }).catch(() => {});
    }

    for (const event of Object.values(this.events.data)) {
      if (event.announced || event.startsAt > now) continue;
      event.announced = true;
      await this.events.set(event.id, event);
      const channel = await this.client.channels.fetch(event.channelId).catch(() => null);
      if (channel?.isTextBased()) {
        await channel.send(`📅 **${event.title} starts now!** ${event.attendees.map((id) => `<@${id}>`).join(' ')}`.slice(0, 1900));
      }
    }

    const today = new Date(now);
    const month = today.getUTCMonth() + 1;
    const day = today.getUTCDate();
    const year = today.getUTCFullYear();
    const birthdayChannelId = process.env.BIRTHDAY_CHANNEL_ID;
    if (birthdayChannelId) {
      for (const [key, birthday] of Object.entries(this.birthdays.data)) {
        if (birthday.month !== month || birthday.day !== day || birthday.lastYear === year) continue;
        const channel = await this.client.channels.fetch(birthdayChannelId).catch(() => null);
        if (channel?.isTextBased()) await channel.send(`🎂 HAPPY BIRTHDAY <@${birthday.userId}>! The server demands cake and unreasonable amounts of noise.`);
        birthday.lastYear = year;
        await this.birthdays.set(key, birthday);
      }
    }
  }
}
