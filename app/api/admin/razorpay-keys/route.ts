import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { isStaff } from '@/lib/auth';
import { getHotel, getRazorpayCreds, setRazorpayCreds } from '@/lib/db';

export const runtime = 'nodejs';

// Status only. The secret is never returned to any client.
export async function GET(req: Request) {
  if (!isStaff(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const hotelId = new URL(req.url).searchParams.get('hotelId') ?? '';
  const hotel = await getHotel(hotelId);
  if (!hotel) return NextResponse.json({ error: 'Unknown hotel' }, { status: 404 });
  const creds = await getRazorpayCreds(hotelId);
  return NextResponse.json({
    hotel: hotel.name,
    configured: Boolean(creds),
    keyId: creds ? `${creds.keyId.slice(0, 9)}••••${creds.keyId.slice(-4)}` : null,
  });
}

export async function POST(req: Request) {
  if (!isStaff(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { hotelId?: string; keyId?: string; keySecret?: string };
  const keyId = (b.keyId ?? '').trim();
  const keySecret = (b.keySecret ?? '').trim();
  if (!b.hotelId || !(await getHotel(b.hotelId))) return NextResponse.json({ error: 'Unknown hotel' }, { status: 404 });
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) || keySecret.length < 10) {
    return NextResponse.json({ error: 'Key ID should look like rzp_test_xxxx or rzp_live_xxxx.' }, { status: 400 });
  }
  // Prove the pair works before saving it.
  try {
    await new Razorpay({ key_id: keyId, key_secret: keySecret }).orders.all({ count: 1 });
  } catch {
    return NextResponse.json({ error: 'Razorpay rejected these keys. Check the Key ID and Secret.' }, { status: 400 });
  }
  await setRazorpayCreds(b.hotelId, keyId, keySecret);
  return NextResponse.json({ ok: true });
}
