import crypto from 'crypto';
import { config } from '../config';

type EncodedPayload = string;

const STATE_TTL_MS = 10 * 60 * 1000;

const signPayload = (payload: EncodedPayload) => {
  return crypto.createHmac('sha256', config.strava.clientSecret).update(payload).digest('base64url');
};

const encodePayload = (payload: { nonce: string; issuedAt: number }): EncodedPayload => {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
};

const decodePayload = (encoded: EncodedPayload) => {
  const json = Buffer.from(encoded, 'base64url').toString('utf8');
  return JSON.parse(json) as { nonce: string; issuedAt: number };
};

const safeCompare = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const createStateToken = () => {
  const payload = encodePayload({
    nonce: crypto.randomBytes(16).toString('hex'),
    issuedAt: Date.now()
  });
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
};

export const verifyStateToken = (token: string) => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = signPayload(payload);
  if (!safeCompare(signature, expectedSignature)) {
    return false;
  }

  try {
    const { issuedAt } = decodePayload(payload);
    if (!issuedAt || Date.now() - issuedAt > STATE_TTL_MS) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
};
