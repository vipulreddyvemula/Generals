import crypto from 'crypto';
import Player from './player';

const RECONNECT_TOKEN_BYTES = 32;

export interface ReconnectCredential {
  token: string;
  tokenHash: string;
}

export type ReconnectAuthorization =
  | { ok: true }
  | { ok: false; reason: 'INVALID_CREDENTIALS' | 'DUPLICATE_SESSION' | 'GRACE_EXPIRED' };

export function hashReconnectToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createReconnectCredential(): ReconnectCredential {
  const token = crypto.randomBytes(RECONNECT_TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashReconnectToken(token) };
}

export function verifyReconnectToken(expectedHash: string, token: string): boolean {
  if (!expectedHash || !token) return false;
  const actualHash = hashReconnectToken(token);
  const expected = Uint8Array.from(Buffer.from(expectedHash, 'hex'));
  const actual = Uint8Array.from(Buffer.from(actualHash, 'hex'));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function authorizeReconnect(
  player: Player,
  token: string,
  activeSocketConnected: boolean,
  now = Date.now()
): ReconnectAuthorization {
  if (!verifyReconnectToken(player.sessionTokenHash, token)) {
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }
  if (!player.disconnected || activeSocketConnected) {
    return { ok: false, reason: 'DUPLICATE_SESSION' };
  }
  if (player.disconnectGraceExpiresAt === null || player.disconnectGraceExpiresAt <= now) {
    return { ok: false, reason: 'GRACE_EXPIRED' };
  }
  return { ok: true };
}
