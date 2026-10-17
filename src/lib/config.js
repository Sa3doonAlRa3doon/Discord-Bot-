import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = path.join(projectRoot, 'config', 'server.json');

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`config/server.json: ${label} must be a non-empty string.`);
  }
}

export function loadServerConfig() {
  let config;

  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${configPath}: ${error.message}`);
  }

  assertString(config.serverName, 'serverName');
  assertString(config.tagline, 'tagline');
  assertString(config.accentColor, 'accentColor');
  assertString(config.welcome, 'welcome');

  if (!/^#[0-9a-f]{6}$/i.test(config.accentColor)) {
    throw new Error('config/server.json: accentColor must look like #7C3AED.');
  }

  if (!Array.isArray(config.rules) || config.rules.length === 0) {
    throw new Error('config/server.json: rules must contain at least one rule.');
  }

  if (!Array.isArray(config.channels) || config.channels.length === 0) {
    throw new Error('config/server.json: channels must contain at least one channel.');
  }

  if (!Array.isArray(config.faqs) || config.faqs.length === 0) {
    throw new Error('config/server.json: faqs must contain at least one FAQ.');
  }

  const xpCooldownSeconds = Number(config.features?.xpCooldownSeconds ?? 60);
  if (!Number.isFinite(xpCooldownSeconds) || xpCooldownSeconds < 15 || xpCooldownSeconds > 3600) {
    throw new Error('config/server.json: features.xpCooldownSeconds must be between 15 and 3600.');
  }

  return {
    ...config,
    swearMode: false,
    features: {
      leveling: config.features?.leveling !== false,
      levelUpAnnouncements: config.features?.levelUpAnnouncements !== false,
      xpCooldownSeconds
    },
    color: Number.parseInt(config.accentColor.slice(1), 16)
  };
}

export { projectRoot };
