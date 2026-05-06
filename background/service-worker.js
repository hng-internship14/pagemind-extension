import { summarizeWithAlgo } from '../utils/algo-summarizer.js';

const CACHE_PREFIX = 'summary_';
const RATE_LIMIT_MS = 1000;

// ─── Message Router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUMMARIZE') {
    handleSummarize(message, sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'CLEAR_CACHE') {
    handleClearCache(message.url, sendResponse);
    return true;
  }

  if (message.type === 'CHECK_CACHE') {
    handleCheckCache(message.url, sendResponse);
    return true;
  }
});

// ─── Cache Handlers ───────────────────────────────────────────────────────────
async function handleCheckCache(url, sendResponse) {
  try {
    const cacheKey = getCacheKey(url);
    const result = await chrome.storage.local.get(cacheKey);
    if (result[cacheKey]) {
      sendResponse({ cached: true, data: result[cacheKey] });
    } else {
      sendResponse({ cached: false });
    }
  } catch (err) {
    sendResponse({ cached: false });
  }
}

async function handleClearCache(url, sendResponse) {
  try {
    const cacheKey = getCacheKey(url);
    await chrome.storage.local.remove(cacheKey);
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ success: false });
  }
}

// ─── Summarize Handler ────────────────────────────────────────────────────────
async function handleSummarize({ content, url, title }, sendResponse) {
  try {
    // 1. Check cache
    const cacheKey = getCacheKey(url);
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) {
      await new Promise(r => setTimeout(r, 400));
      return sendResponse({ success: true, data: cached[cacheKey], fromCache: true });
    }

    // 2. Validate content
    if (!content || content.trim().length < 100) {
      return sendResponse({
        error: 'CONTENT_TOO_SHORT',
        message: 'This page doesn\'t have enough readable content.'
      });
    }

    // 3. Get API key
    const storage = await chrome.storage.local.get(['apiKey', 'trialUsed']);
    const apiKey = storage.apiKey;
    const trialUsed = storage.trialUsed;

    // Helper to attempt trial
    const attemptTrial = async (originalError = null) => {
      if (!trialUsed) {
        await chrome.storage.local.set({ trialUsed: true });
        const result = summarizeWithAlgo(content, title);
        return sendResponse({ 
          success: true, 
          data: result, 
          fromCache: false, 
          isTrial: true,
          originalError: originalError
        });
      }
      return null;
    };

    if (!apiKey) {
      const trialResult = await attemptTrial('NO_API_KEY');
      if (trialResult) return;
      return sendResponse({ error: 'NO_API_KEY' });
    }
    
    // 4. Call OpenAI API
    try {
      const result = await callOpenAIAPI(apiKey, content, title);
      
      // 5. Cache result
      await chrome.storage.local.set({ [cacheKey]: result });

      sendResponse({ success: true, data: result, fromCache: false });
    } catch (apiErr) {
      console.warn('[PageMind SW] API Error, checking trial fallback:', apiErr.message);
      const trialResult = await attemptTrial(apiErr.message);
      if (trialResult) return;
      
      // If trial already used, return the actual error
      sendResponse({ 
        error: apiErr.message === 'INVALID_KEY' ? 'INVALID_KEY' : 'UNKNOWN', 
        message: apiErr.message 
      });
    }

  } catch (err) {
    console.error('[PageMind SW] Fatal Error:', err);
    sendResponse({ error: 'UNKNOWN', message: err.message || 'Something went wrong.' });
  }
}

// ─── OpenAI API Call ──────────────────────────────────────────────────────────
async function callOpenAIAPI(apiKey, content, title) {
  const systemPrompt = `You are an expert content analyst. Given webpage content, produce a structured summary.
Response MUST be valid JSON. 
Shape: { "bullets": ["str",...], "keyInsights": ["str",...], "readingTime": "X min read", "highlightPhrases": ["verbatim phrase",...] }
Rules: 5-7 bullets, 3 insights, verbatim phrases (4-8 words).`;

  const userMessage = `Page Title: ${title}\n\nContent:\n${content.substring(0, 8000)}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (response.status === 401) {
    throw new Error('INVALID_KEY');
  }
  if (response.status === 429) {
    throw new Error('QUOTA_EXCEEDED');
  }
  if (!response.ok) {
    throw new Error(`API_ERROR_${response.status}`);
  }

  const data = await response.json();
  const rawJson = data.choices[0].message.content;
  return JSON.parse(rawJson);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCacheKey(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return `${CACHE_PREFIX}${Math.abs(hash)}`;
}
