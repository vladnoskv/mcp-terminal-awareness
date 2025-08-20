/**
 * Terminal Command History - JSONL-based memory system
 * Based on MCP File+Memory Server template patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { TerminalMemory, MemoryKind, CommandMetadata } from './types.js';
import { IndexManager } from './indexManager.js';

export class CommandHistory {
  private memoryDir: string;
  private indexManager: IndexManager;
  private memoryFile: string;
  private configFile: string;

  constructor(memoryDir: string = '.terminal_memory') {
    this.memoryDir = memoryDir;
    this.memoryFile = path.join(memoryDir, 'commands.jsonl');
    this.configFile = path.join(memoryDir, 'config.json');
    this.indexManager = new IndexManager(memoryDir);
    this.ensureMemoryDir();
  }

  private ensureMemoryDir(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.memoryFile)) {
      fs.writeFileSync(this.memoryFile, '');
    }
    
    if (!fs.existsSync(this.configFile)) {
      this.createDefaultConfig();
    }
  }

  private createDefaultConfig(): void {
    const defaultConfig = {
      maxEntries: 10000,
      retentionDays: 30,
      enabled: true,
      performanceTracking: true,
      securityMonitoring: true,
      autoIndexing: true
    };
    
    fs.writeFileSync(this.configFile, JSON.stringify(defaultConfig, null, 2));
  }

  /**
   * Record a command execution in memory
   */
  async recordCommand(
    command: string,
    exitCode: number,
    duration: number,
    stdout: string,
    stderr: string,
    workingDirectory: string,
    shell: string,
    metadata?: CommandMetadata
  ): Promise<string> {
    const memory: TerminalMemory = {
      id: this.generateMemoryId(),
      timestamp: new Date().toISOString(),
      command: command.trim(),
      exitCode,
      duration,
      stdout: this.truncateOutput(stdout),
      stderr: this.truncateOutput(stderr),
      workingDirectory,
      shell,
      tags: this.generateTags(command, exitCode, duration),
      metadata: metadata || {}
    };

    await this.appendToMemory(memory);
    await this.indexManager.addToIndex(memory);
    
    // Clean up old entries if needed
    await this.cleanupOldEntries();
    
    return memory.id;
  }

  /**
   * Search command history
   */
  async searchCommands(query: {
    command?: string;
    exitCode?: number;
    durationRange?: { min: number; max: number };
    workingDirectory?: string;
    tags?: string[];
    fromTimestamp?: string;
    toTimestamp?: string;
    limit?: number;
  }): Promise<TerminalMemory[]> {
    return this.indexManager.search(query);
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<{
    totalCommands: number;
    successRate: number;
    averageDuration: number;
    mostCommonCommands: Array<{ command: string; count: number }>;
    errorPatterns: Array<{ pattern: string; count: number }>;
  }> {
    return this.indexManager.getStats();
  }

  /**
   * Get recent commands
   */
  async getRecentCommands(limit: number = 10): Promise<TerminalMemory[]> {
    return this.indexManager.getRecent(limit);
  }

  /**
   * Find similar commands
   */
  async findSimilarCommands(command: string, limit: number = 5): Promise<TerminalMemory[]> {
    return this.indexManager.findSimilar(command, limit);
  }

  /**
   * Get error patterns
   */
  async getErrorPatterns(): Promise<Array<{ pattern: string; frequency: number; examples: TerminalMemory[] }>> {
    return this.indexManager.getErrorPatterns();
  }

  /**
   * Rebuild all indexes
   */
  async rebuildIndexes(): Promise<void> {
    await this.indexManager.rebuild();
  }

  private generateMemoryId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTags(command: string, exitCode: number, duration: number): string[] {
    const tags: string[] = [];
    
    // Basic tags
    if (exitCode === 0) {
      tags.push('success');
    } else {
      tags.push('error');
    }
    
    if (duration > 30000) {
      tags.push('long-running');
    } else if (duration < 1000) {
      tags.push('quick');
    }
    
    // Command type tags
    const cmd = command.trim().split(' ')[0].toLowerCase();
    if (['git', 'npm', 'yarn', 'pnpm', 'pip', 'python', 'node'].includes(cmd)) {
      tags.push(cmd);
    }
    
    return tags;
  }

  private truncateOutput(output: string, maxLength: number = 10000): string {
    if (output.length <= maxLength) return output;
    return output.substring(0, maxLength) + '... [truncated]';
  }

  private async appendToMemory(memory: TerminalMemory): Promise<void> {
    const line = JSON.stringify(memory) + '\n';
    fs.appendFileSync(this.memoryFile, line);
  }

  private async cleanupOldEntries(): Promise<void> {
    try {
      const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
      if (!config.retentionDays) return;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
      
      await this.indexManager.cleanupOldEntries(cutoffDate);
    } catch (error) {
      console.warn('Failed to cleanup old memory entries:', error);
    }
  }

  /**
   * Get memory configuration
   */
  getConfig(): any {
    try {
      return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
    } catch {
      return {};
    }
  }

  /**
   * Update memory configuration
   */
  updateConfig(updates: Partial<any>): void {
    const current = this.getConfig();
    const newConfig = { ...current, ...updates };
    fs.writeFileSync(this.configFile, JSON.stringify(newConfig, null, 2));
  }
}