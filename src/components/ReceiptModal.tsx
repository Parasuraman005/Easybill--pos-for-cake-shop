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
  const [printError, setPrintError] = useState<string | null>(null);
  const [printedOnce, setPrintedOnce] = useState(false);

  useEffect(() => {
    setPaperSize(settings.printer.paperSize || '80mm');
  }, [settings.printer.paperSize]);

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
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#302A40]/55 backdrop-blur-[2px] p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt Preview and Print"
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-[14px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_16px_44px_rgba(48,42,64,0.18)] overflow-hidden">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#151220]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h3 className="font-display text-[17px] sm:text-[19px] font-semibold text-[#302A40] dark:text-[#F3F1FA] truncate">
              Receipt · <span className="tabular-nums">{receipt.billNumber}</span>
            </h3>
            {printedOnce && !printError && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Printed
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-[10px] bg-[#E9E2FF]/70 dark:bg-[#2A233D]">
              {(['58mm', '80mm', 'A4'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPaperSize(sz)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-[8px] transition-colors whitespace-nowrap shrink-0 ${
                    paperSize === sz
                      ? 'bg-[#7656C9] text-white shadow-sm'
                      : 'text-[#4B3194] dark:text-[#D9CEFF] hover:text-[#302A40]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={triggerBrowserPrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>{printError ? 'Retry Print' : 'Print Receipt'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-[10px] text-[#817A91] hover:text-[#302A40] dark:hover:text-white hover:bg-[#E9E2FF]/60 dark:hover:bg-[#2A233D] transition-colors"
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
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-medium leading-relaxed">{printError}</p>
            </div>
            <button
              type="button"
              onClick={handleReconnectAndPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Connect Printer &amp; Print</span>
            </button>
          </div>
        )}

        {/* Scrollable Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#F7F7FB] dark:bg-[#13101C] flex justify-center">
          <div
            id="easybill-print-sheet"
            data-paper={paperSize}
            className={`${paperWidthClass} bg-white text-[#302A40] border border-[#EAE7F0] shadow-[0_4px_16px_rgba(48,42,64,0.06)] rounded-[12px] p-4 sm:p-5 leading-snug h-fit`}
          >
            {/* Company Header */}
            <div className="text-center border-b border-dashed border-[#D8D2E5] pb-3 mb-3">
              {settings.company.logo && (
                <img
                  src={settings.company.logo}
                  alt={settings.company.name}
                  className="w-12 h-12 object-contain mx-auto mb-1.5"
                />
              )}
              <h2 className="font-display font-bold text-base uppercase tracking-wide text-[#302A40]">
                {settings.company.name}
              </h2>
              {settings.company.address && (
                <p className="text-[11px] font-medium text-[#817A91] mt-0.5">
                  {settings.company.address}
                </p>
              )}
              <div className="text-[11px] font-medium text-[#817A91] mt-0.5">
                {settings.company.phone && <span>Ph: {settings.company.phone}</span>}
                {settings.company.gstin && (
                  <span className="block tabular-nums">GSTIN: {settings.company.gstin}</span>
                )}
              </div>
            </div>

            {/* Bill / Order Metadata */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-[#D8D2E5] pb-2.5 mb-2.5 tabular-nums font-medium">
              <div className="flex justify-between gap-2">
                <span className="text-[#817A91]">Bill No:</span>
                <span className="font-semibold text-[#302A40]">{receipt.billNumber}</span>
              </div>
              {receipt.orderNumber && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#817A91]">Order No:</span>
                  <span className="font-semibold text-[#302A40]">{receipt.orderNumber}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-[#817A91]">Date &amp; Time:</span>
                <span>
                  {formatDateValue(receipt.createdAt, dateFmt)} {formatTimeValue(receipt.createdAt)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#817A91]">Cashier:</span>
                <span>{receipt.username}</span>
              </div>
              {receipt.fulfillmentType && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#817A91]">Order Type:</span>
                  <span className="font-semibold text-[#302A40]">{receipt.fulfillmentType}</span>
                </div>
              )}
              {receipt.deliveryDate && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#817A91]">
                    {receipt.fulfillmentType === 'Pickup' ? 'Pickup:' : 'Delivery:'}
                  </span>
                  <span className="font-semibold text-[#302A40]">
                    {formatDateValue(receipt.deliveryDate, dateFmt)} {receipt.deliveryTime || ''}
                  </span>
                </div>
              )}
            </div>

            {/* Customer Details */}
            <div className="text-[11px] font-medium border-b border-dashed border-[#D8D2E5] pb-2.5 mb-2.5">
              <div className="flex justify-between gap-2">
                <span className="text-[#817A91]">Customer:</span>
                <span className="font-semibold text-right text-[#302A40]">
                  {receipt.customerName || 'Walk-in Customer'}
                </span>
              </div>
              {receipt.customerPhone && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#817A91]">Phone:</span>
                  <span className="tabular-nums">{receipt.customerPhone}</span>
                </div>
              )}
              {receipt.customerAddress && (
                <div className="flex justify-between gap-2 mt-0.5">
                  <span className="text-[#817A91] shrink-0">Address:</span>
                  <span className="text-right">{receipt.customerAddress}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <table className="w-full text-[11px] border-b border-dashed border-[#D8D2E5] pb-2 mb-2.5 tabular-nums">
              <thead>
                <tr className="border-b border-[#EAE7F0] text-[#817A91]">
                  <th className="text-left py-1 font-semibold">Item</th>
                  <th className="text-right py-1 font-semibold">Qty</th>
                  <th className="text-right py-1 font-semibold">Rate</th>
                  <th className="text-right py-1 font-semibold">Amt</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, idx) => (
                  <tr key={`${item.productId}-${idx}`} className="align-top font-medium">
                    <td className="py-1 pr-1.5 font-semibold text-[#302A40]">
                      {item.productName}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {formatMoneyExact(item.unitPrice, sym)}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap font-semibold text-[#302A40]">
                      {formatMoneyExact(item.subtotal, sym)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="space-y-1 text-[11px] font-medium border-b border-dashed border-[#D8D2E5] pb-2.5 mb-2.5 tabular-nums">
              <div className="flex justify-between">
                <span className="text-[#817A91]">Subtotal</span>
                <span>{formatMoneyExact(receipt.subtotal, sym)}</span>
              </div>
              {receipt.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({receipt.discountPercent}%)</span>
                  <span>-{formatMoneyExact(receipt.discountAmount, sym)}</span>
                </div>
              )}
              {receipt.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#817A91]">GST ({receipt.taxRate}%)</span>
                  <span>{formatMoneyExact(receipt.taxAmount, sym)}</span>
                </div>
              )}
              <div className="flex justify-between font-display text-sm font-bold pt-1 border-t border-[#EAE7F0] text-[#302A40]">
                <span>GRAND TOTAL</span>
                <span>{formatMoneyExact(receipt.grandTotal, sym)}</span>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="space-y-1 text-[11px] font-medium border-b border-dashed border-[#D8D2E5] pb-2.5 mb-3 tabular-nums">
              <div className="flex justify-between">
                <span className="text-[#817A91]">Payment Mode</span>
                <span className="font-semibold text-[#302A40]">{receipt.paymentMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#817A91]">
                  {receipt.type === 'order' ? 'Advance / Paid' : 'Amount Received'}
                </span>
                <span className="font-semibold text-[#302A40]">
                  {formatMoneyExact(receipt.amountReceived, sym)}
                </span>
              </div>
              {receipt.type === 'order' && (
                <div className="flex justify-between font-bold text-[#302A40]">
                  <span>Remaining Balance</span>
                  <span>{formatMoneyExact(receipt.balanceAmount, sym)}</span>
                </div>
              )}
            </div>

            {receipt.notes && (
              <div className="text-[11px] bg-[#F7F7FB] border border-[#EAE7F0] rounded-[10px] p-2 mb-3">
                <span className="font-semibold text-[#302A40]">Order Note: </span>
                <span className="text-[#817A91]">{receipt.notes}</span>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[11px] text-[#817A91] pt-1">
              <p className="font-semibold text-[#302A40]">
                {settings.billing.receiptFooter || 'Thank you! Visit again.'}
              </p>
              <p className="text-[10px] text-[#817A91] mt-1.5">
                Powered by {settings.application.appName || 'Easy Bill'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
