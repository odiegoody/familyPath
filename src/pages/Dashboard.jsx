import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import Header from "../components/Header";
import BalanceCard from "../components/BalanceCard";
import CategoryBreakdown from "../components/CategoryBreakdown";
import TransactionRow from "../components/TransactionRow";
import QuickAddKeypad from "../components/QuickAddKeypad";
import { startOfMonth, endOfMonth, formatMonthYearID, formatRupiah } from "../utils/format";
import { ChevronRight, TrendingUp, AlertCircle, CheckCircle, Target, Plus, Zap } from "lucide-react";
import { calculateDailySafeSpend, calculateBudgetHealthScore } from "../utils/analytics";

export default function Dashboard() {
  const navigate = useNavigate();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);
  const monthLabel = formatMonthYearID(now);

  const transactions = useLiveQuery(
    () => db.transactions.orderBy("date").reverse().filter((t) => !t.deleted).toArray(),
    []
  );
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);
  const members = useLiveQuery(() => db.members.filter((m) => !m.deleted).toArray(), []);
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.deleted).toArray(), []);

  // Safe spend & health score (computed async)
  const [safeSpend, setSafeSpend] = useState(null);
  const [healthScore, setHealthScore] = useState(null);

  useEffect(() => {
    calculateDailySafeSpend({ useCategoryFilter: true, categories }).then(setSafeSpend);
    calculateBudgetHealthScore().then(setHealthScore);
  }, [transactions?.length, categories?.length]);

  const categoryMap = useMemo(() => {
    const map = {};
    (categories || []).forEach((c) => (map[c.id] = c));
    return map;
  }, [categories]);

  const memberMap = useMemo(() => {
    const map = {};
    (members || []).forEach((m) => (map[m.id] = m));
    return map;
  }, [members]);

  const goalMap = useMemo(() => {
    const map = {};
    (goals || []).forEach((g) => (map[g.id] = g));
    return map;
  }, [goals]);

  const monthTx = useMemo(
    () => (transactions || []).filter((t) => t.date >= from && t.date <= to),
    [transactions, from, to]
  );

  const income = useMemo(
    () => monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [monthTx]
  );
  const expense = useMemo(
    () => monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [monthTx]
  );

  const balance = useMemo(() => {
    return (transactions || []).reduce((s, t) => {
      if (t.type === "income") return s + t.amount;
      if (t.type === "expense") return s - t.amount;
      if (t.type === "saving") return s + (t.direction === "out" ? t.amount : -t.amount);
      return s;
    }, 0);
  }, [transactions]);

  const breakdown = useMemo(() => {
    const totals = {};
    monthTx
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
      });
    return Object.entries(totals)
      .map(([categoryId, total]) => {
        const cat = categoryMap[categoryId];
        return {
          categoryId,
          total,
          name: cat?.name || "Lainnya",
          icon: cat?.icon,
          color: cat?.color || "#76777d",
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [monthTx, categoryMap]);

  const recent = (transactions || []).slice(0, 5);

  const loading = transactions === undefined;
  const defaultMemberId = members?.[0]?.id || null;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header
        title="FamilyPath"
        right={
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary shadow-card active:bg-primary/80"
            aria-label="Transaksi cepat"
          >
            <Zap size={20} />
          </button>
        }
      />
      <main className="mx-auto max-w-md space-y-6 px-4 pt-4">
        {loading ? (
          <div className="h-44 animate-pulse rounded-xl bg-surface-container-high" />
        ) : (
          <BalanceCard balance={balance} income={income} expense={expense} monthLabel={monthLabel} />
        )}

        {/* Daily Safe Spend Limit */}
        {safeSpend && (
          <SafeSpendCard data={safeSpend} />
        )}

        {/* Budget Health Score */}
        {healthScore && (
          <HealthScoreCard data={healthScore} />
        )}

        <section>
          <h2 className="mb-2.5 font-display text-sm font-semibold text-on-surface">
            Pengeluaran per Kategori · {monthLabel}
          </h2>
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-surface-container-high" />
          ) : (
            <CategoryBreakdown items={breakdown} />
          )}
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-on-surface">Transaksi Terbaru</h2>
            <button
              onClick={() => navigate("/transaksi")}
              className="flex items-center text-xs font-medium text-secondary"
            >
              Lihat Semua <ChevronRight size={14} />
            </button>
          </div>
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-surface-container-high" />
          ) : recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              Belum ada transaksi. Ketuk tombol + untuk mulai mencatat.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-outline-variant shadow-card">
              {recent.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  category={categoryMap[tx.categoryId]}
                  member={memberMap[tx.memberId]}
                  goal={goalMap[tx.goalId]}
                  onClick={() => navigate(`/tambah?edit=${tx.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Quick Add Keypad Modal */}
      <QuickAddKeypad
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onAddTransaction={async (tx) => {
          const { withSync } = await import("../db/db");
          await db.transactions.add(withSync({ ...tx, createdAt: Date.now() }));
        }}
        categories={categories}
        members={members}
        goals={goals}
        defaultMemberId={defaultMemberId}
      />
    </div>
  );
}

/* --- Safe Spend Card --- */
function SafeSpendCard({ data }) {
  const { dailySafeSpend, simpleDailyLimit, daysRemaining, monthlyIncome, spentThisMonth, wantsBudget, remainingForWants } = data;
  const displayLimit = dailySafeSpend > 0 ? dailySafeSpend : simpleDailyLimit;
  const isHealthy = displayLimit > 0;
  const color = isHealthy ? "#2f8f4e" : "#c14f3d";

  return (
    <section>
      <div className="rounded-xl bg-primary-container p-4 shadow-modal">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Target size={18} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-on-primary">Limit Harian Aman</p>
              <p className="text-xs text-on-primary/70">Berdasarkan aturan 50/30/20 • {daysRemaining} hari tersisa</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold tabular-nums" style={{ color }}>
              {displayLimit > 0 ? formatRupiah(Math.round(displayLimit)) : "—"}
            </p>
            <p className="text-xs text-on-primary/70">/ hari</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-surface p-3">
            <p className="font-display text-lg font-semibold text-on-surface">{formatRupiah(monthlyIncome)}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Pemasukan</p>
          </div>
          <div className="rounded-lg bg-surface p-3">
            <p className="font-display text-lg font-semibold text-on-surface">{formatRupiah(spentThisMonth)}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Terpakai</p>
          </div>
          <div className="rounded-lg bg-surface p-3">
            <p className="font-display text-lg font-semibold" style={{ color }}>
              {formatRupiah(Math.max(0, monthlyIncome - spentThisMonth))}
            </p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Sisa</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-surface p-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-on-surface-variant">Budget Kebutuhan (50%)</span>
            <span className="font-medium text-on-surface">{formatRupiah(Math.round(wantsBudget))} tersisa untuk keinginan</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.max(0, (remainingForWants / wantsBudget) * 100))}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- Health Score Card --- */
function HealthScoreCard({ data }) {
  const { score, grade, gradeColor, gradeLabel, breakdown, details } = data;

  const getIcon = (component) => {
    const icons = {
      budgetAdherence: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      savingsScore: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      trackingConsistency: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      incomeExpenseScore: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      trendScore: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    };
    return icons[component] || icons.budgetAdherence;
  };

  const components = [
    { key: "budgetAdherence", label: "Budget", weight: "25%" },
    { key: "savingsScore", label: "Menabung", weight: "25%" },
    { key: "trackingConsistency", label: "Konsisten", weight: "20%" },
    { key: "incomeExpenseScore", label: "Rasio", weight: "15%" },
    { key: "trendScore", label: "Tren", weight: "15%" },
  ];

  return (
    <section>
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl" style={{ backgroundColor: `${gradeColor}20`, color: gradeColor }}>
              <span className="font-display text-2xl font-bold">{grade}</span>
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-on-surface">Skor Kesehatan: {score}/100</p>
              <p className="text-sm font-medium" style={{ color: gradeColor }}>{gradeLabel}</p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-xs text-on-surface-variant">Detail</span>
            <ChevronRight size={16} strokeWidth={2} />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {components.map(({ key, label, weight }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${gradeColor}15`, color: gradeColor }}>
                {getIcon(key)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-on-surface">{label}</span>
                  <span className="text-on-surface-variant">{weight}</span>
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
            <p className="font-display text-lg font-semibold text-on-surface">{formatRupiah(details.monthlyIncome)}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Pemasukan</p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-on-surface">{formatRupiah(details.monthlyExpense)}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Pengeluaran</p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold" style={{ color: "#2f8f4e" }}>{details.savingsRate}%</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Tingkat Menabung</p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold" style={{ color: details.expenseRatio > 90 ? "#c14f3d" : "#76777d" }}>{details.expenseRatio}%</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Rasio Keluar/Masuk</p>
          </div>
        </div>
      </div>
    </section>
  );
}
