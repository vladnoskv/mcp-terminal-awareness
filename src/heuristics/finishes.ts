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
