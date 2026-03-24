export type Role = 'customer' | 'vendor' | 'admin' | 'pending';

export interface Banner {
  id?: string;
  imageUrl: string;
  link?: string;
  active: boolean;
  order: number;
  createdAt: any;
}

export interface User {
  uid: string;
  email: string;
  name: string;
  role: Role;
  createdAt: any;
  status: 'active' | 'suspended';
  isOnline?: boolean;
  lastSeen?: any;
}

export interface Store {
  id?: string;
  vendorId: string;
  name: string;
  description: string;
  category: string;
  location?: string;
  status: 'pending' | 'approved' | 'suspended';
  logoUrl?: string;
  bannerUrl?: string;
  commissionRate?: number; // percentage, e.g., 10 for 10%
  balance?: number; // current available balance for withdrawal
  totalEarned?: number; // lifetime earnings
  createdAt: any;
}

export interface Product {
  id?: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inventory: number;
  imageUrl: string;
  createdAt: any;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id?: string;
  customerId: string;
  storeId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payoutStatus?: 'pending' | 'credited';
  createdAt: any;
}

export interface Chat {
  id?: string;
  customerId: string;
  vendorId: string;
  storeId: string;
  lastMessage: string;
  updatedAt: any;
  type?: 'store_customer' | 'support';
  unreadCount?: Record<string, number>;
}

export interface Message {
  id?: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export interface Review {
  id?: string;
  productId: string;
  storeId: string;
  customerId: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface Coupon {
  id?: string;
  storeId: string;
  code: string;
  type: 'percentage' | 'fixed';
  amount: number;
  expiryDate: any;
  minPurchase: number;
  active: boolean;
  createdAt: any;
}

export interface Wishlist {
  id?: string;
  customerId: string;
  productIds: string[];
}

export interface Follow {
  id?: string;
  customerId: string;
  storeId: string;
  createdAt: any;
}

export interface Notification {
  id?: string;
  customerId: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: any;
}

export interface Payout {
  id?: string;
  storeId: string;
  vendorId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  method: string;
  details: string;
  createdAt: any;
  processedAt?: any;
}

export interface Transaction {
  id?: string;
  storeId: string;
  vendorId: string;
  orderId?: string;
  payoutId?: string;
  type: 'earning' | 'withdrawal';
  amount: number;
  commissionAmount?: number;
  description: string;
  createdAt: any;
}
