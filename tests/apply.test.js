import { describe, it, expect } from 'vitest';
import matcher from '../src/shared/matcher.js';

const { signature } = matcher;

describe('signature()', () => {
  it('is stable for identical inputs', () => {
    expect(signature(1, 'AI news', 'Chan')).toBe(signature(1, 'AI news', 'Chan'));
  });
  it('changes when the title changes (covers late lazy hydration)', () => {
    expect(signature(1, '', 'Chan')).not.toBe(signature(1, 'AI news', 'Chan'));
  });
  it('changes when the channel changes (covers recycled nodes)', () => {
    expect(signature(1, 'AI news', 'A')).not.toBe(signature(1, 'AI news', 'B'));
  });
  it('changes when settingsRev changes (invalidates all stamps)', () => {
    expect(signature(1, 'AI news', 'Chan')).not.toBe(signature(2, 'AI news', 'Chan'));
  });
  it('does not confuse a title/channel boundary shift', () => {
    // "ab" + "" should differ from "a" + "b"
    expect(signature(1, 'ab', '')).not.toBe(signature(1, 'a', 'b'));
  });
});
