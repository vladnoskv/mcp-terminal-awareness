/**
 * Index Manager - Handles indexing and searching of terminal memory
 * Provides fast lookups and complex queries for command history
 */

import * as fs from 'fs';
import * as path from 'path';
import { TerminalMemory, MemoryIndex, MemoryQuery } from './types.js';

export class IndexManager {
  private memoryDir: string;
  private indexFile: string;
  private index: MemoryIndex;
  private memoryFile: string;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
    this.indexFile = path.join(memoryDir, 'index.json');
    this.memoryFile = path.join(memoryDir, 'commands.jsonl');
    this.index = this.loadIndex();
  }

  private loadIndex(): MemoryIndex {
    if (fs.existsSync(this.indexFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      } catch (error) {
        console.warn('Failed to load index, rebuilding...');
      }
    }
    return this.createEmptyIndex();
  }

  private createEmptyIndex(): MemoryIndex {
    return {
      commandIndex: {},
      exitCodeIndex: {},
      durationIndex: {},
      directoryIndex: {},
      tagIndex: {},
      errorIndex: {}
    };
  }

  async addToIndex(memory: TerminalMemory): Promise<void> {
    // Add to command index
    const baseCommand = memory.command.split(' ')[0];
    if (!this.index.commandIndex[baseCommand]) {
      this.index.commandIndex[baseCommand] = [];
    }
    this.index.commandIndex[baseCommand].push(memory.id);

    // Add to exit code index
    if (!this.index.exitCodeIndex[memory.exitCode]) {
      this.index.exitCodeIndex[memory.exitCode] = [];
    }
    this.index.exitCodeIndex[memory.exitCode].push(memory.id);

    // Add to duration index (bucket by 5-second intervals)
    const durationBucket = Math.floor(memory.duration / 5000) * 5;
    const durationKey = `${durationBucket}s`;
    if (!this.index.durationIndex[durationKey]) {
      this.index.durationIndex[durationKey] = [];
    }
    this.index.durationIndex[durationKey].push(memory.id);

    // Add to directory index
    const dir = memory.workingDirectory;
    if (!this.index.directoryIndex[dir]) {
      this.index.directoryIndex[dir] = [];
    }
    this.index.directoryIndex[dir].push(memory.id);

    // Add to tag index
    memory.tags.forEach(tag => {
      if (!this.index.tagIndex[tag]) {
        this.index.tagIndex[tag] = [];
      }
      this.index.tagIndex[tag].push(memory.id);
    });

    // Add to error index for non-zero exit codes
    if (memory.exitCode !== 0) {
      const errorType = this.categorizeError(memory.stderr, memory.exitCode);
      if (!this.index.errorIndex[errorType]) {
        this.index.errorIndex[errorType] = [];
      }
      this.index.errorIndex[errorType].push(memory.id);
    }

    this.saveIndex();
  }

  async search(query: MemoryQuery): Promise<TerminalMemory[]> {
    let results: string[] = [];
    let firstQuery = true;

    // Search by command
    if (query.command) {
      const commandResults = this.searchCommand(query.command);
      results = firstQuery ? commandResults : this.intersect(results, commandResults);
      firstQuery = false;
    }

    // Search by exit code
    if (query.exitCode !== undefined) {
      const exitCodeResults = this.index.exitCodeIndex[query.exitCode] || [];
      results = firstQuery ? exitCodeResults : this.intersect(results, exitCodeResults);
      firstQuery = false;
    }

    // Search by working directory
    if (query.workingDirectory) {
      const dirResults = this.index.directoryIndex[query.workingDirectory] || [];
      results = firstQuery ? dirResults : this.intersect(results, dirResults);
      firstQuery = false;
    }

    // Search by tags
    if (query.tags && query.tags.length > 0) {
      const tagResults = this.searchByTags(query.tags);
      results = firstQuery ? tagResults : this.intersect(results, tagResults);
      firstQuery = false;
    }

    // Search by duration range
    if (query.durationRange) {
      const durationResults = this.searchByDuration(query.durationRange.min, query.durationRange.max);
      results = firstQuery ? durationResults : this.intersect(results, durationResults);
      firstQuery = false;
    }

    // Load full memory objects
    const memories = await this.loadMemories(results);

    // Filter by timestamp range
    let filtered = memories;
    if (query.fromTimestamp) {
      const fromDate = new Date(query.fromTimestamp);
      filtered = filtered.filter(m => new Date(m.timestamp) >= fromDate);
    }
    if (query.toTimestamp) {
      const toDate = new Date(query.toTimestamp);
      filtered = filtered.filter(m => new Date(m.timestamp) <= toDate);
    }

    // Apply limit and offset
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    return filtered.slice(offset, offset + limit);
  }

  async getRecent(limit: number = 10): Promise<TerminalMemory[]> {
    const allMemories = await this.loadAllMemories();
    return allMemories
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getStats(): Promise<{
    totalCommands: number;
    successRate: number;
    averageDuration: number;
    mostCommonCommands: Array<{ command: string; count: number }>;
    errorPatterns: Array<{ pattern: string; count: number }>;
  }> {
    const allMemories = await this.loadAllMemories();
    
    const totalCommands = allMemories.length;
    const successfulCommands = allMemories.filter(m => m.exitCode === 0).length;
    const successRate = totalCommands > 0 ? successfulCommands / totalCommands : 0;
    const averageDuration = totalCommands > 0 
      ? allMemories.reduce((sum, m) => sum + m.duration, 0) / totalCommands 
      : 0;

    // Most common commands
    const commandCounts: Record<string, number> = {};
    allMemories.forEach(m => {
      const baseCommand = m.command.split(' ')[0];
      commandCounts[baseCommand] = (commandCounts[baseCommand] || 0) + 1;
    });

    const mostCommonCommands = Object.entries(commandCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([command, count]) => ({ command, count }));

    // Error patterns
    const errorPatterns: Record<string, number> = {};
    allMemories
      .filter(m => m.exitCode !== 0)
      .forEach(m => {
        const pattern = this.categorizeError(m.stderr, m.exitCode);
        errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
      });

    const sortedErrorPatterns = Object.entries(errorPatterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));

    return {
      totalCommands,
      successRate,
      averageDuration,
      mostCommonCommands,
      errorPatterns: sortedErrorPatterns
    };
  }

  async findSimilar(command: string, limit: number): Promise<TerminalMemory[]> {
    const allMemories = await this.loadAllMemories();
    const searchCommand = command.toLowerCase();
    
    const scored = allMemories.map(memory => {
      const memoryCommand = memory.command.toLowerCase();
      let score = 0;
      
      // Exact match bonus
      if (memoryCommand === searchCommand) score += 100;
      
      // Starts with bonus
      if (memoryCommand.startsWith(searchCommand)) score += 50;
      
      // Contains bonus
      if (memoryCommand.includes(searchCommand)) score += 20;
      
      // Command similarity
      const memoryBase = memoryCommand.split(' ')[0];
      const searchBase = searchCommand.split(' ')[0];
      if (memoryBase === searchBase) score += 30;
      
      return { memory, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  async getErrorPatterns(): Promise<Array<{ pattern: string; frequency: number; examples: TerminalMemory[] }>> {
    const allMemories = await this.loadAllMemories();
    const errorMemories = allMemories.filter(m => m.exitCode !== 0);
    
    const patterns: Record<string, { frequency: number; memories: TerminalMemory[] }> = {};
    
    errorMemories.forEach(memory => {
      const pattern = this.categorizeError(memory.stderr, memory.exitCode);
      if (!patterns[pattern]) {
        patterns[pattern] = { frequency: 0, memories: [] };
      }
      patterns[pattern].frequency++;
      patterns[pattern].memories.push(memory);
    });

    return Object.entries(patterns)
      .sort(([,a], [,b]) => b.frequency - a.frequency)
      .slice(0, 10)
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.frequency,
        examples: data.memories.slice(0, 3)
      }));
  }

  async cleanupOldEntries(cutoffDate: Date): Promise<void> {
    const allMemories = await this.loadAllMemories();
    const cutoffTime = cutoffDate.getTime();
    
    const validMemories = allMemories.filter(m => 
      new Date(m.timestamp).getTime() >= cutoffTime
    );
    
    // Rewrite memory file with valid entries
    const lines = validMemories.map(m => JSON.stringify(m)).join('\n');
    fs.writeFileSync(this.memoryFile, lines + (lines ? '\n' : ''));
    
    // Rebuild index
    await this.rebuild();
  }

  async rebuild(): Promise<void> {
    this.index = this.createEmptyIndex();
    const memories = await this.loadAllMemories();
    
    for (const memory of memories) {
      await this.addToIndex(memory);
    }
  }

  private searchCommand(command: string): string[] {
    const baseCommand = command.split(' ')[0];
    return this.index.commandIndex[baseCommand] || [];
  }

  private searchByTags(tags: string[]): string[] {
    let results: string[] = [];
    let firstQuery = true;
    
    tags.forEach(tag => {
      const tagResults = this.index.tagIndex[tag] || [];
      results = firstQuery ? tagResults : this.intersect(results, tagResults);
      firstQuery = false;
    });
    
    return results;
  }

  private searchByDuration(min: number, max: number): string[] {
    const results: string[] = [];
    const minBucket = Math.floor(min / 5000) * 5;
    const maxBucket = Math.floor(max / 5000) * 5;
    
    for (let bucket = minBucket; bucket <= maxBucket; bucket += 5) {
      const key = `${bucket}s`;
      const bucketResults = this.index.durationIndex[key] || [];
      results.push(...bucketResults);
    }
    
    return [...new Set(results)];
  }

  private categorizeError(stderr: string, exitCode: number): string {
    const errorText = stderr.toLowerCase();
    
    if (errorText.includes('permission denied') || errorText.includes('eacces')) {
      return 'permission_denied';
    }
    if (errorText.includes('command not found') || errorText.includes('enoent')) {
      return 'command_not_found';
    }
    if (errorText.includes('network') || errorText.includes('connection')) {
      return 'network_error';
    }
    if (errorText.includes('timeout')) {
      return 'timeout';
    }
    if (errorText.includes('out of memory') || errorText.includes('enomem')) {
      return 'out_of_memory';
    }
    
    return `exit_code_${exitCode}`;
  }

  private intersect(arr1: string[], arr2: string[]): string[] {
    const set2 = new Set(arr2);
    return arr1.filter(id => set2.has(id));
  }

  private async loadMemories(ids: string[]): Promise<TerminalMemory[]> {
    if (!fs.existsSync(this.memoryFile)) return [];
    
    const content = fs.readFileSync(this.memoryFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const memories: TerminalMemory[] = [];
    const idSet = new Set(ids);
    
    for (const line of lines) {
      try {
        const memory: TerminalMemory = JSON.parse(line);
        if (idSet.size === 0 || idSet.has(memory.id)) {
          memories.push(memory);
        }
      } catch (error) {
        console.warn('Failed to parse memory line:', error);
      }
    }
    
    return memories;
  }

  private async loadAllMemories(): Promise<TerminalMemory[]> {
    return this.loadMemories([]);
  }

  private saveIndex(): void {
    fs.writeFileSync(this.indexFile, JSON.stringify(this.index, null, 2));
  }
}