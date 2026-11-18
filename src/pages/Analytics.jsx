import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { ChevronLeft, ChevronRight, BarChart2, TrendingUp, Download, Calendar, Filter, X } from "lucide-react";
import Header from "../components/Header";
import { formatRupiah, monthKey, monthKeyToLabel, shiftMonthKey, formatDateID } from "../utils/format";
import { getCategoryMonthlyBreakdown, getMonthlySummary, getCategoryComparison, getTopCategories } from "../utils/analytics";
import MiniChart from "../components/MiniChart";
import { getIcon } from "../utils/icons";

const MONTH_OPTIONS = [
  { value: 3, label: "3 Bulan" },
  { value: 6, label: "6 Bulan" },
  { value: 12, label: "12 Bulan" },
];

export default function Analytics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview"); // overview | category | monthly
  const [monthsRange, setMonthsRange] = useState(6);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState(monthKey());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const categories = useLiveQuery(
    () => db.categories.where("type").equals("expense").and(c => !c.deleted).toArray(),
    []
  );

  // Data for overview tab
  const monthlySummary = useLiveQuery(async () => {
    return await getMonthlySummary(monthsRange);
  }, [monthsRange]);

  // Data for category detail tab
  const categoryTrend = useLiveQuery(async () => {
    if (!selectedCategoryId) return [];
    return await getCategoryMonthlyBreakdown(selectedCategoryId, monthsRange);
  }, [selectedCategoryId, monthsRange]);

  // Data for monthly compare tab
  const categoryComparison = useLiveQuery(async () => {
    return await getCategoryComparison(selectedMonthKey);
  }, [selectedMonthKey]);

  // Top categories for quick selection
  const topCategories = useLiveQuery(async () => {
    return await getTopCategories(monthsRange, 5);
  }, [monthsRange]);

  const categoryMap = useMemo(() => {
    const map = {};
    (categories || []).forEach(c => map[c.id] = c);
    return map;
  }, [categories]);

  const selectedCategory = selectedCategoryId ? categoryMap[selectedCategoryId] : null;
  const selectedMonthLabel = monthKeyToLabel(selectedMonthKey);

  // Auto-select first category if none selected
  useEffect(() => {
    if (!selectedCategoryId && categories?.length) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories]);

  const loading = monthlySummary === undefined || categoryTrend === undefined || categoryComparison === undefined;

  // Format chart data for MiniChart
  const overviewChartData = useMemo(() => {
    if (!monthlySummary) return [];
    return monthlySummary.map(m => ({
      monthLabel: m.monthLabel,
      value: m.totalExpense,
      net: m.net,
    }));
  }, [monthlySummary]);

  const categoryChartData = useMemo(() => {
    if (!categoryTrend) return [];
    return categoryTrend.map(c => ({
      monthLabel: c.monthLabel,
      value: c.expense,
      net: c.net,
    }));
  }, [categoryTrend]);

  // Summary stats for overview
  const overviewStats = useMemo(() => {
    if (!monthlySummary?.length) return null;
    const latest = monthlySummary[monthlySummary.length - 1];
    const prev = monthlySummary[monthlySummary.length - 2];
    const expenseChange = prev ? latest.totalExpense - prev.totalExpense : 0;
    const incomeChange = prev ? latest.totalIncome - prev.totalIncome : 0;
    return {
      totalExpense: monthlySummary.reduce((s, m) => s + m.totalExpense, 0),
      totalIncome: monthlySummary.reduce((s, m) => s + m.totalIncome, 0),
      avgExpense: monthlySummary.reduce((s, m) => s + m.totalExpense, 0) / monthlySummary.length,
      latestExpense: latest.totalExpense,
      latestIncome: latest.totalIncome,
      expenseChange,
      incomeChange,
    };
  }, [monthlySummary]);

  function renderOverviewTab() {
    if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-container-high" />)}</div>;

    return (
      <div className="space-y-6">
        {/* Period selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-on-surface-variant">Periode:</span>
            <select
              value={monthsRange}
              onChange={e => setMonthsRange(Number(e.target.value))}
              className="rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface"
            >
              {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Total Pengeluaran"
            value={formatRupiah(overviewStats.totalExpense)}
            subtitle={`${monthsRange} bulan`}
            color="#c14f3d"
            trend={overviewStats.expenseChange}
            trendLabel="vs bln lalu"
          />
          <StatCard
            label="Total Pemasukan"
            value={formatRupiah(overviewStats.totalIncome)}
            subtitle={`${monthsRange} bulan`}
            color="#2f8f4e"
            trend={overviewStats.incomeChange}
            trendLabel="vs bln lalu"
          />
          <StatCard
            label="Rata-rata Bulanan"
            value={formatRupiah(Math.round(overviewStats.avgExpense))}
            subtitle="Pengeluaran"
            color="#8a5cf6"
          />
          <StatCard
            label="Selisih (Net)"
            value={formatRupiah(overviewStats.totalIncome - overviewStats.totalExpense)}
            subtitle={overviewStats.totalIncome >= overviewStats.totalExpense ? "Surplus" : "Defisit"}
            color={overviewStats.totalIncome >= overviewStats.totalExpense ? "#2f8f4e" : "#c14f3d"}
          />
        </div>

        {/* Trend chart */}
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold text-on-surface">Tren Pengeluaran Bulanan</h3>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
            <div className="h-32 w-full">
              <MiniChart
                data={overviewChartData}
                color="#c14f3d"
                height="100%"
                type="area"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-on-surface-variant">
              <span>{monthlySummary[0]?.monthLabel}</span>
              <span>{monthlySummary[monthlySummary.length - 1]?.monthLabel}</span>
            </div>
          </div>
        </section>

        {/* Monthly breakdown table */}
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold text-on-surface">Detail Per Bulan</h3>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant">
                    <th className="px-4 py-2.5 text-left font-medium">Bulan</th>
                    <th className="px-4 py-2.5 text-right font-medium">Pengeluaran</th>
                    <th className="px-4 py-2.5 text-right font-medium">Pemasukan</th>
                    <th className="px-4 py-2.5 text-right font-medium">Tabung (Out/In)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Net</th>
                    <th className="px-4 py-2.5 text-center font-medium">Jml</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map((m, i) => (
                    <tr
                      key={m.monthKey}
                      className={`border-t border-outline-variant ${i % 2 === 0 ? "bg-surface" : "bg-surface-container-lowest"}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-on-surface">{m.monthLabel}</td>
                      <td className="px-4 py-2.5 text-right text-on-surface">{formatRupiah(m.totalExpense)}</td>
                      <td className="px-4 py-2.5 text-right text-on-surface">{formatRupiah(m.totalIncome)}</td>
                      <td className="px-4 py-2.5 text-right text-on-surface-variant">
                        {formatRupiah(m.totalSavingOut)} / {formatRupiah(m.totalSavingIn)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        <span className={m.net >= 0 ? "text-green-600" : "text-red-600"}>
                          {m.net >= 0 ? "+" : ""}{formatRupiah(m.net)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-on-surface-variant">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderCategoryTab() {
    if (loading || !selectedCategory) {
      return <div className="h-64 flex items-center justify-center text-on-surface-variant">Pilih kategori</div>;
    }

    const catColor = selectedCategory.color || "#76777d";
    const totalSpent = categoryTrend.reduce((s, c) => s + c.expense, 0);
    const avgSpent = categoryTrend.length ? totalSpent / categoryTrend.length : 0;
    const latest = categoryTrend[categoryTrend.length - 1];
    const prev = categoryTrend[categoryTrend.length - 2];
    const change = prev ? latest.expense - prev.expense : 0;

    return (
      <div className="space-y-6">
        {/* Category selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5 ${
                selectedCategoryId === cat.id
                  ? "border-secondary bg-secondary text-on-secondary"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
              }`}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
              >
                {(cat.icon && (() => { const Icon = getIcon(cat.icon); return <Icon size={12} />; })()) || null}
              </span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Category header */}
        <div className="flex items-center gap-3 rounded-xl bg-primary-container p-4 text-on-primary shadow-modal">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${catColor}20`, color: catColor }}
          >
            {(selectedCategory.icon && (() => { const Icon = getIcon(selectedCategory.icon); return <Icon size={24} />; })()) || null}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg font-semibold truncate">{selectedCategory.name}</h3>
            <p className="text-sm opacity-80">Pengeluaran {monthsRange} bulan terakhir</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold tabular-nums">{formatRupiah(totalSpent)}</p>
            <p className="text-xs opacity-70">Rata-rata: {formatRupiah(Math.round(avgSpent))}/bln</p>
          </div>
        </div>

        {/* Trend chart */}
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold text-on-surface">Tren Bulanan</h3>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
            <div className="h-40 w-full">
              <MiniChart
                data={categoryChartData}
                color={catColor}
                height="100%"
                type="area"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-on-surface-variant">
              <span>{categoryTrend[0]?.monthLabel}</span>
              <span>{categoryTrend[categoryTrend.length - 1]?.monthLabel}</span>
            </div>
          </div>
        </section>

        {/* Monthly breakdown for this category */}
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold text-on-surface">Detail Per Bulan</h3>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant">
                    <th className="px-4 py-2.5 text-left font-medium">Bulan</th>
                    <th className="px-4 py-2.5 text-right font-medium">Pengeluaran</th>
                    <th className="px-4 py-2.5 text-right font-medium">Pemasukan</th>
                    <th className="px-4 py-2.5 text-right font-medium">Net</th>
                    <th className="px-4 py-2.5 text-center font-medium">Jml Transaksi</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTrend.map((c, i) => (
                    <tr
                      key={c.monthKey}
                      className={`border-t border-outline-variant ${i % 2 === 0 ? "bg-surface" : "bg-surface-container-lowest"}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-on-surface">{c.monthLabel}</td>
                      <td className="px-4 py-2.5 text-right text-on-surface">{formatRupiah(c.expense)}</td>
                      <td className="px-4 py-2.5 text-right text-on-surface">{formatRupiah(c.income)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        <span className={c.net >= 0 ? "text-green-600" : "text-red-600"}>
                          {c.net >= 0 ? "+" : ""}{formatRupiah(c.net)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-on-surface-variant">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderMonthlyTab() {
    if (loading) return <div className="h-64 flex items-center justify-center text-on-surface-variant">Memuat...</div>;

    const totalSpent = categoryComparison.reduce((s, c) => s + c.spent, 0);

    return (
      <div className="space-y-6">
        {/* Month selector */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-on-surface">Bulan: {selectedMonthLabel}</h3>
          <button
            onClick={() => setShowMonthPicker(true)}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface-variant"
          >
            <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
            Ganti Bulan
          </button>
        </div>

        {showMonthPicker && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-on-surface">Pilih Bulan</h4>
              <button onClick={() => setShowMonthPicker(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const mk = shiftMonthKey(monthKey(), i - 6);
                return (
                  <button
                    key={mk}
                    onClick={() => { setSelectedMonthKey(mk); setShowMonthPicker(false); }}
                    className={`rounded-lg p-3 text-sm font-medium ${selectedMonthKey === mk ? "bg-primary text-on-primary" : "bg-surface text-on-surface hover:bg-surface-container-high"}`}
                  >
                    {monthKeyToLabel(mk)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="rounded-xl bg-primary-container p-4 text-on-primary shadow-modal">
          <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
            Total Pengeluaran {selectedMonthLabel}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatRupiah(totalSpent)}</p>
          <p className="mt-1 text-xs text-on-primary/60">{categoryComparison.filter(c => c.spent > 0).length} kategori aktif</p>
        </div>

        {/* Category breakdown for this month */}
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold text-on-surface">Per Kategori</h3>
          <div className="space-y-2">
            {categoryComparison.map((cat, i) => {
              const pct = totalSpent ? (cat.spent / totalSpent) * 100 : 0;
              return (
                <div key={cat.categoryId} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-card">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
                    >
                      {(cat.icon && (() => { const Icon = getIcon(cat.icon); return <Icon size={16} />; })()) || null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-on-surface">{cat.name}</span>
                        <span className="ml-2 shrink-0 font-display font-semibold tabular-nums text-on-surface">
                          {formatRupiah(cat.spent)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                    {pct > 0 && (
                      <span className="shrink-0 text-xs font-medium text-on-surface-variant">{pct.toFixed(1)}%</span>
                    )}
                  </div>
                </div>
              );
            })}
            {categoryComparison.filter(c => c.spent > 0).length === 0 && (
              <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
                Belum ada pengeluaran untuk bulan ini.
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header title="Laporan" showBack />
      <main className="mx-auto max-w-md space-y-6 px-4 pt-4">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1">
          {[
            { key: "overview", label: "Ringkasan", icon: BarChart2 },
            { key: "category", label: "Per Kategori", icon: TrendingUp },
            { key: "monthly", label: "Per Bulan", icon: Calendar },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-surface text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" strokeWidth={2} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && renderOverviewTab()}
        {tab === "category" && renderCategoryTab()}
        {tab === "monthly" && renderMonthlyTab()}
      </main>
    </div>
  );
}

function StatCard({ label, value, subtitle, color, trend, trendLabel }) {
  const hasTrend = trend !== undefined && trend !== 0;
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}1a`, color }}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </span>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-on-surface">{value}</p>
      <p className="mt-0.5 text-xs text-on-surface-variant">{subtitle}</p>
      {hasTrend && (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: trend > 0 ? "#c14f3d" : "#2f8f4e" }}>
          <span>{trend > 0 ? "↑" : "↓"}</span>
          <span>{formatRupiah(Math.abs(trend))}</span>
          <span className="text-on-surface-variant">{trendLabel}</span>
        </p>
      )}
    </div>
  );
}