import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateValue, formatMoneyExact, formatTimeValue, formatYMD } from './format';
import { THEME_PRESETS, getStoredThemePreset } from './theme';
import type { AllSettings, SalesTransaction } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

let cachedRegularFontBase64: string | null = null;
let cachedBoldFontBase64: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function ensurePdfFontsLoaded(): Promise<{ regular: string; bold: string }> {
  if (!cachedRegularFontBase64) {
    const res = await fetch('/fonts/DejaVuSans.ttf');
    if (!res.ok) throw new Error('Unable to load PDF regular font');
    cachedRegularFontBase64 = arrayBufferToBase64(await res.arrayBuffer());
  }
  if (!cachedBoldFontBase64) {
    const res = await fetch('/fonts/DejaVuSans-Bold.ttf');
    if (!res.ok) throw new Error('Unable to load PDF bold font');
    cachedBoldFontBase64 = arrayBufferToBase64(await res.arrayBuffer());
  }
  return { regular: cachedRegularFontBase64, bold: cachedBoldFontBase64 };
}

async function loadLogoAsPngDataUrl(src: string): Promise<string | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function summarizeTotalQuantity(tx: SalesTransaction): string {
  const byUnit = new Map<string, number>();
  for (const item of tx.items) {
    const prev = byUnit.get(item.unit) || 0;
    byUnit.set(item.unit, prev + Number(item.quantity || 0));
  }
  if (byUnit.size === 0) return '0';
  return Array.from(byUnit.entries())
    .map(([unit, qty]) => {
      const cleanQty = Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/\.?0+$/, '');
      return `${cleanQty} ${unit}`;
    })
    .join('\n');
}

function formatProductDetails(tx: SalesTransaction, sym: string): string {
  if (!tx.items || tx.items.length === 0) return '—';
  return tx.items
    .map((item) => {
      const qtyStr = Number.isInteger(item.quantity)
        ? String(item.quantity)
        : Number(item.quantity).toFixed(2).replace(/\.?0+$/, '');
      return `• ${item.productName} (${qtyStr} ${item.unit} × ${formatMoneyExact(item.unitPrice, sym)} = ${formatMoneyExact(item.subtotal, sym)})`;
    })
    .join('\n');
}

export interface ExportSalesPdfParams {
  transactions: SalesTransaction[];
  fromDate: string;
  toDate: string;
  searchQuery?: string;
  settings: AllSettings;
}

export async function generateSalesHistoryPDF({
  transactions,
  fromDate,
  toDate,
  searchQuery,
  settings,
}: ExportSalesPdfParams): Promise<string> {
  const { regular, bold } = await ensurePdfFontsLoaded();
  const logoDataUrl = await loadLogoAsPngDataUrl(settings.company.logo);

  const activeThemeId = settings.application.colorTheme || getStoredThemePreset();
  const preset = THEME_PRESETS.find((t) => t.id === activeThemeId) || THEME_PRESETS[0];
  const primaryRgb = hexToRgb(preset.light.primary);
  const accentRgb = hexToRgb(preset.light.accent);
  const accentTextRgb = hexToRgb(preset.light.accentText);
  const mutedRgb = hexToRgb(preset.light.textMuted);
  const borderRgb = hexToRgb(preset.light.border);
  const bgRgb = hexToRgb(preset.light.bg);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  doc.addFileToVFS('DejaVuSans.ttf', regular);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', bold);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
  doc.setFont('DejaVuSans', 'normal');

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';
  const now = new Date();
  const generatedDateStr = formatDateValue(now, dateFmt);
  const generatedTimeStr = formatTimeValue(now);
  const fromDisplay = formatYMD(fromDate, dateFmt);
  const toDisplay = formatYMD(toDate, dateFmt);

  const totalSalesAmount = transactions.reduce((acc, t) => acc + t.grandTotal, 0);
  const totalSubtotal = transactions.reduce((acc, t) => acc + t.subtotal, 0);
  const totalDiscount = transactions.reduce((acc, t) => acc + t.discountAmount, 0);
  const totalTax = transactions.reduce((acc, t) => acc + t.taxAmount, 0);
  const totalReceived = transactions.reduce((acc, t) => acc + t.amountReceived, 0);
  const totalAdvance = transactions.reduce((acc, t) => acc + t.advanceAmount, 0);
  const totalBalance = transactions.reduce((acc, t) => acc + t.balanceAmount, 0);

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const marginX = 10;

  // Top Theme Accent Strip
  doc.setFillColor(...accentRgb);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Company Header (Left)
  let textStartX = marginX;
  if (logoDataUrl) {
    try {
      doc.setDrawColor(...borderRgb);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(marginX, 8, 15, 15, 2, 2, 'FD');
      doc.addImage(logoDataUrl, 'PNG', marginX + 1, 9, 13, 13);
      textStartX = marginX + 18.5;
    } catch {
      textStartX = marginX;
    }
  }

  const companyName = settings.company.name || 'Easy Bill Bakery';
  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryRgb);
  doc.text(companyName, textStartX, 12.5);

  doc.setFont('DejaVuSans', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedRgb);
  const contactParts: string[] = [];
  if (settings.company.phone) contactParts.push(`Ph: ${settings.company.phone}`);
  if (settings.company.email) contactParts.push(settings.company.email);
  if (settings.company.gstin) contactParts.push(`GSTIN: ${settings.company.gstin}`);

  if (settings.company.address) {
    doc.text(settings.company.address, textStartX, 17.5, { maxWidth: 135 });
  }
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  |  '), textStartX, 22);
  }

  // Report Metadata (Right)
  const rightX = pageWidth - marginX;
  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...accentTextRgb);
  doc.text('Sales History Report', rightX, 12.5, { align: 'right' });

  doc.setFont('DejaVuSans', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...primaryRgb);
  doc.text(`Period: ${fromDisplay} to ${toDisplay}`, rightX, 17.8, { align: 'right' });

  doc.setTextColor(...mutedRgb);
  doc.text(`Generated: ${generatedDateStr} ${generatedTimeStr}`, rightX, 22.3, { align: 'right' });
  if (searchQuery && searchQuery.trim()) {
    doc.text(`Search Filter: "${searchQuery.trim()}"`, rightX, 26.5, { align: 'right' });
  }

  // Summary Banner
  const bannerY = 29;
  const bannerW = pageWidth - marginX * 2;
  doc.setFillColor(...bgRgb);
  doc.setDrawColor(...borderRgb);
  doc.roundedRect(marginX, bannerY, bannerW, 13, 2, 2, 'FD');

  doc.setFont('DejaVuSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedRgb);
  doc.text('Total Sales Amount (Selected Period)', marginX + 4, bannerY + 4.8);
  doc.text('Transactions', marginX + 82, bannerY + 4.8);
  doc.text('Total Received', marginX + 132, bannerY + 4.8);
  doc.text('Remaining Balance', marginX + 195, bannerY + 4.8);

  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...accentTextRgb);
  doc.text(formatMoneyExact(totalSalesAmount, sym), marginX + 4, bannerY + 10.3);

  doc.setTextColor(...primaryRgb);
  doc.text(String(transactions.length), marginX + 82, bannerY + 10.3);
  doc.text(formatMoneyExact(totalReceived, sym), marginX + 132, bannerY + 10.3);
  doc.text(formatMoneyExact(totalBalance, sym), marginX + 195, bannerY + 10.3);

  const head = [
    [
      'S.No',
      'Bill / Order No',
      'Transaction Date',
      'Customer Name',
      'Phone Number',
      'Product Details',
      'Total Qty',
      'Subtotal',
      'Discount',
      'GST / Tax',
      'Grand Total',
      'Mode',
      'Amount Received',
      'Advance Amount',
      'Remaining Balance',
    ],
  ];

  const body = transactions.map((tx, idx) => {
    const refText = tx.orderNumber ? `${tx.billNumber}\n(${tx.orderNumber})` : tx.billNumber;
    const txDateText = `${formatDateValue(tx.createdAt, dateFmt)}\n${formatTimeValue(tx.createdAt)}`;
    return [
      String(idx + 1),
      refText,
      txDateText,
      tx.customerName || 'Walk-in Customer',
      tx.customerPhone || '—',
      formatProductDetails(tx, sym),
      summarizeTotalQuantity(tx),
      formatMoneyExact(tx.subtotal, sym),
      formatMoneyExact(tx.discountAmount, sym),
      formatMoneyExact(tx.taxAmount, sym),
      formatMoneyExact(tx.grandTotal, sym),
      tx.paymentMode,
      formatMoneyExact(tx.amountReceived, sym),
      formatMoneyExact(tx.advanceAmount, sym),
      formatMoneyExact(tx.balanceAmount, sym),
    ];
  });

  const foot = [
    [
      '',
      'TOTAL',
      '',
      `${transactions.length} Records`,
      '',
      '',
      '',
      formatMoneyExact(totalSubtotal, sym),
      formatMoneyExact(totalDiscount, sym),
      formatMoneyExact(totalTax, sym),
      formatMoneyExact(totalSalesAmount, sym),
      '',
      formatMoneyExact(totalReceived, sym),
      formatMoneyExact(totalAdvance, sym),
      formatMoneyExact(totalBalance, sym),
    ],
  ];

  autoTable(doc, {
    startY: bannerY + 16,
    margin: { top: 14, left: marginX, right: marginX, bottom: 15 },
    head,
    body,
    foot,
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    theme: 'grid',
    styles: {
      font: 'DejaVuSans',
      fontSize: 6.6,
      cellPadding: { top: 1.8, right: 1.2, bottom: 1.8, left: 1.2 },
      textColor: primaryRgb,
      lineColor: borderRgb,
      lineWidth: 0.2,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      font: 'DejaVuSans',
      fontStyle: 'bold',
      fontSize: 6.7,
      fillColor: primaryRgb,
      textColor: [255, 255, 255],
      halign: 'left',
      valign: 'middle',
      cellPadding: { top: 2.2, right: 1.2, bottom: 2.2, left: 1.2 },
    },
    footStyles: {
      font: 'DejaVuSans',
      fontStyle: 'bold',
      fontSize: 6.8,
      fillColor: bgRgb,
      textColor: primaryRgb,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: bgRgb,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 21 },
      2: { cellWidth: 19 },
      3: { cellWidth: 23 },
      4: { cellWidth: 19 },
      5: { cellWidth: 51 },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 14, halign: 'right' },
      9: { cellWidth: 14, halign: 'right' },
      10: { cellWidth: 17, halign: 'right', fontStyle: 'bold' },
      11: { cellWidth: 13, halign: 'center' },
      12: { cellWidth: 16, halign: 'right' },
      13: { cellWidth: 16, halign: 'right' },
      14: { cellWidth: 16, halign: 'right' },
    },
    didParseCell: (data) => {
      if ((data.section === 'head' || data.section === 'foot') && [6, 7, 8, 9, 10, 12, 13, 14].includes(data.column.index)) {
        data.cell.styles.halign = 'right';
      }
      if (data.section === 'head' && data.column.index === 0) {
        data.cell.styles.halign = 'center';
      }
      if (data.section === 'head' && data.column.index === 11) {
        data.cell.styles.halign = 'center';
      }
    },
  });

  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);

    doc.setFont('DejaVuSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedRgb);
    doc.text(`${companyName} · Sales History Report`, marginX, pageHeight - 6.5);
    doc.text(`Period: ${fromDisplay} to ${toDisplay}`, pageWidth / 2, pageHeight - 6.5, {
      align: 'center',
    });
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 6.5, {
      align: 'right',
    });
  }

  const filename = `EasyBill_Sales_Report_${generatedDateStr}.pdf`;
  doc.save(filename);
  return filename;
}
