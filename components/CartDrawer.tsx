'use client';

import { inr, totals } from '@/lib/money';
import type { CartLine, MenuItem } from '@/lib/types';

export default function CartDrawer({
  open, onClose, menu, cart, gstRate, onQty, onNote, onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  menu: MenuItem[];
  cart: Record<string, CartLine>;
  gstRate: number;
  onQty: (id: string, delta: number) => void;
  onNote: (id: string, note: string) => void;
  onCheckout: () => void;
}) {
  if (!open) return null;
  const lines = Object.entries(cart).flatMap(([id, l]) => {
    const item = menu.find((m) => m.id === id);
    return item ? [{ item, ...l }] : [];
  });
  const t = totals(lines.reduce((s, l) => s + l.item.price_paise * l.qty, 0), gstRate);

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <div role="dialog" aria-label="Your order" onClick={(e) => e.stopPropagation()} className="sheet absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-md flex-col rounded-t-2xl bg-white">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="font-display text-2xl font-extrabold">Your order</h2>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-semibold text-ink/70 hover:bg-ink/5">Close</button>
        </div>

        {lines.length === 0 ? (
          <p className="px-5 py-12 text-center text-ink/60">Nothing here yet. Add a dish from the menu.</p>
        ) : (
          <>
            <ul className="mt-3 flex-1 divide-y divide-ink/10 overflow-y-auto px-5">
              {lines.map(({ item, qty, note }) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-ink/60">{inr(item.price_paise)} each</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-leaf-tint">
                      <button aria-label={`Remove one ${item.name}`} onClick={() => onQty(item.id, -1)} className="h-9 w-9 text-xl font-bold text-leaf">−</button>
                      <span className="w-6 text-center font-bold">{qty}</span>
                      <button aria-label={`Add one ${item.name}`} onClick={() => onQty(item.id, 1)} className="h-9 w-9 text-xl font-bold text-leaf">+</button>
                    </div>
                  </div>
                  {item.is_kitchen_item && (
                    <input
                      value={note}
                      onChange={(e) => onNote(item.id, e.target.value)}
                      maxLength={140}
                      placeholder="Note for the kitchen (less spicy, no onion…)"
                      className="mt-2 w-full rounded-md border border-ink/10 px-2.5 py-1.5 text-sm"
                    />
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-ink/10 px-5 pb-5 pt-3">
              <dl className="space-y-1 text-[15px]">
                <div className="flex justify-between"><dt className="text-ink/70">Subtotal</dt><dd>{inr(t.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink/70">GST ({gstRate}%)</dt><dd>{inr(t.gst)}</dd></div>
                <div className="flex justify-between pt-1 font-display text-xl font-extrabold"><dt>Total</dt><dd>{inr(t.total)}</dd></div>
              </dl>
              <button onClick={onCheckout} className="mt-4 w-full rounded-xl bg-leaf py-3.5 font-display text-lg font-bold text-white">Continue to checkout</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
