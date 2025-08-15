import { createMCPServer, type ServerOptions, type ToolDef } from './mcp/server.js';
import { TerminalAwareness } from './terminal/terminalAwareness.js';
import type { ServerStartOptions } from './types.js';
import { SessionStore, wireHeuristics, type Session } from "./sessions.js";
import { runCommand, type Spawned } from "./adapters/childprocess.js";

/**
 * Unified process adapter interface that works with both PTY and child processes
 */
export interface ProcessAdapter {
  /** Write data to the process's stdin */
  write(data: string): void;
  
  /** Kill the process with an optional signal */
  kill(signal?: NodeJS.Signals | number): void;
  
  /** Register a callback for process stdout/stderr data */
  onData(cb: (chunk: string) => void): ProcessAdapter;
  
  /** Register a callback for when the process exits */
  onExit(cb: (code: number | null, signal?: NodeJS.Signals | null) => void): ProcessAdapter;
  
  /**
   * Register an event handler
   * @param event The event type ('data' for output data, 'close' for process exit)
   * @param callback The callback function for the event
   */
  on(event: 'data', callback: (chunk: string) => void): ProcessAdapter;
  on(event: 'close', callback: (code: number | null, signal?: NodeJS.Signals | null) => void): ProcessAdapter;
}

/**
 * Input parameters for running a command
 */
export interface RunCommandOptions {
  command: string;
  cwd?: string;
  shell?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  quietMs?: number;
  waitingMs?: number;
  stuckMs?: number;
  maxBufferBytes?: number;
}

/**
 * Result of a command execution
 */
export interface CommandResult {
  sessionId: string;
  output: string;
  exitCode: number | null;
  success: boolean;
  error?: string;
}

// Initialize session store
const store = new SessionStore();

/**
 * Creates a process adapter for running commands, with PTY fallback to child process
 * @param command The command to run
 * @param cwd Current working directory
 * @param shell Shell to use
 * @param env Environment variables
 * @returns A ProcessAdapter instance
 * @throws {Error} If both PTY and child process fail to initialize
 */
async function maybeRunPTY(
  command: string, 
  cwd: string = process.cwd(), 
  shell: string = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'),
  env: Record<string, string> = {}
): Promise<ProcessAdapter> {
  // Try to use PTY if enabled
  if (process.env.USE_PTY === "1") {
    try {
      const { runPTY } = await import("./adapters/pty.js");
      const ptyProcess = await runPTY(command, cwd, shell, env);
      
      // Create a simple adapter for PTY processes
      const adapter: ProcessAdapter = {
        write: (data: string) => {
          try {
            ptyProcess.write(data);
          } catch (error) {
            console.error('Error writing to PTY:', error);
            throw error;
          }
        },
        kill: (signal?: NodeJS.Signals | number) => {
          try {
            // PTY's kill doesn't take a signal parameter, so we just call kill()
            // and let the OS handle the signal (usually SIGTERM)
            ptyProcess.kill();
          } catch (error) {
            console.error('Error killing PTY process:', error);
            throw error;
          }
        },
        onData: (cb: (chunk: string) => void) => {
          try {
            ptyProcess.onData(cb);
          } catch (error) {
            console.error('Error setting up PTY data handler:', error);
            throw error;
          }
          return adapter;
        },
        onExit: (cb: (code: number | null, signal?: NodeJS.Signals | null) => void) => {
          try {
            ptyProcess.onExit((code, signal) => {
              // Convert signal from number to NodeJS.Signals if needed
              const signalName = typeof signal === 'number' 
                ? signal.toString() as NodeJS.Signals 
                : signal;
              cb(code, signalName || null);
            });
          } catch (error) {
            console.error('Error setting up PTY exit handler:', error);
            throw error;
          }
          return adapter;
        },
        on: (function(this: ProcessAdapter, event: 'data' | 'close', callback: (chunk: string | number | null, signal?: NodeJS.Signals | null) => void): ProcessAdapter {
          try {
            if (event === 'data') {
              // For data events, ensure the callback only receives string chunks
              return this.onData((chunk: string) => {
                if (typeof callback === 'function') {
                  callback(chunk, null);
                }
              });
            } else if (event === 'close') {
              // For close events, the callback receives code and signal
              return this.onExit((code: number | null, signal?: NodeJS.Signals | null) => {
                if (typeof callback === 'function') {
                  callback(code, signal || null);
                }
              });
            }
          } catch (error) {
            console.error(`Error in PTY ${event} handler:`, error);
            throw error;
          }
          return this;
        }) as ProcessAdapter['on']
      };
      return adapter;
    } catch (error) {
      console.warn('PTY not available, falling back to child process:', error instanceof Error ? error.message : String(error));
    }
  }
  
  // Fall back to regular child process
  try {
    const child = runCommand(command, cwd, shell, env);
    
    // Create a simple adapter for child processes
    const adapter: ProcessAdapter = {
      write: (data: string) => {
        try {
          child.write(data);
        } catch (error) {
          console.error('Error writing to child process:', error);
          throw error;
        }
      },
      kill: (signal?: NodeJS.Signals | number) => {
        try {
          child.kill(signal as NodeJS.Signals || 'SIGTERM');
        } catch (error) {
          console.error('Error killing child process:', error);
          throw error;
        }
      },
      onData: (cb: (chunk: string) => void) => {
        try {
          child.onData(cb);
        } catch (error) {
          console.error('Error setting up child process data handler:', error);
          throw error;
        }
        return adapter;
      },
      onExit: (cb: (code: number | null, signal?: NodeJS.Signals | null) => void) => {
        try {
          child.onExit((code, signal) => {
            cb(code, signal as NodeJS.Signals | null);
          });
        } catch (error) {
          console.error('Error setting up child process exit handler:', error);
          throw error;
        }
        return adapter;
      },
      on: (function(this: ProcessAdapter, event: 'data' | 'close', callback: (chunk: string | number | null, signal?: NodeJS.Signals | null) => void): ProcessAdapter {
        try {
          if (event === 'data') {
            // For data events, ensure the callback only receives string chunks
            return this.onData((chunk: string) => {
              if (typeof callback === 'function') {
                callback(chunk, null);
              }
            });
          } else if (event === 'close') {
            // For close events, the callback receives code and signal
            return this.onExit((code: number | null, signal?: NodeJS.Signals | null) => {
              if (typeof callback === 'function') {
                callback(code, signal || null);
              }
            });
          }
        } catch (error) {
          console.error(`Error in child process ${event} handler:`, error);
          throw error;
        }
        return this;
      } as unknown) as ProcessAdapter['on']
    };
    
    return adapter;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to create child process:', errorMessage);
    throw new Error(`Failed to start command: ${errorMessage}`);
  }
}

/**
 * Start the MCP Terminal Awareness server
 * @param options Server configuration options
 * @param onReady Optional callback when server is ready
 * @returns The MCP server instance
 */
export async function startServer(options: ServerStartOptions = {}, onReady?: () => void) {
  // Initialize terminal awareness with configuration
  const terminalAwareness = new TerminalAwareness({
    maxOutputLength: options.maxOutputLength
  });

  // Define tools
  const tools: ToolDef[] = [
    ...terminalAwareness.getTools(),
    createRunTool(),
    createStatusTool(),
    createWriteTool(),
    createSignalTool(),
    createListTool(),
    createAttachTool()
  ];

  try {
    // Create MCP server with configuration
    const server = createMCPServer(
      {
        name: 'mcp-terminal-awareness',
        version: '0.1.0'
      },
      tools
    );

    // Start the server
    const port = options.port || 3000;
    
    // Start the server and handle ready state
    await new Promise<void>((resolve, reject) => {
      // @ts-expect-error - The server's start method is not properly typed
      server.listen(port, () => {
        console.log(`MCP Terminal Awareness Server running on port ${port}`);
        if (onReady) onReady();
        resolve();
      }).catch(reject);
    });
    
    return server;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to start server:', errorMessage);
    process.exit(1);
  }
}

// Export for backward compatibility
export default { startServer };

/**
 * Creates a tool definition for running terminal commands with awareness of completion vs waiting states.
 * @returns {ToolDef} The tool definition for running terminal commands
 */
function createRunTool(): ToolDef {
  return {
    name: "terminal.run",
    description: "Run a shell command with awareness of completion vs waiting",
    inputSchema: {
      type: "object",
      properties: {
        command: { 
          type: "string", 
          description: "The command to execute",
          minLength: 1
        },
        cwd: { 
          type: "string", 
          description: "Working directory",
          default: process.cwd()
        },
        shell: { 
          type: "string", 
          description: "Shell to use",
          default: process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/bash')
        },
        timeoutMs: { 
          type: "number", 
          description: "Maximum execution time in milliseconds",
          minimum: 0,
          default: 30000
        },
        env: { 
          type: "object", 
          description: "Environment variables",
          additionalProperties: { type: "string" },
          default: {}
        },
        quietMs: { 
          type: "number", 
          description: "Milliseconds of quiet before considering complete",
          minimum: 0,
          default: 300
        },
        waitingMs: { 
          type: "number", 
          description: "Milliseconds before considering waiting",
          minimum: 0,
          default: 10000
        },
        stuckMs: { 
          type: "number", 
          description: "Milliseconds before considering stuck",
          minimum: 0,
          default: 45000
        },
        maxBufferBytes: { 
          type: "number", 
          description: "Maximum output buffer size in bytes",
          minimum: 1024,
          default: 2 * 1024 * 1024 // 2MB
        }
      },
      required: ["command"],
      additionalProperties: false
    },
    async invoke({ input, progress }) {
      // Input validation is handled by the schema
      // Destructure with defaults to ensure all values are defined
      const { 
        command, 
        cwd = process.cwd(), 
        shell = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'),
        env = {},
        timeoutMs = 30000,
        quietMs = 300,
        waitingMs = 10000,
        stuckMs = 45000,
        maxBufferBytes = 2 * 1024 * 1024 // 2MB
      } = input as RunCommandOptions;

      // Create a new session
      const session = store.newSession();
      session.maxBufferBytes = maxBufferBytes;
      
      // Set up cleanup on process exit
      const cleanup = () => {
        if (session.quietTimer) {
          clearTimeout(session.quietTimer);
          session.quietTimer = null;
        }
        if (session.idleTimer) {
          clearInterval(session.idleTimer);
          session.idleTimer = null;
        }
        // Remove session from store when done
        setTimeout(() => store.remove(session.id), 60000); // Keep for 1 minute after completion
      };

      try {
        // Start the process
        const proc = await maybeRunPTY(command, cwd, shell, env);
        session.adapter = proc;
        session.status = 'running';
        
        // Create a progress function that matches the expected signature
        const progressFn = progress ? (msg: string) => progress({ message: msg }) : undefined;
        
        // Set up process event handlers with heuristics
        const heuristics = wireHeuristics(session, progressFn, { 
          quietMs, 
          waitingMs, 
          stuckMs, 
          maxBufferBytes 
        });
        
        // Start monitoring for idle/stuck states
        heuristics.startIdleTimers();
        
        // Handle process output
        proc.onData((chunk: string) => {
          try {
            heuristics.onChunk(chunk);
            progress?.({ message: `Received ${chunk.length} bytes` });
          } catch (error) {
            console.error('Error processing chunk:', error);
          }
        });

        // Set up timeout for the entire command
        let timeoutId: NodeJS.Timeout | null = null;
        if (timeoutMs > 0) {
          timeoutId = setTimeout(() => {
            if (session.status === 'running' || session.status === 'waiting') {
              session.status = 'error';
              session.errorReason = 'Command timed out';
              proc.kill('SIGTERM');
            }
          }, timeoutMs);
        }

        // Wait for process to complete
        return new Promise<CommandResult>((resolve, reject) => {
          proc.onExit((code: number | null, signal?: NodeJS.Signals | null) => {
            // Clean up timeout if it was set
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            
            // Update session status
            session.status = code === 0 ? 'completed' : 'error';
            session.exitCode = code;
            session.exitSignal = signal;
            
            // Clean up resources
            cleanup();
            
            // Resolve with result
            resolve({
              sessionId: session.id,
              output: session.buf.join(''),
              exitCode: code,
              success: code === 0,
              error: code !== 0 ? `Process exited with code ${code}` : undefined
            });
          });
          
          // Handle process errors by listening to the 'close' event with non-zero exit code
          // We'll also set up error handling in the onExit callback
          proc.onExit((code, signal) => {
            // Clean up timeout if it was set
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            
            // Update session status
            const isError = code !== 0 || signal !== null;
            session.status = isError ? 'error' : 'completed';
            session.exitCode = code;
            session.exitSignal = signal;
            
            if (isError) {
              session.errorReason = `Process exited with code ${code}${signal ? `, signal: ${signal}` : ''}`;
              reject(new Error(session.errorReason));
            } else {
              resolve({
                sessionId: session.id,
                output: session.buf.join(''),
                exitCode: code,
                success: true
              });
            }
            
            // Clean up resources
            cleanup();
          });
        });
      } catch (error) {
        // Clean up on error
        cleanup();
        const errorMessage = error instanceof Error ? error.message : String(error);
        session.status = 'error';
        session.errorReason = errorMessage;
        throw new Error(`Failed to start command: ${errorMessage}`);
      }
    }
  };
}

/**
 * Creates a tool definition for getting the status of a terminal session.
 * @returns {ToolDef} The tool definition for getting session status
 */
function createStatusTool(): ToolDef {
  return {
    name: "terminal.status",
    description: "Get the status of a terminal session",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" }
      },
      required: ["sessionId"]
    },
    invoke({ input }) {
      const session = store.get((input as any).sessionId);
      if (!session) {
        throw new Error("Session not found");
      }
      return {
        status: session.status,
        exitCode: session.exitCode,
        output: session.buf.join('')
      };
    }
  };
}

/**
 * Creates a tool definition for writing to a terminal session's stdin.
 * @returns {ToolDef} The tool definition for writing to a session
 */
function createWriteTool(): ToolDef {
  return {
    name: "terminal.write",
    description: "Write to a terminal session",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        data: { type: "string" }
      },
      required: ["sessionId", "data"]
    },
    invoke({ input }) {
      const { sessionId, data } = input as any;
      const session = store.get(sessionId);
      if (!session?.adapter) {
        throw new Error("Session not found or not active");
      }
      session.adapter.write(data);
      return { success: true };
    }
  };
}

/**
 * Creates a tool definition for sending signals to a terminal session.
 * @returns {ToolDef} The tool definition for sending signals
 */
function createSignalTool(): ToolDef {
  return {
    name: "terminal.signal",
    description: "Send a signal to a terminal session",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        signal: { type: "string" }
      },
      required: ["sessionId"]
    },
    invoke({ input }) {
      const { sessionId, signal = "SIGTERM" } = input as any;
      const session = store.get(sessionId);
      if (!session?.adapter) {
        throw new Error("Session not found or not active");
      }
      session.adapter.kill(signal);
      return { success: true };
    }
  };
}

/**
 * Creates a tool definition for listing active terminal sessions.
 * @returns {ToolDef} The tool definition for listing sessions
 */
function createListTool(): ToolDef {
  return {
    name: "terminal.list",
    description: "List all active terminal sessions",
    inputSchema: {
      type: "object",
      properties: {}
    },
    invoke() {
      return store.all().map(session => ({
        id: session.id,
        status: session.status,
        command: session.buf.join('').split('\n')[0],
        lastActivity: session.lastByteAt
      }));
    }
  };
}

/**
 * Creates a tool definition for attaching to an existing terminal session.
 * @returns {ToolDef} The tool definition for attaching to sessions
 */
function createAttachTool(): ToolDef {
  return {
    name: "terminal.attach",
    description: "Attach to a terminal session to receive updates",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" }
      },
      required: ["sessionId"]
    },
    invoke({ input }) {
      const session = store.get((input as any).sessionId);
      if (!session) {
        throw new Error("Session not found");
      }
      // In a real implementation, this would set up a subscription
      return {
        sessionId: session.id,
        output: session.buf.join(''),
        status: session.status
      };
    }
  };
}

// Only one startServer function is defined at the top of the file
