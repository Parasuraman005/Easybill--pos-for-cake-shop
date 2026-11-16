import React, { useEffect, useState } from 'react';
import { Printer, X, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { formatDateValue, formatMoneyExact, formatTimeValue } from '../lib/format';
import type { ReceiptData } from '../types';

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  autoTriggerPrint?: boolean;
  onClose: () => void;
}

export function ReceiptModal({
  receipt,
  autoTriggerPrint = false,
  onClose,
}: ReceiptModalProps) {
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'A4'>(
    settings.printer.paperSize || '80mm'
  );
  const [copies, setCopies] = useState<number>(settings.printer.copies || 1);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printedOnce, setPrintedOnce] = useState(false);

  useEffect(() => {
    setPaperSize(settings.printer.paperSize || '80mm');
  }, [settings.printer.paperSize]);

  useEffect(() => {
    setCopies(Math.max(1, Math.min(5, Number(settings.printer.copies || 1))));
  }, [settings.printer.copies]);

  useEffect(() => {
    if (!receipt) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [receipt, onClose]);

  useEffect(() => {
    if (!receipt) {
      setPrintError(null);
      setPrintedOnce(false);
      return;
    }

    if (autoTriggerPrint) {
      if (!settings.printer.isConnected) {
        setPrintError(
          `Printer "${settings.printer.selectedPrinter}" is offline or disconnected. Your transaction (${receipt.billNumber}) has been safely saved.`
        );
      } else if (settings.printer.autoPrint) {
        const timer = setTimeout(() => {
          triggerBrowserPrint();
        }, 250);
        return () => clearTimeout(timer);
      }
    }
  }, [receipt, autoTriggerPrint, settings.printer.isConnected, settings.printer.autoPrint, settings.printer.selectedPrinter]);

  const triggerBrowserPrint = () => {
    if (!receipt) return;
    if (!settings.printer.isConnected) {
      setPrintError(
        `Printer "${settings.printer.selectedPrinter}" is disconnected. Reconnect the printer and click Retry Print.`
      );
      showToast('Printer Disconnected', 'error', 'Bill saved safely. Reconnect printer to retry.');
      return;
    }

    try {
      setPrintError(null);
      window.print();
      setPrintedOnce(true);
    } catch {
      setPrintError('Printing failed. You can retry printing without creating a duplicate bill.');
      showToast('Print Failed', 'error', 'Bill is saved. Click Retry Print to try again.');
    }
  };

  const handleReconnectAndPrint = async () => {
    try {
      await updateSettings({
        printer: { ...settings.printer, isConnected: true },
      });
      setPrintError(null);
      setTimeout(() => {
        window.print();
        setPrintedOnce(true);
      }, 150);
    } catch {
      showToast('Could not update printer state', 'error');
    }
  };

  if (!receipt) return null;

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';
  const paperWidthClass =
    paperSize === '58mm'
      ? 'w-full max-w-[240px] text-[11px]'
      : paperSize === '80mm'
      ? 'w-full max-w-[320px] text-[12px]'
      : 'w-full max-w-[680px] text-[13px]';

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[var(--eb-primary)]/60 backdrop-blur-[2px] p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt Preview and Print"
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-[16px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-2xl overflow-hidden transition-colors">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-[var(--eb-border)] bg-[var(--eb-bg)]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h3 className="text-[18px] font-semibold text-[var(--eb-text)] truncate">
              Receipt · <span className="tabular-nums">{receipt.billNumber}</span>
            </h3>
            {printedOnce && !printError && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Printed
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-[10px] bg-[var(--eb-btn-secondary-bg)] border border-[var(--eb-border)]">
              {(['58mm', '80mm', 'A4'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPaperSize(sz)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-[8px] transition-colors whitespace-nowrap shrink-0 ${
                    paperSize === sz
                      ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                      : 'text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[10px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-xs font-medium text-[var(--eb-text-muted)] tabular-nums shrink-0">
              <span>Copies:</span>
              <select
                aria-label="Print copies"
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value) || 1)}
                className="bg-transparent font-semibold text-[var(--eb-text)] focus:outline-none cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={triggerBrowserPrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-indigo-600 hover:bg-indigo-700 text-white text-[14px] font-medium transition-colors whitespace-nowrap shrink-0 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>{printError ? 'Retry Print' : 'Print Receipt'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
              aria-label="Close receipt modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printer Error Alert */}
        {printError && (
          <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#F59E0B]" />
              <p className="text-xs font-medium leading-relaxed">{printError}</p>
            </div>
            <button
              type="button"
              onClick={handleReconnectAndPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap shrink-0 shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Connect Printer &amp; Print</span>
            </button>
          </div>
        )}

        {/* Scrollable Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[var(--eb-bg)] flex justify-center">
          <div
            id="easybill-print-sheet"
            data-paper={paperSize}
            className={`${paperWidthClass} bg-white text-[#172C3B] border border-[#E2E8F0] shadow-sm rounded-[12px] p-4 sm:p-5 leading-snug h-fit`}
          >
            {/* Company Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
              {settings.company.logo && (
                <img
                  src={settings.company.logo}
                  alt={settings.company.name}
                  className="w-12 h-12 object-contain mx-auto mb-1.5"
                />
              )}
              <h2 className="font-semibold text-base uppercase tracking-wide text-[#172C3B]">
                {settings.company.name}
              </h2>
              {settings.company.address && (
                <p className="text-[11px] font-normal text-[#64748B] mt-0.5">
                  {settings.company.address}
                </p>
              )}
              <div className="text-[11px] font-normal text-[#64748B] mt-0.5">
                {settings.company.phone && <span>Ph: {settings.company.phone}</span>}
                {settings.company.gstin && (
                  <span className="block tabular-nums">GSTIN: {settings.company.gstin}</span>
                )}
              </div>
            </div>

            {/* Bill / Order Metadata */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2.5 mb-2.5 tabular-nums font-normal">
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">Bill No:</span>
                <span className="font-semibold text-[#172C3B]">{receipt.billNumber}</span>
              </div>
              {receipt.orderNumber && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#64748B]">Order No:</span>
                  <span className="font-semibold text-[#172C3B]">{receipt.orderNumber}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">Date &amp; Time:</span>
                <span>
                  {formatDateValue(receipt.createdAt, dateFmt)} {formatTimeValue(receipt.createdAt)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">Cashier:</span>
                <span>{receipt.username}</span>
              </div>
              {receipt.fulfillmentType && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#64748B]">Order Type:</span>
                  <span className="font-semibold text-[#172C3B]">{receipt.fulfillmentType}</span>
                </div>
              )}
              {receipt.type === 'order' && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#64748B]">Order Status:</span>
                  <span className="font-semibold text-[#172C3B]">
                    {receipt.orderStatus || 'Pending'}
                  </span>
                </div>
              )}
              {receipt.deliveryDate && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#64748B]">
                    {receipt.fulfillmentType === 'Pickup' ? 'Pickup:' : 'Delivery:'}
                  </span>
                  <span className="font-semibold text-[#172C3B]">
                    {formatDateValue(receipt.deliveryDate, dateFmt)} {receipt.deliveryTime || ''}
                  </span>
                </div>
              )}
            </div>

            {/* Customer Details */}
            <div className="text-[11px] font-normal border-b border-dashed border-slate-300 pb-2.5 mb-2.5">
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">Customer:</span>
                <span className="font-semibold text-right text-[#172C3B]">
                  {receipt.customerName || 'Walk-in Customer'}
                </span>
              </div>
              {receipt.customerPhone && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#64748B]">Phone:</span>
                  <span className="tabular-nums">{receipt.customerPhone}</span>
                </div>
              )}
              {receipt.customerAddress && (
                <div className="flex justify-between gap-2 mt-0.5">
                  <span className="text-[#64748B] shrink-0">Address:</span>
                  <span className="text-right">{receipt.customerAddress}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <table className="w-full text-[11px] border-b border-dashed border-slate-300 pb-2 mb-2.5 tabular-nums">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="text-left py-1 font-semibold">Item</th>
                  <th className="text-right py-1 font-semibold">Qty</th>
                  <th className="text-right py-1 font-semibold">Rate</th>
                  <th className="text-right py-1 font-semibold">Amt</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, idx) => (
                  <tr key={`${item.productId}-${idx}`} className="align-top font-normal">
                    <td className="py-1 pr-1.5 font-medium text-[#172C3B]">
                      {item.productName}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {formatMoneyExact(item.unitPrice, sym)}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap font-medium text-[#172C3B]">
                      {formatMoneyExact(item.subtotal, sym)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="space-y-1 text-[11px] font-normal border-b border-dashed border-slate-300 pb-2.5 mb-2.5 tabular-nums">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Subtotal</span>
                <span>{formatMoneyExact(receipt.subtotal, sym)}</span>
              </div>
              {receipt.discountAmount > 0 && (
                <div className="flex justify-between text-[#16A34A]">
                  <span>Discount ({receipt.discountPercent}%)</span>
                  <span>-{formatMoneyExact(receipt.discountAmount, sym)}</span>
                </div>
              )}
              {receipt.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">GST ({receipt.taxRate}%)</span>
                  <span>{formatMoneyExact(receipt.taxAmount, sym)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold pt-1 border-t border-[#E2E8F0] text-[#172C3B]">
                <span>GRAND TOTAL</span>
                <span>{formatMoneyExact(receipt.grandTotal, sym)}</span>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="space-y-1 text-[11px] font-normal border-b border-dashed border-slate-300 pb-2.5 mb-3 tabular-nums">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Payment Mode</span>
                <span className="font-semibold text-[#172C3B]">{receipt.paymentMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">
                  {receipt.type === 'order' ? 'Advance / Paid' : 'Amount Received'}
                </span>
                <span className="font-semibold text-[#172C3B]">
                  {formatMoneyExact(receipt.amountReceived, sym)}
                </span>
              </div>
              {receipt.type === 'order' && (
                <div className="flex justify-between font-semibold text-[#172C3B]">
                  <span>Remaining Balance</span>
                  <span>{formatMoneyExact(receipt.balanceAmount, sym)}</span>
                </div>
              )}
            </div>

            {receipt.notes && (
              <div className="text-[11px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-2 mb-3">
                <span className="font-medium text-[#172C3B]">Order Note: </span>
                <span className="text-[#64748B]">{receipt.notes}</span>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[11px] text-[#64748B] pt-1">
              <p className="font-medium text-[#172C3B]">
                {settings.billing.receiptFooter || 'Thank you! Visit again.'}
              </p>
              <p className="text-[10px] text-[#64748B] mt-1.5">
                Powered by {settings.application.appName || 'Easy Bill'}
                {copies > 1 ? ` · Print Copies: ${copies}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
