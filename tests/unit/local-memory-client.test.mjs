import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { LocalMemoryClient } = require('../../src/lib/local-memory-client.js');
const { closeDb } = require('../../src/lib/database.js');

describe('LocalMemoryClient', () => {
  let client;

  beforeEach(() => {
    closeDb();
    client = new LocalMemoryClient('test_container', ':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  describe('constructor', () => {
    it('should create a client with container tag', () => {
      expect(client).toBeDefined();
    });

    it('should use default container tag if none provided', () => {
      closeDb();
      const defaultClient = new LocalMemoryClient(null, ':memory:');
      expect(defaultClient).toBeDefined();
    });
  });

  describe('addMemory', () => {
    it('should insert a memory and return its id', async () => {
      const result = await client.addMemory(
        'test content',
        'test_container',
        { type: 'manual' },
      );
      expect(result.id).toBeDefined();
      expect(result.status).toBe('created');
      expect(result.containerTag).toBe('test_container');
    });

    it('should use default container tag when none specified', async () => {
      const result = await client.addMemory('test content');
      expect(result.containerTag).toBe('test_container');
    });

    it('should handle customId for upsert', async () => {
      const r1 = await client.addMemory(
        'original',
        'test_container',
        {},
        'custom1',
      );
      expect(r1.id).toBeDefined();

      const r2 = await client.addMemory(
        'updated',
        'test_container',
        {},
        'custom1',
      );
      expect(r2.status).toBe('updated');
    });

    it('should store metadata as JSON', async () => {
      await client.addMemory('test', 'test_container', {
        type: 'manual',
        project: 'myproject',
      });

      const memories = await client.listMemories('test_container', 1);
      const meta = JSON.parse(memories.memories[0].metadata);
      expect(meta.type).toBe('manual');
      expect(meta.project).toBe('myproject');
    });

    it('should store project_name from metadata', async () => {
      await client.addMemory('test', 'test_container', {
        project: 'myproject',
      });

      const memories = await client.listMemories('test_container', 1);
      expect(memories.memories[0].project_name).toBe('myproject');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await client.addMemory(
        'javascript react frontend development',
        'test_container',
        { project: 'webapp' },
      );
      await client.addMemory(
        'python backend django api server',
        'test_container',
        { project: 'api' },
      );
      await client.addMemory(
        'database postgresql migrations schema',
        'test_container',
        { project: 'api' },
      );
    });

    it('should find memories matching query', async () => {
      const result = await client.search('javascript', 'test_container');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].memory).toContain('javascript');
    });

    it('should return similarity scores between 0 and 1', async () => {
      const result = await client.search('javascript react', 'test_container');
      for (const r of result.results) {
        expect(r.similarity).toBeGreaterThanOrEqual(0);
        expect(r.similarity).toBeLessThanOrEqual(1);
      }
    });

    it('should respect limit option', async () => {
      const result = await client.search('development api', 'test_container', {
        limit: 1,
      });
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should return total count', async () => {
      const result = await client.search('api', 'test_container');
      expect(result.total).toBeDefined();
    });

    it('should use default container tag when none specified', async () => {
      const result = await client.search('javascript');
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should return empty results for no matches', async () => {
      const result = await client.search(
        'nonexistentxyz',
        'test_container',
      );
      expect(result.results.length).toBe(0);
    });

    it('should filter by container tag', async () => {
      await client.addMemory(
        'javascript in other project',
        'other_container',
        {},
      );

      const result = await client.search('javascript', 'test_container');
      const allInContainer = result.results.every(
        (r) => r.containerTag === 'test_container',
      );
      expect(allInContainer).toBe(true);
    });
  });

  describe('getProfile', () => {
    it('should return profile facts and search results', async () => {
      const db = client._getDb();
      db.prepare(
        `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
         VALUES (?, ?, ?)`,
      ).run('test_container', 'static', 'prefers TypeScript');

      db.prepare(
        `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
         VALUES (?, ?, ?)`,
      ).run('test_container', 'dynamic', 'working on auth module');

      await client.addMemory('auth implementation details', 'test_container');

      const result = await client.getProfile('test_container', 'auth');
      expect(result.profile.static).toContain('prefers TypeScript');
      expect(result.profile.dynamic).toContain('working on auth module');
      expect(result.searchResults).toBeDefined();
    });

    it('should return empty profile when no facts exist', async () => {
      const result = await client.getProfile('test_container', 'anything');
      expect(result.profile.static).toEqual([]);
      expect(result.profile.dynamic).toEqual([]);
    });

    it('should use default container tag', async () => {
      const result = await client.getProfile(null, 'test');
      expect(result.profile).toBeDefined();
    });
  });

  describe('listMemories', () => {
    it('should list memories ordered by id desc', async () => {
      await client.addMemory('first', 'test_container');
      await client.addMemory('second', 'test_container');
      await client.addMemory('third', 'test_container');

      const result = await client.listMemories('test_container');
      expect(result.memories.length).toBe(3);
      expect(result.memories[0].content).toBe('third');
      expect(result.memories[2].content).toBe('first');
    });

    it('should respect limit parameter', async () => {
      await client.addMemory('one', 'test_container');
      await client.addMemory('two', 'test_container');
      await client.addMemory('three', 'test_container');

      const result = await client.listMemories('test_container', 2);
      expect(result.memories.length).toBe(2);
    });

    it('should use default limit of 20', async () => {
      for (let i = 0; i < 25; i++) {
        await client.addMemory(`memory ${i}`, 'test_container');
      }

      const result = await client.listMemories('test_container');
      expect(result.memories.length).toBe(20);
    });
  });

  describe('deleteMemory', () => {
    it('should delete a memory by id', async () => {
      const { id } = await client.addMemory('to delete', 'test_container');
      await client.deleteMemory(id);

      const result = await client.listMemories('test_container');
      expect(result.memories.length).toBe(0);
    });

    it('should not throw for non-existent id', async () => {
      await expect(client.deleteMemory(999)).resolves.not.toThrow();
    });

    it('should also remove from FTS index', async () => {
      const { id } = await client.addMemory(
        'searchable unique content',
        'test_container',
      );
      await client.deleteMemory(id);

      const result = await client.search('searchable', 'test_container');
      expect(result.results.length).toBe(0);
    });
  });

  describe('project isolation', () => {
    it('should isolate memories by container tag', async () => {
      await client.addMemory('project A stuff', 'project_a');
      await client.addMemory('project B stuff', 'project_b');

      const resultA = await client.listMemories('project_a');
      const resultB = await client.listMemories('project_b');

      expect(resultA.memories.length).toBe(1);
      expect(resultB.memories.length).toBe(1);
      expect(resultA.memories[0].content).toBe('project A stuff');
      expect(resultB.memories[0].content).toBe('project B stuff');
    });
  });
});
