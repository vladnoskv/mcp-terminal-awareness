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
   npm install
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

### Testing with MCP Inspector

The package includes comprehensive testing support with MCP Inspector v0.16.4:

```bash
# Quick test with inspector (recommended)
npm run inspector:quick

# Build and test with inspector
npm run inspector:build

# Manual inspector testing
npx @modelcontextprotocol/inspector@0.16.4 node dist/bin/cli.js
```

Once the inspector opens in your browser (http://localhost:6274), you can:
- Test the `run_command` tool with various commands
- Monitor real-time command execution
- Test different shell environments
- Debug connection issues

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

The project includes comprehensive testing capabilities:

#### Automated Testing
```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Coverage reports
npm run test:coverage
```

#### MCP Inspector Testing
```bash
# Quick inspector testing (recommended)
npm run inspector:quick

# Build and test with inspector
npm run inspector:build

# Manual inspector testing
npm run inspector
```

#### Linting & Formatting
```bash
# Check code quality
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Available Scripts
- `npm run build` - Build the TypeScript project
- `npm run dev` - Build and watch for changes
- `npm test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:coverage` - Run tests with coverage
- `npm run inspector` - Start MCP Inspector v0.16.4
- `npm run inspector:quick` - Quick inspector testing
- `npm run inspector:build` - Build and test with inspector
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier

### Running a Specific Test File
```bash
npx jest path/to/test/file.test.ts
```

### Code Style

This project uses:
- TypeScript strict mode
- ESLint with TypeScript support
- Prettier for code formatting

## Current Status & Improvements

### ✅ **Working Features**
- **MCP Inspector Integration**: Full testing support with v0.16.4
- **Command Execution**: `run_command` tool with intelligent completion detection
- **Cross-Platform Support**: Windows, macOS, and Linux compatibility
- **Multiple Shell Support**: Bash, PowerShell, CMD, and custom shells
- **Real-time Monitoring**: Progress tracking and status updates
- **Session Management**: Multiple concurrent terminal sessions
- **Comprehensive Testing**: Unit, integration, and MCP Inspector testing

### 🔧 **Testing & Development**
- **MCP Inspector v0.16.4**: Fully integrated with custom scripts
- **Automated Testing**: Jest unit tests and integration tests
- **Code Quality**: ESLint + Prettier configuration
- **Build Pipeline**: TypeScript compilation and bundling

### 📋 **Areas for Improvement**

#### **Enhanced Documentation**
- Add more detailed usage examples for complex scenarios
- Create video tutorials for MCP Inspector usage
- Document advanced configuration patterns

#### **Feature Enhancements**
- **Interactive Shell Support**: Add support for interactive REPL environments
- **Command History**: Persistent command history across sessions
- **Output Streaming**: Real-time streaming of command output
- **Error Handling**: More granular error types and recovery strategies
- **Performance Monitoring**: Resource usage tracking for long-running commands

#### **Testing Improvements**
- **Cross-Platform CI/CD**: GitHub Actions for Windows, macOS, and Linux
- **Performance Benchmarks**: Command execution timing and resource usage
- **Security Testing**: Input validation and command injection prevention
- **Integration Tests**: More comprehensive MCP client integration tests

#### **Developer Experience**
- **Configuration Templates**: Pre-configured setups for common use cases
- **Debugging Tools**: Enhanced logging and debugging capabilities
- **Plugin Architecture**: Extensible system for custom command handlers

### 🚀 **Getting Started with Improvements**

To contribute to any of these improvements:

1. **Fork the repository**
2. **Run the test suite**: `npm run inspector:quick` to understand current functionality
3. **Check existing tests**: Review `src/**/*.test.ts` files
4. **Follow the development guide**: Use `npm run dev` for live development

## Troubleshooting

### Common Issues

#### **"Disconnected" Status in MCP Inspector**
The MCP Inspector v0.16.4 doesn't display an explicit "Connected" message. Instead, look for:
- **Server Status**: Check the terminal for "New STDIO connection request" messages
- **Available Tools**: The `run_command` tool should appear in the inspector interface
- **Request/Response Logs**: Monitor the terminal for active communication

#### **Port 6277 Already in Use**
If you encounter port conflicts:
```bash
# Find process using port 6277 (Windows)
netstat -ano | findstr :6277
tasklist /FI "PID eq [PID_NUMBER]"

# Kill the process (Windows)
taskkill /PID [PID_NUMBER] /F

# Alternative: Use different port
npx @modelcontextprotocol/inspector@0.16.4 --port 6278 node dist/bin/cli.js
```

#### **Build Issues**
```bash
# Clean build
npm run build
npm run typecheck

# Verify dependencies
npm install
npm audit fix
```

#### **Testing Issues**
```bash
# Quick test without inspector
node dist/bin/cli.js

# Test with simple command
echo "Hello, World!"
```

### Getting Help
- **Check Issues**: Review GitHub issues for known problems
- **Debug Mode**: Set `LOG_LEVEL=debug` for detailed logging
- **Community**: Join MCP community discussions for support

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests.

## Acknowledgments

- [node-pty](https://github.com/microsoft/node-pty) - Node.js bindings for pseudoterminal handling
- [ws](https://github.com/websockets/ws) - WebSocket client and server implementation
- [zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation

---

*This project is maintained by [Your Name]. Report issues [here](https://github.com/your-username/mcp-terminal-awareness/issues).*

## Install

From the project root:

```bash
# dev deps only; zero runtime deps by default
npm i -D typescript @types/node

# optional: PTY support (recommended for full terminal fidelity)
# install only if you plan to use USE_PTY=1
npm i node-pty

# build TypeScript -> dist/
npm run build
```

## Run

```bash
node dist/bin/cli.js
# or with PTY
USE_PTY=1 node dist/bin/cli.js
```

Windows PowerShell environment example:

```powershell
$env:USE_PTY = "1"
node dist/bin/cli.js
# to disable
$env:USE_PTY = "0"
```

## Tools exposed

- `terminal.run` — run a command with awareness; emits progress, returns final content and status
- `terminal.status` — get status of a session, last activity time, exit info, and tail output
- `terminal.write` — write keystrokes to a live session (include `"\n"` to send Enter)
- `terminal.signal` — send `SIGINT`/`SIGTERM` or emulate `CTRL_C`
- `terminal.list` — list active sessions
- `terminal.attach` — re-attach; returns current buffered output

### terminal.run

Input:

```jsonc
{
  "name": "terminal.run",
  "arguments": {
    "command": "npm -v",             // required
    "cwd": "e:/project",             // optional
    "shell": "powershell|bash",       // optional
    "timeoutMs": 60000,               // optional: kill if exceeded
    "env": { "FOO": "bar" },        // optional: extra env vars
    "quietMs": 300,                   // optional: settle window after exit/prompt
    "waitingMs": 10000,               // optional: idle -> waiting threshold
    "stuckMs": 45000,                 // optional: idle -> possibly-stuck threshold
    "maxBufferBytes": 2000000         // optional: rolling buffer cap
  }
}
```

Result content (simplified):

```jsonc
[
  { "type": "text", "text": "<combined stdout/stderr>" },
  {
    "type": "json",
    "json": {
      "sessionId": "...",
      "status": "completed|error|waiting|...",
      "timedOut": false,
      "exitCode": 0,
      "exitSignal": null,
      "errorReason": null
    }
  }
]
```

Progress notifications are sent as JSON-RPC notifications with method `notifications/progress`.

### terminal.status

Input: `{ sessionId: string, tail?: number }`

Result content: JSON with `status`, `lastOutputAt`, `exitCode`, `exitSignal`, `errorReason` and a `text` tail.

### terminal.write

Input: `{ sessionId: string, data: string }` — writes raw data to the process. Include `"\n"` to send Enter.

### terminal.signal

Input: `{ sessionId: string, signal?: "SIGINT" | "SIGTERM" | "CTRL_C" }`

### terminal.list

No input. Returns an array of `{ id, status, lastOutputAt, exitCode, exitSignal, errorReason }`.

### terminal.attach

Input: `{ sessionId: string }`. Returns the current buffered output.

## Heuristics

- Prompt re-appearance (detected or calibrated)
- Process exit + quiet window (default 300 ms; configurable via `quietMs`)
- Known finish phrases (npm/pnpm/yarn/git/pip/pytest/etc.)
- Spinner/ANSI suppression
- Idle timers → `waiting` / `possibly-stuck` (configurable via `waitingMs`/`stuckMs`)

## Client config

Place this in your MCP client config (example):

```jsonc
{
  "mcpServers": {
    "mcp-terminal-awareness": {
      "command": "node",
      "args": ["dist/bin/cli.js"],
      "env": { "USE_PTY": "0" }
    }
  }
}
```

## Security

Run in trusted workspaces.

Recommendations:

- Allowlist commands or working directories in your client integration.
- Set only the environment variables the command requires (`env` input).
- Use `timeoutMs` to avoid runaway commands.

## Quick smoke test

Verify the server responds to `initialize` over stdio:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node dist/bin/cli.js
```

You should see a JSON result with `server.name` set to `mcp-terminal-awareness`.

PowerShell tip (quote escaping):

```powershell
"{`"jsonrpc`":`"2.0`",`"id`":1,`"method`":`"initialize`",`"params`":{}}" | node dist/bin/cli.js
```

## Troubleshooting

- Build error mentioning `node-pty`: install it only if you enable PTY (`USE_PTY=1`). Otherwise it is optional.
- Windows shells differ; when using `terminal.write`, include `"\n"` to send Enter.
- If output is very large, increase `maxBufferBytes` or read with `terminal.status { tail }`.
