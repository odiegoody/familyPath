import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, TrendingUp, Target } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import InvestmentCard from "../components/InvestmentCard";
import { INVESTMENT_CATEGORIES } from "../utils/icons";
import { formatRupiah, formatPercent } from "../utils/format";

export default function Investments() {
  const navigate = useNavigate();

  const investments = useLiveQuery(() => db.investments.orderBy("createdAt").reverse().toArray(), []);
  const contributions = useLiveQuery(() => db.investment_contributions.toArray(), []);
  const valueUpdates = useLiveQuery(() => db.investment_value_updates.toArray(), []);

  if (!investments || !contributions || !valueUpdates) return null;

  const contribMap = {};
  for (const c of contributions) {
    contribMap[c.investmentId] = (contribMap[c.investmentId] || 0) + c.amount;
  }
  const latestValueMap = {};
  for (const v of valueUpdates) {
    const prev = latestValueMap[v.investmentId];
    if (!prev || v.date > prev.date) latestValueMap[v.investmentId] = v;
  }

  const getTotalContributed = (id) => contribMap[id] || 0;
  const getCurrentValue = (id) => (latestValueMap[id] ? latestValueMap[id].value : getTotalContributed(id));

  const totalContributed = investments.reduce((s, i) => s + getTotalContributed(i.id), 0);
  const totalValue = investments.reduce((s, i) => s + getCurrentValue(i.id), 0);
  const totalGain = totalValue - totalContributed;
  const totalGainPct = totalContributed ? (totalGain / totalContributed) * 100 : 0;

  const grouped = INVESTMENT_CATEGORIES.map((cat) => ({
    ...cat,
    items: investments.filter((i) => i.category === cat.key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="pb-24">
      <Header
        title="Investasi"
        showBack
        right={
          <button
            onClick={() => navigate("/investasi/baru")}
            aria-label="Tambah investasi"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Plus size={18} />
          </button>
        }
      />

      <div className="space-y-5 px-4 py-4">
        <div className="rounded-xl bg-primary-container p-5 text-on-primary shadow-modal">
          <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
            Total Nilai Investasi
          </p>
          <p className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-tight">
            {formatRupiah(totalValue)}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
            <span className="text-on-primary/60">Modal disetor {formatRupiah(totalContributed)}</span>
            <span className={totalGain >= 0 ? "font-semibold text-tertiary-fixed" : "font-semibold text-red-300"}>
              {formatRupiah(totalGain)} ({formatPercent(totalGainPct)})
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate("/investasi/target")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest py-3 text-sm font-semibold text-on-surface"
        >
          <Target size={16} />
          Target Investasi
        </button>

        {investments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
            <TrendingUp size={28} className="mx-auto mb-2 text-on-surface-variant" />
            <p className="text-sm text-on-surface-variant">
              Belum ada investasi. Tambah investasi pertamamu — saham, reksadana, deposito, atau kripto.
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.key}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.items.map((inv) => (
                  <InvestmentCard
                    key={inv.id}
                    investment={inv}
                    totalContributed={getTotalContributed(inv.id)}
                    currentValue={getCurrentValue(inv.id)}
                    onClick={() => navigate(`/investasi/${inv.id}`)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
