import 'server-only';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decrypt, encrypt } from './crypto';
import { DEMO_HOTEL, DEMO_MENU, DEMO_STAY } from './demo-data';
import { totals } from './money';
import type {
  FolioEntry, Hotel, MenuItem, Order, OrderItem, OrderStatus, PaymentMethod,
  RoomStay, ServiceRequest,
} from './types';

/* ──────────────────────────────────────────────────────────────────────────
   One data layer, two backends:
   • Supabase (when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set)
   • In-memory demo store (zero setup; resets on server restart)
   Every route talks to this file only.
   ────────────────────────────────────────────────────────────────────────── */

export const hasSupabase = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let client: SupabaseClient | null = null;
const sb = () =>
  (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  ));

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/* ── in-memory store ─────────────────────────────────────────────────────── */
interface HotelRow extends Hotel {
  razorpay_key_id: string | null;
  razorpay_key_secret_enc: string | null;
}
interface Mem {
  hotels: Map<string, HotelRow>;
  menu: MenuItem[];
  orders: Order[];
  stays: RoomStay[];
  folio: FolioEntry[];
  requests: ServiceRequest[];
  counter: number;
  bus: EventEmitter;
}
const g = globalThis as unknown as { __vigna?: Mem };
const mem = (): Mem =>
  (g.__vigna ??= {
    hotels: new Map([[DEMO_HOTEL.id, { ...DEMO_HOTEL, razorpay_key_id: null, razorpay_key_secret_enc: null }]]),
    menu: structuredClone(DEMO_MENU),
    orders: [],
    stays: [structuredClone(DEMO_STAY)],
    folio: [],
    requests: [],
    counter: 1000,
    bus: new EventEmitter().setMaxListeners(100),
  });
export const memBus = () => mem().bus;

/* ── helpers ─────────────────────────────────────────────────────────────── */
type RawOrder = Omit<Order, 'items'> & { order_items?: OrderItem[] };
const flat = ({ order_items, ...o }: RawOrder): Order => ({ ...o, items: order_items ?? [] });

const toPublic = (h: HotelRow): Hotel => ({
  id: h.id,
  name: h.name,
  address: h.address,
  phone: h.phone,
  gstin: h.gstin,
  gst_rate: Number(h.gst_rate),
  footer_message: h.footer_message,
  has_razorpay: Boolean(h.razorpay_key_id && h.razorpay_key_secret_enc),
});

/* ── hotels & Razorpay credentials ───────────────────────────────────────── */
export async function getHotel(id: string): Promise<Hotel | null> {
  if (!hasSupabase()) {
    const h = mem().hotels.get(id);
    return h ? toPublic(h) : null;
  }
  const { data } = await sb().from('hotels').select('*').eq('id', id).maybeSingle();
  return data ? toPublic(data as HotelRow) : null;
}

export async function getRazorpayCreds(hotelId: string) {
  const row = hasSupabase()
    ? ((await sb().from('hotels').select('razorpay_key_id, razorpay_key_secret_enc').eq('id', hotelId).maybeSingle())
        .data as Pick<HotelRow, 'razorpay_key_id' | 'razorpay_key_secret_enc'> | null)
    : mem().hotels.get(hotelId);
  if (!row?.razorpay_key_id || !row.razorpay_key_secret_enc) return null;
  return { keyId: row.razorpay_key_id, keySecret: decrypt(row.razorpay_key_secret_enc) };
}

export async function setRazorpayCreds(hotelId: string, keyId: string, keySecret: string) {
  const enc = encrypt(keySecret);
  if (!hasSupabase()) {
    const h = mem().hotels.get(hotelId);
    if (!h) throw new OrderError('Unknown hotel', 404);
    h.razorpay_key_id = keyId;
    h.razorpay_key_secret_enc = enc;
    return;
  }
  const { error } = await sb()
    .from('hotels')
    .update({ razorpay_key_id: keyId, razorpay_key_secret_enc: enc })
    .eq('id', hotelId);
  if (error) throw error;
}

/* ── menu ────────────────────────────────────────────────────────────────── */
export async function getMenu(hotelId: string): Promise<MenuItem[]> {
  if (!hasSupabase()) return mem().menu.filter((m) => m.hotel_id === hotelId);
  const { data, error } = await sb().from('menu_items').select('*').eq('hotel_id', hotelId).order('sort');
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

/* ── PMS: active stay lookup (Charge to Room) ────────────────────────────── */
export async function findActiveStay(hotelId: string, roomNo: string, guestName: string): Promise<RoomStay | null> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const room = roomNo.trim();
  const rows: RoomStay[] = hasSupabase()
    ? (((await sb().from('room_stays').select('*').eq('hotel_id', hotelId).eq('room_no', room).eq('status', 'active')).data ??
        []) as RoomStay[])
    : mem().stays.filter((s) => s.hotel_id === hotelId && s.room_no === room && s.status === 'active');
  const typed = norm(guestName);
  const now = Date.now();
  if (typed.length < 3) return null;
  return (
    rows.find((s) => {
      const registered = norm(s.guest_name);
      const inWindow = Date.parse(s.check_in) <= now && now <= Date.parse(s.check_out);
      return inWindow && (registered === typed || registered.includes(typed) || typed.includes(registered));
    }) ?? null
  );
}

/* ── orders ──────────────────────────────────────────────────────────────── */
export interface NewOrderInput {
  hotelId: string;
  table: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  roomNo?: string;
  lines: { itemId: string; qty: number; note?: string }[];
}

/** Prices and totals are ALWAYS computed here from the DB, never trusted from the client. */
export async function createOrder(inp: NewOrderInput): Promise<Order> {
  const hotel = await getHotel(inp.hotelId);
  if (!hotel) throw new OrderError('Unknown restaurant', 404);

  const byId = new Map((await getMenu(inp.hotelId)).map((m) => [m.id, m]));
  const items = inp.lines.map((l) => {
    const m = byId.get(l.itemId);
    if (!m) throw new OrderError('An item in your cart no longer exists. Refresh the menu.');
    if (!m.is_available) throw new OrderError(`${m.name} is not available right now.`);
    const qty = Math.min(Math.max(Math.floor(l.qty), 1), 20);
    return { m, qty, note: l.note?.trim().slice(0, 140) || null };
  });
  if (!items.length) throw new OrderError('Your cart is empty.');

  const t = totals(items.reduce((s, i) => s + i.m.price_paise * i.qty, 0), hotel.gst_rate);

  let stay: RoomStay | null = null;
  if (inp.paymentMethod === 'room') {
    stay = await findActiveStay(inp.hotelId, inp.roomNo ?? '', inp.customerName);
    if (!stay) {
      throw new OrderError(
        'We could not find an active stay for that guest name and room number. Check the details or pay online.',
        403,
      );
    }
  }

  const base = {
    hotel_id: inp.hotelId,
    customer_name: inp.customerName,
    customer_phone: inp.customerPhone,
    table_no: inp.table,
    room_no: stay?.room_no ?? null,
    payment_method: inp.paymentMethod,
    payment_status: stay ? ('room_pending' as const) : ('pending_payment' as const),
    status: 'pending' as const,
    subtotal_paise: t.subtotal,
    gst_paise: t.gst,
    total_paise: t.total,
    stay_id: stay?.id ?? null,
  };

  if (!hasSupabase()) {
    const m = mem();
    const id = crypto.randomUUID();
    const order: Order = {
      ...base,
      id,
      order_no: ++m.counter,
      razorpay_order_id: null,
      razorpay_payment_id: null,
      created_at: new Date().toISOString(),
      items: items.map((i) => ({
        id: crypto.randomUUID(), order_id: id, menu_item_id: i.m.id, name: i.m.name, qty: i.qty,
        unit_price_paise: i.m.price_paise, is_kitchen_item: i.m.is_kitchen_item, note: i.note,
      })),
    };
    m.orders.push(order);
    if (stay) {
      m.folio.push({
        id: crypto.randomUUID(), stay_id: stay.id, order_id: id,
        description: `Restaurant order VD-${order.order_no} (Table ${inp.table})`,
        amount_paise: t.total, status: 'pending', created_at: order.created_at,
      });
    }
    return order;
  }

  // Supabase path (swap for a single Postgres RPC if you need strict atomicity)
  const { data: o, error } = await sb().from('orders').insert(base).select().single();
  if (error) throw error;
  const { error: e2 } = await sb().from('order_items').insert(
    items.map((i) => ({
      order_id: o.id, menu_item_id: i.m.id, name: i.m.name, qty: i.qty,
      unit_price_paise: i.m.price_paise, is_kitchen_item: i.m.is_kitchen_item, note: i.note,
    })),
  );
  if (e2) {
    await sb().from('orders').delete().eq('id', o.id);
    throw e2;
  }
  if (stay) {
    await sb().from('folio_entries').insert({
      stay_id: stay.id, order_id: o.id,
      description: `Restaurant order VD-${o.order_no} (Table ${inp.table})`,
      amount_paise: t.total,
    });
  }
  return (await getOrder(o.id))!;
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!hasSupabase()) return mem().orders.find((o) => o.id === id) ?? null;
  const { data } = await sb().from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  return data ? flat(data as RawOrder) : null;
}

/** Kitchen sees only paid / room-charged orders, and only the items that need cooking. */
export async function listKitchenOrders(hotelId: string): Promise<Order[]> {
  const since = new Date(Date.now() - 12 * 3600e3).toISOString();
  let orders: Order[];
  if (!hasSupabase()) {
    orders = mem().orders.filter(
      (o) => o.hotel_id === hotelId && o.payment_status !== 'pending_payment' && o.created_at >= since,
    );
  } else {
    const { data, error } = await sb()
      .from('orders')
      .select('*, order_items(*)')
      .eq('hotel_id', hotelId)
      .in('payment_status', ['paid', 'room_pending'])
      .gte('created_at', since)
      .order('created_at');
    if (error) throw error;
    orders = ((data ?? []) as RawOrder[]).map(flat);
  }
  return orders
    .map((o) => ({ ...o, customer_phone: '', items: o.items.filter((i) => i.is_kitchen_item) }))
    .filter((o) => o.items.length > 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function patchOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
  if (!hasSupabase()) {
    const o = mem().orders.find((x) => x.id === id);
    if (!o) return null;
    Object.assign(o, patch);
    return o;
  }
  const { items: _items, ...cols } = patch;
  void _items;
  const { error } = await sb().from('orders').update({ ...cols, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return getOrder(id);
}

export const updateStatus = (id: string, status: OrderStatus) => patchOrder(id, { status });
export const attachRazorpayOrder = (id: string, razorpay_order_id: string) => patchOrder(id, { razorpay_order_id });
export const markPaid = (id: string, razorpay_payment_id: string) =>
  patchOrder(id, { payment_status: 'paid', razorpay_payment_id });

/* ── realtime: ping the kitchen to refetch (pings carry no customer data) ── */
export async function notifyKitchen(hotelId: string) {
  if (!hasSupabase()) {
    mem().bus.emit(hotelId);
    return;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic: `kitchen:${hotelId}`, event: 'refresh', payload: {}, private: false }] }),
    });
  } catch {
    /* the kitchen also polls, so a missed ping is harmless */
  }
}

/* ── waiter / service requests (from the AI chatbot) ─────────────────────── */
export async function createServiceRequest(hotelId: string, table: string, message: string) {
  const row = { hotel_id: hotelId, table_no: table, message: message.slice(0, 200) };
  if (!hasSupabase()) {
    mem().requests.push({ ...row, id: crypto.randomUUID(), status: 'open', created_at: new Date().toISOString() });
  } else {
    const { error } = await sb().from('service_requests').insert(row);
    if (error) throw error;
  }
  await notifyKitchen(hotelId);
}

export async function listOpenRequests(hotelId: string): Promise<ServiceRequest[]> {
  if (!hasSupabase()) return mem().requests.filter((r) => r.hotel_id === hotelId && r.status === 'open');
  const { data } = await sb().from('service_requests').select('*').eq('hotel_id', hotelId).eq('status', 'open').order('created_at');
  return (data ?? []) as ServiceRequest[];
}

export async function resolveRequest(id: string): Promise<string | null> {
  if (!hasSupabase()) {
    const r = mem().requests.find((x) => x.id === id);
    if (!r) return null;
    r.status = 'done';
    return r.hotel_id;
  }
  const { data } = await sb().from('service_requests').update({ status: 'done' }).eq('id', id).select('hotel_id').maybeSingle();
  return (data as { hotel_id: string } | null)?.hotel_id ?? null;
}
