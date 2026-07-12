import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import AssetCard from "../components/AssetCard";
import { ASSET_CATEGORIES } from "../utils/icons";
import { formatRupiah, formatPercent } from "../utils/format";

export default function Assets() {
  const navigate = useNavigate();
  const assets = useLiveQuery(() => db.assets.toArray(), []);
  const updates = useLiveQuery(() => db.asset_value_updates.toArray(), []);

  const currentValueByAsset = useMemo(() => {
    const map = {};
    (assets || []).forEach((a) => {
      const assetUpdates = (updates || [])
        .filter((u) => u.assetId === a.id)
        .sort((x, y) => y.date - x.date);
      map[a.id] = assetUpdates.length ? assetUpdates[0].value : a.initialValue;
    });
    return map;
  }, [assets, updates]);

  const lastUpdateByAsset = useMemo(() => {
    const map = {};
    (assets || []).forEach((a) => {
      const assetUpdates = (updates || [])
        .filter((u) => u.assetId === a.id)
        .sort((x, y) => y.date - x.date);
      map[a.id] = assetUpdates.length ? assetUpdates[0].date : a.purchaseDate;
    });
    return map;
  }, [assets, updates]);

  const totals = useMemo(() => {
    const totalValue = (assets || []).reduce((s, a) => s + (currentValueByAsset[a.id] || 0), 0);
    const totalInitial = (assets || []).reduce((s, a) => s + a.initialValue, 0);
    const gain = totalValue - totalInitial;
    const gainPct = totalInitial ? (gain / totalInitial) * 100 : 0;
    return { totalValue, gain, gainPct };
  }, [assets, currentValueByAsset]);

  const byCategory = useMemo(() => {
    const groups = {};
    (assets || []).forEach((a) => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    return groups;
  }, [assets]);

  const loading = assets === undefined || updates === undefined;
  const isPositive = totals.gain >= 0;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header
        title="Aset & Investasi"
        showBack
        right={
          <button
            onClick={() => navigate("/aset/baru")}
            aria-label="Tambah aset"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Plus size={18} />
          </button>
        }
      />
      <main className="mx-auto max-w-md space-y-5 px-4 pt-4">
        {!loading && assets.length > 0 && (
          <div className="rounded-xl bg-primary-container p-5 text-on-primary shadow-modal">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
              Total Nilai Aset
            </p>
            <p className="mt-1 font-display text-[30px] font-semibold leading-tight">
              {formatRupiah(totals.totalValue)}
            </p>
            <div
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isPositive ? "bg-success/20 text-tertiary-fixed" : "bg-danger/25 text-red-200"
              }`}
            >
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {formatRupiah(Math.abs(totals.gain))} ({formatPercent(totals.gainPct)})
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container-high" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center">
            <p className="text-sm text-on-surface-variant">
              Belum ada aset tercatat. Tambahkan tabungan, saham, properti, atau aset lain milik keluarga.
            </p>
            <button
              onClick={() => navigate("/aset/baru")}
              className="mt-3 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              Tambah Aset
            </button>
          </div>
        ) : (
          ASSET_CATEGORIES.filter((c) => byCategory[c.key]?.length).map((cat) => (
            <section key={cat.key}>
              <h2 className="mb-2.5 font-display text-sm font-semibold text-on-surface">{cat.label}</h2>
              <div className="space-y-3">
                {byCategory[cat.key].map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    currentValue={currentValueByAsset[a.id] || 0}
                    lastUpdateDate={lastUpdateByAsset[a.id]}
                    onClick={() => navigate(`/aset/${a.id}`)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
