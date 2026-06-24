// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import selectors from '../src/shared/selectors.js';
import extract from '../src/shared/extract.js';

const { TITLE_SELECTORS, CHANNEL_SELECTORS, SHORTS } = selectors;
const { firstText } = extract;

function card(html) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild;
}

const title = (el) => firstText(el, TITLE_SELECTORS);
const channel = (el) => firstText(el, CHANNEL_SELECTORS);

describe('selectors + extract — homepage ytd-rich-item-renderer', () => {
  const el = card(`
    <ytd-rich-item-renderer>
      <a id="video-title-link" title="Building a Transformer from scratch">Building a Transformer from scratch</a>
      <ytd-channel-name><a href="/@AndrejKarpathy">Andrej Karpathy</a></ytd-channel-name>
    </ytd-rich-item-renderer>`);
  it('extracts the title', () => expect(title(el)).toBe('Building a Transformer from scratch'));
  it('extracts the channel', () => expect(channel(el)).toBe('Andrej Karpathy'));
});

describe('selectors + extract — search ytd-video-renderer', () => {
  const el = card(`
    <ytd-video-renderer>
      <a id="video-title-link" title="RAG explained simply">RAG explained simply</a>
      <ytd-channel-name><a href="/@aichannel">Some AI Channel</a></ytd-channel-name>
    </ytd-video-renderer>`);
  it('extracts the title', () => expect(title(el)).toBe('RAG explained simply'));
  it('extracts the channel', () => expect(channel(el)).toBe('Some AI Channel'));
});

describe('selectors + extract — newer yt-lockup-view-model', () => {
  const el = card(`
    <yt-lockup-view-model>
      <a class="yt-lockup-metadata-view-model-wiz__title" title="Diffusion models deep dive">Diffusion models deep dive</a>
      <div class="yt-content-metadata-view-model-wiz__metadata-row">
        <a href="/@researchlab">Research Lab</a>
      </div>
    </yt-lockup-view-model>`);
  it('extracts the lockup title', () => expect(title(el)).toBe('Diffusion models deep dive'));
  it('extracts the lockup channel', () => expect(channel(el)).toBe('Research Lab'));
});

describe('selectors + extract — channel via /channel/ link fallback', () => {
  const el = card(`
    <ytd-video-renderer>
      <a id="video-title">Old UCID channel video</a>
      <a href="/channel/UC123">Legacy Channel</a>
    </ytd-video-renderer>`);
  it('reads the channel from a /channel/ link when no handle exists', () => {
    expect(channel(el)).toBe('Legacy Channel');
  });
});

describe('selectors + extract — subscriptions ytd-grid-video-renderer', () => {
  const el = card(`
    <ytd-grid-video-renderer>
      <a id="video-title" title="PyTorch in 100 minutes">PyTorch in 100 minutes</a>
      <ytd-channel-name><a href="/@mlchannel">ML Channel</a></ytd-channel-name>
    </ytd-grid-video-renderer>`);
  it('extracts the title', () => expect(title(el)).toBe('PyTorch in 100 minutes'));
  it('extracts the channel', () => expect(channel(el)).toBe('ML Channel'));
});

describe('selectors + extract — Shorts shelf lockups match SHORTS.items', () => {
  it('matches a ytm-shorts-lockup-view-model element', () => {
    const el = card('<ytm-shorts-lockup-view-model><a href="/shorts/xyz">a short</a></ytm-shorts-lockup-view-model>');
    expect(SHORTS.items.some((sel) => el.matches(sel))).toBe(true);
  });
  it('matches the v2 lockup variant', () => {
    const el = card('<ytm-shorts-lockup-view-model-v2><a href="/shorts/xyz">a short</a></ytm-shorts-lockup-view-model-v2>');
    expect(SHORTS.items.some((sel) => el.matches(sel))).toBe(true);
  });
});

describe('selectors + extract — precision & edge cases', () => {
  it('ignores an aria-hidden duplicate title overlay', () => {
    const el = card(`
      <ytd-rich-item-renderer>
        <span id="video-title" aria-hidden="true">DUPLICATE</span>
        <a id="video-title-link" title="Real AI Title">Real AI Title</a>
      </ytd-rich-item-renderer>`);
    expect(title(el)).toBe('Real AI Title');
  });
  it('returns empty channel when none is present (so content.js fails closed)', () => {
    const el = card(`<ytd-rich-item-renderer><a id="video-title-link" title="No channel here">No channel here</a></ytd-rich-item-renderer>`);
    expect(channel(el)).toBe('');
  });
  it('detects a Short via the shorts link selector', () => {
    const el = card(`<ytd-rich-item-renderer><a href="/shorts/abc123">a short</a></ytd-rich-item-renderer>`);
    expect(el.querySelector(SHORTS.link)).not.toBeNull();
  });
});
