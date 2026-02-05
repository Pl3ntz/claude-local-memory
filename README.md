# Claude Local Memory

A Claude Code plugin that gives your AI persistent memory across sessions using **local SQLite + FTS5**.
Zero network calls. All data stays on your machine in `~/.local-memory/`.

## Features

- **Context Injection**: On session start, relevant memories are automatically injected into Claude's context
- **Automatic Capture**: Conversation turns are captured and stored for future context
- **Full-Text Search**: FTS5-powered search with BM25 ranking
- **Codebase Indexing**: Index your project's architecture, patterns, and conventions
- **100% Local**: No API keys, no cloud, no network calls

## Installation

```bash
# Add the plugin marketplace
/plugin marketplace add path/to/claude-local-memory

# Install the plugin
/plugin install claude-local-memory
```

No API key required. The plugin creates `~/.local-memory/memory.db` automatically on first use.

## How It Works

### On Session Start

The plugin searches local memories and injects relevant context:

```
<supermemory-context>
The following is recalled context about the user...

## User Profile (Persistent)
- Prefers TypeScript over JavaScript
- Uses Bun as package manager

## Recent Context
- Working on authentication flow

</supermemory-context>
```

### During Session

Conversation turns are automatically captured on session stop and stored locally for future context.

### Skills

**super-search**: When you ask about past work, previous sessions, or want to recall information, the agent automatically searches your local memories.

## Commands

### /claude-local-memory:index

Index your codebase into local memory. Explores project structure, architecture, conventions, and key files.

```
/claude-local-memory:index
```

### /claude-local-memory:clear-memory

Clear all memories for the current project.

```
/claude-local-memory:clear-memory
```

## Configuration

### Environment Variables

```bash
# Optional
LOCAL_MEMORY_DIR=~/.local-memory          # Data directory (default: ~/.local-memory)
LOCAL_MEMORY_SKIP_TOOLS=Read,Glob,Grep    # Tools to not capture
LOCAL_MEMORY_DEBUG=true                   # Enable debug logging
```

### Settings File

Create `~/.local-memory/settings.json`:

```json
{
  "skipTools": ["Read", "Glob", "Grep", "TodoWrite"],
  "captureTools": ["Edit", "Write", "Bash", "Task"],
  "maxProfileItems": 5,
  "debug": false
}
```

## Architecture

- **Storage**: SQLite with WAL mode via `better-sqlite3`
- **Search**: FTS5 with Porter stemmer and Unicode61 tokenizer
- **Ranking**: BM25 similarity scoring (normalized 0-1)
- **Permissions**: Directory `0700`, database file `0600`
- **Data**: `~/.local-memory/memory.db` (single file + WAL)

## Development

```bash
npm install
npm run build       # Bundle hooks with esbuild
npm test            # Run vitest
npm run test:coverage  # Run with coverage (80%+ required)
```

## License

MIT
