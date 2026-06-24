/*
 * content.js — orchestrates filtering on YouTube.
 *
 * Responsibilities:
 *   - Load settings from chrome.storage.local and react to live changes.
 *   - Detect the current surface (home/search/sidebar/subscriptions).
 *   - On an initial pass + a debounced MutationObserver + YouTube's SPA
 *     navigation event, find video cards and hide the ones that don't match.
 *   - Remove Shorts wholesale when "hide all Shorts" is on.
 *   - Answer count queries from the popup.
 *
 * Depends on (loaded first via the manifest): window.__YTIF.{matcher,defaults,selectors}
 */
'use strict';

(function () {
  const ns = window.__YTIF || {};
  const matcher = ns.matcher;
  const defaults = ns.defaults;
  const selectors = ns.selectors;
  const extract = ns.extract;
  if (!matcher || !defaults || !selectors || !extract) {
    console.warn('[YTIF] shared modules missing; aborting.');
    return;
  }

  // Bumped whenever the content script changes — lets tooling verify (from the
  // page) which version is actually live after a reload.
  const VERSION = '2026.06.24-clean';
  const HIDDEN_CLASS = 'ytif-hidden';
  const DIMMED_CLASS = 'ytif-dimmed';
  const STAMP = 'data-ytif-sig';

  let settings = defaults.withDefaults(null);
  let compiled = matcher.buildMatcher(settings);
  let settingsRev = 0; // bumped on every settings change to invalidate stamps
  let counts = { shown: 0, hidden: 0, dimmed: 0, noText: 0 };

  // ---- text extraction (shared, unit-tested in extract.js) ----------------

  const firstText = extract.firstText;

  function currentSurface() {
    for (const s of selectors.SURFACES) {
      try {
        if (s.test(location)) return s;
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  function isShort(card) {
    try {
      return !!card.querySelector(selectors.SHORTS.link);
    } catch (e) {
      return false;
    }
  }

  // Cheap stable hash of a string (for the per-card stamp).
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  // Signature changes when the card's visible text changes (lazy hydration or a
  // recycled node now showing a different video) or when settings change — all
  // require re-evaluation. Keyed on the TEXT we actually match against (not just
  // href), so a late-loading matching title is never locked into a stale "hide".
  function signature(title, channel) {
    return settingsRev + '|' + hashStr(title + '' + channel);
  }

  function setState(card, state) {
    // state: 'show' | 'hide' | 'dim'
    card.classList.toggle(HIDDEN_CLASS, state === 'hide');
    card.classList.toggle(DIMMED_CLASS, state === 'dim');
  }

  // ---- Shorts -------------------------------------------------------------

  // Toggle whole Shorts shelves / standalone lockups / nav entries based on the
  // setting. (Shorts that appear as ordinary cards are handled in processCard.)
  function syncShorts() {
    const on = !!settings.hideAllShorts;
    const groups = [selectors.SHORTS.shelves, selectors.SHORTS.items, selectors.SHORTS.nav];
    for (const group of groups) {
      for (const sel of group) {
        let nodes;
        try {
          nodes = document.querySelectorAll(sel);
        } catch (e) {
          continue;
        }
        nodes.forEach((n) => n.classList.toggle(HIDDEN_CLASS, on));
      }
    }
  }

  // Toggle ad units based on whether filtering is active for this surface.
  function syncAds(on) {
    for (const sel of selectors.ADS) {
      let nodes;
      try {
        nodes = document.querySelectorAll(sel);
      } catch (e) {
        continue;
      }
      nodes.forEach((n) => n.classList.toggle(HIDDEN_CLASS, on));
    }
  }

  // ---- main filtering -----------------------------------------------------

  function collectCards() {
    // Classify the full card-type set on every surface (so any pre-hidden type
    // is always evaluated and can reappear; types absent on a surface are no-ops).
    const set = new Set();
    for (const sel of selectors.ALL_ITEMS) {
      let nodes;
      try {
        nodes = document.querySelectorAll(sel);
      } catch (e) {
        continue;
      }
      nodes.forEach((n) => set.add(n));
    }
    return set;
  }

  function tally(card) {
    if (card.classList.contains(DIMMED_CLASS)) counts.dimmed++;
    else if (card.classList.contains(HIDDEN_CLASS)) counts.hidden++;
    else counts.shown++;
  }

  // Apply a verdict and count it honestly. A "filtered" card is removed (hidden)
  // normally, or dimmed when "show hidden" is on — counted in separate buckets
  // so the popup never reports a visible (dimmed) card as hidden.
  function applyVerdict(card, keep) {
    if (keep) {
      setState(card, 'show');
      counts.shown++;
    } else if (settings.revealHidden) {
      setState(card, 'dim');
      counts.dimmed++;
    } else {
      setState(card, 'hide');
      counts.hidden++;
    }
  }

  function processCard(card, filteringOn) {
    // Shorts shown as ordinary cards: hide regardless of keywords.
    if (settings.hideAllShorts && isShort(card)) {
      applyVerdict(card, false);
      return;
    }

    if (!filteringOn) {
      applyVerdict(card, true);
      return;
    }

    const title = firstText(card, selectors.TITLE_SELECTORS);
    const channel = firstText(card, selectors.CHANNEL_SELECTORS);

    // No readable video title/channel — either a not-yet-rendered lazy skeleton
    // or an in-feed ad. For an interest-only feed, hide it. We deliberately do
    // NOT stamp it, so once its real content loads it gets re-evaluated and a
    // genuine match will appear.
    if (!title && !channel) {
      applyVerdict(card, false);
      counts.noText++; // skeleton/ad with no readable text — excluded from the
      // empty-state banner threshold so it can't flash during normal loading.
      return;
    }

    // Stamp is keyed on the visible text (computed above), so a late-hydrating
    // title or a recycled node showing a new video always re-evaluates.
    const sig = signature(title, channel);
    if (card.getAttribute(STAMP) === sig) {
      tally(card); // unchanged since last pass — keep verdict, just count
      return;
    }

    applyVerdict(card, matcher.decide(title, channel, compiled) === 'show');
    card.setAttribute(STAMP, sig);
  }

  // Friendly in-feed banner shown when filtering hid everything on a feed page.
  let emptyEl = null;
  function ensureEmptyState(show) {
    try {
      if (!show) {
        if (emptyEl) {
          emptyEl.remove();
          emptyEl = null;
        }
        return;
      }
      if (emptyEl && emptyEl.isConnected) return;
      const host =
        document.querySelector('ytd-rich-grid-renderer') ||
        document.querySelector('ytd-section-list-renderer #contents') || // search
        document.querySelector('ytd-two-column-search-results-renderer #primary') ||
        document.querySelector('#primary #contents') ||
        document.querySelector('ytd-browse');
      if (!host) return;
      emptyEl = document.createElement('div');
      emptyEl.className = 'ytif-empty';
      emptyEl.innerHTML =
        '<div class="ytif-empty-title">Not much here matched your interests</div>' +
        '<div class="ytif-empty-sub">Only videos matching your keywords are shown. To see more:</div>' +
        '<div class="ytif-empty-actions">' +
        '<button data-act="add">Add interests</button>' +
        '<button data-act="loose">Loosen matching</button>' +
        '<button data-act="reveal">Show hidden</button>' +
        '</div>';
      emptyEl.addEventListener('click', (e) => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (!act) return;
        if (act === 'add') {
          try {
            chrome.runtime.sendMessage({ type: 'YTIF_OPEN_OPTIONS' });
          } catch (_) {}
        } else if (act === 'loose') {
          patchSetting({ matchMode: 'loose' });
        } else if (act === 'reveal') {
          patchSetting({ revealHidden: true });
        }
      });
      host.prepend(emptyEl);
    } catch (e) {
      /* ignore */
    }
  }

  function patchSetting(partial) {
    try {
      chrome.storage.local.get(defaults.STORAGE_KEY, (d) => {
        const s = defaults.withDefaults(d ? d[defaults.STORAGE_KEY] : null);
        Object.assign(s, partial);
        chrome.storage.local.set({ [defaults.STORAGE_KEY]: s });
      });
    } catch (e) {
      /* ignore */
    }
  }

  let lastSweep = 0;
  let blankPasses = 0; // consecutive full passes where no card had readable text
  let selectorsBroken = false; // fail-open latch (YouTube text markup changed)

  // Reveal everything and stop hiding — used when selectors look broken so we
  // never leave the user with a silently blank feed.
  function failOpen() {
    try {
      document.documentElement.classList.remove('ytif-prehide');
      document
        .querySelectorAll('.' + HIDDEN_CLASS + ', .' + DIMMED_CLASS)
        .forEach((n) => n.classList.remove(HIDDEN_CLASS, DIMMED_CLASS));
    } catch (e) {
      /* ignore */
    }
  }

  function applyAll(full) {
    try {
      counts = { shown: 0, hidden: 0, dimmed: 0, noText: 0 };

      const surface = currentSurface();
      const filteringOn =
        !!settings.masterEnabled &&
        !!surface &&
        settings.surfaces[surface.key] !== false;

      // Pre-hide new cards (via CSS) only when filtering will actually remove
      // things (interests are set). This stops the flash-then-remove on scroll
      // without blanking the feed when nothing is being filtered.
      const prehideOn = filteringOn && settings.interests.length > 0;
      document.documentElement.classList.toggle('ytif-prehide', prehideOn);

      // If we're in fail-open mode, keep everything visible until the text
      // selectors read content again (recovery), then resume normal filtering.
      if (selectorsBroken) {
        let sample = [];
        try {
          sample = [].slice.call(
            document.querySelectorAll(selectors.ALL_ITEMS.join(',')),
            0,
            20
          );
        } catch (e) {
          /* ignore */
        }
        const recovered = sample.some(
          (c) => firstText(c, selectors.TITLE_SELECTORS) || firstText(c, selectors.CHANNEL_SELECTORS)
        );
        if (recovered) {
          selectorsBroken = false;
          blankPasses = 0;
        } else {
          failOpen();
          ensureEmptyState(false);
          return;
        }
      }

      // The Shorts/ad sweeps use expensive :has() queries over the whole
      // document. They rarely change mid-scroll, so keep them off the scroll hot
      // path: always on full passes (load/nav/settings), otherwise throttled.
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      if (full !== false || now - lastSweep > 800) {
        syncShorts();
        syncAds(filteringOn);
        lastSweep = now;
      }

      // Card filtering runs every pass — it's cheap (plain tag selectors + a
      // per-card stamp that skips re-deciding unchanged cards).
      let collected = 0;
      if (surface) {
        const cards = collectCards();
        collected = cards.size;
        cards.forEach((card) => processCard(card, filteringOn));
      }

      // FAIL-OPEN SAFETY VALVE: if a full pass collected a real batch of cards
      // but NONE had a readable title/channel, our text selectors are probably
      // broken by a YouTube markup change. Hiding everything would silently blank
      // the feed — so after two such passes we disable pre-hide and reveal
      // everything until the selectors read text again (recovery is auto-checked
      // at the top of applyAll).
      if (full !== false && prehideOn) {
        if (collected >= 20 && counts.noText === collected) blankPasses++;
        else blankPasses = 0;
        if (blankPasses >= 2) selectorsBroken = true;
      }

      // Graceful empty-state: if we hid a real batch but nothing matched, show
      // guidance instead of a confusing blank page (feed surfaces only).
      const feedSurface = surface && surface.key !== 'sidebar';
      // Only count cards hidden for NOT MATCHING (had readable text) toward the
      // banner — never skeletons/ads — so it can't flash during normal loading.
      const realHidden = counts.hidden - counts.noText;
      // Show guidance when (almost) nothing matched — this also catches the
      // silent "1–2 matched and the feed stopped loading" stall.
      ensureEmptyState(prehideOn && feedSurface && counts.shown <= 2 && realHidden >= 8);
    } catch (e) {
      // A single bad pass must never kill the observer.
      console.debug('[YTIF] applyAll error', e);
    }
  }

  // ---- scheduling ---------------------------------------------------------

  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      applyAll(false); // observer tick: throttle the expensive sweeps
    }, 80);
  }

  const observer = new MutationObserver(schedule);

  function startObserving() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // ---- settings wiring ----------------------------------------------------

  function adoptSettings(raw) {
    settings = defaults.withDefaults(raw);
    compiled = matcher.buildMatcher(settings);
    settingsRev++; // invalidate all card stamps so verdicts recompute
  }

  function loadAndApply() {
    try {
      chrome.storage.local.get(defaults.STORAGE_KEY, (data) => {
        adoptSettings(data ? data[defaults.STORAGE_KEY] : null);
        applyAll(true);
      });
    } catch (e) {
      // chrome.storage unavailable — run with defaults (shows everything).
      applyAll(true);
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[defaults.STORAGE_KEY]) {
        adoptSettings(changes[defaults.STORAGE_KEY].newValue);
        applyAll(true);
      }
    });

    // Let the popup ask for the current tab's live counts; handle right-click
    // quick-add routed from the background service worker.
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'YTIF_GET_COUNTS') {
        sendResponse({ counts, masterEnabled: !!settings.masterEnabled });
      } else if (msg && msg.type === 'YTIF_CTX') {
        handleQuickAdd(msg.menuItemId, msg.selectionText);
      }
      // Respond synchronously; don't hold the channel open for other messages.
      return false;
    });
  } catch (e) {
    /* chrome APIs unavailable; ignore */
  }

  // ---- right-click quick-add ----------------------------------------------

  // Remember the video card under the cursor when a context menu opens, so the
  // background SW's menu clicks can act on its channel.
  const CARD_SELECTOR =
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model, ytd-compact-video-renderer';
  let lastContext = null;
  document.addEventListener(
    'contextmenu',
    (e) => {
      try {
        const card = e.target && e.target.closest && e.target.closest(CARD_SELECTOR);
        lastContext = card
          ? {
              title: firstText(card, selectors.TITLE_SELECTORS),
              channel: firstText(card, selectors.CHANNEL_SELECTORS),
            }
          : null;
      } catch (_) {
        lastContext = null;
      }
    },
    true
  );

  // Brief in-page confirmation with an Undo action, so the silent SW-driven
  // quick-add gives feedback and is safe to use.
  let toastEl = null;
  let toastTimer = null;
  function showToast(message, onUndo) {
    try {
      if (toastTimer) clearTimeout(toastTimer);
      if (toastEl) toastEl.remove();
      toastEl = document.createElement('div');
      toastEl.className = 'ytif-toast';
      toastEl.setAttribute('role', 'status');
      const span = document.createElement('span');
      span.textContent = message;
      toastEl.appendChild(span);
      if (onUndo) {
        const btn = document.createElement('button');
        btn.className = 'ytif-toast-undo';
        btn.textContent = 'Undo';
        btn.addEventListener('click', () => {
          onUndo();
          if (toastEl) toastEl.remove();
          toastEl = null;
        });
        toastEl.appendChild(btn);
      }
      document.body.appendChild(toastEl);
      toastTimer = setTimeout(() => {
        if (toastEl) toastEl.remove();
        toastEl = null;
      }, 5000);
    } catch (e) {
      /* DOM unavailable; ignore */
    }
  }

  function undoAdd(key, value) {
    try {
      chrome.storage.local.get(defaults.STORAGE_KEY, (data) => {
        const s = defaults.withDefaults(data ? data[defaults.STORAGE_KEY] : null);
        s[key] = matcher.removeKeyword(s[key], value);
        chrome.storage.local.set({ [defaults.STORAGE_KEY]: s });
      });
    } catch (e) {
      /* ignore */
    }
  }

  function mergeIntoSetting(key, value, label) {
    if (!value) return;
    try {
      chrome.storage.local.get(defaults.STORAGE_KEY, (data) => {
        const s = defaults.withDefaults(data ? data[defaults.STORAGE_KEY] : null);
        const before = s[key];
        const after = matcher.addKeyword(before, value);
        if (after.length === before.length) {
          showToast(`"${value}" is already in ${label}`, null);
          return;
        }
        s[key] = after;
        chrome.storage.local.set({ [defaults.STORAGE_KEY]: s }, () => {
          showToast(`Added "${value}" to ${label}`, () => undoAdd(key, value));
        });
      });
    } catch (e) {
      /* storage unavailable; ignore */
    }
  }

  function handleQuickAdd(menuItemId, selectionText) {
    if (menuItemId === 'ytif-allow-channel') {
      mergeIntoSetting('allowChannels', lastContext && lastContext.channel, 'always-show channels');
    } else if (menuItemId === 'ytif-block-channel') {
      mergeIntoSetting('blockWords', lastContext && lastContext.channel, 'block words');
    } else if (menuItemId === 'ytif-add-interest') {
      // Normalize whitespace and cap length so a stray multi-line selection
      // doesn't become one giant, malformed keyword.
      const cleaned = String(selectionText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
      mergeIntoSetting('interests', cleaned, 'interests');
    }
  }

  // ---- boot ---------------------------------------------------------------

  // YouTube SPA navigation: full re-run when the page changes without a reload
  // (the surface and the Shorts/ad shelves change, so a full sweep is warranted).
  // `yt-navigate-finish` covers most in-app nav; `yt-page-data-updated` and
  // `popstate` cover back/forward and transitions that skip it — without these,
  // a stale `ytif-prehide` class could briefly blank a non-filtered page.
  window.addEventListener('yt-navigate-finish', () => applyAll(true));
  window.addEventListener('yt-page-data-updated', () => applyAll(true));
  window.addEventListener('popstate', () => applyAll(true));

  // Mark the live build on the page (harmless build tag; aids debugging).
  try {
    document.documentElement.setAttribute('data-ytif-version', VERSION);
  } catch (e) {
    /* ignore */
  }

  startObserving();
  loadAndApply();
})();
