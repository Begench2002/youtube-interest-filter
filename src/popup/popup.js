/*
 * popup.js — quick controls from the toolbar: master on/off, "show hidden",
 * live counts for the active tab, and a link to full settings.
 */
'use strict';

(function () {
  const { STORAGE_KEY, withDefaults } = window.__YTIF.defaults;

  const masterEl = document.getElementById('masterEnabled');
  const revealEl = document.getElementById('revealHidden');
  const shortsEl = document.getElementById('hideAllShorts');
  const shownEl = document.getElementById('shownNum');
  const hiddenEl = document.getElementById('hiddenNum');
  const noteEl = document.getElementById('note');
  const summaryEl = document.getElementById('summary');

  // Merge a single change into stored settings without clobbering the rest.
  function patch(partial) {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const next = withDefaults(data ? data[STORAGE_KEY] : null);
      Object.assign(next, partial);
      chrome.storage.local.set({ [STORAGE_KEY]: next }, () => {
        // give the content script a moment to re-apply, then refresh counts
        setTimeout(refreshCounts, 250);
      });
    });
  }

  function setNote(text) {
    noteEl.textContent = text || '';
  }

  function refreshCounts() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        shownEl.textContent = hiddenEl.textContent = '—';
        return;
      }
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'YTIF_GET_COUNTS' }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            shownEl.textContent = hiddenEl.textContent = '—';
            setNote('Open a YouTube page to see live counts.');
            return;
          }
          const c = resp.counts;
          const dimmed = c.dimmed || 0;
          shownEl.textContent = String(c.shown);
          // "filtered" = caught by the filter, whether hidden or (in show-hidden
          // mode) dimmed — so a visible dimmed card is never reported as hidden.
          hiddenEl.textContent = String(c.hidden + dimmed);
          if (!masterEl.checked) setNote('Filtering is off.');
          else if (c.shown === 0 && c.hidden === 0 && dimmed === 0) {
            setNote('No video cards on this page yet.');
          } else if (c.shown === 0 && c.hidden + dimmed > 0) {
            setNote('Nothing matched here — add interests or loosen matching.');
          } else if (revealEl.checked && dimmed > 0) {
            setNote(dimmed + ' dimmed (show-hidden on)');
          } else {
            setNote('');
          }
        });
      } catch (e) {
        shownEl.textContent = hiddenEl.textContent = '—';
      }
    });
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function showSummary(s) {
    const parts = [
      plural((s.interests || []).length, 'interest'),
      plural((s.allowChannels || []).length, 'always-show'),
      plural((s.blockWords || []).length, 'block word'),
    ];
    summaryEl.textContent = parts.join(' · ');
  }

  function boot() {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const s = withDefaults(data ? data[STORAGE_KEY] : null);
      masterEl.checked = s.masterEnabled;
      revealEl.checked = s.revealHidden;
      shortsEl.checked = s.hideAllShorts;
      showSummary(s);
      if (s.masterEnabled && (s.interests || []).length === 0) {
        setNote('No interests set — add some in settings.');
      }
      refreshCounts();
    });

    masterEl.addEventListener('change', () => patch({ masterEnabled: masterEl.checked }));
    revealEl.addEventListener('change', () => patch({ revealHidden: revealEl.checked }));
    shortsEl.addEventListener('change', () => patch({ hideAllShorts: shortsEl.checked }));
    document.getElementById('openOptions').addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
      else window.open(chrome.runtime.getURL('src/options/options.html'));
    });
  }

  boot();
})();
