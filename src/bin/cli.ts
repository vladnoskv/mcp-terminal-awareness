#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getServerConfig, getServerOptions } from '../config.js';
import { startServer } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main CLI entry point
 */
async function main() {
  try {
    const [serverName] = process.argv.slice(2);
    
    // If running directly (not imported as module)
    if (import.meta.url === `file://${__filename}`) {
      const options = getServerOptions();
      await startServer(options);
      return;
    }

    // Otherwise, handle as child process
    const config = getServerConfig(serverName);
    
    const child = spawn(config.command, config.args, {
      stdio: 'inherit',
      cwd: config.cwd,
      env: { 
        ...process.env, 
        ...config.env,
        NODE_ENV: 'production'
      }
    });

    // Handle process signals
    const handleSignal = (signal: NodeJS.Signals) => {
      if (!child.killed) {
        child.kill(signal);
      }
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));

    // Handle child process exit
    return new Promise<void>((resolve, reject) => {
      child.on('exit', (code, signal) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code} and signal ${signal}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error occurred');
    process.exit(1);
  }
}

// Run the CLI
if (import.meta.url === `file://${__filename}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { main };
// Handle process termination
process.on('SIGINT', () => {
  process.exit(0);
});
