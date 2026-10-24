import { NextResponse } from 'next/server';
import { createOrder, notifyKitchen, OrderError } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const name = String(b.customerName ?? '').trim();
  const phone = String(b.customerPhone ?? '').replace(/\D/g, '').slice(-10);
  const table = String(b.table ?? '').trim().slice(0, 10);
  const method = b.paymentMethod === 'room' ? 'room' : b.paymentMethod === 'online' ? 'online' : null;
  const lines = Array.isArray(b.lines) ? b.lines : [];

  if (name.length < 2 || name.length > 60) return NextResponse.json({ error: 'Enter your name.' }, { status: 400 });
  if (!/^[6-9]\d{9}$/.test(phone)) return NextResponse.json({ error: 'Enter a valid 10-digit mobile number.' }, { status: 400 });
  if (!table) return NextResponse.json({ error: 'Enter your table number.' }, { status: 400 });
  if (!method) return NextResponse.json({ error: 'Choose a payment method.' }, { status: 400 });
  if (method === 'room' && !String(b.roomNo ?? '').trim()) {
    return NextResponse.json({ error: 'Enter your room number.' }, { status: 400 });
  }
  if (!lines.length || lines.length > 40) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });

  try {
    const order = await createOrder({
      hotelId: String(b.hotelId ?? ''),
      table,
      customerName: name,
      customerPhone: phone,
      paymentMethod: method,
      roomNo: String(b.roomNo ?? ''),
      lines: lines.map((l: { itemId?: unknown; qty?: unknown; note?: unknown }) => ({
        itemId: String(l.itemId ?? ''),
        qty: Number(l.qty) || 1,
        note: typeof l.note === 'string' ? l.note : undefined,
      })),
    });
    // Room charges go straight to the kitchen; online orders wait for verified payment.
    if (order.payment_status === 'room_pending') await notifyKitchen(order.hotel_id);
    return NextResponse.json({ order });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[orders] create failed', e);
    return NextResponse.json({ error: 'Could not place the order. Please try again.' }, { status: 500 });
  }
}
