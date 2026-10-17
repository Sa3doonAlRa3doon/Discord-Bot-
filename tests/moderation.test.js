import { describe, expect, it } from 'vitest';
import { capsPercent, extractDomains, scanContent } from '../src/lib/moderation.js';

const security = {
  bannedWords: ['forbidden'],
  blockedDomains: ['bad.example'],
  blockedPhrases: ['free nitro click here']
};

describe('moderation filters', () => {
  it('calculates excessive capitalization using letters only', () => {
    expect(capsPercent('THIS IS LOUD!!!')).toBe(100);
    expect(capsPercent('This is fine.')).toBeLessThan(50);
  });

  it('extracts normalized URL domains', () => {
    expect(extractDomains('visit https://www.Example.com/path')).toEqual(['example.com']);
  });

  it('detects whole banned words without substring false positives', () => {
    expect(scanContent('that is forbidden!', security)?.type).toBe('banned-word');
    expect(scanContent('forbiddenish is different', security)).toBeNull();
  });

  it('detects scam phrases and blocked subdomains', () => {
    expect(scanContent('FREE NITRO CLICK HERE now', security)?.type).toBe('scam-phrase');
    expect(scanContent('https://login.bad.example/claim', security)?.type).toBe('blocked-domain');
  });

  it('flags obvious brand-impersonation domains but trusts official ones', () => {
    expect(scanContent('claim https://discord-nitro-gift.example/now', security)?.type).toBe('possible-brand-impersonation');
    expect(scanContent('join https://discord.gg/example', security)).toBeNull();
  });
});
