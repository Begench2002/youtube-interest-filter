import { describe, it, expect } from 'vitest';
import packs from '../src/data/interest-packs.js';
import matcher from '../src/shared/matcher.js';

const { INTEREST_PACKS } = packs;

describe('interest packs — data integrity', () => {
  it('exposes a non-trivial number of packs', () => {
    expect(Array.isArray(INTEREST_PACKS)).toBe(true);
    expect(INTEREST_PACKS.length).toBeGreaterThanOrEqual(10);
  });

  it('every pack has the required fields with valid types', () => {
    for (const p of INTEREST_PACKS) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
      expect(typeof p.emoji).toBe('string');
      expect(typeof p.description).toBe('string');
      expect(Array.isArray(p.interests)).toBe(true);
      expect(p.interests.length).toBeGreaterThanOrEqual(5);
      p.interests.forEach((k) => {
        expect(typeof k).toBe('string');
        expect(k.trim().length).toBeGreaterThan(0);
      });
      if (p.allowChannels !== undefined) {
        expect(Array.isArray(p.allowChannels)).toBe(true);
        p.allowChannels.forEach((c) => expect(typeof c).toBe('string'));
      }
    }
  });

  it('has unique pack ids', () => {
    const ids = INTEREST_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate interests within a pack (case-insensitive)', () => {
    for (const p of INTEREST_PACKS) {
      const lowered = p.interests.map((k) => k.toLowerCase());
      expect(new Set(lowered).size).toBe(lowered.length);
    }
  });

  it('pack keywords compile cleanly and match their own terms (smart mode)', () => {
    for (const p of INTEREST_PACKS) {
      const compiled = matcher.buildMatcher({ interests: p.interests, matchMode: 'smart' });
      // a video titled with the first interest should be shown
      const sample = p.interests[0];
      expect(matcher.decide(sample + ' explained', 'Channel', compiled)).toBe('show');
    }
  });
});
