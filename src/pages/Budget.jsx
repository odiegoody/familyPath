import { useMemo, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { db, withSync, withUpdatedAt, softDelete } from "../db/db";
import Header from "../components/Header";
import BudgetRow from "../components/BudgetRow";
import {
  monthKey,
  monthKeyToLabel,
  shiftMonthKey,
  monthKeyRange,
  formatRupiah,
} from "../utils/format";
import { calculateBudgetHealthScore } from "../utils/analytics";

export default function Budget() {
  const [month, setMonth] = useState(monthKey());
  const [healthScore, setHealthScore] = useState(null);
  const { from, to } = monthKeyRange(month);

  const categories = useLiveQuery(
    () =>
      db.categories
        .where("type")
        .equals("expense")
        .and((c) => !c.deleted)
        .toArray(),
    []
  );
  const budgets = useLiveQuery(
    () =>
      db.budgets
        .where("month")
        .equals(month)
        .and((b) => !b.deleted)
        .toArray(),
    [month]
  );
  const transactions = useLiveQuery(
    () =>
      db.transactions
        .where("date")
        .between(from, to, true, true)
        .and((t) => t.type === "expense" && !t.deleted)
        .toArray(),
    [from, to]
  );

  // Calculate health score for current month
  useEffect(() => {
    calculateBudgetHealthScore().then(setHealthScore);
  }, [transactions?.length, budgets?.length, categories?.length]);

  const budgetMap = useMemo(() => {
    const map = {};
    (budgets || []).forEach((b) => (map[b.categoryId] = b));
    return map;
  }, [budgets]);

  const spentMap = useMemo(() => {
    const map = {};
    (transactions || []).forEach((t) => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  const totals = useMemo(() => {
    const totalBudget = (budgets || []).reduce((s, b) => s + b.amount, 0);
    const totalSpent = (transactions || []).reduce((s, t) => s + t.amount, 0);
    return { totalBudget, totalSpent };
  }, [budgets, transactions]);

  async function handleSaveBudget(categoryId, amount) {
    const existing = budgetMap[categoryId];
    if (amount <= 0) {
      if (existing) await softDelete("budgets", existing.id);
      return;
    }
    if (existing) {
      await db.budgets.update(existing.id, withUpdatedAt({ amount }));
    } else {
      await db.budgets.add(withSync({ categoryId, month, amount }));
    }
  }

  const loading = categories === undefined || budgets === undefined || transactions === undefined;
  const overallPct = totals.totalBudget
    ? Math.min(100, Math.round((totals.totalSpent / totals.totalBudget) * 100))
    : 0;
  const overallOver = totals.totalBudget > 0 && totals.totalSpent > totals.totalBudget;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header title="Budget" showBack />
      <main className="mx-auto max-w-md space-y-5 px-4 pt-4">
        {/* Health Score Card */}
        {healthScore && (
          <BudgetHealthScoreCard data={healthScore} />
        )}

        {/* Month switcher */}
        <div className="flex items-center justify-between rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-1.5">
          <button
            onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-display text-sm font-semibold text-on-surface">
            {monthKeyToLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Overall summary — grand total budget semua kategori */}
        {!loading && (
          <div className="rounded-xl bg-primary-container p-4 text-on-primary shadow-modal">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
              Total Budget Bulan Ini (Semua Kategori)
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-display text-2xl font-semibold">
                {formatRupiah(totals.totalSpent)}
              </span>
              <span className="text-sm text-on-primary/60">
                / {formatRupiah(totals.totalBudget)}
              </span>
            </div>
            {totals.totalBudget > 0 ? (
              <>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${overallOver ? "bg-danger" : "bg-tertiary-fixed"}`}
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
                <p className={`mt-1.5 text-xs font-medium ${overallOver ? "text-red-300" : "text-on-primary/60"}`}>
                  {overallOver
                    ? `Melebihi budget sebesar ${formatRupiah(totals.totalSpent - totals.totalBudget)}`
                    : `Sisa ${formatRupiah(totals.totalBudget - totals.totalSpent)} untuk bulan ini`}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-xs font-medium text-on-primary/60">
                Belum ada budget yang diset untuk bulan ini. Atur budget per kategori di bawah.
              </p>
            )}
          </div>
        )}

        {/* Per-category budgets */}
        <section>
          <h2 className="mb-2.5 font-display text-sm font-semibold text-on-surface">
            Budget per Kategori
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container-high" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <BudgetRow
                  key={cat.id}
                  category={cat}
                  spent={spentMap[cat.id] || 0}
                  budget={budgetMap[cat.id]?.amount || 0}
                  onSave={(amount) => handleSaveBudget(cat.id, amount)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* --- Budget Health Score Card --- */
function BudgetHealthScoreCard({ data }) {
  const { score, grade, gradeColor, gradeLabel, breakdown, details } = data;

  const components = [
    { key: "budgetAdherence", label: "Kepatuhan Budget", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { key: "savingsScore", label: "Menabung", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { key: "trackingConsistency", label: "Konsisten Mencatat", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { key: "incomeExpenseScore", label: "Rasio Keluar/Masuk", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { key: "trendScore", label: "Tren Bulanan", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
  ];

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${gradeColor}20`, color: gradeColor }}>
            <span className="font-display text-xl font-bold">{grade}</span>
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-on-surface">Skor Budget: {score}/100</p>
            <p className="text-sm font-medium" style={{ color: gradeColor }}>{gradeLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {components.map(({ key, label, icon }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${gradeColor}15`, color: gradeColor }}>
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-on-surface">{label}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${breakdown[key]}%`, backgroundColor: breakdown[key] >= 70 ? "#2f8f4e" : breakdown[key] >= 50 ? "#e0a72c" : "#c14f3d" }}
                />
              </div>
            </div>
            <span className="shrink-0 font-display font-semibold text-on-surface">{breakdown[key]}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="font-display text-lg font-semibold text-on-surface">{details.savingsRate}%</p>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Tingkat Menabung</p>
        </div>
        <div>
          <p className="font-display text-lg font-semibold" style={{ color: details.expenseRatio > 90 ? "#c14f3d" : "#76777d" }}>{details.expenseRatio}%</p>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Rasio Keluar/Masuk</p>
        </div>
      </div>
    </div>
  );
}
