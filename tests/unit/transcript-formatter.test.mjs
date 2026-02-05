import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const {
  parseTranscript,
  getEntriesSinceLastCapture,
  formatEntry,
  formatNewEntries,
  cleanContent,
  truncate,
} = require('../../src/lib/transcript-formatter.js');

describe('transcript-formatter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-test-'));
  });

  describe('parseTranscript', () => {
    it('should parse JSONL file', () => {
      const filePath = path.join(tmpDir, 'test.jsonl');
      const lines = [
        JSON.stringify({ type: 'user', uuid: 'u1', message: { content: 'hello' } }),
        JSON.stringify({ type: 'assistant', uuid: 'u2', message: { content: [{ type: 'text', text: 'hi' }] } }),
      ];
      fs.writeFileSync(filePath, lines.join('\n'));

      const entries = parseTranscript(filePath);
      expect(entries.length).toBe(2);
      expect(entries[0].type).toBe('user');
      expect(entries[1].type).toBe('assistant');
    });

    it('should return empty array for non-existent file', () => {
      expect(parseTranscript('/nonexistent/path.jsonl')).toEqual([]);
    });

    it('should skip invalid JSON lines', () => {
      const filePath = path.join(tmpDir, 'bad.jsonl');
      fs.writeFileSync(filePath, 'not json\n{"type":"user","uuid":"u1"}');

      const entries = parseTranscript(filePath);
      expect(entries.length).toBe(1);
    });
  });

  describe('getEntriesSinceLastCapture', () => {
    const entries = [
      { type: 'user', uuid: 'u1' },
      { type: 'assistant', uuid: 'u2' },
      { type: 'user', uuid: 'u3' },
      { type: 'assistant', uuid: 'u4' },
    ];

    it('should return all user/assistant entries when no lastCapturedUuid', () => {
      const result = getEntriesSinceLastCapture(entries, null);
      expect(result.length).toBe(4);
    });

    it('should return entries after lastCapturedUuid', () => {
      const result = getEntriesSinceLastCapture(entries, 'u2');
      expect(result.length).toBe(2);
      expect(result[0].uuid).toBe('u3');
    });

    it('should return empty array when lastCapturedUuid is the last entry', () => {
      const result = getEntriesSinceLastCapture(entries, 'u4');
      expect(result.length).toBe(0);
    });
  });

  describe('cleanContent', () => {
    it('should remove system-reminder tags', () => {
      const text = 'hello <system-reminder>hidden</system-reminder> world';
      expect(cleanContent(text)).toBe('hello  world');
    });

    it('should remove supermemory-context tags', () => {
      const text = 'before <supermemory-context>ctx</supermemory-context> after';
      expect(cleanContent(text)).toBe('before  after');
    });

    it('should return empty string for null/undefined', () => {
      expect(cleanContent(null)).toBe('');
      expect(cleanContent(undefined)).toBe('');
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      const result = truncate('hello world', 5);
      expect(result).toBe('hello...');
    });

    it('should not truncate short text', () => {
      expect(truncate('hi', 10)).toBe('hi');
    });

    it('should handle null/undefined', () => {
      expect(truncate(null, 10)).toBe(null);
    });
  });

  describe('formatEntry', () => {
    it('should format user message with string content', () => {
      const entry = {
        type: 'user',
        message: { content: 'test user message that is valid' },
      };
      const result = formatEntry(entry);
      expect(result).toContain('[role:user]');
      expect(result).toContain('test user message');
      expect(result).toContain('[user:end]');
    });

    it('should format user message with array content', () => {
      const entry = {
        type: 'user',
        message: {
          content: [{ type: 'text', text: 'array text content here' }],
        },
      };
      const result = formatEntry(entry);
      expect(result).toContain('[role:user]');
      expect(result).toContain('array text content here');
    });

    it('should format tool_result blocks in user messages', () => {
      const entry = {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool123',
              content: 'result output text here for testing coverage',
              is_error: false,
            },
          ],
        },
      };
      const result = formatEntry(entry);
      expect(result).toContain('[tool_result:');
      expect(result).toContain('status="success"');
    });

    it('should format error tool_result blocks', () => {
      const entry = {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool456',
              content: 'error message here for test coverage validation',
              is_error: true,
            },
          ],
        },
      };
      const result = formatEntry(entry);
      expect(result).toContain('status="error"');
    });

    it('should format assistant message with tool_use blocks', () => {
      const entry = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool789',
              name: 'Edit',
              input: { file_path: '/src/app.js', old_string: 'old', new_string: 'new' },
            },
          ],
        },
      };
      const result = formatEntry(entry);
      expect(result).toContain('[tool:Edit]');
      expect(result).toContain('file_path: /src/app.js');
      expect(result).toContain('[tool:end]');
    });

    it('should skip thinking blocks in assistant messages', () => {
      const entry = {
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', text: 'thinking text' },
            { type: 'text', text: 'visible response text for test' },
          ],
        },
      };
      const result = formatEntry(entry);
      expect(result).not.toContain('thinking text');
      expect(result).toContain('visible response text for test');
    });

    it('should return empty string for null message', () => {
      expect(formatEntry({ type: 'user', message: null })).toBe('');
      expect(formatEntry({ type: 'assistant', message: null })).toBe('');
    });

    it('should return empty string for unknown type', () => {
      expect(formatEntry({ type: 'system', message: {} })).toBe('');
    });

    it('should return null for assistant message with non-array content', () => {
      const entry = {
        type: 'assistant',
        message: { content: 'string content' },
      };
      expect(formatEntry(entry)).toBe('');
    });
  });

  describe('formatNewEntries (pure function)', () => {
    it('should return null for empty transcript', () => {
      const filePath = path.join(tmpDir, 'empty.jsonl');
      fs.writeFileSync(filePath, '');

      const result = formatNewEntries(filePath, null);
      expect(result).toBeNull();
    });

    it('should format new entries and return formatted text with lastUuid', () => {
      const filePath = path.join(tmpDir, 'session.jsonl');
      const lines = [
        JSON.stringify({
          type: 'user',
          uuid: 'u1',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: 'implement auth' },
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'u2',
          timestamp: '2024-01-01T00:00:01Z',
          message: {
            content: [{ type: 'text', text: 'I will implement auth for you.' }],
          },
        }),
      ];
      fs.writeFileSync(filePath, lines.join('\n'));

      const result = formatNewEntries(filePath, null);
      expect(result).not.toBeNull();
      expect(result.formatted).toContain('[role:user]');
      expect(result.formatted).toContain('implement auth');
      expect(result.formatted).toContain('[role:assistant]');
      expect(result.lastUuid).toBe('u2');
    });

    it('should only include entries after lastCapturedUuid', () => {
      const filePath = path.join(tmpDir, 'incremental.jsonl');
      const lines = [
        JSON.stringify({
          type: 'user',
          uuid: 'u1',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: 'old message' },
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'u2',
          timestamp: '2024-01-01T00:00:01Z',
          message: { content: [{ type: 'text', text: 'old response' }] },
        }),
        JSON.stringify({
          type: 'user',
          uuid: 'u3',
          timestamp: '2024-01-01T00:00:02Z',
          message: { content: 'new message' },
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'u4',
          timestamp: '2024-01-01T00:00:03Z',
          message: { content: [{ type: 'text', text: 'new response' }] },
        }),
      ];
      fs.writeFileSync(filePath, lines.join('\n'));

      const result = formatNewEntries(filePath, 'u2');
      expect(result.formatted).not.toContain('old message');
      expect(result.formatted).toContain('new message');
      expect(result.lastUuid).toBe('u4');
    });

    it('should return null when content is too short', () => {
      const filePath = path.join(tmpDir, 'short.jsonl');
      const lines = [
        JSON.stringify({
          type: 'user',
          uuid: 'u1',
          timestamp: '2024-01-01T00:00:00Z',
          message: { content: 'hi' },
        }),
      ];
      fs.writeFileSync(filePath, lines.join('\n'));

      const result = formatNewEntries(filePath, null);
      expect(result).toBeNull();
    });
  });
});
