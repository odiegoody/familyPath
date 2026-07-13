import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Target, Pencil, Check, X } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import LineChartDual from "../components/LineChartDual";
import { formatRupiah, formatPercent, parseRupiahInput, todayISO } from "../utils/format";
import { projectionSeries, futureValue } from "../utils/finance";

// Hanya ada 1 target aktif (disederhanakan) — kalau sudah ada, kita update record yang sama.
export default function InvestmentTarget() {
  const target = useLiveQuery(() => db.investment_targets.toCollection().first(), []);
  const investmentValueUpdates = useLiveQuery(() => db.investment_value_updates.toArray(), []);
  const investments = useLiveQuery(() => db.investments.toArray(), []);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  if (!investmentValueUpdates || !investments) return null;

  function startEdit() {
    setForm(
      target
        ? {
            name: target.name,
            startDate: new Date(target.startDate).toISOString().slice(0, 10),
            initialAmount: String(target.initialAmount),
            monthlyContribution: String(target.monthlyContribution),
            annualReturnRate: String(target.annualReturnRate),
            years: String(target.years),
          }
        : {
            name: "Target Investasi",
            startDate: todayISO(),
            initialAmount: "0",
            monthlyContribution: "1000000",
            annualReturnRate: "8",
            years: "10",
          }
    );
    setEditing(true);
  }

  async function save() {
    const payload = {
      name: form.name.trim() || "Target Investasi",
      startDate: new Date(form.startDate).getTime(),
      initialAmount: parseRupiahInput(form.initialAmount),
      monthlyContribution: parseRupiahInput(form.monthlyContribution),
      annualReturnRate: Number(form.annualReturnRate) || 0,
      years: Number(form.years) || 1,
    };
    if (target) {
      await db.investment_targets.update(target.id, payload);
    } else {
      await db.investment_targets.add({ ...payload, createdAt: Date.now() });
    }
    setEditing(false);
  }

  // ---- Bangun seri "Realisasi" dari total nilai investasi aktual per tanggal ----
  // Untuk tiap tanggal update, hitung total nilai SEMUA investasi pada tanggal itu
  // (pakai nilai terakhir yang diketahui tiap investasi sampai tanggal tsb).
  function buildRealizationSeries() {
    if (investmentValueUpdates.length === 0) return [];
    const byInvestment = {};
    for (const inv of investments) byInvestment[inv.id] = [];
    for (const u of investmentValueUpdates) {
      if (!byInvestment[u.investmentId]) byInvestment[u.investmentId] = [];
      byInvestment[u.investmentId].push(u);
    }
    for (const id in byInvestment) {
      byInvestment[id].sort((a, b) => a.date - b.date);
    }

    const allDates = [...new Set(investmentValueUpdates.map((u) => u.date))].sort((a, b) => a - b);

    return allDates.map((date) => {
      let total = 0;
      for (const id in byInvestment) {
        const updates = byInvestment[id];
        // nilai terakhir yang diketahui pada atau sebelum `date`
        let latest = null;
        for (const u of updates) {
          if (u.date <= date) latest = u;
          else break;
        }
        if (latest) total += latest.value;
      }
      return { date, value: total };
    });
  }

  const realizationSeries = buildRealizationSeries();
  const currentRealized = realizationSeries.length
    ? realizationSeries[realizationSeries.length - 1].value
    : 0;

  const projected = target
    ? projectionSeries({
        startDate: target.startDate,
        initialAmount: target.initialAmount,
        monthlyContribution: target.monthlyContribution,
        annualReturnRate: target.annualReturnRate,
        years: target.years,
      })
    : [];

  const finalTarget = target
    ? futureValue({
        initialAmount: target.initialAmount,
        monthlyContribution: target.monthlyContribution,
        annualReturnRate: target.annualReturnRate,
        months: Math.round(target.years * 12),
      })
    : 0;

  // Target "seharusnya" tercapai hari ini (proyeksi di titik waktu sekarang)
  let expectedToday = 0;
  if (target) {
    const monthsElapsed = Math.max(
      0,
      Math.round((Date.now() - target.startDate) / (1000 * 60 * 60 * 24 * 30.44))
    );
    expectedToday = futureValue({
      initialAmount: target.initialAmount,
      monthlyContribution: target.monthlyContribution,
      annualReturnRate: target.annualReturnRate,
      months: monthsElapsed,
    });
  }

  const progressVsExpected = expectedToday ? (currentRealized / expectedToday) * 100 : 0;
  const onTrack = currentRealized >= expectedToday;

  return (
    <div className="pb-10">
      <Header title="Target Investasi" showBack />

      <div className="space-y-5 px-4 py-4">
        {!target && !editing && (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
            <Target size={28} className="mx-auto mb-2 text-on-surface-variant" />
            <p className="mb-4 text-sm text-on-surface-variant">
              Belum ada target investasi. Atur modal awal, setoran bulanan, target return, dan durasi
              untuk melihat proyeksi Future Value dibanding realisasi aktual investasimu.
            </p>
            <button
              onClick={startEdit}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
            >
              Atur Target
            </button>
          </div>
        )}

        {target && !editing && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-2xl font-semibold text-on-surface">
                  {formatRupiah(finalTarget)}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {target.name} · target dalam {target.years} tahun
                </p>
              </div>
              <button
                onClick={startEdit}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface active:bg-surface-container-high"
              >
                <Pencil size={16} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-outline-variant pt-4 text-xs">
              <div>
                <p className="text-on-surface-variant">Modal Awal</p>
                <p className="mt-0.5 font-semibold text-on-surface">{formatRupiah(target.initialAmount)}</p>
              </div>
              <div>
                <p className="text-on-surface-variant">Setoran / Bulan</p>
                <p className="mt-0.5 font-semibold text-on-surface">
                  {formatRupiah(target.monthlyContribution)}
                </p>
              </div>
              <div>
                <p className="text-on-surface-variant">Target Return</p>
                <p className="mt-0.5 font-semibold text-on-surface">{target.annualReturnRate}% / tahun</p>
              </div>
              <div>
                <p className="text-on-surface-variant">Durasi</p>
                <p className="mt-0.5 font-semibold text-on-surface">{target.years} tahun</p>
              </div>
            </div>
          </div>
        )}

        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            <p className="text-sm font-semibold text-on-surface">Atur Target Investasi</p>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Nama Target</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Tanggal Mulai</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Modal Awal</label>
              <input
                inputMode="numeric"
                value={form.initialAmount ? formatRupiah(parseRupiahInput(form.initialAmount), { withSymbol: false }) : ""}
                onChange={(e) => setForm({ ...form, initialAmount: e.target.value })}
                placeholder="0"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                Setoran per Bulan
              </label>
              <input
                inputMode="numeric"
                value={
                  form.monthlyContribution
                    ? formatRupiah(parseRupiahInput(form.monthlyContribution), { withSymbol: false })
                    : ""
                }
                onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })}
                placeholder="0"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                  Target Return (%/tahun)
                </label>
                <input
                  inputMode="decimal"
                  value={form.annualReturnRate}
                  onChange={(e) => setForm({ ...form, annualReturnRate: e.target.value })}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                  Durasi (tahun)
                </label>
                <input
                  inputMode="decimal"
                  value={form.years}
                  onChange={(e) => setForm({ ...form, years: e.target.value })}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant py-2.5 text-sm font-medium text-on-surface-variant"
              >
                <X size={15} />
                Batal
              </button>
              <button
                type="submit"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-primary"
              >
                <Check size={15} />
                Simpan
              </button>
            </div>
          </form>
        )}

        {target && !editing && (
          <>
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Target vs Realisasi
              </p>
              <LineChartDual
                series={[
                  {
                    label: "Target (proyeksi)",
                    color: "#94564a",
                    points: projected,
                  },
                  {
                    label: "Realisasi (aktual)",
                    color: "#1c6b37",
                    points: realizationSeries,
                  },
                ]}
              />
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                    Realisasi Saat Ini
                  </p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-on-surface">
                    {formatRupiah(currentRealized)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                    Seharusnya (Hari Ini)
                  </p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-on-surface">
                    {formatRupiah(expectedToday)}
                  </p>
                </div>
              </div>
              <div
                className={`mt-3 rounded-lg px-3 py-2 text-center text-xs font-semibold ${
                  onTrack
                    ? "bg-success-container text-on-success-container"
                    : "bg-danger-container text-on-danger-container"
                }`}
              >
                {onTrack ? "Di atas jalur target 🎉" : "Di bawah jalur target"} ·{" "}
                {formatPercent(progressVsExpected, { showSign: false })} dari proyeksi hari ini
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
