// MVP persistence: one JSON file, written atomically. Fine for a pilot with a handful of users on a
// server with a persistent disk. NOT suitable for serverless hosts with ephemeral disks, and not for
// scale or concurrency. The next step is the Supabase repository (docs/slices/02-supabase.md).
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function dataFilePath(): string {
  return resolve(process.env.PX_DATA_FILE || '.data/db.json');
}

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  if (!raw.trim()) return null;
  return JSON.parse(raw) as T;
}

export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, path);
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best effort on platforms without POSIX modes */
  }
}
