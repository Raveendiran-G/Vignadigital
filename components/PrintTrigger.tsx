'use client';

import { useEffect } from 'react';

export default function PrintTrigger({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400); // let fonts/layout settle first
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <div className="no-print mx-auto flex w-[80mm] max-w-full gap-2 py-4">
      <button onClick={() => window.print()} className="flex-1 rounded-lg bg-leaf py-3 font-bold text-white">Print bill</button>
      <button onClick={() => window.close()} className="rounded-lg border border-ink/20 px-4 py-3 font-semibold">Close</button>
    </div>
  );
}
