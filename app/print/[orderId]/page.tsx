import { notFound } from 'next/navigation';
import PrintTrigger from '@/components/PrintTrigger';
import { getHotel, getOrder } from '@/lib/db';
import { rs } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { orderId } = await params;
  const { auto } = await searchParams;
  const order = await getOrder(orderId);
  if (!order) notFound();
  const hotel = (await getHotel(order.hotel_id))!;

  const when = new Date(order.created_at);
  const half = hotel.gst_rate / 2;
  const cgst = Math.floor(order.gst_paise / 2);
  const sgst = order.gst_paise - cgst;
  const payLine =
    order.payment_status === 'paid' ? 'PAID ONLINE'
    : order.payment_status === 'room_pending' ? `CHARGED TO ROOM ${order.room_no}`
    : 'PAYMENT PENDING';

  return (
    <div className="bg-gray-200 py-4 print:bg-white print:py-0">
      <PrintTrigger auto={auto === '1'} />
      <div className="receipt shadow">
        <div className="center">
          <div className="big">{hotel.name}</div>
          <div>{hotel.address}</div>
          <div>Tel: {hotel.phone}</div>
          <div>GSTIN: {hotel.gstin}</div>
        </div>
        <hr className="dash" />
        <div className="row"><span>Bill No:</span><span>VD-{order.order_no}</span></div>
        <div className="row"><span>Table:</span><span>{order.table_no}</span></div>
        <div className="row"><span>Date:</span><span>{when.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
        <div className="row"><span>Time:</span><span>{when.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</span></div>
        <div className="row"><span>Guest:</span><span>{order.customer_name}</span></div>
        <hr className="dash" />
        <div className="row"><span>ITEM</span><span>QTY  AMOUNT</span></div>
        <hr className="dash" />
        {order.items.map((i) => (
          <div key={i.id} style={{ marginBottom: 3 }}>
            <div className="item-name">{i.name}</div>
            <div className="row">
              <span>&nbsp;&nbsp;{i.qty} x {rs(i.unit_price_paise)}</span>
              <span>{rs(i.qty * i.unit_price_paise)}</span>
            </div>
          </div>
        ))}
        <hr className="dash" />
        <div className="row"><span>Subtotal</span><span>{rs(order.subtotal_paise)}</span></div>
        <div className="row"><span>CGST {half}%</span><span>{rs(cgst)}</span></div>
        <div className="row"><span>SGST {half}%</span><span>{rs(sgst)}</span></div>
        <hr className="dash" />
        <div className="row big"><span>GRAND TOTAL</span><span>{rs(order.total_paise)}</span></div>
        <hr className="dash" />
        <div className="center">{payLine}</div>
        <hr className="dash" />
        <div className="center">{hotel.footer_message}</div>
        <div className="center" style={{ marginTop: 6 }}>Powered by Vigna Digital</div>
        <div style={{ height: '8mm' }} />
      </div>
    </div>
  );
}
