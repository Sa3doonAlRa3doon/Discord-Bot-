const stopWords = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'for', 'how', 'i', 'in', 'is', 'it',
  'me', 'my', 'of', 'on', 'please', 'the', 'to', 'what', 'where', 'with'
]);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

function wordSimilarity(left, right) {
  if (left === right) return 1;
  if (left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left))) {
    return 0.72;
  }
  return 0;
}

export function scoreFaq(question, faq) {
  const queryWords = tokenize(question);
  const keywordWords = tokenize([faq.question, ...(faq.keywords ?? [])].join(' '));

  if (queryWords.length === 0 || keywordWords.length === 0) return 0;

  const matched = queryWords.reduce((score, queryWord) => {
    const best = keywordWords.reduce(
      (max, keywordWord) => Math.max(max, wordSimilarity(queryWord, keywordWord)),
      0
    );
    return score + best;
  }, 0);

  return matched / Math.sqrt(queryWords.length * keywordWords.length);
}

export function findBestFaq(question, faqs, minimumScore = 0.18) {
  const ranked = faqs
    .map((faq) => ({ faq, score: scoreFaq(question, faq) }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score >= minimumScore ? ranked[0] : null;
}
