import { AuthError } from './service.mjs';
function reply(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}
async function body(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw Object.assign(new Error(), { status: 415 });
  if (Number(request.headers['content-length']) > 4096) { request.resume(); throw Object.assign(new Error(), { status: 413 }); }
  const chunks = []; let size = 0;
  request.setTimeout(5000, () => request.destroy());
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 4096) throw Object.assign(new Error(), { status: 413 });
      chunks.push(chunk);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result;
  } catch (error) { throw Object.assign(new Error(), { status: error.status || 400 }); }
  finally { request.setTimeout(0); }
}
export function authHttp(auth, origins) {
  const attempts = new Map(); let active = 0;
  return async (request, response) => {
    if (!request.url?.startsWith('/api/')) return false;
    const origin = request.headers.origin;
    if (origin && !origins.includes(origin)) { reply(response, 403, { error: 'Forbidden' }); return true; }
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Cache-Control': 'no-store' }); response.end(); return true;
    }
    const route = `${request.method} ${request.url}`;
    if (!['POST /api/auth/login','POST /api/auth/refresh','POST /api/auth/logout','GET /api/me'].includes(route)) { reply(response,404,{ error:'Not found' }); return true; }
    try {
      if (active >= 4) throw new AuthError(429);
      const now = Date.now(), ip = request.socket.remoteAddress;
      for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
      const entry = attempts.get(ip) || { count: 0, until: now + 60000 };
      if ((!attempts.has(ip) && attempts.size >= 1000) || ++entry.count > 30) throw new AuthError(429);
      attempts.set(ip, entry); active++;
      try {
        let result;
        if (route === 'POST /api/auth/login') { const data = await body(request); result = await auth.login(data.email, data.password); }
        else if (route === 'POST /api/auth/refresh') { const data = await body(request); result = await auth.refresh(data.refreshToken); }
        else {
          const header = request.headers.authorization;
          if (typeof header !== 'string' || !/^Bearer [^ ]+$/.test(header)) throw new AuthError();
          const identity = await auth.authenticate(header.slice(7));
          result = route === 'GET /api/me' ? await auth.me(identity) : (await auth.logout(identity), { ok: true });
        }
        reply(response, 200, result);
      } finally { active--; }
    } catch (error) {
      const status = [400,401,403,413,415,429].includes(error.status) ? error.status : 503;
      reply(response, status, { error: status === 503 ? 'Authentication service unavailable' : status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : status === 429 ? 'Too many requests' : 'Invalid request' });
    }
    return true;
  };
}
