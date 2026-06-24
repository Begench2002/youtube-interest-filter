/*
 * options.js — settings UI. Reads/writes window.__YTIF.defaults.STORAGE_KEY in
 * chrome.storage.local. Auto-saves (debounced) on any change; open YouTube tabs
 * react instantly via chrome.storage.onChanged in the content script.
 */
'use strict';

(function () {
  const { STORAGE_KEY, DEFAULT_SETTINGS, withDefaults, summarize } = window.__YTIF.defaults;

  const el = (id) => document.getElementById(id);
  const fields = {
    masterEnabled: el('masterEnabled'),
    interests: el('interests'),
    blockWords: el('blockWords'),
    allowChannels: el('allowChannels'),
    normalizeDiacritics: el('normalizeDiacritics'),
    hideAllShorts: el('hideAllShorts'),
    surfaceHome: el('surface-home'),
    surfaceSearch: el('surface-search'),
    surfaceSidebar: el('surface-sidebar'),
    surfaceSubscriptions: el('surface-subscriptions'),
  };

  // Preserved across saves so we don't lose them (gather() rebuilds the whole
  // settings object): which packs were applied, and whether onboarding is done.
  let appliedPacks = [];
  let onboarded = false;

  // ---- parsing / serialising ----

  // Shared, unit-tested parser (handles commas + newlines, trims, de-dupes).
  function parseList(text) {
    return window.__YTIF.matcher.parseKeywords(text);
  }

  function getMatchMode() {
    const checked = document.querySelector('input[name="matchMode"]:checked');
    return checked ? checked.value : 'smart';
  }

  function gather() {
    return {
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      masterEnabled: fields.masterEnabled.checked,
      interests: parseList(fields.interests.value),
      blockWords: parseList(fields.blockWords.value),
      allowChannels: parseList(fields.allowChannels.value),
      matchMode: getMatchMode(),
      normalizeDiacritics: fields.normalizeDiacritics.checked,
      hideAllShorts: fields.hideAllShorts.checked,
      surfaces: {
        home: fields.surfaceHome.checked,
        search: fields.surfaceSearch.checked,
        sidebar: fields.surfaceSidebar.checked,
        subscriptions: fields.surfaceSubscriptions.checked,
      },
      revealHidden: false,
      onboarded: onboarded,
      appliedPacks: appliedPacks.slice(),
    };
  }

  function populate(s) {
    appliedPacks = (s.appliedPacks || []).slice();
    onboarded = s.onboarded === true;
    fields.masterEnabled.checked = s.masterEnabled;
    fields.interests.value = (s.interests || []).join('\n');
    fields.blockWords.value = (s.blockWords || []).join('\n');
    fields.allowChannels.value = (s.allowChannels || []).join('\n');
    fields.normalizeDiacritics.checked = s.normalizeDiacritics;
    fields.hideAllShorts.checked = s.hideAllShorts;
    fields.surfaceHome.checked = s.surfaces.home;
    fields.surfaceSearch.checked = s.surfaces.search;
    fields.surfaceSidebar.checked = s.surfaces.sidebar;
    fields.surfaceSubscriptions.checked = s.surfaces.subscriptions;
    const radio = document.querySelector(
      `input[name="matchMode"][value="${s.matchMode}"]`
    );
    if (radio) radio.checked = true;
    renderPacks();
    updateHints();
  }

  // ---- interest packs ----

  function renderPacks() {
    const grid = el('packGrid');
    const packs = (window.__YTIF.packs && window.__YTIF.packs.INTEREST_PACKS) || [];
    grid.innerHTML = '';
    packs.forEach((pack) => {
      const added = appliedPacks.includes(pack.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pack' + (added ? ' added' : '');
      btn.title = pack.description;
      const mk = (cls, text) => {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        return span;
      };
      btn.appendChild(mk('pack-emoji', pack.emoji));
      btn.appendChild(mk('pack-name', pack.name));
      btn.appendChild(mk('pack-meta', added ? 'Added ✓ · click to remove' : '+ ' + pack.interests.length + ' keywords'));
      btn.addEventListener('click', () => togglePack(pack));
      grid.appendChild(btn);
    });
  }

  function applyPack(pack) {
    const add = window.__YTIF.matcher.addKeyword;
    let interests = parseList(fields.interests.value);
    pack.interests.forEach((k) => {
      interests = add(interests, k);
    });
    fields.interests.value = interests.join('\n');

    if (Array.isArray(pack.allowChannels) && pack.allowChannels.length) {
      let allow = parseList(fields.allowChannels.value);
      pack.allowChannels.forEach((c) => {
        allow = add(allow, c);
      });
      fields.allowChannels.value = allow.join('\n');
    }

    if (!appliedPacks.includes(pack.id)) appliedPacks.push(pack.id);
    if (!fields.masterEnabled.checked) fields.masterEnabled.checked = true;
    renderPacks();
    scheduleSave();
    setStatus(`Added "${pack.name}" — ${pack.interests.length} keywords`, 'ok');
  }

  function togglePack(pack) {
    if (appliedPacks.includes(pack.id)) removePack(pack);
    else applyPack(pack);
  }

  function removePack(pack) {
    const remove = window.__YTIF.matcher.removeKeyword;
    const allPacks = (window.__YTIF.packs && window.__YTIF.packs.INTEREST_PACKS) || [];
    // Keep any keyword/channel that another still-applied pack also provides.
    const keepKw = new Set();
    const keepCh = new Set();
    allPacks.forEach((p) => {
      if (p.id === pack.id || !appliedPacks.includes(p.id)) return;
      p.interests.forEach((k) => keepKw.add(k.toLowerCase()));
      (p.allowChannels || []).forEach((c) => keepCh.add(c.toLowerCase()));
    });

    let interests = parseList(fields.interests.value);
    pack.interests.forEach((k) => {
      if (!keepKw.has(k.toLowerCase())) interests = remove(interests, k);
    });
    fields.interests.value = interests.join('\n');

    if (Array.isArray(pack.allowChannels) && pack.allowChannels.length) {
      let allow = parseList(fields.allowChannels.value);
      pack.allowChannels.forEach((c) => {
        if (!keepCh.has(c.toLowerCase())) allow = remove(allow, c);
      });
      fields.allowChannels.value = allow.join('\n');
    }

    appliedPacks = appliedPacks.filter((id) => id !== pack.id);
    renderPacks();
    scheduleSave();
    setStatus(`Removed "${pack.name}"`, 'ok');
  }

  // ---- status / hints ----

  let statusTimer = null;
  function setStatus(text, kind) {
    const node = el('status');
    node.textContent = text;
    node.className = 'status show ' + (kind || '');
    if (statusTimer) clearTimeout(statusTimer);
    if (kind === 'ok') {
      statusTimer = setTimeout(() => {
        node.className = 'status';
        node.textContent = '';
      }, 1500);
    }
  }

  function updateHints() {
    const interests = parseList(fields.interests.value);
    const blocks = parseList(fields.blockWords.value);
    const allow = parseList(fields.allowChannels.value);
    el('interestsHint').textContent = `${interests.length} interest${interests.length === 1 ? '' : 's'}`;
    el('blockHint').textContent = `${blocks.length} block word${blocks.length === 1 ? '' : 's'}`;
    el('allowHint').textContent = `${allow.length} always-show channel${allow.length === 1 ? '' : 's'}`;

    if (!fields.masterEnabled.checked) {
      setStatus('Filtering is OFF — YouTube is showing everything.', 'warn');
    } else if (interests.length === 0) {
      setStatus('No interests yet — all videos are shown. Add at least one keyword to start filtering.', 'warn');
    } else {
      // clear the persistent warning (but don't flash the "saved" green here)
      const node = el('status');
      if (node.classList.contains('warn')) {
        node.className = 'status';
        node.textContent = '';
      }
    }
  }

  // ---- persistence ----

  function save() {
    const settings = gather();
    chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
      updateHints();
      // only show the transient "Saved" if there's no standing warning
      if (settings.masterEnabled && settings.interests.length > 0) {
        setStatus('Saved ✓', 'ok');
      }
    });
  }

  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
    updateHints();
  }

  // ---- import / export ----

  function exportSettings() {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const settings = withDefaults(data ? data[STORAGE_KEY] : null);
      const blob = new Blob([JSON.stringify(settings, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'youtube-interest-filter-settings.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function importSettings(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const settings = withDefaults(parsed);
        chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
          populate(settings);
          const c = summarize(settings);
          setStatus(
            `Imported ${c.interests} interests, ${c.allowChannels} always-show, ${c.blockWords} block words ✓`,
            'ok'
          );
        });
      } catch (e) {
        setStatus('Import failed: not a valid settings file.', 'warn');
      }
    };
    reader.readAsText(file);
  }

  function resetDefaults() {
    const settings = withDefaults(null);
    chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
      populate(settings);
      setStatus('Reset to defaults ✓', 'ok');
    });
  }

  // ---- wiring ----

  function wire() {
    [
      fields.masterEnabled,
      fields.normalizeDiacritics,
      fields.hideAllShorts,
      fields.surfaceHome,
      fields.surfaceSearch,
      fields.surfaceSidebar,
      fields.surfaceSubscriptions,
    ].forEach((node) => node.addEventListener('change', scheduleSave));

    document
      .querySelectorAll('input[name="matchMode"]')
      .forEach((node) => node.addEventListener('change', scheduleSave));

    fields.interests.addEventListener('input', scheduleSave);
    fields.blockWords.addEventListener('input', scheduleSave);
    fields.allowChannels.addEventListener('input', scheduleSave);

    el('exportBtn').addEventListener('click', exportSettings);
    el('importBtn').addEventListener('click', () => el('importFile').click());
    el('importFile').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importSettings(file);
      e.target.value = '';
    });
    el('resetBtn').addEventListener('click', resetDefaults);
  }

  // ---- boot ----

  chrome.storage.local.get(STORAGE_KEY, (data) => {
    populate(withDefaults(data ? data[STORAGE_KEY] : null));
    wire();
  });
})();
