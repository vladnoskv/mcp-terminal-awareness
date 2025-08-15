# MCP Terminal Awareness Server

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An MCP (Model Control Protocol) server that enhances terminal command execution with intelligent awareness of command completion, waiting states, and process status. It provides real-time progress updates and handles long-running processes gracefully.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Features

- **Intelligent Command Execution**: Run commands with awareness of completion states
- **Real-time Progress**: Get updates on command execution status
- **Multiple Shell Support**: Works with various shells (Bash, PowerShell, CMD, etc.)
- **PTY Integration**: Optional PTY support for full terminal emulation
- **Session Management**: Track and manage multiple terminal sessions
- **TypeScript Support**: Fully typed API for better development experience
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### Prerequisites
- Node.js 18.19.0 or later
- npm or yarn package manager
- (Optional) `node-pty` for PTY support

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/vladnoskv/mcp-terminal-awareness.git
   cd mcp-terminal-awareness
   ```

2. Install dependencies:
   ```bash
   # Install dev dependencies (TypeScript, type definitions)
   npm install --save-dev typescript @types/node

   # Optional: Install node-pty for PTY support (recommended for better terminal emulation)
   npm install node-pty
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Quick Start

### Running the Server

```bash
# Basic usage
node dist/bin/cli.js

# With PTY support (recommended for better terminal emulation)
USE_PTY=1 node dist/bin/cli.js
```

### Windows PowerShell

```powershell
# Set environment variable for PTY support
$env:USE_PTY = "1"

# Run the server
node dist/bin/cli.js
```

### Basic Client Example

```javascript
// Example of using the MCP client to run a command
const { MCPServer } = require('@mcp/client');

async function runCommand() {
  const mcp = new MCPServer({
    command: 'node',
    args: ['dist/bin/cli.js'],
    env: { USE_PTY: '1' }
  });

  await mcp.initialize();

  const result = await mcp.execute({
    name: 'terminal.run',
    arguments: {
      command: 'echo "Hello, MCP!"',
      cwd: process.cwd()
    }
  });

  console.log('Command output:', result.content);
  
  await mcp.shutdown();
}

runCommand().catch(console.error);
```

## Configuration

The server can be configured using environment variables and command-line arguments.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_PTY` | Enable PTY support (1 or 0) | `0` |
| `DEFAULT_SHELL` | Default shell to use | Platform-dependent |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` |
| `MAX_SESSIONS` | Maximum number of concurrent sessions | `50` |
| `SESSION_TIMEOUT_MS` | Session timeout in milliseconds | `3600000` (1 hour) |

### Command-line Arguments

```bash
node dist/bin/cli.js [options]

Options:
  --port, -p      Port to listen on (for HTTP mode)  [number]
  --host          Host to bind to (for HTTP mode)  [string] [default: "localhost"]
  --no-stdio      Disable stdio mode                [boolean] [default: false]
  --version       Show version number               [boolean]
  --help          Show help                         [boolean]
```

## API Reference

### Tools

The server exposes the following tools:

#### `terminal.run`

Run a command with awareness of completion states.

**Input:**
```typescript
{
  command: string;      // Command to execute (required)
  cwd?: string;         // Working directory (default: process.cwd())
  shell?: string;       // Shell to use (default: system default)
  env?: Record<string, string>; // Environment variables
  timeoutMs?: number;   // Command timeout in ms (default: 30000)
  quietMs?: number;     // Quiet period before considering command done (default: 300)
  waitingMs?: number;   // Idle time before considering command waiting (default: 10000)
  stuckMs?: number;     // Idle time before considering command stuck (default: 45000)
  maxBufferBytes?: number; // Maximum output buffer size (default: 2MB)
}
```

**Response:**
```typescript
{
  sessionId: string;    // Unique session ID
  status: 'running' | 'completed' | 'error' | 'waiting' | 'stuck';
  output: string;       // Command output
  exitCode?: number;    // Process exit code (if completed)
  exitSignal?: string;  // Process termination signal (if any)
  errorReason?: string; // Error description (if error occurred)
}
```

#### `terminal.status`

Get the status of a terminal session.

**Input:**
```typescript
{
  sessionId: string;    // Session ID to check
  tail?: number;        // Number of lines to return from the end of the output
}
```

#### `terminal.write`

Write data to a terminal session's stdin.

**Input:**
```typescript
{
  sessionId: string;    // Target session ID
  data: string;         // Data to write (include '\n' for Enter)
}
```

#### `terminal.signal`

Send a signal to a terminal session.

**Input:**
```typescript
{
  sessionId: string;    // Target session ID
  signal?: 'SIGINT' | 'SIGTERM' | 'CTRL_C' | 'KILL'; // Signal to send (default: SIGINT)
}
```

#### `terminal.list`

List all active terminal sessions.

**Input:** `{}`

**Response:**
```typescript
Array<{
  id: string;           // Session ID
  status: string;       // Current status
  command: string;      // Original command
  startedAt: string;    // ISO timestamp
  lastActivity: string; // ISO timestamp of last activity
  pid?: number;         // Process ID (if available)
}>
```

#### `terminal.attach`

Attach to an existing terminal session to receive updates.

**Input:**
```typescript
{
  sessionId: string;    // Session ID to attach to
}
```

## Advanced Usage

### Custom Heuristics

The server includes built-in heuristics to detect command completion, waiting states, and stuck processes. You can customize this behavior:

```typescript
// Example of custom heuristics configuration
const heuristics = wireHeuristics(session, progressFn, {
  quietMs: 500,         // Increase quiet period for slow systems
  waitingMs: 5000,      // Shorter waiting period
  stuckMs: 30000,       // Shorter stuck detection
  maxBufferBytes: 5 * 1024 * 1024  // 5MB buffer
});
```

### Event Notifications

The server sends JSON-RPC notifications for various events:

- `notifications/progress`: Command execution progress updates
- `notifications/completed`: Command completed successfully
- `notifications/error`: Command failed with an error
- `notifications/waiting`: Command appears to be waiting for input
- `notifications/stuck`: Command may be stuck

## Security Considerations

1. **Command Execution**: The server can execute arbitrary shell commands with the same permissions as the user running the server.
2. **Environment Isolation**: Commands run in isolated sessions but share the same environment variables by default.
3. **Authentication**: The server does not include built-in authentication. If exposing over a network, use appropriate network-level security.

### Best Practices

- Run the server with the minimum necessary privileges
- Use environment variables for sensitive configuration
- Implement command allowlisting in your client application
- Set appropriate timeouts for all commands
- Monitor and log command execution

## Troubleshooting

### Common Issues

#### Command Not Found
```
Error: Command not found: some-command
```
**Solution**: Ensure the command is in the PATH or provide the full path.

#### PTY Initialization Failed
```
Error: Failed to initialize PTY
```
**Solution**: 
1. Ensure `node-pty` is installed if using PTY mode
2. On Windows, you may need to rebuild `node-pty` with the correct Node.js version

#### Session Timeout
```
Error: Session timeout
```
**Solution**: Increase the session timeout or implement session keep-alive in your client.

### Debugging

Set the `DEBUG` environment variable for detailed logs:

```bash
DEBUG=mcp:* node dist/bin/cli.js
```

## Development

### Building from Source

1. Clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run tests: `npm test`

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npx jest path/to/test/file.test.ts
```

### Code Style

This project uses:
- TypeScript strict mode
- ESLint with TypeScript support
- Prettier for code formatting

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests.

## Acknowledgments

- [node-pty](https://github.com/microsoft/node-pty) - Node.js bindings for pseudoterminal handling
- [ws](https://github.com/websockets/ws) - WebSocket client and server implementation
- [zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation

---

*This project is maintained by [Your Name]. Report issues [here](https://github.com/vladnoskv/mcp-terminal-awareness/issues).*
