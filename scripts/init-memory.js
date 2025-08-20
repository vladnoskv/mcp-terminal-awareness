#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join } from 'path';
import { CommandHistory } from '../dist/memory/commandHistory.js';

async function initMemorySystem() {
  console.log('Initializing memory system...');
  
  const memoryDir = './memory';
  const dataDir = './memory/data';
  
  try {
    // Create directories if they don't exist
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.mkdir(dataDir, { recursive: true });
    
    // Initialize command history
    const history = new CommandHistory();
    
    // Test the system with a sample command
    console.log('Testing memory system...');
    const testId = await history.recordCommand(
      'echo "Hello, Memory System!"',
      0,
      50,
      'Hello, Memory System!',
      '',
      process.cwd(),
      process.platform === 'win32' ? 'cmd' : 'bash'
    );
    
    console.log(`✅ Memory system initialized successfully!`);
    console.log(`📊 Test command recorded with ID: ${testId}`);
    
    // Show initial stats
    const stats = await history.getMemoryStats();
    console.log(`📈 Total commands in memory: ${stats.totalCommands}`);
    
  } catch (error) {
    console.error('❌ Failed to initialize memory system:', error);
    process.exit(1);
  }
}

initMemorySystem();