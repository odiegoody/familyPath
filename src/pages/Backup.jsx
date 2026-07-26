import { useState, useRef } from "react";
import { Download, Upload, AlertTriangle, CheckCircle2, DatabaseBackup, GitMerge } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { formatDateID } from "../utils/format";

// Semua tabel yang ada di database (harus sinkron dengan db.js versi terbaru).
// PENTING: "investment_targets" sebelumnya KETINGGALAN dari daftar ini (bug) — akibatnya
// Target Investasi tidak pernah ikut ter-backup/restore. Sudah diperbaiki di sini.
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
  "investment_targets",
];

// Urutan proses MERGE: tabel "induk" (tidak punya foreign key ke tabel lain) diproses duluan,
// baru tabel "anak" (punya field yang menunjuk id row di tabel induk, misal categoryId,
// memberId, goalId, assetId, liabilityId, investmentId). Ini WAJIB supaya saat kita
// menerjemahkan foreign key milik tabel anak, peta uuid->id-lokal milik tabel induk sudah lengkap.
const MERGE_ORDER = [
  "members",
  "categories",
  "goals",
  "assets",
  "liabilities",
  "investments",
  "investment_targets",
  "transactions",
  "budgets",
  "asset_value_updates",
  "liability_payments",
  "investment_contributions",
  "investment_value_updates",
];

// Field-field foreign key per tabel yang perlu "diterjemahkan" ID-nya saat merge, karena ID
// (++id) itu lokal per-device — angka yang sama di 2 HP bisa menunjuk ke row yang beda sama sekali.
// Ditulis sebagai { field: tabel_tujuan }.
const FK_MAP = {
  transactions: { categoryId: "categories", memberId: "members", goalId: "goals" },
  budgets: { categoryId: "categories" },
  asset_value_updates: { assetId: "assets" },
  liability_payments: { liabilityId: "liabilities" },
  investment_contributions: { investmentId: "investments" },
  investment_value_updates: { investmentId: "investments" },
};

// v1: backup lama (tanpa idMaps) — hanya bisa dipakai untuk "Timpa Semua Data", TIDAK bisa untuk
//     "Gabungkan Data" karena tidak ada info untuk menerjemahkan foreign key antar-device.
// v2: tambah idMaps (peta uuid <-> id lokal per tabel) supaya "Gabungkan Data" bisa menerjemahkan
//     relasi antar tabel (categoryId, memberId, dst) dengan benar saat digabung ke device lain.
const BACKUP_FORMAT_VERSION = 2;

export default function Backup() {
  const restoreFileInputRef = useRef(null);
  const mergeFileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { type: "success" | "error", message }
  const [confirmRestoreFile, setConfirmRestoreFile] = useState(null); // { file, parsed, summary }
  const [confirmMergeFile, setConfirmMergeFile] = useState(null); // { file, parsed }
  const [mergeResult, setMergeResult] = useState(null); // ringkasan hasil merge terakhir

  async function handleExport() {
    setBusy(true);
    setStatus(null);
    try {
      const data = {};
      const idMaps = {};
      for (const table of TABLES) {
        const rows = await db[table].toArray();
        data[table] = rows;
        // idMaps[table]: { [id lokal di device ini]: uuid } — dipakai device tujuan untuk
        // menerjemahkan foreign key (categoryId, memberId, dst) saat "Gabungkan Data".
        idMaps[table] = {};
        for (const row of rows) {
          if (row.uuid) idMaps[table][row.id] = row.uuid;
        }
      }

      const payload = {
        app: "FamilyPath",
        formatVersion: BACKUP_FORMAT_VERSION,
        deviceId: (() => {
          try {
            return localStorage.getItem("familypath_device_id") || null;
          } catch {
            return null;
          }
        })(),
        exportedAt: Date.now(),
        data,
        idMaps,
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

  function parseBackupFile(file, onSuccess) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || !parsed.data) {
          throw new Error("Format file tidak dikenali. Pastikan ini file backup FamilyPath.");
        }
        setStatus(null);
        onSuccess(parsed);
      } catch (err) {
        setStatus({ type: "error", message: `File tidak valid: ${err.message}` });
      }
    };
    reader.onerror = () => {
      setStatus({ type: "error", message: "Gagal membaca file." });
    };
    reader.readAsText(file);
  }

  function handleRestoreFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset supaya bisa pilih file yang sama lagi
    if (!file) return;
    parseBackupFile(file, (parsed) => {
      const summary = TABLES.map((t) => ({
        table: t,
        count: Array.isArray(parsed.data[t]) ? parsed.data[t].length : 0,
      }));
      setConfirmRestoreFile({ file, parsed, summary });
    });
  }

  function handleMergeFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    parseBackupFile(file, (parsed) => {
      if (!parsed.idMaps || (parsed.formatVersion || 1) < 2) {
        setStatus({
          type: "error",
          message:
            "File ini dibuat dari versi aplikasi yang lebih lama dan tidak punya info relasi antar data (idMaps), jadi tidak bisa digabung dengan aman. Minta anggota keluarga export ulang pakai versi aplikasi terbaru, lalu coba lagi. (File ini masih bisa dipakai untuk 'Timpa Semua Data' kalau perlu.)",
        });
        return;
      }
      setConfirmMergeFile({ file, parsed });
    });
  }

  async function handleConfirmRestore() {
    if (!confirmRestoreFile) return;
    setBusy(true);
    setStatus(null);
    try {
      const { parsed } = confirmRestoreFile;

      await db.transaction("rw", TABLES.map((t) => db[t]), async () => {
        for (const table of TABLES) {
          await db[table].clear();
          const rows = parsed.data[table];
          if (Array.isArray(rows) && rows.length > 0) {
            await db[table].bulkAdd(rows);
          }
        }
      });

      setConfirmRestoreFile(null);
      setStatus({ type: "success", message: "Restore berhasil. Semua data lama sudah diganti dengan isi backup." });
    } catch (err) {
      setStatus({ type: "error", message: `Gagal restore: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  // ---- Gabungkan Data (Merge) ----
  // Menggabungkan data dari file export device LAIN (misal HP suami) ke database device INI
  // (misal HP istri), tanpa menghapus data yang sudah ada di device ini.
  //
  // Prinsip: "last-write-wins" per row, dicocokkan lewat uuid (bukan id lokal, karena id bisa
  // beda arti di device berbeda). Row dengan updatedAt lebih baru yang menang.
  //   - uuid belum ada di device ini -> insert row baru (id lokal dibuat otomatis oleh Dexie).
  //   - uuid sudah ada & file lebih baru (updatedAt lebih besar) -> update row lokal itu.
  //   - uuid sudah ada & data lokal lebih baru/sama -> dilewati (data lokal dipertahankan).
  //
  // Foreign key (categoryId, memberId, goalId, assetId, liabilityId, investmentId) diterjemahkan
  // lewat idMaps yang disertakan file export: id lokal (milik device sumber) -> uuid -> id lokal
  // (milik device ini, dari row yang sudah/baru saja di-merge untuk tabel induknya).
  async function handleConfirmMerge() {
    if (!confirmMergeFile) return;
    setBusy(true);
    setStatus(null);
    try {
      const { parsed } = confirmMergeFile;
      const counts = {}; // ringkasan per tabel: { inserted, updated, skipped }
      // uuidToLocalId[table] = Map(uuid -> id lokal DI DEVICE INI), dibangun sambil jalan
      const uuidToLocalId = {};
      for (const table of TABLES) uuidToLocalId[table] = new Map();

      // Isi awal dengan row yang SUDAH ada di device ini, supaya row lokal lama juga bisa
      // jadi target foreign key untuk row yang baru di-insert dari file.
      for (const table of TABLES) {
        const localRows = await db[table].toArray();
        for (const row of localRows) {
          if (row.uuid) uuidToLocalId[table].set(row.uuid, row.id);
        }
      }

      function remapForeignKeys(table, sourceRow) {
        const fkFields = FK_MAP[table];
        if (!fkFields) return sourceRow;
        const remapped = { ...sourceRow };
        for (const field in fkFields) {
          const parentTable = fkFields[field];
          const sourceLocalId = sourceRow[field];
          if (sourceLocalId === null || sourceLocalId === undefined) continue; // field opsional (misal categoryId null utk transaksi tabungan)
          const parentUuid = parsed.idMaps[parentTable]?.[sourceLocalId];
          if (!parentUuid) {
            // Data induk tidak ketemu di idMaps file (kemungkinan data korup/tidak lengkap) —
            // biarkan field ini null daripada salah nunjuk ke row yang tidak berhubungan.
            remapped[field] = null;
            continue;
          }
          const targetLocalId = uuidToLocalId[parentTable].get(parentUuid);
          remapped[field] = targetLocalId !== undefined ? targetLocalId : null;
        }
        return remapped;
      }

      await db.transaction("rw", TABLES.map((t) => db[t]), async () => {
        for (const table of MERGE_ORDER) {
          const sourceRows = parsed.data[table];
          if (!Array.isArray(sourceRows)) continue;
          let inserted = 0,
            updated = 0,
            skipped = 0;

          for (const sourceRow of sourceRows) {
            if (!sourceRow.uuid) {
              skipped++;
              continue; // row tanpa uuid (data sangat lama) — tidak aman untuk di-merge
            }

            const remapped = remapForeignKeys(table, sourceRow);
            const { id: _ignoredSourceId, ...rowWithoutId } = remapped;
            const existingLocalId = uuidToLocalId[table].get(sourceRow.uuid);

            if (existingLocalId === undefined) {
              // Belum ada di device ini -> insert baru
              const newLocalId = await db[table].add(rowWithoutId);
              uuidToLocalId[table].set(sourceRow.uuid, newLocalId);
              inserted++;
            } else {
              const localRow = await db[table].get(existingLocalId);
              const localUpdatedAt = localRow?.updatedAt || 0;
              const incomingUpdatedAt = sourceRow.updatedAt || 0;
              if (incomingUpdatedAt > localUpdatedAt) {
                await db[table].update(existingLocalId, rowWithoutId);
                updated++;
              } else {
                skipped++;
              }
            }
          }
          counts[table] = { inserted, updated, skipped };
        }
      });

      setConfirmMergeFile(null);
      setMergeResult(counts);
      setStatus({ type: "success", message: "Gabungkan data berhasil. Lihat ringkasan di bawah." });
    } catch (err) {
      setStatus({ type: "error", message: `Gagal menggabungkan data: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  const totalRecordsInFile = confirmRestoreFile
    ? confirmRestoreFile.summary.reduce((s, r) => s + r.count, 0)
    : 0;

  const TABLE_LABELS = {
    members: "Anggota",
    categories: "Kategori",
    transactions: "Transaksi",
    budgets: "Budget",
    goals: "Goals",
    assets: "Aset",
    asset_value_updates: "Update Nilai Aset",
    liabilities: "Hutang",
    liability_payments: "Pembayaran Hutang",
    investments: "Investasi",
    investment_contributions: "Kontribusi Investasi",
    investment_value_updates: "Update Nilai Investasi",
    investment_targets: "Target Investasi",
  };

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
            Semua transaksi, budget, goals, aset, investasi, hutang, dan target investasi dijadikan satu
            file JSON. Kirim file ini ke anggota keluarga lain (WhatsApp, email, dll) supaya data bisa
            digabung ("Gabungkan Data") di HP mereka.
          </p>
        </div>

        {/* ---- Gabungkan Data (Merge) — fitur utama untuk sinkron antar anggota keluarga ---- */}
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <GitMerge size={13} />
            Gabungkan Data
          </h2>
          <input
            ref={mergeFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleMergeFileSelect}
            className="hidden"
          />
          <button
            onClick={() => mergeFileInputRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-container py-3.5 text-sm font-semibold text-on-secondary-container disabled:opacity-60"
          >
            <GitMerge size={17} />
            Pilih File untuk Digabung
          </button>
          <p className="mt-2 text-[11px] text-on-surface-variant">
            Untuk gabung data dari HP anggota keluarga lain (misal suami/istri) TANPA menghapus data
            yang sudah ada di HP ini. Kalau data yang sama pernah diubah di kedua HP, versi yang paling
            baru diubah yang dipakai.
          </p>
        </div>

        {mergeResult && (
          <div className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <p className="text-sm font-semibold text-on-surface">Ringkasan Gabungkan Data Terakhir</p>
            <div className="space-y-1 text-xs text-on-surface-variant">
              {Object.entries(mergeResult)
                .filter(([, c]) => c.inserted + c.updated + c.skipped > 0)
                .map(([table, c]) => (
                  <div key={table} className="flex items-center justify-between">
                    <span>{TABLE_LABELS[table] || table}</span>
                    <span className="tabular-nums">
                      +{c.inserted} baru · {c.updated} diperbarui · {c.skipped} dilewati
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {confirmMergeFile && (
          <div className="space-y-3 rounded-xl border border-secondary bg-secondary-container/40 p-4">
            <div className="flex items-start gap-2.5">
              <GitMerge size={18} className="mt-0.5 shrink-0 text-on-secondary-container" />
              <div>
                <p className="text-sm font-semibold text-on-surface">Konfirmasi Gabungkan Data</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  File: <span className="font-medium text-on-surface">{confirmMergeFile.file.name}</span>
                  {confirmMergeFile.parsed.exportedAt && (
                    <> · dibuat {formatDateID(confirmMergeFile.parsed.exportedAt)}</>
                  )}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Data dari file ini akan digabung ke data yang sudah ada di HP ini. Data lokal yang lebih
                  baru TIDAK akan ditimpa. Proses ini aman dijalankan berkali-kali.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmMergeFile(null)}
                disabled={busy}
                className="flex-1 rounded-lg border border-outline-variant py-2.5 text-sm font-medium text-on-surface-variant disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={busy}
                className="flex-1 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-on-secondary disabled:opacity-60"
              >
                {busy ? "Memproses..." : "Ya, Gabungkan"}
              </button>
            </div>
          </div>
        )}

        {/* ---- Restore (Timpa) — ganti SELURUH data lokal dengan isi file, dipakai untuk pulihkan backup sendiri ---- */}
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Restore (Timpa Semua Data)
          </h2>
          <input
            ref={restoreFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleRestoreFileSelect}
            className="hidden"
          />
          <button
            onClick={() => restoreFileInputRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest py-3.5 text-sm font-semibold text-on-surface disabled:opacity-60"
          >
            <Upload size={17} />
            Pilih File Backup
          </button>
          <p className="mt-2 text-[11px] text-on-surface-variant">
            Restore akan MENGGANTI semua data yang ada sekarang dengan isi file backup. Pakai ini untuk
            pulihkan backup HP ini sendiri — BUKAN untuk gabung data dari HP lain (pakai "Gabungkan Data"
            di atas untuk itu).
          </p>
        </div>

        {confirmRestoreFile && (
          <div className="space-y-3 rounded-xl border border-danger bg-danger-container/40 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Konfirmasi Restore
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  File: <span className="font-medium text-on-surface">{confirmRestoreFile.file.name}</span>
                  {confirmRestoreFile.parsed.exportedAt && (
                    <> · dibuat {formatDateID(confirmRestoreFile.parsed.exportedAt)}</>
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
                onClick={() => setConfirmRestoreFile(null)}
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
