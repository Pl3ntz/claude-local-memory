const { LocalMemoryClient } = require('./lib/local-memory-client');
const { getContainerTag, getProjectName } = require('./lib/container-tag');
const { loadSettings, debugLog } = require('./lib/settings');
const { readStdin, writeOutput } = require('./lib/stdin');
const { formatNewEntries } = require('./lib/transcript-formatter');
const { getDb } = require('./lib/database');

function getLastCapturedUuid(sessionId) {
  const db = getDb();
  const row = db
    .prepare('SELECT last_captured_uuid FROM sessions WHERE session_id = ?')
    .get(sessionId);
  return row ? row.last_captured_uuid : null;
}

function setLastCapturedUuid(sessionId, uuid, containerTag, projectName) {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM sessions WHERE session_id = ?')
    .get(sessionId);

  if (existing) {
    db.prepare(
      `UPDATE sessions SET last_captured_uuid = ?, ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`,
    ).run(uuid, sessionId);
  } else {
    db.prepare(
      `INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid)
       VALUES (?, ?, ?, ?)`,
    ).run(sessionId, containerTag, projectName, uuid);
  }
}

async function main() {
  const settings = loadSettings();

  try {
    const input = await readStdin();
    const cwd = input.cwd || process.cwd();
    const sessionId = input.session_id;
    const transcriptPath = input.transcript_path;

    debugLog(settings, 'Stop', { sessionId, transcriptPath });

    if (!transcriptPath || !sessionId) {
      debugLog(settings, 'Missing transcript path or session id');
      writeOutput({ continue: true });
      return;
    }

    const lastCapturedUuid = getLastCapturedUuid(sessionId);
    const result = formatNewEntries(transcriptPath, lastCapturedUuid);

    if (!result) {
      debugLog(settings, 'No new content to save');
      writeOutput({ continue: true });
      return;
    }

    const client = new LocalMemoryClient();
    const containerTag = getContainerTag(cwd);
    const projectName = getProjectName(cwd);

    await client.addMemory(
      result.formatted,
      containerTag,
      {
        type: 'session_turn',
        project: projectName,
        timestamp: new Date().toISOString(),
      },
      sessionId,
    );

    setLastCapturedUuid(sessionId, result.lastUuid, containerTag, projectName);

    debugLog(settings, 'Session turn saved', { length: result.formatted.length });
    writeOutput({ continue: true });
  } catch (err) {
    debugLog(settings, 'Error', { error: err.message });
    console.error(`LocalMemory: ${err.message}`);
    writeOutput({ continue: true });
  }
}

main().catch((err) => {
  console.error(`LocalMemory fatal: ${err.message}`);
  process.exit(1);
});
