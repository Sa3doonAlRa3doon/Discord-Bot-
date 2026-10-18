import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';
import { evaluate, simplify, derivative } from 'mathjs';
import nerdamer from 'nerdamer';
import { JsonStore } from '../lib/json-store.js';
import { cleanText } from '../lib/clean-language.js';

const WRITING_PROMPTS = [
  'Write a scene where a machine remembers something its creator forgot.',
  'A locked door opens only when someone tells it an honest secret.',
  'Describe a city during the ten minutes when gravity takes a break.',
  'Two rivals must share one spacesuit to survive.',
  'Write a mystery in which the missing object is a sound.',
  'A tiny repair bot discovers it has been fixing the wrong universe.',
  'Begin with: “The map changed while I was looking at it.”',
  'Tell a story using only messages left on a broken answering machine.',
  'A student receives tomorrow’s exam answers, but every answer is a question.',
  'Write about a library where books choose their readers.'
];

const cleanKey = (value) => value.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, '').slice(0, 50);
const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
const privatePayload = (payload) => ({ ...payload, flags: MessageFlags.Ephemeral });

export function updateHabitCheck(habit, today = dayKey()) {
  if (habit.lastCheck === today) return { ...habit, alreadyChecked: true };
  const previous = new Date(`${today}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const continued = habit.lastCheck === dayKey(previous);
  return { ...habit, lastCheck: today, streak: continued ? (habit.streak || 0) + 1 : 1, alreadyChecked: false };
}

export function solveMath(expression, mode = 'evaluate', variable = 'x') {
  if (expression.length > 500) throw new Error('Expression is too long.');
  if (!/^[0-9a-zA-Z_+\-*/^()., \[\]]+$/.test(expression)) throw new Error('Unsupported characters in expression.');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) throw new Error('Invalid calculus variable.');
  const allowedNames = new Set(['x', 'y', 'z', 'pi', 'e', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'log', 'ln', 'abs', 'exp', 'min', 'max', 'round', 'floor', 'ceil']);
  allowedNames.add(variable.toLowerCase());
  const names = expression.match(/[a-zA-Z_]+/g) || [];
  if (names.some((name) => !allowedNames.has(name.toLowerCase()))) throw new Error('Unsupported variable or function name.');
  if (mode === 'simplify') return simplify(expression).toString();
  if (mode === 'derivative') return derivative(expression, variable).toString();
  if (mode === 'integral') return nerdamer.integrate(expression, variable).toString();
  const result = evaluate(expression);
  return typeof result === 'object' ? result.toString() : String(result);
}

function formatRemaining(timestamp) {
  const seconds = Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { 'user-agent': 'Hatclanker/4.0 (Discord server assistant)', ...init.headers }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

export class ProductivityFeatures {
  constructor({ client, projectRoot, config, moderation }) {
    this.client = client;
    this.config = config;
    this.moderation = moderation;
    this.flashcards = new JsonStore(path.join(projectRoot, 'data', 'flashcards.json'), {});
    this.habits = new JsonStore(path.join(projectRoot, 'data', 'habits.json'), {});
    this.stories = new JsonStore(path.join(projectRoot, 'data', 'stories.json'), {});
    this.scheduler = new JsonStore(path.join(projectRoot, 'data', 'productivity-scheduler.json'), {});
    this.pomodoros = new Map();
    this.flashcardSessions = new Map();
    this.timer = null;
  }

  async load() {
    await Promise.all([this.flashcards.load(), this.habits.load(), this.stories.load(), this.scheduler.load()]);
    await this.runScheduledWork();
    this.timer = setInterval(() => this.runScheduledWork().catch(console.error), 60_000);
    this.timer.unref();
  }

  async runScheduledWork() {
    const channelId = process.env.WRITING_PROMPT_CHANNEL_ID;
    const hour = Number(process.env.WRITING_PROMPT_HOUR ?? 8);
    const today = dayKey();
    if (channelId && new Date().getHours() >= hour && this.scheduler.get('lastWritingPrompt') !== today) {
      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased()) {
        const index = Math.abs([...today].reduce((total, char) => total + char.charCodeAt(0), 0)) % WRITING_PROMPTS.length;
        await channel.send(`✍️ **Daily writing prompt**\n${WRITING_PROMPTS[index]}`);
        await this.scheduler.set('lastWritingPrompt', today);
      }
    }
    await this.pollCalendar();
  }

  async pollCalendar() {
    const endpoint = process.env.GOOGLE_CALENDAR_BRIDGE_URL;
    const channelId = process.env.CALENDAR_CHANNEL_ID;
    if (!endpoint || !channelId) return;
    const now = Date.now();
    const lastPoll = this.scheduler.get('calendarLastPoll', 0);
    if (now - lastPoll < 5 * 60_000) return;
    await this.scheduler.set('calendarLastPoll', now);
    const joiner = endpoint.includes('?') ? '&' : '?';
    const result = await jsonRequest(`${endpoint}${joiner}since=${encodeURIComponent(new Date(lastPoll || now - 300_000).toISOString())}`).catch(() => null);
    const events = Array.isArray(result?.events) ? result.events : [];
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    for (const event of events.slice(0, 10)) {
      if (channel?.isTextBased()) await channel.send(`📅 **Calendar update:** ${event.title || 'Untitled event'}\n${event.start || ''}`.trim());
    }
  }

  schedulePomodoro(channel, session) {
    const minutes = session.phase === 'focus' ? session.focus : session.break;
    session.endsAt = Date.now() + minutes * 60_000;
    session.timer = setTimeout(async () => {
      if (!this.pomodoros.has(channel.id)) return;
      if (session.phase === 'focus') {
        session.phase = 'break';
        await channel.send(`🔔 Focus block complete. Take a **${session.break}-minute break**. ${[...session.members].map((id) => `<@${id}>`).join(' ')}`);
        this.schedulePomodoro(channel, session);
      } else {
        session.cycle += 1;
        if (session.cycle > session.cycles) {
          this.pomodoros.delete(channel.id);
          await channel.send('🏁 Shared Pomodoro complete. Excellent work, crew.');
          return;
        }
        session.phase = 'focus';
        await channel.send(`🎯 Break over. Focus cycle **${session.cycle}/${session.cycles}** starts now.`);
        this.schedulePomodoro(channel, session);
      }
    }, minutes * 60_000);
    session.timer.unref();
  }

  async handleCommand(interaction) {
    const name = interaction.commandName;
    if (name === 'pomodoro') {
      const sub = interaction.options.getSubcommand();
      let session = this.pomodoros.get(interaction.channelId);
      if (sub === 'start') {
        if (session) return interaction.reply(privatePayload({ content: '⏱️ A Pomodoro is already running here.' }));
        session = {
          focus: interaction.options.getInteger('focus') ?? 25,
          break: interaction.options.getInteger('break') ?? 5,
          cycles: interaction.options.getInteger('cycles') ?? 4,
          cycle: 1,
          phase: 'focus',
          ownerId: interaction.user.id,
          members: new Set([interaction.user.id])
        };
        this.pomodoros.set(interaction.channelId, session);
        this.schedulePomodoro(interaction.channel, session);
        await interaction.reply(`🎯 **Shared Pomodoro started** — ${session.focus}m focus / ${session.break}m break × ${session.cycles}. Use \`/pomodoro join\` to join.`);
        return true;
      }
      if (!session) {
        await interaction.reply(privatePayload({ content: '⏱️ No Pomodoro is active in this channel.' }));
        return true;
      }
      if (sub === 'join') {
        session.members.add(interaction.user.id);
        await interaction.reply(`✅ ${interaction.user} joined this focus room. **${session.members.size}** participant(s).`);
      } else if (sub === 'status') {
        await interaction.reply(privatePayload({ content: `⏱️ **${session.phase}** • cycle ${session.cycle}/${session.cycles} • ${formatRemaining(session.endsAt)} left • ${session.members.size} participant(s)` }));
      } else {
        if (session.ownerId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply(privatePayload({ content: 'Only the starter or a moderator can stop this timer.' }));
        } else {
          clearTimeout(session.timer);
          this.pomodoros.delete(interaction.channelId);
          await interaction.reply('🛑 Shared Pomodoro stopped.');
        }
      }
      return true;
    }

    if (name === 'flashcard') {
      const sub = interaction.options.getSubcommand();
      const guildDecks = this.flashcards.get(interaction.guildId, {});
      if (sub === 'list') {
        const list = Object.entries(guildDecks).map(([key, deck]) => `• **${deck.name || key}** — ${deck.cards.length} card(s)`).join('\n');
        await interaction.reply(privatePayload({ content: list || 'No decks yet. Use `/flashcard create`.' }));
        return true;
      }
      const deckName = interaction.options.getString('deck', true);
      const key = cleanKey(deckName);
      if (!key) {
        await interaction.reply(privatePayload({ content: 'Use letters, numbers, spaces, `_`, or `-` in deck names.' }));
        return true;
      }
      if (sub === 'create') {
        if (guildDecks[key]) await interaction.reply(privatePayload({ content: 'That deck already exists.' }));
        else {
          guildDecks[key] = { name: deckName.trim(), cards: [], createdBy: interaction.user.id };
          await this.flashcards.set(interaction.guildId, guildDecks);
          await interaction.reply(`📚 Created **${deckName.trim()}**.`);
        }
        return true;
      }
      const deck = guildDecks[key];
      if (!deck) {
        await interaction.reply(privatePayload({ content: 'Deck not found. Use `/flashcard list`.' }));
        return true;
      }
      if (sub === 'add') {
        deck.cards.push({ id: randomUUID(), question: interaction.options.getString('question', true), answer: interaction.options.getString('answer', true) });
        await this.flashcards.set(interaction.guildId, guildDecks);
        await interaction.reply(privatePayload({ content: `✅ Card added to **${deck.name}** (${deck.cards.length} total).` }));
        return true;
      }
      if (!deck.cards.length) {
        await interaction.reply(privatePayload({ content: 'That deck is empty.' }));
        return true;
      }
      const card = deck.cards[Math.floor(Math.random() * deck.cards.length)];
      const token = randomUUID().slice(0, 12);
      this.flashcardSessions.set(token, { card, ownerId: interaction.user.id, expires: Date.now() + 10 * 60_000 });
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(this.config.color).setTitle(`📚 ${deck.name}`).setDescription(card.question).setFooter({ text: 'Think first, then reveal the answer.' })],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`flashcard:reveal:${token}`).setLabel('Reveal answer').setStyle(ButtonStyle.Primary))]
      });
      return true;
    }

    if (name === 'calendar') {
      const endpoint = process.env.GOOGLE_CALENDAR_BRIDGE_URL;
      const sub = interaction.options.getSubcommand();
      if (sub === 'status') {
        await interaction.reply(privatePayload({ content: endpoint ? '✅ Google Calendar bridge is configured; inbound sync checks every five minutes.' : '⚙️ Set `GOOGLE_CALENDAR_BRIDGE_URL` to enable two-way Calendar sync.' }));
        return true;
      }
      if (!endpoint) {
        await interaction.reply(privatePayload({ content: '⚙️ Calendar bridge is not configured yet. See `V4-SETUP.md`.' }));
        return true;
      }
      const start = new Date(interaction.options.getString('start', true));
      if (Number.isNaN(start.getTime())) {
        await interaction.reply(privatePayload({ content: 'Use an ISO date/time such as `2026-10-20T18:00+04:00`.' }));
        return true;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const minutes = interaction.options.getInteger('minutes') ?? 60;
      const payload = {
        action: 'create', guildId: interaction.guildId, requestedBy: interaction.user.id,
        title: interaction.options.getString('title', true), details: interaction.options.getString('details') || '',
        start: start.toISOString(), end: new Date(start.getTime() + minutes * 60_000).toISOString()
      };
      const result = await jsonRequest(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.INTEGRATION_BRIDGE_TOKEN || ''}` }, body: JSON.stringify(payload) });
      await interaction.editReply(`📅 Event created${result.htmlLink ? `: ${result.htmlLink}` : '.'}`);
      return true;
    }

    if (name === 'habit') {
      const sub = interaction.options.getSubcommand();
      const key = `${interaction.guildId}:${interaction.user.id}`;
      const habits = this.habits.get(key, {});
      if (sub === 'status') {
        const content = Object.values(habits).map((habit) => `• **${habit.name}** — ${habit.streak || 0}-day streak${habit.lastCheck === dayKey() ? ' ✅' : ''}`).join('\n');
        await interaction.reply(privatePayload({ content: content || 'No habits yet. Use `/habit add`.' }));
        return true;
      }
      const requested = interaction.options.getString('name', true);
      const habitKey = cleanKey(requested);
      if (sub === 'add') {
        habits[habitKey] = habits[habitKey] || { name: requested.trim(), streak: 0, lastCheck: null };
        await this.habits.set(key, habits);
        await interaction.reply(privatePayload({ content: `🌱 Tracking **${habits[habitKey].name}**.` }));
      } else if (sub === 'remove') {
        if (!habits[habitKey]) await interaction.reply(privatePayload({ content: 'Habit not found.' }));
        else {
          delete habits[habitKey];
          await this.habits.set(key, habits);
          await interaction.reply(privatePayload({ content: `🗑️ Removed **${requested}**.` }));
        }
      } else if (!habits[habitKey]) {
        await interaction.reply(privatePayload({ content: 'Habit not found. Add it first.' }));
      } else {
        const updated = updateHabitCheck(habits[habitKey]);
        habits[habitKey] = updated;
        await this.habits.set(key, habits);
        await interaction.reply(privatePayload({ content: updated.alreadyChecked ? `✅ **${updated.name}** was already checked today.` : `🔥 **${updated.name}** checked in — ${updated.streak}-day streak!` }));
      }
      return true;
    }

    if (name === 'math') {
      try {
        const expression = interaction.options.getString('expression', true);
        const mode = interaction.options.getString('mode') ?? 'evaluate';
        const answer = solveMath(expression, mode, interaction.options.getString('variable') ?? 'x');
        await interaction.reply(`🧮 **${mode}:** \`${expression}\`\n**Result:** \`${String(answer).slice(0, 1800)}\``);
      } catch (error) {
        await interaction.reply(privatePayload({ content: `Could not solve that expression: ${error.message}` }));
      }
      return true;
    }

    if (name === 'dictionary') {
      await interaction.deferReply();
      const word = interaction.options.getString('word', true).trim();
      const encoded = encodeURIComponent(word);
      const [dictionary, related] = await Promise.all([
        jsonRequest(`https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`).catch(() => null),
        jsonRequest(`https://api.datamuse.com/words?rel_syn=${encoded}&max=12`).catch(() => [])
      ]);
      let title = word;
      let definitions = '';
      let source = 'https://dictionaryapi.dev/';
      let synonyms = related.map((item) => item.word);
      if (dictionary?.[0]) {
        const entry = dictionary[0];
        title = entry.word;
        definitions = entry.meanings?.slice(0, 3).map((meaning) => {
          const first = meaning.definitions?.[0];
          return `**${meaning.partOfSpeech || 'word'}** — ${cleanText(first?.definition || 'No definition')}${first?.example ? `\n*Example:* ${cleanText(first.example)}` : ''}`;
        }).join('\n\n');
        synonyms = [...new Set([...entry.meanings?.flatMap((meaning) => meaning.synonyms || []) || [], ...synonyms])].slice(0, 12);
        source = entry.sourceUrls?.[0] || source;
      } else {
        const fallback = await jsonRequest(`https://api.datamuse.com/words?sp=${encoded}&md=d&max=1`);
        const item = fallback[0];
        definitions = item?.defs?.slice(0, 3).map((definition) => {
          const [part, ...rest] = definition.split('\t');
          return `**${part || 'word'}** — ${cleanText(rest.join('\t'))}`;
        }).join('\n\n') || '';
        source = 'https://www.datamuse.com/api/';
      }
      if (!definitions) { await interaction.editReply('No definition found.'); return true; }
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle(`📖 ${cleanText(title)}`).setDescription(definitions).addFields({ name: 'Synonyms', value: cleanText(synonyms.join(', ')) || 'None listed' }).setURL(source)] });
      return true;
    }

    if (name === 'compliment') {
      const member = interaction.options.getUser('member', true);
      const message = interaction.options.getString('message', true);
      if (member.bot || member.id === interaction.user.id) {
        await interaction.reply(privatePayload({ content: 'Choose another human member.' }));
        return true;
      }
      const safeMessage = cleanText(message);
      await member.send(`💛 **Someone from ${interaction.guild.name} sent you an anonymous compliment:**\n${safeMessage}`);
      await this.moderation?.log(interaction.guild, '💛 Anonymous compliment sent', `Sender: <@${interaction.user.id}>\nRecipient: <@${member.id}>\nMessage: ${safeMessage}`);
      await interaction.reply(privatePayload({ content: `💌 Your compliment was delivered anonymously to ${member.displayName}. Staff can audit it only if abuse is reported.` }));
      return true;
    }

    if (name === 'wiki') {
      await interaction.deferReply();
      const topic = interaction.options.getString('topic', true);
      const data = await jsonRequest(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.replace(/ /g, '_'))}`);
      const embed = new EmbedBuilder().setColor(this.config.color).setTitle(`🌐 ${cleanText(data.title)}`).setDescription(cleanText(data.extract || 'No summary available.').slice(0, 3900)).setURL(data.content_urls?.desktop?.page || 'https://wikipedia.org');
      if (data.thumbnail?.source) embed.setThumbnail(data.thumbnail.source);
      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (name === 'writing-prompt') {
      await interaction.reply(`✍️ **Writing prompt**\n${WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)]}`);
      return true;
    }

    if (name === 'story') {
      const sub = interaction.options.getSubcommand();
      const key = `${interaction.guildId}:${interaction.channelId}`;
      if (sub === 'show') {
        await interaction.reply({ content: this.stories.get(key)?.text?.slice(-1900) || 'No story yet. Use `/story continue`.' });
        return true;
      }
      if (sub === 'reset') {
        await this.stories.delete(key);
        await interaction.reply('📕 This channel’s story has been reset.');
        return true;
      }
      await interaction.deferReply();
      const sentence = cleanText(interaction.options.getString('sentence', true));
      const previous = this.stories.get(key, { text: '' });
      const endpoint = `${(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')}/api/generate`;
      const result = await jsonRequest(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'llama3.2:1b', stream: false, prompt: `Continue this cooperative story in 2-4 clean, age-appropriate sentences. Do not repeat the prompt.\n\nStory: ${previous.text.slice(-4000)}\nNew sentence: ${sentence}` })
      });
      const continuation = cleanText(String(result.response || '').trim()).slice(0, 1500);
      const text = `${previous.text}${previous.text ? '\n' : ''}${sentence}\n${continuation}`.slice(-12_000);
      await this.stories.set(key, { text, updatedAt: Date.now() });
      await interaction.editReply(`📖 ${sentence}\n\n${continuation}`);
      return true;
    }

    return false;
  }

  async handleInteraction(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('flashcard:reveal:')) return false;
    const token = interaction.customId.split(':')[2];
    const session = this.flashcardSessions.get(token);
    if (!session || session.expires < Date.now()) {
      await interaction.reply(privatePayload({ content: 'This flashcard expired. Draw another one.' }));
    } else if (session.ownerId !== interaction.user.id) {
      await interaction.reply(privatePayload({ content: 'Draw your own card so you do not spoil this one.' }));
    } else {
      await interaction.reply(privatePayload({ content: `💡 **Answer:** ${session.card.answer}` }));
    }
    return true;
  }
}
