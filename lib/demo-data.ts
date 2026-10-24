import menu from '@/data/demo-menu.json';
import type { Hotel, MenuItem, RoomStay } from './types';

export const DEMO_HOTEL: Hotel = {
  id: 'H101',
  name: 'Hotel Vigna Residency',
  address: '12, Anna Salai, Chennai 600002',
  phone: '+91 44 4000 0101',
  gstin: '33ABCDE1234F1Z5',
  gst_rate: 5,
  footer_message: 'Thank you for dining with us. Visit again!',
  has_razorpay: false,
};

export const DEMO_MENU: MenuItem[] = menu.map((m, i) => ({
  id: `m${String(i + 1).padStart(2, '0')}`,
  hotel_id: DEMO_HOTEL.id,
  name: m.name,
  description: m.description,
  category: m.category as MenuItem['category'],
  price_paise: m.price * 100,
  is_veg: m.is_veg,
  spice_level: m.spice_level as MenuItem['spice_level'],
  image_url: null,
  is_kitchen_item: m.is_kitchen_item,
  is_available: true,
  allergens: m.allergens,
  sort: i,
}));

export const DEMO_STAY: RoomStay = {
  id: 'stay-305',
  hotel_id: DEMO_HOTEL.id,
  room_no: '305',
  guest_name: 'Arjun Mehta',
  phone: null,
  check_in: new Date(Date.now() - 86400e3).toISOString(),
  check_out: new Date(Date.now() + 3 * 86400e3).toISOString(),
  status: 'active',
};
