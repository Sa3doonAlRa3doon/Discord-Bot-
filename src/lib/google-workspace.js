import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';

const DISCORD_ID = /^\d{16,22}$/;

export function parseAllowedUserIds(value = '') {
  return new Set(String(value).split(/[\s,]+/).map((entry) => entry.trim()).filter((entry) => DISCORD_ID.test(entry)));
}

export function googleWorkspaceSettings(env = process.env, homeDirectory = os.homedir()) {
  return {
    tokenPath: path.resolve(env.GOOGLE_TOKEN_PATH || path.join(homeDirectory, 'jarvis-google', 'token.json')),
    allowedUserIds: parseAllowedUserIds(env.GOOGLE_ALLOWED_USER_IDS)
  };
}

export function isGoogleUserAllowed(userId, settings = googleWorkspaceSettings()) {
  return settings.allowedUserIds.has(String(userId));
}

export function buildMimeMessage({ to, subject, body }) {
  const safeTo = String(to).replace(/[\r\n]/g, '').trim();
  const safeSubject = String(subject).replace(/[\r\n]/g, ' ').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeTo)) throw new Error('Enter one valid recipient email address.');
  if (!safeSubject) throw new Error('Email subject cannot be empty.');
  const encodedSubject = `=?UTF-8?B?${Buffer.from(safeSubject, 'utf8').toString('base64')}?=`;
  const message = [
    `To: ${safeTo}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    String(body)
  ].join('\r\n');
  return Buffer.from(message, 'utf8').toString('base64url');
}

export function parseGridValues(value) {
  const rows = String(value ?? '')
    .split(/\r?\n|;/)
    .map((row) => row.split('|').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
  if (rows.length === 0) throw new Error('Sheet values cannot be empty.');
  if (rows.length > 25 || rows.some((row) => row.length > 10)) {
    throw new Error('Sheet values are limited to 25 rows and 10 columns per command.');
  }
  return rows;
}

function structuralText(elements = []) {
  const parts = [];
  for (const element of elements) {
    if (element.paragraph) {
      parts.push(...(element.paragraph.elements || []).map((item) => item.textRun?.content || ''));
    }
    if (element.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) parts.push(structuralText(cell.content));
      }
    }
    if (element.tableOfContents) parts.push(structuralText(element.tableOfContents.content));
  }
  return parts.join('');
}

export function extractGoogleDocText(document) {
  const tabText = (document?.tabs || []).map((tab) => structuralText(tab.documentTab?.body?.content)).join('\n');
  return (tabText || structuralText(document?.body?.content)).trim();
}

export async function loadGoogleAuth(tokenPath) {
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`Google token not found at ${tokenPath}`);
    throw new Error('Google token could not be read.');
  }
  if (raw.type !== 'authorized_user' || !raw.client_id || !raw.client_secret || !raw.refresh_token) {
    throw new Error('Google token file is invalid or incomplete.');
  }
  return google.auth.fromJSON(raw);
}

export function createGoogleServices(auth) {
  return {
    gmail: google.gmail({ version: 'v1', auth }),
    calendar: google.calendar({ version: 'v3', auth }),
    drive: google.drive({ version: 'v3', auth }),
    docs: google.docs({ version: 'v1', auth }),
    sheets: google.sheets({ version: 'v4', auth }),
    slides: google.slides({ version: 'v1', auth }),
    forms: google.forms({ version: 'v1', auth }),
    tasks: google.tasks({ version: 'v1', auth }),
    people: google.people({ version: 'v1', auth })
  };
}
