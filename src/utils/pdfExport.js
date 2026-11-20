/**
 * PDF Export Utility for FamilyPath
 * Uses browser's print-to-PDF functionality with custom print layout
 * No external dependencies required
 */

import { formatRupiah, formatDateID, monthKeyToLabel } from "./format";
import { getIcon } from "./icons";

/**
 * Generate HTML content for PDF report
 */
export function generateReportHTML(data, options = {}) {
  const {
    title = "Laporan Keuangan FamilyPath",
    period = "Bulan Ini",
    includeCategoryBreakdown = true,
    includeMonthlyTrend = true,
    includeTransactions = false,
    transactions = [],
    categories = [],
    summary = {},
    logo = null,
  } = options;

  const categoryMap = {};
  categories.forEach(c => categoryMap[c.id] = c);

  const formatNumber = (num) => formatRupiah(num);
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Category breakdown table rows
  const categoryRows = Object.entries(summary.byCategory || {})
    .map(([catId, amount]) => {
      const cat = categoryMap[catId];
      if (!cat) return null;
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">
            <span style="display: inline-flex; align-items: center; gap: 8px;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background-color: ${cat.color}20; color: ${cat.color}; display: inline-flex; align-items: center; justify-content: center; font-size: 12px;">
                ${cat.icon ? getIconSvg(cat.icon) : '●'}
              </span>
              ${cat.name}
            </span>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-family: monospace;">${formatNumber(amount)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-family: monospace;">${summary.totalExpense > 0 ? ((amount / summary.totalExpense) * 100).toFixed(1) : 0}%</td>
        </tr>
      `;
    })
    .filter(Boolean)
    .join('');

  // Transaction rows
  const transactionRows = transactions
    .slice(0, options.maxTransactions || 50)
    .map(tx => {
      const cat = categoryMap[tx.categoryId];
      const isIncome = tx.type === 'income';
      const isSaving = tx.type === 'saving';
      const amountClass = isIncome ? 'color: #2f8f4e;' : (isSaving ? 'color: #8a5cf6;' : 'color: #c14f3d;');
      const amountPrefix = isIncome ? '+' : (isSaving && tx.direction === 'out' ? '+' : '-');
      return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 11px;">${formatDateID(tx.date)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 11px;">${tx.description || '-'}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 11px;">${cat?.name || 'Lainnya'}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 11px; text-align: right; ${amountClass} font-weight: 600; font-family: monospace;">${amountPrefix}${formatNumber(tx.amount)}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} - ${period}</title>
  <style>
    @page {
      margin: 20mm;
      size: A4;
    }
    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1a1a2e;
      margin: 0;
      padding: 20px;
      background: white;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #131b2e;
    }
    .logo {
      width: 60px;
      height: 60px;
      border-radius: 16px;
      background: linear-gradient(135deg, #131b2e 0%, #1e2d4a 100%);
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: bold;
    }
    .title { font-size: 24px; font-weight: 700; color: #131b2e; margin: 0 0 4px; }
    .subtitle { font-size: 14px; color: #666; margin: 0 0 8px; }
    .period { font-size: 13px; color: #888; font-weight: 500; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 24px 0;
    }
    .summary-card {
      background: #f8f9fb;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      border: 1px solid #e8eaf0;
    }
    .summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 8px; font-weight: 600; }
    .summary-value { font-size: 20px; font-weight: 700; font-family: monospace; color: #131b2e; }
    .summary-value.income { color: #2f8f4e; }
    .summary-value.expense { color: #c14f3d; }
    .summary-value.net { color: #131b2e; }
    .section { margin: 32px 0; }
    .section-title { font-size: 16px; font-weight: 700; color: #131b2e; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; gap: 8px; }
    .section-icon { width: 28px; height: 28px; border-radius: 8px; background: #131b2e15; color: #131b2e; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 10px 12px; background: #f5f5f5; font-weight: 600; color: #444; border-bottom: 2px solid #ddd; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
    tr:last-child td { border-bottom: none; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      font-size: 10px;
      color: #999;
    }
    .page-break { page-break-before: always; }
    .text-right { text-align: right; }
    .font-mono { font-family: monospace; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .badge-expense { background: #fee2e2; color: #c14f3d; }
    .badge-income { background: #dcfce7; color: #2f8f4e; }
    .badge-saving { background: #ede9fe; color: #8a5cf6; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">FP</div>
    <h1 class="title">${title}</h1>
    <p class="subtitle">${period}</p>
    <p class="period">Dibuat pada ${currentDate}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Pemasukan</div>
      <div class="summary-value income">${formatNumber(summary.totalIncome || 0)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Pengeluaran</div>
      <div class="summary-value expense">${formatNumber(summary.totalExpense || 0)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Selisih (Net)</div>
      <div class="summary-value net ${(summary.totalIncome || 0) >= (summary.totalExpense || 0) ? 'income' : 'expense'}">
        ${(summary.totalIncome || 0) >= (summary.totalExpense || 0) ? '+' : ''}${formatNumber((summary.totalIncome || 0) - (summary.totalExpense || 0))}
      </div>
    </div>
  </div>

  ${includeCategoryBreakdown && Object.keys(summary.byCategory || {}).length > 0 ? `
  <div class="section">
    <h2 class="section-title"><span class="section-icon">📊</span> Breakdown per Kategori</h2>
    <table>
      <thead>
        <tr>
          <th>Kategori</th>
          <th class="text-right">Jumlah</th>
          <th class="text-right">%</th>
        </tr>
      </thead>
      <tbody>
        ${categoryRows}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${includeMonthlyTrend && summary.monthlyTrend?.length > 0 ? `
  <div class="section page-break">
    <h2 class="section-title"><span class="section-icon">📈</span> Tren Bulanan (${summary.monthlyTrend.length} Bulan)</h2>
    <table>
      <thead>
        <tr>
          <th>Bulan</th>
          <th class="text-right">Pengeluaran</th>
          <th class="text-right">Pemasukan</th>
          <th class="text-right">Net</th>
        </tr>
      </thead>
      <tbody>
        ${summary.monthlyTrend.map(m => `
          <tr>
            <td>${m.monthLabel}</td>
            <td class="text-right font-mono" style="color: #c14f3d;">${formatNumber(m.totalExpense)}</td>
            <td class="text-right font-mono" style="color: #2f8f4e;">${formatNumber(m.totalIncome)}</td>
            <td class="text-right font-mono" style="color: ${m.net >= 0 ? '#2f8f4e' : '#c14f3d'};">${m.net >= 0 ? '+' : ''}${formatNumber(m.net)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${includeTransactions && transactions.length > 0 ? `
  <div class="section page-break">
    <h2 class="section-title"><span class="section-icon">📝</span> Detail Transaksi (${transactions.length} items)</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 80px;">Tanggal</th>
          <th>Deskripsi</th>
          <th style="width: 120px;">Kategori</th>
          <th class="text-right" style="width: 100px;">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${transactionRows}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>Laporan ini dibuat secara otomatis oleh <strong>FamilyPath</strong> - Aplikasi Pencatat Keuangan Keluarga</p>
    <p>Data bersifat pribadi dan disimpan lokal di perangkat Anda. Tidak ada data yang dikirim ke server.</p>
    <p style="margin-top: 8px;">© ${new Date().getFullYear()} FamilyPath. Semua hak cipta dilindungi.</p>
  </div>
</body>
</html>`;
}

/**
 * Simple SVG icons for PDF (since we can't use lucide-react in print)
 */
function getIconSvg(name) {
  const icons = {
    'utensils': '🍽️',
    'car': '🚗',
    'shopping-cart': '🛒',
    'zap': '⚡',
    'graduation-cap': '🎓',
    'heart-pulse': '❤️',
    'popcorn': '🍿',
    'credit-card': '💳',
    'more-horizontal': '⋯',
    'wallet': '👛',
    'gift': '🎁',
    'trending-up': '📈',
    'piggy-bank': '🐷',
    'target': '🎯',
    'home': '🏠',
    'coffee': '☕',
    'book': '📚',
    'dumbbell': '💪',
    'shirt': '👕',
    'paw-print': '🐾',
    'music': '🎵',
    'gamepad': '🎮',
    'stethoscope': '🩺',
    'fuel': '⛽',
    'droplet': '💧',
  };
  return icons[name] || '📌';
}

/**
 * Open print dialog for PDF export
 */
export function printToPDF(htmlContent, filename = 'laporan-familypath.pdf') {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for content to load then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      // Optional: close window after print (user might want to save as PDF)
      // setTimeout(() => printWindow.close(), 1000);
    }, 250);
  };
}

/**
 * Generate and print PDF report with filters
 */
export async function exportReportToPDF(db, options = {}) {
  const {
    monthKey = new Date().toISOString().slice(0, 7), // "2026-11"
    includeCategoryBreakdown = true,
    includeMonthlyTrend = true,
    includeTransactions = false,
    maxTransactions = 100,
    categories: providedCategories = null,
  } = options;

  // Fetch data
  const [year, month] = monthKey.split('-').map(Number);
  const from = new Date(year, month - 1, 1).getTime();
  const to = new Date(year, month, 1).getTime() - 1;

  const categories = providedCategories || await db.categories.filter(c => !c.deleted).toArray();
  const transactions = await db.transactions
    .where('date').between(from, to, true, true)
    .and(t => !t.deleted)
    .toArray();

  // Calculate summary
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalSavingOut = transactions.filter(t => t.type === 'saving' && t.direction === 'out').reduce((s, t) => s + t.amount, 0);
  const totalSavingIn = transactions.filter(t => t.type === 'saving' && t.direction === 'in').reduce((s, t) => s + t.amount, 0);

  // By category
  const byCategory = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
  });

  // Monthly trend (last 6 months)
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const mFrom = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const mTo = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;
    const mTxs = await db.transactions
      .where('date').between(mFrom, mTo, true, true)
      .and(t => !t.deleted)
      .toArray();
    const mExpense = mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const mIncome = mTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    monthlyTrend.push({
      monthLabel: d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
      totalExpense: mExpense,
      totalIncome: mIncome,
      net: mIncome - mExpense,
    });
  }

  const summary = {
    totalIncome,
    totalExpense,
    totalSavingOut,
    totalSavingIn,
    net: totalIncome - totalExpense + totalSavingIn - totalSavingOut,
    byCategory,
    monthlyTrend,
  };

  const periodLabel = monthKeyToLabel(monthKey);
  const html = generateReportHTML(transactions, {
    title: "Laporan Keuangan FamilyPath",
    period: periodLabel,
    includeCategoryBreakdown,
    includeMonthlyTrend,
    includeTransactions,
    transactions,
    categories,
    summary,
    maxTransactions,
  });

  printToPDF(html, `laporan-familypath-${monthKey}.pdf`);
}

/**
 * Quick export with default settings (for one-click button)
 */
export async function quickExportPDF(db) {
  return exportReportToPDF(db, {
    includeCategoryBreakdown: true,
    includeMonthlyTrend: true,
    includeTransactions: false,
  });
}

/**
 * Detailed export with transactions
 */
export async function detailedExportPDF(db) {
  return exportReportToPDF(db, {
    includeCategoryBreakdown: true,
    includeMonthlyTrend: true,
    includeTransactions: true,
    maxTransactions: 200,
  });
}