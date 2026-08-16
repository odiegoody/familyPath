import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, X, Calendar } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import TransactionRow from "../components/TransactionRow";
import { formatDateID, formatRupiah } from "../utils/format";

const DATE_PRESETS = [
  { key: "all", label: "Semua Tanggal" },
  { key: "this_month", label: "Bulan Ini" },
  { key: "last_month", label: "Bulan Lalu" },
  { key: "custom", label: "Custom" },
];

function getRangeForPreset(preset) {
  const now = new Date();
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;
    return { start, end };
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1;
    return { start, end };
  }
  return null;
}

export default function Transactions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all"); // all | income | expense | saving
  const [memberFilter, setMemberFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState("all"); // all | this_month | last_month | custom
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const transactions = useLiveQuery(
    () => db.transactions.orderBy("date").reverse().filter((t) => !t.deleted).toArray(),
    []
  );
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);
  const members = useLiveQuery(() => db.members.filter((m) => !m.deleted).toArray(), []);
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.deleted).toArray(), []);

  const categoryMap = useMemo(() => {
    const map = {};
    (categories || []).forEach((c) => (map[c.id] = c));
    return map;
  }, [categories]);
  const memberMap = useMemo(() => {
    const map = {};
    (members || []).forEach((m) => (map[m.id] = m));
    return map;
  }, [members]);
  const goalMap = useMemo(() => {
    const map = {};
    (goals || []).forEach((g) => (map[g.id] = g));
    return map;
  }, [goals]);

  // Only categories relevant to the current type filter (or all, if "all" selected)
  const availableCategories = useMemo(() => {
    if (!categories) return [];
    if (filter === "all") return categories;
    return categories.filter((c) => c.type === filter);
  }, [categories, filter]);

  const activeRange = useMemo(() => {
    if (datePreset === "all") return null;
    if (datePreset === "custom") {
      const start = customFrom ? new Date(customFrom).setHours(0, 0, 0, 0) : null;
      const end = customTo ? new Date(customTo).setHours(23, 59, 59, 999) : null;
      if (!start && !end) return null;
      return { start, end };
    }
    return getRangeForPreset(datePreset);
  }, [datePreset, customFrom, customTo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (transactions || []).filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (memberFilter !== "all" && String(t.memberId) !== memberFilter) return false;
      if (categoryFilter !== "all" && String(t.categoryId) !== categoryFilter) return false;
      if (activeRange) {
        if (activeRange.start && t.date < activeRange.start) return false;
        if (activeRange.end && t.date > activeRange.end) return false;
      }
      if (q) {
        const category = categoryMap[t.categoryId];
        const member = memberMap[t.memberId];
        const goal = goalMap[t.goalId];
        const haystack = [t.description, t.notes, category?.name, member?.name, goal?.name, formatRupiah(t.amount)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filter, memberFilter, categoryFilter, activeRange, search, categoryMap, memberMap, goalMap]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((t) => {
      const key = formatDateID(t.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [filtered]);

  const loading = transactions === undefined;

  function handleTypeFilter(key) {
    setFilter(key);
    setCategoryFilter("all"); // reset category filter when type changes, since options differ
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header title="Transaksi" />
      <main className="mx-auto max-w-md px-4 pt-4">
        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-4 w-4 shrink-0 text-on-surface-variant" strokeWidth={2} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari deskripsi, catatan, kategori..."
            className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="shrink-0 rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container-high"
              aria-label="Hapus pencarian"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Type filter chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {[
            { key: "all", label: "Semua" },
            { key: "expense", label: "Pengeluaran" },
            { key: "income", label: "Pemasukan" },
            { key: "saving", label: "Tabungan" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => handleTypeFilter(f.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                filter === f.key
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
              }`}
            >
              {f.label}
            </button>
          ))}
          {members && members.length > 1 && (
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="shrink-0 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface-variant"
            >
              <option value="all">Semua Anggota</option>
              {members.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Category filter chips */}
        {availableCategories.length > 0 && filter !== "saving" && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                categoryFilter === "all"
                  ? "border-secondary bg-secondary text-on-secondary"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
              }`}
            >
              Semua Kategori
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(String(cat.id))}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                  categoryFilter === String(cat.id)
                    ? "border-secondary bg-secondary text-on-secondary"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Date range filter */}
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setDatePreset(p.key);
                setShowDatePicker(p.key === "custom");
              }}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                datePreset === p.key
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
              }`}
            >
              {p.key === "custom" && <Calendar className="h-3.5 w-3.5" strokeWidth={2} />}
              {p.key === "custom" && customFrom && customTo
                ? `${customFrom.slice(5)} – ${customTo.slice(5)}`
                : p.label}
            </button>
          ))}
        </div>

        {showDatePicker && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                Dari
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-2 text-xs text-on-surface outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                Sampai
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-2 text-xs text-on-surface outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => setShowDatePicker(false)}
              className="mt-4 shrink-0 rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between px-0.5">
          <span className="text-xs text-on-surface-variant">{filtered.length} transaksi</span>
        </div>

        <div className="mt-2 space-y-5">
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-surface-container-high" />
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              {search
                ? "Tidak ada transaksi yang cocok dengan pencarian."
                : activeRange
                ? "Tidak ada transaksi pada rentang tanggal ini."
                : "Tidak ada transaksi untuk filter ini."}
            </p>
          ) : (
            Object.entries(grouped).map(([dateLabel, txs]) => {
              const dayTotal = txs.reduce((s, t) => {
                if (t.type === "income") return s + t.amount;
                if (t.type === "expense") return s - t.amount;
                if (t.type === "saving") return s + (t.direction === "out" ? t.amount : -t.amount);
                return s;
              }, 0);
              return (
                <div key={dateLabel}>
                  <div className="mb-1.5 flex items-center justify-between px-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      {dateLabel}
                    </span>
                    <span className="text-xs font-medium text-on-surface-variant">
                      {formatRupiah(dayTotal)}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-outline-variant shadow-card">
                    {txs.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        category={categoryMap[tx.categoryId]}
                        member={memberMap[tx.memberId]}
                        goal={goalMap[tx.goalId]}
                        onClick={() => navigate(`/tambah?edit=${tx.id}`)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
