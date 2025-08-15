import { spawn } from "node:child_process";
import { EOL } from "node:os";

export type Spawned = {
  write(data: string): void;
  kill(signal?: NodeJS.Signals | number): void;
  onData(cb: (chunk: string) => void): void;
  onExit(cb: (code: number | null, signal: NodeJS.Signals | null) => void): void;
};

export function runCommand(command: string, cwd?: string, shell?: string, env?: Record<string, string>): Spawned {
  const isWin = process.platform === "win32";
  const sh = shell || (isWin ? "powershell" : "bash");
  const args = isWin ? ["-NoLogo", "-NoProfile", "-Command", command]
                     : ["-lc", command];
  const child = spawn(sh, args, { cwd, env: { ...(process.env as any), ...(env || {}) } });

  return {
    // Write raw data; callers should include "\n" if they intend to send Enter
    write: (data: string) => child.stdin?.write(data),
    kill: (signal?: any) => child.kill(signal),
    onData: (cb) => {
      child.stdout?.on("data", (b: Buffer) => cb(b.toString("utf8")));
      child.stderr?.on("data", (b: Buffer) => cb(b.toString("utf8")));
    },
    onExit: (cb) => child.on("exit", (code, sig) => cb(code, sig as any))
  };
}
