import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getOrder, getRazorpayCreds, markPaid, notifyKitchen } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Verifies Razorpay's HMAC-SHA256 signature over "order_id|payment_id" using the
 * hotel's own key secret. Only a valid signature flips the order to "paid" and
 * releases it to the kitchen.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as {
    orderId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const { orderId, razorpay_order_id: rzOrder, razorpay_payment_id: rzPay, razorpay_signature: sig } = b;
  if (!orderId || !rzOrder || !rzPay || !sig) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const order = await getOrder(orderId);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.razorpay_order_id !== rzOrder) return NextResponse.json({ error: 'Order mismatch' }, { status: 400 });
  if (order.payment_status === 'paid') return NextResponse.json({ ok: true }); // idempotent

  const creds = await getRazorpayCreds(order.hotel_id);

  if (!creds) {
    // Mock path: only in demo mode, only for demo order ids, only when no real keys exist.
    const ok = process.env.DEMO_MODE === 'true' && rzOrder.startsWith('order_demo_');
    if (!ok) return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  } else {
    const expected = crypto.createHmac('sha256', creds.keySecret).update(`${rzOrder}|${rzPay}`).digest('hex');
    const a = Buffer.from(expected);
    const c = Buffer.from(sig);
    if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }
  }

  await markPaid(order.id, rzPay);
  await notifyKitchen(order.hotel_id);
  return NextResponse.json({ ok: true });
}
