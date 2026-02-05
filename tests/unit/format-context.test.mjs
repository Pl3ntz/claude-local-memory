import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  formatContext,
  formatRelativeTime,
  deduplicateMemories,
} = require('../../src/lib/format-context.js');

describe('format-context', () => {
  describe('formatRelativeTime', () => {
    it('should return "just now" for recent timestamps', () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('should return minutes ago', () => {
      const thirtyFiveMinAgo = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      expect(formatRelativeTime(thirtyFiveMinAgo)).toContain('mins ago');
    });

    it('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toContain('hrs ago');
    });

    it('should return days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toContain('d ago');
    });

    it('should return date for older timestamps', () => {
      const result = formatRelativeTime('2023-06-15T00:00:00Z');
      expect(result).toContain('2023');
    });

    it('should handle invalid input without throwing', () => {
      // formatRelativeTime doesn't crash on invalid dates
      expect(() => formatRelativeTime('invalid')).not.toThrow();
      expect(typeof formatRelativeTime('invalid')).toBe('string');
    });
  });

  describe('deduplicateMemories', () => {
    it('should remove duplicate static facts', () => {
      const result = deduplicateMemories(
        ['fact1', 'fact1', 'fact2'],
        [],
        [],
      );
      expect(result.static).toEqual(['fact1', 'fact2']);
    });

    it('should remove dynamic facts that duplicate static ones', () => {
      const result = deduplicateMemories(
        ['shared fact'],
        ['shared fact', 'unique dynamic'],
        [],
      );
      expect(result.static).toEqual(['shared fact']);
      expect(result.dynamic).toEqual(['unique dynamic']);
    });

    it('should remove search results that duplicate facts', () => {
      const result = deduplicateMemories(
        ['fact1'],
        [],
        [{ memory: 'fact1' }, { memory: 'unique search' }],
      );
      expect(result.searchResults.length).toBe(1);
      expect(result.searchResults[0].memory).toBe('unique search');
    });

    it('should handle empty inputs', () => {
      const result = deduplicateMemories([], [], []);
      expect(result.static).toEqual([]);
      expect(result.dynamic).toEqual([]);
      expect(result.searchResults).toEqual([]);
    });
  });

  describe('formatContext', () => {
    it('should return null for null profileResult', () => {
      expect(formatContext(null)).toBeNull();
    });

    it('should return null when all data is empty', () => {
      const result = formatContext({
        profile: { static: [], dynamic: [] },
        searchResults: { results: [] },
      });
      expect(result).toBeNull();
    });

    it('should format static profile facts', () => {
      const result = formatContext({
        profile: { static: ['prefers dark mode'], dynamic: [] },
      });
      expect(result).toContain('User Profile (Persistent)');
      expect(result).toContain('prefers dark mode');
      expect(result).toContain('<supermemory-context>');
    });

    it('should format dynamic facts', () => {
      const result = formatContext({
        profile: { static: [], dynamic: ['working on auth'] },
      });
      expect(result).toContain('Recent Context');
      expect(result).toContain('working on auth');
    });

    it('should format search results when included', () => {
      const result = formatContext(
        {
          profile: { static: ['fact1'], dynamic: [] },
          searchResults: {
            results: [{ memory: 'relevant memory', similarity: 0.85 }],
          },
        },
        true,
        true,
      );
      expect(result).toContain('Relevant Memories');
      expect(result).toContain('relevant memory');
      expect(result).toContain('85%');
    });

    it('should respect maxResults parameter', () => {
      const manyFacts = Array.from({ length: 20 }, (_, i) => `fact ${i}`);
      const result = formatContext(
        { profile: { static: manyFacts, dynamic: [] } },
        true,
        false,
        3,
      );
      const factCount = (result.match(/- fact/g) || []).length;
      expect(factCount).toBe(3);
    });

    it('should exclude profile when includeProfile is false', () => {
      const result = formatContext(
        {
          profile: { static: ['hidden fact'], dynamic: [] },
          searchResults: {
            results: [{ memory: 'search result', similarity: 0.9 }],
          },
        },
        false,
        true,
      );
      expect(result).not.toContain('hidden fact');
      expect(result).toContain('search result');
    });
  });
});
