// Compact gate runner for LLM workhorse sessions (ported from openrebar 2026-10-14).
// Runs cached lint → incremental tsc → the full vitest suite. Full output lands in
// .gates/<name>.log; stdout stays one line per gate so gate noise does not accumulate
// in the session context (every context token is re-billed on every turn).
// On failure, prints only the tail of the failing log — read .gates/<name>.log for more.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOGS_DIR = join(process.cwd(), '.gates');
const TAIL_LINES = 40;

/** @type {{ name: string, command: string }[]} */
const gates = [
  { name: 'lint', command: 'npm run lint' },
  { name: 'tsc', command: 'npm run tsc' },
  { name: 'test', command: 'npm run test -- --reporter=dot' },
];

mkdirSync(LOGS_DIR, { recursive: true });

let failed = false;
for (const gate of gates) {
  const started = Date.now();
  const result = spawnSync(gate.command, { shell: true, encoding: 'utf8' });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  writeFileSync(join(LOGS_DIR, `${gate.name}.log`), output);

  if (result.status === 0) {
    console.log(`✓ ${gate.name} (${seconds}s)${gate.name === 'test' ? testSummary(output) : ''}`);
  } else {
    failed = true;
    console.error(`✗ ${gate.name} FAILED (${seconds}s) — full log: .gates/${gate.name}.log`);
    console.error(output.trimEnd().split('\n').slice(-TAIL_LINES).join('\n'));
  }
}

process.exit(failed ? 1 : 0);

/** Pull the vitest "Test Files / Tests" counts into the one-line summary. */
function testSummary(output) {
  const files = output.match(/Test Files\s+(.+)/);
  const tests = output.match(/^\s*Tests\s+(.+)/m);
  const parts = [files?.[1], tests?.[1]].filter(Boolean);
  return parts.length > 0 ? ` — ${parts.join(', ')}` : '';
}
