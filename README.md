# YouTube Interest Filter

Turn YouTube into an **interest‑only feed**. Pick the topics you care about and the
extension **hides every video that doesn't match** — across the homepage, search,
the watch‑page sidebar, subscriptions, and Trending/Explore. Shorts and in‑feed
ads are removed too.

100% local and private — no servers, no accounts, no tracking.

---

## Features

- **One‑click setup.** A first‑run wizard lets you pick **interest packs**
  (AI & ML, Programming, Science, Finance, Fitness, Gaming, Music, Cooking, News,
  Cars, Business, History) — each seeds a strong keyword list, so your feed is
  relevant in seconds with no manual typing.
- **Smart keyword matching.** Matches a video's **title and channel** against
  your interests. The default *Smart* mode also matches plurals (“transformer” →
  “transformers”); *Strict* and *Loose* modes are available. Accents and spacing
  are normalized.
- **Block words** always win — hide anything matching them, even if it also
  matches an interest.
- **Always‑show channels** — list trusted channels and *every* video from them
  shows, even when a title is too terse to match a keyword.
- **Right‑click quick‑add** — right‑click a video to always‑show or block its
  channel, or select text to add it as an interest. Comes with an Undo toast.
- **Removes Shorts and in‑feed ads.**
- **Never blanks your feed by accident** — with no interests, or the master
  switch off, YouTube is untouched. If a page filters down to nothing, a friendly
  card offers *Add interests / Loosen matching / Show hidden*.

## Install (load unpacked)

This extension isn't on the Chrome Web Store — you load it directly:

1. **Download** this repo (green **Code → Download ZIP**, then unzip) or
   `git clone` it.
2. Open `chrome://extensions` in Chrome, Edge, Brave, or any Chromium browser.
3. Turn on **Developer mode** (top‑right).
4. Click **Load unpacked** and select the project folder (the one containing
   `manifest.json`).
5. Pin the extension; the onboarding tab opens so you can pick your interests.

> After editing any file, return to `chrome://extensions` and click **Reload** (↻).

## Use

1. On first install, pick one or more **interest packs** → **Show me my feed**.
2. Browse YouTube — only matching videos remain.
3. Fine‑tune anytime from the toolbar icon → **Manage interests…**: add/remove
   packs, edit keywords, add block words or always‑show channels, choose match
   strictness, and pick which surfaces to filter. Power options live under
   **Advanced**.
4. The popup has a master on/off switch, live **shown / filtered** counts, a quick
   **Hide Shorts** toggle, and **Show hidden** (dims instead of removing).

## Privacy

Everything runs locally in your browser. Permissions are limited to `storage`
(save your settings), `activeTab`, and `contextMenus` (right‑click quick‑add).
The extension makes **no network requests** and collects **no data**.

## Development

```bash
npm install     # installs vitest + happy-dom (dev only)
npm test        # run the test suite
```

The matching logic (`src/shared/`) and DOM extraction are covered by unit and
integration tests, including tests that run the real selectors against
representative YouTube card markup. If YouTube changes its markup and filtering
stops working, the fix is almost always in `src/shared/selectors.js`.

## License

MIT — see [LICENSE](LICENSE).
