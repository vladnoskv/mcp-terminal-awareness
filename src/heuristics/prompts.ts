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
