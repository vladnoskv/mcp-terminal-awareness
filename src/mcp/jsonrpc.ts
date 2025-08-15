/** Minimal JSON-RPC 2.0 over stdio */

import { createInterface } from "node:readline";

export type JSONRPCID = string | number | null;
export type JSONValue = any;

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id?: JSONRPCID;
  method: string;
  params?: JSONValue;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: JSONRPCID;
  result?: JSONValue;
  error?: { code: number; message: string; data?: JSONValue };
}

export type Handler = (params: JSONValue, id: JSONRPCID | undefined) => Promise<JSONValue | void> | JSONValue | void;

export class JSONRPCServer {
  private handlers = new Map<string, Handler>();

  on(method: string, handler: Handler) {
    this.handlers.set(method, handler);
  }

  async dispatch(raw: string): Promise<string | null> {
    let msg: JSONRPCRequest;
    try { msg = JSON.parse(raw); } catch { return null; }
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return null;
    const h = this.handlers.get(msg.method);
    if (!h) {
      if (msg.id !== undefined) {
        return JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
      }
      return null;
    }
    try {
      const res = await h(msg.params, msg.id);
      if (msg.id !== undefined) {
        return JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: res ?? null });
      }
      return null;
    } catch (e: any) {
      if (msg.id !== undefined) {
        return JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: e?.message || String(e) } });
      }
      return null;
    }
  }
}

export function createStdioTransport(onMessage: (data: string) => void) {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => onMessage(line));
  return {
    send: (msg: string) => process.stdout.write(msg + "\n")
  };
}
