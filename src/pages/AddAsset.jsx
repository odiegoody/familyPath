import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon, ASSET_CATEGORIES, ASSET_TRACKING_FREQUENCIES } from "../utils/icons";
import { formatRupiah, parseRupiahInput, todayISO, getPeriodKey } from "../utils/format";

export default function AddAsset() {
  const navigate = useNavigate();
  const { id } = useParams();
  const assetId = id ? Number(id) : null;

  const existing = useLiveQuery(() => (assetId ? db.assets.get(assetId) : undefined), [assetId]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(ASSET_CATEGORIES[0].key);
  const [quantityStr, setQuantityStr] = useState("1");
  const [valueStr, setValueStr] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [trackingFrequency, setTrackingFrequency] = useState("monthly");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setCategory(existing.category);
      setQuantityStr(String(existing.quantity ?? 1));
      setValueStr(String(existing.initialValue));
      setPurchaseDate(new Date(existing.purchaseDate).toISOString().slice(0, 10));
      setTrackingFrequency(existing.trackingFrequency || "monthly");
      setNotes(existing.notes || "");
    }
  }, [existing]);

  const initialValue = parseRupiahInput(valueStr);
  const canSave = name.trim().length > 0 && initialValue > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const catDef = ASSET_CATEGORIES.find((c) => c.key === category);
    const payload = {
      name: name.trim(),
      category,
      icon: catDef.icon,
      color: catDef.color,
      quantity: parseFloat(quantityStr) || 1,
      initialValue,
      purchaseDate: new Date(purchaseDate).getTime(),
      trackingFrequency,
      notes: notes.trim(),
    };
    try {
      if (assetId) {
        await db.assets.update(assetId, payload);
      } else {
        const newId = await db.assets.add({ ...payload, createdAt: Date.now() });
        // catat nilai awal sebagai entri pertama di riwayat nilai (titik data pertama untuk tracking)
        await db.asset_value_updates.add({
          assetId: newId,
          value: initialValue,
          date: new Date(purchaseDate).getTime(),
          note: "Nilai awal saat aset ditambahkan",
          period: getPeriodKey(purchaseDate, trackingFrequency),
          createdAt: Date.now(),
        });
      }
      navigate("/aset");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!assetId) return;
    if (!confirm("Hapus aset ini beserta seluruh riwayat nilainya?")) return;
    await db.asset_value_updates.where("assetId").equals(assetId).delete();
    await db.assets.delete(assetId);
    navigate("/aset");
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <Header
        title={assetId ? "Edit Aset" : "Aset Baru"}
        showBack
        right={
          assetId ? (
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
            Nama Aset
          </label>
          <input
            type="text"
            placeholder="misal: Rumah Balikpapan, Saham BBCA, Tabungan BCA"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Kategori
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ASSET_CATEGORIES.map((cat) => {
              const Icon = getIcon(cat.icon);
              const active = category === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center ${
                    active
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface"
                  }`}
                >
                  <Icon size={18} style={{ color: active ? undefined : cat.color }} />
                  <span className="text-[11px] font-medium leading-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {assetId ? "Nilai Awal (saat dibeli)" : "Nilai Saat Ini"}
          </label>
          <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <span className="mr-2 font-display text-xl font-semibold text-on-surface-variant">Rp</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={valueStr ? formatRupiah(parseRupiahInput(valueStr), { withSymbol: false }) : ""}
              onChange={(e) => setValueStr(e.target.value)}
              className="w-full bg-transparent font-display text-xl font-semibold text-on-surface outline-none placeholder:text-on-surface-variant/40"
            />
          </div>
          {!assetId && (
            <p className="mt-1 text-xs text-on-surface-variant">
              Nanti kamu bisa update nilai ini kapan saja lewat halaman detail aset.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Jumlah/Unit
            </label>
            <input
              type="number"
              step="any"
              value={quantityStr}
              onChange={(e) => setQuantityStr(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Tanggal Beli
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Frekuensi Tracking
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ASSET_TRACKING_FREQUENCIES.map((f) => (
              <button
                key={f.key}
                onClick={() => setTrackingFrequency(f.key)}
                className={`rounded-lg border py-2.5 text-xs font-semibold ${
                  trackingFrequency === f.key
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant text-on-surface"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            Nanti aset ini bakal dikasih tanda "perlu update" kalau sudah lewat jadwalnya.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Catatan (opsional)
          </label>
          <textarea
            rows={3}
            placeholder="Detail tambahan tentang aset ini..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-outline-variant bg-surface-container-lowest px-4 py-3">
        <div className="mx-auto max-w-md space-y-2">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full rounded-lg bg-primary py-3.5 text-center text-sm font-semibold text-on-primary disabled:opacity-40"
          >
            {saving ? "Menyimpan..." : assetId ? "Simpan Perubahan" : "Tambah Aset"}
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
