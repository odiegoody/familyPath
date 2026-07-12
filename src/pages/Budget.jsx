import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import BudgetRow from "../components/BudgetRow";
import {
  monthKey,
  monthKeyToLabel,
  shiftMonthKey,
  monthKeyRange,
  formatRupiah,
} from "../utils/format";

export default function Budget() {
  const [month, setMonth] = useState(monthKey());
  const { from, to } = monthKeyRange(month);

  const categories = useLiveQuery(() => db.categories.where("type").equals("expense").toArray(), []);
  const budgets = useLiveQuery(
    () => db.budgets.where("month").equals(month).toArray(),
    [month]
  );
  const transactions = useLiveQuery(
    () =>
      db.transactions
        .where("date")
        .between(from, to, true, true)
        .and((t) => t.type === "expense")
        .toArray(),
    [from, to]
  );

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
      if (existing) await db.budgets.delete(existing.id);
      return;
    }
    if (existing) {
      await db.budgets.update(existing.id, { amount });
    } else {
      await db.budgets.add({ categoryId, month, amount });
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

        {/* Overall summary */}
        {!loading && totals.totalBudget > 0 && (
          <div className="rounded-xl bg-primary-container p-4 text-on-primary shadow-modal">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
              Total Budget Bulan Ini
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-display text-2xl font-semibold">
                {formatRupiah(totals.totalSpent)}
              </span>
              <span className="text-sm text-on-primary/60">
                / {formatRupiah(totals.totalBudget)}
              </span>
            </div>
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
