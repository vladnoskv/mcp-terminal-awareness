import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { McpConfig, ServerConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultConfig: McpConfig = {
  mcpServers: {
    'terminal-awareness': {
      command: 'node',
      args: ['dist/bin/cli.js'],
      cwd: process.cwd(),
      env: {}
    }
  },
  defaultServer: 'terminal-awareness',
  serverOptions: {
    port: 3000,
    logLevel: 'info',
    maxOutputLength: 1024 * 1024 // 1MB
  }
};

export function loadConfig(configPath?: string): McpConfig {
  try {
    const configFile = configPath || join(process.cwd(), 'mcp.config.json');
    const configData = readFileSync(configFile, 'utf8');
    const userConfig = JSON.parse(configData) as Partial<McpConfig>;
    
    // Merge with defaults
    return {
      ...defaultConfig,
      ...userConfig,
      serverOptions: {
        ...defaultConfig.serverOptions,
        ...(userConfig.serverOptions || {})
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('Using default configuration:', errorMessage);
    return defaultConfig;
  }
}

export function getServerConfig(serverName?: string, configPath?: string): ServerConfig {
  const config = loadConfig(configPath);
  const server = serverName || config.defaultServer;
  
  if (!server || !config.mcpServers[server]) {
    throw new Error(`Server configuration '${server}' not found`);
  }
  
  // Filter out undefined environment variables
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]
  );

  return {
    cwd: process.cwd(),
    env: { ...env, ...config.mcpServers[server].env },
    ...config.mcpServers[server]
  };
}

export function getServerOptions(configPath?: string) {
  return loadConfig(configPath).serverOptions;
}
