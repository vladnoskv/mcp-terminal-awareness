#!/usr/bin/env node

/**
 * MCP Inspector Test Runner
 * This script provides a convenient way to test the MCP server with Inspector v0.16.4
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting MCP Terminal Awareness Inspector...');
console.log('📋 This will open the MCP Inspector in your browser');
console.log('🔗 URL: http://localhost:6274');
console.log('');

const inspector = spawn('npx', ['@modelcontextprotocol/inspector@0.16.4', 'node', 'dist/bin/cli.js'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

inspector.on('exit', (code) => {
  console.log(`Inspector exited with code ${code}`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping inspector...');
  inspector.kill('SIGINT');
});

process.on('SIGTERM', () => {
  inspector.kill('SIGTERM');
});