import { useState, useRef } from "react";
import { Download, Upload, AlertTriangle, CheckCircle2, DatabaseBackup } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { formatDateID } from "../utils/format";

// Semua tabel yang ada di database (harus sinkron dengan db.js versi terbaru)
const TABLES = [
  "members",
  "categories",
  "transactions",
  "budgets",
  "goals",
  "assets",
  "asset_value_updates",
  "liabilities",
  "liability_payments",
  "investments",
  "investment_contributions",
  "investment_value_updates",
];

const BACKUP_FORMAT_VERSION = 1;

export default function Backup() {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { type: "success" | "error", message }
  const [confirmFile, setConfirmFile] = useState(null); // { file, summary }

  async function handleExport() {
    setBusy(true);
    setStatus(null);
    try {
      const data = {};
      for (const table of TABLES) {
        data[table] = await db[table].toArray();
      }

      const payload = {
        app: "FamilyPath",
        formatVersion: BACKUP_FORMAT_VERSION,
        exportedAt: Date.now(),
        data,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `familypath-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({ type: "success", message: "Backup berhasil diunduh." });
    } catch (err) {
      setStatus({ type: "error", message: `Gagal membuat backup: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset supaya bisa pilih file yang sama lagi
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || !parsed.data) {
          throw new Error("Format file tidak dikenali. Pastikan ini file backup FamilyPath.");
        }
        const summary = TABLES.map((t) => ({
          table: t,
          count: Array.isArray(parsed.data[t]) ? parsed.data[t].length : 0,
        }));
        setStatus(null);
        setConfirmFile({ file, parsed, summary });
      } catch (err) {
        setStatus({ type: "error", message: `File tidak valid: ${err.message}` });
      }
    };
    reader.onerror = () => {
      setStatus({ type: "error", message: "Gagal membaca file." });
    };
    reader.readAsText(file);
  }

  async function handleConfirmRestore() {
    if (!confirmFile) return;
    setBusy(true);
    setStatus(null);
    try {
      const { parsed } = confirmFile;

      await db.transaction("rw", TABLES.map((t) => db[t]), async () => {
        for (const table of TABLES) {
          await db[table].clear();
          const rows = parsed.data[table];
          if (Array.isArray(rows) && rows.length > 0) {
            await db[table].bulkAdd(rows);
          }
        }
      });

      setConfirmFile(null);
      setStatus({ type: "success", message: "Restore berhasil. Semua data lama sudah diganti dengan isi backup." });
    } catch (err) {
      setStatus({ type: "error", message: `Gagal restore: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  const totalRecordsInFile = confirmFile
    ? confirmFile.summary.reduce((s, r) => s + r.count, 0)
    : 0;

  return (
    <div className="pb-10">
      <Header title="Backup & Restore" showBack />

      <div className="space-y-5 px-4 py-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container/40 text-primary">
              <DatabaseBackup size={18} />
            </span>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Semua data FamilyPath tersimpan lokal di perangkat ini saja (offline, tidak ada server).
              Kalau HP diganti, aplikasi di-uninstall, atau data browser dihapus, data bisa hilang
              permanen tanpa backup. Simpan file backup di tempat aman — Google Drive, WhatsApp ke diri
              sendiri, dll.
            </p>
          </div>
        </div>

        {status && (
          <div
            className={`flex items-start gap-2.5 rounded-xl p-3.5 text-xs ${
              status.type === "success"
                ? "bg-success-container text-on-success-container"
                : "bg-danger-container text-on-danger-container"
            }`}
          >
            {status.type === "success" ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Backup
          </h2>
          <button
            onClick={handleExport}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            <Download size={17} />
            Unduh Backup (.json)
          </button>
          <p className="mt-2 text-[11px] text-on-surface-variant">
            Semua transaksi, budget, goals, aset, investasi, dan hutang dijadikan satu file JSON.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Restore
          </h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest py-3.5 text-sm font-semibold text-on-surface disabled:opacity-60"
          >
            <Upload size={17} />
            Pilih File Backup
          </button>
          <p className="mt-2 text-[11px] text-on-surface-variant">
            Restore akan MENGGANTI semua data yang ada sekarang dengan isi file backup.
          </p>
        </div>

        {confirmFile && (
          <div className="space-y-3 rounded-xl border border-danger bg-danger-container/40 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Konfirmasi Restore
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  File: <span className="font-medium text-on-surface">{confirmFile.file.name}</span>
                  {confirmFile.parsed.exportedAt && (
                    <> · dibuat {formatDateID(confirmFile.parsed.exportedAt)}</>
                  )}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Berisi total <span className="font-semibold text-on-surface">{totalRecordsInFile}</span>{" "}
                  data. Semua data yang ada di aplikasi SEKARANG akan dihapus dan diganti dengan data ini.
                  Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmFile(null)}
                disabled={busy}
                className="flex-1 rounded-lg border border-outline-variant py-2.5 text-sm font-medium text-on-surface-variant disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={busy}
                className="flex-1 rounded-lg bg-danger py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Memproses..." : "Ya, Timpa Data"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
