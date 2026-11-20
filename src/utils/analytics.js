import { db } from "../db/db";
import { filterTransactionsForDailyLimit, getDailyLimitCategories } from "./dailyLimitSettings";

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

/**
 * Calculate daily safe-spend limit (Savvr-style 50/30/20 budgeting)
 * Based on monthly income, fixed expenses, and savings goals
 * @param {Object} options - Options for calculation
 * @param {boolean} options.useCategoryFilter - Whether to filter by user-selected categories
 * @param {Array} options.categories - Categories for filtering (required if useCategoryFilter is true)
 */
export async function calculateDailySafeSpend(options = {}) {
  const { useCategoryFilter = true, categories = [] } = options;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate() + 1;

  // Get current month transactions
  const allTxs = await db.transactions
    .where("date").between(monthStart, monthEnd, true, true)
    .and(t => !t.deleted)
    .toArray();

  // Filter transactions based on daily limit category settings
  const txs = useCategoryFilter && categories.length > 0
    ? filterTransactionsForDailyLimit(allTxs, categories)
    : allTxs;

  // Calculate monthly income (salary + other income)
  const monthlyIncome = txs
    .filter(t => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);

  // Calculate fixed expenses (already spent this month) - only from enabled categories
  const spentThisMonth = txs
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  // Calculate savings outflow (money moved to goals)
  const savingsOut = txs
    .filter(t => t.type === "saving" && t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);

  // Get budgets for this month
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const budgets = await db.budgets
    .where("month").equals(monthKey)
    .and(b => !b.deleted)
    .toArray();
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);

  // 50/30/20 Rule:
  // 50% Needs (fixed expenses + essentials)
  // 30% Wants (discretionary)
  // 20% Savings/Debt
  const needsBudget = monthlyIncome * 0.5;
  const wantsBudget = monthlyIncome * 0.3;
  const savingsBudget = monthlyIncome * 0.2;

  // What's already allocated to needs (spent + committed budgets)
  const allocatedNeeds = Math.max(spentThisMonth, totalBudget);

  // Remaining for wants (daily safe spend)
  const remainingForWants = Math.max(0, wantsBudget - (allocatedNeeds - needsBudget));
  const dailySafeSpend = daysRemaining > 0 ? remainingForWants / daysRemaining : 0;

  // Also calculate simple version: (Income - Fixed Expenses - Savings Target) / Days Remaining
  const simpleDailyLimit = monthlyIncome > 0
    ? Math.max(0, (monthlyIncome - spentThisMonth - savingsOut) / daysRemaining)
    : 0;

  return {
    monthlyIncome,
    spentThisMonth,
    savingsOut,
    totalBudget,
    daysInMonth,
    daysRemaining,
    // 50/30/20 breakdown
    needsBudget,
    wantsBudget,
    savingsBudget,
    allocatedNeeds,
    remainingForWants,
    dailySafeSpend,
    // Simple version
    simpleDailyLimit,
    // Health indicators
    needsUsagePct: needsBudget > 0 ? (allocatedNeeds / needsBudget) * 100 : 0,
    wantsUsagePct: wantsBudget > 0 ? ((wantsBudget - remainingForWants) / wantsBudget) * 100 : 0,
    savingsPct: monthlyIncome > 0 ? (savingsOut / monthlyIncome) * 100 : 0,
    // Settings info
    categoryFilterEnabled: useCategoryFilter,
    activeCategoryCount: getDailyLimitCategories() === "all" ? "all" : getDailyLimitCategories().length,
  };
}

/**
 * Calculate Budget Health Score (0-100)
 * Factors: budget adherence, savings rate, expense tracking consistency, debt ratio
 */
export async function calculateBudgetHealthScore() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;

  // Current month data
  const txs = await db.transactions
    .where("date").between(monthStart, monthEnd, true, true)
    .and(t => !t.deleted)
    .toArray();

  const monthlyIncome = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthlyExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const monthlySavings = txs.filter(t => t.type === "saving" && t.direction === "out").reduce((s, t) => s + t.amount, 0);

  // Budget data
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const budgets = await db.budgets.where("month").equals(monthKey).and(b => !b.deleted).toArray();
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);

  // Previous months for trend (last 3 months)
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
  const historyTxs = await db.transactions
    .where("date").between(threeMonthsAgo, monthEnd, true, true)
    .and(t => !t.deleted)
    .toArray();

  // Calculate monthly averages
  const monthlyData = {};
  historyTxs.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0, savings: 0 };
    if (t.type === "income") monthlyData[key].income += t.amount;
    else if (t.type === "expense") monthlyData[key].expense += t.amount;
    else if (t.type === "saving" && t.direction === "out") monthlyData[key].savings += t.amount;
  });

  const months = Object.keys(monthlyData).sort();
  const avgIncome = months.length ? months.reduce((s, m) => s + monthlyData[m].income, 0) / months.length : 0;
  const avgExpense = months.length ? months.reduce((s, m) => s + monthlyData[m].expense, 0) / months.length : 0;
  const avgSavings = months.length ? months.reduce((s, m) => s + monthlyData[m].savings, 0) / months.length : 0;

  // --- Scoring Components (each 0-100) ---

  // 1. Budget Adherence (25% weight)
  // How well spending matches budget
  let budgetAdherence = 100;
  if (totalBudget > 0) {
    const overBudget = Math.max(0, monthlyExpense - totalBudget);
    budgetAdherence = Math.max(0, 100 - (overBudget / totalBudget) * 100);
  } else if (monthlyIncome > 0) {
    // No budget set - penalize slightly
    budgetAdherence = 70;
  }

  // 2. Savings Rate (25% weight)
  // Target: 20% of income (50/30/20 rule)
  let savingsScore = 0;
  if (monthlyIncome > 0) {
    const savingsRate = (monthlySavings / monthlyIncome) * 100;
    savingsScore = Math.min(100, (savingsRate / 20) * 100); // 20% target = 100 score
  }

  // 3. Expense Tracking Consistency (20% weight)
  // How many days had transactions vs total days
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysWithExpense = new Set(
    txs.filter(t => t.type === "expense").map(t => new Date(t.date).getDate())
  ).size;
  const trackingConsistency = Math.min(100, (daysWithExpense / daysInMonth) * 100 * 1.5); // generous

  // 4. Income vs Expense Ratio (15% weight)
  // Healthy: expense < income
  let incomeExpenseScore = 100;
  if (monthlyIncome > 0) {
    const ratio = monthlyExpense / monthlyIncome;
    if (ratio <= 0.5) incomeExpenseScore = 100;
    else if (ratio <= 0.7) incomeExpenseScore = 80;
    else if (ratio <= 0.9) incomeExpenseScore = 60;
    else if (ratio <= 1.0) incomeExpenseScore = 40;
    else incomeExpenseScore = Math.max(0, 40 - (ratio - 1) * 50);
  }

  // 5. Trend Improvement (15% weight)
  // Is this month better than 3-month average?
  let trendScore = 50;
  if (months.length >= 2) {
    const currentExpense = monthlyExpense;
    const prevAvgExpense = avgExpense;
    if (prevAvgExpense > 0) {
      const improvement = (prevAvgExpense - currentExpense) / prevAvgExpense;
      trendScore = Math.min(100, Math.max(0, 50 + improvement * 100));
    }
  }

  // Weighted total
  const weights = {
    budgetAdherence: 0.25,
    savingsScore: 0.25,
    trackingConsistency: 0.20,
    incomeExpenseScore: 0.15,
    trendScore: 0.15,
  };

  const totalScore = Math.round(
    budgetAdherence * weights.budgetAdherence +
    savingsScore * weights.savingsScore +
    trackingConsistency * weights.trackingConsistency +
    incomeExpenseScore * weights.incomeExpenseScore +
    trendScore * weights.trendScore
  );

  // Grade
  let grade, gradeColor, gradeLabel;
  if (totalScore >= 90) { grade = "A+"; gradeColor = "#2f8f4e"; gradeLabel = "Sangat Sehat"; }
  else if (totalScore >= 80) { grade = "A"; gradeColor = "#3aa863"; gradeLabel = "Sehat"; }
  else if (totalScore >= 70) { grade = "B+"; gradeColor = "#5a9e6f"; gradeLabel = "Baik"; }
  else if (totalScore >= 60) { grade = "B"; gradeColor = "#e0a72c"; gradeLabel = "Cukup"; }
  else if (totalScore >= 50) { grade = "C"; gradeColor = "#d97757"; gradeLabel = "Perlu Perhatian"; }
  else { grade = "D"; gradeColor = "#c14f3d"; gradeLabel = "Tidak Sehat"; }

  return {
    score: totalScore,
    grade,
    gradeColor,
    gradeLabel,
    breakdown: {
      budgetAdherence: Math.round(budgetAdherence),
      savingsScore: Math.round(savingsScore),
      trackingConsistency: Math.round(trackingConsistency),
      incomeExpenseScore: Math.round(incomeExpenseScore),
      trendScore: Math.round(trendScore),
    },
    details: {
      monthlyIncome,
      monthlyExpense,
      monthlySavings,
      totalBudget,
      savingsRate: monthlyIncome > 0 ? ((monthlySavings / monthlyIncome) * 100).toFixed(1) : "0",
      expenseRatio: monthlyIncome > 0 ? ((monthlyExpense / monthlyIncome) * 100).toFixed(1) : "0",
      daysTracked: daysWithExpense,
      daysInMonth,
    },
  };
}

/**
 * Get quick-add templates for common transactions
 */
export function getQuickAddTemplates() {
  return [
    // Expense templates
    { type: "expense", label: "Makan Siang", amount: 50000, categoryHint: "Makanan", icon: "utensils" },
    { type: "expense", label: "Transport", amount: 25000, categoryHint: "Transportasi", icon: "car" },
    { type: "expense", label: "Belanja Bulanan", amount: 500000, categoryHint: "Belanja Rumah", icon: "shopping-cart" },
    { type: "expense", label: "Listrik & Air", amount: 300000, categoryHint: "Listrik & Air", icon: "zap" },
    { type: "expense", label: "Cicilan", amount: 1000000, categoryHint: "Cicilan/Hutang", icon: "credit-card" },
    // Income templates
    { type: "income", label: "Gaji", amount: 5000000, categoryHint: "Gaji", icon: "wallet" },
    { type: "income", label: "Bonus/THR", amount: 2000000, categoryHint: "Bonus", icon: "gift" },
    { type: "income", label: "Freelance", amount: 1000000, categoryHint: "Lainnya (Pemasukan)", icon: "trending-up" },
    // Saving templates
    { type: "saving", label: "Menabung", amount: 500000, direction: "in", categoryHint: "Investasi", icon: "piggy-bank" },
    { type: "saving", label: "Tarik Dana", amount: 200000, direction: "out", categoryHint: "Investasi", icon: "banknote" },
  ];
}