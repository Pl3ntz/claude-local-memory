import { describe, it, expect } from 'vitest';
import {
  sanitizeContent,
  validateContentLength,
  validateContainerTag,
  sanitizeMetadata,
} from '../../src/lib/validate-local.js';

describe('sanitizeContent', () => {
  it('should return empty string for null/undefined/non-string input', () => {
    expect(sanitizeContent(null)).toBe('');
    expect(sanitizeContent(undefined)).toBe('');
    expect(sanitizeContent(123)).toBe('');
  });

  it('should remove control characters', () => {
    expect(sanitizeContent('hello\x00world')).toBe('helloworld');
    expect(sanitizeContent('test\x07data')).toBe('testdata');
    expect(sanitizeContent('line\x1Fend')).toBe('lineend');
  });

  it('should remove BOM characters', () => {
    expect(sanitizeContent('\uFEFFhello')).toBe('hello');
  });

  it('should remove specials unicode block characters', () => {
    expect(sanitizeContent('test\uFFF0data')).toBe('testdata');
    expect(sanitizeContent('test\uFFFFdata')).toBe('testdata');
  });

  it('should preserve tabs, newlines, and carriage returns', () => {
    expect(sanitizeContent('hello\tworld')).toBe('hello\tworld');
    expect(sanitizeContent('hello\nworld')).toBe('hello\nworld');
    expect(sanitizeContent('hello\rworld')).toBe('hello\rworld');
  });

  it('should truncate to maxLength', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeContent(long, 100)).toBe('a'.repeat(100));
  });

  it('should use default maxLength of 100000', () => {
    const long = 'a'.repeat(100001);
    expect(sanitizeContent(long).length).toBe(100000);
  });

  it('should not truncate content within maxLength', () => {
    expect(sanitizeContent('hello', 100)).toBe('hello');
  });
});

describe('validateContentLength', () => {
  it('should return valid for content within bounds', () => {
    expect(validateContentLength('hello world')).toEqual({ valid: true });
  });

  it('should reject content below minimum', () => {
    const result = validateContentLength('', 1);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('minimum');
  });

  it('should reject content above maximum', () => {
    const long = 'a'.repeat(200);
    const result = validateContentLength(long, 1, 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('maximum');
  });

  it('should accept content at exact boundaries', () => {
    expect(validateContentLength('a', 1, 1)).toEqual({ valid: true });
  });

  it('should use default min=1 and max=100000', () => {
    expect(validateContentLength('a')).toEqual({ valid: true });
    expect(validateContentLength('')).toEqual({
      valid: false,
      reason: expect.stringContaining('minimum'),
    });
  });
});

describe('validateContainerTag', () => {
  it('should accept valid alphanumeric tags', () => {
    expect(validateContainerTag('claudecode_project_abc123')).toEqual({
      valid: true,
    });
  });

  it('should accept tags with underscores and hyphens', () => {
    expect(validateContainerTag('my-tag_v2')).toEqual({ valid: true });
  });

  it('should reject empty/null/non-string tags', () => {
    expect(validateContainerTag('')).toEqual({
      valid: false,
      reason: expect.stringContaining('empty'),
    });
    expect(validateContainerTag(null)).toEqual({
      valid: false,
      reason: expect.stringContaining('empty'),
    });
  });

  it('should reject tags exceeding 100 characters', () => {
    const long = 'a'.repeat(101);
    expect(validateContainerTag(long)).toEqual({
      valid: false,
      reason: expect.stringContaining('100'),
    });
  });

  it('should reject tags with invalid characters', () => {
    expect(validateContainerTag('tag with spaces')).toEqual({
      valid: false,
      reason: expect.stringContaining('invalid'),
    });
    expect(validateContainerTag('tag@special!')).toEqual({
      valid: false,
      reason: expect.stringContaining('invalid'),
    });
  });

  it('should reject tags starting or ending with - or _', () => {
    expect(validateContainerTag('-startwith')).toEqual({
      valid: false,
      reason: expect.stringContaining('start or end'),
    });
    expect(validateContainerTag('endwith_')).toEqual({
      valid: false,
      reason: expect.stringContaining('start or end'),
    });
  });
});

describe('sanitizeMetadata', () => {
  it('should pass through valid string, number, boolean fields', () => {
    const input = { key: 'value', count: 42, active: true };
    expect(sanitizeMetadata(input)).toEqual(input);
  });

  it('should filter out non-string/number/boolean values', () => {
    const input = { good: 'yes', bad: { nested: true }, arr: [1, 2] };
    expect(sanitizeMetadata(input)).toEqual({ good: 'yes' });
  });

  it('should limit to 50 fields', () => {
    const input = {};
    for (let i = 0; i < 60; i++) {
      input[`key${i}`] = `val${i}`;
    }
    const result = sanitizeMetadata(input);
    expect(Object.keys(result).length).toBe(50);
  });

  it('should truncate string values to 1024 chars', () => {
    const input = { long: 'a'.repeat(2000) };
    const result = sanitizeMetadata(input);
    expect(result.long.length).toBe(1024);
  });

  it('should reject keys longer than 128 chars', () => {
    const longKey = 'a'.repeat(129);
    const input = { [longKey]: 'value', good: 'yes' };
    expect(sanitizeMetadata(input)).toEqual({ good: 'yes' });
  });

  it('should reject keys with special characters', () => {
    const input = { 'key with spaces': 'value', good: 'yes' };
    expect(sanitizeMetadata(input)).toEqual({ good: 'yes' });
  });

  it('should reject NaN and Infinity numbers', () => {
    const input = { nan: NaN, inf: Infinity, good: 42 };
    expect(sanitizeMetadata(input)).toEqual({ good: 42 });
  });

  it('should return empty object for null/undefined input', () => {
    expect(sanitizeMetadata(null)).toEqual({});
    expect(sanitizeMetadata(undefined)).toEqual({});
  });
});
