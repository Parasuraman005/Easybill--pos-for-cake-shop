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
  Wallet,
  Clock,
  RefreshCw,
  ShoppingBag,
  Cake,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import {
  formatDateValue,
  formatMoneyExact,
  formatTimeValue,
  formatYMD,
  getTodayYMD,
  salesTxToReceipt,
  toLocalYMD,
} from '../lib/format';
import { generateSalesHistoryPDF } from '../lib/salesPdf';
import type {
  ApplicationSettings,
  ModuleKey,
  PaymentMode,
  ReceiptData,
  SalesTransaction,
} from '../types';

interface SalesPageProps {
  onPrintReceipt: (receipt: ReceiptData, autoPrint?: boolean) => void;
  onNavigate?: (page: ModuleKey) => void;
}

const PAGE_SIZE = 10;

type DatePreset = 'today' | '7d' | 'month' | 'all' | 'custom';
type TypeFilter = 'all' | 'walkin' | 'order';
type PaymentFilter = 'all' | PaymentMode;

function shiftDaysYMD(baseYmd: string, deltaDays: number): string {
  const [y, m, d] = baseYmd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function getMonthStartYMD(baseYmd: string): string {
  const [y, m] = baseYmd.split('-');
  return `${y}-${m}-01`;
}

interface DatePickerFieldProps {
  id: string;
  label: string;
  value: string;
  dateFormat: ApplicationSettings['dateFormat'];
  placeholder?: string;
  hasError?: boolean;
  onChange: (nextYmd: string) => void;
}

function DatePickerField({
  id,
  label,
  value,
  dateFormat,
  placeholder = 'All Dates',
  hasError,
  onChange,
}: DatePickerFieldProps) {
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
    <div className="flex flex-col gap-1 min-w-[125px]">
      <label
        htmlFor={id}
        className="text-[12px] font-medium text-[var(--eb-text-muted)] px-0.5"
      >
        {label}
      </label>
      <div
        onClick={openPicker}
        className={`relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[10px] bg-[var(--eb-input-bg)] border transition-colors cursor-pointer h-[40px] ${
          hasError
            ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-500/15'
            : 'border-[var(--eb-border)] hover:border-[var(--eb-accent)]/60 focus-within:border-[var(--eb-accent)] focus-within:ring-2 focus-within:ring-[var(--eb-accent)]/15'
        }`}
      >
        <div className="flex items-center gap-1.5 pointer-events-none">
          <Calendar className="w-3.5 h-3.5 text-[var(--eb-accent)] shrink-0" />
          <span className="text-[13px] font-semibold text-[var(--eb-text)] tabular-nums whitespace-nowrap">
            {value ? formatYMD(value, dateFormat) : placeholder}
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

export function SalesPage({ onPrintReceipt, onNavigate }: SalesPageProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const todayYmd = useMemo(() => getTodayYMD(), []);

  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [fromDate, setFromDate] = useState(todayYmd);
  const [toDate, setToDate] = useState(todayYmd);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [dateError, setDateError] = useState<string | null>(null);

  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [exportingPdf, setExportingPdf] = useState(false);

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';

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

  const applyDatePreset = (preset: Exclude<DatePreset, 'custom'>) => {
    const freshToday = getTodayYMD();
    setDatePreset(preset);
    setDateError(null);
    setCurrentPage(1);
    setExpandedTxId(null);

    if (preset === 'today') {
      setFromDate(freshToday);
      setToDate(freshToday);
    } else if (preset === '7d') {
      setFromDate(shiftDaysYMD(freshToday, -6));
      setToDate(freshToday);
    } else if (preset === 'month') {
      setFromDate(getMonthStartYMD(freshToday));
      setToDate(freshToday);
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  const validateAndSetFromDate = (nextFrom: string) => {
    setDatePreset('custom');
    setFromDate(nextFrom);
    if (nextFrom && toDate && nextFrom > toDate) {
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
    setDatePreset('custom');
    setToDate(nextTo);
    if (fromDate && nextTo && fromDate > nextTo) {
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
    setDatePreset('today');
    setFromDate(freshToday);
    setToDate(freshToday);
    setTypeFilter('all');
    setPaymentFilter('all');
    setDateError(null);
    setCurrentPage(1);
    setExpandedTxId(null);
  };

  const filteredTransactions = useMemo(() => {
    if (dateError || (fromDate && toDate && fromDate > toDate)) {
      return [];
    }

    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');

    return transactions
      .filter((tx) => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (paymentFilter !== 'all' && tx.paymentMode !== paymentFilter) return false;

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
  }, [transactions, search, fromDate, toDate, typeFilter, paymentFilter, dateError]);

  const summary = useMemo(() => {
    let totalSales = 0;
    let totalReceived = 0;
    let totalBalance = 0;
    let walkinCount = 0;
    let orderCount = 0;
    let pendingBalanceCount = 0;

    for (const tx of filteredTransactions) {
      totalSales += tx.grandTotal;
      totalReceived += tx.amountReceived;
      totalBalance += tx.balanceAmount;
      if (tx.type === 'order') orderCount += 1;
      else walkinCount += 1;
      if (tx.balanceAmount > 0) pendingBalanceCount += 1;
    }

    const count = filteredTransactions.length;
    const avgBill = count > 0 ? totalSales / count : 0;

    return {
      totalSales,
      totalReceived,
      totalBalance,
      count,
      walkinCount,
      orderCount,
      pendingBalanceCount,
      avgBill,
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
      showToast('No records to export', 'info', 'Adjust your filters first.');
      return;
    }

    const sortedDates = filteredTransactions
      .map((tx) => toLocalYMD(tx.createdAt))
      .filter(Boolean)
      .sort();
    const effectiveFrom = fromDate || sortedDates[0] || todayYmd;
    const effectiveTo = toDate || sortedDates[sortedDates.length - 1] || todayYmd;

    setExportingPdf(true);
    try {
      const filename = await generateSalesHistoryPDF({
        transactions: filteredTransactions,
        fromDate: effectiveFrom,
        toDate: effectiveTo,
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

  const periodLabel = useMemo(() => {
    if (!fromDate && !toDate) return 'All Time';
    if (fromDate && toDate) {
      return fromDate === toDate
        ? formatYMD(fromDate, dateFmt)
        : `${formatYMD(fromDate, dateFmt)} – ${formatYMD(toDate, dateFmt)}`;
    }
    if (fromDate) return `From ${formatYMD(fromDate, dateFmt)}`;
    return `Up to ${formatYMD(toDate, dateFmt)}`;
  }, [fromDate, toDate, dateFmt]);

  const hasCustomFilter =
    search.trim() !== '' ||
    datePreset !== 'today' ||
    fromDate !== todayYmd ||
    toDate !== todayYmd ||
    typeFilter !== 'all' ||
    paymentFilter !== 'all';

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* 1. Compact Header with Top-Right Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[24px] font-semibold text-[var(--eb-text)] leading-tight">
            Sales History
          </h1>
          <p className="text-[13px] font-normal text-[var(--eb-text-muted)] mt-0.5 truncate">
            Inspect bills and cake orders, review itemized receipts, reprint invoices, and export A4 PDF reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadSales}
            disabled={loading}
            aria-label="Refresh sales"
            className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[10px] bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[13px] font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || loading || Boolean(dateError) || filteredTransactions.length === 0}
            className="inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[10px] bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{exportingPdf ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Compact 3-Card Sales Summary Grid */}
      <section aria-label="Sales Summary" className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div className="eb-card px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--eb-text-muted)]">
              Total Sales
            </p>
            <p className="mt-0.5 text-[22px] sm:text-[25px] leading-tight font-bold tabular-nums text-[var(--eb-text)]">
              {formatMoneyExact(summary.totalSales, sym)}
            </p>
            <p className="mt-0.5 text-[11px] font-normal text-[var(--eb-text-muted)] tabular-nums truncate">
              <strong className="font-semibold text-[var(--eb-text)]">
                {summary.count}
              </strong>{' '}
              {summary.count === 1 ? 'record' : 'records'} ({summary.walkinCount} walk-in,{' '}
              {summary.orderCount} orders)
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[var(--eb-accent)]/10 text-[var(--eb-accent)] flex items-center justify-center shrink-0">
            <BarChart3 className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="eb-card px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--eb-text-muted)]">
              Amount Collected
            </p>
            <p className="mt-0.5 text-[22px] sm:text-[25px] leading-tight font-bold tabular-nums text-[#16A34A]">
              {formatMoneyExact(summary.totalReceived, sym)}
            </p>
            <p className="mt-0.5 text-[11px] font-normal text-[var(--eb-text-muted)] tabular-nums truncate">
              Avg Ticket:{' '}
              <strong className="font-semibold text-[var(--eb-text)]">
                {formatMoneyExact(summary.avgBill, sym)}
              </strong>
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-[#16A34A] flex items-center justify-center shrink-0">
            <Wallet className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="eb-card px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--eb-text-muted)]">
              Balance Due
            </p>
            <p
              className={`mt-0.5 text-[22px] sm:text-[25px] leading-tight font-bold tabular-nums ${
                summary.totalBalance > 0
                  ? 'text-[#F59E0B]'
                  : 'text-[var(--eb-text)]'
              }`}
            >
              {formatMoneyExact(summary.totalBalance, sym)}
            </p>
            <p className="mt-0.5 text-[11px] font-normal text-[var(--eb-text-muted)] tabular-nums truncate">
              {summary.pendingBalanceCount > 0 ? (
                <span>
                  <strong className="font-semibold text-[#F59E0B]">
                    {summary.pendingBalanceCount}
                  </strong>{' '}
                  with pending balance · {periodLabel}
                </span>
              ) : (
                <span>Period: {periodLabel}</span>
              )}
            </p>
          </div>
          <div
            className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
              summary.totalBalance > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 text-[#F59E0B]'
                : 'bg-[var(--eb-accent)]/10 text-[var(--eb-accent)]'
            }`}
          >
            <Clock className="w-4.5 h-4.5" />
          </div>
        </div>
      </section>

      {/* 3. Compact Unified Filter Toolbar */}
      <section aria-label="Sales Filters" className="eb-card p-2.5 space-y-2 shrink-0">
        {/* Top Bar: Date Range Presets + Sales Type Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-[var(--eb-border)]">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7d', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDatePreset(preset.id)}
                className={`px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition-colors ${
                  datePreset === preset.id
                    ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                    : 'bg-[var(--eb-surface-subtle)] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] border border-[var(--eb-border)]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-[10px] p-1 bg-[var(--eb-surface-subtle)] border border-[var(--eb-border)] self-start md:self-auto">
            {(
              [
                { id: 'all', label: 'All Sales' },
                { id: 'walkin', label: 'Walk-in' },
                { id: 'order', label: 'Cake Orders' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTypeFilter(opt.id);
                  setCurrentPage(1);
                  setExpandedTxId(null);
                }}
                className={`px-3 py-1 rounded-[8px] text-[13px] font-medium transition-colors whitespace-nowrap ${
                  typeFilter === opt.id
                    ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                    : 'text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Bar: Search, Payment Mode, From Date, To Date, Reset */}
        <div className="flex flex-col lg:flex-row lg:items-end gap-2.5">
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <label
              htmlFor="sales-search-input"
              className="text-[12px] font-medium text-[var(--eb-text-muted)] px-0.5"
            >
              Search Transactions
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--eb-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="sales-search-input"
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by Bill No, Order No, Customer Name or Phone..."
                className="w-full h-[40px] pl-9 pr-8 py-1.5 rounded-[10px] bg-[var(--eb-input-bg)] border border-[var(--eb-border)] text-[13px] font-medium text-[var(--eb-text)] placeholder:text-[var(--eb-text-muted)]/70 focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-[8px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-end gap-2.5 shrink-0">
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label
                htmlFor="sales-payment-filter"
                className="text-[12px] font-medium text-[var(--eb-text-muted)] px-0.5"
              >
                Payment Mode
              </label>
              <select
                id="sales-payment-filter"
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value as PaymentFilter);
                  setCurrentPage(1);
                  setExpandedTxId(null);
                }}
                className="h-[40px] pl-3 pr-9 py-1.5 rounded-[10px] bg-[var(--eb-input-bg)] border border-[var(--eb-border)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
              >
                <option value="all">All Modes</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Advance">Advance</option>
              </select>
            </div>

            <DatePickerField
              id="sales-from-date"
              label="From Date"
              value={fromDate}
              dateFormat={dateFmt}
              placeholder="Start"
              hasError={Boolean(dateError)}
              onChange={validateAndSetFromDate}
            />
            <DatePickerField
              id="sales-to-date"
              label="To Date"
              value={toDate}
              dateFormat={dateFmt}
              placeholder="End"
              hasError={Boolean(dateError)}
              onChange={validateAndSetToDate}
            />

            {hasCustomFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 h-[40px] rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Validation Banner */}
        {dateError && (
          <div
            role="alert"
            className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-[#DC2626]"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{dateError}</span>
          </div>
        )}
      </section>

      {/* 4. Sales History Table (Fits viewport height & width cleanly) */}
      <section aria-label="Sales History Table" className="eb-card flex-1 min-h-0 flex flex-col overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-2.5 animate-pulse">
            <div className="h-9 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-11 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-10 text-center space-y-3 my-auto">
            <AlertCircle className="w-9 h-9 mx-auto text-[#DC2626]" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                Unable to load sales transactions
              </p>
              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] mt-1">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={loadSales}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-10 text-center space-y-3 my-auto">
            <BarChart3 className="w-10 h-10 mx-auto text-[var(--eb-accent)]/45" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                {dateError
                  ? 'Please select a valid date range'
                  : 'No sales transactions match your filters'}
              </p>
              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] mt-1">
                {dateError
                  ? 'Ensure From Date is earlier than or equal to To Date.'
                  : 'Try switching to Last 7 Days / All Time or clearing active filters.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {datePreset === 'today' && !dateError && (
                <button
                  type="button"
                  onClick={() => applyDatePreset('all')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-sky-600 hover:bg-sky-700 text-white text-[14px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <span>View All Time</span>
                </button>
              )}
              {hasCustomFilter && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Sales Card List */}
            <div className="md:hidden divide-y divide-[var(--eb-border)]">
              {paginatedTransactions.map((tx, idx) => {
                const serialNumber = (safePage - 1) * PAGE_SIZE + idx + 1;
                const isExpanded = expandedTxId === tx.id;
                const txDate = formatDateValue(tx.createdAt, dateFmt);
                const txTime = formatTimeValue(tx.createdAt);
                const isPaid = tx.balanceAmount <= 0;

                return (
                  <div
                    key={tx.id}
                    className={`p-3.5 space-y-2.5 ${
                      isExpanded ? 'bg-[var(--eb-surface-subtle)]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[12px] tabular-nums">
                          <span className="text-[var(--eb-text-muted)] font-semibold">#{serialNumber}</span>
                          <span className="font-bold text-[var(--eb-accent)]">
                            {tx.billNumber}
                          </span>
                          {tx.orderNumber && (
                            <span className="font-semibold text-[var(--eb-text)]">
                              · {tx.orderNumber}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold ${
                              tx.type === 'order'
                                ? 'bg-[var(--eb-accent)]/10 text-[var(--eb-accent)]'
                                : 'bg-[var(--eb-surface-subtle)] text-[var(--eb-text)] border border-[var(--eb-border)]'
                            }`}
                          >
                            {tx.type === 'order' ? 'Order' : 'Walk-in'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[14px] font-semibold text-[var(--eb-text)] truncate">
                          {tx.customerName || 'Walk-in Customer'}
                        </p>
                        <p className="text-[11px] font-medium text-[var(--eb-text-muted)] tabular-nums">
                          {txDate} · {txTime}
                          {tx.customerPhone ? ` · ${tx.customerPhone}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-bold text-[var(--eb-text)] tabular-nums">
                          {formatMoneyExact(tx.grandTotal, sym)}
                        </p>
                        <p className="text-[11px] font-semibold text-[var(--eb-text-muted)]">
                          {tx.paymentMode} ·{' '}
                          <span
                            className={
                              isPaid
                                ? 'text-[#16A34A]'
                                : 'text-[#F59E0B]'
                            }
                          >
                            {isPaid ? 'Paid' : `Bal ${formatMoneyExact(tx.balanceAmount, sym)}`}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onPrintReceipt(salesTxToReceipt(tx), true)}
                        aria-label={`Print receipt for ${tx.billNumber}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(tx.id)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Close' : 'View'} details for ${tx.billNumber}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isExpanded
                            ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                            : 'bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60'
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
                          <div className="space-y-3 rounded-[12px] bg-[var(--eb-surface)] border border-[var(--eb-border)] p-3 text-[12px] tabular-nums">
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--eb-text-muted)]">
                              <span>
                                Type:{' '}
                                <strong className="text-[var(--eb-text)]">
                                  {tx.type === 'order' ? 'Cake Order' : 'Walk-in Bill'}
                                </strong>
                              </span>
                              <span>
                                Cashier:{' '}
                                <strong className="text-[var(--eb-text)]">
                                  {tx.username}
                                </strong>
                              </span>
                              {tx.orderStatus && (
                                <span>
                                  Status:{' '}
                                  <strong className="text-[var(--eb-accent)]">
                                    {tx.orderStatus}
                                  </strong>
                                </span>
                              )}
                            </div>

                            <div className="divide-y divide-[var(--eb-border)] border-t border-b border-[var(--eb-border)]">
                              {tx.items.map((item, itemIdx) => (
                                <div key={`${item.productId}-${itemIdx}`} className="py-2 flex justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[var(--eb-text)] truncate">
                                      {item.productName}
                                    </p>
                                    <p className="text-[11px] text-[var(--eb-text-muted)]">
                                      {formatQty(item.quantity, item.unit)} × {formatMoneyExact(item.unitPrice, sym)}
                                    </p>
                                  </div>
                                  <span className="font-semibold text-[var(--eb-text)] shrink-0">
                                    {formatMoneyExact(item.subtotal, sym)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-[var(--eb-text-muted)]">Subtotal</span>
                                <span>{formatMoneyExact(tx.subtotal, sym)}</span>
                              </div>
                              {(tx.discountAmount > 0 || tx.discountPercent > 0) && (
                                <div className="flex justify-between text-[#16A34A]">
                                  <span>Discount ({tx.discountPercent}%)</span>
                                  <span>-{formatMoneyExact(tx.discountAmount, sym)}</span>
                                </div>
                              )}
                              {(tx.taxAmount > 0 || tx.taxRate > 0) && (
                                <div className="flex justify-between">
                                  <span className="text-[var(--eb-text-muted)]">GST ({tx.taxRate}%)</span>
                                  <span>{formatMoneyExact(tx.taxAmount, sym)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-[13px] pt-1 border-t border-[var(--eb-border)]">
                                <span>Grand Total</span>
                                <span className="text-[var(--eb-accent)]">
                                  {formatMoneyExact(tx.grandTotal, sym)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[var(--eb-text-muted)]">Received</span>
                                <span className="font-semibold text-[#16A34A]">
                                  {formatMoneyExact(tx.amountReceived, sym)}
                                </span>
                              </div>
                              {tx.type === 'order' && (
                                <div className="flex justify-between font-semibold">
                                  <span className="text-[var(--eb-text-muted)]">Balance</span>
                                  <span className={tx.balanceAmount > 0 ? 'text-[#F59E0B]' : 'text-[#16A34A]'}>
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

            {/* Desktop Sales Table (No horizontal scroll, internal vertical scroll) */}
            <div className="hidden md:block flex-1 min-h-0 overflow-y-auto overflow-x-hidden thin-scrollbar">
              <table className="w-full table-fixed text-[13px] text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--eb-table-header-bg)] text-[12px] font-semibold text-[var(--eb-text-muted)] border-b border-[var(--eb-border)]">
                  <tr>
                    <th className="px-2.5 lg:px-3 py-3 w-[6%] text-center">S.No</th>
                    <th className="px-2.5 lg:px-3 py-3 w-[22%]">Bill / Order No.</th>
                    <th className="px-2.5 lg:px-3 py-3 w-[20%]">Customer</th>
                    <th className="px-2.5 lg:px-3 py-3 w-[16%]">Type &amp; Status</th>
                    <th className="px-2.5 lg:px-3 py-3 w-[13%]">Payment</th>
                    <th className="px-2.5 lg:px-3 py-3 w-[12%] text-right">Amount</th>
                    <th className="px-2.5 lg:px-3 py-3 w-[11%] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx, idx) => {
                    const serialNumber = (safePage - 1) * PAGE_SIZE + idx + 1;
                    const isExpanded = expandedTxId === tx.id;
                    const txDate = formatDateValue(tx.createdAt, dateFmt);
                    const txTime = formatTimeValue(tx.createdAt);
                    const isPaid = tx.balanceAmount <= 0;
                    const itemsCount = tx.items?.length || 0;

                    return (
                      <React.Fragment key={tx.id}>
                        <tr
                          className={`border-b border-[var(--eb-border)] transition-colors ${
                            isExpanded
                              ? 'bg-[var(--eb-surface-subtle)]'
                              : 'hover:bg-[var(--eb-table-row-hover)]'
                          }`}
                        >
                          <td className="px-2.5 lg:px-3 py-2.5 text-center text-[12px] font-semibold text-[var(--eb-text-muted)] tabular-nums">
                            {serialNumber}
                          </td>

                          <td className="px-2.5 lg:px-3 py-2.5 min-w-0">
                            <div className="flex items-center gap-1 tabular-nums truncate">
                              <span className="text-[13px] font-bold text-[var(--eb-accent)] truncate">
                                {tx.billNumber}
                              </span>
                              {tx.orderNumber && (
                                <span className="text-[12px] font-semibold text-[var(--eb-text)] truncate">
                                  · {tx.orderNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-medium text-[var(--eb-text-muted)] tabular-nums mt-0.5 truncate">
                              {txDate} · {txTime} · {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                            </p>
                          </td>

                          <td className="px-2.5 lg:px-3 py-2.5 min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--eb-text)] truncate">
                              {tx.customerName || 'Walk-in Customer'}
                            </p>
                            {tx.customerPhone && (
                              <p className="text-[11px] font-medium text-[var(--eb-text-muted)] tabular-nums mt-0.5 truncate">
                                {tx.customerPhone}
                              </p>
                            )}
                          </td>

                          <td className="px-2.5 lg:px-3 py-2.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[11px] font-semibold whitespace-nowrap ${
                                  tx.type === 'order'
                                    ? 'bg-[var(--eb-accent-light)] text-[var(--eb-accent-text)]'
                                    : 'bg-[var(--eb-surface-subtle)] text-[var(--eb-text)] border border-[var(--eb-border)]'
                                }`}
                              >
                                {tx.type === 'order' ? (
                                  <Cake className="w-3 h-3 text-[var(--eb-accent)]" />
                                ) : (
                                  <ShoppingBag className="w-3 h-3 text-[var(--eb-accent)]" />
                                )}
                                <span>{tx.type === 'order' ? 'Order' : 'Walk-in'}</span>
                              </span>
                              {tx.orderStatus && (
                                <span className="text-[11px] font-semibold text-[var(--eb-text-muted)] truncate">
                                  {tx.orderStatus}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-2.5 lg:px-3 py-2.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[12px] font-semibold text-[var(--eb-text)]">
                                {tx.paymentMode}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-[7px] text-[11px] font-semibold whitespace-nowrap ${
                                  isPaid
                                    ? 'bg-emerald-50 text-[#16A34A] dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-amber-50 text-[#F59E0B] dark:bg-amber-950/40 dark:text-amber-300'
                                }`}
                              >
                                {isPaid ? 'Paid' : 'Partial'}
                              </span>
                            </div>
                          </td>

                          <td className="px-2.5 lg:px-3 py-2.5 text-right whitespace-nowrap">
                            <span className="text-[13px] font-bold text-[var(--eb-text)] tabular-nums">
                              {formatMoneyExact(tx.grandTotal, sym)}
                            </span>
                            {tx.balanceAmount > 0 && (
                              <p className="text-[11px] font-semibold text-[#F59E0B] tabular-nums mt-0.5">
                                Bal: {formatMoneyExact(tx.balanceAmount, sym)}
                              </p>
                            )}
                          </td>

                          <td className="px-2.5 lg:px-3 py-2.5 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onPrintReceipt(salesTxToReceipt(tx), true)}
                                aria-label={`Print receipt for ${tx.billNumber}`}
                                title="Reprint invoice"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Print</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleExpand(tx.id)}
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? 'Close' : 'View'} details for ${tx.billNumber}`}
                                title={isExpanded ? 'Close details' : 'View bill details'}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                                  isExpanded
                                    ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                                    : 'bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60'
                                }`}
                              >
                                {isExpanded ? (
                                  <>
                                    <X className="w-3.5 h-3.5" />
                                    <span className="hidden xl:inline">Close</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span className="hidden xl:inline">View</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Transaction Details Dropdown Row */}
                        <tr
                          className={
                            isExpanded
                              ? 'border-b border-[var(--eb-border)]'
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
                                  className="overflow-hidden bg-[var(--eb-surface-subtle)]"
                                >
                                  <div className="p-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-medium text-[var(--eb-text-muted)]">
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span>
                                          Type:{' '}
                                          <strong className="font-semibold text-[var(--eb-text)]">
                                            {tx.type === 'order' ? 'Cake Order' : 'Walk-in Bill'}
                                          </strong>
                                        </span>
                                        {tx.orderStatus && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span>
                                              Order Status:{' '}
                                              <strong className="font-semibold text-[var(--eb-accent)]">
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
                                              <strong className="font-semibold text-[var(--eb-text)]">
                                                {formatYMD(tx.deliveryDate, dateFmt)}{' '}
                                                {tx.deliveryTime || ''}
                                              </strong>
                                            </span>
                                          </>
                                        )}
                                        <span aria-hidden="true">·</span>
                                        <span>
                                          Cashier:{' '}
                                          <strong className="font-semibold text-[var(--eb-text)]">
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

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                                      {/* Product-Level Table */}
                                      <div className="lg:col-span-8 bg-[var(--eb-surface)] border border-[var(--eb-border)] rounded-[12px] overflow-hidden">
                                        <table className="w-full text-[12px] text-left">
                                          <thead className="bg-[var(--eb-table-header-bg)] font-semibold text-[var(--eb-text)] border-b border-[var(--eb-border)]">
                                            <tr>
                                              <th className="px-3.5 py-2">Product Name</th>
                                              <th className="px-3.5 py-2 text-right whitespace-nowrap">
                                                Quantity / Weight
                                              </th>
                                              <th className="px-3.5 py-2 text-right whitespace-nowrap">
                                                Rate
                                              </th>
                                              <th className="px-3.5 py-2 text-right whitespace-nowrap">
                                                Subtotal
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[var(--eb-border)] tabular-nums">
                                            {tx.items.map((item, itemIdx) => (
                                              <tr key={`${item.productId}-${itemIdx}`}>
                                                <td className="px-3.5 py-2 font-semibold text-[var(--eb-text)]">
                                                  {item.productName}
                                                </td>
                                                <td className="px-3.5 py-2 text-right font-medium text-[var(--eb-text-muted)] whitespace-nowrap">
                                                  {formatQty(item.quantity, item.unit)}
                                                </td>
                                                <td className="px-3.5 py-2 text-right font-medium text-[var(--eb-text-muted)] whitespace-nowrap">
                                                  {formatMoneyExact(item.unitPrice, sym)}
                                                </td>
                                                <td className="px-3.5 py-2 text-right font-semibold text-[var(--eb-text)] whitespace-nowrap">
                                                  {formatMoneyExact(item.subtotal, sym)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Totals & Payment Breakdown */}
                                      <div className="lg:col-span-4 bg-[var(--eb-surface)] border border-[var(--eb-border)] rounded-[12px] p-3.5 space-y-1.5 text-[12px] tabular-nums">
                                        <h4 className="text-[12px] font-semibold text-[var(--eb-text-muted)] pb-1 border-b border-[var(--eb-border)]">
                                          Bill &amp; Payment Breakdown
                                        </h4>

                                        <div className="flex justify-between font-medium">
                                          <span className="text-[var(--eb-text-muted)]">Subtotal</span>
                                          <span className="text-[var(--eb-text)]">
                                            {formatMoneyExact(tx.subtotal, sym)}
                                          </span>
                                        </div>

                                        {(tx.discountAmount > 0 || tx.discountPercent > 0) && (
                                          <div className="flex justify-between font-medium text-[#16A34A]">
                                            <span>Discount ({tx.discountPercent}%)</span>
                                            <span>-{formatMoneyExact(tx.discountAmount, sym)}</span>
                                          </div>
                                        )}

                                        {(tx.taxAmount > 0 || tx.taxRate > 0) && (
                                          <div className="flex justify-between font-medium">
                                            <span className="text-[var(--eb-text-muted)]">GST / Tax ({tx.taxRate}%)</span>
                                            <span className="text-[var(--eb-text)]">
                                              {formatMoneyExact(tx.taxAmount, sym)}
                                            </span>
                                          </div>
                                        )}

                                        <div className="flex justify-between text-[13px] font-bold pt-1.5 border-t border-[var(--eb-border)] text-[var(--eb-text)]">
                                          <span>Grand Total</span>
                                          <span className="text-[var(--eb-accent)]">
                                            {formatMoneyExact(tx.grandTotal, sym)}
                                          </span>
                                        </div>

                                        <div className="pt-1.5 border-t border-[var(--eb-border)] space-y-1">
                                          <div className="flex justify-between font-medium">
                                            <span className="text-[var(--eb-text-muted)]">Payment Mode</span>
                                            <span className="font-semibold text-[var(--eb-text)]">
                                              {tx.paymentMode}
                                            </span>
                                          </div>

                                          <div className="flex justify-between font-medium">
                                            <span className="text-[var(--eb-text-muted)]">Amount Received</span>
                                            <span className="font-semibold text-[#16A34A]">
                                              {formatMoneyExact(tx.amountReceived, sym)}
                                            </span>
                                          </div>

                                          {tx.type === 'order' && (
                                            <>
                                              <div className="flex justify-between font-medium">
                                                <span className="text-[var(--eb-text-muted)]">Advance Amount</span>
                                                <span className="font-semibold text-[var(--eb-text)]">
                                                  {formatMoneyExact(tx.advanceAmount, sym)}
                                                </span>
                                              </div>
                                              <div className="flex justify-between font-semibold">
                                                <span className="text-[var(--eb-text-muted)]">Remaining Balance</span>
                                                <span
                                                  className={
                                                    tx.balanceAmount > 0
                                                      ? 'text-[#F59E0B]'
                                                      : 'text-[#16A34A]'
                                                  }
                                                >
                                                  {formatMoneyExact(tx.balanceAmount, sym)}
                                                </span>
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        {tx.notes && (
                                          <div className="pt-1.5 border-t border-[var(--eb-border)] text-[11px] font-medium text-[var(--eb-text-muted)]">
                                            <span className="font-semibold text-[var(--eb-text)]">
                                              Note:{' '}
                                            </span>
                                            {tx.notes}
                                          </div>
                                        )}

                                        {tx.paymentHistory && tx.paymentHistory.length > 0 && (
                                          <div className="pt-1.5 border-t border-[var(--eb-border)] space-y-1">
                                            <p className="text-[11px] font-semibold text-[var(--eb-text-muted)]">
                                              Payment Installments ({tx.paymentHistory.length})
                                            </p>
                                            {tx.paymentHistory.map((p) => (
                                              <div key={p.id} className="flex justify-between text-[11px]">
                                                <span className="text-[var(--eb-text-muted)]">
                                                  {formatDateValue(p.date, dateFmt)} · {p.mode}
                                                </span>
                                                <span className="font-semibold text-[#16A34A]">
                                                  +{formatMoneyExact(p.amount, sym)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {tx.type === 'order' && onNavigate && (
                                          <div className="pt-2 border-t border-[var(--eb-border)]">
                                            <button
                                              type="button"
                                              onClick={() => onNavigate('orders')}
                                              className="w-full py-1.5 px-3 rounded-[8px] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 text-[11px] font-semibold transition-colors"
                                            >
                                              Open in Cake Orders
                                            </button>
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

            {/* Table Footer / Pagination */}
            <div className="px-4 py-2.5 border-t border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] tabular-nums">
                Showing{' '}
                <strong className="font-semibold text-[var(--eb-text)]">
                  {(safePage - 1) * PAGE_SIZE + 1}
                </strong>
                –
                <strong className="font-semibold text-[var(--eb-text)]">
                  {Math.min(safePage * PAGE_SIZE, filteredTransactions.length)}
                </strong>{' '}
                of{' '}
                <strong className="font-semibold text-[var(--eb-text)]">
                  {filteredTransactions.length}
                </strong>{' '}
                matching {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
              </p>

              {filteredTransactions.length > PAGE_SIZE && (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      setExpandedTxId(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[9px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[12px] font-medium text-[var(--eb-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--eb-accent)]"
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
                        className={`w-7 h-7 rounded-[9px] text-[12px] font-medium tabular-nums transition-colors ${
                          safePage === item
                            ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                            : 'bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                        }`}
                      >
                        {item}
                      </button>
                    ) : (
                      <span
                        key={item}
                        className="px-1 text-[12px] font-medium text-[var(--eb-text-muted)] select-none"
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
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[9px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[12px] font-medium text-[var(--eb-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--eb-accent)]"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
