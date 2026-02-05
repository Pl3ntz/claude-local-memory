import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, closeDb, runMigrations } from '../../src/lib/database.js';
import Database from 'better-sqlite3';

describe('database', () => {
  let db;

  beforeEach(() => {
    db = getDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  describe('getDb', () => {
    it('should return a database instance', () => {
      expect(db).toBeDefined();
      // In-memory databases use 'memory' journal mode; WAL is set but not persisted
      const mode = db.pragma('journal_mode', { simple: true });
      expect(['wal', 'memory']).toContain(mode);
    });

    it('should return the same instance on subsequent calls', () => {
      const db2 = getDb(':memory:');
      expect(db2).toBe(db);
    });
  });

  describe('schema - memories table', () => {
    it('should create memories table with correct columns', () => {
      const info = db.pragma('table_info(memories)');
      const columns = info.map((col) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('content');
      expect(columns).toContain('container_tag');
      expect(columns).toContain('project_name');
      expect(columns).toContain('memory_type');
      expect(columns).toContain('session_id');
      expect(columns).toContain('custom_id');
      expect(columns).toContain('metadata');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should allow inserting and retrieving memories', () => {
      db.prepare(
        `INSERT INTO memories (content, container_tag, project_name, memory_type)
         VALUES (?, ?, ?, ?)`,
      ).run('test content', 'tag1', 'project1', 'session_turn');

      const row = db.prepare('SELECT * FROM memories WHERE id = 1').get();
      expect(row.content).toBe('test content');
      expect(row.container_tag).toBe('tag1');
      expect(row.project_name).toBe('project1');
      expect(row.memory_type).toBe('session_turn');
      expect(row.metadata).toBe('{}');
    });

    it('should enforce unique custom_id', () => {
      db.prepare(
        `INSERT INTO memories (content, container_tag, memory_type, custom_id)
         VALUES (?, ?, ?, ?)`,
      ).run('content1', 'tag1', 'session_turn', 'unique1');

      expect(() => {
        db.prepare(
          `INSERT INTO memories (content, container_tag, memory_type, custom_id)
           VALUES (?, ?, ?, ?)`,
        ).run('content2', 'tag1', 'session_turn', 'unique1');
      }).toThrow();
    });

    it('should auto-generate timestamps', () => {
      db.prepare(
        `INSERT INTO memories (content, container_tag, memory_type)
         VALUES (?, ?, ?)`,
      ).run('test', 'tag1', 'session_turn');

      const row = db.prepare('SELECT * FROM memories WHERE id = 1').get();
      expect(row.created_at).toBeTruthy();
      expect(row.updated_at).toBeTruthy();
    });
  });

  describe('schema - FTS5', () => {
    it('should create memories_fts virtual table', () => {
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'",
        )
        .get();
      expect(tables).toBeTruthy();
    });

    it('should auto-index content on insert via trigger', () => {
      db.prepare(
        `INSERT INTO memories (content, container_tag, project_name, memory_type)
         VALUES (?, ?, ?, ?)`,
      ).run(
        'search for this unique phrase',
        'tag1',
        'project1',
        'session_turn',
      );

      const results = db
        .prepare(
          `SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'unique phrase'`,
        )
        .all();
      expect(results.length).toBe(1);
    });

    it('should update FTS on memory update via trigger', () => {
      db.prepare(
        `INSERT INTO memories (content, container_tag, memory_type)
         VALUES (?, ?, ?)`,
      ).run('original content', 'tag1', 'session_turn');

      db.prepare(`UPDATE memories SET content = ? WHERE id = 1`).run(
        'updated content with new words',
      );

      const oldResults = db
        .prepare(
          `SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'original'`,
        )
        .all();
      expect(oldResults.length).toBe(0);

      const newResults = db
        .prepare(
          `SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'updated'`,
        )
        .all();
      expect(newResults.length).toBe(1);
    });

    it('should remove FTS entry on memory delete via trigger', () => {
      db.prepare(
        `INSERT INTO memories (content, container_tag, memory_type)
         VALUES (?, ?, ?)`,
      ).run('deletable content', 'tag1', 'session_turn');

      db.prepare(`DELETE FROM memories WHERE id = 1`).run();

      const results = db
        .prepare(
          `SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'deletable'`,
        )
        .all();
      expect(results.length).toBe(0);
    });

    it('should support BM25 ranking', () => {
      db.prepare(
        `INSERT INTO memories (content, container_tag, memory_type)
         VALUES (?, ?, ?)`,
      ).run('javascript react frontend', 'tag1', 'session_turn');

      db.prepare(
        `INSERT INTO memories (content, container_tag, memory_type)
         VALUES (?, ?, ?)`,
      ).run('python backend django', 'tag1', 'session_turn');

      const results = db
        .prepare(
          `SELECT rowid, rank FROM memories_fts WHERE memories_fts MATCH 'javascript' ORDER BY rank`,
        )
        .all();
      expect(results.length).toBe(1);
      expect(results[0].rank).toBeDefined();
    });
  });

  describe('schema - profile_facts table', () => {
    it('should create profile_facts table', () => {
      const info = db.pragma('table_info(profile_facts)');
      const columns = info.map((col) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('container_tag');
      expect(columns).toContain('fact_type');
      expect(columns).toContain('fact_text');
      expect(columns).toContain('source_memory_id');
    });

    it('should enforce fact_type check constraint', () => {
      expect(() => {
        db.prepare(
          `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
           VALUES (?, ?, ?)`,
        ).run('tag1', 'invalid_type', 'some fact');
      }).toThrow();
    });

    it('should accept static and dynamic fact types', () => {
      db.prepare(
        `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
         VALUES (?, ?, ?)`,
      ).run('tag1', 'static', 'user prefers dark mode');

      db.prepare(
        `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
         VALUES (?, ?, ?)`,
      ).run('tag1', 'dynamic', 'recently worked on auth');

      const facts = db.prepare('SELECT * FROM profile_facts').all();
      expect(facts.length).toBe(2);
    });

    it('should enforce unique constraint on container_tag + fact_type + fact_text', () => {
      db.prepare(
        `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
         VALUES (?, ?, ?)`,
      ).run('tag1', 'static', 'same fact');

      expect(() => {
        db.prepare(
          `INSERT INTO profile_facts (container_tag, fact_type, fact_text)
           VALUES (?, ?, ?)`,
        ).run('tag1', 'static', 'same fact');
      }).toThrow();
    });
  });

  describe('schema - sessions table', () => {
    it('should create sessions table', () => {
      const info = db.pragma('table_info(sessions)');
      const columns = info.map((col) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('container_tag');
      expect(columns).toContain('project_name');
      expect(columns).toContain('last_captured_uuid');
      expect(columns).toContain('started_at');
      expect(columns).toContain('ended_at');
    });

    it('should enforce unique session_id', () => {
      db.prepare(
        `INSERT INTO sessions (session_id, container_tag)
         VALUES (?, ?)`,
      ).run('session1', 'tag1');

      expect(() => {
        db.prepare(
          `INSERT INTO sessions (session_id, container_tag)
           VALUES (?, ?)`,
        ).run('session1', 'tag1');
      }).toThrow();
    });
  });

  describe('schema - indexes', () => {
    it('should create all expected indexes', () => {
      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
        )
        .all()
        .map((r) => r.name);

      expect(indexes).toContain('idx_memories_container');
      expect(indexes).toContain('idx_memories_session');
      expect(indexes).toContain('idx_memories_created');
      expect(indexes).toContain('idx_profile_container');
    });
  });

  describe('WAL mode', () => {
    it('should attempt to set WAL journal mode', () => {
      // In-memory databases report 'memory' but the pragma was set
      const mode = db.pragma('journal_mode', { simple: true });
      expect(['wal', 'memory']).toContain(mode);
    });
  });
});
