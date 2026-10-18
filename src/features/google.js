import { MessageFlags } from 'discord.js';
import { cleanText } from '../lib/clean-language.js';
import {
  buildMimeMessage,
  createGoogleServices,
  extractGoogleDocText,
  googleWorkspaceSettings,
  isGoogleUserAllowed,
  loadGoogleAuth,
  parseGridValues
} from '../lib/google-workspace.js';

const privatePayload = (payload) => ({ ...payload, flags: MessageFlags.Ephemeral });

function discordSafe(value, maximum = 300) {
  return cleanText(String(value ?? ''))
    .replace(/([\\`*_~|>])/g, '\\$1')
    .replace(/[<>]/g, '')
    .slice(0, maximum);
}

function headerValue(message, name) {
  return message.payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return discordSafe(value, 80);
  return date.toLocaleString('en-AE', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' });
}

function compactLines(lines, emptyText) {
  const text = lines.filter(Boolean).join('\n');
  return (text || emptyText).slice(0, 1_950);
}

function friendlyGoogleError(error) {
  const status = error?.response?.status ?? error?.code;
  const message = String(error?.message || '');
  if (status === 401 || message.includes('invalid_grant')) return 'Google authorization expired or was revoked. Generate a new token on Windows.';
  if (status === 403) return 'Google refused this action. Check that the API is enabled and the required OAuth scope was granted.';
  if (status === 404) return 'That Google file was not found or is not available to Jarvis.';
  if (message.startsWith('Google token')) return message;
  return 'Google request failed. Check the Pi service log for details.';
}

export class GoogleFeatures {
  constructor({ config, env = process.env }) {
    this.config = config;
    this.env = env;
    this.settings = googleWorkspaceSettings(env);
    this.services = null;
  }

  async getServices() {
    if (!this.services) {
      const auth = await loadGoogleAuth(this.settings.tokenPath);
      this.services = createGoogleServices(auth);
    }
    return this.services;
  }

  async gmailMessages(gmail, query) {
    const listing = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 10 });
    const messages = await Promise.all((listing.data.messages || []).map(({ id }) => gmail.users.messages.get({
      userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date']
    })));
    return messages.map(({ data }) => ({
      id: data.id,
      from: headerValue(data, 'From'),
      subject: headerValue(data, 'Subject') || '(no subject)',
      date: headerValue(data, 'Date')
    }));
  }

  async handleCommand(interaction) {
    if (interaction.commandName !== 'google') return false;

    if (!isGoogleUserAllowed(interaction.user.id, this.settings)) {
      const detail = this.settings.allowedUserIds.size === 0
        ? 'Set `GOOGLE_ALLOWED_USER_IDS` in the Pi `.env` to your Discord user ID, then restart Hatclanker.'
        : 'This private Google connection is restricted to its owner.';
      await interaction.reply(privatePayload({ content: `🔒 ${detail}` }));
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    try {
      const services = await this.getServices();

      if (sub === 'status') {
        const [gmail] = await Promise.all([
          services.gmail.users.getProfile({ userId: 'me' }),
          services.calendar.events.list({ calendarId: 'primary', timeMin: new Date().toISOString(), maxResults: 1, singleEvents: true }),
          services.drive.files.list({ pageSize: 1, fields: 'files(id)' }),
          services.tasks.tasklists.list({ maxResults: 1 }),
          services.people.people.connections.list({ resourceName: 'people/me', pageSize: 1, personFields: 'names' })
        ]);
        const account = discordSafe(gmail.data.emailAddress, 200);
        await interaction.editReply({ content: `✅ Google connected as **${account}**\n✅ Gmail\n✅ Calendar + Meet links\n✅ Drive\n✅ Docs / Sheets / Slides / Forms\n✅ Tasks\n✅ Contacts`, allowedMentions: { parse: [] } });
        return true;
      }

      if (sub === 'gmail-unread' || sub === 'gmail-search') {
        const query = sub === 'gmail-unread' ? 'in:inbox is:unread' : interaction.options.getString('query', true);
        const messages = await this.gmailMessages(services.gmail, query);
        const lines = messages.map((message, index) => `${index + 1}. **${discordSafe(message.subject, 150)}**\nFrom: ${discordSafe(message.from, 180)} · ${discordSafe(message.date, 100)}\nID: \`${message.id}\``);
        await interaction.editReply({ content: compactLines(lines, 'No matching messages found.'), allowedMentions: { parse: [] } });
        return true;
      }

      if (sub === 'gmail-draft') {
        const raw = buildMimeMessage({
          to: interaction.options.getString('to', true),
          subject: cleanText(interaction.options.getString('subject', true)),
          body: cleanText(interaction.options.getString('body', true))
        });
        const draft = await services.gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } });
        await interaction.editReply(`📝 Draft created. It was **not sent**.\nDraft ID: \`${draft.data.id}\`\nReview it in Gmail, then use \`/google gmail-send\` if you want to send it.`);
        return true;
      }

      if (sub === 'gmail-send') {
        if (!interaction.options.getBoolean('confirm', true)) {
          await interaction.editReply('Cancelled. The Gmail draft was not sent.');
          return true;
        }
        const draftId = interaction.options.getString('draft_id', true).trim();
        const result = await services.gmail.users.drafts.send({ userId: 'me', requestBody: { id: draftId } });
        await interaction.editReply(`✅ Gmail draft sent. Message ID: \`${result.data.id}\``);
        return true;
      }

      if (sub === 'calendar-list') {
        const result = await services.calendar.events.list({ calendarId: 'primary', timeMin: new Date().toISOString(), maxResults: 10, singleEvents: true, orderBy: 'startTime' });
        const lines = (result.data.items || []).map((event, index) => `${index + 1}. **${discordSafe(event.summary || 'Untitled event', 180)}** — ${formatDate(event.start?.dateTime || event.start?.date)}`);
        await interaction.editReply({ content: compactLines(lines, 'No upcoming events.'), allowedMentions: { parse: [] } });
        return true;
      }

      if (sub === 'calendar-add') {
        const startText = interaction.options.getString('start', true);
        const start = new Date(startText);
        if (Number.isNaN(start.getTime())) throw new Error('Use an ISO date/time such as `2026-10-20T18:00+04:00`.');
        const minutes = interaction.options.getInteger('minutes') ?? 60;
        const result = await services.calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: cleanText(interaction.options.getString('title', true)),
            description: cleanText(interaction.options.getString('details') || ''),
            start: { dateTime: start.toISOString() },
            end: { dateTime: new Date(start.getTime() + minutes * 60_000).toISOString() }
          }
        });
        await interaction.editReply(`📅 Event created: ${result.data.htmlLink || discordSafe(result.data.summary || 'calendar event')}`);
        return true;
      }

      if (sub === 'drive-list') {
        const result = await services.drive.files.list({ pageSize: 10, orderBy: 'modifiedTime desc', q: 'trashed = false', fields: 'files(id,name,mimeType,modifiedTime,webViewLink)' });
        const lines = (result.data.files || []).map((file, index) => `${index + 1}. **${discordSafe(file.name, 180)}** — ${formatDate(file.modifiedTime)}${file.webViewLink ? `\n${file.webViewLink}` : ''}`);
        await interaction.editReply({ content: compactLines(lines, 'No Drive files are available to Jarvis yet.'), allowedMentions: { parse: [] } });
        return true;
      }

      if (sub === 'doc-create') {
        const title = cleanText(interaction.options.getString('title', true));
        const content = cleanText(interaction.options.getString('content') || '');
        const result = await services.drive.files.create({ requestBody: { name: title, mimeType: 'application/vnd.google-apps.document' }, fields: 'id,name,webViewLink' });
        if (content) {
          await services.docs.documents.batchUpdate({
            documentId: result.data.id,
            requestBody: { requests: [{ insertText: { location: { index: 1 }, text: `${content}\n` } }] }
          });
        } else {
          await services.docs.documents.get({ documentId: result.data.id });
        }
        await interaction.editReply(`✅ Created **${discordSafe(result.data.name, 180)}**${result.data.webViewLink ? `\n${result.data.webViewLink}` : `\nFile ID: \`${result.data.id}\``}`);
        return true;
      }

      if (sub === 'doc-read') {
        const documentId = interaction.options.getString('document_id', true).trim();
        const result = await services.docs.documents.get({ documentId });
        const text = extractGoogleDocText(result.data);
        await interaction.editReply({ content: compactLines([text ? discordSafe(text, 1_850) : ''], 'The document is empty.'), allowedMentions: { parse: [] } });
        return true;
      }

      if (sub === 'sheet-create') {
        const title = cleanText(interaction.options.getString('title', true));
        const result = await services.drive.files.create({ requestBody: { name: title, mimeType: 'application/vnd.google-apps.spreadsheet' }, fields: 'id,name,webViewLink' });
        const headers = interaction.options.getString('headers');
        if (headers) {
          await services.sheets.spreadsheets.values.update({
            spreadsheetId: result.data.id,
            range: 'A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: parseGridValues(headers) }
          });
        } else {
          await services.sheets.spreadsheets.get({ spreadsheetId: result.data.id, fields: 'spreadsheetId,properties.title' });
        }
        await interaction.editReply(`✅ Created **${discordSafe(result.data.name, 180)}**${result.data.webViewLink ? `\n${result.data.webViewLink}` : `\nFile ID: \`${result.data.id}\``}`);
        return true;
      }

      if (sub === 'sheet-read') {
        const spreadsheetId = interaction.options.getString('spreadsheet_id', true).trim();
        const range = interaction.options.getString('range')?.trim() || 'A1:J20';
        const result = await services.sheets.spreadsheets.values.get({ spreadsheetId, range });
        const lines = (result.data.values || []).map((row, index) => `${index + 1}. ${row.map((cell) => discordSafe(cell, 120)).join(' | ')}`);
        await interaction.editReply({ content: compactLines(lines, 'That range is empty.'), allowedMentions: { parse: [] } });
        return true;
      }

      if (sub === 'sheet-write') {
        const spreadsheetId = interaction.options.getString('spreadsheet_id', true).trim();
        const range = interaction.options.getString('range', true).trim();
        const values = parseGridValues(cleanText(interaction.options.getString('values', true)));
        const result = await services.sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values }
        });
        await interaction.editReply(`✅ Updated ${result.data.updatedCells || 0} cell(s) in \`${discordSafe(result.data.updatedRange || range, 150)}\`.`);
        return true;
      }

      if (sub === 'slide-create') {
        const title = cleanText(interaction.options.getString('title', true));
        const subtitle = cleanText(interaction.options.getString('subtitle') || 'Created by Hatclanker');
        const created = await services.drive.files.create({ requestBody: { name: title, mimeType: 'application/vnd.google-apps.presentation' }, fields: 'id,name,webViewLink' });
        const presentation = await services.slides.presentations.get({ presentationId: created.data.id });
        const slideId = presentation.data.slides?.[0]?.objectId;
        if (!slideId) throw new Error('Google created a presentation without a usable first slide.');
        await services.slides.presentations.batchUpdate({
          presentationId: created.data.id,
          requestBody: {
            requests: [
              { createShape: { objectId: 'jarvis_title_box', shapeType: 'TEXT_BOX', elementProperties: { pageObjectId: slideId, size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 80, unit: 'PT' } }, transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 120, unit: 'PT' } } } },
              { insertText: { objectId: 'jarvis_title_box', text: title } },
              { updateTextStyle: { objectId: 'jarvis_title_box', textRange: { type: 'ALL' }, style: { bold: true, fontSize: { magnitude: 32, unit: 'PT' } }, fields: 'bold,fontSize' } },
              { createShape: { objectId: 'jarvis_subtitle_box', shapeType: 'TEXT_BOX', elementProperties: { pageObjectId: slideId, size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 60, unit: 'PT' } }, transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 220, unit: 'PT' } } } },
              { insertText: { objectId: 'jarvis_subtitle_box', text: subtitle } },
              { updateTextStyle: { objectId: 'jarvis_subtitle_box', textRange: { type: 'ALL' }, style: { fontSize: { magnitude: 18, unit: 'PT' } }, fields: 'fontSize' } }
            ]
          }
        });
        await interaction.editReply(`✅ Created **${discordSafe(created.data.name, 180)}**\n${created.data.webViewLink || `https://docs.google.com/presentation/d/${created.data.id}/edit`}`);
        return true;
      }

      if (sub === 'form-create') {
        const title = cleanText(interaction.options.getString('title', true));
        const question = cleanText(interaction.options.getString('question') || '');
        const created = await services.forms.forms.create({ requestBody: { info: { title } } });
        if (question) {
          await services.forms.forms.batchUpdate({
            formId: created.data.formId,
            requestBody: {
              requests: [{ createItem: { item: { title: question, questionItem: { question: { textQuestion: { paragraph: false } } } }, location: { index: 0 } } }]
            }
          });
        }
        await interaction.editReply(`✅ Created **${discordSafe(title, 180)}**\nEdit: https://docs.google.com/forms/d/${created.data.formId}/edit${created.data.responderUri ? `\nAnswer: ${created.data.responderUri}` : ''}`);
        return true;
      }

      if (sub === 'meet-create') {
        const start = new Date(interaction.options.getString('start', true));
        if (Number.isNaN(start.getTime())) throw new Error('Use an ISO date/time such as `2026-10-20T18:00+04:00`.');
        const minutes = interaction.options.getInteger('minutes') ?? 60;
        const result = await services.calendar.events.insert({
          calendarId: 'primary',
          conferenceDataVersion: 1,
          requestBody: {
            summary: cleanText(interaction.options.getString('title', true)),
            description: cleanText(interaction.options.getString('details') || ''),
            start: { dateTime: start.toISOString() },
            end: { dateTime: new Date(start.getTime() + minutes * 60_000).toISOString() },
            conferenceData: { createRequest: { requestId: `hatclanker-${interaction.id}-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
          }
        });
        const meetLink = result.data.hangoutLink || result.data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;
        await interaction.editReply(`✅ Meeting created${meetLink ? `\nMeet: ${meetLink}` : ''}${result.data.htmlLink ? `\nCalendar: ${result.data.htmlLink}` : ''}`);
        return true;
      }

      if (sub === 'tasks-list') {
        const result = await services.tasks.tasks.list({ tasklist: '@default', maxResults: 10, showCompleted: false, showHidden: false });
        const lines = (result.data.items || []).map((task, index) => `${index + 1}. **${discordSafe(task.title, 180)}**${task.due ? ` — due ${formatDate(task.due)}` : ''}`);
        await interaction.editReply({ content: compactLines(lines, 'No incomplete tasks.'), allowedMentions: { parse: [] } });
        return true;
      }

      if (sub === 'tasks-add') {
        const due = interaction.options.getString('due');
        if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('Use `YYYY-MM-DD` for the due date.');
        const result = await services.tasks.tasks.insert({ tasklist: '@default', requestBody: { title: cleanText(interaction.options.getString('title', true)), due: due ? `${due}T00:00:00.000Z` : undefined } });
        await interaction.editReply(`✅ Task added: **${discordSafe(result.data.title, 180)}**`);
        return true;
      }

      if (sub === 'contacts-search') {
        const query = interaction.options.getString('query', true).toLowerCase();
        const result = await services.people.people.connections.list({ resourceName: 'people/me', pageSize: 500, personFields: 'names,emailAddresses' });
        const contacts = (result.data.connections || []).map((person) => ({
          name: person.names?.[0]?.displayName || 'Unnamed contact',
          emails: (person.emailAddresses || []).map((item) => item.value).filter(Boolean)
        })).filter((person) => `${person.name} ${person.emails.join(' ')}`.toLowerCase().includes(query)).slice(0, 10);
        const lines = contacts.map((person, index) => `${index + 1}. **${discordSafe(person.name, 150)}** — ${discordSafe(person.emails.join(', ') || 'No email', 300)}`);
        await interaction.editReply({ content: compactLines(lines, 'No matching contacts.'), allowedMentions: { parse: [] } });
        return true;
      }

      await interaction.editReply('Unknown Google action.');
    } catch (error) {
      console.error(`Google command ${sub} failed:`, error?.response?.status || error?.code || error?.message);
      const inputMessage = String(error?.message || '');
      const userMessage = /^(Use |Enter |Email subject|Sheet values)/.test(inputMessage)
        ? inputMessage
        : friendlyGoogleError(error);
      await interaction.editReply(`❌ ${userMessage}`);
    }
    return true;
  }
}
