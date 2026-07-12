import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import GoalCard from "../components/GoalCard";
import { formatRupiah } from "../utils/format";

export default function Goals() {
  const navigate = useNavigate();
  const goals = useLiveQuery(() => db.goals.toArray(), []);
  const savingTx = useLiveQuery(
    () => db.transactions.where("type").equals("saving").toArray(),
    []
  );

  const currentByGoal = useMemo(() => {
    const map = {};
    (savingTx || []).forEach((t) => {
      const delta = t.direction === "out" ? -t.amount : t.amount;
      map[t.goalId] = (map[t.goalId] || 0) + delta;
    });
    return map;
  }, [savingTx]);

  const totalSaved = useMemo(
    () => Object.values(currentByGoal).reduce((s, v) => s + v, 0),
    [currentByGoal]
  );

  const loading = goals === undefined || savingTx === undefined;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header
        title="Goal Tracker"
        showBack
        right={
          <button
            onClick={() => navigate("/goals/baru")}
            aria-label="Tambah goal"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Plus size={18} />
          </button>
        }
      />
      <main className="mx-auto max-w-md space-y-5 px-4 pt-4">
        {!loading && goals.length > 0 && (
          <div className="rounded-xl bg-primary-container p-4 text-on-primary shadow-modal">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
              Total Tersimpan di Semua Goal
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">{formatRupiah(totalSaved)}</p>
            <p className="mt-1 text-xs text-on-primary/60">
              Dana yang sudah disetor ke goal sudah dikurangi dari Saldo Keluarga di Dashboard.
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-container-high" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center">
            <p className="text-sm text-on-surface-variant">
              Belum ada goal. Buat target tabungan pertamamu, misalnya Dana Darurat atau DP Rumah.
            </p>
            <button
              onClick={() => navigate("/goals/baru")}
              className="mt-3 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              Buat Goal Baru
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                current={currentByGoal[g.id] || 0}
                onClick={() => navigate(`/goals/${g.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
