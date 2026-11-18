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