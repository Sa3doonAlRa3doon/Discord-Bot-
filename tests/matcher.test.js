import { describe, expect, it } from 'vitest';
import { findBestFaq, tokenize } from '../src/lib/matcher.js';

const faqs = [
  {
    question: 'How do I get access to the server?',
    answer: 'Verify in start-here.',
    keywords: ['access', 'verify', 'unlock', 'role']
  },
  {
    question: 'Where can I ask for help?',
    answer: 'Use help-desk.',
    keywords: ['help', 'support', 'problem']
  }
];

describe('FAQ matcher', () => {
  it('normalizes filler and punctuation', () => {
    expect(tokenize('How do I VERIFY, please?')).toEqual(['verify']);
  });

  it('finds the access answer', () => {
    expect(findBestFaq('how can i unlock and verify?', faqs)?.faq.answer).toBe('Verify in start-here.');
  });

  it('supports simple word stems', () => {
    expect(findBestFaq('I need supporting help', faqs)?.faq.answer).toBe('Use help-desk.');
  });

  it('returns null for unrelated questions', () => {
    expect(findBestFaq('what color is a banana', faqs)).toBeNull();
  });
});
