# MCP Terminal Awareness Server

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://github.com/vladnoskv/mcp-terminal-awareness/actions/workflows/tests.yml/badge.svg)](https://github.com/vladnoskv/mcp-terminal-awareness/actions)
[![codecov](https://codecov.io/gh/vladnoskv/mcp-terminal-awareness/graph/badge.svg?token=YOUR-TOKEN-HERE)](https://codecov.io/gh/vladnoskv/mcp-terminal-awareness)

An MCP (Model Control Protocol) server that enhances terminal command execution with intelligent awareness of command completion, waiting states, and process status. It provides real-time progress updates and handles long-running processes gracefully.

## Features

- **Intelligent Command Execution**: Run commands with awareness of completion states
- **Real-time Progress**: Get updates on command execution status
- **Multiple Shell Support**: Works with various shells (Bash, PowerShell, CMD, etc.)
- **Session Management**: Track and manage multiple terminal sessions
- **TypeScript Support**: Fully typed API for better development experience
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### Prerequisites
- Node.js 18.19.0 or later
- npm or yarn package manager

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/vladnoskv/mcp-terminal-awareness.git
   cd mcp-terminal-awareness
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Starting the Server

```bash
# Development mode with source maps
npm run dev

# Production mode
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## API

The server provides the following JSON-RPC methods:

### `terminal.run`
Execute a command in the terminal.

**Parameters:**
```typescript
{
  command: string;      // Command to execute
  cwd?: string;         // Working directory (default: process.cwd())
  timeoutMs?: number;   // Command timeout in ms (default: 30000)
}
```

**Response:**
```typescript
{
  sessionId: string;    // Unique session ID
  status: string;       // 'running', 'completed', or 'error'
  output: string;       // Command output
  exitCode?: number;    // Process exit code (if completed)
}
```

### `terminal.list`
List all active terminal sessions.

**Response:**
```typescript
Array<{
  id: string;           // Session ID
  status: string;       // Current status
  command: string;      // Original command
  startedAt: string;    // ISO timestamp
  lastActivity: string; // ISO timestamp of last activity
}>
```

### `terminal.write`
Write to a terminal session's stdin.

**Parameters:**
```typescript
{
  sessionId: string;    // Target session ID
  data: string;         // Data to write
}
```

## Development

### Project Structure

- `src/` - Source code
  - `adapters/` - Terminal adapters for different platforms
  - `bin/` - CLI entry point
  - `mcp/` - MCP protocol implementation
  - `heuristics/` - Command completion detection logic
- `__tests__/` - Test files
- `dist/` - Compiled output (generated)

### Building

```bash
# Build the project
npm run build

# Watch for changes and rebuild
npm run build:watch
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests.

## Acknowledgments

- [node-pty](https://github.com/microsoft/node-pty) - Node.js bindings for pseudoterminal handling
- [ws](https://github.com/websockets/ws) - WebSocket client and server implementation
- [zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation
