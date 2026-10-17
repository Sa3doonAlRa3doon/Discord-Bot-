import { createCanvas, loadImage } from '@napi-rs/canvas';
import { Readable } from 'node:stream';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel
} from '@discordjs/voice';
import play from 'play-dl';
import { AttachmentBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

function privatePayload(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

class GuildMusicQueue {
  constructor(guildId, onError) {
    this.guildId = guildId;
    this.onError = onError;
    this.tracks = [];
    this.current = null;
    this.loop = false;
    this.connection = null;
    this.textChannel = null;
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    this.player.on(AudioPlayerStatus.Idle, () => this.advance().catch(this.onError));
    this.player.on('error', (error) => {
      this.onError(error);
      this.advance().catch(this.onError);
    });
  }

  connect(voiceChannel, textChannel) {
    this.textChannel = textChannel;
    if (this.connection?.joinConfig.channelId === voiceChannel.id) return;
    this.connection?.destroy();
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true
    });
    this.connection.subscribe(this.player);
  }

  async resolve(query, requester) {
    const validation = await play.validate(query);
    let url = query;
    let title = query;

    if (validation === 'sp_track') {
      const spotifyTrack = await play.spotify(query);
      const results = await play.search(`${spotifyTrack.name} ${spotifyTrack.artists?.[0]?.name ?? ''}`, { limit: 1, source: { youtube: 'video' } });
      if (!results[0]) throw new Error('No playable match found for that Spotify track.');
      url = results[0].url;
      title = results[0].title;
    } else if (validation === 'yt_video') {
      const info = await play.video_basic_info(query);
      title = info.video_details.title;
    } else if (validation === 'so_track') {
      const info = await play.soundcloud(query);
      title = info.name;
    } else {
      const results = await play.search(query, { limit: 1, source: { youtube: 'video' } });
      if (!results[0]) throw new Error('No playable track found.');
      url = results[0].url;
      title = results[0].title;
    }

    return { title, url, requester };
  }

  async enqueue(track) {
    this.tracks.push(track);
    if (!this.current && this.player.state.status === AudioPlayerStatus.Idle) await this.advance();
  }

  async advance() {
    if (this.loop && this.current) this.tracks.unshift(this.current);
    this.current = this.tracks.shift() ?? null;
    if (!this.current) return;
    const source = await play.stream(this.current.url);
    const resource = createAudioResource(source.stream, { inputType: source.type, metadata: this.current });
    this.player.play(resource);
    await this.textChannel?.send(`🎵 Now playing **${this.current.title}** — requested by <@${this.current.requester}>`).catch(() => {});
  }

  skip() {
    this.player.stop(true);
  }

  stop() {
    this.tracks = [];
    this.current = null;
    this.player.stop(true);
    this.connection?.destroy();
    this.connection = null;
  }
}

export class MediaFeatures {
  constructor({ client, config }) {
    this.client = client;
    this.config = config;
    this.queues = new Map();
  }

  queue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, new GuildMusicQueue(guildId, (error) => console.error(`Music error in ${guildId}:`, error)));
    }
    return this.queues.get(guildId);
  }

  async playSpeech(voiceChannel, textChannel, audioBuffer) {
    const queue = this.queue(voiceChannel.guild.id);
    queue.connect(voiceChannel, textChannel);
    const resource = createAudioResource(Readable.from(audioBuffer));
    queue.current = null;
    queue.player.play(resource);
  }

  voicePing(guildId) {
    return this.queues.get(guildId)?.connection?.ping || null;
  }

  async handleCommand(interaction) {
    if (interaction.commandName === 'music') {
      const subcommand = interaction.options.getSubcommand();
      const queue = this.queue(interaction.guildId);
      if (subcommand === 'play') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
          await interaction.reply(privatePayload({ content: '🎧 Join a voice channel first.' }));
          return true;
        }
        await interaction.deferReply();
        try {
          queue.connect(voiceChannel, interaction.channel);
          const track = await queue.resolve(interaction.options.getString('query', true), interaction.user.id);
          await queue.enqueue(track);
          await interaction.editReply(`🎶 Queued **${track.title}**.`);
        } catch (error) {
          console.error('Music play failed:', error);
          await interaction.editReply(`❌ Could not play that source: ${error.message}`);
        }
        return true;
      }
      if (subcommand === 'skip') {
        queue.skip();
        await interaction.reply('⏭️ Skipped. Next noise incoming.');
        return true;
      }
      if (subcommand === 'stop') {
        queue.stop();
        await interaction.reply('⏹️ Music stopped and queue cleared. Silence is weird.');
        return true;
      }
      if (subcommand === 'pause') {
        queue.player.pause();
        await interaction.reply('⏸️ Paused.');
        return true;
      }
      if (subcommand === 'resume') {
        queue.player.unpause();
        await interaction.reply('▶️ Resumed.');
        return true;
      }
      if (subcommand === 'shuffle') {
        queue.tracks.sort(() => Math.random() - 0.5);
        await interaction.reply('🔀 Queue shuffled. Chaos improved.');
        return true;
      }
      if (subcommand === 'loop') {
        queue.loop = interaction.options.getBoolean('enabled', true);
        await interaction.reply(`🔁 Loop is now **${queue.loop ? 'on' : 'off'}**.`);
        return true;
      }
      const lines = [queue.current ? `**Now:** ${queue.current.title}` : '**Now:** nothing', ...queue.tracks.slice(0, 10).map((track, index) => `${index + 1}. ${track.title}`)];
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(this.config.color).setTitle('🎵 Music queue').setDescription(lines.join('\n'))] });
      return true;
    }

    if (interaction.commandName === 'meme') {
      await interaction.deferReply();
      try {
        const attachment = interaction.options.getAttachment('image', true);
        if (!attachment.contentType?.startsWith('image/') || attachment.size > 8_000_000) throw new Error('Use an image under 8 MB.');
        const response = await fetch(attachment.url);
        const image = await loadImage(Buffer.from(await response.arrayBuffer()));
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / image.width);
        const width = Math.round(image.width * scale);
        const imageHeight = Math.round(image.height * scale);
        const top = interaction.options.getString('top') ?? '';
        const bottom = interaction.options.getString('bottom') ?? '';
        const captionHeight = (top ? 100 : 0) + (bottom ? 100 : 0);
        const canvas = createCanvas(width, imageHeight + captionHeight);
        const context = canvas.getContext('2d');
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, top ? 100 : 0, width, imageHeight);
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `bold ${Math.max(28, Math.min(54, width / 12))}px Arial`;
        context.strokeStyle = '#000000';
        context.lineWidth = 8;
        if (top) {
          context.strokeText(top.toUpperCase(), width / 2, 50, width - 30);
          context.fillText(top.toUpperCase(), width / 2, 50, width - 30);
        }
        if (bottom) {
          const y = canvas.height - 50;
          context.strokeText(bottom.toUpperCase(), width / 2, y, width - 30);
          context.fillText(bottom.toUpperCase(), width / 2, y, width - 30);
        }
        const output = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'hatclanker-meme.png' });
        await interaction.editReply({ content: `🖼️ Meme forged for ${interaction.user}.`, files: [output] });
      } catch (error) {
        await interaction.editReply(`❌ Meme forge failed: ${error.message}`);
      }
      return true;
    }

    return false;
  }
}
