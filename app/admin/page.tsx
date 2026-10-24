'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Order, OrderStatus } from '@/lib/types';
import { inr } from '@/lib/money';

export default function AdminPage() {
  const [hotelId, setHotelId] = useState('H101');
  const [pass, setPass] = useState('');
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<{ hotel: string; configured: boolean; keyId: string | null } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersMsg, setOrdersMsg] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('hotelId');
    if (p) setHotelId(p);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!pass) { setOrdersMsg('Enter the staff passcode, then press Load orders.'); return; }
    setOrdersLoading(true);
    try {
      const r = await fetch(`/api/kitchen/orders?hotelId=${encodeURIComponent(hotelId)}`, {
        headers: { 'x-staff-key': pass }, cache: 'no-store',
      });
      const d = await r.json();
      if (!r.ok) { setOrdersMsg(d.error ?? 'Could not load orders. Check your staff passcode.'); setOrders([]); return; }
      setOrders(d.orders ?? []);
      setOrdersMsg((d.orders ?? []).length ? 'Orders loaded. Updates refresh automatically.' : 'No orders yet. New orders will appear here.');
    } catch { setOrdersMsg('Could not connect to the server.'); }
    finally { setOrdersLoading(false); }
  }, [hotelId, pass]);

  async function setOrderStatus(order: Order, status: OrderStatus) {
    setOrdersMsg(`Updating order VD-${order.order_no}…`);
    const r = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-staff-key': pass },
      body: JSON.stringify({ status }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setOrdersMsg(d.error ?? 'Could not update order status.'); return; }
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status } : o));
    setOrdersMsg(status === 'preparing' ? `Order VD-${order.order_no} is now Active.` : `Order VD-${order.order_no} is marked Prepared.`);
  }

  useEffect(() => {
    if (!pass) return;
    loadOrders();
    const timer = window.setInterval(loadOrders, 8000);
    return () => window.clearInterval(timer);
  }, [pass, loadOrders]);

  async function refresh() {
    const r = await fetch(`/api/admin/razorpay-keys?hotelId=${encodeURIComponent(hotelId)}`, { headers: { 'x-staff-key': pass } });
    const d = await r.json();
    if (!r.ok) return setMsg({ ok: false, text: d.error ?? 'Could not load.' });
    setStatus(d);
    setMsg(null);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/admin/razorpay-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-key': pass },
      body: JSON.stringify({ hotelId, keyId, keySecret: secret }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: d.error ?? 'Could not save.' });
    setSecret('');
    setMsg({ ok: true, text: 'Saved. Diner payments now settle into this Razorpay account.' });
    refresh();
  }

  const field = 'mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5';
  return (
    <main className="mx-auto max-w-md px-6 py-14">
      <h1 className="font-display text-3xl font-extrabold text-leaf">Owner settings</h1>
      <p className="mt-2 text-ink/70">Connect your own Razorpay account. Diners pay you directly; Vigna Digital never holds the money.</p>

      <div className="mt-6 space-y-3">
        <label className="block text-sm font-semibold">Restaurant ID
          <input className={field} value={hotelId} onChange={(e) => setHotelId(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Staff passcode
          <input type="password" className={field} value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        <button onClick={refresh} className="rounded-lg border border-leaf px-4 py-2 font-bold text-leaf">Check status</button>
      </div>

      {status && (
        <p className="mt-4 rounded-lg bg-leaf-tint px-3 py-2 text-sm">
          {status.hotel}: {status.configured ? `Razorpay connected (${status.keyId})` : 'Razorpay not connected yet'}
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-display text-xl font-extrabold">Restaurant orders</h2><p className="mt-1 text-sm text-ink/60">Press Active when preparation starts and Prepared when the food is ready. Customers receive a popup on the menu page.</p></div>
          <button onClick={loadOrders} disabled={ordersLoading} className="shrink-0 rounded-lg bg-leaf px-3 py-2 text-sm font-bold text-white">{ordersLoading ? 'Loading…' : 'Load orders'}</button>
        </div>
        {ordersMsg && <p role="status" className="mt-3 rounded-lg bg-leaf-tint px-3 py-2 text-sm">{ordersMsg}</p>}
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <article key={o.id} className="rounded-xl border border-ink/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-bold">Order VD-{o.order_no} · Table {o.table_no}</h3><p className="text-sm text-ink/65">{o.customer_name} · {o.customer_phone}</p><p className="mt-1 text-sm font-bold">{inr(o.total_paise)}</p></div>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${o.status === 'ready' ? 'bg-green-100 text-green-800' : o.status === 'preparing' ? 'bg-blue-100 text-blue-800' : o.status === 'served' ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-900'}`}>{o.status === 'preparing' ? 'Active' : o.status === 'ready' ? 'Prepared' : o.status === 'served' ? 'Served' : 'New order'}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">{o.items.map((item) => <li key={item.id}>{item.qty}× {item.name}{item.note ? ` — ${item.note}` : ''}</li>)}</ul>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={o.status === 'preparing' || o.status === 'ready' || o.status === 'served'} onClick={() => setOrderStatus(o, 'preparing')} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Active</button>
                <button disabled={o.status === 'ready' || o.status === 'served'} onClick={() => setOrderStatus(o, 'ready')} className="rounded-lg bg-leaf px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Prepared</button>
              </div>
            </article>
          ))}
          {!orders.length && <p className="py-5 text-center text-sm text-ink/55">No orders loaded yet.</p>}
        </div>
      </section>

      <div className="mt-8 space-y-3 border-t border-ink/10 pt-6">
        <label className="block text-sm font-semibold">Razorpay Key ID
          <input className={field} value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_test_…" autoComplete="off" />
        </label>
        <label className="block text-sm font-semibold">Razorpay Key Secret
          <input type="password" className={field} value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" />
          <span className="mt-1 block text-xs font-normal text-ink/55">Stored encrypted. We test the keys with Razorpay before saving, and never show the secret again.</span>
        </label>
        {msg && <p role="alert" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-leaf-tint text-leaf-dark' : 'bg-chili/10 text-chili'}`}>{msg.text}</p>}
        <button onClick={save} disabled={busy || !keyId || !secret} className="w-full rounded-xl bg-leaf py-3 font-display font-bold text-white disabled:opacity-40">
          {busy ? 'Checking keys…' : 'Save and connect'}
        </button>
      </div>
    </main>
  );
}
