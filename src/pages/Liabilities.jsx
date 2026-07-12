import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import LiabilityCard from "../components/LiabilityCard";
import { formatRupiah } from "../utils/format";

export default function Liabilities() {
  const navigate = useNavigate();
  const liabilities = useLiveQuery(() => db.liabilities.toArray(), []);
  const payments = useLiveQuery(() => db.liability_payments.toArray(), []);

  const balanceByLiability = useMemo(() => {
    const map = {};
    (liabilities || []).forEach((l) => {
      const paid = (payments || [])
        .filter((p) => p.liabilityId === l.id)
        .reduce((s, p) => s + p.amount, 0);
      map[l.id] = l.principalAmount - paid;
    });
    return map;
  }, [liabilities, payments]);

  const totalDebt = useMemo(
    () => Object.values(balanceByLiability).reduce((s, v) => s + Math.max(0, v), 0),
    [balanceByLiability]
  );

  const loading = liabilities === undefined || payments === undefined;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header
        title="Hutang"
        showBack
        right={
          <button
            onClick={() => navigate("/hutang/baru")}
            aria-label="Tambah hutang"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Plus size={18} />
          </button>
        }
      />
      <main className="mx-auto max-w-md space-y-5 px-4 pt-4">
        {!loading && liabilities.length > 0 && (
          <div className="rounded-xl bg-primary-container p-5 text-on-primary shadow-modal">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
              Total Sisa Hutang
            </p>
            <p className="mt-1 font-display text-[30px] font-semibold leading-tight">
              {formatRupiah(totalDebt)}
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-container-high" />
            ))}
          </div>
        ) : liabilities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center">
            <p className="text-sm text-on-surface-variant">
              Belum ada hutang tercatat. Tambahkan cicilan, KPR, atau pinjaman lain di sini.
            </p>
            <button
              onClick={() => navigate("/hutang/baru")}
              className="mt-3 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              Tambah Hutang
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {liabilities.map((l) => (
              <LiabilityCard
                key={l.id}
                liability={l}
                balance={balanceByLiability[l.id] || 0}
                onClick={() => navigate(`/hutang/${l.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
