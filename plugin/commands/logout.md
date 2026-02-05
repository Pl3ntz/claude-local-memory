---
description: Clear all local memories for the current project
allowed-tools: ["Bash"]
---

# Clear Local Memory

Remove all stored memories, profile facts, and session data for the current project from the local SQLite database.

## Steps

1. Use Bash to clear memories for this project:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "--clear-project"
   ```

2. Confirm to the user:
   ```
   Successfully cleared local memory for this project.

   All memories, profile facts, and session data have been removed.
   New memories will be saved as you continue working.
   ```
