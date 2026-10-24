export const CATEGORIES = ['Starters', 'Mains', 'Drinks', 'Desserts'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Hotel {
  id: string;
  name: string;
  address: string;
  phone: string;
  gstin: string;
  gst_rate: number; // percent, e.g. 5
  footer_message: string;
  has_razorpay: boolean; // never expose the keys themselves
}

export interface MenuItem {
  id: string;
  hotel_id: string;
  name: string;
  description: string;
  category: Category;
  price_paise: number;
  is_veg: boolean;
  spice_level: 0 | 1 | 2 | 3;
  image_url: string | null;
  is_kitchen_item: boolean; // false = pre-packaged, never shown on the KOT
  is_available: boolean;
  allergens: string[];
  sort: number;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served';
export type PaymentMethod = 'online' | 'room';
export type PaymentStatus = 'pending_payment' | 'paid' | 'room_pending';

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  qty: number;
  unit_price_paise: number;
  is_kitchen_item: boolean;
  note: string | null;
}

export interface Order {
  id: string;
  order_no: number;
  hotel_id: string;
  customer_name: string;
  customer_phone: string;
  table_no: string;
  room_no: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  subtotal_paise: number;
  gst_paise: number;
  total_paise: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  stay_id: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface RoomStay {
  id: string;
  hotel_id: string;
  room_no: string;
  guest_name: string;
  phone: string | null;
  check_in: string;
  check_out: string;
  status: 'active' | 'checked_out';
}

export interface FolioEntry {
  id: string;
  stay_id: string;
  order_id: string;
  description: string;
  amount_paise: number;
  status: 'pending' | 'settled';
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  hotel_id: string;
  table_no: string;
  message: string;
  status: 'open' | 'done';
  created_at: string;
}

export interface CartLine {
  qty: number;
  note: string;
}
