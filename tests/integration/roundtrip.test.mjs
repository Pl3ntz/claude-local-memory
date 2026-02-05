import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { LocalMemoryClient } = require('../../src/lib/local-memory-client.js');
const { closeDb, getDb } = require('../../src/lib/database.js');

describe('roundtrip integration', () => {
  let client;

  beforeEach(() => {
    closeDb();
    client = new LocalMemoryClient('integration_test', ':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('should add -> search -> retrieve memories in a complete flow', async () => {
    await client.addMemory(
      'implemented user authentication with JWT tokens and refresh token rotation',
      'integration_test',
      { type: 'session_turn', project: 'myapp' },
    );

    await client.addMemory(
      'fixed database connection pooling issue causing timeouts under load',
      'integration_test',
      { type: 'session_turn', project: 'myapp' },
    );

    await client.addMemory(
      'added rate limiting middleware to protect API endpoints',
      'integration_test',
      { type: 'manual', project: 'myapp' },
    );

    const searchResult = await client.search('authentication', 'integration_test');
    expect(searchResult.results.length).toBeGreaterThan(0);
    expect(searchResult.results[0].memory).toContain('authentication');

    const listResult = await client.listMemories('integration_test');
    expect(listResult.memories.length).toBe(3);

    const dbSearchResult = await client.search('database', 'integration_test');
    expect(dbSearchResult.results.length).toBeGreaterThan(0);
  });

  it('should support profile facts + search in getProfile', async () => {
    const db = client._getDb();

    db.prepare(
      `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
       VALUES (?, ?, ?)`,
    ).run('integration_test', 'static', 'uses TypeScript and React');

    db.prepare(
      `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
       VALUES (?, ?, ?)`,
    ).run('integration_test', 'dynamic', 'working on payment integration');

    await client.addMemory(
      'integrated Stripe payment processing with webhook handling for subscription management',
      'integration_test',
      { type: 'session_turn', project: 'myapp' },
    );

    const profile = await client.getProfile('integration_test', 'payment');
    expect(profile.profile.static).toContain('uses TypeScript and React');
    expect(profile.profile.dynamic).toContain('working on payment integration');
    expect(profile.searchResults.results.length).toBeGreaterThan(0);
    expect(profile.searchResults.results[0].memory).toContain('Stripe');
  });

  it('should support upsert via customId', async () => {
    const r1 = await client.addMemory(
      'version 1 of the session',
      'integration_test',
      { type: 'session_turn' },
      'session-001',
    );
    expect(r1.status).toBe('created');

    const r2 = await client.addMemory(
      'version 2 of the session with more content added after continuation',
      'integration_test',
      { type: 'session_turn' },
      'session-001',
    );
    expect(r2.status).toBe('updated');
    expect(r2.id).toBe(r1.id);

    const memories = await client.listMemories('integration_test');
    expect(memories.memories.length).toBe(1);
    expect(memories.memories[0].content).toContain('version 2');
  });

  it('should delete memories and clean up FTS index', async () => {
    const { id } = await client.addMemory(
      'temporary debugging session with extensive logging',
      'integration_test',
      { type: 'session_turn' },
    );

    let result = await client.search('debugging', 'integration_test');
    expect(result.results.length).toBe(1);

    await client.deleteMemory(id);

    result = await client.search('debugging', 'integration_test');
    expect(result.results.length).toBe(0);

    const list = await client.listMemories('integration_test');
    expect(list.memories.length).toBe(0);
  });

  it('should isolate data between projects', async () => {
    await client.addMemory(
      'frontend React component development',
      'project_frontend',
      { project: 'frontend' },
    );

    await client.addMemory(
      'backend API development with Express',
      'project_backend',
      { project: 'backend' },
    );

    const frontendSearch = await client.search('development', 'project_frontend');
    const backendSearch = await client.search('development', 'project_backend');

    expect(frontendSearch.results.every((r) => r.containerTag === 'project_frontend')).toBe(true);
    expect(backendSearch.results.every((r) => r.containerTag === 'project_backend')).toBe(true);
  });
});
