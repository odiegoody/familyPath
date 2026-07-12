import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, PiggyBank, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon } from "../utils/icons";
import { formatRupiah, formatDateID } from "../utils/format";

export default function GoalDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const goalId = Number(id);

  const goal = useLiveQuery(() => db.goals.get(goalId), [goalId]);
  const history = useLiveQuery(
    () =>
      db.transactions
        .where("goalId")
        .equals(goalId)
        .and((t) => t.type === "saving")
        .reverse()
        .sortBy("date"),
    [goalId]
  );

  const current = useMemo(() => {
    return (history || []).reduce((s, t) => s + (t.direction === "out" ? -t.amount : t.amount), 0);
  }, [history]);

  if (goal === undefined || history === undefined) {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <Header title="Goal" showBack />
        <div className="mx-auto max-w-md px-4 pt-4">
          <div className="h-40 animate-pulse rounded-xl bg-surface-container-high" />
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <Header title="Goal" showBack />
        <p className="px-4 pt-6 text-center text-sm text-on-surface-variant">Goal tidak ditemukan.</p>
      </div>
    );
  }

  const Icon = getIcon(goal.icon);
  const pct = goal.targetAmount ? Math.min(100, Math.round((current / goal.targetAmount) * 100)) : 0;
  const achieved = current >= goal.targetAmount;

  return (
    <div className="min-h-screen bg-surface pb-28">
      <Header
        title={goal.name}
        showBack
        right={
          <button
            onClick={() => navigate(`/goals/${goalId}/edit`)}
            aria-label="Edit goal"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface active:bg-surface-container-high"
          >
            <Pencil size={17} />
          </button>
        }
      />

      <main className="mx-auto max-w-md space-y-5 px-4 pt-4">
        <div className="rounded-xl bg-primary-container p-5 text-on-primary shadow-modal">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${goal.color}33`, color: "#fff" }}
            >
              <Icon size={20} />
            </span>
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
                Terkumpul
              </p>
              <p className="font-display text-2xl font-semibold">{formatRupiah(current)}</p>
            </div>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: achieved ? "#3aa863" : "#dae2fd" }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-on-primary/60">
            <span>{pct}% dari {formatRupiah(goal.targetAmount)}</span>
            {goal.targetDate && <span>Target {formatDateID(goal.targetDate)}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate(`/tambah?type=saving&goal=${goalId}&dir=in`)}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary"
          >
            <PiggyBank size={16} /> Setor
          </button>
          <button
            onClick={() => navigate(`/tambah?type=saving&goal=${goalId}&dir=out`)}
            className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant py-3 text-sm font-semibold text-on-surface"
          >
            Tarik Dana
          </button>
        </div>

        <section>
          <h2 className="mb-2.5 font-display text-sm font-semibold text-on-surface">Riwayat</h2>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              Belum ada setoran. Ketuk "Setor" untuk mulai menabung ke goal ini.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-outline-variant shadow-card">
              {history
                .slice()
                .reverse()
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 border-b border-outline-variant/60 bg-surface-container-lowest px-4 py-3 last:border-b-0"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        t.direction === "out" ? "bg-danger-container text-danger" : "bg-success-container text-success"
                      }`}
                    >
                      {t.direction === "out" ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {t.description || (t.direction === "out" ? "Tarik dana" : "Setor")}
                      </p>
                      <p className="text-xs text-on-surface-variant">{formatDateID(t.date)}</p>
                    </div>
                    <span
                      className={`shrink-0 font-display text-sm font-semibold tabular-nums ${
                        t.direction === "out" ? "text-danger" : "text-success"
                      }`}
                    >
                      {t.direction === "out" ? "-" : "+"}
                      {formatRupiah(t.amount)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
