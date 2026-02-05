import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  compressObservation,
  getObservationMetadata,
  getRelativePath,
  truncate,
} = require('../../src/lib/compress.js');

describe('compress', () => {
  describe('getRelativePath', () => {
    it('should return last two path segments', () => {
      expect(getRelativePath('/Users/dev/project/src/index.js')).toBe('src/index.js');
    });

    it('should return "unknown" for null/undefined', () => {
      expect(getRelativePath(null)).toBe('unknown');
      expect(getRelativePath(undefined)).toBe('unknown');
    });

    it('should handle short paths', () => {
      expect(getRelativePath('index.js')).toBe('index.js');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('hello world', 5)).toBe('hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('hi', 10)).toBe('hi');
    });

    it('should return empty string for null/undefined', () => {
      expect(truncate(null)).toBe('');
      expect(truncate(undefined)).toBe('');
    });
  });

  describe('compressObservation', () => {
    it('should compress Edit tool', () => {
      const result = compressObservation('Edit', {
        file_path: '/project/src/app.js',
        old_string: 'const x = 1',
        new_string: 'const x = 2',
      });
      expect(result).toContain('Edited');
      expect(result).toContain('src/app.js');
    });

    it('should compress Edit with replace_all', () => {
      const result = compressObservation('Edit', {
        file_path: '/project/src/app.js',
        old_string: 'foo',
        new_string: 'bar',
        replace_all: true,
      });
      expect(result).toContain('Replaced all');
    });

    it('should compress Write tool', () => {
      const result = compressObservation('Write', {
        file_path: '/project/src/new.js',
        content: 'console.log("hello")',
      });
      expect(result).toContain('Created');
      expect(result).toContain('src/new.js');
    });

    it('should compress Bash tool success', () => {
      const result = compressObservation(
        'Bash',
        { command: 'npm test', description: 'Run tests' },
        { exitCode: 0 },
      );
      expect(result).toContain('Ran: npm test');
      expect(result).toContain('Run tests');
      expect(result).not.toContain('FAILED');
    });

    it('should compress Bash tool failure', () => {
      const result = compressObservation(
        'Bash',
        { command: 'npm test' },
        { error: true, exitCode: 1 },
      );
      expect(result).toContain('[FAILED]');
    });

    it('should compress Task tool', () => {
      const result = compressObservation('Task', {
        description: 'research auth',
        subagent_type: 'Explore',
      });
      expect(result).toContain('Spawned Explore');
      expect(result).toContain('research auth');
    });

    it('should compress Read tool', () => {
      const result = compressObservation('Read', {
        file_path: '/project/src/app.js',
        limit: 50,
      });
      expect(result).toContain('Read');
      expect(result).toContain('50 lines');
    });

    it('should compress Glob tool', () => {
      const result = compressObservation('Glob', { pattern: '**/*.ts' });
      expect(result).toContain('Glob: **/*.ts');
    });

    it('should compress Grep tool', () => {
      const result = compressObservation('Grep', {
        pattern: 'TODO',
        path: '/project/src',
      });
      expect(result).toContain('Grep: "TODO"');
    });

    it('should compress WebFetch tool', () => {
      const result = compressObservation('WebFetch', {
        url: 'https://example.com',
      });
      expect(result).toContain('Fetched');
    });

    it('should compress WebSearch tool', () => {
      const result = compressObservation('WebSearch', {
        query: 'vitest coverage',
      });
      expect(result).toContain('Searched web');
    });

    it('should compress NotebookEdit tool', () => {
      const result = compressObservation('NotebookEdit', {
        notebook_path: '/project/notebook.ipynb',
        edit_mode: 'replace',
      });
      expect(result).toContain('replace notebook cell');
    });

    it('should handle unknown tools', () => {
      const result = compressObservation('CustomTool', {});
      expect(result).toBe('Used CustomTool');
    });
  });

  describe('getObservationMetadata', () => {
    it('should include tool name', () => {
      const meta = getObservationMetadata('Edit', {});
      expect(meta.tool).toBe('Edit');
    });

    it('should include file path', () => {
      const meta = getObservationMetadata('Edit', {
        file_path: '/project/src/app.js',
      });
      expect(meta.file).toBe('src/app.js');
    });

    it('should include command for Bash', () => {
      const meta = getObservationMetadata('Bash', {
        command: 'npm install',
      });
      expect(meta.command).toBe('npm install');
    });

    it('should include pattern for search tools', () => {
      const meta = getObservationMetadata('Grep', {
        pattern: 'TODO',
      });
      expect(meta.pattern).toBe('TODO');
    });

    it('should include notebook_path as file', () => {
      const meta = getObservationMetadata('NotebookEdit', {
        notebook_path: '/project/notebook.ipynb',
      });
      expect(meta.file).toBe('project/notebook.ipynb');
    });
  });
});
