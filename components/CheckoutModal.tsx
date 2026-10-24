'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { inr, totals } from '@/lib/money';
import type { CartLine, Hotel, MenuItem, Order, OrderStatus, PaymentMethod } from '@/lib/types';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Received' },
  { key: 'preparing', label: 'Active' },
  { key: 'ready', label: 'Prepared' },
  { key: 'served', label: 'Served' },
];

export default function CheckoutModal({
  hotel, table, menu, cart, onClose, onPlaced,
}: {
  hotel: Hotel;
  table: string;
  menu: MenuItem[];
  cart: Record<string, CartLine>;
  onClose: () => void;
  onPlaced: (order: Order) => void; // clears the cart and starts menu-page tracking
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tableNo, setTableNo] = useState(table);
  const [room, setRoom] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('online');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Order | null>(null);

  const subtotal = Object.entries(cart).reduce((s, [id, l]) => s + (menu.find((m) => m.id === id)?.price_paise ?? 0) * l.qty, 0);
  const t = totals(subtotal, hotel.gst_rate);

  async function verify(orderId: string, body: Record<string, string>) {
    const r = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, ...body }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Payment could not be verified.');
  }

  async function payOnline(order: Order) {
    const r = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? 'Could not start payment.');

    if (d.demo) {
      const ok = window.confirm(`Demo mode: this hotel has no Razorpay keys yet.\nSimulate a successful payment of ${inr(d.amount)}?`);
      if (!ok) throw new Error('Payment cancelled. Your order will reach the kitchen only after payment.');
      await verify(order.id, { razorpay_order_id: d.razorpayOrderId, razorpay_payment_id: `pay_demo_${Date.now()}`, razorpay_signature: 'demo' });
      return;
    }
    if (!(await loadRazorpay())) throw new Error('Could not load Razorpay. Check your connection and try again.');

    await new Promise<void>((resolve, reject) => {
      const rz = new window.Razorpay!({
        key: d.keyId,
        amount: d.amount,
        currency: d.currency,
        name: hotel.name,
        description: `Table ${tableNo}`,
        order_id: d.razorpayOrderId,
        prefill: { name, contact: phone },
        theme: { color: '#1F4D3A' },
        handler: (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          verify(order.id, resp).then(resolve, reject);
        },
        modal: { ondismiss: () => reject(new Error('Payment cancelled. Your order will reach the kitchen only after payment.')) },
      });
      rz.open();
    });
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: hotel.id,
          table: tableNo,
          customerName: name,
          customerPhone: phone,
          paymentMethod: method,
          roomNo: method === 'room' ? room : undefined,
          lines: Object.entries(cart).map(([itemId, l]) => ({ itemId, qty: l.qty, note: l.note })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Could not place your order.');
      const order: Order = d.order;
      if (method === 'online') await payOnline(order);
      setPlaced(order);
      onPlaced(order);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (placed) return <Placed order={placed} onClose={onClose} />;

  const field = 'mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-[16px]';
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div role="dialog" aria-label="Checkout" onClick={(e) => e.stopPropagation()} className="sheet absolute inset-x-0 bottom-0 mx-auto max-h-[94dvh] max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pb-6 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold">Checkout</h2>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-semibold text-ink/70 hover:bg-ink/5">Back</button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">Your name
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block text-sm font-semibold">Mobile number
            <div className="mt-1 flex">
              <span className="flex items-center rounded-l-lg border border-r-0 border-ink/15 bg-paper px-3 text-ink/70">+91</span>
              <input className="w-full rounded-r-lg border border-ink/15 px-3 py-2.5 text-[16px]" value={phone} inputMode="numeric" maxLength={10} autoComplete="tel-national" onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            </div>
          </label>
          <label className="block text-sm font-semibold">Table number
            <input className={field} value={tableNo} maxLength={10} onChange={(e) => setTableNo(e.target.value)} />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">How would you like to pay?</legend>
          <div className="mt-2 space-y-2">
            {([
              ['online', 'Pay online', 'UPI, cards or netbanking via Razorpay. Goes straight to the restaurant.'],
              ['room', 'Charge to my room', 'For hotel guests. Added to your room bill.'],
            ] as const).map(([v, title, sub]) => (
              <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${method === v ? 'border-leaf bg-leaf-tint' : 'border-ink/15'}`}>
                <input type="radio" name="pay" className="mt-1 accent-[#1F4D3A]" checked={method === v} onChange={() => setMethod(v)} />
                <span><span className="block font-semibold">{title}</span><span className="block text-sm text-ink/65">{sub}</span></span>
              </label>
            ))}
          </div>
          {method === 'room' && (
            <label className="mt-3 block text-sm font-semibold">Room number
              <input className={field} value={room} maxLength={10} onChange={(e) => setRoom(e.target.value)} />
              <span className="mt-1 block text-xs font-normal text-ink/55">Use the name on your booking. Demo guest: Arjun Mehta, room 305.</span>
            </label>
          )}
        </fieldset>

        {err && <p role="alert" className="mt-4 rounded-lg bg-chili/10 px-3 py-2 text-sm text-chili">{err}</p>}

        <button onClick={submit} disabled={busy} className="mt-5 w-full rounded-xl bg-leaf py-3.5 font-display text-lg font-bold text-white disabled:opacity-50">
          {busy ? 'Please wait…' : method === 'online' ? `Pay ${inr(t.total)}` : `Place order · ${inr(t.total)}`}
        </button>
        <p className="mt-2 text-center text-xs text-ink/55">Total includes {hotel.gst_rate}% GST. Final amount is confirmed by the restaurant’s server.</p>
      </div>
    </div>
  );
}

function Placed({ order, onClose }: { order: Order; onClose: () => void }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  useEffect(() => {
    const tick = () => fetch(`/api/orders/${order.id}`).then((r) => r.json()).then((d) => d.status && setStatus(d.status)).catch(() => {});
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [order.id]);
  const at = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div role="dialog" aria-label="Order placed" className="sheet absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-2xl bg-white px-5 pb-6 pt-6">
        <h2 className="font-display text-3xl font-extrabold text-leaf">Order VD-{order.order_no} is in</h2>
        <p className="mt-1 text-ink/70">
          {order.payment_method === 'room' ? `Charged to room ${order.room_no}.` : 'Payment received.'} We’ll bring it to table {order.table_no}. You’ll see an update when the owner marks your order Active or Prepared.
        </p>
        <ol className="mt-5 grid grid-cols-4 gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s.key} className="text-center">
              <div className={`h-1.5 rounded-full ${i <= at ? 'bg-leaf' : 'bg-ink/10'}`} />
              <span className={`mt-1.5 block text-xs ${i === at ? 'font-bold text-ink' : 'text-ink/55'}`}>{s.label}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex gap-2">
          <Link href={`/print/${order.id}`} target="_blank" className="flex-1 rounded-xl border border-leaf py-3 text-center font-bold text-leaf">View bill</Link>
          <button onClick={onClose} className="flex-1 rounded-xl bg-leaf py-3 font-bold text-white">Back to menu</button>
        </div>
      </div>
    </div>
  );
}
