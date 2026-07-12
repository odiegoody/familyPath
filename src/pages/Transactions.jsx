import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import Header from "../components/Header";
import TransactionRow from "../components/TransactionRow";
import { formatDateID, formatRupiah } from "../utils/format";

export default function Transactions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all"); // all | income | expense | saving
  const [memberFilter, setMemberFilter] = useState("all");

  const transactions = useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const members = useLiveQuery(() => db.members.toArray(), []);
  const goals = useLiveQuery(() => db.goals.toArray(), []);

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
    return (transactions || []).filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (memberFilter !== "all" && String(t.memberId) !== memberFilter) return false;
      return true;
    });
  }, [transactions, filter, memberFilter]);

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

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header title="Transaksi" />
      <main className="mx-auto max-w-md px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
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

        <div className="mt-4 space-y-5">
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-surface-container-high" />
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              Tidak ada transaksi untuk filter ini.
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
