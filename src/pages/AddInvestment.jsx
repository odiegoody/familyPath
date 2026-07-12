import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon, INVESTMENT_CATEGORIES } from "../utils/icons";

export default function AddInvestment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const investmentId = isEdit ? Number(id) : null;

  const existing = useLiveQuery(
    () => (isEdit ? db.investments.get(investmentId) : null),
    [investmentId]
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState(INVESTMENT_CATEGORIES[0].key);
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(!isEdit);

  useEffect(() => {
    if (isEdit && existing && !hydrated) {
      setName(existing.name);
      setCategory(existing.category);
      setNotes(existing.notes || "");
      setHydrated(true);
    }
  }, [isEdit, existing, hydrated]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const cat = INVESTMENT_CATEGORIES.find((c) => c.key === category);

    if (isEdit) {
      await db.investments.update(investmentId, {
        name: name.trim(),
        category,
        icon: cat.icon,
        color: cat.color,
        notes: notes.trim(),
      });
      navigate(`/investasi/${investmentId}`);
    } else {
      const newId = await db.investments.add({
        name: name.trim(),
        category,
        icon: cat.icon,
        color: cat.color,
        notes: notes.trim(),
        createdAt: Date.now(),
      });
      navigate(`/investasi/${newId}`);
    }
  }

  if (isEdit && !hydrated) return null;

  return (
    <div className="pb-10">
      <Header title={isEdit ? "Ubah Investasi" : "Investasi Baru"} showBack />

      <form onSubmit={handleSubmit} className="space-y-5 px-4 py-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
            Nama Investasi
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Reksadana Pasar Uang, BBCA, dst"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-3 text-sm text-on-surface outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
            Kategori
          </label>
          <div className="grid grid-cols-3 gap-2">
            {INVESTMENT_CATEGORIES.map((cat) => {
              const Icon = getIcon(cat.icon);
              const active = category === cat.key;
              return (
                <button
                  type="button"
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center ${
                    active
                      ? "border-primary bg-primary-container/40"
                      : "border-outline-variant bg-surface-container-lowest"
                  }`}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-on-surface">
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
            Catatan (opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Broker, nomor rekening, atau catatan lain"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-3 text-sm text-on-surface outline-none focus:border-primary"
          />
        </div>

        {!isEdit && (
          <p className="rounded-lg bg-secondary-container px-3 py-2.5 text-xs text-on-secondary-container">
            Setelah dibuat, kamu bisa mulai catat kontribusi (setoran berkala) dan update nilai sekarang dari halaman detail.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-primary py-3.5 text-center text-sm font-semibold text-on-primary"
        >
          {isEdit ? "Simpan Perubahan" : "Buat Investasi"}
        </button>
      </form>
    </div>
  );
}
