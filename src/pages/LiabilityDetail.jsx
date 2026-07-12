import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Check, X, CreditCard } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon } from "../utils/icons";
import { formatRupiah, formatDateID, parseRupiahInput, todayISO } from "../utils/format";

export default function LiabilityDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const liabilityId = Number(id);

  const liability = useLiveQuery(() => db.liabilities.get(liabilityId), [liabilityId]);
  const payments = useLiveQuery(
    () => db.liability_payments.where("liabilityId").equals(liabilityId).toArray(),
    [liabilityId]
  );

  const [showForm, setShowForm] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [savingPay, setSavingPay] = useState(false);

  const sortedPayments = useMemo(
    () => (payments || []).slice().sort((a, b) => b.date - a.date),
    [payments]
  );
  const totalPaid = useMemo(
    () => (payments || []).reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const balance = (liability?.principalAmount || 0) - totalPaid;

  async function handleAddPayment() {
    const amount = parseRupiahInput(amountStr);
    if (amount <= 0) return;
    setSavingPay(true);
    try {
      await db.liability_payments.add({
        liabilityId,
        amount,
        date: new Date(payDate).getTime(),
        note: "",
        createdAt: Date.now(),
      });
      setShowForm(false);
      setAmountStr("");
      setPayDate(todayISO());
    } finally {
      setSavingPay(false);
    }
  }

  if (liability === undefined || payments === undefined) {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <Header title="Hutang" showBack />
        <div className="mx-auto max-w-md px-4 pt-4">
          <div className="h-40 animate-pulse rounded-xl bg-surface-container-high" />
        </div>
      </div>
    );
  }

  if (!liability) {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <Header title="Hutang" showBack />
        <p className="px-4 pt-6 text-center text-sm text-on-surface-variant">Data tidak ditemukan.</p>
      </div>
    );
  }

  const Icon = getIcon(liability.icon);
  const pct = liability.principalAmount
    ? Math.min(100, Math.max(0, Math.round((totalPaid / liability.principalAmount) * 100)))
    : 0;
  const payoff = balance <= 0;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header
        title={liability.name}
        showBack
        right={
          <button
            onClick={() => navigate(`/hutang/${liabilityId}/edit`)}
            aria-label="Edit hutang"
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
              style={{ backgroundColor: `${liability.color}33` }}
            >
              <Icon size={20} />
            </span>
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
                Sisa Hutang
              </p>
              <p className="font-display text-2xl font-semibold">
                {formatRupiah(Math.max(0, balance))}
              </p>
            </div>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: payoff ? "#3aa863" : "#dae2fd" }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-on-primary/60">
            <span>{pct}% terbayar dari {formatRupiah(liability.principalAmount)}</span>
            {liability.dueDate && <span>Jatuh tempo {formatDateID(liability.dueDate)}</span>}
          </div>
          {balance < 0 && (
            <p className="mt-2 text-xs text-tertiary-fixed">
              Lebih bayar {formatRupiah(Math.abs(balance))}
            </p>
          )}
        </div>

        {liability.interestRate != null && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
              Bunga
            </p>
            <p className="mt-0.5 font-display text-sm font-semibold text-on-surface">
              {liability.interestRate}% / tahun
            </p>
          </div>
        )}

        {liability.notes && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Catatan</p>
            <p className="mt-1 text-sm text-on-surface">{liability.notes}</p>
          </div>
        )}

        {showForm ? (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
            <p className="mb-3 text-sm font-semibold text-on-surface">Catat Pembayaran</p>
            <div className="space-y-3">
              <div className="flex items-center rounded-lg border border-outline-variant bg-surface px-3 py-2.5">
                <span className="mr-2 font-display text-lg font-semibold text-on-surface-variant">Rp</span>
                <input
                  autoFocus
                  inputMode="numeric"
                  placeholder="0"
                  value={amountStr ? formatRupiah(parseRupiahInput(amountStr), { withSymbol: false }) : ""}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full bg-transparent font-display text-lg font-semibold text-on-surface outline-none"
                />
              </div>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddPayment}
                  disabled={savingPay || parseRupiahInput(amountStr) <= 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-primary disabled:opacity-40"
                >
                  <Check size={15} /> Simpan
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant py-2.5 text-sm font-semibold text-on-surface"
                >
                  <X size={15} /> Batal
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary"
          >
            <CreditCard size={16} /> Catat Pembayaran
          </button>
        )}

        <section>
          <h2 className="mb-2.5 font-display text-sm font-semibold text-on-surface">Riwayat Pembayaran</h2>
          {sortedPayments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              Belum ada pembayaran tercatat.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-outline-variant shadow-card">
              {sortedPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-outline-variant/60 bg-surface-container-lowest px-4 py-3 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-on-surface">Pembayaran</p>
                    <p className="text-xs text-on-surface-variant">{formatDateID(p.date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-success">
                    -{formatRupiah(p.amount)}
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
