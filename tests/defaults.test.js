import { describe, it, expect } from 'vitest';
import defaults from '../src/shared/defaults.js';

const { withDefaults, DEFAULT_SETTINGS, summarize } = defaults;

describe('withDefaults() — base behavior', () => {
  it('returns the full default settings for null/undefined', () => {
    const s = withDefaults(null);
    expect(s.masterEnabled).toBe(true);
    expect(s.interests).toEqual([]);
    expect(s.blockWords).toEqual([]);
    expect(s.allowChannels).toEqual([]);
    expect(s.matchMode).toBe('smart');
    expect(s.normalizeDiacritics).toBe(true);
    expect(s.hideAllShorts).toBe(true);
    expect(s.revealHidden).toBe(false);
    expect(s.onboarded).toBe(false);
    expect(s.appliedPacks).toEqual([]);
    expect(s.surfaces).toEqual({ home: true, search: true, sidebar: true, subscriptions: true });
  });

  it('returns defaults when given a non-object (e.g. a string)', () => {
    expect(withDefaults('nope').interests).toEqual([]);
    expect(withDefaults('nope').surfaces).toEqual(DEFAULT_SETTINGS.surfaces);
  });

  it('fills missing keys while preserving provided ones', () => {
    const s = withDefaults({ interests: ['ai'] });
    expect(s.interests).toEqual(['ai']);
    expect(s.matchMode).toBe('smart');
    expect(s.hideAllShorts).toBe(true);
  });
});

describe('withDefaults() — list coercion', () => {
  it('coerces a non-array list to an empty array', () => {
    expect(withDefaults({ interests: 'ai' }).interests).toEqual([]);
    expect(withDefaults({ blockWords: null }).blockWords).toEqual([]);
    expect(withDefaults({ allowChannels: 42 }).allowChannels).toEqual([]);
  });
  it('drops non-string entries from lists', () => {
    expect(withDefaults({ interests: ['ai', 123, null, 'ml', {}] }).interests).toEqual(['ai', 'ml']);
  });
});

describe('withDefaults() — scalar coercion', () => {
  it('validates matchMode (smart | word | loose, default smart)', () => {
    expect(withDefaults({ matchMode: 'loose' }).matchMode).toBe('loose');
    expect(withDefaults({ matchMode: 'word' }).matchMode).toBe('word');
    expect(withDefaults({ matchMode: 'smart' }).matchMode).toBe('smart');
    expect(withDefaults({ matchMode: 'weird' }).matchMode).toBe('smart');
    expect(withDefaults({ matchMode: undefined }).matchMode).toBe('smart');
  });
  it('treats boolean flags as true unless explicitly false', () => {
    expect(withDefaults({ masterEnabled: false }).masterEnabled).toBe(false);
    expect(withDefaults({ masterEnabled: 'yes' }).masterEnabled).toBe(true);
    expect(withDefaults({ hideAllShorts: false }).hideAllShorts).toBe(false);
    expect(withDefaults({ normalizeDiacritics: false }).normalizeDiacritics).toBe(false);
  });
  it('treats revealHidden as true only when strictly true', () => {
    expect(withDefaults({ revealHidden: true }).revealHidden).toBe(true);
    expect(withDefaults({ revealHidden: 'true' }).revealHidden).toBe(false);
    expect(withDefaults({}).revealHidden).toBe(false);
  });
});

describe('withDefaults() — surfaces merge', () => {
  it('merges a partial surfaces object over defaults', () => {
    expect(withDefaults({ surfaces: { home: false } }).surfaces).toEqual({
      home: false,
      search: true,
      sidebar: true,
      subscriptions: true,
    });
  });
  it('ignores a malformed surfaces value (string/array) and uses defaults', () => {
    expect(withDefaults({ surfaces: 'nope' }).surfaces).toEqual(DEFAULT_SETTINGS.surfaces);
    expect(withDefaults({ surfaces: ['x'] }).surfaces).toEqual(DEFAULT_SETTINGS.surfaces);
  });
  it('treats an explicit-false surface as off and anything else as on', () => {
    const s = withDefaults({ surfaces: { home: false, search: 0, sidebar: 'x' } });
    expect(s.surfaces.home).toBe(false);
    expect(s.surfaces.search).toBe(true); // only strict false disables
    expect(s.surfaces.sidebar).toBe(true);
  });
});

describe('summarize()', () => {
  it('counts an empty/null config as all zeros', () => {
    expect(summarize(null)).toEqual({ interests: 0, blockWords: 0, allowChannels: 0 });
  });
  it('counts each list', () => {
    expect(summarize({ interests: ['a', 'b'], blockWords: ['x'], allowChannels: ['c', 'd', 'e'] })).toEqual({
      interests: 2,
      blockWords: 1,
      allowChannels: 3,
    });
  });
  it('coerces malformed lists to zero counts (so a bad import reads honestly)', () => {
    expect(summarize({ interests: 'not-an-array', blockWords: null })).toEqual({
      interests: 0,
      blockWords: 0,
      allowChannels: 0,
    });
  });
});

describe('withDefaults() — does not mutate the input', () => {
  it('leaves the original object untouched', () => {
    const input = { interests: ['ai'], surfaces: { home: false } };
    const snapshot = JSON.parse(JSON.stringify(input));
    withDefaults(input);
    expect(input).toEqual(snapshot);
  });
});
