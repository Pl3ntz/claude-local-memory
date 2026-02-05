const { LocalMemoryClient } = require('./lib/local-memory-client');
const { getContainerTag, getProjectName } = require('./lib/container-tag');
const { getDb } = require('./lib/database');

async function clearProject(containerTag, projectName) {
  const db = getDb();
  const deleted = db
    .prepare('DELETE FROM memories WHERE container_tag = ?')
    .run(containerTag);
  db.prepare('DELETE FROM profile_facts WHERE container_tag = ?').run(
    containerTag,
  );
  db.prepare('DELETE FROM sessions WHERE container_tag = ?').run(containerTag);

  console.log(`Cleared ${deleted.changes} memories for project: ${projectName}`);
  console.log('New memories will be saved as you continue working.');
}

async function main() {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  const containerTag = getContainerTag(cwd);
  const projectName = getProjectName(cwd);

  if (args[0] === '--clear-project') {
    return clearProject(containerTag, projectName);
  }

  const content = args.join(' ');

  if (!content || !content.trim()) {
    console.log(
      'No content provided. Usage: node add-memory.cjs "content to save"',
    );
    return;
  }

  try {
    const client = new LocalMemoryClient(containerTag);
    const result = await client.addMemory(content, containerTag, {
      type: 'manual',
      project: projectName,
      timestamp: new Date().toISOString(),
    });

    console.log(`Memory saved to project: ${projectName}`);
    console.log(`ID: ${result.id}`);
  } catch (err) {
    console.error(`Error saving memory: ${err.message}`);
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
