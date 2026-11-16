import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Download,
  Edit3,
  Trash2,
  X,
  Wallet,
  Search,
  AlertCircle,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  downloadCSV,
  formatCurrency,
  formatDateValue,
  formatMoneyExact,
  toLocalYMD,
  getTodayYMD,
} from '../lib/format';
import type {
  Expense,
  ExpenseCategory,
  ExpensePaymentMode,
  SalesTransaction,
} from '../types';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Raw Materials',
  'Electricity',
  'Rent',
  'Employee Salary',
  'Packaging',
  'Transportation',
  'Maintenance',
  'Others',
];

const PAYMENT_MODES: ExpensePaymentMode[] = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
const LEDGER_MODES = ['All', 'Cash', 'UPI', 'Card', 'Bank Transfer'] as const;

type LedgerView = 'expenses' | 'collections' | 'all';

interface UnifiedLedgerEntry {
  id: string;
  date: string;
  flow: 'credit' | 'debit';
  category: string;
  particulars: string;
  sublabel: string;
  paymentMode: string;
  amount: number;
  recordedBy: string;
  expense?: Expense;
}

export function ExpensesPage() {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ledgerView, setLedgerView] = useState<LedgerView>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ExpenseCategory>('All');
  const [modeFilter, setModeFilter] = useState<(typeof LEDGER_MODES)[number]>('All');
  const [monthFilter, setMonthFilter] = useState(getTodayYMD().slice(0, 7));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    category: 'Raw Materials' as ExpenseCategory,
    description: '',
    amount: '',
    expenseDate: getTodayYMD(),
    paymentMode: 'Cash' as ExpensePaymentMode,
  });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';

  const loadAccountsData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [expRes, salesRes] = await Promise.all([
        apiRequest<Expense[]>('/api/expenses'),
        apiRequest<SalesTransaction[]>('/api/sales'),
      ]);
      setExpenses(expRes);
      setSales(salesRes);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load account records.';
      setLoadError(msg);
      showToast('Failed to load accounts', 'error', msg);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAccountsData();
  }, [loadAccountsData]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  // Period-filtered datasets (for KPIs, Channel Balances, Category Breakdown)
  const periodExpenses = useMemo(
    () =>
      monthFilter
        ? expenses.filter((e) => e.expenseDate.startsWith(monthFilter))
        : expenses,
    [expenses, monthFilter]
  );

  // 4-Card Financial Summary
  const financialSummary = useMemo(() => {
    let totalCollections = 0;
    let collectionsCount = 0;

    for (const s of sales) {
      if (s.paymentHistory && s.paymentHistory.length > 0) {
        let matchedSale = false;
        for (const pay of s.paymentHistory) {
          const payYmd = toLocalYMD(pay.date);
          if (monthFilter && !payYmd.startsWith(monthFilter)) continue;
          if (pay.amount > 0) {
            totalCollections += pay.amount;
            matchedSale = true;
          }
        }
        if (matchedSale) collectionsCount += 1;
      } else {
        const saleYmd = toLocalYMD(s.createdAt);
        if (monthFilter && !saleYmd.startsWith(monthFilter)) continue;
        if (s.amountReceived > 0) {
          totalCollections += s.amountReceived;
          collectionsCount += 1;
        }
      }
    }

    const totalOutflow = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netCashFlow = totalCollections - totalOutflow;

    let pendingReceivables = 0;
    let pendingOrdersCount = 0;
    for (const s of sales) {
      if (s.balanceAmount > 0 && s.orderStatus !== 'Cancelled') {
        pendingReceivables += s.balanceAmount;
        pendingOrdersCount += 1;
      }
    }

    return {
      totalCollections,
      collectionsCount,
      totalOutflow,
      expenseCount: periodExpenses.length,
      netCashFlow,
      pendingReceivables,
      pendingOrdersCount,
    };
  }, [sales, periodExpenses, monthFilter]);

  // Payment Channel Cashflow Reconciliation
  const channelSummary = useMemo(() => {
    const channels = ['Cash', 'UPI', 'Card', 'Bank Transfer'] as const;
    const map = new Map<string, { inflow: number; outflow: number }>();
    for (const ch of channels) {
      map.set(ch, { inflow: 0, outflow: 0 });
    }

    for (const s of sales) {
      if (s.paymentHistory && s.paymentHistory.length > 0) {
        for (const pay of s.paymentHistory) {
          const payYmd = toLocalYMD(pay.date);
          if (monthFilter && !payYmd.startsWith(monthFilter)) continue;
          const bucket = map.get(pay.mode) || { inflow: 0, outflow: 0 };
          bucket.inflow += pay.amount;
          map.set(pay.mode, bucket);
        }
      } else {
        const saleYmd = toLocalYMD(s.createdAt);
        if (monthFilter && !saleYmd.startsWith(monthFilter)) continue;
        const normalizedMode = s.paymentMode === 'Advance' ? 'Cash' : s.paymentMode;
        const bucket = map.get(normalizedMode) || { inflow: 0, outflow: 0 };
        bucket.inflow += s.amountReceived;
        map.set(normalizedMode, bucket);
      }
    }

    for (const e of periodExpenses) {
      const bucket = map.get(e.paymentMode) || { inflow: 0, outflow: 0 };
      bucket.outflow += e.amount;
      map.set(e.paymentMode, bucket);
    }

    return channels.map((name) => {
      const entry = map.get(name) || { inflow: 0, outflow: 0 };
      return {
        name,
        inflow: entry.inflow,
        outflow: entry.outflow,
        net: entry.inflow - entry.outflow,
      };
    });
  }, [sales, periodExpenses, monthFilter]);

  // Category Breakdown for Expenses
  const categoryBreakdown = useMemo(() => {
    const map = new Map<ExpenseCategory, { total: number; count: number }>();
    let grandTotal = 0;
    for (const e of periodExpenses) {
      grandTotal += e.amount;
      const cur = map.get(e.category) || { total: 0, count: 0 };
      cur.total += e.amount;
      cur.count += 1;
      map.set(e.category, cur);
    }

    return Array.from(map.entries())
      .map(([category, stats]) => ({
        category,
        total: stats.total,
        count: stats.count,
        share: grandTotal > 0 ? Math.round((stats.total / grandTotal) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [periodExpenses]);

  // Unified & Filtered Ledger Rows
  const ledgerRows = useMemo(() => {
    const entries: UnifiedLedgerEntry[] = [];

    if (ledgerView === 'all' || ledgerView === 'expenses') {
      for (const e of periodExpenses) {
        entries.push({
          id: `exp-${e.id}`,
          date: e.expenseDate,
          flow: 'debit',
          category: e.category,
          particulars: e.description,
          sublabel: e.username,
          paymentMode: e.paymentMode,
          amount: e.amount,
          recordedBy: e.username,
          expense: e,
        });
      }
    }

    if (ledgerView === 'all' || ledgerView === 'collections') {
      for (const s of sales) {
        if (s.paymentHistory && s.paymentHistory.length > 0) {
          for (const pay of s.paymentHistory) {
            const payYmd = toLocalYMD(pay.date);
            if (monthFilter && !payYmd.startsWith(monthFilter)) continue;
            if (pay.amount <= 0) continue;
            entries.push({
              id: `sale-${s.id}-${pay.id}`,
              date: payYmd,
              flow: 'credit',
              category: 'Cake Order',
              particulars: `${s.orderNumber || s.billNumber} · ${s.customerName || 'Walk-in Customer'}`,
              sublabel: pay.note || s.paymentStatus,
              paymentMode: pay.mode,
              amount: pay.amount,
              recordedBy: pay.username || s.username,
            });
          }
        } else {
          const saleYmd = toLocalYMD(s.createdAt);
          if (monthFilter && !saleYmd.startsWith(monthFilter)) continue;
          if (s.amountReceived <= 0) continue;
          const normalizedMode = s.paymentMode === 'Advance' ? 'Cash' : s.paymentMode;
          entries.push({
            id: `sale-${s.id}`,
            date: saleYmd,
            flow: 'credit',
            category: s.type === 'order' ? 'Cake Order' : 'Counter Sale',
            particulars: `${s.billNumber} · ${s.customerName || 'Walk-in Customer'}`,
            sublabel:
              s.balanceAmount > 0
                ? `Advance (${s.paymentStatus})`
                : s.paymentStatus,
            paymentMode: normalizedMode,
            amount: s.amountReceived,
            recordedBy: s.username,
          });
        }
      }
    }

    const q = search.trim().toLowerCase();
    return entries
      .filter((row) => {
        if (ledgerView !== 'collections' && categoryFilter !== 'All') {
          if (row.flow !== 'debit' || row.category !== categoryFilter) {
            return false;
          }
        }
        if (modeFilter !== 'All' && row.paymentMode !== modeFilter) {
          return false;
        }
        if (q) {
          const hay = `${row.particulars} ${row.category} ${row.paymentMode} ${row.recordedBy}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.flow === b.flow ? 0 : a.flow === 'debit' ? -1 : 1;
      });
  }, [ledgerView, periodExpenses, sales, monthFilter, categoryFilter, modeFilter, search]);

  const filteredTotals = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const row of ledgerRows) {
      if (row.flow === 'credit') credits += row.amount;
      else debits += row.amount;
    }
    return { credits, debits, net: credits - debits };
  }, [ledgerRows]);

  const openAddModal = () => {
    setEditing(null);
    setForm({
      category: categoryFilter !== 'All' ? categoryFilter : 'Raw Materials',
      description: '',
      amount: '',
      expenseDate: getTodayYMD(),
      paymentMode: settings.billing.defaultPaymentMode || 'Cash',
    });
    setModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditing(exp);
    setForm({
      category: exp.category,
      description: exp.description,
      amount: String(exp.amount),
      expenseDate: exp.expenseDate,
      paymentMode: exp.paymentMode,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) {
      showToast('Description Required', 'error');
      return;
    }
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Valid Amount Required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await apiRequest<Expense>(`/api/expenses/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...form, amount: amt }),
        });
        setExpenses((prev) => prev.map((ex) => (ex.id === updated.id ? updated : ex)));
        showToast('Expense Updated', 'success');
      } else {
        const created = await apiRequest<Expense>('/api/expenses', {
          method: 'POST',
          body: JSON.stringify({ ...form, amount: amt }),
        });
        setExpenses((prev) => [created, ...prev]);
        showToast('Expense Recorded', 'success');
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast('Save Failed', 'error', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/expenses/${deleteTarget.id}`, { method: 'DELETE' });
      setExpenses((prev) => prev.filter((ex) => ex.id !== deleteTarget.id));
      showToast('Expense Deleted', 'info');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast('Delete Failed', 'error', err?.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (ledgerRows.length === 0) {
      showToast('No records to export', 'info');
      return;
    }
    const headers = ['Date', 'Type', 'Category', 'Particulars', 'Payment Mode', 'Amount', 'Recorded By'];
    const rows = ledgerRows.map((r) => [
      formatDateValue(r.date, dateFmt),
      r.flow === 'credit' ? 'Credit (+)' : 'Debit (-)',
      r.category,
      r.particulars,
      r.paymentMode,
      r.flow === 'credit' ? r.amount : -r.amount,
      r.recordedBy,
    ]);
    downloadCSV(`easybill-accounts-${ledgerView}-${monthFilter || 'all'}.csv`, headers, rows);
    showToast('Accounts ledger exported', 'success');
  };

  const handleCategoryRowClick = (cat: ExpenseCategory) => {
    if (ledgerView === 'collections') {
      setLedgerView('expenses');
    }
    setCategoryFilter((prev) => (prev === cat ? 'All' : cat));
  };

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* 1. Accounts Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[24px] font-semibold text-[var(--eb-text)] leading-tight">
            Accounts &amp; Financial Ledger
          </h1>
          <p className="text-[13px] font-normal text-[var(--eb-text-muted)] mt-0.5 truncate">
            Monitor incoming collections, operating expenses, payment channel balances, and net cash flow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            aria-label="Filter accounts by month"
            className="h-[38px] px-3 rounded-[10px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[13px] font-medium text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)]"
          />

          {monthFilter && (
            <button
              type="button"
              onClick={() => setMonthFilter('')}
              className="h-[38px] px-3 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              All Time
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-[10px] bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="h-[38px] inline-flex items-center gap-1.5 px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13px] font-medium whitespace-nowrap shrink-0 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* 2. 4-Column Financial Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="eb-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--eb-text-muted)] truncate">
              Collections ({monthFilter || 'All'})
            </span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-[#16A34A] dark:text-emerald-400 shrink-0" />
          </div>
          <p className="mt-1 text-[21px] sm:text-[23px] font-bold tabular-nums text-[var(--eb-text)] leading-tight">
            {formatCurrency(financialSummary.totalCollections, sym)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--eb-text-muted)] tabular-nums">
            {financialSummary.collectionsCount} sales records
          </p>
        </div>

        <div className="eb-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--eb-text-muted)] truncate">
              Expenses ({monthFilter || 'All'})
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#DC2626] dark:text-red-400 shrink-0" />
          </div>
          <p className="mt-1 text-[21px] sm:text-[23px] font-bold tabular-nums text-[var(--eb-text)] leading-tight">
            {formatCurrency(financialSummary.totalOutflow, sym)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--eb-text-muted)] tabular-nums">
            {financialSummary.expenseCount} expense entries
          </p>
        </div>

        <div className="eb-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--eb-text-muted)] truncate">
              Net Cash Flow
            </span>
            <span
              className={`text-[11px] font-semibold shrink-0 ${
                financialSummary.netCashFlow >= 0
                  ? 'text-[#16A34A] dark:text-emerald-400'
                  : 'text-[#DC2626] dark:text-red-400'
              }`}
            >
              {financialSummary.netCashFlow >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
          <p
            className={`mt-1 text-[21px] sm:text-[23px] font-bold tabular-nums leading-tight ${
              financialSummary.netCashFlow >= 0
                ? 'text-[#16A34A] dark:text-emerald-400'
                : 'text-[#DC2626] dark:text-red-400'
            }`}
          >
            {financialSummary.netCashFlow < 0 ? '-' : ''}
            {formatCurrency(Math.abs(financialSummary.netCashFlow), sym)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--eb-text-muted)]">
            Collections minus expenses
          </p>
        </div>

        <div className="eb-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--eb-text-muted)] truncate">
              Pending Receivables
            </span>
            <span className="text-[11px] font-semibold text-[#D97706] dark:text-amber-400 shrink-0">
              Due
            </span>
          </div>
          <p className="mt-1 text-[21px] sm:text-[23px] font-bold tabular-nums text-[var(--eb-text)] leading-tight">
            {formatCurrency(financialSummary.pendingReceivables, sym)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--eb-text-muted)] tabular-nums">
            {financialSummary.pendingOrdersCount} active orders with balance
          </p>
        </div>
      </div>

      {/* 3. Structured 2-Column Desktop Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Panel: Payment Channel Balances & Expense Category Breakdown */}
        <section
          aria-label="Account Breakdown"
          className="lg:col-span-4 eb-card flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar divide-y divide-[var(--eb-border)]">
            {/* Payment Channel Reconciliation */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-[var(--eb-text)]">
                  Payment Channel Summary
                </h2>
                <span className="text-[11px] font-medium text-[var(--eb-text-muted)] tabular-nums">
                  {monthFilter || 'All Time'}
                </span>
              </div>

              <div className="divide-y divide-[var(--eb-border)] text-[12px]">
                <div className="grid grid-cols-4 gap-2 py-1.5 font-semibold text-[var(--eb-text-muted)]">
                  <span>Mode</span>
                  <span className="text-right">In</span>
                  <span className="text-right">Out</span>
                  <span className="text-right">Net</span>
                </div>
                {channelSummary.map((ch) => (
                  <button
                    key={ch.name}
                    type="button"
                    onClick={() =>
                      setModeFilter((prev) => (prev === ch.name ? 'All' : ch.name))
                    }
                    className={`w-full grid grid-cols-4 gap-2 py-2 text-left transition-colors rounded-[6px] px-1 -mx-1 ${
                      modeFilter === ch.name
                        ? 'bg-[var(--eb-accent-light)] text-[var(--eb-accent-text)] font-semibold'
                        : 'hover:bg-[var(--eb-table-row-hover)] text-[var(--eb-text)]'
                    }`}
                  >
                    <span className="font-medium truncate">{ch.name}</span>
                    <span className="text-right tabular-nums text-[#16A34A] dark:text-emerald-400">
                      {formatCurrency(ch.inflow, sym)}
                    </span>
                    <span className="text-right tabular-nums text-[#DC2626] dark:text-red-400">
                      {formatCurrency(ch.outflow, sym)}
                    </span>
                    <span className="text-right tabular-nums font-semibold">
                      {ch.net < 0 ? '-' : ''}
                      {formatCurrency(Math.abs(ch.net), sym)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Expense Breakdown by Category */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-[var(--eb-text)]">
                  Expenses by Category
                </h2>
                {categoryFilter !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('All')}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap"
                  >
                    Clear filter
                  </button>
                )}
              </div>

              {categoryBreakdown.length === 0 ? (
                <p className="text-[12px] text-[var(--eb-text-muted)] py-4 text-center">
                  No expenses logged in this period.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {categoryBreakdown.map((item) => {
                    const isSelected = categoryFilter === item.category;
                    return (
                      <button
                        key={item.category}
                        type="button"
                        onClick={() => handleCategoryRowClick(item.category)}
                        className={`w-full text-left p-2 -mx-2 rounded-[8px] transition-colors ${
                          isSelected
                            ? 'bg-[var(--eb-accent-light)]'
                            : 'hover:bg-[var(--eb-table-row-hover)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="font-medium text-[var(--eb-text)] truncate">
                            {item.category}
                          </span>
                          <span className="tabular-nums font-semibold text-[var(--eb-text)] shrink-0">
                            {formatCurrency(item.total, sym)}{' '}
                            <span className="font-normal text-[var(--eb-text-muted)]">
                              · {item.share}%
                            </span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--eb-border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--eb-accent)] transition-all"
                            style={{ width: `${Math.max(item.share, 3)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Panel: Unified Cashbook & Expense Register */}
        <section
          aria-label="Accounts Ledger"
          className="lg:col-span-8 eb-card flex flex-col min-h-0 overflow-hidden"
        >
          {/* Integrated Filter & View Toolbar */}
          <div className="px-3.5 py-2.5 border-b border-[var(--eb-border)] flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Segmented Ledger View Tabs */}
            <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-[var(--eb-bg)] border border-[var(--eb-border)] shrink-0">
              {(
                [
                  { id: 'all', label: 'All Ledger' },
                  { id: 'expenses', label: 'Expenses' },
                  { id: 'collections', label: 'Collections' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLedgerView(tab.id)}
                  className={`px-3 py-1 rounded-[7px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    ledgerView === tab.id
                      ? 'bg-[var(--eb-accent)] text-white shadow-2xs'
                      : 'text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search + Category + Mode Controls */}
            <div className="flex flex-wrap items-center gap-2 flex-1 justify-end min-w-0">
              <div className="relative w-full sm:w-48 md:w-56">
                <Search className="w-3.5 h-3.5 text-[var(--eb-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search particulars, bill..."
                  className="h-[34px] w-full pl-8 pr-3 rounded-[9px] bg-[var(--eb-input-bg)] border border-[var(--eb-border)] text-[12px] font-medium text-[var(--eb-text)] placeholder:text-[var(--eb-text-muted)]/70 focus:outline-none focus:border-[var(--eb-accent)]"
                />
              </div>

              {ledgerView !== 'collections' && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as 'All' | ExpenseCategory)}
                  aria-label="Filter by expense category"
                  className="h-[34px] pl-2.5 pr-8 rounded-[9px] bg-[var(--eb-input-bg)] border border-[var(--eb-border)] text-[12px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)]"
                >
                  <option value="All">All Categories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as (typeof LEDGER_MODES)[number])}
                aria-label="Filter by payment mode"
                className="h-[34px] pl-2.5 pr-8 rounded-[9px] bg-[var(--eb-input-bg)] border border-[var(--eb-border)] text-[12px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)]"
              >
                {LEDGER_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m === 'All' ? 'All Modes' : m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ledger Table / States */}
          {loading ? (
            <div className="p-5 space-y-2.5 animate-pulse flex-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-11 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
              ))}
            </div>
          ) : loadError ? (
            <div className="p-10 text-center space-y-3 my-auto">
              <AlertCircle className="w-9 h-9 mx-auto text-[#DC2626]" />
              <div>
                <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                  Unable to load accounts ledger
                </p>
                <p className="text-[13px] font-normal text-[var(--eb-text-muted)] mt-1">
                  {loadError}
                </p>
              </div>
              <button
                type="button"
                onClick={loadAccountsData}
                className="inline-flex items-center gap-1.5 h-[36px] px-4 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : ledgerRows.length === 0 ? (
            <div className="p-10 text-center my-auto space-y-3">
              <Wallet className="w-9 h-9 mx-auto text-[var(--eb-text-muted)]/50" />
              <div>
                <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                  No account transactions match these filters
                </p>
                <p className="text-[12px] text-[var(--eb-text-muted)] mt-0.5">
                  Adjust the period or filter settings, or record a new expense entry.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 h-[36px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13px] font-medium shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Expense Entry</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Ledger Cards */}
              <div className="md:hidden divide-y divide-[var(--eb-border)] overflow-y-auto flex-1">
                {ledgerRows.map((row) => (
                  <div key={row.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-[var(--eb-text-muted)]">
                          <span
                            className={
                              row.flow === 'credit'
                                ? 'text-[#16A34A] dark:text-emerald-400 font-semibold'
                                : 'text-[#DC2626] dark:text-red-400 font-semibold'
                            }
                          >
                            {row.flow === 'credit' ? 'Credit' : 'Debit'}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>{row.category}</span>
                        </p>
                        <p className="text-[14px] font-semibold text-[var(--eb-text)] mt-0.5 truncate">
                          {row.particulars}
                        </p>
                        <p className="text-[12px] text-[var(--eb-text-muted)] tabular-nums mt-0.5">
                          {formatDateValue(row.date, dateFmt)} · {row.paymentMode} · {row.recordedBy}
                        </p>
                      </div>
                      <p
                        className={`text-[14px] font-bold tabular-nums shrink-0 ${
                          row.flow === 'credit'
                            ? 'text-[#16A34A] dark:text-emerald-400'
                            : 'text-[#DC2626] dark:text-red-400'
                        }`}
                      >
                        {row.flow === 'credit' ? '+' : '-'}
                        {formatMoneyExact(row.amount, sym)}
                      </p>
                    </div>
                    {row.expense && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(row.expense!)}
                          className="p-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                          aria-label={`Edit ${row.particulars}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row.expense!)}
                          className="p-1.5 rounded-[8px] border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                          aria-label={`Delete ${row.particulars}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Ledger Table */}
              <div className="hidden md:block flex-1 min-h-0 overflow-y-auto overflow-x-hidden thin-scrollbar">
                <table className="w-full table-fixed text-[13px] text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-[var(--eb-table-header-bg)] text-[12px] font-semibold text-[var(--eb-text-muted)] border-b border-[var(--eb-border)]">
                    <tr>
                      <th className="px-4 py-2.5 w-[12%]">Date</th>
                      <th className="px-3 py-2.5 w-[11%]">Type</th>
                      <th className="px-3 py-2.5 w-[35%]">Particulars &amp; Category</th>
                      <th className="px-3 py-2.5 w-[13%]">Mode</th>
                      <th className="px-3 py-2.5 w-[16%] text-right">Amount</th>
                      <th className="px-4 py-2.5 w-[13%] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--eb-border)]">
                    {ledgerRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-[var(--eb-table-row-hover)] transition-colors"
                      >
                        <td className="px-4 py-2.5 text-[12px] text-[var(--eb-text-muted)] tabular-nums whitespace-nowrap">
                          {formatDateValue(row.date, dateFmt)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
                              row.flow === 'credit'
                                ? 'text-[#16A34A] dark:text-emerald-400'
                                : 'text-[#DC2626] dark:text-red-400'
                            }`}
                          >
                            {row.flow === 'credit' ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{row.flow === 'credit' ? 'Credit' : 'Debit'}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 min-w-0">
                          <p className="text-[13px] font-medium text-[var(--eb-text)] truncate">
                            {row.particulars}
                          </p>
                          <p className="text-[11px] text-[var(--eb-text-muted)] truncate">
                            {row.category} · {row.sublabel}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[var(--eb-text-muted)] whitespace-nowrap truncate">
                          {row.paymentMode}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right text-[13px] font-bold tabular-nums whitespace-nowrap ${
                            row.flow === 'credit'
                              ? 'text-[#16A34A] dark:text-emerald-400'
                              : 'text-[#DC2626] dark:text-red-400'
                          }`}
                        >
                          {row.flow === 'credit' ? '+' : '-'}
                          {formatMoneyExact(row.amount, sym)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {row.expense ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(row.expense!)}
                                className="p-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                                aria-label="Edit expense"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row.expense!)}
                                className="p-1.5 rounded-[8px] border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                                aria-label="Delete expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-[var(--eb-text-muted)]">
                              POS Bill
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Compact Ledger Summary Footer */}
              <div className="px-4 py-2.5 border-t border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] flex flex-wrap items-center justify-between gap-2 text-[12px] font-medium text-[var(--eb-text-muted)] shrink-0 tabular-nums">
                <span>
                  Showing <strong className="font-semibold text-[var(--eb-text)]">{ledgerRows.length}</strong>{' '}
                  {ledgerRows.length === 1 ? 'entry' : 'entries'}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {filteredTotals.credits > 0 && (
                    <span>
                      Inflow:{' '}
                      <strong className="font-semibold text-[#16A34A] dark:text-emerald-400">
                        +{formatMoneyExact(filteredTotals.credits, sym)}
                      </strong>
                    </span>
                  )}
                  {filteredTotals.debits > 0 && (
                    <span>
                      Outflow:{' '}
                      <strong className="font-semibold text-[#DC2626] dark:text-red-400">
                        -{formatMoneyExact(filteredTotals.debits, sym)}
                      </strong>
                    </span>
                  )}
                  {ledgerView === 'all' && (
                    <span>
                      Net:{' '}
                      <strong className="font-semibold text-[var(--eb-text)]">
                        {filteredTotals.net < 0 ? '-' : ''}
                        {formatMoneyExact(Math.abs(filteredTotals.net), sym)}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Add / Edit Expense Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[16px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-[0_16px_40px_rgba(0,0,0,0.2)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--eb-border)]">
              <h3 className="text-[18px] font-semibold text-[var(--eb-text)]">
                {editing ? 'Edit Expense' : 'Add New Expense'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-[8px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] hover:bg-[var(--eb-btn-secondary-bg)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                    className="w-full h-[40px] pl-3 pr-9 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[14px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Date</label>
                  <input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                    className="w-full h-[40px] px-3 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[13px] font-medium text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Heavy cream & Belgian cocoa"
                  className="w-full h-[40px] px-3 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[14px] font-medium text-[var(--eb-text)] placeholder:text-[var(--eb-text-muted)]/70 focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Amount ({sym}) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="1500"
                    className="w-full h-[40px] px-3 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[14px] font-bold text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">Payment Mode</label>
                  <select
                    value={form.paymentMode}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value as ExpensePaymentMode }))}
                    className="w-full h-[40px] pl-3 pr-9 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[14px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-[40px] px-4 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[14px] font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-[40px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[14px] font-medium shadow-sm disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  {saving ? 'Saving...' : editing ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Expense"
        description={`Are you sure you want to delete "${deleteTarget?.description}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
