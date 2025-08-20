# Memory System Features

The MCP Terminal Awareness server now includes a comprehensive memory and journaling system that provides intelligent command history, pattern analysis, and predictive insights.

## 🧠 Memory System Overview

The memory system automatically records every command execution with rich metadata including:
- Command and exit code
- Execution duration and timestamp
- Working directory and shell used
- Output (stdout/stderr)
- Tags and categorization

## 🛠️ New MCP Tools

### Memory & History Tools

#### `terminal.search_history`
Search through command history with various filters.

**Parameters:**
- `command` (string, optional): Command or prefix to search for
- `exitCode` (number, optional): Filter by exit code
- `workingDirectory` (string, optional): Filter by working directory
- `tags` (array, optional): Filter by tags (success, error, long-running, etc.)
- `fromTimestamp` (string, optional): Start date (ISO format)
- `toTimestamp` (string, optional): End date (ISO format)
- `limit` (number, optional): Maximum results (default: 10)

**Example:**
```json
{
  "command": "npm",
  "exitCode": 0,
  "limit": 5
}
```

#### `terminal.command_stats`
Get statistical analysis of command usage and performance.

**Parameters:**
- `command` (string, optional): Get stats for specific command

**Returns:** Success rate, average duration, error breakdown

#### `terminal.find_similar`
Find commands similar to the given command.

**Parameters:**
- `command` (string, required): Command to find similar ones for
- `limit` (number, optional): Maximum similar commands (default: 5)

#### `terminal.suggest`
Get intelligent suggestions before executing a command.

**Parameters:**
- `command` (string, required): Command to get suggestions for
- `workingDirectory` (string, optional): Current directory for context

#### `terminal.error_patterns`
Get common error patterns and their solutions.

**Parameters:**
- `limit` (number, optional): Maximum patterns to return (default: 10)

#### `terminal.memory_health`
Check the health and status of the memory system.

#### `terminal.rebuild_index`
Rebuild memory indexes for optimal performance.

#### `terminal.predict`
Get predictive insights based on command history.

## 📁 File Structure

```
memory/
├── data/                    # Memory storage (JSONL files)
├── config.json             # Memory system configuration
└── logs/                   # System logs

src/memory/
├── commandHistory.ts       # Core memory management
├── indexManager.ts        # Indexing and search
├── recallEngine.ts        # Intelligent analysis
├── memoryTools.ts         # MCP tool definitions
└── types.ts              # TypeScript interfaces
```

## 🚀 Usage Examples

### Basic Usage

1. **Initialize the memory system:**
   ```bash
   npm run memory:init
   ```

2. **Start the server:**
   ```bash
   npm run dev
   ```

3. **Use with MCP Inspector:**
   ```bash
   npm run inspector:build
   ```

### Command Examples

**Search for successful npm commands:**
```json
{
  "tool": "terminal.search_history",
  "arguments": {
    "command": "npm",
    "exitCode": 0,
    "limit": 10
  }
}
```

**Get suggestions for a new command:**
```json
{
  "tool": "terminal.suggest",
  "arguments": {
    "command": "npm run build",
    "workingDirectory": "/home/user/project"
  }
}
```

**Check memory health:**
```json
{
  "tool": "terminal.memory_health",
  "arguments": {}
}
```

## 📊 Available Scripts

- `npm run memory:init` - Initialize memory directories and test system
- `npm run memory:stats` - Show memory system statistics
- `npm run memory:rebuild` - Rebuild memory indexes
- `npm run memory:test` - Run memory system tests

## 🔧 Configuration

The memory system is configured via `memory/config.json`:

```json
{
  "memory": {
    "maxEntries": 10000,
    "cleanupThreshold": 0.8,
    "compressionEnabled": true
  },
  "security": {
    "safeRoot": ".",
    "maxFileSize": 10485760
  },
  "features": {
    "autoJournaling": true,
    "patternRecognition": true,
    "predictiveSuggestions": true
  }
}
```

## 🔍 Data Storage

- **Format**: JSONL (JSON Lines)
- **Location**: `memory/data/commands.jsonl`
- **Indexing**: Automatic indexing for fast search
- **Retention**: Configurable cleanup of old entries

## 🎯 Key Benefits

1. **Intelligent Command History**: Never lose track of successful commands
2. **Error Pattern Recognition**: Learn from past mistakes
3. **Performance Insights**: Understand command execution patterns
4. **Predictive Suggestions**: Get smart recommendations
5. **Context Awareness**: Commands are stored with directory context
6. **Rich Metadata**: Track performance, errors, and usage patterns

## 🔐 Security

- Commands are stored locally only
- No external data transmission
- Configurable safe directories
- Automatic sanitization of sensitive data

## 📈 Performance

- Efficient indexing for fast searches
- Automatic cleanup of old entries
- Memory usage monitoring
- Configurable performance thresholds