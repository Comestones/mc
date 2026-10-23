import { createRequire } from 'node:module';
import { once } from 'node:events';
const requireSync = createRequire(new URL('../../../mc_sync/package.json', import.meta.url));
const { WebSocket, WebSocketServer } = requireSync('ws');
/** Ordered, deterministic application-frame faults. This is not a TCP packet emulator. */
export async function createFaultRelay(target, seed = 2101) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: 1024 * 1024 });
  await once(server, 'listening');
  const pairs = new Set(), stats = { accepted: 0, forwarded: 0, dropped: 0, peakQueuedBytes: 0 };
  let fault = { delayMs: 0, jitterMs: 0, dropEvery: 0, blackhole: false }, sequence = 0, random = seed >>> 0, stopped = false;
  const next = () => { random = (Math.imul(1664525, random) + 1013904223) >>> 0; return random / 4294967296; };
  server.on('connection', downstream => {
    stats.accepted++;
    const upstream = new WebSocket(target), lanes = [], pair = { downstream, upstream, lanes };
    pairs.add(pair);
    function lane(from, to) {
      const queue = []; let timer, bytes = 0;
      const clear = () => { clearTimeout(timer); timer = undefined; queue.length = 0; bytes = 0; };
      lanes.push({ clear });
      function drain() {
        clearTimeout(timer); timer = undefined;
        if (!queue.length || to.readyState !== WebSocket.OPEN) return;
        const wait = queue[0].at - Date.now();
        if (wait > 0) { timer = setTimeout(drain, wait); return; }
        const item = queue.shift(); bytes -= item.data.length;
        to.send(item.data, { binary: item.binary }, () => {}); stats.forwarded++; drain();
      }
      to.on('open', drain);
      from.on('message', (data, binary) => {
        sequence++;
        if (fault.blackhole || fault.dropEvery && sequence % fault.dropEvery === 0) { stats.dropped++; return; }
        const at = Math.max(queue.at(-1)?.at ?? 0, Date.now() + fault.delayMs + Math.floor(next() * fault.jitterMs));
        bytes += data.length; stats.peakQueuedBytes = Math.max(stats.peakQueuedBytes, bytes);
        if (bytes > 8 * 1024 * 1024) { downstream.close(1013, 'test relay capacity'); upstream.terminate(); clear(); return; }
        queue.push({ data: Buffer.from(data), binary, at }); drain();
      });
    }
    lane(downstream, upstream); lane(upstream, downstream);
    const terminate = () => { for (const entry of lanes) entry.clear(); pairs.delete(pair); if (downstream.readyState < 2) downstream.terminate(); if (upstream.readyState < 2) upstream.terminate(); };
    downstream.on('error', () => {}); upstream.on('error', terminate);
    downstream.on('close', terminate); upstream.on('close', terminate);
  });
  return {
    url: `ws://127.0.0.1:${server.address().port}`,
    setFaults(next) { fault = { delayMs: 0, jitterMs: 0, dropEvery: 0, blackhole: false, ...next }; },
    metrics() { return { ...stats, activeConnections: pairs.size }; },
    cut() { for (const pair of Array.from(pairs)) { for (const entry of pair.lanes) entry.clear(); pair.downstream.terminate(); pair.upstream.terminate(); } },
    async close() { if (stopped) return; stopped = true; this.cut(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}
