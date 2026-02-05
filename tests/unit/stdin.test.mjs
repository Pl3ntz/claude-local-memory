import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const { readStdin, writeOutput, outputSuccess, outputError } = require('../../src/lib/stdin.js');

describe('stdin', () => {
  describe('writeOutput', () => {
    it('should stringify and log data', () => {
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);

      writeOutput({ test: true });

      console.log = originalLog;
      expect(logs[0]).toBe('{"test":true}');
    });
  });

  describe('readStdin', () => {
    it('should parse JSON from stdin stream', async () => {
      const originalStdin = process.stdin;
      const mockStdin = new Readable({
        read() {
          this.push(JSON.stringify({ cwd: '/test', session_id: 'abc' }));
          this.push(null);
        },
      });
      Object.defineProperty(mockStdin, 'isTTY', { value: false });
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      const result = await readStdin();
      expect(result.cwd).toBe('/test');
      expect(result.session_id).toBe('abc');

      Object.defineProperty(process, 'stdin', {
        value: originalStdin,
        writable: true,
        configurable: true,
      });
    });

    it('should return empty object for empty input', async () => {
      const originalStdin = process.stdin;
      const mockStdin = new Readable({
        read() {
          this.push('');
          this.push(null);
        },
      });
      Object.defineProperty(mockStdin, 'isTTY', { value: false });
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      const result = await readStdin();
      expect(result).toEqual({});

      Object.defineProperty(process, 'stdin', {
        value: originalStdin,
        writable: true,
        configurable: true,
      });
    });

    it('should reject on invalid JSON', async () => {
      const originalStdin = process.stdin;
      const mockStdin = new Readable({
        read() {
          this.push('not valid json');
          this.push(null);
        },
      });
      Object.defineProperty(mockStdin, 'isTTY', { value: false });
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      await expect(readStdin()).rejects.toThrow('Failed to parse stdin JSON');

      Object.defineProperty(process, 'stdin', {
        value: originalStdin,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('outputSuccess', () => {
    it('should output hook context when additionalContext provided', () => {
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);

      outputSuccess('test context');

      console.log = originalLog;
      const parsed = JSON.parse(logs[0]);
      expect(parsed.hookSpecificOutput.additionalContext).toBe('test context');
    });

    it('should output continue when no context', () => {
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);

      outputSuccess();

      console.log = originalLog;
      const parsed = JSON.parse(logs[0]);
      expect(parsed.continue).toBe(true);
      expect(parsed.suppressOutput).toBe(true);
    });
  });

  describe('outputError', () => {
    it('should log error and output continue', () => {
      const logs = [];
      const errors = [];
      const originalLog = console.log;
      const originalError = console.error;
      console.log = (msg) => logs.push(msg);
      console.error = (msg) => errors.push(msg);

      outputError('test error');

      console.log = originalLog;
      console.error = originalError;
      expect(errors[0]).toContain('test error');
      const parsed = JSON.parse(logs[0]);
      expect(parsed.continue).toBe(true);
    });
  });
});
