export type ModuleKey =
  | 'home'
  | 'billing'
  | 'orders'
  | 'sales'
  | 'products'
  | 'expenses'
  | 'settings';

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface UserPermissions {
  home: boolean;
  billing: boolean;
  orders: boolean;
  sales: boolean;
  products: boolean;
  expenses: boolean;
  settings: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  permissions: UserPermissions;
  active: boolean;
  createdAt: string;
}

export const DEFAULT_PRODUCT_CATEGORIES = [
  'Cakes',
  'Pastries',
  'Cupcakes',
  'Chocolates',
  'Cookies',
  'Desserts',
  'Snacks',
  'Beverages',
  'Others',
] as const;

export type ProductCategory = string;

export interface CategoryItem {
  id: string;
  name: string;
  isCustom: boolean;
  sortOrder: number;
  createdAt: string;
}

export type MeasurementUnit = 'KG' | 'Gram' | 'Piece';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  unit: MeasurementUnit;
  image: string;
  isFavorite: boolean;
  isActive: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  category: ProductCategory;
  unit: MeasurementUnit;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Advance';
export type ExpensePaymentMode = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready for Pickup'
  | 'Delivered'
  | 'Cancelled';

export interface OrderPaymentEntry {
  id: string;
  amount: number;
  mode: 'Cash' | 'UPI' | 'Card';
  date: string;
  username: string;
  note?: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  type: 'walkin' | 'order';
  orderId?: string | null;
  orderNumber?: string | null;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  paymentMode: PaymentMode;
  amountPaid: number;
  balanceAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Pending';
  userId: string;
  username: string;
  createdAt: string;
}

export type FulfillmentType = 'Pickup' | 'Delivery';

export interface CakeOrder {
  id: string;
  orderNumber: string;
  billId?: string | null;
  billNumber?: string | null;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  advanceAmount: number;
  balanceAmount: number;
  paymentMode: PaymentMode;
  paymentHistory: OrderPaymentEntry[];
  status: OrderStatus;
  fulfillmentType?: FulfillmentType;
  orderDate: string;
  deliveryDate: string;
  deliveryTime: string;
  notes: string;
  userId: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'Raw Materials'
  | 'Electricity'
  | 'Rent'
  | 'Employee Salary'
  | 'Packaging'
  | 'Transportation'
  | 'Maintenance'
  | 'Others';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMode: ExpensePaymentMode;
  userId: string;
  username: string;
  createdAt: string;
}

export interface CompanySettings {
  name: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
}

export type ThemePresetId = 'navy-teal' | 'charcoal-orange' | 'emerald-white' | 'midnight-gold';

export interface ApplicationSettings {
  appName: string;
  appLogo: string;
  theme: 'light' | 'dark';
  colorTheme?: ThemePresetId;
  dateFormat: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
  currencySymbol: string;
}

export interface BillingSettings {
  billPrefix: string;
  orderPrefix: string;
  gstEnabled: boolean;
  gstRate: number;
  defaultPaymentMode: 'Cash' | 'UPI' | 'Card';
  allowDiscount: boolean;
  maxDiscountPercent: number;
  receiptFooter: string;
}

export interface PrinterSettings {
  selectedPrinter: string;
  paperSize: '58mm' | '80mm' | 'A4';
  isConnected: boolean;
  autoPrint: boolean;
  copies: number;
}

export interface AllSettings {
  company: CompanySettings;
  application: ApplicationSettings;
  billing: BillingSettings;
  printer: PrinterSettings;
}

export interface DashboardSummary {
  todaySales: number;
  todayBillCount: number;
  monthlySales: number;
  monthlyBillCount: number;
  monthlyExpenses: number;
  todayCollections?: number;
  monthlyCollections?: number;
  pendingBalanceDue?: number;
  pendingOrders: CakeOrder[];
  recentBills: Bill[];
}

export interface BackupSummary {
  products: number;
  categories: number;
  customers: number;
  bills: number;
  orders: number;
  expenses: number;
  users: number;
}

export interface ReceiptData {
  billNumber: string;
  orderNumber?: string | null;
  type: 'walkin' | 'order';
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  paymentMode: PaymentMode;
  amountReceived: number;
  advanceAmount: number;
  balanceAmount: number;
  username: string;
  fulfillmentType?: FulfillmentType;
  orderStatus?: OrderStatus;
  deliveryDate?: string;
  deliveryTime?: string;
  notes?: string;
}

export interface SalesTransaction {
  id: string;
  billNumber: string;
  orderNumber: string | null;
  type: 'walkin' | 'order';
  orderId: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  paymentMode: PaymentMode;
  amountReceived: number;
  advanceAmount: number;
  balanceAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Pending';
  paymentHistory?: OrderPaymentEntry[];
  orderStatus?: OrderStatus | null;
  fulfillmentType?: FulfillmentType | null;
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  notes?: string | null;
  username: string;
  createdAt: string;
}
