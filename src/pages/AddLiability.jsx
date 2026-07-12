import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon, LIABILITY_CATEGORIES } from "../utils/icons";
import { formatRupiah, parseRupiahInput, todayISO } from "../utils/format";

export default function AddLiability() {
  const navigate = useNavigate();
  const { id } = useParams();
  const liabilityId = id ? Number(id) : null;

  const existing = useLiveQuery(
    () => (liabilityId ? db.liabilities.get(liabilityId) : undefined),
    [liabilityId]
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState(LIABILITY_CATEGORIES[0].key);
  const [principalStr, setPrincipalStr] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setCategory(existing.category);
      setPrincipalStr(String(existing.principalAmount));
      setInterestRate(existing.interestRate ? String(existing.interestRate) : "");
      setDueDate(existing.dueDate ? new Date(existing.dueDate).toISOString().slice(0, 10) : "");
      setNotes(existing.notes || "");
    }
  }, [existing]);

  const principalAmount = parseRupiahInput(principalStr);
  const canSave = name.trim().length > 0 && principalAmount > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const catDef = LIABILITY_CATEGORIES.find((c) => c.key === category);
    const payload = {
      name: name.trim(),
      category,
      icon: catDef.icon,
      color: catDef.color,
      principalAmount,
      interestRate: interestRate ? parseFloat(interestRate) : null,
      dueDate: dueDate ? new Date(dueDate).getTime() : null,
      notes: notes.trim(),
    };
    try {
      if (liabilityId) {
        await db.liabilities.update(liabilityId, payload);
      } else {
        await db.liabilities.add({ ...payload, createdAt: Date.now() });
      }
      navigate("/hutang");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!liabilityId) return;
    if (!confirm("Hapus hutang ini beserta seluruh riwayat pembayarannya?")) return;
    await db.liability_payments.where("liabilityId").equals(liabilityId).delete();
    await db.liabilities.delete(liabilityId);
    navigate("/hutang");
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <Header
        title={liabilityId ? "Edit Hutang" : "Hutang Baru"}
        showBack
        right={
          liabilityId ? (
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
            Nama Hutang
          </label>
          <input
            type="text"
            placeholder="misal: KPR Rumah, Kredit Motor, Kartu Kredit BCA"
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
            {LIABILITY_CATEGORIES.map((cat) => {
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
            {liabilityId ? "Jumlah Pokok Hutang" : "Total Hutang (Pokok)"}
          </label>
          <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <span className="mr-2 font-display text-xl font-semibold text-on-surface-variant">Rp</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={
                principalStr ? formatRupiah(parseRupiahInput(principalStr), { withSymbol: false }) : ""
              }
              onChange={(e) => setPrincipalStr(e.target.value)}
              className="w-full bg-transparent font-display text-xl font-semibold text-on-surface outline-none placeholder:text-on-surface-variant/40"
            />
          </div>
          {!liabilityId && (
            <p className="mt-1 text-xs text-on-surface-variant">
              Kalau sudah pernah bayar cicilan sebagian, masukkan jumlah pokok awal di sini — nanti catat pembayaran yang sudah dilakukan lewat halaman detail.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Bunga %/tahun (opsional)
            </label>
            <input
              type="number"
              step="any"
              placeholder="0"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Jatuh Tempo (opsional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Catatan (opsional)
          </label>
          <textarea
            rows={3}
            placeholder="Detail tambahan tentang hutang ini..."
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
            {saving ? "Menyimpan..." : liabilityId ? "Simpan Perubahan" : "Tambah Hutang"}
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
