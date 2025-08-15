// Optional PTY adapter. Load only if USE_PTY=1 and node-pty is installed.

export type PTYSpawned = {
  write(data: string): void;
  kill(): void;
  onData(cb: (chunk: string) => void): void;
  onExit(cb: (code: number | null, signal: number | null) => void): void;
};

export async function runPTY(command: string, cwd?: string, shell?: string, env?: Record<string, string>): Promise<PTYSpawned> {
  const isWin = process.platform === "win32";
  const sh = shell || (isWin ? "powershell.exe" : "bash");
  const ptyMod: any = await import("node-pty");
  const spawn: any = (ptyMod && (ptyMod as any).spawn) ? (ptyMod as any).spawn : (ptyMod as any).default?.spawn;
  const p: any = spawn(sh, isWin ? ["-NoLogo", "-NoProfile", "-Command", command] : ["-lc", command], {
    cols: 120,
    rows: 30,
    cwd,
    env: { ...(process.env as any), ...(env || {}) }
  });
  return {
    write: (data: string) => p.write(data),
    kill: () => p.kill(),
    onData: (cb) => p.onData((d: string) => cb(d)),
    onExit: (cb) => p.onExit((evt: any) => cb(evt?.exitCode ?? null, evt?.signal ?? null))
  };
}
