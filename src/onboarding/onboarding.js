/*
 * onboarding.js — first-run wizard. Lets the user pick interest packs in one
 * click; applies them to settings (reusing matcher.addKeyword + withDefaults)
 * and sends them to YouTube with a relevant feed ready to go.
 */
'use strict';

(function () {
  const { STORAGE_KEY, withDefaults } = window.__YTIF.defaults;
  const { addKeyword } = window.__YTIF.matcher;
  const PACKS = (window.__YTIF.packs && window.__YTIF.packs.INTEREST_PACKS) || [];

  const selected = new Set();
  const grid = document.getElementById('packGrid');
  const counter = document.getElementById('counter');

  function keywordCount() {
    let n = 0;
    PACKS.forEach((p) => {
      if (selected.has(p.id)) n += p.interests.length;
    });
    return n;
  }

  function updateCounter() {
    const t = selected.size;
    counter.textContent = t
      ? `${t} topic${t === 1 ? '' : 's'} · ~${keywordCount()} keywords`
      : 'Pick at least one to get started';
  }

  function render() {
    grid.innerHTML = '';
    PACKS.forEach((pack) => {
      const on = selected.has(pack.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pack' + (on ? ' on' : '');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const mk = (cls, text) => {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        return span;
      };
      btn.appendChild(mk('pack-emoji', pack.emoji));
      btn.appendChild(mk('pack-name', pack.name));
      btn.appendChild(mk('pack-desc', pack.description));
      btn.addEventListener('click', () => {
        if (selected.has(pack.id)) selected.delete(pack.id);
        else selected.add(pack.id);
        render();
        updateCounter();
      });
      grid.appendChild(btn);
    });
  }

  function finish(applySelected) {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const s = withDefaults(data ? data[STORAGE_KEY] : null);
      if (applySelected && selected.size) {
        let interests = s.interests.slice();
        let allow = s.allowChannels.slice();
        const ids = [];
        PACKS.forEach((pack) => {
          if (!selected.has(pack.id)) return;
          ids.push(pack.id);
          pack.interests.forEach((k) => {
            interests = addKeyword(interests, k);
          });
          (pack.allowChannels || []).forEach((c) => {
            allow = addKeyword(allow, c);
          });
        });
        s.interests = interests;
        s.allowChannels = allow;
        s.appliedPacks = Array.from(new Set(s.appliedPacks.concat(ids)));
        s.masterEnabled = true;
      }
      s.onboarded = true;
      chrome.storage.local.set({ [STORAGE_KEY]: s }, () => {
        window.location.href = 'https://www.youtube.com/';
      });
    });
  }

  document.getElementById('startBtn').addEventListener('click', () => finish(true));
  document.getElementById('skipBtn').addEventListener('click', () => finish(false));

  render();
  updateCounter();
})();
