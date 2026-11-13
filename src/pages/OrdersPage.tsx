import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Printer,
  Edit3,
  CreditCard,
  XCircle,
  X,
  ClipboardList,
  Calendar,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  formatDateValue,
  formatMoneyExact,
  orderToReceipt,
} from '../lib/format';
import type { CakeOrder, OrderStatus, ReceiptData } from '../types';

interface OrdersPageProps {
  onPrintReceipt: (receipt: ReceiptData, autoPrint?: boolean) => void;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready for Pickup',
  'Delivered',
  'Cancelled',
];

function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'Delivered':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Ready for Pickup':
      return 'text-[#7656C9] dark:text-[#C5B3F7]';
    case 'Preparing':
    case 'Confirmed':
      return 'text-[#5B3FA8] dark:text-[#D9CEFF]';
    case 'Cancelled':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-[#817A91] dark:text-[#A69FB8]';
  }
}

export function OrdersPage({ onPrintReceipt }: OrdersPageProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<CakeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [dateFilter, setDateFilter] = useState('');

  const [editingOrder, setEditingOrder] = useState<CakeOrder | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    deliveryDate: '',
    deliveryTime: '',
    status: 'Pending' as OrderStatus,
    notes: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [paymentOrder, setPaymentOrder] = useState<CakeOrder | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [payNote, setPayNote] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<CakeOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';

  const loadOrders = useCallback(async () => {
    try {
      const res = await apiRequest<CakeOrder[]>('/api/orders');
      setOrders(res);
    } catch (err: any) {
      showToast('Failed to load orders', 'error', err?.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q);
      const matchStatus = statusFilter === 'All' || o.status === statusFilter;
      const matchDate = !dateFilter || o.deliveryDate === dateFilter;
      return matchSearch && matchStatus && matchDate;
    });
  }, [orders, search, statusFilter, dateFilter]);

  const openEditModal = (order: CakeOrder) => {
    setEditingOrder(order);
    setEditForm({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      deliveryDate: order.deliveryDate,
      deliveryTime: order.deliveryTime,
      status: order.status,
      notes: order.notes,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    if (!editForm.customerName.trim() || !editForm.customerPhone.trim()) {
      showToast('Customer Name and Phone are required', 'error');
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await apiRequest<CakeOrder>(`/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setEditingOrder(null);
      showToast(`Order ${updated.orderNumber} updated`, 'success');
    } catch (err: any) {
      showToast('Update failed', 'error', err?.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const openPaymentModal = (order: CakeOrder) => {
    setPaymentOrder(order);
    setPayAmount(order.balanceAmount > 0 ? String(order.balanceAmount) : '');
    setPayMode('Cash');
    setPayNote('');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentOrder) return;
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Invalid Amount', 'error', 'Enter a positive payment amount.');
      return;
    }
    if (amt > paymentOrder.balanceAmount + 0.01) {
      showToast('Amount Too High', 'error', 'Payment cannot exceed remaining balance.');
      return;
    }

    setSavingPay(true);
    try {
      const updated = await apiRequest<CakeOrder>(`/api/orders/${paymentOrder.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount: amt, mode: payMode, note: payNote }),
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setPaymentOrder(null);
      showToast('Payment Recorded', 'success', `Remaining balance: ${formatMoneyExact(updated.balanceAmount, sym)}`);
    } catch (err: any) {
      showToast('Failed to record payment', 'error', err?.message);
    } finally {
      setSavingPay(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const updated = await apiRequest<CakeOrder>(`/api/orders/${cancelTarget.id}/cancel`, {
        method: 'POST',
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setCancelTarget(null);
      showToast(`Order ${updated.orderNumber} cancelled`, 'info');
    } catch (err: any) {
      showToast('Could not cancel order', 'error', err?.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[#302A40] dark:text-[#F3F1FA]">
            Cake Orders
          </h1>
          <p className="text-xs font-medium text-[#817A91] mt-0.5">
            Track custom cake bookings, delivery schedules, advance payments, and balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#817A91] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order ID or customer..."
              className="pl-9 pr-3 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-medium w-56 focus:outline-none focus:border-[#7656C9]"
            />
          </div>

          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-[#817A91] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by delivery date"
              className="pl-8 pr-2.5 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
            />
          </div>

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-3 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto thin-scrollbar pb-1">
        {(['All', ...ORDER_STATUSES] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-[10px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
              statusFilter === st
                ? 'bg-[#7656C9] border-[#7656C9] text-white'
                : 'bg-white dark:bg-[#1B1726] border-[#EAE7F0] dark:border-[#2E2842] text-[#817A91] hover:bg-[#E9E2FF]/50 hover:text-[#302A40]'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="eb-card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-[10px] bg-[#F7F7FB] dark:bg-[#13101C]" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-9 h-9 mx-auto text-[#817A91]/50 mb-2" />
            <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
              No matching cake orders
            </p>
            <p className="text-xs font-medium text-[#817A91] mt-1">
              Create a new cake order from the Billing module using Orders mode.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F7F7FB] dark:bg-[#151220] text-xs font-semibold text-[#817A91] border-b border-[#EAE7F0] dark:border-[#2E2842]">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Advance</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-[#F7F7FB]/80 dark:hover:bg-[#231E33] transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-bold text-[#7656C9] dark:text-[#C5B3F7] tabular-nums whitespace-nowrap">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                        {order.customerName}
                      </p>
                      <p className="text-xs font-medium text-[#817A91] tabular-nums">
                        {order.customerPhone}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap">
                      <p className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                        {formatDateValue(order.deliveryDate, dateFmt)}
                      </p>
                      <p className="font-medium text-[#817A91]">{order.deliveryTime}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-display text-xs font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums whitespace-nowrap">
                      {formatMoneyExact(order.grandTotal, sym)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {formatMoneyExact(order.advanceAmount, sym)}
                    </td>
                    <td className="px-4 py-3 text-right font-display text-xs font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums whitespace-nowrap">
                      {formatMoneyExact(order.balanceAmount, sym)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(order)}
                          title="View / Edit Order"
                          className="p-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {order.balanceAmount > 0 && order.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(order)}
                            title="Record Payment"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPrintReceipt(orderToReceipt(order), true)}
                          title="Print Receipt"
                          className="p-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194]"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {order.status !== 'Cancelled' && order.status !== 'Delivered' && (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(order)}
                            title="Cancel Order"
                            className="p-1.5 rounded-[10px] border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View / Edit Order Modal */}
      {editingOrder && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#302A40]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-[14px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_16px_44px_rgba(48,42,64,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE7F0] dark:border-[#2E2842]">
              <div>
                <p className="text-xs font-semibold text-[#7656C9] tabular-nums">
                  {editingOrder.orderNumber}
                </p>
                <h3 className="font-display text-base font-bold">
                  Order Details &amp; Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 rounded-[10px] text-[#817A91] hover:text-[#302A40]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={editForm.customerName}
                    onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.customerPhone}
                    onChange={(e) => setEditForm((f) => ({ ...f, customerPhone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Address</label>
                  <input
                    type="text"
                    value={editForm.customerAddress}
                    onChange={(e) => setEditForm((f) => ({ ...f, customerAddress: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={editForm.deliveryDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Delivery Time</label>
                  <input
                    type="time"
                    value={editForm.deliveryTime}
                    onChange={(e) => setEditForm((f) => ({ ...f, deliveryTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Order Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as OrderStatus }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-semibold focus:outline-none focus:border-[#7656C9]"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Order Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
              </div>

              <div className="rounded-[12px] border border-[#EAE7F0] dark:border-[#2E2842] p-3 bg-[#F7F7FB] dark:bg-[#13101C] text-xs space-y-1.5 tabular-nums">
                <p className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">Items</p>
                {editingOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between font-medium text-[#817A91]">
                    <span>
                      {it.productName} ({it.quantity} {it.unit})
                    </span>
                    <span className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                      {formatMoneyExact(it.subtotal, sym)}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-[#EAE7F0] dark:border-[#2E2842] flex justify-between font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                  <span>Payment History ({editingOrder.paymentHistory.length})</span>
                  <span>
                    Paid {formatMoneyExact(editingOrder.advanceAmount, sym)} / {formatMoneyExact(editingOrder.grandTotal, sym)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentOrder && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#302A40]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[14px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_16px_44px_rgba(48,42,64,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE7F0] dark:border-[#2E2842]">
              <div>
                <p className="text-xs font-semibold text-[#7656C9] tabular-nums">
                  {paymentOrder.orderNumber}
                </p>
                <h3 className="font-display text-base font-bold">Record Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentOrder(null)}
                className="p-1.5 rounded-[10px] text-[#817A91] hover:text-[#302A40]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div className="rounded-[12px] bg-[#F7F7FB] dark:bg-[#13101C] border border-[#EAE7F0] dark:border-[#2E2842] p-3 text-xs space-y-1 tabular-nums">
                <div className="flex justify-between font-medium">
                  <span className="text-[#817A91]">Order Total</span>
                  <span className="font-semibold">{formatMoneyExact(paymentOrder.grandTotal, sym)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-[#817A91]">Already Received</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatMoneyExact(paymentOrder.advanceAmount, sym)}
                  </span>
                </div>
                <div className="flex justify-between font-display font-bold pt-1 border-t border-[#EAE7F0] dark:border-[#2E2842]">
                  <span>Pending Balance</span>
                  <span>{formatMoneyExact(paymentOrder.balanceAmount, sym)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Amount Received ({sym})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentOrder.balanceAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-sm font-bold tabular-nums focus:outline-none focus:border-[#7656C9]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMode(m)}
                      className={`py-2 rounded-[10px] text-xs font-semibold border ${
                        payMode === m
                          ? 'bg-[#7656C9] border-[#7656C9] text-white'
                          : 'bg-[#E9E2FF]/55 dark:bg-[#2A233D] border-[#EAE7F0] dark:border-[#2E2842] text-[#4B3194] dark:text-[#D9CEFF]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Balance settled on pickup"
                  className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentOrder(null)}
                  className="px-4 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPay}
                  className="px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {savingPay ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Cake Order"
        description={`Are you sure you want to cancel order ${cancelTarget?.orderNumber} for ${cancelTarget?.customerName}?`}
        confirmLabel="Cancel Order"
        cancelLabel="Keep Order"
        variant="danger"
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
