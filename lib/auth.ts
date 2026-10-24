import 'server-only';
import crypto from 'node:crypto';

/**
 * Minimal staff gate for the demo: shared passcode in the `x-staff-key` header.
 * Swap for Supabase Auth (per-hotel staff users + RLS) before going live.
 */
export function isStaff(req: Request): boolean {
  const expected =
    process.env.STAFF_PASSCODE || (process.env.NODE_ENV !== 'production' ? 'vigna123' : '');
  if (!expected) return false;
  const got = Buffer.from(req.headers.get('x-staff-key') ?? '');
  const want = Buffer.from(expected);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
