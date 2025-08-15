/**
 * Tiny MCP-like server glue built on JSON-RPC. It supports:
 * - initialize
 * - tools/list
 * - tools/call
 * - notifications/progress (as JSON-RPC notifications: method "notifications/progress")
 */

import { JSONRPCServer, createStdioTransport, JSONValue } from "./jsonrpc.js";

export type ProgressFn = (update: { current?: number; total?: number; indeterminate?: boolean; message?: string }) => void;

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: JSONValue;
  /** Return value will be sent as result.content; may be { content: [...]} already */
  invoke: (args: { input: any; progress?: ProgressFn }) => Promise<JSONValue> | JSONValue;
};

export interface ServerOptions { name: string; version: string; }

export function createMCPServer(opts: ServerOptions, tools: ToolDef[]) {
  const rpc = new JSONRPCServer();
  const tx = createStdioTransport(async (line) => {
    const out = await rpc.dispatch(line);
    if (out) tx.send(out);
  });

  function sendProgress(payload: any) {
    tx.send(JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: payload }));
  }

  rpc.on("initialize", async () => ({
    protocol: "mcp-lite",
    server: { name: opts.name, version: opts.version },
    capabilities: { tools: true, sampling: false, resources: false }
  }));

  rpc.on("tools/list", async () => ({ tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) }));

  rpc.on("tools/call", async (params) => {
    const { name, arguments: input } = params || {};
    const tool = tools.find(t => t.name === name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const result = await tool.invoke({ input, progress: (u) => sendProgress({ tool: name, ...u }) });
    return result && (result as any).content ? result : { content: [ result ] } as any;
  });

  return { sendProgress };
}
