import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Printer,
  Download,
  BarChart3,
  Eye,
  X,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import {
  formatDateValue,
  formatMoneyExact,
  formatTimeValue,
  formatYMDToDMY,
  getTodayYMD,
  salesTxToReceipt,
  toLocalYMD,
} from '../lib/format';
import { generateSalesHistoryPDF } from '../lib/salesPdf';
import type { ReceiptData, SalesTransaction } from '../types';

interface SalesPageProps {
  onPrintReceipt: (receipt: ReceiptData, autoPrint?: boolean) => void;
}

const PAGE_SIZE = 10;

interface DatePickerFieldProps {
  id: string;
  label: string;
  value: string;
  hasError?: boolean;
  onChange: (nextYmd: string) => void;
}

function DatePickerField({ id, label, value, hasError, onChange }: DatePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
        (el as HTMLInputElement & { showPicker: () => void }).showPicker();
      } else {
        el.focus();
      }
    } catch {
      el.focus();
    }
  };

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-[130px] sm:flex-none sm:min-w-[160px]">
      <label
        htmlFor={id}
        className="text-[13px] font-semibold text-[#817A91] dark:text-[#A69FB8] px-0.5"
      >
        {label}
      </label>
      <div
        onClick={openPicker}
        className={`relative flex items-center justify-between gap-2.5 px-3 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border transition-colors cursor-pointer ${
          hasError
            ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-500/15'
            : 'border-[#EAE7F0] dark:border-[#2E2842] hover:border-[#7656C9]/60 focus-within:border-[#7656C9] focus-within:ring-2 focus-within:ring-[#7656C9]/15'
        }`}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <Calendar className="w-4 h-4 text-[#7656C9] shrink-0" />
          <span className="text-xs font-semibold text-[#302A40] dark:text-[#F3F1FA] tabular-nums whitespace-nowrap">
            {value ? formatYMDToDMY(value) : 'DD-MM-YYYY'}
          </span>
        </div>
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

export function SalesPage({ onPrintReceipt }: SalesPageProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const todayYmd = useMemo(() => getTodayYMD(), []);

  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(todayYmd);
  const [toDate, setToDate] = useState(todayYmd);
  const [dateError, setDateError] = useState<string | null>(null);

  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [exportingPdf, setExportingPdf] = useState(false);

  const sym = settings.application.currencySymbol || '₹';

  const loadSales = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiRequest<SalesTransaction[]>('/api/sales');
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err?.message || 'Unable to retrieve sales records from the database.';
      setLoadError(msg);
      showToast('Failed to load sales history', 'error', msg);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const validateAndSetFromDate = (nextFrom: string) => {
    if (!nextFrom) return;
    setFromDate(nextFrom);
    if (toDate && nextFrom > toDate) {
      const errMsg = 'From Date cannot be later than To Date.';
      setDateError(errMsg);
      showToast('Invalid Date Range', 'error', errMsg);
    } else {
      setDateError(null);
    }
    setCurrentPage(1);
    setExpandedTxId(null);
  };

  const validateAndSetToDate = (nextTo: string) => {
    if (!nextTo) return;
    setToDate(nextTo);
    if (fromDate && fromDate > nextTo) {
      const errMsg = 'From Date cannot be later than To Date.';
      setDateError(errMsg);
      showToast('Invalid Date Range', 'error', errMsg);
    } else {
      setDateError(null);
    }
    setCurrentPage(1);
    setExpandedTxId(null);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    setExpandedTxId(null);
  };

  const handleResetFilters = () => {
    const freshToday = getTodayYMD();
    setSearch('');
    setFromDate(freshToday);
    setToDate(freshToday);
    setDateError(null);
    setCurrentPage(1);
    setExpandedTxId(null);
  };

  // Filtered dataset shared across Summary Card, Table, and PDF Export
  const filteredTransactions = useMemo(() => {
    if (dateError || (fromDate && toDate && fromDate > toDate)) {
      return [];
    }

    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');

    return transactions
      .filter((tx) => {
        const txYmd = toLocalYMD(tx.createdAt);
        if (fromDate && txYmd < fromDate) return false;
        if (toDate && txYmd > toDate) return false;

        if (!q) return true;

        const billMatch = (tx.billNumber || '').toLowerCase().includes(q);
        const orderMatch = (tx.orderNumber || '').toLowerCase().includes(q);
        const nameMatch = (tx.customerName || '').toLowerCase().includes(q);
        const phoneStr = (tx.customerPhone || '').toLowerCase();
        const phoneDigits = phoneStr.replace(/\D/g, '');
        const phoneMatch =
          phoneStr.includes(q) || (qDigits.length > 0 && phoneDigits.includes(qDigits));

        return billMatch || orderMatch || nameMatch || phoneMatch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, search, fromDate, toDate, dateError]);

  const summary = useMemo(() => {
    let totalSales = 0;
    let totalReceived = 0;
    let totalBalance = 0;
    for (const tx of filteredTransactions) {
      totalSales += tx.grandTotal;
      totalReceived += tx.amountReceived;
      totalBalance += tx.balanceAmount;
    }
    return {
      totalSales,
      totalReceived,
      totalBalance,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedTransactions = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, safePage]);

  const paginationItems = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: (number | 'ellipsis-left' | 'ellipsis-right')[] = [1];
    if (safePage > 3) items.push('ellipsis-left');
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let p = start; p <= end; p++) items.push(p);
    if (safePage < totalPages - 2) items.push('ellipsis-right');
    items.push(totalPages);
    return items;
  }, [totalPages, safePage]);

  const handleToggleExpand = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId));
  };

  const handleExportPdf = async () => {
    if (dateError) {
      showToast('Invalid Date Range', 'error', dateError);
      return;
    }
    if (filteredTransactions.length === 0) {
      showToast('No records to export', 'info', 'Adjust your date range or search filter first.');
      return;
    }

    setExportingPdf(true);
    try {
      const filename = await generateSalesHistoryPDF({
        transactions: filteredTransactions,
        fromDate,
        toDate,
        searchQuery: search,
        settings,
      });
      showToast('Sales PDF report downloaded', 'success', filename);
    } catch (err: any) {
      showToast('PDF export failed', 'error', err?.message || 'Unable to generate PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const formatQty = (qty: number, unit: string) => {
    const clean = Number.isInteger(qty) ? String(qty) : Number(qty).toFixed(2).replace(/\.?0+$/, '');
    return `${clean} ${unit}`;
  };

  const hasCustomFilter = search.trim() !== '' || fromDate !== todayYmd || toDate !== todayYmd;

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-[22px] sm:text-[26px] leading-tight font-bold text-[#302A40] dark:text-[#F3F1FA]">
            Sales History
          </h1>
          <p className="text-[14px] font-normal text-[#817A91] mt-0.5">
            Track walk-in bills and cake orders, inspect itemized receipts, print duplicates, and export A4 PDF reports.
          </p>
        </div>
      </div>

      {/* 1. Sales Summary Card */}
      <section aria-label="Sales Summary" className="eb-card p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-[12px] bg-[#E9E2FF] dark:bg-[#2B2342] text-[#7656C9] dark:text-[#C5B3F7] flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#817A91] dark:text-[#A69FB8]">
                Total Sales for Selected Period
              </p>
              <p className="mt-1 font-display text-[26px] sm:text-[28px] leading-tight font-bold tabular-nums text-[#302A40] dark:text-[#F3F1FA]">
                {formatMoneyExact(summary.totalSales, sym)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#817A91] dark:text-[#A69FB8] tabular-nums md:text-right">
            <span>
              Period:{' '}
              <strong className="font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                {fromDate === toDate
                  ? formatYMDToDMY(fromDate)
                  : `${formatYMDToDMY(fromDate)} to ${formatYMDToDMY(toDate)}`}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                {summary.count}
              </strong>{' '}
              {summary.count === 1 ? 'transaction' : 'transactions'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Received:{' '}
              <strong className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatMoneyExact(summary.totalReceived, sym)}
              </strong>
            </span>
            {summary.totalBalance > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Balance Due:{' '}
                  <strong className="font-semibold text-amber-700 dark:text-amber-400">
                    {formatMoneyExact(summary.totalBalance, sym)}
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. Search & Date Filter Section */}
      <section aria-label="Search and Date Filters" className="eb-card p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          {/* Search Input */}
          <div className="flex-1 flex flex-col gap-1">
            <label
              htmlFor="sales-search-input"
              className="text-[13px] font-semibold text-[#817A91] dark:text-[#A69FB8] px-0.5"
            >
              Search Transactions
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#817A91] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="sales-search-input"
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by Bill Number, Order Number, Customer Name or Phone Number..."
                className="w-full pl-10 pr-9 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs sm:text-sm font-medium text-[#302A40] dark:text-[#F3F1FA] placeholder:text-[#817A91]/80 focus:outline-none focus:border-[#7656C9] focus:ring-2 focus:ring-[#7656C9]/15 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-[8px] text-[#817A91] hover:text-[#302A40] dark:hover:text-white hover:bg-[#F7F7FB] dark:hover:bg-[#2A233D]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Date Pickers beside Search Box */}
          <div className="flex flex-wrap sm:flex-nowrap items-end gap-3 shrink-0">
            <DatePickerField
              id="sales-from-date"
              label="From Date"
              value={fromDate}
              hasError={Boolean(dateError)}
              onChange={validateAndSetFromDate}
            />
            <DatePickerField
              id="sales-to-date"
              label="To Date"
              value={toDate}
              hasError={Boolean(dateError)}
              onChange={validateAndSetToDate}
            />
            {hasCustomFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] dark:hover:bg-[#352C4D] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 h-[36px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Today</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Validation Banner */}
        {dateError && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{dateError}</span>
          </div>
        )}
      </section>

      {/* 3 & 4. Sales History Table with Expandable Transaction Details */}
      <section aria-label="Sales History Table" className="eb-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-10 rounded-[10px] bg-[#E9E2FF]/45 dark:bg-[#231C38]" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-[10px] bg-[#F7F7FB] dark:bg-[#151220]" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-9 h-9 mx-auto text-rose-500" />
            <div>
              <p className="font-display text-base font-bold text-[#302A40] dark:text-[#F3F1FA]">
                Unable to load sales transactions
              </p>
              <p className="text-xs font-medium text-[#817A91] mt-1">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={loadSales}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <BarChart3 className="w-10 h-10 mx-auto text-[#7656C9]/45" />
            <div>
              <p className="font-display text-base font-bold text-[#302A40] dark:text-[#F3F1FA]">
                {dateError
                  ? 'Please select a valid date range'
                  : 'No sales transactions match your filters'}
              </p>
              <p className="text-xs font-medium text-[#817A91] mt-1">
                {dateError
                  ? 'Ensure From Date is earlier than or equal to To Date.'
                  : 'Try expanding the From Date / To Date range or clearing the search box.'}
              </p>
            </div>
            {hasCustomFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Sales Card List */}
            <div className="md:hidden divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
              {paginatedTransactions.map((tx, idx) => {
                const serialNumber = (safePage - 1) * PAGE_SIZE + idx + 1;
                const isExpanded = expandedTxId === tx.id;
                const txDate = formatDateValue(tx.createdAt, 'DD-MM-YYYY');
                const txTime = formatTimeValue(tx.createdAt);

                return (
                  <div
                    key={tx.id}
                    className={`p-4 space-y-2.5 ${
                      isExpanded ? 'bg-[#F7F7FB] dark:bg-[#151220]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                          <span className="text-[#817A91] font-semibold">#{serialNumber}</span>
                          <span className="font-bold text-[#7656C9] dark:text-[#C5B3F7]">
                            {tx.billNumber}
                          </span>
                          {tx.orderNumber && (
                            <span className="font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                              · {tx.orderNumber}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA] truncate">
                          {tx.customerName || 'Walk-in Customer'}
                        </p>
                        <p className="text-[11px] font-medium text-[#817A91] tabular-nums">
                          {txDate} · {txTime}
                          {tx.customerPhone ? ` · ${tx.customerPhone}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display text-sm font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums">
                          {formatMoneyExact(tx.grandTotal, sym)}
                        </p>
                        <p className="text-[11px] font-semibold text-[#817A91]">
                          {tx.paymentMode}
                        </p>
                        {tx.balanceAmount > 0 && (
                          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                            Bal: {formatMoneyExact(tx.balanceAmount, sym)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onPrintReceipt(salesTxToReceipt(tx), true)}
                        aria-label={`Print receipt for ${tx.billNumber}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] text-xs font-semibold transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(tx.id)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Close' : 'View'} details for ${tx.billNumber}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors ${
                          isExpanded
                            ? 'bg-[#7656C9] text-white'
                            : 'bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF]'
                        }`}
                      >
                        {isExpanded ? <X className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'Close' : 'View'}</span>
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key={`mobile-details-${tx.id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden pt-2"
                        >
                          <div className="space-y-3 rounded-[12px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] p-3 text-xs tabular-nums">
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[#817A91]">
                              <span>
                                Type:{' '}
                                <strong className="text-[#302A40] dark:text-[#F3F1FA]">
                                  {tx.type === 'order' ? 'Cake Order' : 'Walk-in Bill'}
                                </strong>
                              </span>
                              <span>
                                Cashier:{' '}
                                <strong className="text-[#302A40] dark:text-[#F3F1FA]">
                                  {tx.username}
                                </strong>
                              </span>
                              {tx.orderStatus && (
                                <span>
                                  Status:{' '}
                                  <strong className="text-[#7656C9] dark:text-[#C5B3F7]">
                                    {tx.orderStatus}
                                  </strong>
                                </span>
                              )}
                            </div>

                            <div className="divide-y divide-[#EAE7F0] dark:divide-[#2E2842] border-t border-b border-[#EAE7F0] dark:border-[#2E2842]">
                              {tx.items.map((item, itemIdx) => (
                                <div key={`${item.productId}-${itemIdx}`} className="py-2 flex justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[#302A40] dark:text-[#F3F1FA] truncate">
                                      {item.productName}
                                    </p>
                                    <p className="text-[11px] text-[#817A91]">
                                      {formatQty(item.quantity, item.unit)} × {formatMoneyExact(item.unitPrice, sym)}
                                    </p>
                                  </div>
                                  <span className="font-semibold text-[#302A40] dark:text-[#F3F1FA] shrink-0">
                                    {formatMoneyExact(item.subtotal, sym)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-[#817A91]">Subtotal</span>
                                <span>{formatMoneyExact(tx.subtotal, sym)}</span>
                              </div>
                              {(tx.discountAmount > 0 || tx.discountPercent > 0) && (
                                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                                  <span>Discount ({tx.discountPercent}%)</span>
                                  <span>-{formatMoneyExact(tx.discountAmount, sym)}</span>
                                </div>
                              )}
                              {(tx.taxAmount > 0 || tx.taxRate > 0) && (
                                <div className="flex justify-between">
                                  <span className="text-[#817A91]">GST ({tx.taxRate}%)</span>
                                  <span>{formatMoneyExact(tx.taxAmount, sym)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-display font-bold text-sm pt-1 border-t border-[#EAE7F0] dark:border-[#2E2842]">
                                <span>Grand Total</span>
                                <span className="text-[#7656C9] dark:text-[#C5B3F7]">
                                  {formatMoneyExact(tx.grandTotal, sym)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#817A91]">Received</span>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  {formatMoneyExact(tx.amountReceived, sym)}
                                </span>
                              </div>
                              {tx.type === 'order' && (
                                <div className="flex justify-between font-semibold">
                                  <span className="text-[#817A91]">Balance</span>
                                  <span className={tx.balanceAmount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}>
                                    {formatMoneyExact(tx.balanceAmount, sym)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Desktop Sales Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[14px] text-left border-collapse">
                <thead className="bg-[#E9E2FF]/55 dark:bg-[#231C38] text-[13px] font-semibold text-[#302A40] dark:text-[#E9E2FF] border-b border-[#EAE7F0] dark:border-[#2E2842]">
                  <tr>
                    <th className="px-4 py-3.5 w-16 text-center whitespace-nowrap">S.No</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Bill / Order Number</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Customer Name</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">Amount</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Payment Mode</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">Print</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">View</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx, idx) => {
                    const serialNumber = (safePage - 1) * PAGE_SIZE + idx + 1;
                    const isExpanded = expandedTxId === tx.id;
                    const txDate = formatDateValue(tx.createdAt, 'DD-MM-YYYY');
                    const txTime = formatTimeValue(tx.createdAt);

                    return (
                      <React.Fragment key={tx.id}>
                        <tr
                          className={`border-b border-[#EAE7F0] dark:border-[#2E2842] transition-colors ${
                            isExpanded
                              ? 'bg-[#F7F7FB] dark:bg-[#231C38]/60'
                              : 'hover:bg-[#F7F7FB]/80 dark:hover:bg-[#231E33]'
                          }`}
                        >
                          <td className="px-4 py-3.5 text-center text-xs font-semibold text-[#817A91] tabular-nums whitespace-nowrap">
                            {serialNumber}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 tabular-nums">
                              <span className="text-xs sm:text-sm font-bold text-[#7656C9] dark:text-[#C5B3F7]">
                                {tx.billNumber}
                              </span>
                              {tx.orderNumber && (
                                <>
                                  <span aria-hidden="true" className="text-[#817A91]">·</span>
                                  <span className="text-xs font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                                    {tx.orderNumber}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="text-[11px] font-medium text-[#817A91] tabular-nums mt-0.5">
                              {txDate} · {txTime}
                            </p>
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="text-xs sm:text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                              {tx.customerName || 'Walk-in Customer'}
                            </p>
                            {tx.customerPhone && (
                              <p className="text-[11px] font-medium text-[#817A91] tabular-nums mt-0.5">
                                {tx.customerPhone}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className="font-display text-sm font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums">
                              {formatMoneyExact(tx.grandTotal, sym)}
                            </span>
                            {tx.balanceAmount > 0 && (
                              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
                                Bal: {formatMoneyExact(tx.balanceAmount, sym)}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-xs sm:text-sm font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                              {tx.paymentMode}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onPrintReceipt(salesTxToReceipt(tx), true)}
                              aria-label={`Print receipt for ${tx.billNumber}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] dark:hover:bg-[#352C4D] text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print</span>
                            </button>
                          </td>

                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleExpand(tx.id)}
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Close' : 'View'} details for ${tx.billNumber}`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors whitespace-nowrap min-w-[76px] justify-center ${
                                isExpanded
                                  ? 'bg-[#7656C9] hover:bg-[#6947BB] text-white'
                                  : 'bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] dark:hover:bg-[#352C4D]'
                              }`}
                            >
                              {isExpanded ? (
                                <>
                                  <X className="w-3.5 h-3.5" />
                                  <span>Close</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Transaction Details Dropdown Row */}
                        <tr
                          className={
                            isExpanded
                              ? 'border-b border-[#EAE7F0] dark:border-[#2E2842]'
                              : 'border-0'
                          }
                        >
                          <td colSpan={7} className="p-0">
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  key={`details-${tx.id}`}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                  className="overflow-hidden bg-[#F7F7FB] dark:bg-[#151220]"
                                >
                                  <div className="p-4 sm:p-5 space-y-4">
                                    {/* Quiet Transaction Meta Row */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[#817A91]">
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span>
                                          Type:{' '}
                                          <strong className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                                            {tx.type === 'order' ? 'Cake Order' : 'Walk-in Bill'}
                                          </strong>
                                        </span>
                                        {tx.orderStatus && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span>
                                              Order Status:{' '}
                                              <strong className="font-semibold text-[#7656C9] dark:text-[#C5B3F7]">
                                                {tx.orderStatus}
                                              </strong>
                                            </span>
                                          </>
                                        )}
                                        {tx.deliveryDate && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span className="tabular-nums">
                                              Delivery:{' '}
                                              <strong className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                                                {formatDateValue(tx.deliveryDate, 'DD-MM-YYYY')}{' '}
                                                {tx.deliveryTime || ''}
                                              </strong>
                                            </span>
                                          </>
                                        )}
                                        <span aria-hidden="true">·</span>
                                        <span>
                                          Cashier:{' '}
                                          <strong className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                                            {tx.username}
                                          </strong>
                                        </span>
                                      </div>
                                      {tx.customerAddress && (
                                        <span className="truncate max-w-md">
                                          Address: {tx.customerAddress}
                                        </span>
                                      )}
                                    </div>

                                    {/* Product Details Table + Payment Summary */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                                      {/* Product-Level Table */}
                                      <div className="lg:col-span-8 bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] rounded-[12px] overflow-hidden">
                                        <table className="w-full text-xs text-left">
                                          <thead className="bg-[#E9E2FF]/35 dark:bg-[#231C38] font-semibold text-[#302A40] dark:text-[#E9E2FF] border-b border-[#EAE7F0] dark:border-[#2E2842]">
                                            <tr>
                                              <th className="px-3.5 py-2.5">Product Name</th>
                                              <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                Quantity / Weight
                                              </th>
                                              <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                Rate
                                              </th>
                                              <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                Subtotal
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[#EAE7F0] dark:divide-[#2E2842] tabular-nums">
                                            {tx.items.map((item, itemIdx) => (
                                              <tr key={`${item.productId}-${itemIdx}`}>
                                                <td className="px-3.5 py-2.5 font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                                                  {item.productName}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-right font-medium text-[#817A91] whitespace-nowrap">
                                                  {formatQty(item.quantity, item.unit)}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-right font-medium text-[#817A91] whitespace-nowrap">
                                                  {formatMoneyExact(item.unitPrice, sym)}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-right font-semibold text-[#302A40] dark:text-[#F3F1FA] whitespace-nowrap">
                                                  {formatMoneyExact(item.subtotal, sym)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Totals & Payment Breakdown */}
                                      <div className="lg:col-span-4 bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] rounded-[12px] p-4 space-y-2 text-xs tabular-nums">
                                        <h4 className="font-display text-xs font-semibold text-[#817A91] pb-1.5 border-b border-[#EAE7F0] dark:border-[#2E2842]">
                                          Bill &amp; Payment Breakdown
                                        </h4>

                                        <div className="flex justify-between font-medium">
                                          <span className="text-[#817A91]">Subtotal</span>
                                          <span className="text-[#302A40] dark:text-[#F3F1FA]">
                                            {formatMoneyExact(tx.subtotal, sym)}
                                          </span>
                                        </div>

                                        {(tx.discountAmount > 0 || tx.discountPercent > 0) && (
                                          <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400">
                                            <span>
                                              Discount ({tx.discountPercent}%)
                                            </span>
                                            <span>-{formatMoneyExact(tx.discountAmount, sym)}</span>
                                          </div>
                                        )}

                                        {(tx.taxAmount > 0 || tx.taxRate > 0) && (
                                          <div className="flex justify-between font-medium">
                                            <span className="text-[#817A91]">
                                              GST / Tax ({tx.taxRate}%)
                                            </span>
                                            <span className="text-[#302A40] dark:text-[#F3F1FA]">
                                              {formatMoneyExact(tx.taxAmount, sym)}
                                            </span>
                                          </div>
                                        )}

                                        <div className="flex justify-between font-display text-sm font-bold pt-2 border-t border-[#EAE7F0] dark:border-[#2E2842] text-[#302A40] dark:text-[#F3F1FA]">
                                          <span>Grand Total</span>
                                          <span className="text-[#7656C9] dark:text-[#C5B3F7]">
                                            {formatMoneyExact(tx.grandTotal, sym)}
                                          </span>
                                        </div>

                                        <div className="pt-2 border-t border-[#EAE7F0] dark:border-[#2E2842] space-y-1.5">
                                          <div className="flex justify-between font-medium">
                                            <span className="text-[#817A91]">Payment Mode</span>
                                            <span className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                                              {tx.paymentMode}
                                            </span>
                                          </div>

                                          <div className="flex justify-between font-medium">
                                            <span className="text-[#817A91]">Amount Received</span>
                                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                              {formatMoneyExact(tx.amountReceived, sym)}
                                            </span>
                                          </div>

                                          {tx.type === 'order' && (
                                            <>
                                              <div className="flex justify-between font-medium">
                                                <span className="text-[#817A91]">Advance Amount</span>
                                                <span className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                                                  {formatMoneyExact(tx.advanceAmount, sym)}
                                                </span>
                                              </div>
                                              <div className="flex justify-between font-semibold">
                                                <span className="text-[#817A91]">Remaining Balance</span>
                                                <span
                                                  className={
                                                    tx.balanceAmount > 0
                                                      ? 'text-amber-700 dark:text-amber-400'
                                                      : 'text-emerald-700 dark:text-emerald-400'
                                                  }
                                                >
                                                  {formatMoneyExact(tx.balanceAmount, sym)}
                                                </span>
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        {tx.notes && (
                                          <div className="pt-2 border-t border-[#EAE7F0] dark:border-[#2E2842] text-[11px] font-medium text-[#817A91]">
                                            <span className="font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                                              Note:{' '}
                                            </span>
                                            {tx.notes}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredTransactions.length > PAGE_SIZE && (
              <div className="px-4 py-3 border-t border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB]/60 dark:bg-[#151220] flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium text-[#817A91] tabular-nums">
                  Showing{' '}
                  <strong className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                    {(safePage - 1) * PAGE_SIZE + 1}
                  </strong>
                  –
                  <strong className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                    {Math.min(safePage * PAGE_SIZE, filteredTransactions.length)}
                  </strong>{' '}
                  of{' '}
                  <strong className="font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                    {filteredTransactions.length}
                  </strong>{' '}
                  transactions
                </p>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      setExpandedTxId(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-semibold text-[#302A40] dark:text-[#E9E2FF] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#7656C9]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  {paginationItems.map((item) =>
                    typeof item === 'number' ? (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setCurrentPage(item);
                          setExpandedTxId(null);
                        }}
                        className={`w-8 h-8 rounded-[10px] text-xs font-semibold tabular-nums transition-colors ${
                          safePage === item
                            ? 'bg-[#7656C9] text-white'
                            : 'bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-[#817A91] hover:text-[#302A40] dark:hover:text-white'
                        }`}
                      >
                        {item}
                      </button>
                    ) : (
                      <span
                        key={item}
                        className="px-1 text-xs font-semibold text-[#817A91] select-none"
                      >
                        …
                      </span>
                    )
                  )}

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      setExpandedTxId(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-semibold text-[#302A40] dark:text-[#E9E2FF] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#7656C9]"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 6. Bottom Export to PDF Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <p className="text-xs font-medium text-[#817A91] tabular-nums">
          PDF export includes all{' '}
          <strong className="font-semibold text-[#302A40] dark:text-[#E9E2FF]">
            {filteredTransactions.length}
          </strong>{' '}
          matching transactions and itemized product details.
        </p>

        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exportingPdf || loading || Boolean(dateError)}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-[12px] bg-[#7656C9] hover:bg-[#6947BB] disabled:opacity-50 disabled:cursor-not-allowed text-white font-display text-[14px] font-bold tracking-wide shadow-[0_4px_14px_rgba(118,86,201,0.28)] transition-colors whitespace-nowrap shrink-0 w-full sm:w-auto"
        >
          {exportingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{exportingPdf ? 'GENERATING PDF...' : 'EXPORT TO PDF'}</span>
        </button>
      </div>
    </div>
  );
}
