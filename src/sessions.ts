import { detectPrompt } from "./heuristics/prompts.js";
import { isLikelySpinnerFrame } from "./heuristics/ansi.js";
import { looksFinished } from "./heuristics/finishes.js";

export type SessionStatus = "idle" | "running" | "waiting" | "possibly-stuck" | "completed" | "error";

export interface Session {
  id: string;
  buf: string[];
  lastByteAt: number;
  status: SessionStatus;
  errorReason?: string;
  promptRe?: RegExp;
  quietTimer?: NodeJS.Timeout | null;
  idleTimer?: NodeJS.Timeout | null;
  // Exit information if/when the process ends
  exitCode?: number | null;
  exitSignal?: any;
  // Buffer management
  totalBytes?: number; // total UTF-8 bytes in buf
  maxBufferBytes?: number; // soft limit; older chunks trimmed when exceeded
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
    const s: Session = { id, buf: [], lastByteAt: Date.now(), status: "idle", totalBytes: 0, maxBufferBytes: 2_000_000 };
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
    if (sess.status !== "completed" && sess.status !== "error") {
      sess.status = "completed";
      if (sess.idleTimer) clearInterval(sess.idleTimer);
      onComplete?.();
    }
  }, delayMs);
}

export interface HeuristicOptions {
  quietMs?: number; // default 300ms
  waitingMs?: number; // default 10000ms
  stuckMs?: number; // default 45000ms
  maxBufferBytes?: number; // default from session
}

export function wireHeuristics(sess: Session, progress?: (msg: string) => void, opts?: HeuristicOptions) {
  let lastLine = "";
  const updateIdle = () => { sess.lastByteAt = Date.now(); };
  const quietMs = opts?.quietMs ?? 300;
  const waitingMs = opts?.waitingMs ?? 10_000;
  const stuckMs = opts?.stuckMs ?? 45_000;
  if (opts?.maxBufferBytes) sess.maxBufferBytes = opts.maxBufferBytes;

  return {
    onChunk: (text: string) => {
      // Spinner suppression: ignore byte-only spinner frames for state transitions.
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (line && isLikelySpinnerFrame(lastLine, line)) continue;
        lastLine = line;
        if (!sess.promptRe) sess.promptRe = detectPrompt(line);
        if (sess.promptRe && sess.promptRe.test(line)) {
          scheduleQuietComplete(sess, quietMs);
        }
        if (looksFinished(line)) {
          // Not definitive, but a hint; do not complete immediately.
        }
      }
      // Append and trim buffer by maxBufferBytes
      sess.buf.push(text);
      const addBytes = Buffer.byteLength(text, "utf8");
      sess.totalBytes = (sess.totalBytes || 0) + addBytes;
      const cap = sess.maxBufferBytes || 2_000_000;
      while ((sess.totalBytes || 0) > cap && sess.buf.length > 1) {
        const removed = sess.buf.shift()!;
        const removedBytes = Buffer.byteLength(removed, "utf8");
        sess.totalBytes = (sess.totalBytes || 0) - removedBytes;
      }
      updateIdle();
    },
    onExit: () => {
      // Default quiet completion on exit (caller may set status prior)
      scheduleQuietComplete(sess, quietMs);
    },
    startIdleTimers: (waitingMsParam = waitingMs, stuckMsParam = stuckMs) => {
      if (sess.idleTimer) clearInterval(sess.idleTimer);
      sess.idleTimer = setInterval(() => {
        const idle = Date.now() - sess.lastByteAt;
        if (sess.status === "running" && idle > waitingMsParam) {
          sess.status = "waiting";
          progress?.(`Idle ${Math.round(waitingMsParam/1000)}s: waiting for next input…`);
        }
        if ((sess.status === "waiting" || sess.status === "running") && idle > stuckMsParam) {
          sess.status = "possibly-stuck";
          progress?.(`No output ${Math.round(stuckMsParam/1000)}s: possibly stuck`);
        }
      }, 1000);
    }
  };
}
