import { describe, expect, it } from 'vitest';
import {
  buildMimeMessage,
  extractGoogleDocText,
  googleWorkspaceSettings,
  isGoogleUserAllowed,
  parseAllowedUserIds,
  parseGridValues
} from '../src/lib/google-workspace.js';

describe('Google Workspace security helpers', () => {
  it('denies everyone when no Discord-user allowlist is configured', () => {
    const settings = googleWorkspaceSettings({ GOOGLE_ALLOWED_USER_IDS: '', GOOGLE_TOKEN_PATH: './token.json' }, 'C:/Users/test');
    expect(settings.allowedUserIds.size).toBe(0);
    expect(isGoogleUserAllowed('123456789012345678', settings)).toBe(false);
  });

  it('keeps only valid Discord IDs in the allowlist', () => {
    expect([...parseAllowedUserIds('123456789012345678, nope 987654321098765432')]).toEqual([
      '123456789012345678',
      '987654321098765432'
    ]);
  });

  it('builds a base64url email and rejects recipient-header injection', () => {
    expect(() => buildMimeMessage({ to: 'friend@example.com\r\nBcc: attacker@example.com', subject: 'Hello', body: 'Clean message' })).toThrow('valid recipient');
    const raw = Buffer.from(buildMimeMessage({ to: 'friend@example.com', subject: 'Hello\r\nInjected', body: 'Clean message' }), 'base64url').toString('utf8');
    expect(raw).not.toContain('\r\nInjected');
    expect(raw).toContain('To: friend@example.com');
    expect(raw).toContain('Content-Type: text/plain; charset=UTF-8');
  });

  it('parses compact Sheet rows and columns with safety limits', () => {
    expect(parseGridValues('Name|Status;Jarvis|Ready')).toEqual([
      ['Name', 'Status'],
      ['Jarvis', 'Ready']
    ]);
    expect(() => parseGridValues('')).toThrow('cannot be empty');
  });

  it('extracts paragraph and table text from a Google Doc', () => {
    expect(extractGoogleDocText({
      body: {
        content: [
          { paragraph: { elements: [{ textRun: { content: 'Hello\n' } }] } },
          { table: { tableRows: [{ tableCells: [{ content: [{ paragraph: { elements: [{ textRun: { content: 'Cell' } }] } }] }] }] } }
        ]
      }
    })).toBe('Hello\nCell');
  });
});
