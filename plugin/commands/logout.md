---
description: Clear all local memories for the current project
allowed-tools: ["Bash"]
---

# Clear Local Memory

Remove all stored memories for the current project from the local SQLite database.

## Steps

1. Use Bash to clear memories:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/search-memory.cjs" "--clear-project"
   ```

   If the above doesn't work, remove the database file directly:
   ```bash
   rm -f ~/.local-memory/memory.db
   ```

2. Confirm to the user:
   ```
   Successfully cleared local memory for this project.

   All memories have been removed from the local database.
   New memories will be saved as you continue working.
   ```
