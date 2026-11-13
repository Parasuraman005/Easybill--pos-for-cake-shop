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
  const [selectedOrder, setSelectedOrder] = useState<CakeOrder | null>(null);

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';

  const loadDashboard = useCallback(async () => {
    try {
      const res = await apiRequest<DashboardSummary>('/api/dashboard');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load dashboard', 'error', err?.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 eb-card" />
          ))}
        </div>
        <div className="h-48 eb-card" />
        <div className="h-64 eb-card" />
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
    <div className="space-y-6">
      {/* A. Business Summary Cards — 3 cards in 1 row */}
      <section aria-label="Business summary">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Today's Total Sales */}
          <div className="eb-card p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#817A91] dark:text-[#A69FB8]">
                Today&apos;s Total Sales
              </p>
              <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums">
                {formatCurrency(summary.todaySales, sym)}
              </p>
              <p className="mt-1.5 text-xs font-medium text-[#817A91] dark:text-[#A69FB8] tabular-nums">
                {summary.todayBillCount} {summary.todayBillCount === 1 ? 'bill' : 'bills'} generated today
              </p>
            </div>
            <div className="w-11 h-11 rounded-[12px] bg-[#E9E2FF] dark:bg-[#7656C9]/25 text-[#7656C9] dark:text-[#C5B3F7] flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Monthly Total Sales */}
          <div className="eb-card p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#817A91] dark:text-[#A69FB8]">
                Monthly Total Sales
              </p>
              <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums">
                {formatCurrency(summary.monthlySales, sym)}
              </p>
              <p className="mt-1.5 text-xs font-medium text-[#817A91] dark:text-[#A69FB8] tabular-nums">
                {summary.monthlyBillCount} completed {summary.monthlyBillCount === 1 ? 'bill' : 'bills'} this month
              </p>
            </div>
            <div className="w-11 h-11 rounded-[12px] bg-[#7656C9] text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(118,86,201,0.25)]">
              <CalendarRange className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Monthly Total Expenses */}
          <div className="eb-card p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#817A91] dark:text-[#A69FB8]">
                Monthly Total Expenses
              </p>
              <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums">
                {formatCurrency(summary.monthlyExpenses, sym)}
              </p>
              <p className="mt-1.5 text-xs font-medium text-[#817A91] dark:text-[#A69FB8]">
                Recorded for current month
              </p>
            </div>
            <div className="w-11 h-11 rounded-[12px] bg-[#F3EFFE] dark:bg-[#2A233D] text-[#5B3FA8] dark:text-[#C5B3F7] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      {/* B. Pending Orders — Horizontally Scrollable Cards */}
      <section aria-label="Pending orders">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-[#302A40] dark:text-[#F3F1FA]">
              Pending Orders
            </h2>
            <span className="text-xs font-medium text-[#817A91] dark:text-[#A69FB8] tabular-nums">
              · {summary.pendingOrders.length} active
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#7656C9] hover:text-[#6947BB] dark:text-[#C5B3F7] whitespace-nowrap shrink-0"
          >
            <span>Manage Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {summary.pendingOrders.length === 0 ? (
          <div className="eb-card p-8 text-center">
            <ClipboardList className="w-8 h-8 mx-auto text-[#817A91]/50 mb-2" />
            <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
              No pending cake orders right now
            </p>
            <p className="text-xs font-medium text-[#817A91] mt-1">
              Switch to Orders mode in Billing to book a custom cake order.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto thin-scrollbar pb-2">
            {summary.pendingOrders.map((order) => (
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
                className="w-[300px] sm:w-[320px] shrink-0 text-left eb-card p-4 hover:border-[#7656C9] hover:shadow-[0_6px_18px_rgba(118,86,201,0.1)] transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#7656C9] dark:text-[#C5B3F7] tabular-nums">
                      {order.orderNumber}
                    </span>
                    <span className="text-xs font-semibold text-[#5B3FA8] dark:text-[#D9CEFF]">
                      {order.status}
                    </span>
                  </div>

                  <h3 className="mt-1.5 font-display text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA] truncate">
                    {order.customerName}
                  </h3>

                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#817A91] tabular-nums">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{order.customerPhone}</span>
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-[#EAE7F0] dark:border-[#2E2842] space-y-1 text-xs font-medium text-[#817A91] tabular-nums">
                    <div className="flex justify-between">
                      <span>Order Date</span>
                      <span className="text-[#302A40] dark:text-[#E9E2FF]">
                        {formatDateValue(order.orderDate, dateFmt)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#302A40] dark:text-[#E9E2FF]">
                      <span className="inline-flex items-center gap-1 text-[#817A91]">
                        <Clock className="w-3.5 h-3.5 text-[#7656C9]" />
                        Delivery
                      </span>
                      <span className="font-semibold">
                        {formatDateValue(order.deliveryDate, dateFmt)} · {order.deliveryTime}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#EAE7F0] dark:border-[#2E2842] flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-medium text-[#817A91]">Pending Balance</p>
                    <p className="font-display text-sm font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums">
                      {formatMoneyExact(order.balanceAmount, sym)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrintReceipt(orderToReceipt(order), true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* C. Recent Bills — Latest 6 Transactions */}
      <section aria-label="Recent bills">
        <div className="eb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EAE7F0] dark:border-[#2E2842] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#7656C9]" />
              <h2 className="font-display text-base font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                Recent Bills
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {summary.recentBills.length === 0 ? (
            <div className="p-8 text-center text-sm font-medium text-[#817A91]">
              No bills recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F7F7FB] dark:bg-[#151220] text-xs font-semibold text-[#817A91] border-b border-[#EAE7F0] dark:border-[#2E2842]">
                  <tr>
                    <th className="px-5 py-3">Bill Number</th>
                    <th className="px-5 py-3">Customer Name</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Payment Mode</th>
                    <th className="px-5 py-3">User Name</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
                  {summary.recentBills.map((bill: Bill) => (
                    <tr
                      key={bill.id}
                      className="hover:bg-[#F7F7FB]/80 dark:hover:bg-[#231E33] transition-colors"
                    >
                      <td className="px-5 py-3 text-xs font-semibold text-[#7656C9] dark:text-[#C5B3F7] tabular-nums whitespace-nowrap">
                        {bill.billNumber}
                      </td>
                      <td className="px-5 py-3 text-[#302A40] dark:text-[#F3F1FA] font-medium">
                        {bill.customerName || 'Walk-in Customer'}
                      </td>
                      <td className="px-5 py-3 text-right font-display font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums whitespace-nowrap">
                        {formatMoneyExact(bill.grandTotal, sym)}
                      </td>
                      <td className="px-5 py-3 text-xs font-medium text-[#817A91] dark:text-[#D9CEFF] whitespace-nowrap">
                        {bill.paymentMode}
                      </td>
                      <td className="px-5 py-3 text-xs font-medium text-[#817A91] whitespace-nowrap">
                        {bill.username}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onPrintReceipt(billToReceipt(bill), true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] text-xs font-semibold transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Order Detail Modal on Clicking Pending Order Card */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#302A40]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Order details"
        >
          <div className="w-full max-w-lg rounded-[14px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_16px_44px_rgba(48,42,64,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE7F0] dark:border-[#2E2842]">
              <div>
                <p className="text-xs font-semibold text-[#7656C9] tabular-nums">
                  {selectedOrder.orderNumber} · {selectedOrder.status}
                </p>
                <h3 className="font-display text-lg font-bold text-[#302A40] dark:text-[#F3F1FA]">
                  {selectedOrder.customerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-[10px] text-[#817A91] hover:text-[#302A40]"
                aria-label="Close order details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs bg-[#F7F7FB] dark:bg-[#13101C] p-3.5 rounded-[12px] border border-[#EAE7F0] dark:border-[#2E2842] tabular-nums">
                <div>
                  <span className="font-semibold text-[#817A91]">Phone</span>
                  <p className="font-semibold text-[#302A40] dark:text-[#F3F1FA] mt-0.5">
                    {selectedOrder.customerPhone}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-[#817A91]">Expected Delivery</span>
                  <p className="font-semibold text-[#302A40] dark:text-[#F3F1FA] mt-0.5">
                    {formatDateValue(selectedOrder.deliveryDate, dateFmt)} · {selectedOrder.deliveryTime}
                  </p>
                </div>
                {selectedOrder.customerAddress && (
                  <div className="col-span-2">
                    <span className="font-semibold text-[#817A91]">Address</span>
                    <p className="font-medium text-[#302A40] dark:text-[#F3F1FA] mt-0.5">
                      {selectedOrder.customerAddress}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-[#817A91] mb-2">
                  Ordered Items
                </h4>
                <div className="divide-y divide-[#EAE7F0] dark:divide-[#2E2842] border border-[#EAE7F0] dark:border-[#2E2842] rounded-[12px] overflow-hidden text-xs tabular-nums">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
                      <div>
                        <p className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                          {item.productName}
                        </p>
                        <p className="font-medium text-[#817A91]">
                          {item.quantity} {item.unit} × {formatMoneyExact(item.unitPrice, sym)}
                        </p>
                      </div>
                      <span className="font-display font-bold text-[#302A40] dark:text-[#F3F1FA]">
                        {formatMoneyExact(item.subtotal, sym)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="text-xs font-medium bg-[#F7F7FB] dark:bg-[#13101C] border border-[#EAE7F0] dark:border-[#2E2842] rounded-[12px] p-3 text-[#302A40] dark:text-[#E9E2FF]">
                  <span className="font-semibold text-[#7656C9]">Notes: </span>
                  {selectedOrder.notes}
                </div>
              )}

              <div className="space-y-1.5 text-sm border-t border-[#EAE7F0] dark:border-[#2E2842] pt-3 tabular-nums">
                <div className="flex justify-between font-medium text-[#817A91]">
                  <span>Order Total</span>
                  <span>{formatMoneyExact(selectedOrder.grandTotal, sym)}</span>
                </div>
                <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400">
                  <span>Advance Received</span>
                  <span>{formatMoneyExact(selectedOrder.advanceAmount, sym)}</span>
                </div>
                <div className="flex justify-between font-display font-bold text-[#302A40] dark:text-[#F3F1FA]">
                  <span>Pending Balance</span>
                  <span>{formatMoneyExact(selectedOrder.balanceAmount, sym)}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#151220] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  onNavigate('orders');
                }}
                className="px-4 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold transition-colors"
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Order Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
