'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { Order, OrderStatus, ServiceRequest } from '@/lib/types';

const COLUMNS: { key: OrderStatus; label: string; badge: string; next?: OrderStatus; action?: string }[] = [
  { key: 'pending', label: 'Pending', badge: 'bg-yellow-200 text-yellow-950', next: 'preparing', action: 'Start preparing' },
  { key: 'preparing', label: 'Preparing', badge: 'bg-blue-200 text-blue-950', next: 'ready', action: 'Mark ready' },
  { key: 'ready', label: 'Ready', badge: 'bg-green-200 text-green-950', next: 'served', action: 'Mark served' },
  { key: 'served', label: 'Served', badge: 'bg-gray-300 text-gray-800' },
];

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 880;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.18);
  } catch { /* audio unavailable */ }
}

export default function KitchenPage() {
  const [hotelId, setHotelId] = useState('H101');
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [gateErr, setGateErr] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [live, setLive] = useState(false);
  const [sound, setSound] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('hotelId');
    if (p) setHotelId(p);
    const saved = sessionStorage.getItem('vd-staff-key');
    if (saved) { setKey(saved); setAuthed(true); }
  }, []);

  const load = useCallback(async () => {
    const r = await fetch(`/api/kitchen/orders?hotelId=${encodeURIComponent(hotelId)}`, { headers: { 'x-staff-key': key }, cache: 'no-store' });
    if (r.status === 401) {
      sessionStorage.removeItem('vd-staff-key');
      setAuthed(false);
      setGateErr('Wrong passcode.');
      return;
    }
    const d = (await r.json()) as { orders: Order[]; requests: ServiceRequest[] };
    const ids = new Set([...d.orders.map((o) => o.id), ...d.requests.map((x) => x.id)]);
    if (seen.current && [...ids].some((id) => !seen.current!.has(id)) && sound) beep();
    seen.current = ids;
    setOrders(d.orders);
    setRequests(d.requests);
  }, [hotelId, key, sound]);

  // Realtime: Supabase broadcast ping when configured, otherwise SSE. Polling is the safety net.
  useEffect(() => {
    if (!authed) return;
    load();
    const poll = setInterval(load, 8000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    let stop = () => {};
    const sb = supabaseBrowser();
    if (sb) {
      const ch = sb.channel(`kitchen:${hotelId}`).on('broadcast', { event: 'refresh' }, () => load()).subscribe((s) => setLive(s === 'SUBSCRIBED'));
      stop = () => { sb.removeChannel(ch); };
    } else {
      const es = new EventSource(`/api/stream?hotelId=${encodeURIComponent(hotelId)}`);
      es.onopen = () => setLive(true);
      es.onerror = () => setLive(false);
      es.onmessage = () => load();
      stop = () => es.close();
    }
    return () => { clearInterval(poll); clearInterval(clock); stop(); setLive(false); };
  }, [authed, hotelId, load]);

  async function advance(o: Order, next: OrderStatus) {
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: next } : x))); // optimistic
    await fetch(`/api/orders/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-staff-key': key },
      body: JSON.stringify({ status: next }),
    });
  }
  async function done(id: string) {
    setRequests((r) => r.filter((x) => x.id !== id));
    await fetch('/api/service-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-staff-key': key }, body: JSON.stringify({ id }) });
  }

  if (!authed) {
    return (
      <main className="mx-auto max-w-sm px-6 py-24">
        <h1 className="font-display text-3xl font-extrabold text-leaf">Kitchen display</h1>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => { e.preventDefault(); sessionStorage.setItem('vd-staff-key', key); setGateErr(''); setAuthed(true); }}
        >
          <label className="block text-sm font-semibold">Restaurant ID
            <input value={hotelId} onChange={(e) => setHotelId(e.target.value)} className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5" />
          </label>
          <label className="block text-sm font-semibold">Staff passcode
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5" autoFocus />
          </label>
          {gateErr && <p role="alert" className="text-sm text-chili">{gateErr}</p>}
          <button className="w-full rounded-lg bg-leaf py-3 font-bold text-white">Open kitchen</button>
        </form>
      </main>
    );
  }

  const mins = (iso: string) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));

  return (
    <div className="min-h-dvh bg-ink text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold">Kitchen · {hotelId}</h1>
          <span className="flex items-center gap-1.5 text-sm text-white/70">
            <span className={`h-2.5 w-2.5 rounded-full ${live ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {live ? 'Live' : 'Reconnecting (auto-refresh on)'}
          </span>
        </div>
        <button onClick={() => setSound((s) => !s)} aria-pressed={sound} className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold">
          Sound {sound ? 'on' : 'off'}
        </button>
      </header>

      {requests.length > 0 && (
        <section aria-label="Table requests" className="mx-5 mb-4 rounded-xl bg-saffron px-4 py-3 text-ink">
          <h2 className="font-display font-bold">Table requests</h2>
          <ul className="mt-1 space-y-1">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span><b>Table {r.table_no}:</b> {r.message}</span>
                <button onClick={() => done(r.id)} className="rounded-md bg-ink px-3 py-1 text-sm font-bold text-white">Done</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 px-5 pb-10 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.key);
          return (
            <section key={col.key} aria-label={col.label} className="rounded-xl bg-white/5 p-3">
              <h2 className="mb-3 flex items-center justify-between">
                <span className={`rounded-md px-2.5 py-1 font-display text-sm font-bold ${col.badge}`}>{col.label}</span>
                <span className="text-sm text-white/60">{list.length}</span>
              </h2>
              <div className="space-y-3">
                {list.length === 0 && <p className="px-1 py-6 text-center text-sm text-white/40">Nothing here</p>}
                {list.map((o) => (
                  <article key={o.id} className="rounded-lg bg-white p-3 text-ink">
                    <div className="flex items-baseline justify-between">
                      <p className="font-display text-xl font-extrabold">Table {o.table_no}</p>
                      <p className="text-sm text-ink/60">VD-{o.order_no} · {mins(o.created_at)} min</p>
                    </div>
                    <p className="text-xs text-ink/55">{o.customer_name}{o.room_no ? ` · Room ${o.room_no}` : ''}</p>
                    <ul className="mt-2 space-y-1">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          <span className="font-bold">{i.qty}×</span> {i.name}
                          {i.note && <span className="block text-sm font-semibold text-chili">Note: {i.note}</span>}
                        </li>
                      ))}
                    </ul>
                    {col.next && (
                      <button onClick={() => advance(o, col.next!)} className="mt-3 w-full rounded-md bg-leaf py-2 font-bold text-white">{col.action}</button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
