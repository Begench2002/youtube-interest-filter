/*
 * extract.js — DOM text extraction for the content script, kept separate so it
 * can be unit-tested with a DOM (see tests/extract.test.js, happy-dom).
 *
 * firstText() walks a fallback chain of selectors within a card element and
 * returns the first usable text, preferring the `title` attribute and skipping
 * aria-hidden duplicate/badge nodes (which would otherwise pollute matching).
 *
 * Dual-loadable: window.__YTIF.extract in the browser, module.exports in Node.
 */
'use strict';

function firstText(root, selectorList) {
  if (!root || !selectorList || !root.querySelector) return '';
  for (let i = 0; i < selectorList.length; i++) {
    let el;
    try {
      el = root.querySelector(selectorList[i]);
    } catch (e) {
      continue; // invalid selector — skip it
    }
    if (!el) continue;
    // Skip text that is aria-hidden (YouTube uses it for duplicate/badge text
    // like "LIVE", view-count overlays, etc.) so it can't pollute the match.
    try {
      if (el.closest && el.closest('[aria-hidden="true"]')) continue;
    } catch (e) {
      /* ignore */
    }
    const t = ((el.getAttribute && el.getAttribute('title')) || el.textContent || '').trim();
    if (t) return t;
  }
  return '';
}

const extract = { firstText };

if (typeof window !== 'undefined') {
  window.__YTIF = window.__YTIF || {};
  window.__YTIF.extract = extract;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = extract;
}
