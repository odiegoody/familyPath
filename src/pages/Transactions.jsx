import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, X, ArrowUpDown } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import TransactionRow from "../components/TransactionRow";
import { formatDateID, formatRupiah } from "../utils/format";

const SORT_OPTIONS = [
  { key: "date_desc", label: "Terbaru" },
  { key: "date_asc", label: "Terlama" },
  { key: "amount_desc", label: "Nominal Tertinggi" },
  { key: "amount_asc", label: "Nominal Terendah" },
];

export default function Transactions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all"); // all | income | expense | saving
  const [memberFilter, setMemberFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (transactions || []).filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (memberFilter !== "all" && String(t.memberId) !== memberFilter) return false;
      if (q) {
        const category = categoryMap[t.categoryId];
        const member = memberMap[t.memberId];
        const goal = goalMap[t.goalId];
        const haystack = [t.note, category?.name, member?.name, goal?.name, formatRupiah(t.amount)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filter, memberFilter, search, categoryMap, memberMap, goalMap]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "date_asc":
        arr.sort((a, b) => a.date - b.date);
        break;
      case "amount_desc":
        arr.sort((a, b) => b.amount - a.amount);
        break;
      case "amount_asc":
        arr.sort((a, b) => a.amount - b.amount);
        break;
      case "date_desc":
      default:
        arr.sort((a, b) => b.date - a.date);
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  const isAmountSort = sortBy === "amount_desc" || sortBy === "amount_asc";

  const grouped = useMemo(() => {
    if (isAmountSort) return null;
    const groups = {};
    sorted.forEach((t) => {
      const key = formatDateID(t.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [sorted, isAmountSort]);

  const loading = transactions === undefined;

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
            placeholder="Cari catatan, kategori, atau anggota..."
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

        {/* Filter chips + sort */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
            {[
              { key: "all", label: "Semua" },
              { key: "expense", label: "Pengeluaran" },
              { key: "income", label: "Pemasukan" },
              { key: "saving", label: "Tabungan" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
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
        </div>

        {/* Sort control */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">
            {sorted.length} transaksi
          </span>
          <label className="flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface-variant">
            <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-medium text-on-surface-variant outline-none"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-5">
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-surface-container-high" />
          ) : sorted.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              {search
                ? "Tidak ada transaksi yang cocok dengan pencarian."
                : "Tidak ada transaksi untuk filter ini."}
            </p>
          ) : isAmountSort ? (
            <div className="overflow-hidden rounded-xl border border-outline-variant shadow-card">
              {sorted.map((tx) => (
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
