import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandDefinitions } from './commands.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

try {
  console.log(`Registering ${commandDefinitions.length} commands ${guildId ? `in test server ${guildId}` : 'globally'}…`);
  await rest.put(route, { body: commandDefinitions });
  console.log('Hatclanker commands registered. ⚙️');
} catch (error) {
  console.error('Command registration failed:', error);
  process.exitCode = 1;
}
