import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon, GOAL_ICON_OPTIONS } from "../utils/icons";
import { formatRupiah, parseRupiahInput } from "../utils/format";

const COLOR_OPTIONS = [
  "#3b7dd8",
  "#2f8f4e",
  "#d97757",
  "#8a5cf6",
  "#e0527a",
  "#00b0b9",
  "#e0a72c",
  "#505f76",
];

export default function AddGoal() {
  const navigate = useNavigate();
  const { id } = useParams(); // present when editing existing goal
  const goalId = id ? Number(id) : null;

  const existing = useLiveQuery(() => (goalId ? db.goals.get(goalId) : undefined), [goalId]);

  const [name, setName] = useState("");
  const [targetStr, setTargetStr] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [icon, setIcon] = useState(GOAL_ICON_OPTIONS[0]);
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setTargetStr(String(existing.targetAmount));
      setTargetDate(existing.targetDate ? new Date(existing.targetDate).toISOString().slice(0, 10) : "");
      setIcon(existing.icon);
      setColor(existing.color);
    }
  }, [existing]);

  const targetAmount = parseRupiahInput(targetStr);
  const canSave = name.trim().length > 0 && targetAmount > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      targetAmount,
      targetDate: targetDate ? new Date(targetDate).getTime() : null,
      icon,
      color,
    };
    try {
      if (goalId) {
        await db.goals.update(goalId, payload);
      } else {
        await db.goals.add({ ...payload, createdAt: Date.now() });
      }
      navigate("/goals");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!goalId) return;
    if (!confirm("Hapus goal ini? Riwayat setoran yang terkait tidak akan terhapus otomatis.")) return;
    await db.goals.delete(goalId);
    navigate("/goals");
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <Header
        title={goalId ? "Edit Goal" : "Goal Baru"}
        showBack
        right={
          goalId ? (
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
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Nama Goal
          </label>
          <input
            type="text"
            placeholder="misal: DP Rumah, Dana Darurat"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Target Jumlah
          </label>
          <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <span className="mr-2 font-display text-xl font-semibold text-on-surface-variant">Rp</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={targetStr ? formatRupiah(parseRupiahInput(targetStr), { withSymbol: false }) : ""}
              onChange={(e) => setTargetStr(e.target.value)}
              className="w-full bg-transparent font-display text-xl font-semibold text-on-surface outline-none placeholder:text-on-surface-variant/40"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Target Tanggal (opsional)
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-on-surface-variant">
            Kalau diisi, aku hitung perkiraan tabungan/bulan yang dibutuhkan.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Icon
          </label>
          <div className="grid grid-cols-5 gap-2">
            {GOAL_ICON_OPTIONS.map((iconName) => {
              const Icon = getIcon(iconName);
              const active = icon === iconName;
              return (
                <button
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  className={`flex h-11 items-center justify-center rounded-lg border ${
                    active ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant"
                  }`}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Warna
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-9 w-9 rounded-full ring-offset-2"
                style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : "none" }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-outline-variant bg-surface-container-lowest px-4 py-3">
        <div className="mx-auto max-w-md space-y-2">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full rounded-lg bg-primary py-3.5 text-center text-sm font-semibold text-on-primary disabled:opacity-40"
          >
            {saving ? "Menyimpan..." : goalId ? "Simpan Perubahan" : "Buat Goal"}
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
