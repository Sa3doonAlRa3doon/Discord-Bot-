import 'dotenv/config';
import { invitePermissions } from './lib/permissions.js';

const clientId = process.env.DISCORD_CLIENT_ID;

if (!clientId) {
  console.error('Missing DISCORD_CLIENT_ID. Add it to .env, then run this command again.');
  process.exit(1);
}

const query = new URLSearchParams({
  client_id: clientId,
  permissions: invitePermissions.toString(),
  scope: 'bot applications.commands'
});

console.log('Open this link and ask the server owner to approve it:');
console.log(`https://discord.com/oauth2/authorize?${query}`);
