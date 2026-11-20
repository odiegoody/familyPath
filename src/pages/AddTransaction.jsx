import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2, PiggyBank, Clipboard, Check, X } from "lucide-react";
import { db, withSync, withUpdatedAt, softDelete } from "../db/db";
import Header from "../components/Header";
import { getIcon } from "../utils/icons";
import { formatRupiah, parseRupiahInput, todayISO } from "../utils/format";
import { parseBankNotification, looksLikeBankNotification, suggestCategoryId } from "../utils/clipboardParser";

export default function AddTransaction() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("edit") ? Number(params.get("edit")) : null;
  const initialType = params.get("type"); // "saving" when coming from GoalDetail
  const initialGoalId = params.get("goal") ? Number(params.get("goal")) : null;
  const initialDirection = params.get("dir") || "in";

  const categories = useLiveQuery(
    () => db.categories.filter((c) => !c.deleted).toArray(),
    []
  );
  const members = useLiveQuery(() => db.members.filter((m) => !m.deleted).toArray(), []);
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.deleted).toArray(), []);
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
  const [clipboardDetected, setClipboardDetected] = useState(null);
  const clipboardChecked = useRef(false);

  // Handle Share Target URL params: /tambah?amount=50000&description=Gopay&source=bank-app
  useEffect(() => {
    const shareAmount = params.get("amount");
    const shareDesc = params.get("description");
    const shareSource = params.get("source");
    if (shareAmount && shareDesc) {
      const amount = parseInt(shareAmount, 10);
      if (amount > 0) {
        setAmountStr(String(amount));
        setDescription(shareDesc);
        setType("expense");
        if (shareSource) setNotes(`Via share dari: ${shareSource}`);
      }
    }
  }, [params]);

  // Clipboard auto-detect on mount (only for new transactions, not editing)
  useEffect(() => {
    if (editId || clipboardChecked.current) return;
    clipboardChecked.current = true;

    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (looksLikeBankNotification(text)) {
          const parsed = parseBankNotification(text);
          if (parsed && parsed.confidence > 0.5) {
            setClipboardDetected(parsed);
          }
        }
      } catch (e) {
        // Clipboard API not available or permission denied - silently ignore
        console.debug("Clipboard read failed:", e);
      }
    };
    checkClipboard();
  }, [editId]);

  // Apply clipboard detection to form
  useEffect(() => {
    if (clipboardDetected && !editId) {
      setAmountStr(String(clipboardDetected.amount));
      setDescription(clipboardDetected.description);
      setType(clipboardDetected.type);
      setNotes(`Auto-detected dari ${clipboardDetected.bank}: ${clipboardDetected.rawText.slice(0, 100)}`);

      // Suggest category after categories loaded
      if (categories) {
        const suggestedCatId = suggestCategoryId(clipboardDetected, categories);
        if (suggestedCatId) setCategoryId(suggestedCatId);
      }

      // Default member
      if (members && members.length && !memberId) {
        setMemberId(members[0].id);
      }
    }
  }, [clipboardDetected, categories, members, memberId, editId]);

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
        await db.transactions.update(editId, withUpdatedAt(payload));
      } else {
        await db.transactions.add(withSync({ ...payload, createdAt: Date.now() }));
      }
      navigate(-1);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    if (!confirm("Hapus transaksi ini?")) return;
    await softDelete("transactions", editId);
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

      {/* Clipboard detection banner */}
      {clipboardDetected && !editId && (
        <div className="mx-auto max-w-md px-4 pt-2 animate-slide-down">
          <div className="flex items-start gap-3 rounded-xl bg-primary-container p-3 shadow-card border border-primary/20">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
              <Clipboard size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-primary">Transaksi terdeteksi dari clipboard</p>
              <p className="mt-1 text-xs text-on-primary/80 font-mono">
                {clipboardDetected.bank} • {clipboardDetected.type === "income" ? "Pemasukan" : "Pengeluaran"} • {formatRupiah(clipboardDetected.amount)}
              </p>
              <p className="mt-1 text-xs text-on-primary/70 truncate">{clipboardDetected.description}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setClipboardDetected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-on-primary/70 hover:bg-primary/20"
                aria-label="Tolak"
              >
                <X size={16} />
              </button>
              <button
                onClick={() => setClipboardDetected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary font-semibold"
                aria-label="Gunakan"
              >
                <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="relative">
            <input
              type="text"
              placeholder="Untuk apa transaksi ini?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 pr-12 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (looksLikeBankNotification(text)) {
                    const parsed = parseBankNotification(text);
                    if (parsed && parsed.confidence > 0.5) {
                      setClipboardDetected(parsed);
                      return;
                    }
                  }
                  // Fallback: just paste the text
                  setDescription(text.slice(0, 100));
                } catch (e) {
                  console.debug("Clipboard read failed:", e);
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-secondary hover:text-primary transition-colors"
              aria-label="Paste dari clipboard"
            >
              <Clipboard size={14} />
              <span className="hidden sm:inline">Paste</span>
            </button>
          </div>
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
