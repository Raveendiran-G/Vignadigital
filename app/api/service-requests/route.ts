import { NextResponse } from 'next/server';
import { isStaff } from '@/lib/auth';
import { notifyKitchen, resolveRequest } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  if (!isStaff(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const hotelId = id ? await resolveRequest(id) : null;
  if (!hotelId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await notifyKitchen(hotelId);
  return NextResponse.json({ ok: true });
}
