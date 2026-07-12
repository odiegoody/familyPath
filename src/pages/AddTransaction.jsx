import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2, PiggyBank } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon } from "../utils/icons";
import { formatRupiah, parseRupiahInput, todayISO } from "../utils/format";

export default function AddTransaction() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("edit") ? Number(params.get("edit")) : null;
  const initialType = params.get("type"); // "saving" when coming from GoalDetail
  const initialGoalId = params.get("goal") ? Number(params.get("goal")) : null;
  const initialDirection = params.get("dir") || "in";

  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const members = useLiveQuery(() => db.members.toArray(), []);
  const goals = useLiveQuery(() => db.goals.toArray(), []);
  const existing = useLiveQuery(
    () => (editId ? db.transactions.get(editId) : undefined),
    [editId]
  );

  const [type, setType] = useState(initialType === "saving" ? "saving" : "expense");
  const [amountStr, setAmountStr] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [goalId, setGoalId] = useState(initialGoalId);
  const [direction, setDirection] = useState(initialDirection);
  const [memberId, setMemberId] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setType(existing.type);
      setAmountStr(String(existing.amount));
      setCategoryId(existing.categoryId || null);
      setGoalId(existing.goalId || null);
      setDirection(existing.direction || "in");
      setMemberId(existing.memberId);
      setDate(new Date(existing.date).toISOString().slice(0, 10));
      setDescription(existing.description || "");
      setNotes(existing.notes || "");
    }
  }, [existing]);

  useEffect(() => {
    // default member = first member once loaded, if not editing
    if (!editId && members && members.length && memberId === null) {
      setMemberId(members[0].id);
    }
  }, [members, editId, memberId]);

  useEffect(() => {
    // default goal = first goal once loaded, if type is saving and none selected
    if (type === "saving" && !goalId && goals && goals.length) {
      setGoalId(goals[0].id);
    }
  }, [type, goals, goalId]);

  const filteredCategories = useMemo(
    () => (categories || []).filter((c) => c.type === type),
    [categories, type]
  );

  useEffect(() => {
    // reset category selection when type changes if current cat doesn't match
    if (categoryId && categories) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat && cat.type !== type) setCategoryId(null);
    }
  }, [type, categoryId, categories]);

  const amount = parseRupiahInput(amountStr);
  const canSave =
    amount > 0 && memberId && (type === "saving" ? goalId : categoryId);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const payload = {
      type,
      amount,
      categoryId: type === "saving" ? null : categoryId,
      goalId: type === "saving" ? goalId : null,
      direction: type === "saving" ? direction : null,
      memberId,
      date: new Date(date).getTime(),
      description: description.trim(),
      notes: notes.trim(),
    };
    try {
      if (editId) {
        await db.transactions.update(editId, payload);
      } else {
        await db.transactions.add({ ...payload, createdAt: Date.now() });
      }
      navigate(-1);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    if (!confirm("Hapus transaksi ini?")) return;
    await db.transactions.delete(editId);
    navigate(-1);
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <Header
        title={editId ? "Edit Transaksi" : "Transaksi Baru"}
        showBack
        right={
          editId ? (
            <button
              onClick={handleDelete}
              aria-label="Hapus"
              className="flex h-9 w-9 items-center justify-center rounded-full text-danger active:bg-danger-container"
            >
              <Trash2 size={19} />
            </button>
          ) : null
        }
      />

      <main className="mx-auto max-w-md space-y-6 px-4 pt-5">
        {/* Type toggle */}
        <div className="grid grid-cols-3 gap-1.5 rounded-full bg-surface-container-high p-1">
          {[
            { key: "expense", label: "Pengeluaran" },
            { key: "income", label: "Pemasukan" },
            { key: "saving", label: "Tabungan" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`rounded-full py-2 text-xs font-semibold transition-colors sm:text-sm ${
                type === t.key
                  ? "bg-primary text-on-primary shadow-card"
                  : "text-on-surface-variant"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {type === "saving" && (
          <p className="-mt-2 flex items-start gap-2 rounded-lg bg-secondary-container px-3 py-2.5 text-xs text-on-secondary-container">
            <PiggyBank size={15} className="mt-0.5 shrink-0" />
            {direction === "out"
              ? "Menarik dana dari goal akan menambah Saldo Keluarga lagi."
              : "Menabung ke goal akan mengurangi Saldo Keluarga — uangnya pindah ke pot goal ini."}
          </p>
        )}

        {/* Amount */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Jumlah
          </label>
          <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <span className="mr-2 font-display text-2xl font-semibold text-on-surface-variant">
              Rp
            </span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={amountStr ? formatRupiah(parseRupiahInput(amountStr), { withSymbol: false }) : ""}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full bg-transparent font-display text-2xl font-semibold text-on-surface outline-none placeholder:text-on-surface-variant/40"
            />
          </div>
        </div>

        {type === "saving" ? (
          <>
            {/* Direction: setor / tarik */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Jenis
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "in", label: "Setor" },
                  { key: "out", label: "Tarik Dana" },
                ].map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDirection(d.key)}
                    className={`rounded-lg border py-2.5 text-sm font-semibold ${
                      direction === d.key
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant text-on-surface"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal picker */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Goal
              </label>
              {goals && goals.length > 0 ? (
                <select
                  value={goalId ?? ""}
                  onChange={(e) => setGoalId(Number(e.target.value))}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary"
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => navigate("/goals/baru")}
                  className="w-full rounded-lg border border-dashed border-outline-variant py-3 text-sm font-medium text-secondary"
                >
                  Belum ada goal — buat dulu
                </button>
              )}
            </div>
          </>
        ) : (
          /* Category */
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Kategori
            </label>
            <div className="grid grid-cols-3 gap-2">
              {filteredCategories.map((cat) => {
                const Icon = getIcon(cat.icon);
                const active = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center ${
                      active
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant bg-surface-container-lowest text-on-surface"
                    }`}
                  >
                    <Icon size={18} style={{ color: active ? undefined : cat.color }} />
                    <span className="text-[11px] font-medium leading-tight">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Member + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Dicatat oleh
            </label>
            <select
              value={memberId ?? ""}
              onChange={(e) => setMemberId(Number(e.target.value))}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary"
            >
              {(members || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Tanggal
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Deskripsi
          </label>
          <input
            type="text"
            placeholder="Untuk apa transaksi ini?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Catatan (opsional)
          </label>
          <textarea
            rows={3}
            placeholder="Tambahkan detail lain..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </div>
      </main>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-outline-variant bg-surface-container-lowest px-4 py-3">
        <div className="mx-auto max-w-md space-y-2">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full rounded-lg bg-primary py-3.5 text-center text-sm font-semibold text-on-primary disabled:opacity-40"
          >
            {saving ? "Menyimpan..." : editId ? "Simpan Perubahan" : "Simpan Transaksi"}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full rounded-lg border border-outline-variant py-3 text-center text-sm font-semibold text-on-surface"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
