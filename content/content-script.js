// ─── Message Router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    try {
      const result = extractContent();
      sendResponse(result);
    } catch (err) {
      sendResponse({ error: true, message: err.message });
    }
  }

  if (message.type === 'HIGHLIGHT_PHRASES') {
    try {
      const count = highlightPhrases(message.phrases || []);
      sendResponse({ success: true, highlighted: count });
    } catch (err) {
      sendResponse({ success: false, message: err.message });
    }
  }

  if (message.type === 'REMOVE_HIGHLIGHTS') {
    removeHighlights();
    sendResponse({ success: true });
  }

  return false;
});

// ─── Content Extraction ───────────────────────────────────────────────────────
function extractContent() {
  // Clone document to avoid mutating the real DOM
  const docClone = document.cloneNode(true);

  // Remove noisy elements
  const noiseSelectors = [
    'nav', 'header', 'footer', 'aside',
    'script', 'style', 'noscript', 'iframe',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
    '.sidebar', '.side-bar', '.nav', '.navbar', '.menu', '.header', '.footer',
    '.advertisement', '.ad', '.ads', '.ad-container', '.cookie-banner',
    '.social-share', '.share-buttons', '.related-posts', '.comments',
    '#sidebar', '#nav', '#header', '#footer', '#menu'
  ];

  noiseSelectors.forEach(selector => {
    try {
      docClone.querySelectorAll(selector).forEach(el => el.remove());
    } catch {
      // Ignore invalid selectors
    }
  });

  let content = '';

  // Priority 1: <article> element
  const article = docClone.querySelector('article');
  if (article) {
    content = cleanText(article.innerText || article.textContent);
  }

  // Priority 2: role="main" or <main>
  if (!content || content.length < 200) {
    const main = docClone.querySelector('[role="main"], main');
    if (main) {
      content = cleanText(main.innerText || main.textContent);
    }
  }

  // Priority 3: Heuristic — find highest-density content block
  if (!content || content.length < 200) {
    content = findBestContentBlock(docClone);
  }

  // Priority 4: Full body fallback
  if (!content || content.length < 100) {
    content = cleanText(docClone.body?.innerText || docClone.body?.textContent || '');
  }

  // Truncate to ~6000 chars to stay within token limits
  if (content.length > 6000) {
    content = content.substring(0, 6000) + '...';
  }

  return {
    content,
    title: document.title,
    url: window.location.href
  };
}

function findBestContentBlock(doc) {
  const candidates = doc.querySelectorAll(
    'div, section, article, main, .post, .entry, .content, .post-content, .article-body, .entry-content'
  );

  let best = null;
  let bestScore = 0;

  candidates.forEach(el => {
    const text = el.innerText || el.textContent || '';
    const words = text.trim().split(/\s+/).length;
    const tagCount = el.querySelectorAll('*').length || 1;
    const score = words / tagCount;

    // Penalize elements that look like nav/sidebar
    const className = (el.className || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const noiseSignals = ['nav', 'sidebar', 'menu', 'header', 'footer', 'ad', 'comment', 'widget'];
    const isPenalized = noiseSignals.some(sig => className.includes(sig) || id.includes(sig));

    const finalScore = isPenalized ? score * 0.1 : score;

    if (finalScore > bestScore && words > 50) {
      bestScore = finalScore;
      best = el;
    }
  });

  return best ? cleanText(best.innerText || best.textContent) : '';
}

function cleanText(text) {
  return text
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

// ─── Highlight Phrases ────────────────────────────────────────────────────────
const HIGHLIGHT_CLASS = 'pagemind-highlight';

function highlightPhrases(phrases) {
  // Remove existing highlights first
  removeHighlights();

  if (!phrases || phrases.length === 0) return 0;

  // Inject styles
  injectHighlightStyles();

  let count = 0;
  phrases.forEach(phrase => {
    const sanitized = sanitizePhrase(phrase);
    if (!sanitized) return;
    count += highlightTextInDOM(document.body, sanitized);
  });

  return count;
}

function highlightTextInDOM(rootNode, phrase) {
  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // Skip script/style/already-highlighted
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName?.toLowerCase();
        if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.classList?.contains(HIGHLIGHT_CLASS)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  let count = 0;
  const lowerPhrase = phrase.toLowerCase();

  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(lowerPhrase);
    if (idx === -1) return;

    try {
      const before = document.createTextNode(text.substring(0, idx));
      const match = document.createElement('mark');
      match.className = HIGHLIGHT_CLASS;
      match.textContent = text.substring(idx, idx + phrase.length);
      const after = document.createTextNode(text.substring(idx + phrase.length));

      const parent = textNode.parentNode;
      parent.insertBefore(before, textNode);
      parent.insertBefore(match, textNode);
      parent.insertBefore(after, textNode);
      parent.removeChild(textNode);
      count++;
    } catch {
      // Skip nodes that can't be modified
    }
  });

  return count;
}

function removeHighlights() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    }
  });
}

function injectHighlightStyles() {
  const id = 'pagemind-highlight-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background: rgba(0, 191, 165, 0.3) !important;
      color: inherit !important;
      border-radius: 2px !important;
      padding: 0 2px !important;
      box-shadow: 0 0 0 1px rgba(0, 191, 165, 0.5) !important;
      transition: background 0.2s ease !important;
    }
    .${HIGHLIGHT_CLASS}:hover {
      background: rgba(0, 191, 165, 0.5) !important;
    }
  `;
  document.head.appendChild(style);
}

// ─── Security: Sanitize phrase before DOM use ─────────────────────────────────
function sanitizePhrase(str) {
  if (typeof str !== 'string') return '';
  // Strip HTML and keep only safe characters
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[&<>"'`]/g, '')
    .trim()
    .substring(0, 100); // Max 100 chars
}
