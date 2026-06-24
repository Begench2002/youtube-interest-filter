import { describe, it, expect } from 'vitest';
import matcher from '../src/shared/matcher.js';

const { buildMatcher, decide } = matcher;

// Helper: build settings with sensible defaults, overridable per test.
function settings(overrides = {}) {
  return {
    masterEnabled: true,
    interests: [],
    blockWords: [],
    matchMode: 'word',
    normalizeDiacritics: true,
    ...overrides,
  };
}

// Convenience: build + decide in one call.
function verdict(title, channel, overrides = {}) {
  const compiled = buildMatcher(settings(overrides));
  return decide(title, channel, compiled);
}

describe('decide() — core precedence', () => {
  it('shows everything when master is disabled', () => {
    expect(verdict('Some random video', 'Some Channel', {
      masterEnabled: false,
      interests: ['formula 1'],
    })).toBe('show');
  });

  it('shows everything when there are no interest keywords (never blank the feed)', () => {
    expect(verdict('Anything at all', 'Any Channel', { interests: [] })).toBe('show');
  });

  it('shows a video whose title matches an interest', () => {
    expect(verdict('2026 Formula 1 season review', 'Sky Sports', {
      interests: ['formula 1'],
    })).toBe('show');
  });

  it('hides a video that matches no interest', () => {
    expect(verdict('Cooking pasta at home', 'Food Channel', {
      interests: ['formula 1'],
    })).toBe('hide');
  });

  it('matches an interest against the channel name, not just the title', () => {
    expect(verdict('Untitled upload', 'Veritasium', {
      interests: ['veritasium'],
    })).toBe('show');
  });
});

describe('decide() — block words override interests', () => {
  it('hides a video that matches an interest but also a block word', () => {
    expect(verdict('Formula 1 reaction compilation', 'Drama Channel', {
      interests: ['formula 1'],
      blockWords: ['reaction'],
    })).toBe('hide');
  });

  it('block words alone do not hide when interests is empty (feed stays full)', () => {
    expect(verdict('A reaction video', 'Channel', {
      interests: [],
      blockWords: ['reaction'],
    })).toBe('show');
  });
});

describe('decide() — whole-word (default) match mode', () => {
  it('does NOT match a keyword that only appears as a substring', () => {
    // "cat" must not match "education"
    expect(verdict('The future of education', 'School', {
      interests: ['cat'],
      matchMode: 'word',
    })).toBe('hide');
  });

  it('matches the whole word including a simple plural', () => {
    // word boundaries should still allow "cat" to match "cat" exactly
    expect(verdict('My cat is funny', 'Pets', {
      interests: ['cat'],
      matchMode: 'word',
    })).toBe('show');
  });

  it('matches multi-word phrases', () => {
    expect(verdict('A machine learning tutorial', 'AI Channel', {
      interests: ['machine learning'],
      matchMode: 'word',
    })).toBe('show');
  });
});

describe('decide() — loose (substring) match mode', () => {
  it('matches a keyword that appears as a substring', () => {
    expect(verdict('Concatenation explained', 'Code', {
      interests: ['cat'],
      matchMode: 'loose',
    })).toBe('show');
  });
});

describe('decide() — diacritics normalization', () => {
  it('matches accented text with an unaccented keyword when enabled', () => {
    expect(verdict('Best café tour in Paris', 'Travel', {
      interests: ['cafe'],
      normalizeDiacritics: true,
    })).toBe('show');
  });

  it('does not normalize when disabled', () => {
    expect(verdict('Best café tour in Paris', 'Travel', {
      interests: ['cafe'],
      normalizeDiacritics: false,
      matchMode: 'loose',
    })).toBe('hide');
  });
});

describe('decide() — robustness', () => {
  it('treats regex special characters in keywords as literal text', () => {
    expect(verdict('Learning C++ from scratch', 'Dev', {
      interests: ['c++'],
      matchMode: 'loose',
    })).toBe('show');
  });

  it('does not crash on missing title/channel and shows by default with interests set', () => {
    const compiled = buildMatcher(settings({ interests: ['formula 1'] }));
    expect(decide(null, undefined, compiled)).toBe('hide');
  });

  it('is case-insensitive', () => {
    expect(verdict('RUST PROGRAMMING DEEP DIVE', 'Channel', {
      interests: ['rust programming'],
    })).toBe('show');
  });

  it('ignores blank / whitespace-only keywords', () => {
    expect(verdict('Anything', 'Channel', {
      interests: ['   ', ''],
    })).toBe('show'); // effectively no interests -> show all
  });
});

describe('decide() — Unicode word-boundary regressions', () => {
  it('does NOT match interest "ai" inside "rain" or "brain"', () => {
    expect(verdict('Singing in the rain', 'Music', { interests: ['ai'] })).toBe('hide');
    expect(verdict('The human brain explained', 'Science', { interests: ['ai'] })).toBe('hide');
  });
  it('matches "ai" as a standalone word', () => {
    expect(verdict('AI is changing the world', 'Tech', { interests: ['ai'] })).toBe('show');
  });
  it('treats digits as word chars: "gpt5" does not match inside "mygpt5x"', () => {
    expect(verdict('the mygpt5x thing', 'Tech', { interests: ['gpt5'] })).toBe('hide');
    expect(verdict('New gpt5 model', 'Tech', { interests: ['gpt5'] })).toBe('show');
  });
  it('respects word boundaries in non-Latin scripts (Cyrillic)', () => {
    expect(verdict('Обзор новой машины', 'Авто', { interests: ['обзор'] })).toBe('show');
    expect(verdict('собзоры тут', 'X', { interests: ['обзор'] })).toBe('hide');
  });
});

describe('decide() — punctuation in keywords (word mode)', () => {
  it('escapes the dot in "node.js" (not a wildcard)', () => {
    expect(verdict('Learn node.js fast', 'Code', { interests: ['node.js'] })).toBe('show');
    expect(verdict('Learn nodexjs fast', 'Code', { interests: ['node.js'] })).toBe('hide');
    expect(verdict('Learn nodejs fast', 'Code', { interests: ['node.js'] })).toBe('hide');
  });
  it('handles hyphenated keywords literally', () => {
    expect(verdict('self-driving cars', 'Tech', { interests: ['self-driving'] })).toBe('show');
    expect(verdict('self driving cars', 'Tech', { interests: ['self-driving'] })).toBe('hide');
  });
  it('matches "c++" in word mode (not just loose)', () => {
    expect(verdict('Learning C++', 'Dev', { interests: ['c++'] })).toBe('show');
    expect(verdict('c++x', 'Dev', { interests: ['c++'] })).toBe('hide');
  });
});

describe('decide() — diacritics on the block side and in loose mode', () => {
  it('normalizes diacritics for block words too', () => {
    expect(verdict('café crawl', 'Food', {
      interests: ['crawl'], blockWords: ['cafe'], normalizeDiacritics: true,
    })).toBe('hide');
  });
  it('applies diacritic normalization in loose mode', () => {
    expect(verdict('café tour', 'T', {
      interests: ['cafe'], matchMode: 'loose', normalizeDiacritics: true,
    })).toBe('show');
  });
});

describe('decide() — defaults when settings keys are unset', () => {
  it('defaults matchMode to whole-word', () => {
    expect(verdict('education future', 'Edu', { interests: ['cat'], matchMode: undefined })).toBe('hide');
    expect(verdict('my cat', 'Pets', { interests: ['cat'], matchMode: undefined })).toBe('show');
  });
  it('defaults normalizeDiacritics to ON', () => {
    expect(verdict('café tour', 'T', { interests: ['cafe'], normalizeDiacritics: undefined })).toBe('show');
  });
});

describe('decide() — emoji, channel-side block, and defensive input', () => {
  it('matches around emoji in titles', () => {
    expect(verdict('Formula 1 race 🏎️🔥', 'Sky', { interests: ['formula 1'] })).toBe('show');
    expect(verdict('hot 🔥ai news', 'Tech', { interests: ['ai'] })).toBe('show');
  });
  it('blocks when a block word matches the channel name', () => {
    expect(verdict('Great video', 'Reaction Central', {
      interests: ['video'], blockWords: ['reaction'],
    })).toBe('hide');
  });
  it('shows (never crashes) when compiled is null/undefined/empty', () => {
    expect(decide('x', 'y', undefined)).toBe('show');
    expect(decide('x', 'y', null)).toBe('show');
    expect(decide('x', 'y', {})).toBe('show');
  });
  it('ignores duplicate and padded keywords', () => {
    expect(verdict('my cat', 'Pets', { interests: ['  cat  ', 'cat', 'CAT'] })).toBe('show');
  });
});

describe('decide() — always-show channels (allowlist)', () => {
  it('shows a video from an allowed channel even when nothing matches interests', () => {
    expect(verdict('Some terse title', 'Two Minute Papers', {
      interests: ['formula 1'],
      allowChannels: ['Two Minute Papers'],
    })).toBe('show');
  });
  it('lets block words still override an allowed channel', () => {
    expect(verdict('Reaction stream', 'Two Minute Papers', {
      interests: ['formula 1'],
      allowChannels: ['Two Minute Papers'],
      blockWords: ['reaction'],
    })).toBe('hide');
  });
  it('matches the allowlist against the channel name, not the title', () => {
    expect(verdict('My review of Two Minute Papers', 'Random Channel', {
      interests: ['formula 1'],
      allowChannels: ['Two Minute Papers'],
    })).toBe('hide');
  });
  it('still shows interest matches when the allowlist does not match', () => {
    expect(verdict('Formula 1 recap', 'Sky Sports', {
      interests: ['formula 1'],
      allowChannels: ['Two Minute Papers'],
    })).toBe('show');
  });
  it('is a no-op when allowChannels is empty', () => {
    expect(verdict('Cooking pasta', 'Food Channel', {
      interests: ['formula 1'],
      allowChannels: [],
    })).toBe('hide');
  });
  it('matches allowed channels case-insensitively', () => {
    expect(verdict('whatever', 'two minute PAPERS', {
      interests: ['formula 1'],
      allowChannels: ['Two Minute Papers'],
    })).toBe('show');
  });
});

describe('decide() — smart mode (whole-word + plural stemming)', () => {
  const smart = { matchMode: 'smart' };
  it('matches simple plurals (-s / -es)', () => {
    expect(verdict('Transformers explained', 'AI', { interests: ['transformer'], ...smart })).toBe('show');
    expect(verdict('AI agents everywhere', 'X', { interests: ['agent'], ...smart })).toBe('show');
    expect(verdict('Open boxes review', 'X', { interests: ['box'], ...smart })).toBe('show'); // -es
  });
  it('matches y -> ies plurals', () => {
    expect(verdict('Top growth strategies', 'Biz', { interests: ['strategy'], ...smart })).toBe('show');
    expect(verdict('Best tech companies', 'Biz', { interests: ['company'], ...smart })).toBe('show');
  });
  it('still matches the exact keyword', () => {
    expect(verdict('A transformer deep dive', 'AI', { interests: ['transformer'], ...smart })).toBe('show');
  });
  it('does NOT over-match verb forms (-ing / -ed) — avoids react->reacting, rust->rusted', () => {
    expect(verdict('Reacting to drama', 'X', { interests: ['react'], ...smart })).toBe('hide');
    expect(verdict('Restoring rusted bolts', 'X', { interests: ['rust'], ...smart })).toBe('hide');
    expect(verdict('Modeling clay tutorial', 'Art', { interests: ['model'], ...smart })).toBe('hide');
  });
  it('does NOT match unrelated substrings (cat != education / category)', () => {
    expect(verdict('The future of education', 'Edu', { interests: ['cat'], ...smart })).toBe('hide');
    expect(verdict('Pick a category', 'Edu', { interests: ['cat'], ...smart })).toBe('hide');
  });
  it('does not over-stem into a different word (ai != aid)', () => {
    expect(verdict('First aid basics', 'Health', { interests: ['ai'], ...smart })).toBe('hide');
    expect(verdict('AI basics', 'Tech', { interests: ['ai'], ...smart })).toBe('show');
  });
  it('block words also use plural stemming', () => {
    expect(verdict('Best reactions compilation', 'Drama', { interests: ['compilation'], blockWords: ['reaction'], ...smart })).toBe('hide');
  });
});

describe('decide() — whitespace normalization (NEW behavior)', () => {
  it('matches a phrase across irregular internal whitespace', () => {
    expect(verdict('A machine  learning tutorial', 'AI', {
      interests: ['machine learning'],
    })).toBe('show');
  });
  it('matches across a non-breaking space in the title', () => {
    expect(verdict('formula 1 highlights', 'Sky', {
      interests: ['formula 1'],
    })).toBe('show');
  });
});

describe('decide() — real AI/ML title patterns', () => {
  it('matches acronyms surrounded by punctuation', () => {
    expect(verdict('Building an LLM from scratch', 'Tech', { interests: ['llm'] })).toBe('show');
    expect(verdict('GPT-4o explained', 'Tech', { interests: ['gpt'] })).toBe('show');
    expect(verdict('RAG (retrieval-augmented generation)', 'Tech', { interests: ['rag'] })).toBe('show');
  });
  it('matches a single-word hashtag', () => {
    expect(verdict('#AI agents are here', 'Tech', { interests: ['ai'] })).toBe('show');
  });
  it('does not false-positive inside larger words', () => {
    expect(verdict('Retraining the brain', 'Science', { interests: ['ai'] })).toBe('hide');
  });
  it('whole-word mode is exact: "transformer" does NOT match "transformers"', () => {
    // documents the no-stemming limitation of word mode
    expect(verdict('Transformers explained', 'AI', { interests: ['transformer'] })).toBe('hide');
    expect(verdict('Transformers explained', 'AI', { interests: ['transformers'] })).toBe('show');
  });
  it('loose mode bridges the plural gap', () => {
    expect(verdict('Transformers explained', 'AI', { interests: ['transformer'], matchMode: 'loose' })).toBe('show');
  });
});

describe('matcher — performance sanity', () => {
  it('compiles a large keyword list and decides quickly', () => {
    const interests = Array.from({ length: 3000 }, (_, i) => 'topic' + i);
    interests.push('machine learning');
    const start = Date.now();
    const compiled = buildMatcher(settings({ interests }));
    let out = '';
    for (let i = 0; i < 500; i++) {
      out = decide('A machine learning deep dive ' + i, 'Channel ' + i, compiled);
    }
    const elapsed = Date.now() - start;
    expect(out).toBe('show');
    expect(elapsed).toBeLessThan(3000);
  });
});
