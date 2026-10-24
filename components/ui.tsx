import type { MenuItem } from '@/lib/types';

/** FSSAI-style veg / non-veg mark. */
export function VegMark({ veg }: { veg: boolean }) {
  const c = veg ? '#2E8B3E' : '#B3261E';
  return (
    <span
      role="img"
      aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2"
      style={{ borderColor: c }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
    </span>
  );
}

export function Spice({ level }: { level: number }) {
  if (!level) return null;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Spice level ${level} of 3`}>
      {[1, 2, 3].map((i) => (
        <svg key={i} width="11" height="13" viewBox="0 0 11 13" aria-hidden="true">
          <path
            d="M7.5 1c1 .3 1.6 1 1.7 2 1.2 1 1.6 2.6 1 4.2C9.4 9.6 6.8 12 2 12.5c1.2-.9 1.8-1.8 2-2.9.2-1.4.8-2.5 1.8-3.4.3-1.4.8-3 1.7-5.2Z"
            fill={i <= level ? '#C0392B' : '#D9D9D4'}
          />
        </svg>
      ))}
    </span>
  );
}

const TINT: Record<string, string> = {
  Starters: '#F6E3B4',
  Mains: '#CFE3D7',
  Drinks: '#CFE0EA',
  Desserts: '#EBD3E0',
};

export function DishThumb({ item, size = 88 }: { item: MenuItem; size?: number }) {
  if (item.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.image_url} alt={item.name} width={size} height={size} loading="lazy" className="rounded-lg object-cover" style={{ width: size, height: size }} />;
  }
  const initials = item.name.split(' ').slice(0, 2).map((w) => w[0]).join('');
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center rounded-lg font-display text-2xl font-extrabold text-ink/40"
      style={{ width: size, height: size, background: TINT[item.category] }}
    >
      {initials}
    </div>
  );
}
