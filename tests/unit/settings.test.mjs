import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

describe('settings', () => {
  let tmpDir;
  let originalEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-memory-test-'));
    originalEnv = { ...process.env };

    // Clear cached module to re-import with fresh state
    const modulePath = require.resolve('../../src/lib/settings.js');
    delete require.cache[modulePath];

    // Temporarily override SETTINGS_DIR by setting env
    process.env.LOCAL_MEMORY_DIR = tmpDir;
  });

  afterEach(() => {
    process.env = originalEnv;
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should export loadSettings function', () => {
    const { loadSettings } = require('../../src/lib/settings.js');
    expect(typeof loadSettings).toBe('function');
  });

  it('should export DEFAULT_SETTINGS with expected keys', () => {
    const { DEFAULT_SETTINGS } = require('../../src/lib/settings.js');
    expect(DEFAULT_SETTINGS.skipTools).toBeDefined();
    expect(DEFAULT_SETTINGS.captureTools).toBeDefined();
    expect(DEFAULT_SETTINGS.maxProfileItems).toBe(5);
    expect(DEFAULT_SETTINGS.debug).toBe(false);
    expect(DEFAULT_SETTINGS.injectProfile).toBe(true);
  });

  it('should NOT export getApiKey', () => {
    const settings = require('../../src/lib/settings.js');
    expect(settings.getApiKey).toBeUndefined();
  });

  it('should return default settings when no file exists', () => {
    const { loadSettings } = require('../../src/lib/settings.js');
    const settings = loadSettings();
    expect(settings.skipTools).toBeDefined();
    expect(settings.debug).toBe(false);
  });

  it('should override debug via env var', () => {
    process.env.LOCAL_MEMORY_DEBUG = 'true';
    const { loadSettings } = require('../../src/lib/settings.js');
    const settings = loadSettings();
    expect(settings.debug).toBe(true);
  });

  it('should override skipTools via env var', () => {
    process.env.LOCAL_MEMORY_SKIP_TOOLS = 'Read,Glob';
    const { loadSettings } = require('../../src/lib/settings.js');
    const settings = loadSettings();
    expect(settings.skipTools).toEqual(['Read', 'Glob']);
  });

  it('should export shouldCaptureTool', () => {
    const { shouldCaptureTool, DEFAULT_SETTINGS } = require('../../src/lib/settings.js');
    expect(shouldCaptureTool('Edit', DEFAULT_SETTINGS)).toBe(true);
    expect(shouldCaptureTool('Read', DEFAULT_SETTINGS)).toBe(false);
  });

  it('should export debugLog without errors', () => {
    const { debugLog, DEFAULT_SETTINGS } = require('../../src/lib/settings.js');
    expect(() => debugLog(DEFAULT_SETTINGS, 'test message')).not.toThrow();
    expect(() => debugLog({ ...DEFAULT_SETTINGS, debug: true }, 'test', { key: 'val' })).not.toThrow();
  });

  it('should use LOCAL_MEMORY_DIR env for settings directory when set', () => {
    const settings = require('../../src/lib/settings.js');
    // Since LOCAL_MEMORY_DIR is set in beforeEach, SETTINGS_DIR should match it
    expect(settings.SETTINGS_DIR).toBe(tmpDir);
  });

  it('should save and load settings', () => {
    const { saveSettings, loadSettings } = require('../../src/lib/settings.js');
    saveSettings({ maxProfileItems: 10, debug: true });

    // Clear module cache and reload
    const modulePath = require.resolve('../../src/lib/settings.js');
    delete require.cache[modulePath];
    const { loadSettings: reloadSettings } = require('../../src/lib/settings.js');

    const loaded = reloadSettings();
    expect(loaded.maxProfileItems).toBe(10);
    expect(loaded.debug).toBe(true);
  });

  it('should handle corrupt settings file gracefully', () => {
    const { SETTINGS_FILE, loadSettings } = require('../../src/lib/settings.js');
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, 'not valid json!!!');

    const settings = loadSettings();
    // Should fall back to defaults
    expect(settings.maxProfileItems).toBe(5);
  });

  it('should capture tools based on settings', () => {
    const { shouldCaptureTool } = require('../../src/lib/settings.js');

    const settings = {
      skipTools: ['Read'],
      captureTools: ['Edit', 'Write'],
    };

    expect(shouldCaptureTool('Edit', settings)).toBe(true);
    expect(shouldCaptureTool('Read', settings)).toBe(false);
    expect(shouldCaptureTool('Bash', settings)).toBe(false);
  });

  it('should return true for tools not in either list when captureTools is empty', () => {
    const { shouldCaptureTool } = require('../../src/lib/settings.js');

    const settings = {
      skipTools: ['Read'],
      captureTools: [],
    };

    expect(shouldCaptureTool('Edit', settings)).toBe(true);
    expect(shouldCaptureTool('Read', settings)).toBe(false);
  });
});
