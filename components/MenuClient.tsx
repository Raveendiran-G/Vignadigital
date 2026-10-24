'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import CartDrawer from './CartDrawer';
import ChatWidget from './ChatWidget';
import CheckoutModal from './CheckoutModal';
import { DishThumb, Spice, VegMark } from './ui';
import { inr, totals } from '@/lib/money';
import { CATEGORIES, type CartLine, type Hotel, type MenuItem, type OrderStatus } from '@/lib/types';

export default function MenuClient({ hotel, menu, table }: { hotel: Hotel; menu: MenuItem[]; table: string }) {
  const [cat, setCat] = useState<'All' | (typeof CATEGORIES)[number]>('All');
  const [q, setQ] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [trackedOrders, setTrackedOrders] = useState<{ id: string; orderNo: number; status: OrderStatus }[]>([]);
  const [statusNotice, setStatusNotice] = useState('');

  // Keep order tracking on the menu page even after the checkout sheet is closed.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vd-menu-orders') || '[]');
      if (Array.isArray(saved)) setTrackedOrders(saved.filter((x) => x && typeof x.id === 'string'));
    } catch { /* ignore invalid local storage */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('vd-menu-orders', JSON.stringify(trackedOrders));
  }, [trackedOrders]);

  const pollTrackedOrders = useCallback(async () => {
    if (!trackedOrders.length) return;
    const updates = await Promise.all(trackedOrders.map(async (tracked) => {
      try {
        const r = await fetch(`/api/orders/${tracked.id}`, { cache: 'no-store' });
        if (!r.ok) return tracked;
        const d = await r.json();
        const next = d.status as OrderStatus;
        if (next && next !== tracked.status) {
          if (next === 'preparing') setStatusNotice(`Order VD-${tracked.orderNo} is now ACTIVE. The restaurant has started preparing it.`);
          if (next === 'ready') setStatusNotice(`Order VD-${tracked.orderNo} is PREPARED and ready to be served!`);
          if (next === 'served') setStatusNotice(`Order VD-${tracked.orderNo} has been served. Enjoy your meal!`);
          return { ...tracked, status: next };
        }
        return tracked;
      } catch { return tracked; }
    }));
    setTrackedOrders(updates);
  }, [trackedOrders]);

  useEffect(() => {
    if (!trackedOrders.length) return;
    pollTrackedOrders();
    const timer = window.setInterval(pollTrackedOrders, 4000);
    return () => window.clearInterval(timer);
  }, [trackedOrders.length, pollTrackedOrders]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return menu.filter(
      (m) =>
        (cat === 'All' || m.category === cat) &&
        (!vegOnly || m.is_veg) &&
        (!s || m.name.toLowerCase().includes(s) || m.description.toLowerCase().includes(s)),
    );
  }, [menu, cat, q, vegOnly]);

  const count = Object.values(cart).reduce((n, l) => n + l.qty, 0);
  const subtotal = Object.entries(cart).reduce((s, [id, l]) => s + (menu.find((m) => m.id === id)?.price_paise ?? 0) * l.qty, 0);
  const total = totals(subtotal, hotel.gst_rate).total;

  const setQty = (id: string, delta: number) =>
    setCart((c) => {
      const qty = (c[id]?.qty ?? 0) + delta;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = { qty: Math.min(qty, 20), note: c[id]?.note ?? '' };
      return next;
    });
  const setNote = (id: string, note: string) => setCart((c) => (c[id] ? { ...c, [id]: { ...c[id], note } } : c));

  const groups = cat === 'All' ? CATEGORIES.map((c) => [c, visible.filter((m) => m.category === c)] as const) : ([[cat, visible]] as const);

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper pb-28">
      {statusNotice && (
        <div role="status" aria-live="polite" className="fixed inset-x-3 top-3 z-[70] mx-auto max-w-md rounded-xl bg-leaf px-4 py-3 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-3"><p className="font-bold">{statusNotice}</p><button aria-label="Dismiss order update" onClick={() => setStatusNotice('')} className="rounded px-2 font-bold">✕</button></div>
        </div>
      )}
      <header className="bg-leaf px-5 pb-5 pt-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold leading-tight">{hotel.name}</h1>
          {table && (
            <span className="shrink-0 rounded-md bg-saffron px-2.5 py-1 font-display text-sm font-bold text-ink">Table {table}</span>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dishes"
            aria-label="Search dishes"
            className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-[16px] text-ink placeholder:text-ink/45"
          />
          <button
            onClick={() => setVegOnly((v) => !v)}
            aria-pressed={vegOnly}
            className={`flex items-center gap-1.5 rounded-lg px-3 text-sm font-bold ${vegOnly ? 'bg-white text-leaf' : 'bg-leaf-dark text-white'}`}
          >
            <VegMark veg /> Veg
          </button>
        </div>
      </header>

      <nav aria-label="Categories" className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-ink/10 bg-paper px-4 py-3">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${cat === c ? 'bg-ink text-white' : 'bg-white text-ink/75 ring-1 ring-ink/10'}`}
          >
            {c}
          </button>
        ))}
      </nav>

      <main className="px-4">
        {visible.length === 0 && <p className="py-16 text-center text-ink/60">No dishes match. Clear the search or the veg filter.</p>}
        {groups.map(([name, items]) =>
          items.length === 0 ? null : (
            <section key={name} aria-labelledby={`h-${name}`}>
              <h2 id={`h-${name}`} className="mb-1 mt-6 font-display text-xl font-extrabold">{name}</h2>
              <ul className="divide-y divide-ink/10">
                {items.map((m) => {
                  const qty = cart[m.id]?.qty ?? 0;
                  return (
                    <li key={m.id} className={`flex gap-3 py-4 ${m.is_available ? '' : 'opacity-50'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <VegMark veg={m.is_veg} />
                          <h3 className="font-display text-[17px] font-bold leading-tight">{m.name}</h3>
                        </div>
                        <p className="mt-1 font-semibold">{inr(m.price_paise)}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-ink/65">{m.description}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-ink/55">
                          <Spice level={m.spice_level} />
                          {m.allergens.length > 0 && <span>Contains {m.allergens.join(', ')}</span>}
                        </div>
                      </div>
                      <div className="relative shrink-0 pb-4">
                        <DishThumb item={m} />
                        <div className="absolute inset-x-1 bottom-0">
                          {!m.is_available ? (
                            <span className="block rounded-md bg-white py-1 text-center text-xs font-bold text-ink/60 ring-1 ring-ink/15">Not today</span>
                          ) : qty === 0 ? (
                            <button onClick={() => setQty(m.id, 1)} aria-label={`Add ${m.name}`} className="w-full rounded-md bg-white py-1 text-sm font-extrabold text-leaf shadow ring-1 ring-leaf">Add</button>
                          ) : (
                            <div className="flex items-center justify-between rounded-md bg-leaf text-white shadow">
                              <button onClick={() => setQty(m.id, -1)} aria-label={`Remove one ${m.name}`} className="h-7 w-8 font-bold">−</button>
                              <span className="text-sm font-bold">{qty}</span>
                              <button onClick={() => setQty(m.id, 1)} aria-label={`Add one ${m.name}`} className="h-7 w-8 font-bold">+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )}
      </main>

      {count > 0 && (
        <button onClick={() => setCartOpen(true)} className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-[26rem] items-center justify-between rounded-xl bg-leaf px-5 py-3.5 text-white shadow-xl">
          <span className="font-bold">{count} {count === 1 ? 'item' : 'items'} · {inr(total)}</span>
          <span className="font-display font-bold">View order</span>
        </button>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        menu={menu}
        cart={cart}
        gstRate={hotel.gst_rate}
        onQty={setQty}
        onNote={setNote}
        onCheckout={() => { setCartOpen(false); setCheckout(true); }}
      />
      {checkout && (
        <CheckoutModal
          hotel={hotel}
          table={table}
          menu={menu}
          cart={cart}
          onClose={() => setCheckout(false)}
          onPlaced={(order) => {
            setCart({});
            setTrackedOrders((prev) => [{ id: order.id, orderNo: order.order_no, status: order.status }, ...prev.filter((x) => x.id !== order.id)].slice(0, 10));
            setStatusNotice(`Order VD-${order.order_no} placed. Waiting for the restaurant to mark it Active.`);
          }}
        />
      )}
      <ChatWidget hotelId={hotel.id} tableNo={table} raised={count > 0} onAdd={(id) => setQty(id, 1)} />
    </div>
  );
}
