import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PERF_DATABASE } from './perfDatabase';

/** The Docker SDK root this repo sits in; the perf scripts talk to its `mysql` service. */
const SDK_DIR = process.env.SDK_DIR ?? resolve(import.meta.dirname, '../../../..');

function compose(args: string[], input?: string): string {
  return execFileSync('docker', ['compose', '--project-directory', SDK_DIR, ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Runs SQL in the perf database as root; returns the tab-separated result without headers.
 * `--comments`: the client strips them by default, and the probes are found by their comment marker.
 */
export function runSql(sql: string): string {
  return compose(
    ['exec', '-T', 'mysql', 'mysql', '-uroot', '-proot', '-N', '-B', '--comments', PERF_DATABASE],
    sql,
  );
}

/**
 * Copies a host directory into the MySQL container, where LOAD DATA may read it (`secure_file_priv`).
 * mysqld runs as the SDK's host uid, not the image's `mysql` user: the files go to the datadir's owner.
 */
export function copyIntoMysql(hostDir: string, containerDir: string): void {
  const asRoot = ['exec', '-T', '-u', 'root', 'mysql', 'sh', '-c'];
  compose([...asRoot, `rm -rf ${containerDir}`]);
  compose(['cp', hostDir, `mysql:${containerDir}`]);
  compose([...asRoot, 'chown -R "$(stat -c %u:%g /var/lib/mysql)" /var/lib/mysql-files']);
}

export function timed<T>(work: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = work();
  return { result, ms: Math.round(performance.now() - start) };
}
