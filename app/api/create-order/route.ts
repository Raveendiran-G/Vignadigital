import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { attachRazorpayOrder, getHotel, getOrder, getRazorpayCreds } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Creates a Razorpay order using the TARGET HOTEL's own keys, so money settles
 * directly into the owner's Razorpay account (Vigna Digital never touches funds).
 *
 * The client sends only `orderId`. The amount comes from our database row that
 * was priced server-side from the menu, so it cannot be tampered with in the browser.
 */
export async function POST(req: Request) {
  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  const order = orderId ? await getOrder(orderId) : null;
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.payment_method !== 'online' || order.payment_status !== 'pending_payment') {
    return NextResponse.json({ error: 'This order does not need payment.' }, { status: 409 });
  }

  const hotel = await getHotel(order.hotel_id);
  const creds = await getRazorpayCreds(order.hotel_id);

  if (!creds) {
    if (process.env.DEMO_MODE === 'true') {
      const demoId = `order_demo_${crypto.randomBytes(6).toString('hex')}`;
      await attachRazorpayOrder(order.id, demoId);
      return NextResponse.json({ demo: true, razorpayOrderId: demoId, amount: order.total_paise, currency: 'INR' });
    }
    return NextResponse.json({ error: 'This restaurant has not connected Razorpay yet.' }, { status: 422 });
  }

  try {
    const rz = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
    const rOrder = await rz.orders.create({
      amount: order.total_paise, // integer paise
      currency: 'INR',
      receipt: `VD-${order.order_no}`,
      notes: { orderId: order.id, hotelId: order.hotel_id, table: order.table_no },
    });
    await attachRazorpayOrder(order.id, rOrder.id);
    return NextResponse.json({
      keyId: creds.keyId, // public identifier, safe for the browser
      razorpayOrderId: rOrder.id,
      amount: Number(rOrder.amount),
      currency: rOrder.currency,
      hotelName: hotel?.name,
    });
  } catch (e) {
    console.error('[create-order] razorpay error', e);
    return NextResponse.json({ error: 'Payment gateway error. Please try again.' }, { status: 502 });
  }
}
