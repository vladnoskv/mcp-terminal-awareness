# MCP Inspector v0.16.4 Testing Guide

This guide helps you test the MCP Terminal Awareness server with MCP Inspector v0.16.4.

## Quick Start

### Option 1: One-Command Setup
```bash
npm run inspector:build
```
This builds the project and starts the inspector automatically.

### Option 2: Manual Steps
```bash
# Build the project
npm run build

# Start inspector
npm run inspector
```

### Option 3: Quick Start Script
```bash
npm run inspector:quick
```

## Inspector Usage

1. **Open Browser**: The inspector will automatically open at `http://localhost:6274`
2. **Connect**: Click "Connect" to establish connection with your MCP server
3. **Test Tools**: Use the interface to test the available terminal tools
4. **Monitor**: Watch real-time logs and responses

## Available Tools for Testing

### run_command
Execute terminal commands with intelligent completion detection.

**Parameters:**
- `command` (string): The command to execute
- `cwd` (string, optional): Working directory (defaults to current)
- `shell` (string, optional): Shell to use
- `timeoutMs` (number, optional): Command timeout in milliseconds
- `waitingMs` (number, optional): Time to wait before considering command "waiting"
- `stuckMs` (number, optional): Time before considering command "stuck"

**Example Test Commands:**
```json
{
  "command": "echo 'Hello from MCP Terminal!'",
  "cwd": "/tmp",
  "timeoutMs": 30000
}
```

## Testing Scenarios

### 1. Basic Command Execution
Test simple commands like:
- `ls -la`
- `pwd`
- `echo "test"`

### 2. Long-Running Commands
Test timeout and stuck detection:
- `sleep 10`
- Commands that produce continuous output

### 3. Error Handling
Test error scenarios:
- Invalid commands
- Permission denied scenarios
- Network timeout commands

### 4. Environment Testing
Test with different shells and directories:
- Windows: `cmd.exe` vs `powershell.exe`
- Unix: `/bin/bash` vs `/bin/zsh`

## Troubleshooting

### Common Issues

1. **Build Errors**: Run `npm run build` to ensure fresh build
2. **Inspector Not Starting**: Check if port 6274 is available
3. **Connection Issues**: Verify the server starts correctly with `npm run dev`

### Debug Mode
```bash
# Run with debug logging
DEBUG=1 npm run inspector
```

### Manual Testing
If inspector fails, test directly:
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/bin/cli.js
```

## Development Tips

- **Watch Mode**: Use `npm run dev` for development with source maps
- **Live Reload**: Combine with `npm run build -- --watch` for auto-rebuild
- **Testing**: Run unit tests with `npm test` before using inspector

## Expected Inspector Output

When successfully connected, you should see:
- Server name: "mcp-terminal-awareness"
- Available tools list including `run_command`
- Real-time command execution and status updates
- Progress notifications for long-running commands