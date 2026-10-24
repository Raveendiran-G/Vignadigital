import { NextResponse } from 'next/server';
import { isStaff } from '@/lib/auth';
import { getOrder, notifyKitchen, updateStatus } from '@/lib/db';
import type { OrderStatus } from '@/lib/types';

export const runtime = 'nodejs';
const STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'served'];

// Public (order ids are unguessable UUIDs): lets the diner's phone poll its status.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrder(id);
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    id: o.id, order_no: o.order_no, status: o.status, payment_status: o.payment_status, total_paise: o.total_paise,
  });
}

// Staff only: kitchen advances the ticket.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStaff(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { status } = (await req.json().catch(() => ({}))) as { status?: OrderStatus };
  if (!status || !STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  const o = await updateStatus(id, status);
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await notifyKitchen(o.hotel_id);
  return NextResponse.json({ ok: true });
}
