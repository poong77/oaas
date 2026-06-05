/**
 * 대칭키 암호화 유틸 (AES-256-GCM).
 *
 * 용도: 호텔 솔루션 로그인 비밀번호 등 "복호화가 필요한" 민감 정보 저장.
 *       (로그인 비밀번호는 bcrypt 단방향 해시 — 이쪽이 아님.)
 *
 * 키 우선순위:
 *   1) ENCRYPTION_KEY — 32바이트 키 (hex 64자 또는 base64). 운영 권장.
 *   2) 미설정 시 NEXTAUTH_SECRET 에서 SHA-256 파생 (dev graceful degrade).
 *
 * 저장 포맷: `v1:<ivB64>:<tagB64>:<cipherB64>`
 */

import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const PREFIX = 'v1';
const ALGO = 'aes-256-gcm';

/** 32바이트 키 도출. */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? '';
  if (raw) {
    // hex(64자) 우선, 아니면 base64, 그래도 길이가 안 맞으면 SHA-256으로 정규화.
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
    return createHash('sha256').update(raw).digest();
  }
  const fallback = process.env.NEXTAUTH_SECRET ?? '';
  if (!fallback) {
    throw new Error(
      'ENCRYPTION_KEY 또는 NEXTAUTH_SECRET 가 설정되지 않아 암호화할 수 없습니다.',
    );
  }
  return createHash('sha256').update(`hotel-secret:${fallback}`).digest();
}

/** 평문 → 저장용 암호문 문자열. */
export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

/**
 * 저장용 암호문 → 평문. 복호화 실패 시 null (키 교체/손상 대비).
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  try {
    const key = getKey();
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const data = Buffer.from(parts[3], 'base64');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

/** 암호화 키 사용 가능 여부 (UI에서 PW 입력 가능 여부 안내용). */
export function isSecretCryptoConfigured(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET);
}
