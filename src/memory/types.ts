/**
 * Terminal Memory System - Type Definitions
 * Based on MCP File+Memory Server template patterns
 */

export interface TerminalMemory {
  id: string;
  timestamp: string; // ISO 8601
  command: string;
  exitCode: number;
  duration: number; // milliseconds
  stdout: string;
  stderr: string;
  workingDirectory: string;
  shell: string;
  tags: string[];
  metadata: CommandMetadata;
}

export interface CommandMetadata {
  cpuUsage?: number;
  memoryUsage?: number;
  networkActivity?: boolean;
  fileOperations?: FileOperation[];
  securityFlags?: SecurityFlags;
}

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'create';
  path: string;
  size?: number;
  timestamp: string;
}

export interface SecurityFlags {
  sandboxViolation?: boolean;
  commandBlocked?: boolean;
  resourceLimitExceeded?: boolean;
  suspiciousPattern?: boolean;
}

export interface MemoryIndex {
  commandIndex: Record<string, string[]>; // command -> memory IDs
  exitCodeIndex: Record<number, string[]>; // exit code -> memory IDs
  durationIndex: Record<string, string[]>; // duration ranges -> memory IDs
  directoryIndex: Record<string, string[]>; // directory -> memory IDs
  tagIndex: Record<string, string[]>; // tag -> memory IDs
  errorIndex: Record<string, string[]>; // error type -> memory IDs
}

export interface MemoryQuery {
  command?: string;
  exitCode?: number;
  durationRange?: { min: number; max: number };
  workingDirectory?: string;
  tags?: string[];
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

export interface MemoryStats {
  totalCommands: number;
  successRate: number;
  averageDuration: number;
  mostCommonCommands: Array<{ command: string; count: number }>;
  errorPatterns: Array<{ pattern: string; count: number }>;
  performanceTrends: {
    daily: Array<{ date: string; avgDuration: number; successRate: number }>;
    weekly: Array<{ week: string; avgDuration: number; successRate: number }>;
  };
}

export interface SecurityConfig {
  allowedCommands: string[];
  blockedPatterns: RegExp[];
  maxExecutionTime: number;
  maxMemoryUsage: number;
  sandboxRoot: string;
  allowedDirectories: string[];
  forbiddenPaths: string[];
}

export interface PerformanceThresholds {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkActivity: boolean;
}

// Memory kinds for categorization
export type MemoryKind = 
  | 'success'      // Successful command execution
  | 'error'        // Command failed
  | 'timeout'      // Command timed out
  | 'security'     // Security-related event
  | 'performance'  // Performance-related event
  | 'system'       // System-level command
  | 'user'         // User-initiated command
  | 'script'       // Script execution
  | 'interactive'; // Interactive session

// Export utility types
export type MemoryID = string;
export type CommandHash = string;
export type DirectoryPath = string;