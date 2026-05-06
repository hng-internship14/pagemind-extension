/**
 * Simple Algorithm-based Summarizer
 * Provides a fallback when AI is unavailable for a one-time trial.
 */

export function summarizeWithAlgo(content, title) {
  const words = content.trim().split(/\s+/);
  const wordCount = words.length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200)) + ' min read';

  // Basic sentence splitting (naive but effective for demo)
  const sentences = content
    .replace(/([.?!])\s+/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 20);

  // 1. Bullets (Take first 5-7 informative sentences)
  const bullets = sentences
    .slice(0, 10)
    .filter(s => !s.toLowerCase().includes('click here') && !s.toLowerCase().includes('subscribe'))
    .slice(0, 6);

  // 2. Key Insights (Take some from middle or end, or just first 3 unique ones)
  const keyInsights = sentences
    .slice(bullets.length, bullets.length + 3)
    .map(s => s.length > 100 ? s.substring(0, 97) + '...' : s);

  // 3. Highlight Phrases (Random fragments of 4-8 words)
  const highlightPhrases = [];
  if (sentences.length > 0) {
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(Math.random() * Math.min(sentences.length, 15));
      const sWords = sentences[idx].split(' ');
      if (sWords.length >= 6) {
        const start = Math.floor(Math.random() * (sWords.length - 5));
        highlightPhrases.push(sWords.slice(start, start + 6).join(' '));
      }
    }
  }

  return {
    bullets: bullets.length ? bullets : ["Unable to extract meaningful bullets from this page."],
    keyInsights: keyInsights.length ? keyInsights : ["Review the page content for more details."],
    readingTime,
    highlightPhrases
  };
}
