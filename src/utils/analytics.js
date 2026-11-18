import { db } from "../db/db";

/**
 * Get monthly breakdown for a specific category over N months
 */
export async function getCategoryMonthlyBreakdown(categoryId, months = 6) {
  const now = new Date();
  const results = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime() - 1;

    const txs = await db.transactions
      .where("categoryId").equals(categoryId)
      .and(t => t.date >= from && t.date <= to && !t.deleted)
      .toArray();

    const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const income = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const savingOut = txs.filter(t => t.type === "saving" && t.direction === "out").reduce((s, t) => s + t.amount, 0);
    const savingIn = txs.filter(t => t.type === "saving" && t.direction === "in").reduce((s, t) => s + t.amount, 0);

    results.push({
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
      expense,
      income,
      savingOut,
      savingIn,
      net: income - expense + savingIn - savingOut,
      count: txs.length,
    });
  }
  return results;
}

/**
 * Get monthly summary for all categories over N months
 */
export async function getMonthlySummary(months = 12) {
  const now = new Date();
  const results = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime() - 1;

    const txs = await db.transactions
      .where("date").between(from, to, true, true)
      .and(t => !t.deleted)
      .toArray();

    const byCategory = {};
    let totalExpense = 0, totalIncome = 0, totalSavingOut = 0, totalSavingIn = 0;

    for (const t of txs) {
      if (t.type === "expense") {
        totalExpense += t.amount;
        byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
      } else if (t.type === "income") {
        totalIncome += t.amount;
      } else if (t.type === "saving") {
        if (t.direction === "out") totalSavingOut += t.amount;
        else totalSavingIn += t.amount;
      }
    }

    results.push({
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
      totalExpense,
      totalIncome,
      totalSavingOut,
      totalSavingIn,
      net: totalIncome - totalExpense + totalSavingIn - totalSavingOut,
      byCategory,
      count: txs.length,
    });
  }
  return results;
}

/**
 * Get category comparison for a specific month
 */
export async function getCategoryComparison(monthKey) {
  // monthKey format: "2026-11"
  const [year, month] = monthKey.split("-").map(Number);
  const from = new Date(year, month - 1, 1).getTime();
  const to = new Date(year, month, 1).getTime() - 1;

  const categories = await db.categories
    .where("type").equals("expense")
    .and(c => !c.deleted)
    .toArray();

  const txs = await db.transactions
    .where("date").between(from, to, true, true)
    .and(t => t.type === "expense" && !t.deleted)
    .toArray();

  const spentMap = {};
  for (const t of txs) {
    spentMap[t.categoryId] = (spentMap[t.categoryId] || 0) + t.amount;
  }

  return categories.map(cat => ({
    categoryId: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    spent: spentMap[cat.id] || 0,
  })).sort((a, b) => b.spent - a.spent);
}

/**
 * Get top categories by spending over N months
 */
export async function getTopCategories(months = 6, limit = 5) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;

  const categories = await db.categories
    .where("type").equals("expense")
    .and(c => !c.deleted)
    .toArray();

  const txs = await db.transactions
    .where("date").between(from, to, true, true)
    .and(t => t.type === "expense" && !t.deleted)
    .toArray();

  const spentMap = {};
  for (const t of txs) {
    spentMap[t.categoryId] = (spentMap[t.categoryId] || 0) + t.amount;
  }

  return categories
    .map(cat => ({
      categoryId: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      spent: spentMap[cat.id] || 0,
    }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, limit);
}

/**
 * Get daily spending data for calendar heatmap
 */
export async function getDailySpending(months = 12) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;

  const txs = await db.transactions
    .where("date").between(from, to, true, true)
    .and(t => t.type === "expense" && !t.deleted)
    .toArray();

  const dailyMap = {};
  for (const t of txs) {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dailyMap[key] = (dailyMap[key] || 0) + t.amount;
  }

  return dailyMap;
}

/**
 * Export monthly summary to CSV
 */
export function exportMonthlySummaryToCSV(monthlySummary, categories) {
  const categoryMap = {};
  categories.forEach(c => categoryMap[c.id] = c.name);

  const headers = ["Bulan", "Total Pengeluaran", "Total Pemasukan", "Tabungan Keluar", "Tabungan Masuk", "Net", "Jumlah Transaksi"];
  const categoryHeaders = Object.values(categoryMap);
  const allHeaders = [...headers, ...categoryHeaders];

  const rows = monthlySummary.map(m => {
    const row = [
      m.monthLabel,
      m.totalExpense,
      m.totalIncome,
      m.totalSavingOut,
      m.totalSavingIn,
      m.net,
      m.count,
    ];
    categoryHeaders.forEach(catName => {
      const catId = Object.keys(categoryMap).find(id => categoryMap[id] === catName);
      row.push(m.byCategory[catId] || 0);
    });
    return row;
  });

  const csv = [allHeaders.join(","), ...rows.map(r => r.join(","))].join("\n");
  return csv;
}

/**
 * Export category trend to CSV
 */
export function exportCategoryTrendToCSV(categoryTrend, categoryName) {
  const headers = ["Bulan", "Pengeluaran", "Pemasukan", "Tabungan Keluar", "Tabungan Masuk", "Net", "Jumlah Transaksi"];
  const rows = categoryTrend.map(c => [
    c.monthLabel,
    c.expense,
    c.income,
    c.savingOut,
    c.savingIn,
    c.net,
    c.count,
  ]);

  const csv = [`Laporan Kategori: ${categoryName}`, "", headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  return csv;
}

/**
 * Export monthly category comparison to CSV
 */
export function exportMonthlyComparisonToCSV(categoryComparison, monthLabel) {
  const headers = ["Kategori", "Jumlah", "Persentase"];
  const total = categoryComparison.reduce((s, c) => s + c.spent, 0);
  const rows = categoryComparison
    .filter(c => c.spent > 0)
    .map(c => [c.name, c.spent, total ? ((c.spent / total) * 100).toFixed(1) + "%" : "0%"]);

  const csv = [`Laporan Bulanan: ${monthLabel}`, "", headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  return csv;
}

/**
 * Trigger download of CSV file
 */
export function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}