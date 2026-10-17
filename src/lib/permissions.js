import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

export const requiredChannelPermissions = [
  { label: 'View Channel', flag: PermissionFlagsBits.ViewChannel },
  { label: 'Send Messages', flag: PermissionFlagsBits.SendMessages },
  { label: 'Send Messages in Threads', flag: PermissionFlagsBits.SendMessagesInThreads },
  { label: 'Embed Links', flag: PermissionFlagsBits.EmbedLinks },
  { label: 'Read Message History', flag: PermissionFlagsBits.ReadMessageHistory },
  { label: 'Add Reactions', flag: PermissionFlagsBits.AddReactions },
  { label: 'Attach Files', flag: PermissionFlagsBits.AttachFiles },
  { label: 'Use External Emoji', flag: PermissionFlagsBits.UseExternalEmojis },
  { label: 'Use External Stickers', flag: PermissionFlagsBits.UseExternalStickers },
  { label: 'Manage Messages', flag: PermissionFlagsBits.ManageMessages },
  { label: 'Moderate Members', flag: PermissionFlagsBits.ModerateMembers },
  { label: 'Kick Members', flag: PermissionFlagsBits.KickMembers },
  { label: 'Ban Members', flag: PermissionFlagsBits.BanMembers },
  { label: 'Manage Channels', flag: PermissionFlagsBits.ManageChannels },
  { label: 'Manage Roles', flag: PermissionFlagsBits.ManageRoles },
  { label: 'Manage Server', flag: PermissionFlagsBits.ManageGuild },
  { label: 'Manage Expressions', flag: PermissionFlagsBits.ManageGuildExpressions },
  { label: 'View Audit Log', flag: PermissionFlagsBits.ViewAuditLog },
  { label: 'Connect to Voice', flag: PermissionFlagsBits.Connect },
  { label: 'Speak in Voice', flag: PermissionFlagsBits.Speak },
  { label: 'Create Public Threads', flag: PermissionFlagsBits.CreatePublicThreads },
  { label: 'Manage Threads', flag: PermissionFlagsBits.ManageThreads }
];

export const invitePermissions = new PermissionsBitField(
  requiredChannelPermissions.map((permission) => permission.flag)
).bitfield;

export function inspectChannelPermissions(permissions) {
  return requiredChannelPermissions.map((permission) => ({
    ...permission,
    allowed: Boolean(permissions?.has(permission.flag))
  }));
}

export function missingEssentialPermissions(permissions) {
  const essentialLabels = new Set([
    'View Channel',
    'Send Messages',
    'Embed Links',
    'Read Message History'
  ]);

  return inspectChannelPermissions(permissions)
    .filter((permission) => essentialLabels.has(permission.label) && !permission.allowed);
}

export function formatPermissionReport(channelName, permissions) {
  const checks = inspectChannelPermissions(permissions);
  const lines = checks.map((check) => `${check.allowed ? '✅' : '❌'} ${check.label}`);
  const missing = checks.filter((check) => !check.allowed);

  return [
    `🔧 **Hatclanker permission check: ${channelName}**`,
    '',
    ...lines,
    '',
    missing.length === 0
      ? '**All systems good.** Hatclanker can send messages, embeds, and external emoji here.'
      : '**Fix:** ask a server admin to allow the missing permissions for Hatclanker’s bot role and check this channel’s permission overrides.',
    '',
    '_Normal Unicode emoji like ⚙️ and 🚀 work with Send Messages. “Use External Emoji” is only for custom emoji from another server._'
  ].join('\n');
}
