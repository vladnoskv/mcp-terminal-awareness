/**
 * MCP Memory Tools - Additional tools for memory operations
 * Integrates with the terminal awareness server
 */

import { ToolDef } from '../mcp/server.js';
import { CommandHistory } from './commandHistory.js';
import { RecallEngine } from './recallEngine.js';

// Initialize memory systems
const history = new CommandHistory();
const recall = new RecallEngine(history);

/**
 * Creates a tool for searching command history
 */
export function createSearchHistoryTool(): ToolDef {
  return {
    name: "terminal.search_history",
    description: "Search through command history with various filters",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Command or command prefix to search for"
        },
        exitCode: {
          type: "number",
          description: "Filter by exit code"
        },
        workingDirectory: {
          type: "string",
          description: "Filter by working directory"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags (success, error, long-running, etc.)"
        },
        fromTimestamp: {
          type: "string",
          description: "Start date (ISO format)"
        },
        toTimestamp: {
          type: "string",
          description: "End date (ISO format)"
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
          default: 10
        }
      }
    },
    async invoke({ input }) {
      const results = await history.searchCommands(input);
      return results.map(memory => ({
        id: memory.id,
        command: memory.command,
        exitCode: memory.exitCode,
        duration: memory.duration,
        timestamp: memory.timestamp,
        workingDirectory: memory.workingDirectory,
        tags: memory.tags,
        stdoutPreview: memory.stdout.substring(0, 200) + (memory.stdout.length > 200 ? '...' : ''),
        stderrPreview: memory.stderr.substring(0, 200) + (memory.stderr.length > 200 ? '...' : '')
      }));
    }
  };
}

/**
 * Creates a tool for getting command statistics
 */
export function createCommandStatsTool(): ToolDef {
  return {
    name: "terminal.command_stats",
    description: "Get statistical analysis of command usage and performance",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Get stats for specific command (optional)"
        }
      }
    },
    async invoke({ input }) {
      if (input.command) {
        const results = await history.searchCommands({ command: input.command, limit: 1000 });
        const stats = {
          total: results.length,
          successRate: results.filter(r => r.exitCode === 0).length / results.length,
          avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
          errorBreakdown: results
            .filter(r => r.exitCode !== 0)
            .reduce((acc, r) => {
              acc[r.exitCode] = (acc[r.exitCode] || 0) + 1;
              return acc;
            }, {} as Record<number, number>)
        };
        return stats;
      }
      
      return await history.getMemoryStats();
    }
  };
}

/**
 * Creates a tool for finding similar commands
 */
export function findSimilarCommandsTool(): ToolDef {
  return {
    name: "terminal.find_similar",
    description: "Find commands similar to the given command",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Command to find similar ones for"
        },
        limit: {
          type: "number",
          description: "Maximum number of similar commands",
          default: 5
        }
      },
      required: ["command"]
    },
    async invoke({ input }) {
      const results = await history.findSimilarCommands(input.command, input.limit);
      return results.map(memory => ({
        id: memory.id,
        command: memory.command,
        exitCode: memory.exitCode,
        duration: memory.duration,
        timestamp: memory.timestamp,
        similarityScore: calculateSimilarity(input.command, memory.command),
        workingDirectory: memory.workingDirectory,
        tags: memory.tags
      }));
    }
  };
}

/**
 * Creates a tool for getting intelligent suggestions
 */
export function createSuggestTool(): ToolDef {
  return {
    name: "terminal.suggest",
    description: "Get intelligent suggestions for a command before execution",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Command to get suggestions for"
        },
        workingDirectory: {
          type: "string",
          description: "Current working directory for context"
        }
      },
      required: ["command"]
    },
    async invoke({ input }) {
      const suggestions = await recall.suggestForCommand(input.command);
      const context = await recall.getContextForCommand(input.command, input.workingDirectory);
      
      return {
        suggestions,
        context: {
          recentSimilar: context.recentSimilar.slice(0, 3),
          commonErrors: context.commonErrors.slice(0, 3),
          successfulAlternatives: context.successfulAlternatives.slice(0, 3)
        }
      };
    }
  };
}

/**
 * Creates a tool for getting error patterns
 */
export function createErrorPatternsTool(): ToolDef {
  return {
    name: "terminal.error_patterns",
    description: "Get common error patterns and their solutions",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of patterns to return",
          default: 10
        }
      }
    },
    async invoke({ input }) {
      const patterns = await history.getErrorPatterns();
      return patterns.slice(0, input.limit);
    }
  };
}

/**
 * Creates a tool for memory health check
 */
export function createMemoryHealthTool(): ToolDef {
  return {
    name: "terminal.memory_health",
    description: "Check the health and status of the memory system",
    inputSchema: {
      type: "object",
      properties: {}
    },
    async invoke() {
      return await recall.getHealthStatus();
    }
  };
}

/**
 * Creates a tool for rebuilding memory indexes
 */
export function createRebuildIndexTool(): ToolDef {
  return {
    name: "terminal.rebuild_index",
    description: "Rebuild memory indexes for optimal performance",
    inputSchema: {
      type: "object",
      properties: {}
    },
    async invoke() {
      await history.rebuildIndexes();
      return { success: true, message: "Memory indexes rebuilt successfully" };
    }
  };
}

/**
 * Creates a tool for getting predictive insights
 */
export function createPredictiveInsightsTool(): ToolDef {
  return {
    name: "terminal.predict",
    description: "Get predictive insights based on command history",
    inputSchema: {
      type: "object",
      properties: {}
    },
    async invoke() {
      return await recall.getPredictiveInsights();
    }
  };
}

/**
 * Get all memory-related tools
 */
export function getMemoryTools(): ToolDef[] {
  return [
    createSearchHistoryTool(),
    createCommandStatsTool(),
    findSimilarCommandsTool(),
    createSuggestTool(),
    createErrorPatternsTool(),
    createMemoryHealthTool(),
    createRebuildIndexTool(),
    createPredictiveInsightsTool()
  ];
}

/**
 * Calculate similarity between two commands
 */
function calculateSimilarity(command1: string, command2: string): number {
  const cmd1 = command1.toLowerCase();
  const cmd2 = command2.toLowerCase();
  
  if (cmd1 === cmd2) return 1.0;
  
  const words1 = cmd1.split(' ');
  const words2 = cmd2.split(' ');
  
  // Check if they start with the same base command
  if (words1[0] === words2[0]) {
    const commonWords = words1.filter(word => words2.includes(word));
    const maxLength = Math.max(words1.length, words2.length);
    return 0.5 + (commonWords.length / maxLength) * 0.5;
  }
  
  return 0;
}

/**
 * Record a command execution in memory (for integration)
 */
export async function recordCommandExecution(
  command: string,
  exitCode: number,
  duration: number,
  stdout: string,
  stderr: string,
  workingDirectory: string,
  shell: string
): Promise<string> {
  return await history.recordCommand(
    command,
    exitCode,
    duration,
    stdout,
    stderr,
    workingDirectory,
    shell
  );
}