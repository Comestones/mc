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
  async function cleanup() {
    const target = path.resolve(directory);
    if (path.dirname(target) !== parent || !path.basename(target).startsWith('mc-day19-')) throw new Error('Refusing cleanup outside test directory');
    await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
  try { await postgres.initialise(); await postgres.start(); }
  catch (error) { await postgres.stop(); await cleanup(); throw error; }
  return { postgres, url: `postgresql://mc_test:${password}@127.0.0.1:${port}/postgres`,
    async stop() {
      await postgres.stop();
      await cleanup();
    } };
}
