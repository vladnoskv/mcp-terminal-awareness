/**
 * Recall Engine - Intelligent memory retrieval and analysis
 * Provides advanced querying and pattern matching for command history
 */

import { CommandHistory } from './commandHistory.js';
import { TerminalMemory, MemoryQuery } from './types.js';

export interface RecallResult {
  memory: TerminalMemory;
  relevance: number;
  context: {
    similarCommands: string[];
    errorPatterns: string[];
    performanceInsights: string[];
  };
}

export interface Suggestion {
  type: 'command' | 'fix' | 'optimization' | 'warning';
  message: string;
  confidence: number;
  relatedMemories: string[];
}

export class RecallEngine {
  private history: CommandHistory;

  constructor(history: CommandHistory) {
    this.history = history;
  }

  /**
   * Get intelligent suggestions for a command
   */
  async suggestForCommand(command: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    const baseCommand = command.split(' ')[0];
    
    // Check for similar commands with errors
    const similarCommands = await this.history.findSimilarCommands(command, 10);
    const errorCommands = similarCommands.filter(c => c.exitCode !== 0);
    
    if (errorCommands.length > 0) {
      const errorRate = errorCommands.length / similarCommands.length;
      if (errorRate > 0.5) {
        suggestions.push({
          type: 'warning',
          message: `This command has a ${Math.round(errorRate * 100)}% failure rate in similar contexts`,
          confidence: errorRate,
          relatedMemories: errorCommands.slice(0, 3).map(c => c.id)
        });
      }
    }

    // Check for performance issues
    const slowCommands = similarCommands.filter(c => c.duration > 30000);
    if (slowCommands.length > 0) {
      const avgDuration = slowCommands.reduce((sum, c) => sum + c.duration, 0) / slowCommands.length;
      suggestions.push({
        type: 'optimization',
        message: `Similar commands take ${Math.round(avgDuration / 1000)}s on average - consider optimization`,
        confidence: 0.7,
        relatedMemories: slowCommands.slice(0, 3).map(c => c.id)
      });
    }

    // Check for common alternatives
    const successfulCommands = similarCommands.filter(c => c.exitCode === 0);
    if (successfulCommands.length > 0) {
      const uniqueCommands = [...new Set(successfulCommands.map(c => c.command))];
      if (uniqueCommands.length > 1) {
        suggestions.push({
          type: 'command',
          message: `Found ${uniqueCommands.length} successful variations of this command`,
          confidence: 0.8,
          relatedMemories: successfulCommands.slice(0, 3).map(c => c.id)
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Find patterns in command execution
   */
  async analyzePatterns(): Promise<{
    successPatterns: Array<{ pattern: string; frequency: number; examples: TerminalMemory[] }>;
    errorPatterns: Array<{ pattern: string; frequency: number; examples: TerminalMemory[] }>;
    performancePatterns: Array<{ pattern: string; avgDuration: number; examples: TerminalMemory[] }>;
  }> {
    const allCommands = await this.history.searchCommands({});
    
    // Success patterns by command type
    const successByCommand: Record<string, TerminalMemory[]> = {};
    allCommands.forEach(cmd => {
      const base = cmd.command.split(' ')[0];
      if (cmd.exitCode === 0) {
        if (!successByCommand[base]) successByCommand[base] = [];
        successByCommand[base].push(cmd);
      }
    });

    const successPatterns = Object.entries(successByCommand)
      .map(([command, memories]) => ({
        pattern: `${command} commands`,
        frequency: memories.length,
        examples: memories.slice(0, 3)
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    // Error patterns - map count to frequency for consistency
    const rawErrorPatterns = await this.history.getErrorPatterns();
    const errorPatterns = rawErrorPatterns.map(p => ({
      pattern: p.pattern,
      frequency: p.frequency,
      examples: p.examples
    }));

    // Performance patterns
    const performanceByCommand: Record<string, { totalDuration: number; count: number; memories: TerminalMemory[] }> = {};
    allCommands.forEach(cmd => {
      const base = cmd.command.split(' ')[0];
      if (!performanceByCommand[base]) {
        performanceByCommand[base] = { totalDuration: 0, count: 0, memories: [] };
      }
      performanceByCommand[base].totalDuration += cmd.duration;
      performanceByCommand[base].count++;
      performanceByCommand[base].memories.push(cmd);
    });

    const performancePatterns = Object.entries(performanceByCommand)
      .map(([command, data]) => ({
        pattern: `${command} commands`,
        avgDuration: data.totalDuration / data.count,
        examples: data.memories.slice(0, 3)
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    return { successPatterns, errorPatterns, performancePatterns };
  }

  /**
   * Get contextual information for a command
   */
  async getContextForCommand(command: string, workingDirectory?: string): Promise<{
    recentSimilar: TerminalMemory[];
    commonErrors: TerminalMemory[];
    successfulAlternatives: TerminalMemory[];
    directoryContext: TerminalMemory[];
  }> {
    const [recentSimilar, commonErrors, successfulAlternatives, directoryContext] = await Promise.all([
      this.history.findSimilarCommands(command, 5),
      this.history.searchCommands({ command, exitCode: 1, limit: 5 }),
      this.history.searchCommands({ command, exitCode: 0, limit: 5 }),
      workingDirectory ? this.history.searchCommands({ workingDirectory, limit: 10 }) : Promise.resolve([])
    ]);

    return {
      recentSimilar,
      commonErrors,
      successfulAlternatives,
      directoryContext
    };
  }

  /**
   * Get predictive insights
   */
  async getPredictiveInsights(): Promise<{
    likelyCommands: Array<{ command: string; probability: number; context: string }>;
    expectedDurations: Array<{ command: string; expectedDuration: number; variance: number }>;
    riskAssessment: Array<{ command: string; riskLevel: 'low' | 'medium' | 'high'; reasons: string[] }>;
  }> {
    const stats = await this.history.getMemoryStats();
    const allCommands = await this.history.searchCommands({ limit: 1000 });

    // Likely commands based on patterns
    const commandCounts: Record<string, number> = {};
    allCommands.forEach(cmd => {
      const base = cmd.command.split(' ')[0];
      commandCounts[base] = (commandCounts[base] || 0) + 1;
    });

    const totalCommands = Object.values(commandCounts).reduce((sum, count) => sum + count, 0);
    const likelyCommands = Object.entries(commandCounts)
      .map(([command, count]) => ({
        command,
        probability: count / totalCommands,
        context: `Used ${count} times in history`
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10);

    // Expected durations
    const durationByCommand: Record<string, { total: number; count: number; durations: number[] }> = {};
    allCommands.forEach(cmd => {
      const base = cmd.command.split(' ')[0];
      if (!durationByCommand[base]) {
        durationByCommand[base] = { total: 0, count: 0, durations: [] };
      }
      durationByCommand[base].total += cmd.duration;
      durationByCommand[base].count++;
      durationByCommand[base].durations.push(cmd.duration);
    });

    const expectedDurations = Object.entries(durationByCommand)
      .map(([command, data]) => {
        const avg = data.total / data.count;
        const variance = data.durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / data.count;
        return {
          command,
          expectedDuration: avg,
          variance: Math.sqrt(variance)
        };
      })
      .sort((a, b) => b.expectedDuration - a.expectedDuration)
      .slice(0, 10);

    // Risk assessment
    const riskAssessment = likelyCommands.map(({ command }) => {
      const commandMemories = allCommands.filter(c => c.command.startsWith(command));
      const errorRate = commandMemories.filter(c => c.exitCode !== 0).length / commandMemories.length;
      
      let riskLevel: 'low' | 'medium' | 'high';
      let reasons: string[] = [];

      if (errorRate > 0.7) {
        riskLevel = 'high';
        reasons.push(`High error rate (${Math.round(errorRate * 100)}%)`);
      } else if (errorRate > 0.3) {
        riskLevel = 'medium';
        reasons.push(`Moderate error rate (${Math.round(errorRate * 100)}%)`);
      } else {
        riskLevel = 'low';
        reasons.push(`Low error rate (${Math.round(errorRate * 100)}%)`);
      }

      const avgDuration = commandMemories.reduce((sum, c) => sum + c.duration, 0) / commandMemories.length;
      if (avgDuration > 60000) {
        reasons.push('Long execution time');
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      return { command, riskLevel, reasons };
    });

    return { likelyCommands, expectedDurations, riskAssessment };
  }

  /**
   * Get memory health status
   */
  async getHealthStatus(): Promise<{
    totalMemories: number;
    indexHealth: 'healthy' | 'needs_rebuild' | 'corrupted';
    lastActivity: Date | null;
    memorySize: number;
  }> {
    const stats = await this.history.getMemoryStats();
    const memories = await this.history.searchCommands({ limit: 1 });
    
    let indexHealth: 'healthy' | 'needs_rebuild' | 'corrupted' = 'healthy';
    try {
      await this.history.searchCommands({});
    } catch {
      indexHealth = 'needs_rebuild';
    }

    return {
      totalMemories: stats.totalCommands,
      indexHealth,
      lastActivity: memories.length > 0 ? new Date(memories[0].timestamp) : null,
      memorySize: 0 // This would need to be calculated from file system
    };
  }
}