import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { getIcon } from "../utils/icons";
import { formatRupiah } from "../utils/format";
import {
  getDailyLimitCategories,
  setDailyLimitCategories,
  toggleDailyLimitCategory,
  getDailyLimitSummary,
} from "../utils/dailyLimitSettings";
import { ChevronRight, Check, MinusCircle, PlusCircle, Info } from "lucide-react";

/**
 * Settings component for Daily Limit Categories
 * Allows users to select which expense categories count toward the daily safe spend limit
 */
export default function DailyLimitCategorySettings({ categories: initialCategories, onClose }) {
  const [categories, setCategories] = useState(initialCategories || []);
  const [summary, setSummary] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  // Listen for changes to localStorage from other tabs/components
  useEffect(() => {
    const handleStorage = () => updateSummary();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    updateSummary();
  }, [categories]);

  function updateSummary() {
    if (categories.length > 0) {
      setSummary(getDailyLimitSummary(categories));
    }
  }

  function handleCategoryToggle(categoryId) {
    const result = toggleDailyLimitCategory(categoryId);
    if (result && result.action === "needs_categories") {
      // Initialize with all categories except the toggled one
      const expenseCats = categories.filter(c => c.type === "expense" && !c.deleted);
      const newEnabled = expenseCats.filter(c => c.id !== categoryId).map(c => c.id);
      setDailyLimitCategories(newEnabled.length === 0 ? "all" : newEnabled);
    }
    // Force re-render by updating summary
    setTimeout(updateSummary, 0);
  }

  function handleSelectAll() {
    setDailyLimitCategories("all");
    setTimeout(updateSummary, 0);
  }

  function handleSelectNone() {
    setDailyLimitCategories([]);
    setTimeout(updateSummary, 0);
  }

  if (!summary) return null;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Info size={20} />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-on-surface">Kategori Limit Harian</h3>
            <p className="text-xs text-on-surface-variant">
              Pilih kategori pengeluaran yang dihitung untuk limit harian aman (50/30/20)
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex shrink-0 items-center justify-center h-8 w-8 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label={showInfo ? "Sembunyikan info" : "Tampilkan info"}
        >
          <Info size={18} />
        </button>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="mb-4 p-3 rounded-lg bg-primary-container/50 border border-primary/20 text-on-primary-container text-sm space-y-2">
          <p><strong>Cara kerja:</strong> Limit harian aman = (30% Pemasukan - Pengeluaran Kategori Terpilih) ÷ Hari Tersisa</p>
          <p><strong>Mode "Semua":</strong> Semua pengeluaran dikurangi dari budget "Keinginan" (30%)</p>
          <p><strong>Mode "Custom":</strong> Hanya kategori yang dipilih yang dikurangi. Kategori lain tetap tercatat tapi tidak memengaruhi limit harian.</p>
          <p className="text-xs opacity-70">Contoh: Matikan "Transport" kalau kamu punya budget bulanan terpisah untuk Bensin/Tol.</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleSelectAll}
          disabled={summary.mode === "all"}
          className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface-variant disabled:opacity-50 active:bg-surface-container-high"
        >
          <Check size={14} className="inline mr-1" /> Pilih Semua
        </button>
        <button
          onClick={handleSelectNone}
          disabled={summary.mode === "custom" && summary.enabled === 0}
          className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface-variant disabled:opacity-50 active:bg-surface-container-high"
        >
          <MinusCircle size={14} className="inline mr-1" /> Kosongkan
        </button>
      </div>

      {/* Status Summary */}
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PlusCircle size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-on-surface">
            {summary.mode === "all"
              ? `Semua ${summary.total} kategori aktif`
              : `${summary.enabled} dari ${summary.total} kategori aktif`}
          </p>
          <p className="text-xs text-on-surface-variant">
            {summary.mode === "all"
              ? "Semua pengeluaran memengaruhi limit harian"
              : `${summary.disabled} kategori dikecualikan dari perhitungan limit`}
          </p>
        </div>
        {summary.mode === "custom" && summary.enabled > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Custom
          </span>
        )}
      </div>

      {/* Category List */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {summary.categories.map((cat) => {
          const Icon = getIcon(cat.icon);
          return (
            <label
              key={cat.id}
              className="flex items-center gap-3 rounded-lg bg-surface p-3 border border-outline-variant transition-colors has-[:checked]:bg-primary/5 has-[:checked]:border-primary/30"
            >
              <input
                type="checkbox"
                checked={cat.enabled}
                onChange={() => handleCategoryToggle(cat.id)}
                className="h-5 w-5 shrink-0 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
              />
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
              >
                <Icon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{cat.name}</p>
                <p className="text-[10px] text-on-surface-variant">
                  {cat.enabled ? "Dihitung dalam limit harian" : "Dikecualikan dari limit harian"}
                </p>
              </div>
              <ChevronRight size={16} strokeWidth={2} className="text-on-surface-variant/50" />
            </label>
          );
        })}
      </div>

      {summary.categories.length === 0 && (
        <p className="text-center text-sm text-on-surface-variant py-4">
          Belum ada kategori pengeluaran. Tambah di halaman Kategori.
        </p>
      )}
    </div>
  );
}

/**
 * Standalone Settings Page for Daily Limit
 */
export function DailyLimitSettingsPage({ categories, onBack }) {
  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high" aria-label="Kembali">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="font-display text-lg font-semibold text-on-surface">Pengaturan Limit Harian</h1>
      </header>
      <main className="mx-auto max-w-md px-4 pt-4">
        <DailyLimitCategorySettings categories={categories} />
      </main>
    </div>
  );
}