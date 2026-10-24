import 'server-only';
import crypto from 'node:crypto';

function key(): Buffer {
  const secret =
    process.env.SECRETS_ENCRYPTION_KEY ||
    (process.env.NODE_ENV !== 'production' ? 'vigna-dev-only-key' : '');
  if (!secret) throw new Error('SECRETS_ENCRYPTION_KEY is not set');
  return crypto.createHash('sha256').update(secret).digest();
}

/** AES-256-GCM. Output: iv.tag.ciphertext (base64 parts). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
