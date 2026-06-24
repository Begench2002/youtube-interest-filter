/*
 * matcher.js — pure keyword-matching logic for YouTube Interest Filter.
 *
 * No DOM, no chrome APIs: just functions that decide whether a video (given its
 * title + channel) should be shown or hidden. This keeps the core logic fully
 * unit-testable in Node (see tests/matcher.test.js).
 *
 * Dual-loadable on purpose:
 *   - As a content script (classic script): attaches to window.__YTIF.matcher
 *   - In Node/vitest: exported via module.exports
 */
'use strict';

// Escape regex metacharacters so user keywords are matched as literal text.
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Lowercase, (optionally) strip diacritics, and collapse runs of whitespace so
// "Café" matches "cafe" and "machine  learning" / a non-breaking space matches
// "machine learning".
function normalizeText(text, normalizeDiacritics) {
  let t = String(text == null ? '' : text).toLowerCase();
  if (normalizeDiacritics) {
    t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

// Parse a user's free-text keyword box into a clean keyword list. Splits on
// commas AND newlines (so "ai, ml\nllm" works), trims each entry, drops blanks,
// and de-dupes case-insensitively while preserving the first-seen casing.
// Multi-word phrases are kept intact (only commas/newlines separate).
function parseKeywords(text) {
  const seen = new Set();
  const out = [];
  String(text == null ? '' : text)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .forEach((s) => {
      const key = s.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    });
  return out;
}

// Cheap stable string hash (for per-card stamps in the content script).
function hashStr(s) {
  const str = String(s);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

// Per-card stamp signature. Keyed on the visible text and the settings revision,
// so a late-hydrating title, a recycled node showing a new video, or a settings
// change all force re-evaluation. ( separates title/channel unambiguously.)
function signature(settingsRev, title, channel) {
  return settingsRev + '|' + hashStr(String(title) + '' + String(channel));
}

// Add a value to a keyword list, returning a NEW array (does not mutate). Trims,
// skips blanks, and de-dupes case-insensitively. Used by the right-click quick-add.
function addKeyword(list, value) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const v = String(value == null ? '' : value).trim();
  if (!v) return arr;
  const lower = v.toLowerCase();
  if (arr.some((k) => String(k).trim().toLowerCase() === lower)) return arr;
  arr.push(v);
  return arr;
}

// Remove a value from a keyword list, returning a NEW array (does not mutate).
// Case-insensitive, whitespace-tolerant; removes all matching entries. Used by
// the quick-add "Undo".
function removeKeyword(list, value) {
  const arr = Array.isArray(list) ? list : [];
  const v = String(value == null ? '' : value).trim().toLowerCase();
  if (!v) return arr.slice();
  return arr.filter((k) => String(k).trim().toLowerCase() !== v);
}

// Compile a list of keywords into a single RegExp (or null if the list is empty).
// matchMode:
//   'loose' = substring;
//   'word'  = strict whole-word (Unicode-aware boundaries);
//   'smart' = whole-word + plural stemming, so "transformer" matches
//             "transformers", "box" matches "boxes", and "strategy" matches
//             "strategies" — without matching unrelated substrings or verb forms
//             (so "react" does NOT match "reacting", avoiding reaction-video noise).
function compileKeywords(keywords, matchMode, normalizeDiacritics) {
  const cleaned = (keywords || [])
    .map((k) => normalizeText(k, normalizeDiacritics).trim())
    .filter((k) => k.length > 0);

  if (cleaned.length === 0) return null;

  const L = '(?<![\\p{L}\\p{N}_])'; // left word boundary
  const R = '(?![\\p{L}\\p{N}_])'; // right word boundary
  const escaped = cleaned.map(escapeRegExp);
  let pattern;
  if (matchMode === 'loose') {
    pattern = escaped.join('|');
  } else if (matchMode === 'word') {
    pattern = escaped.map((e) => `${L}${e}${R}`).join('|');
  } else {
    // 'smart' (default): whole-word + plural stemming only. Keyword ending in
    // 'y' also matches its '-ies' form; others optionally take '-s'/'-es'. Verb
    // suffixes (-ing/-ed) are intentionally excluded to avoid false positives
    // like "react" -> "reacting" or "rust" -> "rusted".
    pattern = escaped
      .map((e) => {
        const body = e.endsWith('y') ? e.slice(0, -1) + '(?:y|ies)' : e + '(?:s|es)?';
        return `${L}${body}${R}`;
      })
      .join('|');
  }
  // 'i' = case-insensitive (defensive), 'u' = needed for \p{...} classes.
  // No 'g' flag, so .test() is stateless and safe to reuse.
  return new RegExp(pattern, 'iu');
}

// Precompile settings into a reusable matcher object. Call once per settings
// change, not once per video card.
function buildMatcher(settings) {
  const s = settings || {};
  const normalizeDiacritics = s.normalizeDiacritics !== false;
  return {
    masterEnabled: s.masterEnabled !== false,
    normalizeDiacritics,
    interestRe: compileKeywords(s.interests, s.matchMode, normalizeDiacritics),
    blockRe: compileKeywords(s.blockWords, s.matchMode, normalizeDiacritics),
    // Trusted channels: any video from a matching channel is always shown
    // (unless a block word applies). Matched against the channel name only.
    allowRe: compileKeywords(s.allowChannels, s.matchMode, normalizeDiacritics),
  };
}

// Decide whether a single video should be shown or hidden.
// Precedence: master off -> show; no interests -> show (never blank the feed);
// block word match -> hide; interest match -> show; otherwise -> hide.
function decide(title, channel, compiled) {
  const c = compiled || {};
  if (c.masterEnabled === false) return 'show';
  if (!c.interestRe) return 'show';

  const normChannel = normalizeText(String(channel || ''), c.normalizeDiacritics);
  const haystack = normalizeText(
    String(title || '') + ' ' + String(channel || ''),
    c.normalizeDiacritics
  );

  // Precedence: block words win over everything; then trusted channels are
  // always shown; then interest matches; otherwise hide.
  if (c.blockRe && c.blockRe.test(haystack)) return 'hide';
  if (c.allowRe && c.allowRe.test(normChannel)) return 'show';
  if (c.interestRe.test(haystack)) return 'show';
  return 'hide';
}

const matcher = {
  escapeRegExp,
  normalizeText,
  parseKeywords,
  addKeyword,
  removeKeyword,
  hashStr,
  signature,
  compileKeywords,
  buildMatcher,
  decide,
};

// Browser content-script: expose on the shared namespace.
if (typeof window !== 'undefined') {
  window.__YTIF = window.__YTIF || {};
  window.__YTIF.matcher = matcher;
}

// Node / vitest: CommonJS export.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = matcher;
}
