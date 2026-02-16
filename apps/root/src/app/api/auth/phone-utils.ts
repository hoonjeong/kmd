import { createHmac } from 'crypto';

interface VerifyEntry {
  code: string;
  expires: number;
}

// globalThis에 저장하여 HMR/모듈 재로드 시에도 유지
const globalForVerify = globalThis as typeof globalThis & {
  __phoneVerifyMap?: Map<string, VerifyEntry>;
};

if (!globalForVerify.__phoneVerifyMap) {
  globalForVerify.__phoneVerifyMap = new Map<string, VerifyEntry>();
}

export const verifyMap = globalForVerify.__phoneVerifyMap;

// Cleanup expired entries periodically
if (typeof setInterval !== 'undefined' && !(globalThis as Record<string, unknown>).__phoneVerifyCleanup) {
  (globalThis as Record<string, unknown>).__phoneVerifyCleanup = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of verifyMap) {
      if (entry.expires < now) verifyMap.delete(key);
    }
  }, 60_000);
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET or NEXTAUTH_SECRET must be set');
  return secret;
}

export function createPhoneToken(phone: string): string {
  const normalized = phone.replace(/-/g, '');
  const timestamp = Date.now();
  const payload = `${normalized}:${timestamp}`;
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

export function verifyPhoneToken(token: string, phone: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;

    const [tokenPhone, timestamp, hmac] = parts;
    const normalized = phone.replace(/-/g, '');

    if (tokenPhone !== normalized) return false;

    // Token valid for 10 minutes
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > 10 * 60 * 1000 || age < 0) return false;

    const expected = createHmac('sha256', getSecret())
      .update(`${tokenPhone}:${timestamp}`)
      .digest('hex');

    return hmac === expected;
  } catch {
    return false;
  }
}
