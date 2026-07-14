import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Trash2, PlusCircle, TrendingUp } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon, INVESTMENT_UNIT_CONFIG } from "../utils/icons";
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
  const [editingItem, setEditingItem] = useState(null); // null | { kind, id }
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  if (!investment || !contributions || !valueUpdates) return null;

  const unitConfig = INVESTMENT_UNIT_CONFIG[investment.category] || null;
  const totalQuantity = contributions.reduce((s, c) => s + (Number(c.quantity) || 0), 0);
  const quantityUnitLabel = (() => {
    const withQty = contributions.find((c) => c.quantity && c.unit);
    if (withQty) {
      const opt = unitConfig?.unitOptions.find((o) => o.key === withQty.unit);
      return opt ? opt.label : withQty.unit;
    }
    return unitConfig?.unitOptions.find((o) => o.key === unitConfig.defaultUnit)?.label || "";
  })();

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
    setQuantity("");
    setUnit(unitConfig ? unitConfig.defaultUnit : "");
    setEditingItem(null);
  }

  function openEditItem(h) {
    setMode(h.kind === "contribution" ? "contribute" : "updateValue");
    setAmount(String(h.kind === "contribution" ? h.amount : h.value));
    setDate(new Date(h.date).toISOString().slice(0, 10));
    setNote(h.note || "");
    setQuantity(h.quantity ? String(h.quantity) : "");
    setUnit(h.unit || (unitConfig ? unitConfig.defaultUnit : ""));
    setEditingItem({ kind: h.kind, id: h.id });
  }

  function closeForm() {
    setMode(null);
    setEditingItem(null);
    setQuantity("");
    setUnit("");
  }

  async function submitContribution(e) {
    e.preventDefault();
    const amt = parseRupiahInput(amount);
    if (!amt) return;
    const qty = quantity ? Number(quantity) : null;
    const payload = {
      investmentId,
      amount: amt,
      date: new Date(date).getTime(),
      note: note.trim(),
      ...(unitConfig && qty ? { quantity: qty, unit } : {}),
    };
    if (editingItem && editingItem.kind === "contribution") {
      await db.investment_contributions.update(editingItem.id, payload);
    } else {
      await db.investment_contributions.add({ ...payload, createdAt: Date.now() });
    }
    closeForm();
  }

  async function submitValueUpdate(e) {
    e.preventDefault();
    const val = parseRupiahInput(amount);
    if (!val && val !== 0) return;
    const payload = {
      investmentId,
      value: val,
      date: new Date(date).getTime(),
      note: note.trim(),
    };
    if (editingItem && editingItem.kind === "value") {
      await db.investment_value_updates.update(editingItem.id, payload);
    } else {
      await db.investment_value_updates.add({ ...payload, createdAt: Date.now() });
    }
    closeForm();
  }

  async function deleteHistoryItem(h) {
    const label = h.kind === "contribution" ? "kontribusi" : "update nilai";
    if (!window.confirm(`Hapus riwayat ${label} ini?`)) return;
    if (h.kind === "contribution") {
      await db.investment_contributions.delete(h.id);
    } else {
      await db.investment_value_updates.delete(h.id);
    }
    if (editingItem && editingItem.kind === h.kind && editingItem.id === h.id) {
      closeForm();
    }
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

          {unitConfig && totalQuantity > 0 && (
            <p className="mt-3 rounded-lg bg-secondary-container px-3 py-2 text-xs text-on-secondary-container">
              Total dimiliki: <span className="font-semibold">{totalQuantity} {quantityUnitLabel}</span>
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
              {editingItem
                ? mode === "contribute"
                  ? "Edit Kontribusi"
                  : "Edit Update Nilai"
                : mode === "contribute"
                ? "Tambah Kontribusi"
                : "Update Nilai Sekarang"}
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

            {mode === "contribute" && unitConfig && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                    {unitConfig.label} (opsional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                    Satuan
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    {unitConfig.unitOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
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
                onClick={closeForm}
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
                  className="flex items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-on-surface">
                      {h.kind === "contribution" ? "Kontribusi" : "Update Nilai"}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {formatDateID(h.date)}
                      {h.kind === "contribution" && h.quantity ? ` · ${h.quantity} ${
                        unitConfig?.unitOptions.find((o) => o.key === h.unit)?.label || h.unit || ""
                      }` : ""}
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
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => openEditItem(h)}
                      aria-label="Edit riwayat"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteHistoryItem(h)}
                      aria-label="Hapus riwayat"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-danger active:bg-danger-container"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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
