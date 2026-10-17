const BLOCKED = ['fuck', 'shit', 'damn', 'hell', 'bitch', 'asshole', 'bastard'];

const pattern = new RegExp(`\\b(${BLOCKED.join('|')})\\b`, 'gi');

export function cleanText(value) {
  return String(value ?? '').replace(pattern, (word) => '•'.repeat(Math.max(3, word.length)));
}

export function containsBlockedLanguage(value) {
  pattern.lastIndex = 0;
  return pattern.test(String(value ?? ''));
}
