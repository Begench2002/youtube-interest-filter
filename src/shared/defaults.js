/*
 * defaults.js — the default settings object + schema, plus a small helper that
 * fills in any missing keys from stored settings (forward-compatible loads).
 *
 * Loaded as a classic script in the content script, options page, and popup.
 * Exposes everything on the shared window.__YTIF namespace.
 */
'use strict';

const STORAGE_KEY = 'ytifSettings';

const DEFAULT_SETTINGS = {
  schemaVersion: 1,
  masterEnabled: true, // global on/off
  interests: [], // keyword/topic strings; empty => show everything
  blockWords: [], // force-hide; overrides interests
  allowChannels: [], // trusted channels: always shown (unless a block word hits)
  matchMode: 'smart', // 'smart' (whole-word + light stemming) | 'word' | 'loose'
  normalizeDiacritics: true, // "café" matches "cafe"
  hideAllShorts: true, // remove all Shorts shelves + items
  surfaces: {
    home: true,
    search: true,
    sidebar: true,
    subscriptions: true,
  },
  revealHidden: false, // temporary "show hidden anyway" override
  onboarded: false, // has the first-run wizard been completed/skipped?
  appliedPacks: [], // ids of interest packs the user applied
};

// Keep only string entries; tolerate a non-array (e.g. a hand-edited import).
function asStringArray(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

// Merge stored settings over the defaults so new keys always have a value, and
// coerce types so a malformed stored/imported object can never crash the matcher.
function withDefaults(stored) {
  const s = stored && typeof stored === 'object' ? stored : {};
  const storedSurfaces =
    s.surfaces && typeof s.surfaces === 'object' && !Array.isArray(s.surfaces)
      ? s.surfaces
      : {};
  const surfaces = {};
  for (const key of Object.keys(DEFAULT_SETTINGS.surfaces)) {
    surfaces[key] =
      key in storedSurfaces ? storedSurfaces[key] !== false : DEFAULT_SETTINGS.surfaces[key];
  }
  const merged = { ...DEFAULT_SETTINGS, ...s, surfaces };
  merged.interests = asStringArray(merged.interests);
  merged.blockWords = asStringArray(merged.blockWords);
  merged.allowChannels = asStringArray(merged.allowChannels);
  merged.appliedPacks = asStringArray(merged.appliedPacks);
  merged.matchMode = ['smart', 'word', 'loose'].includes(merged.matchMode)
    ? merged.matchMode
    : 'smart';
  merged.masterEnabled = merged.masterEnabled !== false;
  merged.normalizeDiacritics = merged.normalizeDiacritics !== false;
  merged.hideAllShorts = merged.hideAllShorts !== false;
  merged.revealHidden = merged.revealHidden === true;
  merged.onboarded = merged.onboarded === true;
  return merged;
}

// Count the configured lists (after coercion), for honest UI feedback.
function summarize(settings) {
  const s = withDefaults(settings);
  return {
    interests: s.interests.length,
    blockWords: s.blockWords.length,
    allowChannels: s.allowChannels.length,
  };
}

const defaultsModule = { STORAGE_KEY, DEFAULT_SETTINGS, withDefaults, summarize };

if (typeof window !== 'undefined') {
  window.__YTIF = window.__YTIF || {};
  window.__YTIF.defaults = defaultsModule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = defaultsModule;
}
