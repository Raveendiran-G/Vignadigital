import Link from 'next/link';

const links = [
  { href: '/menu?hotelId=H101&table=04', title: 'Diner menu', body: 'What a guest sees after scanning the QR on Table 04.' },
  { href: '/kitchen?hotelId=H101', title: 'Kitchen display', body: 'Live tickets. Packaged items never appear here. Passcode: vigna123' },
  { href: '/admin?hotelId=H101', title: 'Owner settings', body: 'Connect the hotel’s own Razorpay keys so payments settle straight to them.' },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-5xl font-extrabold tracking-tight text-leaf">Vigna Digital</h1>
      <p className="mt-3 max-w-prose text-lg text-ink/70">
        One flat subscription for QR menus, kitchen tickets, thermal bills and direct payments. No commission on any order.
      </p>
      <ul className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block py-5 hover:bg-leaf-tint/60">
              <span className="font-display text-xl font-bold">{l.title}</span>
              <span className="mt-1 block text-ink/65">{l.body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-ink/60">
        Demo hotel guest for “Charge to room”: <b>Arjun Mehta</b>, room <b>305</b>.
      </p>
    </main>
  );
}
