import path from 'node:path';
import { AttachmentBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { JsonStore } from '../lib/json-store.js';
import { cleanText } from '../lib/clean-language.js';

const privatePayload = (payload) => ({ ...payload, flags: MessageFlags.Ephemeral });

async function providerJson(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  return { buffer: Buffer.from(await response.arrayBuffer()), contentType: type };
}

function authHeaders() {
  return process.env.MEDIA_API_TOKEN ? { authorization: `Bearer ${process.env.MEDIA_API_TOKEN}` } : {};
}

function resultAttachment(result, fallbackName) {
  if (result.buffer) return new AttachmentBuilder(result.buffer, { name: fallbackName });
  if (result.base64 || result.imageBase64 || result.audioBase64) {
    return new AttachmentBuilder(Buffer.from(result.base64 || result.imageBase64 || result.audioBase64, 'base64'), { name: result.filename || fallbackName });
  }
  return null;
}

export function topPalette(rgba, limit = 8) {
  const buckets = new Map();
  for (let index = 0; index < rgba.length; index += 16) {
    const alpha = rgba[index + 3];
    if (alpha < 128) continue;
    const r = rgba[index] >> 4;
    const g = rgba[index + 1] >> 4;
    const b = rgba[index + 2] >> 4;
    const key = `${r},${g},${b}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([key]) => {
    const [r, g, b] = key.split(',').map((value) => Number(value) * 16 + 8);
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  });
}

function timestamp(seconds) {
  const milliseconds = Math.max(0, Math.round(Number(seconds) * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function segmentsToSrt(segments, fallbackText = '') {
  const usable = Array.isArray(segments) && segments.length ? segments : [{ start: 0, end: 5, text: fallbackText }];
  return usable.map((segment, index) => `${index + 1}\n${timestamp(segment.start)} --> ${timestamp(segment.end)}\n${String(segment.text || '').trim()}\n`).join('\n');
}

export class AiMediaFeatures {
  constructor({ client, projectRoot, config, media }) {
    this.client = client;
    this.config = config;
    this.media = media;
    this.usage = new JsonStore(path.join(projectRoot, 'data', 'ai-media-usage.json'), {});
  }

  async load() {
    await this.usage.load();
  }

  async transcribe(attachment) {
    const endpoint = process.env.TRANSCRIPTION_API_URL;
    if (!endpoint) throw new Error('TRANSCRIPTION_API_URL is not configured.');
    if ((attachment.size || 0) > 25 * 1024 * 1024) throw new Error('Audio must be 25 MB or smaller.');
    const source = await fetch(attachment.url, { signal: AbortSignal.timeout(30_000) });
    if (!source.ok) throw new Error('Could not download that attachment.');
    const form = new FormData();
    form.append('file', new Blob([await source.arrayBuffer()], { type: attachment.contentType || 'application/octet-stream' }), attachment.name || 'audio.bin');
    form.append('response_format', 'verbose_json');
    return providerJson(endpoint, { method: 'POST', headers: authHeaders(), body: form });
  }

  async handleCommand(interaction) {
    const name = interaction.commandName;
    if (name === 'imagine') {
      const endpoint = process.env.IMAGE_GENERATION_API_URL;
      if (!endpoint) {
        await interaction.reply(privatePayload({ content: '🎨 Set `IMAGE_GENERATION_API_URL` to connect Stable Diffusion, Midjourney, or another image provider.' }));
        return true;
      }
      await interaction.deferReply();
      const prompt = cleanText(interaction.options.getString('prompt', true));
      const result = await providerJson(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body: JSON.stringify({ prompt, userId: interaction.user.id, guildId: interaction.guildId }) });
      const attachment = resultAttachment(result, 'hatclanker-art.png');
      const url = result.url || result.imageUrl;
      await interaction.editReply({ content: `🎨 **Prompt:** ${prompt}`, files: attachment ? [attachment] : [], embeds: url ? [new EmbedBuilder().setColor(this.config.color).setImage(url)] : [] });
      return true;
    }

    if (name === 'transcribe' || name === 'subtitles') {
      if (name === 'transcribe') await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      else await interaction.deferReply();
      const result = await this.transcribe(interaction.options.getAttachment('audio', true));
      if (name === 'transcribe') {
        const text = cleanText(String(result.text || result.transcript || '').trim());
        const attachment = text.length > 1900 ? new AttachmentBuilder(Buffer.from(text), { name: 'transcript.txt' }) : null;
        await interaction.editReply({ content: attachment ? '📝 Transcript attached.' : `📝 ${text || 'Provider returned no text.'}`, files: attachment ? [attachment] : [] });
      } else {
        const cleanSegments = result.segments?.map((segment) => ({ ...segment, text: cleanText(segment.text) }));
        const srt = segmentsToSrt(cleanSegments, cleanText(result.text || result.transcript || ''));
        await interaction.editReply({ content: '🎞️ Subtitle file ready.', files: [new AttachmentBuilder(Buffer.from(srt), { name: 'subtitles.srt' })] });
      }
      return true;
    }

    if (name === 'tts') {
      const endpoint = process.env.TTS_API_URL;
      if (!endpoint) {
        await interaction.reply(privatePayload({ content: '🔊 Set `TTS_API_URL` to connect a text-to-speech provider. Only configured, consent-safe voice presets are accepted.' }));
        return true;
      }
      await interaction.deferReply();
      const result = await providerJson(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body: JSON.stringify({ text: cleanText(interaction.options.getString('text', true)), voice: interaction.options.getString('voice') || process.env.TTS_DEFAULT_VOICE || 'default' }) });
      const attachment = resultAttachment(result, 'hatclanker-speech.mp3');
      const voiceChannel = interaction.member?.voice?.channel;
      let voiceBuffer = result.buffer || (result.base64 || result.audioBase64 ? Buffer.from(result.base64 || result.audioBase64, 'base64') : null);
      const outputUrl = result.url || result.audioUrl;
      if (voiceChannel && !voiceBuffer && outputUrl) {
        const audioResponse = await fetch(outputUrl, { signal: AbortSignal.timeout(30_000) });
        if (audioResponse.ok) voiceBuffer = Buffer.from(await audioResponse.arrayBuffer());
      }
      if (voiceChannel && voiceBuffer) {
        await this.media.playSpeech(voiceChannel, interaction.channel, voiceBuffer);
        await interaction.editReply(`🔊 Speech is playing in **${voiceChannel.name}**.`);
      } else {
        await interaction.editReply({ content: attachment || outputUrl ? '🔊 Speech generated. Join a voice channel before running `/tts` to play it there.' : 'The provider returned no audio.', files: attachment ? [attachment] : [] });
        if (!attachment && outputUrl) await interaction.followUp(outputUrl);
      }
      return true;
    }

    if (name === 'image-tool') {
      const action = interaction.options.getString('action', true);
      const attachment = interaction.options.getAttachment('image', true);
      if (!attachment.contentType?.startsWith('image/') || attachment.size > 12 * 1024 * 1024) {
        await interaction.reply(privatePayload({ content: 'Upload an image no larger than 12 MB.' }));
        return true;
      }
      if (action === 'face-swap' && interaction.options.getBoolean('consent') !== true) {
        await interaction.reply(privatePayload({ content: 'Face swapping requires confirming permission from every person shown.' }));
        return true;
      }
      await interaction.deferReply();
      if (action === 'palette') {
        const image = await loadImage(attachment.url);
        const width = Math.min(160, image.width);
        const height = Math.max(1, Math.round(image.height * (width / image.width)));
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);
        const palette = topPalette(context.getImageData(0, 0, width, height).data);
        const swatches = createCanvas(640, 100);
        const swatchContext = swatches.getContext('2d');
        palette.forEach((color, index) => { swatchContext.fillStyle = color; swatchContext.fillRect(index * 80, 0, 80, 100); });
        await interaction.editReply({ content: `🎨 ${palette.map((color) => `\`${color}\``).join(' ')}`, files: [new AttachmentBuilder(swatches.toBuffer('image/png'), { name: 'palette.png' })] });
        return true;
      }
      const envKey = { upscale: 'UPSCALER_API_URL', background: 'BACKGROUND_REMOVAL_API_URL', 'face-swap': 'FACE_SWAP_API_URL' }[action];
      const endpoint = process.env[envKey];
      if (!endpoint) {
        await interaction.editReply(`⚙️ Set \`${envKey}\` to enable this provider-backed tool.`);
        return true;
      }
      const result = await providerJson(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body: JSON.stringify({ imageUrl: attachment.url, faceUrl: action === 'face-swap' ? interaction.user.displayAvatarURL({ extension: 'png', size: 512 }) : undefined, consentConfirmed: action === 'face-swap' }) });
      const output = resultAttachment(result, `hatclanker-${action}.png`);
      await interaction.editReply({ content: `🖼️ ${action} complete.`, files: output ? [output] : [], embeds: result.url ? [new EmbedBuilder().setImage(result.url)] : [] });
      return true;
    }

    if (name === 'code-review') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const endpoint = `${(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')}/api/generate`;
      const code = interaction.options.getString('code', true);
      const language = interaction.options.getString('language') || 'unknown';
      const result = await providerJson(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'llama3.2', stream: false, prompt: `Review this ${language} code. Be concise. Identify correctness, security, performance, and maintainability issues. Never execute it.\n\n${code}` })
      });
      const review = cleanText(String(result.response || 'No review returned.'));
      const file = review.length > 1900 ? new AttachmentBuilder(Buffer.from(review), { name: 'code-review.md' }) : null;
      await interaction.editReply({ content: file ? '🧠 Code review attached.' : review, files: file ? [file] : [] });
      return true;
    }

    return false;
  }
}
