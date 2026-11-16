import type { ApplicationSettings, Bill, CakeOrder, ReceiptData, SalesTransaction } from '../types';

export function formatCurrency(amount: number, symbol = '₹'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${symbol}${formatted}`;
}

export function formatMoneyExact(amount: number, symbol = '₹'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${symbol}${formatted}`;
}

export function formatDateValue(
  dateInput: string | Date,
  format: ApplicationSettings['dateFormat'] = 'DD-MM-YYYY'
): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return String(dateInput || '');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (format === 'MM-DD-YYYY') return `${month}-${day}-${year}`;
  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  return `${day}-${month}-${year}`;
}

export function formatYMD(
  ymd: string,
  format: ApplicationSettings['dateFormat'] = 'DD-MM-YYYY'
): string {
  if (!ymd) return '';
  const clean = String(ymd).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return ymd;
  const [year, month, day] = parts;
  if (format === 'MM-DD-YYYY') return `${month}-${day}-${year}`;
  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  return `${day}-${month}-${year}`;
}

export function formatYMDToDMY(ymd: string): string {
  return formatYMD(ymd, 'DD-MM-YYYY');
}

export function toLocalYMD(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatTimeValue(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDateTimeReadable(
  dateInput: string | Date,
  format: ApplicationSettings['dateFormat'] = 'DD-MM-YYYY'
): string {
  return `${formatDateValue(dateInput, format)} ${formatTimeValue(dateInput)}`;
}

export function getTodayYMD(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function billToReceipt(bill: Bill, linkedOrder?: CakeOrder | null): ReceiptData {
  return {
    billNumber: bill.billNumber,
    orderNumber: bill.orderNumber || linkedOrder?.orderNumber || null,
    type: bill.type,
    createdAt: bill.createdAt,
    customerName: bill.customerName,
    customerPhone: bill.customerPhone,
    customerAddress: bill.customerAddress,
    items: bill.items,
    subtotal: bill.subtotal,
    discountPercent: bill.discountPercent,
    discountAmount: bill.discountAmount,
    taxRate: bill.taxRate,
    taxAmount: bill.taxAmount,
    grandTotal: bill.grandTotal,
    paymentMode: bill.paymentMode,
    amountReceived: bill.amountPaid,
    advanceAmount: bill.type === 'order' ? bill.amountPaid : 0,
    balanceAmount: bill.balanceAmount,
    username: bill.username,
    fulfillmentType: linkedOrder?.fulfillmentType,
    orderStatus: linkedOrder?.status || (bill.type === 'order' ? 'Pending' : undefined),
    deliveryDate: linkedOrder?.deliveryDate,
    deliveryTime: linkedOrder?.deliveryTime,
    notes: linkedOrder?.notes,
  };
}

export function salesTxToReceipt(tx: SalesTransaction): ReceiptData {
  return {
    billNumber: tx.billNumber,
    orderNumber: tx.orderNumber || null,
    type: tx.type,
    createdAt: tx.createdAt,
    customerName: tx.customerName || 'Walk-in Customer',
    customerPhone: tx.customerPhone || '',
    customerAddress: tx.customerAddress || '',
    items: tx.items,
    subtotal: tx.subtotal,
    discountPercent: tx.discountPercent,
    discountAmount: tx.discountAmount,
    taxRate: tx.taxRate,
    taxAmount: tx.taxAmount,
    grandTotal: tx.grandTotal,
    paymentMode: tx.paymentMode,
    amountReceived: tx.amountReceived,
    advanceAmount: tx.type === 'order' ? tx.advanceAmount : 0,
    balanceAmount: tx.balanceAmount,
    username: tx.username,
    fulfillmentType: tx.fulfillmentType || undefined,
    orderStatus: tx.orderStatus || (tx.type === 'order' ? 'Pending' : undefined),
    deliveryDate: tx.deliveryDate || undefined,
    deliveryTime: tx.deliveryTime || undefined,
    notes: tx.notes || undefined,
  };
}

export function orderToReceipt(order: CakeOrder): ReceiptData {
  return {
    billNumber: order.billNumber || order.orderNumber,
    orderNumber: order.orderNumber,
    type: 'order',
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    items: order.items,
    subtotal: order.subtotal,
    discountPercent: order.discountPercent,
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    grandTotal: order.grandTotal,
    paymentMode: order.paymentMode,
    amountReceived: order.advanceAmount,
    advanceAmount: order.advanceAmount,
    balanceAmount: order.balanceAmount,
    username: order.username,
    fulfillmentType: order.fulfillmentType,
    orderStatus: order.status,
    deliveryDate: order.deliveryDate,
    deliveryTime: order.deliveryTime,
    notes: order.notes,
  };
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
