import React, { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
  CalendarRange,
  Wallet,
  Printer,
  ArrowRight,
  Clock,
  Phone,
  ClipboardList,
  Receipt,
  X,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import {
  billToReceipt,
  formatCurrency,
  formatDateValue,
  formatMoneyExact,
  orderToReceipt,
} from '../lib/format';
import type { Bill, CakeOrder, DashboardSummary, ModuleKey, ReceiptData } from '../types';

interface DashboardPageProps {
  onNavigate: (page: ModuleKey) => void;
  onPrintReceipt: (receipt: ReceiptData, autoPrint?: boolean) => void;
}

export function DashboardPage({ onNavigate, onPrintReceipt }: DashboardPageProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CakeOrder | null>(null);

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiRequest<DashboardSummary>('/api/dashboard');
      setData(res);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load dashboard summary.';
      setLoadError(msg);
      showToast('Failed to load dashboard', 'error', msg);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!selectedOrder) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedOrder(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedOrder]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 shrink-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 eb-card" />
          ))}
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 h-64 lg:h-full eb-card" />
          <div className="lg:col-span-7 h-64 lg:h-full eb-card" />
        </div>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="eb-card p-10 text-center space-y-3 my-auto max-w-lg mx-auto">
        <AlertCircle className="w-9 h-9 mx-auto text-[#DC2626]" />
        <div>
          <p className="text-[18px] font-semibold text-[var(--eb-text)]">
            Unable to load dashboard
          </p>
          <p className="text-[12px] font-normal text-[var(--eb-text-muted)] mt-1">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const summary = data || {
    todaySales: 0,
    todayBillCount: 0,
    monthlySales: 0,
    monthlyBillCount: 0,
    monthlyExpenses: 0,
    pendingOrders: [],
    recentBills: [],
  };

  return (
    <div className="flex flex-col gap-3.5 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* A. Business Summary Cards — 3 cards in 1 compact row */}
      <section aria-label="Business summary" className="shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Card 1: Today's Total Sales */}
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="eb-card px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:border-[var(--eb-accent)]/60 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] group-hover:text-[var(--eb-accent-text)] transition-colors">
                Today&apos;s Total Sales
              </p>
              <p className="mt-1 text-[22px] sm:text-[26px] leading-tight font-bold text-[var(--eb-text)] tabular-nums truncate">
                {formatCurrency(summary.todaySales, sym)}
              </p>
              <p className="mt-1 text-[12px] font-normal text-[var(--eb-text-muted)] tabular-nums truncate">
                {summary.todayBillCount} {summary.todayBillCount === 1 ? 'bill' : 'bills'}
                {typeof summary.todayCollections === 'number' && summary.todayCollections !== summary.todaySales
                  ? ` · Collected ${formatCurrency(summary.todayCollections, sym)}`
                  : ' generated today'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-[10px] bg-[var(--eb-accent-light)] text-[var(--eb-accent)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </button>

          {/* Card 2: Monthly Total Sales */}
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="eb-card px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:border-[var(--eb-accent)]/60 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] group-hover:text-[var(--eb-accent-text)] transition-colors">
                Monthly Total Sales
              </p>
              <p className="mt-1 text-[22px] sm:text-[26px] leading-tight font-bold text-[var(--eb-text)] tabular-nums truncate">
                {formatCurrency(summary.monthlySales, sym)}
              </p>
              <p className="mt-1 text-[12px] font-normal text-[var(--eb-text-muted)] tabular-nums truncate">
                {summary.monthlyBillCount} active {summary.monthlyBillCount === 1 ? 'bill' : 'bills'}
                {typeof summary.monthlyCollections === 'number' && summary.monthlyCollections !== summary.monthlySales
                  ? ` · Collected ${formatCurrency(summary.monthlyCollections, sym)}`
                  : ' this month'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-[10px] bg-[var(--eb-primary)] text-white flex items-center justify-center shrink-0 shadow-sm">
              <CalendarRange className="w-5 h-5" />
            </div>
          </button>

          {/* Card 3: Monthly Total Expenses */}
          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="eb-card px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:border-[var(--eb-accent)]/60 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] group-hover:text-[var(--eb-accent-text)] transition-colors">
                Monthly Total Expenses
              </p>
              <p className="mt-1 text-[22px] sm:text-[26px] leading-tight font-bold text-[var(--eb-text)] tabular-nums truncate">
                {formatCurrency(summary.monthlyExpenses, sym)}
              </p>
              <p className="mt-1 text-[12px] font-normal text-[var(--eb-text-muted)] tabular-nums truncate">
                {typeof summary.pendingBalanceDue === 'number' && summary.pendingBalanceDue > 0
                  ? `Receivables due: ${formatCurrency(summary.pendingBalanceDue, sym)}`
                  : 'Open Accounts & Ledger'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-[10px] bg-[var(--eb-btn-secondary-bg)] text-[var(--eb-btn-secondary-text)] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </button>
        </div>
      </section>

      {/* B + C: 12-Column Desktop Split — Pending Orders & Recent Bills */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* B. Pending Orders Panel */}
        <section
          aria-label="Pending orders"
          className="lg:col-span-5 eb-card flex flex-col min-h-[260px] lg:min-h-0 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[var(--eb-border)] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardList className="w-4 h-4 text-[var(--eb-accent)] shrink-0" />
              <h2 className="text-[16px] font-semibold text-[var(--eb-text)] truncate">
                Pending Orders
              </h2>
              <span className="text-[12px] font-medium text-[var(--eb-text-muted)] tabular-nums shrink-0">
                · {summary.pendingOrders.length} active
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <span>Manage Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {summary.pendingOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <ClipboardList className="w-8 h-8 text-[var(--eb-text-muted)]/50 mb-2" />
              <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                No pending cake orders right now
              </p>
              <p className="text-[12px] font-normal text-[var(--eb-text-muted)] mt-1">
                Switch to Orders mode in Billing to book a custom cake order.
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar divide-y divide-[var(--eb-border)]">
              {summary.pendingOrders.map((order) => {
                const statusColor =
                  order.status === 'Delivered'
                    ? 'text-[#16A34A]'
                    : order.status === 'Cancelled'
                    ? 'text-[#DC2626]'
                    : order.status === 'Ready for Pickup'
                    ? 'text-[var(--eb-accent)]'
                    : order.status === 'Confirmed' || order.status === 'Preparing'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-[#F59E0B]';

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedOrder(order);
                      }
                    }}
                    className="px-4 py-3 hover:bg-[var(--eb-table-row-hover)] transition-colors cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-[12px] tabular-nums">
                        <span className="font-bold text-[var(--eb-accent)]">
                          {order.orderNumber}
                        </span>
                        <span className={`font-semibold ${statusColor}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-[13px] font-semibold text-[var(--eb-text)] truncate">
                          {order.customerName}
                        </h3>
                        <span className="text-[12px] text-[var(--eb-text-muted)] tabular-nums inline-flex items-center gap-1 shrink-0">
                          <Phone className="w-3 h-3" />
                          {order.customerPhone}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[var(--eb-text-muted)] tabular-nums">
                        <span className="inline-flex items-center gap-1 text-[var(--eb-text)] font-medium">
                          <Clock className="w-3 h-3 text-[var(--eb-accent)]" />
                          {order.fulfillmentType || 'Pickup'}: {formatDateValue(order.deliveryDate, dateFmt)} · {order.deliveryTime}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--eb-text-muted)]">
                          Balance
                        </p>
                        <p className="text-[14px] font-bold text-[var(--eb-text)] tabular-nums">
                          {formatMoneyExact(order.balanceAmount, sym)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPrintReceipt(orderToReceipt(order), true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[7px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* C. Recent Bills Panel */}
        <section
          aria-label="Recent bills"
          className="lg:col-span-7 eb-card flex flex-col min-h-[260px] lg:min-h-0 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[var(--eb-border)] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[var(--eb-accent)]" />
              <h2 className="text-[16px] font-semibold text-[var(--eb-text)]">
                Recent Bills
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {summary.recentBills.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-[14px] font-normal text-[var(--eb-text-muted)]">
              No bills recorded yet.
            </div>
          ) : (
            <>
              {/* Mobile Recent Bills Card List */}
              <div className="md:hidden divide-y divide-[var(--eb-border)]">
                {summary.recentBills.map((bill: Bill) => (
                  <div key={bill.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 text-[12px] tabular-nums">
                        <span className="font-semibold text-[var(--eb-accent)]">
                          {bill.billNumber}
                        </span>
                        <span className="text-[var(--eb-text-muted)]">· {bill.paymentMode}</span>
                      </div>
                      <p className="text-[14px] font-semibold text-[var(--eb-text)] truncate">
                        {bill.customerName || 'Walk-in Customer'}
                      </p>
                      <p className="text-[12px] font-normal text-[var(--eb-text-muted)]">
                        Cashier: {bill.username}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1.5">
                      <p className="text-[14px] font-bold text-[var(--eb-text)] tabular-nums">
                        {formatMoneyExact(bill.grandTotal, sym)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onPrintReceipt(billToReceipt(bill), true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Recent Bills Table */}
              <div className="hidden md:block flex-1 min-h-0 overflow-y-auto overflow-x-hidden thin-scrollbar">
                <table className="w-full table-fixed text-[13px] text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-[var(--eb-table-header-bg)] text-[12px] font-semibold text-[var(--eb-text-muted)] border-b border-[var(--eb-border)]">
                    <tr>
                      <th className="px-3.5 py-2.5 w-[22%]">Bill Number</th>
                      <th className="px-3 py-2.5 w-[26%]">Customer Name</th>
                      <th className="px-3 py-2.5 w-[16%] text-right">Amount</th>
                      <th className="px-3 py-2.5 w-[12%]">Mode</th>
                      <th className="px-3 py-2.5 w-[12%]">Cashier</th>
                      <th className="px-3.5 py-2.5 w-[12%] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--eb-border)]">
                    {summary.recentBills.map((bill: Bill) => (
                      <tr
                        key={bill.id}
                        className="hover:bg-[var(--eb-table-row-hover)] transition-colors"
                      >
                        <td className="px-3.5 py-2.5 text-[13px] font-semibold text-[var(--eb-accent)] tabular-nums truncate">
                          {bill.billNumber}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--eb-text)] font-medium truncate">
                          {bill.customerName || 'Walk-in Customer'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-[var(--eb-text)] tabular-nums whitespace-nowrap">
                          {formatMoneyExact(bill.grandTotal, sym)}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-normal text-[var(--eb-text-muted)] truncate">
                          {bill.paymentMode}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-normal text-[var(--eb-text-muted)] truncate">
                          {bill.username}
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onPrintReceipt(billToReceipt(bill), true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[7px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Order Detail Modal on Clicking Pending Order Card */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--eb-primary)]/60 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Order details"
        >
          <div className="w-full max-w-lg rounded-[16px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--eb-border)]">
              <div>
                <p className="text-[12px] font-semibold text-[var(--eb-accent)] tabular-nums">
                  {selectedOrder.orderNumber} · {selectedOrder.status}
                </p>
                <h3 className="text-[18px] font-semibold text-[var(--eb-text)]">
                  {selectedOrder.customerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-[8px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]"
                aria-label="Close order details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px] bg-[var(--eb-bg)] p-3.5 rounded-[12px] border border-[var(--eb-border)] tabular-nums">
                <div>
                  <span className="font-medium text-[var(--eb-text-muted)]">Phone</span>
                  <p className="font-semibold text-[var(--eb-text)] mt-0.5">
                    {selectedOrder.customerPhone}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-[var(--eb-text-muted)]">
                    Expected {selectedOrder.fulfillmentType || 'Pickup'}
                  </span>
                  <p className="font-semibold text-[var(--eb-text)] mt-0.5">
                    {formatDateValue(selectedOrder.deliveryDate, dateFmt)} · {selectedOrder.deliveryTime}
                  </p>
                </div>
                {selectedOrder.customerAddress && (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-[var(--eb-text-muted)]">Address</span>
                    <p className="font-normal text-[var(--eb-text)] mt-0.5">
                      {selectedOrder.customerAddress}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-[var(--eb-text-muted)] mb-2">
                  Ordered Items
                </h4>
                <div className="divide-y divide-[var(--eb-border)] border border-[var(--eb-border)] rounded-[12px] overflow-hidden text-[13px] tabular-nums">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-3.5 py-2">
                      <div>
                        <p className="font-semibold text-[var(--eb-text)]">
                          {item.productName}
                        </p>
                        <p className="font-normal text-[12px] text-[var(--eb-text-muted)]">
                          {item.quantity} {item.unit} × {formatMoneyExact(item.unitPrice, sym)}
                        </p>
                      </div>
                      <span className="font-bold text-[var(--eb-text)]">
                        {formatMoneyExact(item.subtotal, sym)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="text-[12px] font-normal bg-[var(--eb-bg)] border border-[var(--eb-border)] rounded-[12px] p-3 text-[var(--eb-text)]">
                  <span className="font-semibold text-[var(--eb-accent)]">Notes: </span>
                  {selectedOrder.notes}
                </div>
              )}

              <div className="space-y-1.5 text-[14px] border-t border-[var(--eb-border)] pt-3 tabular-nums">
                <div className="flex justify-between font-normal text-[var(--eb-text-muted)]">
                  <span>Order Total</span>
                  <span>{formatMoneyExact(selectedOrder.grandTotal, sym)}</span>
                </div>
                <div className="flex justify-between font-normal text-[#16A34A]">
                  <span>Advance Received</span>
                  <span>{formatMoneyExact(selectedOrder.advanceAmount, sym)}</span>
                </div>
                <div className="flex justify-between font-bold text-[var(--eb-text)]">
                  <span>Pending Balance</span>
                  <span>{formatMoneyExact(selectedOrder.balanceAmount, sym)}</span>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3.5 border-t border-[var(--eb-border)] bg-[var(--eb-bg)] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  onNavigate('orders');
                }}
                className="px-4 py-2 rounded-[10px] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 text-[14px] font-medium transition-colors whitespace-nowrap shrink-0"
              >
                Open in Orders
              </button>
              <button
                type="button"
                onClick={() => {
                  const ord = selectedOrder;
                  setSelectedOrder(null);
                  onPrintReceipt(orderToReceipt(ord), true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-indigo-600 hover:bg-indigo-700 text-white text-[14px] font-medium transition-colors shadow-sm whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
