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
