/*
 * background.js — service worker.
 *
 * PRODUCTION responsibilities (keep these):
 *   - right-click quick-add context menus (curate from the feed)
 *   - open the onboarding wizard on first install
 *   - YTIF_OPEN_OPTIONS (the empty-state banner's "Add interests" button)
 *
 */
'use strict';

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'YTIF_OPEN_OPTIONS') {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  }
});

// ---- Right-click quick-add ------------------------------------------------
// Lets the user curate the filter straight from the feed: right-click a video to
// always-show or block its channel, or right-click selected text to add it as an
// interest. The content script supplies the channel of the right-clicked card.

const YT_PATTERNS = ['*://www.youtube.com/*'];

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ytif-allow-channel',
      title: 'YouTube Filter: always-show this channel',
      contexts: ['all'],
      documentUrlPatterns: YT_PATTERNS,
    });
    chrome.contextMenus.create({
      id: 'ytif-block-channel',
      title: 'YouTube Filter: block this channel',
      contexts: ['all'],
      documentUrlPatterns: YT_PATTERNS,
    });
    chrome.contextMenus.create({
      id: 'ytif-add-interest',
      title: 'YouTube Filter: add “%s” as interest',
      contexts: ['selection'],
      documentUrlPatterns: YT_PATTERNS,
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  createMenus();
  // First install → open the onboarding wizard so the user picks interests.
  if (details && details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/onboarding.html') });
  }
});
chrome.runtime.onStartup.addListener(createMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(
    tab.id,
    {
      type: 'YTIF_CTX',
      menuItemId: info.menuItemId,
      selectionText: info.selectionText || '',
    },
    // Swallow "no receiver" when the content script isn't present (e.g. a
    // youtube.com tab opened before the extension loaded).
    () => void chrome.runtime.lastError
  );
});
