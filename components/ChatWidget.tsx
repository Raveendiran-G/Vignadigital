'use client';

import { useEffect, useRef, useState } from 'react';
import { inr } from '@/lib/money';

interface Reco { id: string; name: string; price_paise: number }
interface Msg { role: 'user' | 'assistant'; content: string; recs?: Reco[] }

const QUICK = ['What’s good for vegetarians?', 'Something spicy?', 'Send extra napkins'];

export default function ChatWidget({
  hotelId, tableNo, onAdd, raised,
}: { hotelId: string; tableNo: string; onAdd: (id: string) => void; raised: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! Ask me about dishes, spice, ingredients or allergens, or ask for anything at your table.' },
  ]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId, tableNo, messages: next.slice(1).map(({ role, content }) => ({ role, content })) }),
      });
      const d = await res.json();
      setMsgs([...next, { role: 'assistant', content: d.reply ?? d.error ?? 'Something went wrong.', recs: d.recommendations }]);
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'Could not connect. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed right-4 z-30 flex items-center gap-2 rounded-full bg-saffron px-5 py-3 font-display font-bold text-ink shadow-lg ${raised ? 'bottom-24' : 'bottom-5'}`}
          aria-label="Ask AI about the menu"
        >
          Ask AI
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Ask AI" className="sheet fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[78dvh] max-w-md flex-col rounded-t-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <div>
              <p className="font-display text-lg font-bold">Ask AI</p>
              <p className="text-xs text-ink/55">Table {tableNo || '–'} · answers come from this menu</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm font-semibold text-ink/70 hover:bg-ink/5">Close</button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug ${m.role === 'user' ? 'bg-leaf text-white' : 'bg-paper'}`}>
                  {m.content}
                  {m.recs?.length ? (
                    <div className="mt-2 space-y-1.5">
                      {m.recs.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-ink ring-1 ring-ink/10">
                          <span className="text-sm font-semibold">{r.name} <span className="font-normal text-ink/60">{inr(r.price_paise)}</span></span>
                          <button onClick={() => onAdd(r.id)} className="rounded-md bg-leaf px-3 py-1 text-sm font-bold text-white">Add</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {busy && <p className="text-sm text-ink/50">Thinking…</p>}
            <div ref={end} />
          </div>

          <div className="border-t border-ink/10 p-3">
            {msgs.length < 3 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)} className="rounded-full border border-ink/15 px-3 py-1 text-sm text-ink/80 hover:bg-paper">{q}</button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                maxLength={300}
                placeholder="Ask about a dish or request something"
                className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2.5 text-[15px]"
              />
              <button onClick={() => send(input)} disabled={busy || !input.trim()} className="rounded-lg bg-leaf px-4 font-bold text-white disabled:opacity-40">Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
