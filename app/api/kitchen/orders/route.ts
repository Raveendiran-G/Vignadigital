import { NextResponse } from 'next/server';
import { isStaff } from '@/lib/auth';
import { listKitchenOrders, listOpenRequests } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isStaff(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const hotelId = new URL(req.url).searchParams.get('hotelId') ?? '';
  const [orders, requests] = await Promise.all([listKitchenOrders(hotelId), listOpenRequests(hotelId)]);
  return NextResponse.json({ orders, requests });
}
