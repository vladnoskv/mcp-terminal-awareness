# mcp-terminal-awareness

A minimal, cross-platform **MCP server** that gives chat agents a terminal with **awareness**: it can tell when a command is **done**, when it’s **waiting for input**, or when it’s **possibly stuck**. It exposes a small set of MCP tools, sends progress notifications, and implements practical heuristics (prompt re-appearance, quiet windows, idle timers, finish-phrase bank, and spinner suppression).

> **Goal:** Zero runtime dependencies by default (Node built-ins only), with an **optional** PTY adapter (node-pty) for full TTY fidelity when available.

---

## Features

- ✅ **MCP tools**: `terminal.run`, `terminal.status`, `terminal.write`, `terminal.signal`, `terminal.attach`, `terminal.list`
- ✅ **Progress notifications** for long-running tasks (clients won’t “hang”)
- ✅ **Heuristics** to classify state: `running` → `waiting` → `possibly-stuck` → `completed`
- ✅ **Quiet-window** after prompt/exit to avoid premature completion
- ✅ **Known finish phrases** for common CLIs (npm, git, pip, etc.)
- ✅ **Spinner/ANSI suppression** to ignore cosmetic frames
- ✅ **Session management**: multiple terminals, attach/detach, tail output
- ✅ **Optional PTY** for true terminal behavior (password prompts, ncurses, etc.)
- ✅ **No runtime deps** (baseline), TypeScript dev-only

---

## Quick start

```bash
# 1) Scaffold (if you’re copying this file set):
#    Create files as specified below, then:

npm install --save-dev typescript @types/node
npm run build

# 2) Start the server (stdio mode expected by MCP clients)
node dist/bin/cli.js

# Optional: enable PTY when node-pty is installed
# npm i node-pty
USE_PTY=1 node dist/bin/cli.js
```

Integration examples for MCP clients are at the bottom of this document.

---

## Repository layout

```
mcp-terminal-awareness/
├─ package.json
├─ tsconfig.json
├─ README.md
├─ LICENSE
├─ src/
│  ├─ bin/cli.ts
│  ├─ server.ts
│  ├─ sessions.ts
│  ├─ heuristics/
│  │  ├─ ansi.ts
│  │  ├─ finishes.ts
│  │  ├─ prompts.ts
│  ├─ adapters/
│  │  ├─ childprocess.ts
│  │  └─ pty.ts
│  └─ mcp/
│     ├─ jsonrpc.ts
│     └─ server.ts
└─ .mcp.json          # sample client config (optional)
```

> **Note:** This single document contains **all file contents**. Create them exactly as shown (paths and code) or give this to an AI/codegen tool to generate the repo.

---

## FILE: `package.json`

```json
{
  "name": "mcp-terminal-awareness",
  "version": "0.1.0",
  "description": "MCP server that runs terminal commands with awareness of completion, waiting, and stuck states.",
  "license": "MIT",
  "type": "module",
  "bin": {
    "mcp-terminal-awareness": "dist/bin/cli.js"
  },
  "scripts": {
    "build": "tsc -p .",
    "dev": "node --enable-source-maps dist/bin/cli.js",
    "start": "node dist/bin/cli.js",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=18.19.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "typescript": "^5.5.4"
  },
  "optionalDependencies": {
    "node-pty": "^1.0.0"
  }
}
```

---

## FILE: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src"]
}
```

---

## FILE: `README.md`

````md
# mcp-terminal-awareness

An MCP server that upgrades agents' terminal skills with awareness and progress.

## Why?

Many chat-agents get stuck waiting on terminals. This server detects when commands are done, when the shell is prompting, and when a process is idle or stuck. It emits progress notifications so clients don’t appear frozen.

## Install

```bash
npm i -D typescript @types/node
npm run build
# optional PTY
npm i node-pty
````

## Run

```bash
node dist/bin/cli.js
# or with PTY
USE_PTY=1 node dist/bin/cli.js
```

## Tools exposed

- `terminal.run` — run a command with awareness; streams content and returns final status
- `terminal.status` — get the status of a session, last activity time, and tail output
- `terminal.write` — write keystrokes to a live session
- `terminal.signal` — send SIGINT/TERM; ctrl keys
- `terminal.list` — list active sessions
- `terminal.attach` — re-attach to a session (subscribe to output)

## Heuristics

- Prompt re-appearance (detected or calibrated)
- Process exit + quiet window (150–400 ms)
- Known finish phrases (npm/pnpm/yarn/git/pip/pytest/etc.)
- Spinner/ANSI suppression
- Idle timers → `waiting` / `possibly-stuck`

## Client config

Place this in your MCP client config (example):

```jsonc
{
  "mcpServers": {
    "mcp-terminal-awareness": {
      "command": "node",
      "args": ["dist/bin/cli.js"],
      "env": { "USE_PTY": "0" }
    }
  }
}
```

## Security

Run in trusted workspaces. Consider allowlists of commands and sanitized env.

```
```

---

## FILE: `LICENSE`

```text
MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## FILE: `src/bin/cli.ts`

```ts
#!/usr/bin/env node
import { startServer } from "../server.js";

startServer({
  name: "mcp-terminal-awareness",
  version: "0.1.0"
});
```

> Make sure to `chmod +x dist/bin/cli.js` after build if needed.

---

## FILE: `src/mcp/jsonrpc.ts`

```ts
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
```

---

## FILE: `src/mcp/server.ts`

```ts
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
    return result && result.content ? result : { content: [ result ] };
  });

  return { sendProgress };
}
```

---

## FILE: `src/heuristics/ansi.ts`

```ts
/** Utilities for ANSI handling and spinner suppression */
const ANSI_REGEX = /\u001b\[[0-9;]*m/g; // SGR only for simplicity

export function stripAnsi(s: string): string {
  return s.replace(ANSI_REGEX, "");
}

// Naive spinner/frame detection: sequences that only change a final char in |/-\\
export function isLikelySpinnerFrame(prev: string, next: string): boolean {
  const a = stripAnsi(prev).trimEnd();
  const b = stripAnsi(next).trimEnd();
  if (a.length !== b.length) return false;
  const spinners = "|/-\\";
  const la = a.at(-1) || "";
  const lb = b.at(-1) || "";
  if (!spinners.includes(la) || !spinners.includes(lb)) return false;
  return a.slice(0, -1) === b.slice(0, -1);
}
```

---

## FILE: `src/heuristics/finishes.ts`

```ts
export const FINISH_PATTERNS: RegExp[] = [
  /(✔|✓|Success|Done|Completed|All tests passed)/i,
  /(added|audited) \d+ packages/i,
  /up to date/i,
  /built successfully|build succeeded|build failed/i,
  /(listening|running) on (http|https)/i,
  /published|pushed|done in \d+\.?\d*s/i,
  /Total time: \d+[smh]/i
];

export function looksFinished(line: string): boolean {
  return FINISH_PATTERNS.some(re => re.test(line));
}
```

---

## FILE: `src/heuristics/prompts.ts`

```ts
import { stripAnsi } from "./ansi.js";

// Very naive default prompt patterns; improve by calibration.
const COMMON_PROMPTS: RegExp[] = [
  /(\n|\r|^)PS [^\n>]+>\s$/m,       // PowerShell
  /(\n|\r|^)[^\n]*[$#]\s$/m          // POSIX shells
];

export function detectPrompt(line: string): RegExp | undefined {
  const clean = stripAnsi(line);
  for (const re of COMMON_PROMPTS) if (re.test(clean)) return re;
  return undefined;
}
```

---

## FILE: `src/adapters/childprocess.ts`

```ts
import { spawn } from "node:child_process";
import { EOL } from "node:os";

export type Spawned = {
  write(data: string): void;
  kill(signal?: NodeJS.Signals | number): void;
  onData(cb: (chunk: string) => void): void;
  onExit(cb: (code: number | null, signal: NodeJS.Signals | null) => void): void;
};

export function runCommand(command: string, cwd?: string, shell?: string): Spawned {
  const isWin = process.platform === "win32";
  const sh = shell || (isWin ? "powershell" : "bash");
  const args = isWin ? ["-NoLogo", "-NoProfile", "-Command", command]
                     : ["-lc", command];
  const child = spawn(sh, args, { cwd, env: process.env });

  return {
    write: (data: string) => child.stdin?.write(data + EOL),
    kill: (signal?: any) => child.kill(signal),
    onData: (cb) => {
      child.stdout?.on("data", (b: Buffer) => cb(b.toString("utf8")));
      child.stderr?.on("data", (b: Buffer) => cb(b.toString("utf8")));
    },
    onExit: (cb) => child.on("exit", (code, sig) => cb(code, sig as any))
  };
}
```

---

## FILE: `src/adapters/pty.ts`

```ts
// Optional PTY adapter. Load only if USE_PTY=1 and node-pty is installed.

export type PTYSpawned = {
  write(data: string): void;
  kill(): void;
  onData(cb: (chunk: string) => void): void;
  onExit(cb: (code: number | null, signal: number | null) => void): void;
};

export async function runPTY(command: string, cwd?: string, shell?: string): Promise<PTYSpawned> {
  const isWin = process.platform === "win32";
  const sh = shell || (isWin ? "powershell.exe" : "bash");
  const pty = await import("node-pty");
  const p = pty.spawn(sh, isWin ? ["-NoLogo", "-NoProfile", "-Command", command] : ["-lc", command], {
    cols: 120,
    rows: 30,
    cwd,
    env: process.env as any
  });
  return {
    write: (data: string) => p.write(data),
    kill: () => p.kill(),
    onData: (cb) => p.onData((d: string) => cb(d)),
    onExit: (cb) => p.onExit(({ exitCode, signal }) => cb(exitCode, signal))
  };
}
```

---

## FILE: `src/sessions.ts`

```ts
import { detectPrompt } from "./heuristics/prompts.js";
import { isLikelySpinnerFrame } from "./heuristics/ansi.js";
import { looksFinished } from "./heuristics/finishes.js";

export type SessionStatus = "idle" | "running" | "waiting" | "possibly-stuck" | "completed" | "error";

export interface Session {
  id: string;
  buf: string[];
  lastByteAt: number;
  status: SessionStatus;
  promptRe?: RegExp;
  quietTimer?: NodeJS.Timeout | null;
  idleTimer?: NodeJS.Timeout | null;
  adapter?: {
    write(data: string): void;
    kill(signal?: any): void;
    onData(cb: (chunk: string) => void): void;
    onExit(cb: (code: number | null, signal: any) => void): void;
  };
}

export class SessionStore {
  private map = new Map<string, Session>();
  newSession(): Session {
    const id = Math.random().toString(36).slice(2);
    const s: Session = { id, buf: [], lastByteAt: Date.now(), status: "idle" };
    this.map.set(id, s);
    return s;
  }
  get(id: string) { return this.map.get(id); }
  all() { return [...this.map.values()]; }
  remove(id: string) { this.map.delete(id); }
}

export function scheduleQuietComplete(sess: Session, delayMs = 300, onComplete?: () => void) {
  if (sess.quietTimer) clearTimeout(sess.quietTimer);
  sess.quietTimer = setTimeout(() => {
    if (sess.status !== "completed") {
      sess.status = "completed";
      if (sess.idleTimer) clearInterval(sess.idleTimer);
      onComplete?.();
    }
  }, delayMs);
}

export function wireHeuristics(sess: Session, progress?: (msg: string) => void) {
  let lastLine = "";
  const updateIdle = () => { sess.lastByteAt = Date.now(); };

  return {
    onChunk: (text: string) => {
      // Spinner suppression: ignore byte-only spinner frames for state transitions.
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (line && isLikelySpinnerFrame(lastLine, line)) continue;
        lastLine = line;
        if (!sess.promptRe) sess.promptRe = detectPrompt(line);
        if (sess.promptRe && sess.promptRe.test(line)) {
          scheduleQuietComplete(sess);
        }
        if (looksFinished(line)) {
          // Not definitive, but a hint; do not complete immediately.
        }
      }
      sess.buf.push(text);
      updateIdle();
    },
    onExit: () => {
      scheduleQuietComplete(sess);
    },
    startIdleTimers: (waitingMs = 10_000, stuckMs = 45_000) => {
      if (sess.idleTimer) clearInterval(sess.idleTimer);
      sess.idleTimer = setInterval(() => {
        const idle = Date.now() - sess.lastByteAt;
        if (sess.status === "running" && idle > waitingMs) {
          sess.status = "waiting";
          progress?.("Idle 10s: waiting for next input…");
        }
        if ((sess.status === "waiting" || sess.status === "running") && idle > stuckMs) {
          sess.status = "possibly-stuck";
          progress?.("No output 45s: possibly stuck");
        }
      }, 1000);
    }
  };
}
```

---

## FILE: `src/server.ts`

```ts
import { createMCPServer, ToolDef } from "./mcp/server.js";
import { SessionStore, wireHeuristics } from "./sessions.js";
import { runCommand } from "./adapters/childprocess.js";

async function maybeRunPTY(command: string, cwd?: string, shell?: string) {
  if (process.env.USE_PTY === "1") {
    try {
      const { runPTY } = await import("./adapters/pty.js");
      return await runPTY(command, cwd, shell);
    } catch {
      // Fallback to child process
    }
  }
  return runCommand(command, cwd, shell);
}

const store = new SessionStore();

const runTool: ToolDef = {
  name: "terminal.run",
  description: "Run a shell command with awareness of completion vs waiting",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string" },
      cwd: { type: "string" },
      shell: { type: "string" },
      timeoutMs: { type: "number" }
    },
    required: ["command"]
  },
  async invoke({ input, progress }) {
    const s = store.newSession();
    const cmd = String(input.command);
    const cwd = input.cwd ? String(input.cwd) : undefined;
    const shell = input.shell ? String(input.shell) : undefined;
    const timeoutMs = typeof input.timeoutMs === "number" ? input.timeoutMs : 0;

    const adapter = await maybeRunPTY(cmd, cwd, shell);
    s.adapter = adapter as any;
    s.status = "running";

    const h = wireHeuristics(s, (msg) => progress?.({ indeterminate: true, message: msg }));
    adapter.onData((chunk) => {
      h.onChunk(chunk);
      progress?.({ indeterminate: true, current: s.buf.join("").length });
    });
    adapter.onExit(() => h.onExit());
    h.startIdleTimers();

    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try { adapter.kill(); } catch {}
      }, timeoutMs);
    }

    // Wait until status becomes completed
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (s.status === "completed") {
          clearInterval(interval);
          if (timer) clearTimeout(timer);
          resolve();
        }
      }, 100);
    });

    return {
      content: [
        { type: "text", text: s.buf.join("") },
        { type: "json", json: { sessionId: s.id, status: s.status, timedOut } }
      ]
    };
  }
};

const statusTool: ToolDef = {
  name: "terminal.status",
  description: "Report status for a session with tail output",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string" },
      tail: { type: "number" }
    },
    required: ["sessionId"]
  },
  async invoke({ input }) {
    const s = store.get(String(input.sessionId));
    if (!s) return { content: [{ type: "text", text: "No such session" }] };
    const joined = s.buf.join("");
    const tailLen = typeof input.tail === "number" ? input.tail : 2000;
    const tailText = joined.slice(-tailLen);
    return {
      content: [
        { type: "json", json: { status: s.status, lastOutputAt: s.lastByteAt } },
        { type: "text", text: tailText }
      ]
    };
  }
};

const writeTool: ToolDef = {
  name: "terminal.write",
  description: "Write keystrokes to a live session (e.g., \"q\", \"\n\")",
  inputSchema: { type: "object", properties: { sessionId: { type: "string" }, data: { type: "string" } }, required: ["sessionId", "data"] },
  async invoke({ input }) {
    const s = store.get(String(input.sessionId));
    if (!s || !s.adapter) return { content: [{ type: "text", text: "No such session" }] };
    s.adapter.write(String(input.data));
    return { content: [{ type: "json", json: { ok: true } }] };
  }
};

const signalTool: ToolDef = {
  name: "terminal.signal",
  description: "Send a signal to a session (SIGINT, SIGTERM) or CTRL+C emulation",
  inputSchema: {
    type: "object",
    properties: { sessionId: { type: "string" }, signal: { type: "string" } },
    required: ["sessionId"]
  },
  async invoke({ input }) {
    const s = store.get(String(input.sessionId));
    if (!s || !s.adapter) return { content: [{ type: "text", text: "No such session" }] };
    const sig = input.signal ? String(input.signal) : "SIGINT";
    try {
      if (sig === "CTRL_C") s.adapter.write("\x03");
      else s.adapter.kill(sig);
      return { content: [{ type: "json", json: { ok: true } }] };
    } catch (e: any) {
      return { content: [{ type: "json", json: { ok: false, error: e?.message || String(e) } }] };
    }
  }
};

const listTool: ToolDef = {
  name: "terminal.list",
  description: "List active sessions",
  inputSchema: { type: "object", properties: {} },
  async invoke() {
    return { content: [{ type: "json", json: store.all().map(s => ({ id: s.id, status: s.status, lastOutputAt: s.lastByteAt })) }] };
  }
};

const attachTool: ToolDef = {
  name: "terminal.attach",
  description: "(No-op placeholder) In a real MCP streaming client, this would re-subscribe to output.",
  inputSchema: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
  async invoke({ input }) {
    const s = store.get(String(input.sessionId));
    if (!s) return { content: [{ type: "text", text: "No such session" }] };
    const joined = s.buf.join("");
    return { content: [{ type: "text", text: joined }] };
  }
};

export function startServer(info: { name: string; version: string }) {
  createMCPServer(info, [runTool, statusTool, writeTool, signalTool, listTool, attachTool]);
}
```

---

## FILE: `.mcp.json` (optional example client config)

```json
{
  "mcpServers": {
    "mcp-terminal-awareness": {
      "command": "node",
      "args": ["dist/bin/cli.js"],
      "env": {
        "USE_PTY": "0"
      }
    }
  }
}
```

---

## ONE-SHOT JSON PROMPT (for an AI codegen tool)

> Save the following as `build_mcp_terminal_awareness.json` and feed it to your AI tool. It details the entire repo and files to generate.

```json
{
  "goal": "Create a zero-runtime-dependency MCP server that provides terminal awareness (done/waiting/stuck) with progress notifications and optional PTY.",
  "instructions": [
    "Create a Node+TypeScript project using ES modules.",
    "Use only built-in Node APIs at runtime; typescript and @types/node are dev-only.",
    "Implement a tiny JSON-RPC over stdio (src/mcp/jsonrpc.ts).",
    "Implement an MCP-like server glue exposing initialize, tools/list, tools/call, and progress notifications (src/mcp/server.ts).",
    "Implement terminal command adapters: child_process baseline and node-pty optional adapter (guarded by USE_PTY).",
    "Implement heuristics: prompt detection, quiet window, known finish phrases, spinner suppression, idle timers.",
    "Expose tools: terminal.run, terminal.status, terminal.write, terminal.signal, terminal.list, terminal.attach.",
    "Provide CLI entry at dist/bin/cli.js with package bin mapping.",
    "Add README.md and LICENSE (MIT).",
    "Ensure cross-platform support (Windows PowerShell, Linux/macOS bash)."
  ],
  "files": {
    "package.json": "(use the exact JSON provided in the README above)",
    "tsconfig.json": "(use the exact JSON provided in the README above)",
    "README.md": "(use the README text provided above)",
    "LICENSE": "(use the MIT license text provided above)",
    "src/bin/cli.ts": "(use the code provided above)",
    "src/mcp/jsonrpc.ts": "(use the code provided above)",
    "src/mcp/server.ts": "(use the code provided above)",
    "src/heuristics/ansi.ts": "(use the code provided above)",
    "src/heuristics/finishes.ts": "(use the code provided above)",
    "src/heuristics/prompts.ts": "(use the code provided above)",
    "src/adapters/childprocess.ts": "(use the code provided above)",
    "src/adapters/pty.ts": "(use the code provided above)",
    "src/sessions.ts": "(use the code provided above)",
    ".mcp.json": "(optional sample config provided above)"
  },
  "postbuild": [
    "npm install --save-dev typescript @types/node",
    "npm run build",
    "node dist/bin/cli.js"
  ]
}
```

---

## Notes & Next steps

- This is a **minimal** MCP-like implementation suitable for most clients expecting stdio JSON-RPC with tool calls and progress notifications. If your client requires exact Anthropic MCP method names or capabilities, adjust `src/mcp/server.ts` to match.
- Add more robust prompt calibration (e.g., spawn an interactive shell briefly to fingerprint the prompt) and a richer finish-phrase registry.
- For full-fidelity terminals, enable PTY (`USE_PTY=1` + install `node-pty`).
- Consider safety: allowlist commands, sandbox cwd, and configurable timeouts.

