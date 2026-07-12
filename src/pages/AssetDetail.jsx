import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Pencil, RefreshCw, Check, X, AlertTriangle } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon, ASSET_TRACKING_FREQUENCIES } from "../utils/icons";
import {
  formatRupiah,
  formatPercent,
  formatDateID,
  parseRupiahInput,
  todayISO,
  getPeriodKey,
  getPeriodLabel,
  isUpdateDue,
} from "../utils/format";

export default function AssetDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const assetId = Number(id);

  const asset = useLiveQuery(() => db.assets.get(assetId), [assetId]);
  const updates = useLiveQuery(
    () => db.asset_value_updates.where("assetId").equals(assetId).reverse().sortBy("date"),
    [assetId]
  );

  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newValueStr, setNewValueStr] = useState("");
  const [newDate, setNewDate] = useState(todayISO());
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const sortedUpdates = useMemo(
    () => (updates || []).slice().sort((a, b) => b.date - a.date),
    [updates]
  );
  const currentValue = sortedUpdates.length ? sortedUpdates[0].value : asset?.initialValue || 0;
  const lastUpdateDate = sortedUpdates.length ? sortedUpdates[0].date : asset?.purchaseDate;
  const frequency = asset?.trackingFrequency || "monthly";
  const frequencyLabel = ASSET_TRACKING_FREQUENCIES.find((f) => f.key === frequency)?.label;
  const due = isUpdateDue(lastUpdateDate, frequency);

  const chartData = useMemo(
    () =>
      sortedUpdates
        .slice()
        .reverse()
        .map((u) => ({
          date: formatDateID(u.date).replace(/ \d{4}$/, ""),
          value: u.value,
        })),
    [sortedUpdates]
  );

  function openUpdateForm() {
    setNewValueStr(String(currentValue));
    setNewDate(todayISO());
    setDuplicateWarning(false);
    setShowUpdateForm(true);
  }

  function checkDuplicatePeriod(dateStr) {
    if (frequency === "manual") return false;
    const period = getPeriodKey(dateStr, frequency);
    return sortedUpdates.some((u) => (u.period || getPeriodKey(u.date, frequency)) === period);
  }

  function handleDateChange(dateStr) {
    setNewDate(dateStr);
    setDuplicateWarning(checkDuplicatePeriod(dateStr));
  }

  async function handleAddUpdate() {
    const value = parseRupiahInput(newValueStr);
    if (value <= 0) return;
    setSavingUpdate(true);
    try {
      await db.asset_value_updates.add({
        assetId,
        value,
        date: new Date(newDate).getTime(),
        note: "",
        period: getPeriodKey(newDate, frequency),
        createdAt: Date.now(),
      });
      setShowUpdateForm(false);
      setNewValueStr("");
      setNewDate(todayISO());
      setDuplicateWarning(false);
    } finally {
      setSavingUpdate(false);
    }
  }

  if (asset === undefined || updates === undefined) {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <Header title="Aset" showBack />
        <div className="mx-auto max-w-md px-4 pt-4">
          <div className="h-40 animate-pulse rounded-xl bg-surface-container-high" />
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <Header title="Aset" showBack />
        <p className="px-4 pt-6 text-center text-sm text-on-surface-variant">Aset tidak ditemukan.</p>
      </div>
    );
  }

  const Icon = getIcon(asset.icon);
  const gain = currentValue - asset.initialValue;
  const gainPct = asset.initialValue ? (gain / asset.initialValue) * 100 : 0;
  const isPositive = gain >= 0;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header
        title={asset.name}
        showBack
        right={
          <button
            onClick={() => navigate(`/aset/${assetId}/edit`)}
            aria-label="Edit aset"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface active:bg-surface-container-high"
          >
            <Pencil size={17} />
          </button>
        }
      />

      <main className="mx-auto max-w-md space-y-5 px-4 pt-4">
        <div className="rounded-xl bg-primary-container p-5 text-on-primary shadow-modal">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${asset.color}33` }}
            >
              <Icon size={20} />
            </span>
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
                Nilai Saat Ini
              </p>
              <p className="font-display text-2xl font-semibold">{formatRupiah(currentValue)}</p>
            </div>
          </div>
          <div
            className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isPositive ? "bg-success/20 text-tertiary-fixed" : "bg-danger/25 text-red-200"
            }`}
          >
            {formatRupiah(Math.abs(gain))} ({formatPercent(gainPct)}) sejak awal
          </div>
        </div>

        {due && (
          <div className="flex items-start gap-2 rounded-lg bg-danger-container px-3 py-2.5 text-xs text-on-danger-container">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            Sudah waktunya update nilai aset ini (tracking {frequencyLabel?.toLowerCase()}). Update terakhir{" "}
            {formatDateID(lastUpdateDate)}.
          </div>
        )}

        {chartData.length >= 2 && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
            <p className="mb-2 text-sm font-semibold text-on-surface">Tren Nilai</p>
            <div style={{ width: "100%", height: 160 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#76777d" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#76777d" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    formatter={(v) => formatRupiah(v)}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="value" stroke={asset.color} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
              Nilai Awal
            </p>
            <p className="mt-0.5 font-display text-sm font-semibold text-on-surface">
              {formatRupiah(asset.initialValue)}
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
              Tracking
            </p>
            <p className="mt-0.5 font-display text-sm font-semibold text-on-surface">
              {frequencyLabel}
            </p>
          </div>
        </div>

        {asset.notes && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Catatan</p>
            <p className="mt-1 text-sm text-on-surface">{asset.notes}</p>
          </div>
        )}

        {showUpdateForm ? (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
            <p className="mb-3 text-sm font-semibold text-on-surface">Update Nilai Aset</p>
            <div className="space-y-3">
              <div className="flex items-center rounded-lg border border-outline-variant bg-surface px-3 py-2.5">
                <span className="mr-2 font-display text-lg font-semibold text-on-surface-variant">Rp</span>
                <input
                  autoFocus
                  inputMode="numeric"
                  placeholder="0"
                  value={newValueStr ? formatRupiah(parseRupiahInput(newValueStr), { withSymbol: false }) : ""}
                  onChange={(e) => setNewValueStr(e.target.value)}
                  className="w-full bg-transparent font-display text-lg font-semibold text-on-surface outline-none"
                />
              </div>
              <input
                type="date"
                value={newDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none"
              />
              {duplicateWarning && (
                <p className="flex items-start gap-1.5 rounded-lg bg-danger-container px-3 py-2 text-xs text-on-danger-container">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  Sudah ada entri untuk periode {getPeriodLabel(getPeriodKey(newDate, frequency))}. Menyimpan ini akan
                  jadi entri tambahan di periode yang sama.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAddUpdate}
                  disabled={savingUpdate || parseRupiahInput(newValueStr) <= 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-primary disabled:opacity-40"
                >
                  <Check size={15} /> Simpan
                </button>
                <button
                  onClick={() => setShowUpdateForm(false)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant py-2.5 text-sm font-semibold text-on-surface"
                >
                  <X size={15} /> Batal
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={openUpdateForm}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary"
          >
            <RefreshCw size={16} /> Update Nilai
          </button>
        )}

        <section>
          <h2 className="mb-2.5 font-display text-sm font-semibold text-on-surface">Riwayat Nilai</h2>
          {sortedUpdates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              Belum ada riwayat.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-outline-variant shadow-card">
              {sortedUpdates.map((u, idx) => {
                const prev = sortedUpdates[idx + 1];
                const delta = prev ? u.value - prev.value : 0;
                const deltaPct = prev && prev.value ? (delta / prev.value) * 100 : 0;
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between border-b border-outline-variant/60 bg-surface-container-lowest px-4 py-3 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-on-surface">{formatRupiah(u.value)}</p>
                      <p className="text-xs text-on-surface-variant">
                        {getPeriodLabel(u.period || getPeriodKey(u.date, frequency))} · {formatDateID(u.date)}
                      </p>
                    </div>
                    {prev && (
                      <span
                        className={`text-xs font-semibold ${delta >= 0 ? "text-success" : "text-danger"}`}
                      >
                        {delta >= 0 ? "+" : ""}
                        {formatRupiah(delta)} ({formatPercent(deltaPct)})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
