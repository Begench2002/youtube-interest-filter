// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import extract from '../src/shared/extract.js';

const { firstText } = extract;

// Build a detached element from an HTML string.
function card(html) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild;
}

describe('firstText()', () => {
  it('reads textContent of the first matching selector', () => {
    const el = card('<div><a id="video-title-link">Deep Learning 101</a></div>');
    expect(firstText(el, ['a#video-title-link'])).toBe('Deep Learning 101');
  });

  it('prefers the title attribute over textContent', () => {
    const el = card('<div><a id="video-title-link" title="Real Title">truncated…</a></div>');
    expect(firstText(el, ['a#video-title-link'])).toBe('Real Title');
  });

  it('walks the fallback chain when earlier selectors miss', () => {
    const el = card('<div><h3><span>Fallback Title</span></h3></div>');
    expect(firstText(el, ['a#video-title-link', 'h3 span'])).toBe('Fallback Title');
  });

  it('trims surrounding whitespace', () => {
    const el = card('<div><a id="t">   Spacey Title   </a></div>');
    expect(firstText(el, ['a#t'])).toBe('Spacey Title');
  });

  it('skips aria-hidden duplicate/badge text and returns the real value', () => {
    const el = card(
      '<div>' +
        '<span class="badge" aria-hidden="true">LIVE</span>' +
        '<a id="video-title-link">Transformers Explained</a>' +
        '</div>'
    );
    expect(firstText(el, ['.badge', 'a#video-title-link'])).toBe('Transformers Explained');
  });

  it('returns empty string when nothing matches', () => {
    const el = card('<div><span>nope</span></div>');
    expect(firstText(el, ['a#video-title-link', 'h3 a'])).toBe('');
  });

  it('ignores a selector whose only match is empty/whitespace and continues', () => {
    const el = card('<div><a id="empty">   </a><a id="real">GPT internals</a></div>');
    expect(firstText(el, ['a#empty', 'a#real'])).toBe('GPT internals');
  });

  it('is defensive against bad input', () => {
    expect(firstText(null, ['a'])).toBe('');
    expect(firstText(card('<div></div>'), null)).toBe('');
  });

  it('does not throw on an invalid selector, just skips it', () => {
    const el = card('<div><a id="real">Diffusion models</a></div>');
    expect(firstText(el, ['::::bad', 'a#real'])).toBe('Diffusion models');
  });
});
