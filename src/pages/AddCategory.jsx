import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon, CATEGORY_ICON_OPTIONS, CATEGORY_COLOR_OPTIONS } from "../utils/icons";

export default function AddCategory() {
  const navigate = useNavigate();
  const { id } = useParams();
  const categoryId = id ? Number(id) : null;

  const existing = useLiveQuery(
    () => (categoryId ? db.categories.get(categoryId) : undefined),
    [categoryId]
  );

  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [icon, setIcon] = useState(CATEGORY_ICON_OPTIONS[0]);
  const [color, setColor] = useState(CATEGORY_COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setType(existing.type);
      setIcon(existing.icon);
      setColor(existing.color);
    }
  }, [existing]);

  const canSave = name.trim().length > 0;
  const isDefault = existing?.isDefault === 1;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const payload = { name: name.trim(), type, icon, color };
    try {
      if (categoryId) {
        await db.categories.update(categoryId, payload);
      } else {
        await db.categories.add({ ...payload, isDefault: 0 });
      }
      navigate("/kategori");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!categoryId) return;
    const txCount = await db.transactions.where("categoryId").equals(categoryId).count();
    const budgetCount = await db.budgets.where("categoryId").equals(categoryId).count();
    if (txCount > 0 || budgetCount > 0) {
      alert(
        `Kategori ini masih dipakai di ${txCount} transaksi dan ${budgetCount} budget. Hapus/ubah dulu transaksi & budget yang pakai kategori ini sebelum menghapus kategorinya.`
      );
      return;
    }
    if (!confirm("Hapus kategori ini?")) return;
    await db.categories.delete(categoryId);
    navigate("/kategori");
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <Header
        title={categoryId ? "Edit Kategori" : "Kategori Baru"}
        showBack
        right={
          categoryId ? (
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
            Nama Kategori
          </label>
          <input
            type="text"
            placeholder="misal: Langganan Internet, Uang Jajan Anak"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Jenis
          </label>
          <div className="grid grid-cols-2 gap-2 rounded-full bg-surface-container-high p-1">
            {[
              { key: "expense", label: "Pengeluaran" },
              { key: "income", label: "Pemasukan" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                disabled={isDefault}
                className={`rounded-full py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  type === t.key ? "bg-primary text-on-primary shadow-card" : "text-on-surface-variant"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {isDefault && (
            <p className="mt-1 text-xs text-on-surface-variant">
              Jenis kategori default tidak bisa diubah.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Icon
          </label>
          <div className="grid grid-cols-6 gap-2">
            {CATEGORY_ICON_OPTIONS.map((iconName) => {
              const Icon = getIcon(iconName);
              const active = icon === iconName;
              return (
                <button
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  className={`flex h-10 items-center justify-center rounded-lg border ${
                    active ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant"
                  }`}
                >
                  <Icon size={16} />
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
            {CATEGORY_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-9 w-9 rounded-full"
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
            {saving ? "Menyimpan..." : categoryId ? "Simpan Perubahan" : "Tambah Kategori"}
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
