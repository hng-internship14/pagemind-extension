/**
 * PageMind Popup Script
 * Controls UI state, messaging, and user interactions.
 */

import { createSafeListItem, setTextSafe } from '../utils/sanitize.js';

// DOM References
const keySetupPanel   = document.getElementById('key-setup');
const mainPanel       = document.getElementById('main-panel');
const loadingState    = document.getElementById('loading-state');
const resultsPanel    = document.getElementById('results-panel');
const errorBanner     = document.getElementById('error-msg');
const errorText       = document.getElementById('error-text');
const errorDismiss    = document.getElementById('error-dismiss');

const apiKeyInput     = document.getElementById('api-key-input');
const keyError        = document.getElementById('key-error');
const saveKeyBtn      = document.getElementById('save-key-btn');
const toggleVisBtn    = document.getElementById('toggle-key-visibility');

const pageTitleDisp   = document.getElementById('page-title-display');
const summarizeBtn    = document.getElementById('summarize-btn');

const readingTimeTxt  = document.getElementById('reading-time-text');
const wordCountTxt    = document.getElementById('word-count-text');
const cachedBadge     = document.getElementById('cached-badge');
const trialBadge      = document.getElementById('trial-badge');
const bulletsList     = document.getElementById('bullets-list');
const insightsList    = document.getElementById('insights-list');

const copyBtn         = document.getElementById('copy-btn');
const highlightBtn    = document.getElementById('highlight-btn');
const clearBtn        = document.getElementById('clear-btn');
const settingsBtn     = document.getElementById('settings-btn');

// App State
let currentSummary = null;
let highlightsActive = false;
let currentTab = null;

// Init
document.addEventListener('DOMContentLoaded', async () => {
  currentTab = await getActiveTab();
  await initUI();
  bindEvents();
});

async function initUI() {
  const storage = await chrome.storage.local.get(['apiKey', 'trialUsed']);
  if (!storage.apiKey && storage.trialUsed) {
    showPanel('key-setup');
  } else {
    showPanel('main');
    setPageTitle();
  }
}

function showPanel(name) {
  keySetupPanel.classList.add('hidden');
  mainPanel.classList.add('hidden');
  loadingState.classList.add('hidden');
  resultsPanel.classList.add('hidden');

  if (name === 'key-setup') keySetupPanel.classList.remove('hidden');
  else if (name === 'main') mainPanel.classList.remove('hidden');
  else if (name === 'loading') loadingState.classList.remove('hidden');
  else if (name === 'results') resultsPanel.classList.remove('hidden');
}

function showError(msg) {
  setTextSafe(errorText, msg);
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

async function setPageTitle() {
  if (!currentTab) return;
  const raw = currentTab.title || currentTab.url || 'Untitled page';
  setTextSafe(pageTitleDisp, raw);
}

function bindEvents() {
  saveKeyBtn.addEventListener('click', handleSaveKey);
  apiKeyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSaveKey();
  });

  toggleVisBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
  });

  settingsBtn.addEventListener('click', () => {
    showPanel('key-setup');
    hideError();
  });

  summarizeBtn.addEventListener('click', handleSummarize);
  copyBtn.addEventListener('click', handleCopy);
  highlightBtn.addEventListener('click', handleHighlight);
  clearBtn.addEventListener('click', handleClear);
  errorDismiss.addEventListener('click', hideError);
}

async function handleSaveKey() {
  const key = apiKeyInput.value.trim();
  keyError.classList.add('hidden');

  if (!key || !key.startsWith('sk-')) {
    setTextSafe(keyError, 'Please enter a valid OpenAI key (sk-...).');
    keyError.classList.remove('hidden');
    return;
  }

  saveKeyBtn.disabled = true;
  await chrome.storage.local.set({ apiKey: key });
  saveKeyBtn.disabled = false;

  showPanel('main');
  setPageTitle();
}

async function handleSummarize() {
  hideError();
  currentSummary = null;
  highlightsActive = false;
  
  if (!currentTab?.url || currentTab.url.startsWith('chrome://')) {
    showError("Cannot summarize browser pages.");
    return;
  }

  showPanel('loading');
  summarizeBtn.disabled = true;

  try {
    const extracted = await sendMessageToTab({ type: 'EXTRACT_CONTENT' });
    if (!extracted || extracted.error) {
      throw new Error(extracted?.message || 'Failed to extract page content.');
    }

    const result = await sendMessageToBackground({
      type: 'SUMMARIZE',
      content: extracted.content,
      url: extracted.url,
      title: extracted.title
    });

    if (result.error) {
      handleErrorResult(result);
      return;
    }

    currentSummary = result.data;
    renderResults(result.data, result.fromCache, extracted.content, result.isTrial);
    showPanel('results');
  } catch (err) {
    showPanel('main');
    showError(err.message);
  } finally {
    summarizeBtn.disabled = false;
  }
}

function renderResults(data, fromCache, rawContent, isTrial = false) {
  setTextSafe(readingTimeTxt, data.readingTime || '--');
  const words = rawContent ? rawContent.trim().split(/\s+/).length : 0;
  setTextSafe(wordCountTxt, words + ' words');

  if (fromCache) cachedBadge.classList.remove('hidden');
  else cachedBadge.classList.add('hidden');

  if (isTrial) trialBadge.classList.remove('hidden');
  else trialBadge.classList.add('hidden');

  bulletsList.innerHTML = '';
  (data.bullets || []).forEach(text => bulletsList.appendChild(createSafeListItem(text)));

  insightsList.innerHTML = '';
  (data.keyInsights || []).forEach(text => insightsList.appendChild(createSafeListItem(text)));
}

async function handleCopy() {
  if (!currentSummary) return;
  const lines = [
    'PAGE SUMMARY',
    '---',
    ...(currentSummary.bullets || []),
    '',
    'INSIGHTS',
    ...(currentSummary.keyInsights || []),
    '',
    currentSummary.readingTime
  ];
  await navigator.clipboard.writeText(lines.join('\n'));
  copyBtn.textContent = 'Copied!';
  setTimeout(() => copyBtn.textContent = 'Copy', 2000);
}

async function handleHighlight() {
  if (!currentSummary?.highlightPhrases?.length) return;
  if (highlightsActive) {
    await sendMessageToTab({ type: 'REMOVE_HIGHLIGHTS' });
    highlightsActive = false;
    highlightBtn.classList.remove('active');
  } else {
    const result = await sendMessageToTab({
      type: 'HIGHLIGHT_PHRASES',
      phrases: currentSummary.highlightPhrases
    });
    if (result?.success) {
      highlightsActive = true;
      highlightBtn.classList.add('active');
    }
  }
}

async function handleClear() {
  if (highlightsActive) await sendMessageToTab({ type: 'REMOVE_HIGHLIGHTS' });
  if (currentTab?.url) await sendMessageToBackground({ type: 'CLEAR_CACHE', url: currentTab.url });
  currentSummary = null;
  showPanel('main');
}

function handleErrorResult(result) {
  showPanel('main');
  const msg = result.message || '';

  if (result.error === 'NO_API_KEY' || msg.includes('INVALID_KEY') || msg.includes('QUOTA_EXCEEDED')) {
    showPanel('key-setup');
    apiKeyInput.value = '';
    apiKeyInput.focus();
    
    let userMsg = 'Please enter a valid OpenAI API key.';
    if (msg.includes('QUOTA_EXCEEDED')) {
      userMsg = 'Quota exceeded. Please try a different API key.';
    } else if (msg.includes('INVALID_KEY')) {
      userMsg = 'Invalid API key. Please check and try again.';
    }
    
    setTextSafe(keyError, userMsg);
    keyError.classList.remove('hidden');
    return;
  }

  switch (result.error) {
    case 'CONTENT_TOO_SHORT':
      showError('Not enough page content to analyze.');
      break;
    default:
      showError('Error connecting to OpenAI. Please try again.');
  }
}

function sendMessageToBackground(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

function sendMessageToTab(msg) {
  return new Promise(resolve => {
    if (!currentTab?.id) {
      return resolve({ error: 'NO_TAB', message: 'No active tab found.' });
    }
    chrome.tabs.sendMessage(currentTab.id, msg, response => {
      if (chrome.runtime.lastError) {
        // This usually happens if the content script is not loaded (e.g. extension reloaded)
        resolve({ 
          error: 'CONNECTION_FAILED', 
          message: 'Could not connect to the page. Please refresh the page and try again.' 
        });
      } else {
        resolve(response);
      }
    });
  });
}

async function getActiveTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0]));
  });
}
