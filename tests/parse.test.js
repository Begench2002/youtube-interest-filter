import { describe, it, expect } from 'vitest';
import matcher from '../src/shared/matcher.js';

const { parseKeywords, addKeyword, removeKeyword } = matcher;

describe('parseKeywords()', () => {
  it('splits on newlines', () => {
    expect(parseKeywords('ai\nml\nllm')).toEqual(['ai', 'ml', 'llm']);
  });
  it('splits on commas', () => {
    expect(parseKeywords('ai, ml, llm')).toEqual(['ai', 'ml', 'llm']);
  });
  it('splits on a mix of commas and newlines', () => {
    expect(parseKeywords('ai, ml\nllm,gpt')).toEqual(['ai', 'ml', 'llm', 'gpt']);
  });
  it('trims surrounding whitespace on each item', () => {
    expect(parseKeywords('  machine learning  ,  rust ')).toEqual([
      'machine learning',
      'rust',
    ]);
  });
  it('drops blank and whitespace-only entries', () => {
    expect(parseKeywords('ai,,  ,\n\n ml ')).toEqual(['ai', 'ml']);
  });
  it('de-dupes case-insensitively, keeping the first-seen casing', () => {
    expect(parseKeywords('AI\nai\nMl\nml')).toEqual(['AI', 'Ml']);
  });
  it('returns an empty array for empty / null / undefined input', () => {
    expect(parseKeywords('')).toEqual([]);
    expect(parseKeywords(null)).toEqual([]);
    expect(parseKeywords(undefined)).toEqual([]);
  });
  it('does not split multi-word phrases (only commas/newlines separate)', () => {
    expect(parseKeywords('machine learning, deep learning')).toEqual([
      'machine learning',
      'deep learning',
    ]);
  });
});

describe('addKeyword()', () => {
  it('appends a new value', () => {
    expect(addKeyword(['ai'], 'ml')).toEqual(['ai', 'ml']);
  });
  it('is a no-op when the value already exists (case-insensitive)', () => {
    expect(addKeyword(['AI', 'ml'], 'ai')).toEqual(['AI', 'ml']);
  });
  it('trims the value before adding', () => {
    expect(addKeyword(['ai'], '  Two Minute Papers  ')).toEqual(['ai', 'Two Minute Papers']);
  });
  it('ignores empty / whitespace-only values', () => {
    expect(addKeyword(['ai'], '')).toEqual(['ai']);
    expect(addKeyword(['ai'], '   ')).toEqual(['ai']);
    expect(addKeyword(['ai'], null)).toEqual(['ai']);
  });
  it('treats a non-array list as empty', () => {
    expect(addKeyword(undefined, 'ai')).toEqual(['ai']);
  });
  it('does not mutate the original array', () => {
    const original = ['ai'];
    addKeyword(original, 'ml');
    expect(original).toEqual(['ai']);
  });
});

describe('removeKeyword()', () => {
  it('removes a matching value (case-insensitive)', () => {
    expect(removeKeyword(['AI', 'ml'], 'ai')).toEqual(['ml']);
  });
  it('matches ignoring surrounding whitespace', () => {
    expect(removeKeyword(['Two Minute Papers', 'ai'], '  two minute papers ')).toEqual(['ai']);
  });
  it('is a no-op when the value is not present', () => {
    expect(removeKeyword(['ai', 'ml'], 'gpt')).toEqual(['ai', 'ml']);
  });
  it('returns a copy unchanged for an empty value', () => {
    expect(removeKeyword(['ai'], '')).toEqual(['ai']);
  });
  it('treats a non-array list as empty', () => {
    expect(removeKeyword(undefined, 'ai')).toEqual([]);
  });
  it('does not mutate the original array', () => {
    const original = ['ai', 'ml'];
    removeKeyword(original, 'ai');
    expect(original).toEqual(['ai', 'ml']);
  });
  it('removes all duplicates of the value', () => {
    expect(removeKeyword(['ai', 'AI', 'ml'], 'ai')).toEqual(['ml']);
  });
});
