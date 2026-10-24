import { getHotel, getMenu } from '@/lib/db';
import MenuClient from '@/components/MenuClient';

export const dynamic = 'force-dynamic';

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ hotelId?: string; table?: string }>;
}) {
  const { hotelId, table = '' } = await searchParams;
  const hotel = hotelId ? await getHotel(hotelId) : null;

  if (!hotel) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold">We couldn’t open this menu</h1>
        <p className="mt-2 text-ink/65">Scan the QR code on your table again, or ask a member of staff.</p>
      </main>
    );
  }
  const menu = await getMenu(hotel.id);
  return <MenuClient hotel={hotel} menu={menu} table={table.slice(0, 10)} />;
}
