/**
 * PageMind Sanitization Utility
 * Prevents XSS when inserting dynamic content into the DOM.
 */

/**
 * Sanitize a string for safe insertion as text content.
 * Strips HTML tags and encodes dangerous characters.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';

  return str
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .trim();
}

/**
 * Safely set text content of a DOM element (no HTML injection).
 * @param {HTMLElement} el
 * @param {string} text
 */
export function setTextSafe(el, text) {
  if (!el) return;
  el.textContent = typeof text === 'string' ? text : '';
}

/**
 * Create a <li> element with sanitized text.
 * @param {string} text
 * @returns {HTMLLIElement}
 */
export function createSafeListItem(text) {
  const li = document.createElement('li');
  li.textContent = typeof text === 'string' ? text : '';
  return li;
}
