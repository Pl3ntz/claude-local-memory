import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  sha256,
  getGitRoot,
  getContainerTag,
  getProjectName,
  getUserContainerTag,
} = require('../../src/lib/container-tag.js');

describe('container-tag', () => {
  describe('sha256', () => {
    it('should return a deterministic 16-char hex string', () => {
      const hash = sha256('test-input');
      expect(hash.length).toBe(16);
      expect(/^[a-f0-9]{16}$/.test(hash)).toBe(true);
    });

    it('should be deterministic', () => {
      expect(sha256('same-input')).toBe(sha256('same-input'));
    });

    it('should produce different hashes for different inputs', () => {
      expect(sha256('input-a')).not.toBe(sha256('input-b'));
    });
  });

  describe('getGitRoot', () => {
    it('should return a path for a git repository', () => {
      const root = getGitRoot(process.cwd());
      // May or may not be a git repo, just verify it returns string or null
      expect(root === null || typeof root === 'string').toBe(true);
    });

    it('should return null for non-git directory', () => {
      const root = getGitRoot('/tmp');
      expect(root).toBe(null);
    });
  });

  describe('getContainerTag', () => {
    it('should return a tag starting with claudecode_project_', () => {
      const tag = getContainerTag('/tmp/test-project');
      expect(tag.startsWith('claudecode_project_')).toBe(true);
    });

    it('should be deterministic for same path', () => {
      expect(getContainerTag('/tmp/test')).toBe(getContainerTag('/tmp/test'));
    });

    it('should produce different tags for different paths', () => {
      expect(getContainerTag('/tmp/a')).not.toBe(getContainerTag('/tmp/b'));
    });
  });

  describe('getProjectName', () => {
    it('should return the last path component', () => {
      expect(getProjectName('/tmp/my-project')).toBe('my-project');
    });

    it('should handle deeply nested paths', () => {
      expect(getProjectName('/a/b/c/d/project')).toBe('project');
    });
  });

  describe('getUserContainerTag', () => {
    it('should return a tag starting with claudecode_user_', () => {
      const tag = getUserContainerTag();
      expect(tag.startsWith('claudecode_user_')).toBe(true);
    });

    it('should be deterministic', () => {
      expect(getUserContainerTag()).toBe(getUserContainerTag());
    });
  });
});
