import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
export async function startTestPostgres() {
  const parent = path.resolve(tmpdir()), directory = await mkdtemp(path.join(parent, 'mc-day19-'));
  const port = await new Promise((resolve, reject) => {
    const socket = net.createServer(); socket.on('error', reject); socket.listen(0, '127.0.0.1', () => { const { port } = socket.address(); socket.close(() => resolve(port)); });
  });
  const password = randomBytes(18).toString('hex');
  const postgres = new EmbeddedPostgres({ databaseDir: directory, user: 'mc_test', password, port, persistent: true,
    initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1', '-c', 'max_connections=30'], onLog: () => {}, onError: () => {} });
  // pg_ctl waits for the cluster and its workers; Windows taskkill can leave inherited
  // worker pipes open. Clear the runner handle after confirmed exit (its exit hook
  // otherwise waits for an exit event that has already happened).
  async function stopCluster(mode = 'fast') {
    const child = postgres.process;
    if (!child) return;
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      const platform = process.platform === 'win32' ? 'windows' : process.platform;
      const { pg_ctl } = await import(`@embedded-postgres/${platform}-${process.arch}`);
      await promisify(execFile)(pg_ctl, ['stop', '-D', directory, '-m', mode, '-w', '-t', '10'], { timeout: 15000, windowsHide: true });
      await exited;
    }
    child.stdout?.destroy(); child.stderr?.destroy();
    postgres.process = undefined;
  }
  async function cleanup() {
    const target = path.resolve(directory);
    if (path.dirname(target) !== parent || !path.basename(target).startsWith('mc-day19-')) throw new Error('Refusing cleanup outside test directory');
    await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
  try { await postgres.initialise(); await postgres.start(); }
  catch (error) { await stopCluster(); await cleanup(); throw error; }
  return { postgres: { start: () => postgres.start(), stop: () => stopCluster('immediate') }, url: `postgresql://mc_test:${password}@127.0.0.1:${port}/postgres`,
    async stop() {
      await stopCluster();
      await cleanup();
    } };
}
