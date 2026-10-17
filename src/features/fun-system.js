import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';
import { JsonStore } from '../lib/json-store.js';
import { cleanText } from '../lib/clean-language.js';

const privatePayload = (payload) => ({ ...payload, flags: MessageFlags.Ephemeral });
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

const FACTS = [
  ['A day on Venus is longer than its year.', 'https://science.nasa.gov/venus/facts/'],
  ['Octopuses have three hearts.', 'https://oceanservice.noaa.gov/facts/octopus.html'],
  ['The first programmable general-purpose electronic digital computer was ENIAC.', 'https://www.si.edu/object/nmah_334741'],
  ['Earth’s atmosphere is about 78 percent nitrogen.', 'https://climate.nasa.gov/news/2914/the-atmosphere-getting-a-handle-on-carbon-dioxide/'],
  ['Lightning can heat surrounding air to roughly five times the Sun’s surface temperature.', 'https://www.weather.gov/safety/lightning-temperature'],
  ['The International Space Station circles Earth about every 90 minutes.', 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/'],
  ['Sharks existed before trees appeared in the fossil record.', 'https://ocean.si.edu/ocean-life/sharks-rays/sharks'],
  ['A group of flamingos is commonly called a flamboyance.', 'https://nationalzoo.si.edu/animals/american-flamingo']
];

const COMPLIMENTS = [
  'you make difficult things look suspiciously easy', 'your ideas have excellent main-character energy',
  'you are the kind of teammate every server needs', 'your attention to detail deserves its own trophy',
  'you bring good energy without even trying'
];
const ROASTS = [
  'your loading screen has a loading screen', 'you would lose a race against a progress bar',
  'your Wi-Fi disconnects out of second-hand embarrassment', 'you bring “works on my machine” energy to breakfast',
  'your keyboard deserves overtime pay'
];

const TAROT = [
  ['The Magician', 'Use the tools already in front of you.'], ['The Star', 'Keep hope, but pair it with one concrete action.'],
  ['The Hermit', 'Quiet reflection may reveal the missing piece.'], ['The Chariot', 'Choose a direction and commit to it.'],
  ['Strength', 'Patience will work better than force today.'], ['Wheel of Fortune', 'Expect a change; stay flexible.']
];

const AKI_QUESTIONS = [
  ['real', 'Is your character a real person?'], ['human', 'Is your character human?'],
  ['hero', 'Is your character usually a hero?'], ['magic', 'Do they use magic?'],
  ['space', 'Are they strongly associated with space?'], ['game', 'Are they best known from a video game?'],
  ['animated', 'Are they mainly animated?'], ['mask', 'Do they often wear a mask or helmet?']
];
const AKI_CHARACTERS = [
  { name: 'Mario', real: false, human: true, hero: true, magic: false, space: false, game: true, animated: true, mask: false },
  { name: 'Sonic the Hedgehog', real: false, human: false, hero: true, magic: false, space: false, game: true, animated: true, mask: false },
  { name: 'Darth Vader', real: false, human: true, hero: false, magic: true, space: true, game: false, animated: false, mask: true },
  { name: 'Spider-Man', real: false, human: true, hero: true, magic: false, space: false, game: false, animated: false, mask: true },
  { name: 'Elsa', real: false, human: true, hero: true, magic: true, space: false, game: false, animated: true, mask: false },
  { name: 'Master Chief', real: false, human: true, hero: true, magic: false, space: true, game: true, animated: true, mask: true },
  { name: 'Pikachu', real: false, human: false, hero: true, magic: true, space: false, game: true, animated: true, mask: false },
  { name: 'Batman', real: false, human: true, hero: true, magic: false, space: false, game: false, animated: false, mask: true },
  { name: 'Neil Armstrong', real: true, human: true, hero: true, magic: false, space: true, game: false, animated: false, mask: true },
  { name: 'Albert Einstein', real: true, human: true, hero: false, magic: false, space: false, game: false, animated: false, mask: false }
];

const WEATHER_CODES = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers', 95: 'Thunderstorm'
};

function seededIndex(seed, length) {
  let hash = 0;
  for (const char of seed) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % length;
}

function parseJsonEnv(name, fallback) {
  try { return JSON.parse(process.env[name] || ''); } catch { return fallback; }
}

async function getJson(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { 'user-agent': 'Hatclanker/4.0 (Discord server assistant)', ...init.headers }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

export function nextCount(expected, content, previousUserId, userId) {
  const value = Number(content.trim());
  if (!Number.isSafeInteger(value) || value !== expected || previousUserId === userId) return { valid: false, count: 0, previousUserId: null };
  return { valid: true, count: value, previousUserId: userId };
}

function petWithDecay(pet) {
  const elapsedHours = Math.max(0, (Date.now() - (pet.updatedAt || Date.now())) / 3_600_000);
  return {
    ...pet,
    hunger: clamp((pet.hunger ?? 80) - elapsedHours * 2),
    happiness: clamp((pet.happiness ?? 80) - elapsedHours),
    cleanliness: clamp((pet.cleanliness ?? 80) - elapsedHours * 1.5),
    updatedAt: Date.now()
  };
}

function petBar(value) {
  const filled = Math.round(value / 10);
  return `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${value}%`;
}

export class FunSystemFeatures {
  constructor({ client, projectRoot, config, moderation, media }) {
    this.client = client;
    this.config = config;
    this.moderation = moderation;
    this.media = media;
    this.settings = new JsonStore(path.join(projectRoot, 'data', 'v4-system.json'), {});
    this.counts = new JsonStore(path.join(projectRoot, 'data', 'counting.json'), {});
    this.pets = new JsonStore(path.join(projectRoot, 'data', 'pets.json'), {});
    this.optIns = new JsonStore(path.join(projectRoot, 'data', 'dm-alerts.json'), {});
    this.starred = new JsonStore(path.join(projectRoot, 'data', 'starboard.json'), {});
    this.akinatorSessions = new Map();
    this.statusTimer = null;
    this.iconTimer = null;
  }

  async load() {
    await Promise.all([this.settings.load(), this.counts.load(), this.pets.load(), this.optIns.load(), this.starred.load()]);
    const messages = parseJsonEnv('BOT_STATUS_MESSAGES', ['/start • server guide', '/pomodoro • focus together', '/pet • shared mascot', '/weather • live forecast']);
    let position = 0;
    if (Array.isArray(messages) && messages.length) {
      this.statusTimer = setInterval(() => {
        this.client.user?.setActivity(String(messages[position++ % messages.length]).slice(0, 128));
      }, Math.max(30, Number(process.env.STATUS_ROTATION_SECONDS || 60)) * 1000);
      this.statusTimer.unref();
    }
    this.iconTimer = setInterval(() => this.rotateGuildIcons().catch(console.error), 60 * 60_000);
    this.iconTimer.unref();
  }

  async rotateGuildIcons() {
    const urls = parseJsonEnv('GUILD_ICON_URLS', []);
    const intervalHours = Math.max(6, Number(process.env.GUILD_ICON_ROTATION_HOURS || 24));
    if (!Array.isArray(urls) || urls.length < 2) return;
    for (const guild of this.client.guilds.cache.values()) {
      const key = `icon:${guild.id}`;
      const state = this.settings.get(key, { index: 0, changedAt: 0 });
      if (Date.now() - state.changedAt < intervalHours * 3_600_000) continue;
      const index = (state.index + 1) % urls.length;
      await guild.setIcon(urls[index], 'Configured seasonal icon rotation').catch(() => null);
      await this.settings.set(key, { index, changedAt: Date.now() });
    }
  }

  async handleCommand(interaction) {
    const name = interaction.commandName;
    if (name === 'pet') {
      const sub = interaction.options.getSubcommand();
      let pet = petWithDecay(this.pets.get(interaction.guildId, { name: 'Clanky', hunger: 80, happiness: 80, cleanliness: 80, updatedAt: Date.now() }));
      if (sub === 'feed') pet.hunger = clamp(pet.hunger + 25);
      if (sub === 'clean') pet.cleanliness = clamp(pet.cleanliness + 30);
      if (sub === 'play') { pet.happiness = clamp(pet.happiness + 25); pet.hunger = clamp(pet.hunger - 5); }
      if (sub === 'name') pet.name = interaction.options.getString('name', true).trim();
      await this.pets.set(interaction.guildId, pet);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle(`🐾 ${pet.name}`).setDescription(`Hunger ${petBar(pet.hunger)}\nHappiness ${petBar(pet.happiness)}\nCleanliness ${petBar(pet.cleanliness)}`).setFooter({ text: sub === 'status' ? 'The server pet misses everyone together.' : `${interaction.user.displayName} used ${sub}.` })] });
      return true;
    }

    if (name === 'fortune') {
      const type = interaction.options.getString('type', true);
      const seed = `${new Date().toISOString().slice(0, 10)}:${interaction.user.id}`;
      if (type === 'tarot') {
        const card = TAROT[seededIndex(seed, TAROT.length)];
        await interaction.reply(`🃏 **${card[0]}** — ${card[1]}\n*For entertainment only.*`);
      } else {
        const sign = interaction.options.getString('sign') || 'mystery sign';
        const readings = ['Finish one small task before chasing the large one.', 'A useful conversation may arrive from an unexpected place.', 'Protect your focus; not every notification deserves you.', 'Try the practical route first, then get creative.', 'Today rewards patience and a clear question.'];
        await interaction.reply(`🔮 **${sign}** — ${readings[seededIndex(`${seed}:${sign}`, readings.length)]}\n*For entertainment only.*`);
      }
      return true;
    }

    if (name === 'akinator') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'stop') {
        this.akinatorSessions.delete(`${interaction.guildId}:${interaction.user.id}`);
        await interaction.reply(privatePayload({ content: '🧞 Guessing round stopped.' }));
        return true;
      }
      const token = randomUUID().slice(0, 10);
      const key = `${interaction.guildId}:${interaction.user.id}`;
      this.akinatorSessions.set(key, { token, index: 0, candidates: [...AKI_CHARACTERS] });
      await interaction.reply({ content: `🧞 Think of a character. **${AKI_QUESTIONS[0][1]}**`, components: this.akiButtons(token) });
      return true;
    }

    if (name === 'urban') {
      await interaction.deferReply();
      const term = interaction.options.getString('term', true);
      const endpoint = process.env.URBAN_DICTIONARY_API_URL || 'https://api.urbandictionary.com/v0/define';
      const joiner = endpoint.includes('?') ? '&' : '?';
      const result = await getJson(`${endpoint}${joiner}term=${encodeURIComponent(term)}`);
      const entry = result.list?.[0];
      if (!entry) await interaction.editReply('No definition found.');
      else await interaction.editReply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle(`🗯️ ${cleanText(entry.word)}`).setDescription(cleanText(String(entry.definition).replace(/[\[\]]/g, '')).slice(0, 3500)).addFields({ name: 'Example', value: cleanText(String(entry.example || 'None').replace(/[\[\]]/g, '')).slice(0, 900) }).setFooter({ text: 'Community-submitted definition; may be inaccurate.' })] });
      return true;
    }

    if (name === 'weather') {
      await interaction.deferReply();
      const city = interaction.options.getString('city', true);
      const geo = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
      const place = geo.results?.[0];
      if (!place) { await interaction.editReply('City not found.'); return true; }
      const params = new URLSearchParams({ latitude: place.latitude, longitude: place.longitude, current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: 'auto', forecast_days: '3' });
      const data = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
      const forecast = data.daily.time.map((date, index) => `**${date}** — ${WEATHER_CODES[data.daily.weather_code[index]] || 'Mixed'} • ${data.daily.temperature_2m_min[index]}–${data.daily.temperature_2m_max[index]}°C • rain ${data.daily.precipitation_probability_max[index]}%`).join('\n');
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle(`🌦️ ${place.name}, ${place.country || ''}`).setDescription(`**Now:** ${WEATHER_CODES[data.current.weather_code] || 'Mixed'}, ${data.current.temperature_2m}°C (feels ${data.current.apparent_temperature}°C)\nHumidity ${data.current.relative_humidity_2m}% • wind ${data.current.wind_speed_10m} km/h\n\n${forecast}`).setFooter({ text: 'Forecast data: Open-Meteo' })] });
      return true;
    }

    if (name === 'flight') {
      const endpoint = process.env.FLIGHT_TRACKING_API_URL;
      if (!endpoint) { await interaction.reply(privatePayload({ content: '✈️ Set `FLIGHT_TRACKING_API_URL` to connect your licensed live-flight provider.' })); return true; }
      await interaction.deferReply();
      const flight = interaction.options.getString('number', true).replace(/[^a-z0-9]/gi, '').toUpperCase();
      const joiner = endpoint.includes('?') ? '&' : '?';
      const data = await getJson(`${endpoint}${joiner}flight=${encodeURIComponent(flight)}`, { headers: process.env.FLIGHT_TRACKING_API_TOKEN ? { authorization: `Bearer ${process.env.FLIGHT_TRACKING_API_TOKEN}` } : {} });
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle(`✈️ ${flight}`).setDescription(`Status: **${data.status || 'Unknown'}**\nRoute: ${data.origin || '?'} → ${data.destination || '?'}\nAltitude: ${data.altitude ?? 'Unknown'}\nSpeed: ${data.speed ?? 'Unknown'}\nUpdated: ${data.updatedAt || 'provider time unavailable'}`)] });
      return true;
    }

    if (name === 'random-fact') {
      const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
      await interaction.reply(`🧠 ${fact[0]}\nSource: <${fact[1]}>`);
      return true;
    }

    if (name === 'spin') {
      const type = interaction.options.getString('type', true);
      const member = interaction.options.getUser('member', true);
      const line = (type === 'roast' ? ROASTS : COMPLIMENTS)[Math.floor(Math.random() * (type === 'roast' ? ROASTS : COMPLIMENTS).length)];
      await interaction.reply(type === 'roast' ? `🔥 ${member}, ${line}.` : `✨ ${member}, ${line}.`);
      return true;
    }

    if (name === 'purge-filter') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const filter = interaction.options.getString('filter', true);
      const messages = await interaction.channel.messages.fetch({ limit: interaction.options.getInteger('scan', true) });
      const member = interaction.options.getUser('member');
      const text = interaction.options.getString('text')?.toLowerCase();
      if (filter === 'user' && !member) { await interaction.editReply('Choose a member for the member filter.'); return true; }
      if (filter === 'text' && !text) { await interaction.editReply('Enter text for the text filter.'); return true; }
      const matches = messages.filter((message) => {
        if (filter === 'user') return message.author.id === member.id;
        if (filter === 'links') return /https?:\/\/\S+/i.test(message.content);
        return message.content.toLowerCase().includes(text);
      });
      const deleted = await interaction.channel.bulkDelete(matches, true);
      await interaction.editReply(`🧹 Deleted **${deleted.size}** matching message(s). Messages older than 14 days are automatically skipped by Discord.`);
      return true;
    }

    if (name === 'channel-clone') {
      const source = interaction.options.getChannel('channel', true);
      if (!('clone' in source)) { await interaction.reply(privatePayload({ content: 'That channel type cannot be cloned.' })); return true; }
      const clone = await source.clone({ name: interaction.options.getString('name') || `${source.name}-copy`, reason: `Cloned by ${interaction.user.tag}` });
      if ('setPosition' in clone) await clone.setPosition(source.position + 1).catch(() => null);
      await interaction.reply(privatePayload({ content: `✅ Cloned ${source} as ${clone}, including topic, settings, and permission overwrites.` }));
      return true;
    }

    if (name === 'system-tools') {
      const sub = interaction.options.getSubcommand();
      const settings = this.settings.get(interaction.guildId, {});
      if (sub === 'counting') {
        settings.countingChannelId = interaction.options.getChannel('channel', true).id;
        await this.counts.set(interaction.guildId, { count: 0, previousUserId: null });
      } else if (sub === 'starboard') {
        settings.starboardChannelId = interaction.options.getChannel('channel', true).id;
        settings.starboardThreshold = interaction.options.getInteger('threshold') ?? 3;
      }
      if (sub !== 'status') await this.settings.set(interaction.guildId, settings);
      await interaction.reply(privatePayload({ content: `⚙️ Counting: ${settings.countingChannelId ? `<#${settings.countingChannelId}>` : 'off'}\nStarboard: ${settings.starboardChannelId ? `<#${settings.starboardChannelId}> at ${settings.starboardThreshold || 3} ⭐` : 'off'}\nStatus rotation: on\nIcon rotation: ${parseJsonEnv('GUILD_ICON_URLS', []).length > 1 ? 'configured' : 'off'}` }));
      return true;
    }

    if (name === 'honeypot') {
      const sub = interaction.options.getSubcommand();
      const settings = this.settings.get(interaction.guildId, {});
      if (sub === 'disable') {
        settings.honeypotEnabled = false;
        await this.settings.set(interaction.guildId, settings);
        await interaction.reply(privatePayload({ content: '🛡️ Honeypot disabled. Its channel was left in place for safe review.' }));
        return true;
      }
      const exposedRoleId = process.env.HONEYPOT_EXPOSED_ROLE_ID;
      if (!exposedRoleId) { await interaction.reply(privatePayload({ content: 'Set `HONEYPOT_EXPOSED_ROLE_ID` to a quarantine/unverified role first. Only that role will see the trap.' })); return true; }
      const channel = await interaction.guild.channels.create({
        name: interaction.options.getString('name') || 'account-check', type: ChannelType.GuildText,
        topic: 'Automated security trap. Do not expose to normal members.',
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: exposedRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages] }
        ], reason: `Guarded honeypot created by ${interaction.user.tag}`
      });
      settings.honeypotChannelId = channel.id;
      settings.honeypotEnabled = true;
      await this.settings.set(interaction.guildId, settings);
      await interaction.reply(privatePayload({ content: `🛡️ Guarded honeypot created: ${channel}. Only the configured quarantine role can see it; staff and bots are never auto-banned.` }));
      return true;
    }

    if (name === 'audit-export') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const log = await interaction.guild.fetchAuditLogs({ limit: interaction.options.getInteger('limit') ?? 50 });
      const lines = [...log.entries.values()].map((entry) => `[${new Date(entry.createdTimestamp).toISOString()}] action=${entry.action} executor=${entry.executor?.tag || entry.executorId || 'unknown'} target=${entry.target?.tag || entry.targetId || 'unknown'} reason=${entry.reason || 'none'}`);
      await interaction.editReply({ content: `📋 Exported ${lines.length} audit entry/entries.`, files: [new AttachmentBuilder(Buffer.from(`${lines.join('\n')}\n`), { name: `audit-${interaction.guildId}.txt` })] });
      return true;
    }

    if (name === 'ping') {
      const started = Date.now();
      await interaction.reply(privatePayload({ content: '🏓 Measuring…' }));
      const voice = this.media.voicePing(interaction.guildId);
      const voiceText = voice ? ` • voice WebSocket: **${Math.round(voice.ws ?? 0)} ms** • voice UDP: **${Math.round(voice.udp ?? 0)} ms**` : ' • voice: **join/play audio to measure**';
      await interaction.editReply(`🏓 Interaction: **${Date.now() - started} ms** • Discord gateway: **${Math.round(this.client.ws.ping)} ms**${voiceText} • shard: **${interaction.guild?.shardId ?? 0}**`);
      return true;
    }

    if (name === 'dm-alerts') {
      const key = `${interaction.guildId}:${interaction.user.id}`;
      const enabled = interaction.options.getString('choice', true) === 'in';
      if (enabled) await this.optIns.set(key, { enabled: true, updatedAt: Date.now() }); else await this.optIns.delete(key);
      await interaction.reply(privatePayload({ content: enabled ? '✅ You opted in to emergency server DMs.' : '✅ You opted out. Hatclanker will not include you in broadcasts.' }));
      return true;
    }

    if (name === 'dm-broadcast') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const message = interaction.options.getString('message', true);
      await interaction.guild.members.fetch();
      const recipients = interaction.guild.members.cache.filter((member) => !member.user.bot && this.optIns.get(`${interaction.guildId}:${member.id}`)?.enabled);
      let delivered = 0;
      let failed = 0;
      const list = [...recipients.values()];
      for (let index = 0; index < list.length; index += 10) {
        const results = await Promise.allSettled(list.slice(index, index + 10).map((member) => member.send(`📢 **Emergency notice from ${interaction.guild.name}**\n${message}`)));
        delivered += results.filter((result) => result.status === 'fulfilled').length;
        failed += results.filter((result) => result.status === 'rejected').length;
      }
      await interaction.editReply(`📨 Broadcast complete: **${delivered} delivered**, **${failed} failed**, only among **${list.length} opted-in** members.`);
      return true;
    }

    if (name === 'emoji-clone') {
      const url = interaction.options.getString('url', true);
      if (!/^https:\/\//i.test(url)) { await interaction.reply(privatePayload({ content: 'Use a direct HTTPS image URL.' })); return true; }
      const emoji = await interaction.guild.emojis.create({ attachment: url, name: interaction.options.getString('name', true), reason: `Cloned by ${interaction.user.tag}` });
      await interaction.reply(privatePayload({ content: `✅ Added ${emoji} as \`:${emoji.name}:\`.` }));
      return true;
    }

    if (name === 'self-destruct') {
      const seconds = interaction.options.getInteger('seconds') ?? 60;
      const message = await interaction.channel.send({ content: `🔐 ${cleanText(interaction.options.getString('message', true))}\n*Self-destructs <t:${Math.floor((Date.now() + seconds * 1000) / 1000)}:R>.*`, allowedMentions: { parse: [] } });
      const timer = setTimeout(() => message.delete().catch(() => null), seconds * 1000);
      timer.unref();
      await interaction.reply(privatePayload({ content: `✅ Temporary message posted and scheduled for deletion in ${seconds} seconds.` }));
      return true;
    }

    return false;
  }

  akiButtons(token) {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`aki:y:${token}`).setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`aki:n:${token}`).setLabel('No').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`aki:u:${token}`).setLabel('Not sure').setStyle(ButtonStyle.Secondary)
    )];
  }

  async handleInteraction(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('aki:')) return false;
    const [, answer, token] = interaction.customId.split(':');
    const key = `${interaction.guildId}:${interaction.user.id}`;
    const session = this.akinatorSessions.get(key);
    if (!session || session.token !== token) { await interaction.reply(privatePayload({ content: 'That guessing round is not yours or has expired.' })); return true; }
    const [attribute] = AKI_QUESTIONS[session.index];
    if (answer !== 'u') session.candidates = session.candidates.filter((candidate) => candidate[attribute] === (answer === 'y'));
    session.index += 1;
    if (session.candidates.length <= 1 || session.index >= AKI_QUESTIONS.length) {
      const guess = session.candidates[0];
      this.akinatorSessions.delete(key);
      await interaction.update({ content: guess ? `🧞 My guess is **${guess.name}**!` : '🧞 You stumped me. Add that character to my local database for next time!', components: [] });
    } else {
      await interaction.update({ content: `🧞 **${AKI_QUESTIONS[session.index][1]}** (${session.candidates.length} possibilities remain)`, components: this.akiButtons(token) });
    }
    return true;
  }

  async handleMessage(message) {
    if (!message.inGuild()) return false;
    const settings = this.settings.get(message.guildId, {});
    if (settings.honeypotEnabled && message.channelId === settings.honeypotChannelId) {
      const member = message.member;
      const protectedMember = message.author.bot || member?.permissions.has(PermissionFlagsBits.Administrator) || member?.permissions.has(PermissionFlagsBits.ManageGuild);
      if (!protectedMember && member?.bannable) {
        await member.ban({ reason: 'Triggered configured spam honeypot' });
        await this.moderation?.log(message.guild, '🍯 Honeypot triggered', `${message.author.tag} (${message.author.id}) was banned after posting in <#${message.channelId}>.`);
      }
      return true;
    }
    if (message.author.bot || settings.countingChannelId !== message.channelId) return false;
    const current = this.counts.get(message.guildId, { count: 0, previousUserId: null });
    const result = nextCount(current.count + 1, message.content, current.previousUserId, message.author.id);
    await this.counts.set(message.guildId, result);
    if (!result.valid) {
      await message.react('❌').catch(() => null);
      await message.channel.send(`🔄 Count reset to **0** by ${message.author}. Start again with **1**. The same person cannot count twice in a row.`);
    } else await message.react('✅').catch(() => null);
    return true;
  }

  async handleReaction(reaction, user) {
    if (user?.bot) return false;
    if (reaction.partial) await reaction.fetch().catch(() => null);
    const message = reaction.message;
    if (!message.inGuild()) return false;
    const settings = this.settings.get(message.guildId, {});
    if (reaction.emoji.name === '⭐' && settings.starboardChannelId && reaction.count >= (settings.starboardThreshold || 3)) {
      const key = `${message.guildId}:${message.id}`;
      if (!this.starred.get(key)) {
        const channel = await message.guild.channels.fetch(settings.starboardChannelId).catch(() => null);
        if (channel?.isTextBased()) {
          const attachment = message.attachments.first()?.url;
          const embed = new EmbedBuilder().setColor(0xf5c542).setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() }).setDescription((message.content || '*Attachment*').slice(0, 3900)).addFields({ name: 'Original', value: `[Jump to message](${message.url})` }).setFooter({ text: `${reaction.count} ⭐` }).setTimestamp(message.createdAt);
          if (attachment) embed.setImage(attachment);
          const starred = await channel.send({ embeds: [embed] });
          await this.starred.set(key, { messageId: starred.id, channelId: channel.id });
        }
      }
    }
    const bridge = process.env.KANBAN_BRIDGE_URL;
    const mapping = parseJsonEnv('KANBAN_REACTION_MAP', {});
    const action = mapping[reaction.emoji.id || reaction.emoji.name];
    if (bridge && action) {
      await fetch(bridge, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.INTEGRATION_BRIDGE_TOKEN || ''}` }, body: JSON.stringify({ action, guildId: message.guildId, channelId: message.channelId, messageId: message.id, messageUrl: message.url, reactedBy: user.id }), signal: AbortSignal.timeout(20_000) }).catch(() => null);
    }
    return false;
  }
}
