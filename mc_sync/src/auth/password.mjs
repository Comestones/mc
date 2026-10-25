import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 1024) throw new Error('Password must contain at least 12 characters and at most 1024 bytes');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 32, parameters);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  const valid = parts.length === 3 && parts[0] === 'scrypt-v1' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{64}$/.test(parts[2]);
  if (typeof password !== 'string' || Buffer.byteLength(password) > 1024) return false;
  // Missing users take the same expensive path, without accepting a dummy password.
  const key = await derive(password, valid ? parts[1] : '0'.repeat(32), 32, parameters);
  return timingSafeEqual(key, Buffer.from(valid ? parts[2] : '0'.repeat(64), 'hex')) && valid;
}
