import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Trash2, PlusCircle, TrendingUp } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon } from "../utils/icons";
import {
  formatRupiah,
  formatPercent,
  formatDateID,
  parseRupiahInput,
  todayISO,
} from "../utils/format";

export default function InvestmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const investmentId = Number(id);

  const investment = useLiveQuery(() => db.investments.get(investmentId), [investmentId]);
  const contributions = useLiveQuery(
    () =>
      db.investment_contributions
        .where("investmentId")
        .equals(investmentId)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.date - a.date)),
    [investmentId]
  );
  const valueUpdates = useLiveQuery(
    () =>
      db.investment_value_updates
        .where("investmentId")
        .equals(investmentId)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.date - a.date)),
    [investmentId]
  );

  const [mode, setMode] = useState(null); // null | "contribute" | "updateValue"
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  if (!investment || !contributions || !valueUpdates) return null;

  const totalContributed = contributions.reduce((s, c) => s + c.amount, 0);
  const currentValue = valueUpdates.length ? valueUpdates[0].value : totalContributed;
  const gain = currentValue - totalContributed;
  const gainPct = totalContributed ? (gain / totalContributed) * 100 : 0;
  const isPositive = gain >= 0;
  const Icon = getIcon(investment.icon);

  function openMode(m) {
    setMode(m);
    setAmount("");
    setDate(todayISO());
    setNote("");
  }

  async function submitContribution(e) {
    e.preventDefault();
    const amt = parseRupiahInput(amount);
    if (!amt) return;
    await db.investment_contributions.add({
      investmentId,
      amount: amt,
      date: new Date(date).getTime(),
      note: note.trim(),
      createdAt: Date.now(),
    });
    setMode(null);
  }

  async function submitValueUpdate(e) {
    e.preventDefault();
    const val = parseRupiahInput(amount);
    if (!val && val !== 0) return;
    await db.investment_value_updates.add({
      investmentId,
      value: val,
      date: new Date(date).getTime(),
      note: note.trim(),
      createdAt: Date.now(),
    });
    setMode(null);
  }

  async function handleDelete() {
    if (!window.confirm(`Hapus investasi "${investment.name}"? Semua riwayat kontribusi & nilai ikut terhapus.`)) return;
    await db.transaction(
      "rw",
      db.investments,
      db.investment_contributions,
      db.investment_value_updates,
      async () => {
        await db.investment_contributions.where("investmentId").equals(investmentId).delete();
        await db.investment_value_updates.where("investmentId").equals(investmentId).delete();
        await db.investments.delete(investmentId);
      }
    );
    navigate("/investasi");
  }

  // Gabungkan riwayat kontribusi + update nilai, urut tanggal terbaru dulu
  const history = [
    ...contributions.map((c) => ({ ...c, kind: "contribution" })),
    ...valueUpdates.map((v) => ({ ...v, kind: "value" })),
  ].sort((a, b) => b.date - a.date);

  return (
    <div className="pb-10">
      <Header
        title={investment.name}
        showBack
        right={
          <button
            onClick={() => navigate(`/investasi/${investmentId}/edit`)}
            aria-label="Ubah investasi"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface active:bg-surface-container-high"
          >
            <Pencil size={17} />
          </button>
        }
      />

      <div className="space-y-5 px-4 py-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${investment.color}1a`, color: investment.color }}
            >
              <Icon size={20} />
            </span>
            <div>
              <p className="font-display text-2xl font-semibold text-on-surface">
                {formatRupiah(currentValue)}
              </p>
              <p className="text-xs text-on-surface-variant">Nilai sekarang</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-outline-variant pt-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                Modal Disetor
              </p>
              <p className="mt-0.5 font-display text-base font-semibold text-on-surface">
                {formatRupiah(totalContributed)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                Gain / Loss
              </p>
              <p className={`mt-0.5 font-display text-base font-semibold ${isPositive ? "text-success" : "text-danger"}`}>
                {formatRupiah(gain)} ({formatPercent(gainPct)})
              </p>
            </div>
          </div>

          {investment.notes && (
            <p className="mt-3 rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface-variant">
              {investment.notes}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => openMode("contribute")}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-semibold text-on-primary"
          >
            <PlusCircle size={16} />
            Tambah Kontribusi
          </button>
          <button
            onClick={() => openMode("updateValue")}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest py-3 text-sm font-semibold text-on-surface"
          >
            <TrendingUp size={16} />
            Update Nilai
          </button>
        </div>

        {mode && (
          <form
            onSubmit={mode === "contribute" ? submitContribution : submitValueUpdate}
            className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            <p className="text-sm font-semibold text-on-surface">
              {mode === "contribute" ? "Tambah Kontribusi" : "Update Nilai Sekarang"}
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                {mode === "contribute" ? "Jumlah Setoran" : "Nilai Sekarang"}
              </label>
              <input
                autoFocus
                inputMode="numeric"
                value={amount ? formatRupiah(parseRupiahInput(amount), { withSymbol: false }) : ""}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                Tanggal
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                Catatan (opsional)
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan singkat"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="flex-1 rounded-lg border border-outline-variant py-2.5 text-sm font-medium text-on-surface-variant"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-primary"
              >
                Simpan
              </button>
            </div>
          </form>
        )}

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Riwayat
          </h2>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              Belum ada kontribusi atau update nilai.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={`${h.kind}-${h.id}`}
                  className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface">
                      {h.kind === "contribution" ? "Kontribusi" : "Update Nilai"}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {formatDateID(h.date)}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 font-display text-sm font-semibold ${
                      h.kind === "contribution" ? "text-on-surface" : "text-primary"
                    }`}
                  >
                    {h.kind === "contribution" ? "+" : ""}
                    {formatRupiah(h.kind === "contribution" ? h.amount : h.value)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleDelete}
          className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-medium text-danger"
        >
          <Trash2 size={15} />
          Hapus Investasi
        </button>
      </div>
    </div>
  );
}
