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
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import {
  formatDateValue,
  formatMoneyExact,
  orderToReceipt,
} from '../lib/format';
import type { CakeOrder, FulfillmentType, OrderStatus, ReceiptData } from '../types';

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

function getStatusSelectClasses(status: OrderStatus): string {
  const base =
    'bg-[var(--eb-surface)] border-[var(--eb-border)] font-medium text-[12px]';
  switch (status) {
    case 'Delivered':
      return `${base} text-[#16A34A] border-emerald-300 dark:border-emerald-800/60`;
    case 'Ready for Pickup':
      return `${base} text-[var(--eb-accent)] border-[var(--eb-accent-border)]`;
    case 'Preparing':
    case 'Confirmed':
      return `${base} text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800/60`;
    case 'Cancelled':
      return `${base} text-[#DC2626] border-red-300 dark:border-red-800/60`;
    default:
      return `${base} text-[#F59E0B] border-amber-300 dark:border-amber-800/60`;
  }
}

export function OrdersPage({ onPrintReceipt }: OrdersPageProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<CakeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [dateFilter, setDateFilter] = useState('');

  const [editingOrder, setEditingOrder] = useState<CakeOrder | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    fulfillmentType: 'Pickup' as FulfillmentType,
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

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiRequest<CakeOrder[]>('/api/orders');
      setOrders(res);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load orders.';
      setLoadError(msg);
      showToast('Failed to load orders', 'error', msg);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!editingOrder && !paymentOrder) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (paymentOrder) setPaymentOrder(null);
        else if (editingOrder) setEditingOrder(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingOrder, paymentOrder]);

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
      fulfillmentType: order.fulfillmentType || 'Pickup',
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
    setPayMode(settings.billing.defaultPaymentMode || 'Cash');
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

  const handleStatusChange = async (order: CakeOrder, nextStatus: OrderStatus) => {
    if (order.status === nextStatus) return;
    const previousStatus = order.status;
    setUpdatingStatusId(order.id);
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
    );
    try {
      const updated = await apiRequest<CakeOrder>(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast(
        `Order ${updated.orderNumber} updated`,
        updated.status === 'Cancelled' ? 'warning' : 'success',
        `Status changed to ${updated.status}`
      );
    } catch (err: any) {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: previousStatus } : o))
      );
      showToast('Status update failed', 'error', err?.message);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleCancelOrder = async (order: CakeOrder) => {
    if (order.status === 'Cancelled') return;
    const previousStatus = order.status;
    setCancellingId(order.id);
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: 'Cancelled' } : o))
    );
    try {
      const updated = await apiRequest<CakeOrder>(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast(`Order ${updated.orderNumber} cancelled`, 'warning', 'Status set to Cancelled');
    } catch (err: any) {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: previousStatus } : o))
      );
      showToast('Could not cancel order', 'error', err?.message);
    } finally {
      setCancellingId(null);
    }
  };

  const totalBalanceDue = useMemo(
    () =>
      filteredOrders
        .filter((o) => o.status !== 'Cancelled')
        .reduce((sum, o) => sum + (o.balanceAmount || 0), 0),
    [filteredOrders]
  );

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[24px] font-semibold text-[var(--eb-text)] leading-tight">
            Cake Orders
          </h1>
          <p className="text-[13px] font-normal text-[var(--eb-text-muted)] mt-0.5 truncate">
            Track custom cake bookings, delivery schedules, advance payments, and balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
          <div className="relative flex-1 min-w-[200px] sm:flex-none">
            <Search className="w-4 h-4 text-[var(--eb-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order ID or customer..."
              className="pl-9 pr-3 h-[38px] rounded-[10px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[13px] font-medium text-[var(--eb-text)] w-full sm:w-56 focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
            />
          </div>

          <div className="relative flex-1 min-w-[140px] sm:flex-none">
            <Calendar className="w-3.5 h-3.5 text-[var(--eb-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by delivery date"
              className="w-full sm:w-auto pl-8 pr-2.5 h-[38px] rounded-[10px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[13px] font-medium text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
            />
          </div>

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="h-[38px] px-3 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto thin-scrollbar pb-0.5 shrink-0">
        {(['All', ...ORDER_STATUSES] as const).map((st) => {
          const count =
            st === 'All'
              ? orders.length
              : orders.filter((o) => o.status === st).length;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-[9px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 border inline-flex items-center gap-1.5 ${
                statusFilter === st
                  ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white shadow-sm'
                  : 'bg-[var(--eb-surface)] border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:border-[var(--eb-accent)] hover:text-[var(--eb-text)]'
              }`}
            >
              <span>{st}</span>
              <span
                className={`text-[11px] tabular-nums ${
                  statusFilter === st ? 'text-white/85' : 'text-[var(--eb-text-muted)]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders Table / Mobile Cards */}
      <div className="eb-card flex-1 min-h-0 flex flex-col overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-2.5 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-11 rounded-[10px] bg-[var(--eb-bg)]" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-10 text-center space-y-3 my-auto">
            <AlertCircle className="w-9 h-9 mx-auto text-[#DC2626]" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                Unable to load cake orders
              </p>
              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] mt-1">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={loadOrders}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-medium transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-10 sm:p-12 text-center my-auto">
            <ClipboardList className="w-9 h-9 mx-auto text-[var(--eb-text-muted)]/50 mb-2" />
            <p className="text-[14px] font-semibold text-[var(--eb-text)]">
              No matching cake orders
            </p>
            <p className="text-[12px] font-medium text-[var(--eb-text-muted)] mt-1">
              Create a new cake order from the Billing module using Orders mode.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Order Cards */}
            <div className="md:hidden divide-y divide-[var(--eb-border)]">
              {filteredOrders.map((order) => {
                const isCancelled = order.status === 'Cancelled';
                const canPay = order.balanceAmount > 0 && !isCancelled;
                const isBusy =
                  updatingStatusId === order.id || cancellingId === order.id;

                return (
                  <div key={order.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[12px] font-bold text-[var(--eb-accent)] tabular-nums">
                          {order.orderNumber}
                        </span>
                        <p className="font-semibold text-[14px] text-[var(--eb-text)] truncate">
                          {order.customerName}
                        </p>
                        <p className="text-[13px] font-medium text-[var(--eb-text-muted)] tabular-nums">
                          {order.customerPhone}
                        </p>
                      </div>

                      <select
                        value={order.status}
                        disabled={isBusy}
                        aria-label={`Status for order ${order.orderNumber}`}
                        onChange={(e) =>
                          handleStatusChange(order, e.target.value as OrderStatus)
                        }
                        className={`pl-3 pr-8 py-1.5 rounded-[10px] border text-[13px] font-semibold focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15 transition-colors shrink-0 disabled:opacity-60 ${getStatusSelectClasses(
                          order.status
                        )}`}
                      >
                        {ORDER_STATUSES.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {statusOption}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-[10px] bg-[var(--eb-bg)] border border-[var(--eb-border)] p-2.5 text-[12px] tabular-nums">
                      <div>
                        <span className="text-[var(--eb-text-muted)] block">Total</span>
                        <span className="font-bold text-[var(--eb-text)]">
                          {formatMoneyExact(order.grandTotal, sym)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--eb-text-muted)] block">Advance</span>
                        <span className="font-semibold text-[#16A34A]">
                          {formatMoneyExact(order.advanceAmount, sym)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--eb-text-muted)] block">Balance</span>
                        <span className="font-bold text-[var(--eb-text)]">
                          {formatMoneyExact(order.balanceAmount, sym)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="block text-[13px] font-medium text-[var(--eb-text-muted)] tabular-nums">
                        {order.fulfillmentType || 'Pickup'}: {formatDateValue(order.deliveryDate, dateFmt)} · {order.deliveryTime}
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={!canPay}
                          onClick={() => openPaymentModal(order)}
                          title={
                            isCancelled
                              ? 'Cannot record payment on a cancelled order'
                              : order.balanceAmount <= 0
                              ? 'Order paid in full'
                              : 'Record additional payment'
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed shadow-sm whitespace-nowrap shrink-0"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintReceipt(orderToReceipt(order), true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          disabled={isCancelled || isBusy}
                          onClick={() => handleCancelOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-[12px] font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Orders Table (Fits screen width cleanly, sticky header + internal scroll) */}
            <div className="hidden md:block flex-1 min-h-0 overflow-y-auto overflow-x-hidden thin-scrollbar">
              <table className="w-full table-fixed text-[13px] text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--eb-table-header-bg)] text-[12px] font-semibold text-[var(--eb-text-muted)] border-b border-[var(--eb-border)]">
                  <tr>
                    <th className="px-3 py-2.5 w-[11%]">Order ID</th>
                    <th className="px-2.5 py-2.5 w-[17%]">Customer</th>
                    <th className="px-2.5 py-2.5 w-[15%]">Schedule</th>
                    <th className="px-2.5 py-2.5 w-[15%]">Status</th>
                    <th className="px-2.5 py-2.5 w-[9%] text-right">Total</th>
                    <th className="px-2.5 py-2.5 w-[9%] text-right">Advance</th>
                    <th className="px-2.5 py-2.5 w-[9%] text-right">Balance</th>
                    <th className="px-3 py-2.5 w-[15%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--eb-border)]">
                  {filteredOrders.map((order) => {
                    const isCancelled = order.status === 'Cancelled';
                    const canPay = order.balanceAmount > 0 && !isCancelled;
                    const isBusy =
                      updatingStatusId === order.id || cancellingId === order.id;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-[var(--eb-table-row-hover)] transition-colors"
                      >
                        <td className="px-3 py-2.5 text-[13px] font-bold text-[var(--eb-accent)] tabular-nums truncate">
                          {order.orderNumber}
                        </td>
                        <td className="px-2.5 py-2.5 min-w-0">
                          <p className="font-semibold text-[13px] text-[var(--eb-text)] truncate">
                            {order.customerName}
                          </p>
                          <p className="text-[11px] font-medium text-[var(--eb-text-muted)] tabular-nums truncate">
                            {order.customerPhone}
                          </p>
                        </td>
                        <td className="px-2.5 py-2.5 text-[12px] tabular-nums min-w-0">
                          <p className="font-semibold text-[var(--eb-text)] truncate">
                            {formatDateValue(order.deliveryDate, dateFmt)}
                          </p>
                          <p className="text-[11px] font-medium text-[var(--eb-text-muted)] truncate">
                            {order.fulfillmentType || 'Pickup'} · {order.deliveryTime}
                          </p>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <select
                            value={order.status}
                            disabled={isBusy}
                            aria-label={`Status for order ${order.orderNumber}`}
                            onChange={(e) =>
                              handleStatusChange(order, e.target.value as OrderStatus)
                            }
                            className={`w-full pl-2.5 pr-7 py-1 rounded-[8px] border text-[12px] font-semibold focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15 transition-colors cursor-pointer disabled:opacity-60 ${getStatusSelectClasses(
                              order.status
                            )}`}
                          >
                            {ORDER_STATUSES.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {statusOption}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2.5 py-2.5 text-right text-[13px] font-bold text-[var(--eb-text)] tabular-nums whitespace-nowrap">
                          {formatMoneyExact(order.grandTotal, sym)}
                        </td>
                        <td className="px-2.5 py-2.5 text-right text-[13px] font-semibold text-[#16A34A] tabular-nums whitespace-nowrap">
                          {formatMoneyExact(order.advanceAmount, sym)}
                        </td>
                        <td className="px-2.5 py-2.5 text-right text-[13px] font-bold text-[var(--eb-text)] tabular-nums whitespace-nowrap">
                          {formatMoneyExact(order.balanceAmount, sym)}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(order)}
                              title="Modify order details"
                              aria-label={`Edit ${order.orderNumber}`}
                              className="p-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!canPay}
                              onClick={() => openPaymentModal(order)}
                              title={
                                isCancelled
                                  ? 'Cannot record payment on a cancelled order'
                                  : order.balanceAmount <= 0
                                  ? 'Order paid in full'
                                  : 'Record additional payment'
                              }
                              aria-label={`Pay ${order.orderNumber}`}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed shadow-sm whitespace-nowrap shrink-0"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Pay</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onPrintReceipt(orderToReceipt(order), true)}
                              title="Generate and print order invoice"
                              aria-label={`Print ${order.orderNumber}`}
                              className="p-1.5 rounded-[8px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isCancelled || isBusy}
                              onClick={() => handleCancelOrder(order)}
                              title={
                                isCancelled ? 'Order already cancelled' : 'Cancel order'
                              }
                              aria-label={`Cancel ${order.orderNumber}`}
                              className="p-1.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Compact Orders Summary Footer */}
            <div className="px-4 py-2 border-t border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] flex flex-wrap items-center justify-between gap-2 text-[12px] font-medium text-[var(--eb-text-muted)] shrink-0 tabular-nums">
              <span>
                Showing{' '}
                <strong className="font-semibold text-[var(--eb-text)]">
                  {filteredOrders.length}
                </strong>{' '}
                of{' '}
                <strong className="font-semibold text-[var(--eb-text)]">
                  {orders.length}
                </strong>{' '}
                {orders.length === 1 ? 'order' : 'orders'}
              </span>
              <span>
                Pending Balance Due:{' '}
                <strong className="font-bold text-[var(--eb-text)]">
                  {formatMoneyExact(totalBalanceDue, sym)}
                </strong>
              </span>
            </div>
          </>
        )}
      </div>

      {/* View /      {/* Edit Order Modal */}
      {editingOrder && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--eb-primary)]/60 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-[16px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--eb-border)]">
              <div>
                <p className="text-[12px] font-bold text-[var(--eb-accent)] tabular-nums">
                  {editingOrder.orderNumber}
                </p>
                <h3 className="text-[18px] font-semibold text-[var(--eb-text)]">
                  Order Details &amp; Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 rounded-[10px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={editForm.customerName}
                    onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))}
                    className="w-full px-3 h-[40px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.customerPhone}
                    onChange={(e) => setEditForm((f) => ({ ...f, customerPhone: e.target.value }))}
                    className="w-full px-3 h-[40px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Address</label>
                  <input
                    type="text"
                    value={editForm.customerAddress}
                    onChange={(e) => setEditForm((f) => ({ ...f, customerAddress: e.target.value }))}
                    className="w-full px-3 h-[40px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={editForm.deliveryDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                    className="w-full px-3 h-[40px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Delivery Time</label>
                  <input
                    type="time"
                    value={editForm.deliveryTime}
                    onChange={(e) => setEditForm((f) => ({ ...f, deliveryTime: e.target.value }))}
                    className="w-full px-3 h-[40px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Fulfillment</label>
                  <select
                    value={editForm.fulfillmentType}
                    onChange={(e) => setEditForm((f) => ({ ...f, fulfillmentType: e.target.value as FulfillmentType }))}
                    className="w-full pl-3 pr-9 h-[40px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  >
                    <option value="Pickup">Pickup</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Order Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as OrderStatus }))}
                    className="w-full pl-3 pr-9 h-[40px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Order Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full p-3 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
              </div>

              <div className="rounded-[12px] border border-[var(--eb-border)] p-3 bg-[var(--eb-bg)] text-[13px] space-y-2 tabular-nums">
                <p className="font-semibold text-[var(--eb-text)]">Items</p>
                {editingOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between font-medium text-[var(--eb-text-muted)]">
                    <span>
                      {it.productName} ({it.quantity} {it.unit})
                    </span>
                    <span className="font-semibold text-[var(--eb-text)]">
                      {formatMoneyExact(it.subtotal, sym)}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-[var(--eb-border)] space-y-1.5">
                  <div className="flex justify-between font-semibold text-[var(--eb-text)]">
                    <span>Payment History ({editingOrder.paymentHistory.length})</span>
                    <span>
                      Paid {formatMoneyExact(editingOrder.advanceAmount, sym)} / {formatMoneyExact(editingOrder.grandTotal, sym)}
                    </span>
                  </div>
                  {editingOrder.paymentHistory.length > 0 && (
                    <div className="divide-y divide-[var(--eb-border)] rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)]">
                      {editingOrder.paymentHistory.map((p) => (
                        <div key={p.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                          <div className="min-w-0">
                            <span className="font-semibold text-[var(--eb-text)]">{p.mode}</span>
                            <span className="text-[var(--eb-text-muted)]">
                              {' '}· {formatDateValue(p.date, dateFmt)} · {p.username}
                            </span>
                            {p.note && (
                              <span className="block text-[var(--eb-text-muted)] truncate">{p.note}</span>
                            )}
                          </div>
                          <span className="font-bold text-[#16A34A] shrink-0">
                            +{formatMoneyExact(p.amount, sym)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[14px] font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[14px] font-medium disabled:opacity-60 transition-colors shadow-sm whitespace-nowrap shrink-0"
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
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--eb-primary)]/60 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[16px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--eb-border)]">
              <div>
                <p className="text-[12px] font-bold text-[var(--eb-accent)] tabular-nums">
                  {paymentOrder.orderNumber}
                </p>
                <h3 className="text-[18px] font-semibold text-[var(--eb-text)]">Record Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentOrder(null)}
                className="p-1.5 rounded-[10px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div className="rounded-[12px] bg-[var(--eb-bg)] border border-[var(--eb-border)] p-3 text-[13px] space-y-1 tabular-nums">
                <div className="flex justify-between font-medium">
                  <span className="text-[var(--eb-text-muted)]">Order Total</span>
                  <span className="font-semibold text-[var(--eb-text)]">{formatMoneyExact(paymentOrder.grandTotal, sym)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-[var(--eb-text-muted)]">Already Received</span>
                  <span className="font-semibold text-[#16A34A]">
                    {formatMoneyExact(paymentOrder.advanceAmount, sym)}
                  </span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-[var(--eb-border)] text-[var(--eb-text)]">
                  <span>Pending Balance</span>
                  <span className="text-[var(--eb-accent)]">{formatMoneyExact(paymentOrder.balanceAmount, sym)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Amount Received ({sym})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentOrder.balanceAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 h-[42px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[14px] font-bold text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMode(m)}
                      className={`h-[40px] rounded-[10px] text-[13px] font-medium border transition-colors ${
                        payMode === m
                          ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white shadow-sm'
                          : 'bg-[var(--eb-btn-secondary-bg)] border-[var(--eb-border)] text-[var(--eb-btn-secondary-text)] hover:border-[var(--eb-accent)]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Balance settled on pickup"
                  className="w-full px-3 h-[40px] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentOrder(null)}
                  className="px-4 py-2 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[14px] font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPay}
                  className="px-4 py-2 rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white text-[14px] font-medium disabled:opacity-60 transition-colors shadow-sm whitespace-nowrap shrink-0"
                >
                  {savingPay ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
