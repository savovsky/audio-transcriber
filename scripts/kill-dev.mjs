// Frees the dev ports (3000 client, 3001 server) — `npm run kill:dev`.
// Kills the LISTENING process TREES plus any lurking `tsx watch` / `concurrently`
// parents for THIS project: a surviving watcher respawns its server on the next
// file change and silently re-takes port 3001 (the recurring EADDRINUSE cause).
// Windows-only (netstat + taskkill + PowerShell process scan); other platforms
// get a one-line equivalent printed instead.

import { execSync } from 'node:child_process';

const PORTS = [3000, 3001];

if (process.platform !== 'win32') {
  console.log('kill:dev is Windows-only. Equivalent: lsof -ti :3000,:3001 | xargs kill');
  process.exit(0);
}

const pids = new Set();

// 1. Whoever LISTENS on the dev ports.
const netstat = execSync('netstat -ano', { encoding: 'utf8' });
for (const line of netstat.split('\n')) {
  if (!line.includes('LISTENING')) continue;
  if (!PORTS.some((port) => line.includes(`:${port} `))) continue;
  const parts = line.trim().split(/\s+/);
  pids.add(parts[parts.length - 1]);
}

// 2. tsx watch / concurrently processes for this project (they hold no port but
// respawn the server — killing only listeners is whack-a-mole).
const psQuery =
  'Get-CimInstance Win32_Process | ' +
  "Where-Object { $_.CommandLine -match 'audio-transcriber' -and $_.CommandLine -match 'tsx|concurrently' } | " +
  'Select-Object -ExpandProperty ProcessId';
const watchers = execSync(`powershell -NoProfile -Command "${psQuery}"`, { encoding: 'utf8' });
for (const line of watchers.split(/\r?\n/)) {
  const pid = line.trim();
  if (/^\d+$/.test(pid)) pids.add(pid);
}

if (pids.size === 0) {
  console.log('Nothing to kill — ports 3000/3001 are free and no watchers are running.');
  process.exit(0);
}

for (const pid of pids) {
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'pipe' });
    console.log(`killed process tree of PID ${pid}`);
  } catch {
    // Already gone (a parent kill took the tree first) — fine.
  }
}
console.log('Done. Start fresh with: npm run dev');
