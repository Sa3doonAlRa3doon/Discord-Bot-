import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import {
  formatPermissionReport,
  inspectChannelPermissions,
  invitePermissions,
  missingEssentialPermissions
} from '../src/lib/permissions.js';

describe('permission diagnostics', () => {
  it('includes message, embed, and external emoji permissions in the invite', () => {
    const permissions = new PermissionsBitField(invitePermissions);
    expect(permissions.has(PermissionFlagsBits.SendMessages)).toBe(true);
    expect(permissions.has(PermissionFlagsBits.EmbedLinks)).toBe(true);
    expect(permissions.has(PermissionFlagsBits.UseExternalEmojis)).toBe(true);
    expect(permissions.has(PermissionFlagsBits.ManageRoles)).toBe(true);
    expect(permissions.has(PermissionFlagsBits.Connect)).toBe(true);
  });

  it('identifies essential channel permission failures', () => {
    const permissions = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory
    ]);
    expect(missingEssentialPermissions(permissions).map((item) => item.label)).toEqual([
      'Send Messages',
      'Embed Links'
    ]);
  });

  it('reports every permission in plain text', () => {
    const permissions = new PermissionsBitField(PermissionFlagsBits.ViewChannel);
    const report = formatPermissionReport('#general', permissions);
    expect(inspectChannelPermissions(permissions).length).toBeGreaterThan(15);
    expect(report).toContain('✅ View Channel');
    expect(report).toContain('❌ Send Messages');
    expect(report).toContain('Use External Emoji');
  });
});
