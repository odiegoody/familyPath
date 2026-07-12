import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import Header from "../components/Header";
import BalanceCard from "../components/BalanceCard";
import CategoryBreakdown from "../components/CategoryBreakdown";
import TransactionRow from "../components/TransactionRow";
import { startOfMonth, endOfMonth, formatMonthYearID } from "../utils/format";
import { ChevronRight } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);
  const monthLabel = formatMonthYearID(now);

  const transactions = useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const members = useLiveQuery(() => db.members.toArray(), []);
  const goals = useLiveQuery(() => db.goals.toArray(), []);

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
    // Saldo Keluarga = income - expense - setor ke goal + tarik dari goal
    // Menabung ke goal memindahkan uang cash ke "pot" goal, jadi ikut mengurangi saldo.
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

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header title="FamilyPath" />
      <main className="mx-auto max-w-md space-y-6 px-4 pt-4">
        {loading ? (
          <div className="h-44 animate-pulse rounded-xl bg-surface-container-high" />
        ) : (
          <BalanceCard balance={balance} income={income} expense={expense} monthLabel={monthLabel} />
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
    </div>
  );
}
