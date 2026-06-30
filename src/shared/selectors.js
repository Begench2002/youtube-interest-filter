/*
 * selectors.js — the ONE place to update when YouTube changes its markup.
 *
 * YouTube A/B-tests its DOM and is migrating from `ytd-*-renderer` custom
 * elements to `*-view-model` "lockup" elements, so every lookup uses a FALLBACK
 * CHAIN (try each selector in order). If filtering ever stops working after a
 * YouTube update, fixing the selectors here is usually the only change needed.
 *
 * Loaded as a classic content script; exposed on window.__YTIF.selectors.
 */
'use strict';

// Which surface (page type) are we on? Used to pick item selectors and to check
// that surface's enable toggle. Order matters: first match wins.
const SURFACES = [
  {
    key: 'home',
    // Home plus the Trending/Explore discovery feeds (all firehoses).
    test: (loc) =>
      loc.pathname === '/' ||
      loc.pathname === '/feed/trending' ||
      loc.pathname === '/feed/explore',
    // Grid cells + shelf "lockup" cards (People also watched / Explore shelves)
    // + the renderer used inside Trending/Explore shelves.
    items: [
      'ytd-rich-item-renderer',
      'ytd-grid-video-renderer',
      'yt-lockup-view-model',
      'ytd-video-renderer',
    ],
  },
  // NOTE: search results (/results) are intentionally NOT a filtered surface —
  // when you search for something specific you want all the results, not your
  // interest filter narrowing them.
  {
    key: 'subscriptions',
    test: (loc) => loc.pathname.startsWith('/feed/subscriptions'),
    items: ['ytd-rich-item-renderer', 'ytd-grid-video-renderer'],
  },
  {
    key: 'sidebar',
    test: (loc) => loc.pathname === '/watch',
    // The "Up next" / recommendations column. The main player is NEVER in here.
    items: ['yt-lockup-view-model', 'ytd-compact-video-renderer'],
  },
];

// The union of every video-card element type we filter, across all surfaces.
// Used to classify cards (so any type can be evaluated on any surface) and it
// MUST stay in sync with the `html.ytif-prehide ... :not([data-ytif-sig])` rule
// in content.css — otherwise a pre-hidden type that isn't classified here would
// stay hidden forever. None of these is the main watch-page player, so the
// playing video is never collected.
const ALL_ITEMS = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'yt-lockup-view-model',
  'ytd-compact-video-renderer',
];

// Title text, tried in order, within a single video card element.
const TITLE_SELECTORS = [
  'a#video-title-link',
  'a#video-title',
  '#video-title',
  'a.yt-lockup-metadata-view-model-wiz__title',
  '.yt-lockup-metadata-view-model-wiz__title',
  'h3 a.yt-lockup-metadata-view-model-wiz__title',
  '.yt-lockup-metadata-view-model__title',
  'yt-formatted-string#video-title',
  'h3 a',
  'h3 span',
];

// Channel name, tried in order, within a single video card element. Extra
// fallbacks (handle + /channel/ links, lockup metadata rows) reduce the chance
// of wrongly hiding a legitimate video when the channel can't be read.
const CHANNEL_SELECTORS = [
  'ytd-channel-name a',
  'yt-formatted-string.ytd-channel-name',
  '#channel-name a',
  '.yt-content-metadata-view-model-wiz__metadata-row a[href^="/@"]',
  'a[href^="/@"]',
  'a[href^="/channel/"]',
  '.yt-content-metadata-view-model-wiz__metadata-row',
  '.ytd-channel-name',
];

// Any anchor that points at a Short — used to catch Shorts disguised as normal
// cards, and as a fallback Shorts detector.
const SHORTS_LINK = 'a[href^="/shorts/"]';

// Shorts as a format: shelves (rows) and standalone lockups to remove wholesale
// when "hide all Shorts" is on.
const SHORTS = {
  shelves: [
    'ytd-rich-shelf-renderer[is-shorts]',
    'ytd-reel-shelf-renderer',
    'ytd-rich-section-renderer:has(' + SHORTS_LINK + ')',
    'grid-shelf-view-model:has(' + SHORTS_LINK + ')',
  ],
  items: [
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',
    'ytd-reel-item-renderer',
  ],
  // Left-nav / mini-guide entries that link to the Shorts tab.
  nav: [
    'ytd-guide-entry-renderer:has(a[title="Shorts"])',
    'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
    'a[title="Shorts"]',
  ],
  link: SHORTS_LINK,
};

// Ad units to remove when filtering is active. (In-feed ads wrapped in a
// rich-item are already caught by the "no video title" rule, but these cover the
// masthead banner and standalone ad renderers too.)
const ADS = [
  'ytd-ad-slot-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-display-ad-renderer',
  'ytd-statement-banner-renderer',
  'ytd-banner-promo-renderer',
  '#masthead-ad',
  'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
  'ytd-rich-section-renderer:has(ytd-ad-slot-renderer)',
];

const selectors = { SURFACES, ALL_ITEMS, TITLE_SELECTORS, CHANNEL_SELECTORS, SHORTS, ADS };

if (typeof window !== 'undefined') {
  window.__YTIF = window.__YTIF || {};
  window.__YTIF.selectors = selectors;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = selectors;
}
