export interface ServerConfig {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface McpConfig {
  mcpServers: {
    [key: string]: ServerConfig;
  };
  defaultServer?: string;
  serverOptions?: {
    port?: number;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    maxOutputLength?: number;
  };
}

export interface ServerStartOptions {
  port?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  maxOutputLength?: number;
}
