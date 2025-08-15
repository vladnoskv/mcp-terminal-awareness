import { ToolDef, ProgressFn } from '../mcp/server.js';

interface CommandInput {
  command: string;
  timeoutMs?: number;
  cwd?: string;
}

interface CommandResult {
  output: string;
  exitCode: number;
  success: boolean;
}

export class TerminalAwareness {
  private maxOutputLength: number;

  constructor(options: { maxOutputLength?: number } = {}) {
    this.maxOutputLength = options.maxOutputLength || 1024 * 1024; // 1MB default
  }

  getTools(): ToolDef[] {
    return [{
      name: 'terminal.run',
      description: 'Execute a terminal command',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          timeoutMs: { 
            type: 'number', 
            description: 'Timeout in milliseconds',
            default: 30000
          },
          cwd: { 
            type: 'string', 
            description: 'Working directory',
            default: process.cwd()
          }
        },
        required: ['command']
      },
      invoke: async (args: { input: CommandInput; progress?: ProgressFn }): Promise<CommandResult> => {
        const { command, timeoutMs = 30000, cwd = process.cwd() } = args.input;
        return this.executeCommand(command, { timeoutMs, cwd });
      }
    }];
  }

  async executeCommand(
    command: string, 
    options: { timeoutMs?: number; cwd?: string } = {}
  ): Promise<CommandResult> {
    const { timeoutMs = 30000, cwd = process.cwd() } = options;
    
    // Implementation for command execution
    // This is a simplified implementation - you may want to add more robust error handling
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync(command, { 
        cwd,
        timeout: timeoutMs,
        maxBuffer: this.maxOutputLength
      });
      
      return {
        output: stdout || stderr,
        exitCode: 0,
        success: true
      };
    } catch (error: any) {
      return {
        output: error.stderr || error.message,
        exitCode: error.code || 1,
        success: false
      };
    }
  }
}
