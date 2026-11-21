import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle, XCircle, AlertCircle,
  Send, Download, Smartphone, Wifi, X, ChevronRight, ChevronLeft,
  Database, Table, Eye, RotateCcw, Settings, WifiOff,
  ArrowUpDown, GitCompare, FileText, Clock, Shield
} from "lucide-react";
import QRCodeDisplay from "./QRCodeDisplay";
import QRCodeScanner from "./QRCodeScanner";
import {
  P2PSyncConnection,
  exportAllDataForSync,
  mergeReceivedData,
  signalingToQRData,
  qrDataToSignaling,
  generateDiffPreview,
  compressData,
  SYNC_TABLES,
  TABLE_CATEGORIES,
  getDefaultSelectedTables,
  getAllTableKeys,
} from "../utils/p2pSync";
import { db } from "../db/db";

/**
 * P2P Sync Page - Kirim/Terima data via QR Code + WebRTC
 * With: Table selection, Preview diff, Auto-retry, Desktop-friendly UI
 */
export default function P2PSyncPage({ onClose }) {
  const [mode, setMode] = useState(null); // 'send' | 'receive' | 'confirm'
  const [step, setStep] = useState(0); // 0: qr1, 1: qr2, 2: connecting, 3: transferring, 4: done, 5: preview
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [offerData, setOfferData] = useState(null);
  const [answerData, setAnswerData] = useState(null);
  const [transferProgress, setTransferProgress] = useState({ sent: 0, total: 0 });
  const [scanResult, setScanResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [mergeStats, setMergeStats] = useState(null);
  const [diffPreview, setDiffPreview] = useState(null);
  const [selectedTables, setSelectedTables] = useState(() => getDefaultSelectedTables());
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [conflictResolution, setConflictResolution] = useState('remote-wins');
  const [connectionState, setConnectionState] = useState('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  const connectionRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    // Detect desktop
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('resize', checkDesktop);
    };
  }, []);

  const updateStatus = useCallback((msg) => {
    if (isMountedRef.current) setStatus(msg);
  }, []);

  const handleError = useCallback((err) => {
    console.error("Sync error:", err);
    if (isMountedRef.current) {
      setError(err.message || "Terjadi kesalahan");
      // Don't auto-reset on error, let user decide
    }
  }, []);

  const handleConnectionStateChange = useCallback((state) => {
    if (isMountedRef.current) {
      setConnectionState(state.ice || state.connection || state.dataChannel || 'disconnected');
      if (state.ice === 'connected' || state.connection === 'connected') {
        setRetryCount(0);
      }
    }
  }, []);

  // --- SEND FLOW ---
  async function startSend() {
    setMode("send");
    setStep(0);
    setError(null);
    setStatus("Mempersiapkan data...");

    try {
      connectionRef.current = new P2PSyncConnection({
        autoRetry: true,
        maxRetries: 5,
        retryDelay: 3000,
      });
      connectionRef.current.setCallbacks({
        onStatusChange: updateStatus,
        onError: handleError,
        onDataReceived: null,
        onConnectionStateChange: handleConnectionStateChange,
      });

      updateStatus("Mengekspor data...");
      const data = await exportAllDataForSync(db, selectedTables.length === getAllTableKeys().length ? null : selectedTables);
      const compressed = await compressData(data);
      window.__syncDataToSend = compressed;

      updateStatus("Membuat kode undangan...");
      const offer = await connectionRef.current.createOffer();
      setOfferData(signalingToQRData(offer));
      setStep(1);
      updateStatus("Tampilkan QR ke penerima");
    } catch (e) {
      handleError(e);
    }
  }

  async function onReceiverScannedOffer() {
    setStep(2);
    updateStatus("Menunggu penerima scan QR jawaban...");
  }

  async function onAnswerScanned(answerQR) {
    const answer = qrDataToSignaling(answerQR);
    if (!answer) {
      setError("QR jawaban tidak valid");
      return;
    }

    setAnswerData(answerQR);
    setStep(3);
    updateStatus("Menghubungkan...");

    try {
      await connectionRef.current.setRemoteAnswer(answer);
      updateStatus("Terhubung! Mengirim data...");

      await connectionRef.current.sendData(window.__syncDataToSend);
      delete window.__syncDataToSend;

      setStep(4);
      updateStatus("Transfer selesai!");
    } catch (e) {
      handleError(e);
    }
  }

  // --- RECEIVE FLOW ---
  async function startReceive() {
    setMode("receive");
    setStep(0);
    setError(null);
    setStatus("Siap menerima...");

    connectionRef.current = new P2PSyncConnection({
      autoRetry: true,
      maxRetries: 5,
      retryDelay: 3000,
    });
    connectionRef.current.setCallbacks({
      onStatusChange: updateStatus,
      onError: handleError,
      onDataReceived: handleReceivedData,
      onConnectionStateChange: handleConnectionStateChange,
    });
  }

  async function onSenderOfferScanned(offerQR) {
    const offer = qrDataToSignaling(offerQR);
    if (!offer) {
      setError("QR undangan tidak valid");
      return;
    }

    setOfferData(offerQR);
    setStep(1);
    updateStatus("Membuat jawaban...");

    try {
      const answer = await connectionRef.current.createAnswer(offer);
      setAnswerData(signalingToQRData(answer));
      setStep(2);
      updateStatus("Tampilkan QR jawaban ke pengirim");
    } catch (e) {
      handleError(e);
    }
  }

  async function onSenderScannedAnswer() {
    setStep(3);
    updateStatus("Menghubungkan...");
  }

  async function handleReceivedData(data) {
    updateStatus("Menerima data, mempersiapkan preview...");

    try {
      // Store for merge later
      window.__receivedData = data;
      // Generate diff preview first
      const diff = await generateDiffPreview(db, data, selectedTables.length === getAllTableKeys().length ? null : selectedTables);
      setDiffPreview(diff);
      setStep(5); // Preview step
      updateStatus("Preview siap - Silakan konfirmasi");
    } catch (e) {
      handleError(e);
    }
  }

  async function confirmMerge() {
    if (!diffPreview) return;
    updateStatus("Menggabungkan data...");

    try {
      const stats = await mergeReceivedData(db, window.__receivedData, {
        selectedTables: selectedTables.length === getAllTableKeys().length ? null : selectedTables,
        conflictResolution,
      });
      delete window.__receivedData;
      setMergeStats(stats);
      setStep(4);
      updateStatus("Selesai! Data berhasil digabungkan");
    } catch (e) {
      handleError(e);
    }
  }

  function resetAll() {
    setMode(null);
    setStep(0);
    setOfferData(null);
    setAnswerData(null);
    setError(null);
    setStatus("");
    setScanResult(null);
    setShowScanner(false);
    setMergeStats(null);
    setDiffPreview(null);
    setSelectedTables(getDefaultSelectedTables());
    setConflictResolution('remote-wins');
    setConnectionState('disconnected');
    setRetryCount(0);
    connectionRef.current?.close();
    connectionRef.current = null;
  }

  function openScanner() {
    setShowScanner(true);
  }

  function handleScanResult(result) {
    setScanResult(result);
    setShowScanner(false);

    if (mode === "send" && step === 1) {
      onReceiverScannedOffer();
    } else if (mode === "send" && step === 2) {
      onAnswerScanned(result);
    } else if (mode === "receive" && step === 0) {
      onSenderOfferScanned(result);
    } else if (mode === "receive" && step === 2) {
      onSenderScannedAnswer();
    }
  }

  // Table selection handlers
  const toggleTable = (tableKey) => {
    setSelectedTables(prev => prev.includes(tableKey)
      ? prev.filter(t => t !== tableKey)
      : [...prev, tableKey]);
  };

  const toggleCategory = (categoryKey) => {
    const category = TABLE_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) return;
    const allInCategory = category.tables.every(t => selectedTables.includes(t));
    setSelectedTables(prev => allInCategory
      ? prev.filter(t => !category.tables.includes(t))
      : [...new Set([...prev, ...category.tables])]);
  };

  const selectAllTables = () => setSelectedTables(getAllTableKeys());
  const selectDefaultTables = () => setSelectedTables(getDefaultSelectedTables());

  // Render
  if (!mode) return renderModeSelection();
  if (showScanner) return renderScanner();

  return renderSyncProgress();

  // ============================================
  // MODE SELECTION
  // ============================================
  function renderModeSelection() {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high" aria-label="Kembali">
            <X className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold text-on-surface">Sinkronkan Perangkat</h1>
        </header>
        <main className={`mx-auto ${isDesktop ? 'max-w-3xl' : 'max-w-md'} space-y-4 px-4 pt-6 pb-24`}>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
              <Wifi className="h-7 w-7" />
            </div>
            <h2 className="font-display text-lg font-semibold text-on-surface mb-2">Pilih Mode</h2>
            <p className="text-sm text-on-surface-variant mb-6">
              Transfer data langsung antar perangkat via QR Code + WebRTC.<br/>
              Tidak butuh internet, hanya WiFi/Bluetooth lokal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={startSend}
              className="flex flex-col items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card active:bg-surface-container-high"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Send className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="font-medium text-on-surface">Kirim Data</p>
                <p className="text-xs text-on-surface-variant">Saya punya data terbaru</p>
              </div>
            </button>

            <button
              onClick={startReceive}
              className="flex flex-col items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card active:bg-surface-container-high"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                <Download className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="font-medium text-on-surface">Terima Data</p>
                <p className="text-xs text-on-surface-variant">Saya mau update data saya</p>
              </div>
            </button>
          </div>

          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-xs text-on-surface-variant">
            <p className="font-medium mb-2">Cara pakai:</p>
            <ol className="space-y-1 list-decimal list-inside text-left">
              <li>Satu perangkat pilih <strong>Kirim</strong>, satu pilih <strong>Terima</strong></li>
              <li>Pengirim: Tampilkan QR → Penerima scan</li>
              <li>Penerima: Tampilkan QR jawaban → Pengirim scan</li>
              <li>Transfer otomatis mulai via WiFi/Bluetooth</li>
              <li><strong>Preview diff</strong> sebelum merge (mode Terima)</li>
            </ol>
          </div>

          {/* Table Selection Preview */}
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest p-4">
            <p className="font-medium mb-3">Data yang akan disinkronkan: <span className="text-primary">{selectedTables.length}/{getAllTableKeys().length} tabel</span></p>
            <div className="flex flex-wrap gap-1">
              {SYNC_TABLES.map(t => (
                <span
                  key={t.key}
                  className={`px-2 py-1 rounded text-xs ${selectedTables.includes(t.key) ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}
                >
                  {t.icon} {t.label}
                </span>
              ))}
            </div>
            <button
              onClick={() => setShowTableSelector(true)}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Ubah pilihan tabel
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ============================================
  // SCANNER
  // ============================================
  function renderScanner() {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-surface">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-on-surface">Scan QR Code</h3>
          <button onClick={() => setShowScanner(false)} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high">
            <X className="h-6 w-6" />
          </button>
        </header>
        <QRCodeScanner
          onScan={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      </div>
    );
  }

  // ============================================
  // SYNC PROGRESS
  // ============================================
  function renderSyncProgress() {
    const steps = mode === "send" ? [
      { label: "Data diekspor", icon: "📦" },
      { label: "QR Undangan", icon: "📋" },
      { label: "QR Jawaban", icon: "📋" },
      { label: "Transfer", icon: "📡" },
      { label: "Selesai", icon: "✅" },
    ] : [
      { label: "Menunggu", icon: "⏳" },
      { label: "QR Undangan", icon: "📋" },
      { label: "QR Jawaban", icon: "📋" },
      { label: "Transfer", icon: "📡" },
      { label: isDesktop ? "Preview" : "Preview", icon: "👁️" },
      { label: "Selesai", icon: "✅" },
    ];

    const qrToShow = step === 1 ? offerData : step === 2 ? answerData : null;
    const qrLabel = step === 1 ? (mode === "send" ? "QR Undangan (tampilkan ke penerima)" : "QR Undangan (dari pengirim)") :
                     step === 2 ? (mode === "send" ? "QR Jawaban (tampilkan ke pengirim)" : "QR Jawaban (tampilkan ke pengirim)") : null;
    const canScan = (mode === "send" && (step === 1 || step === 2)) || (mode === "receive" && (step === 0 || step === 2));

    const containerClass = isDesktop ? 'max-w-3xl' : 'max-w-md';

    return (
      <div className="min-h-screen bg-surface pb-24">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
          <button onClick={resetAll} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high" aria-label="Kembali">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="font-display text-lg font-semibold text-on-surface">
              {mode === "send" ? "Kirim Data" : "Terima Data"}
            </h1>
            <p className="text-xs text-on-surface-variant">
              {isDesktop ? 'Desktop Mode' : 'Mobile Mode'} • Step {step + 1} of {steps.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex h-2 w-2 rounded-full ${connectionState === 'connected' || connectionState === 'completed' ? 'bg-success' : connectionState === 'failed' ? 'bg-danger' : 'bg-warning'}`} />
            <span className="text-xs text-on-surface-variant capitalize">{connectionState}</span>
            {retryCount > 0 && (
              <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Retry: {retryCount}</span>
            )}
          </div>
        </header>
        <main className={`mx-auto ${containerClass} space-y-4 px-4 pt-4`}>
          {/* Progress Steps */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => (
                <div key={i} className="flex flex-col items-center flex-1 relative">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    i < step ? "bg-primary text-on-primary" :
                    i === step ? "bg-primary/20 text-primary border-2 border-primary" :
                    "bg-surface-container-high text-on-surface-variant"
                  }`}>
                    {i < step ? <CheckCircle className="h-5 w-5" /> : s.icon}
                  </div>
                  <p className={`mt-1 text-[10px] text-center ${i <= step ? "font-medium text-on-surface" : "text-on-surface-variant"}`}>
                    {s.label}
                  </p>
                  {i < steps.length - 1 && (
                    <div className={`absolute top-4 left-[50%] w-full h-1 -translate-x-1/2 ${
                      i < step ? "bg-primary" : "bg-outline-variant"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Status Card */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 min-h-[80px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                {step === 3 ? <RefreshCw className="h-5 w-5 animate-spin" /> :
                 step === 4 ? <CheckCircle className="h-5 w-5" /> :
                 step === 5 ? <Eye className="h-5 w-5" /> :
                 error ? <AlertCircle className="h-5 w-5 text-danger" /> :
                 <Smartphone className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-on-surface">{status || "Menunggu..."}</p>
                {error && <p className="text-sm text-danger mt-1">{error}</p>}
                {retryCount > 0 && <p className="text-xs text-warning mt-1">Auto-retry attempt: {retryCount}/5</p>}
              </div>
            </div>
          </div>

          {/* QR Code Display */}
          {qrToShow && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <h3 className="mb-3 font-display text-sm font-semibold text-on-surface text-center">{qrLabel}</h3>
              <QRCodeDisplay
                data={qrToShow}
                size={isDesktop ? 300 : 256}
                label={step === 1 ? "Scan QR ini" : "Tampilkan QR ini"}
                onDownload={() => {}}
              />
              <p className="mt-3 text-center text-xs text-on-surface-variant">
                {mode === "send" && step === 1 && "Penerima scan QR ini dengan mode 'Terima Data'"}
                {mode === "send" && step === 2 && "Pengirim scan QR ini untuk mulai transfer"}
                {mode === "receive" && step === 1 && "Pengirim scan QR ini untuk mulai transfer"}
              </p>
            </div>
          )}

          {/* Preview Diff (Step 5) */}
          {step === 5 && diffPreview && renderDiffPreview()}

          {/* Actions */}
          <div className="space-y-2">
            {canScan && (
              <button
                onClick={openScanner}
                className="w-full rounded-lg bg-secondary py-3.5 text-center text-sm font-semibold text-on-secondary"
              >
                <Smartphone className="h-5 w-5 inline mr-2" />
                Scan QR {step === 1 ? "Undangan" : step === 2 ? "Jawaban" : ""}
              </button>
            )}

            {step === 5 && (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConflictResolution('remote-wins')}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium ${conflictResolution === 'remote-wins' ? 'bg-primary text-on-primary' : 'border border-outline-variant bg-surface-container-lowest text-on-surface'}`}
                  >
                    Remote wins (default)
                  </button>
                  <button
                    onClick={() => setConflictResolution('local-wins')}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium ${conflictResolution === 'local-wins' ? 'bg-primary text-on-primary' : 'border border-outline-variant bg-surface-container-lowest text-on-surface'}`}
                  >
                    Local wins
                  </button>
                </div>
                <button
                  onClick={confirmMerge}
                  className="w-full rounded-lg bg-primary py-3.5 text-center text-sm font-semibold text-on-primary"
                >
                  <Shield className="h-4 w-4 inline mr-2" />
                  Konfirmasi & Merge
                </button>
                <button
                  onClick={() => { setDiffPreview(null); setStep(mode === 'receive' ? 0 : 3); }}
                  className="w-full rounded-lg border border-outline-variant py-3 text-center text-sm font-semibold text-on-surface-variant"
                >
                  Batal
                </button>
              </>
            )}

            {step === 4 && mergeStats && (
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                <h4 className="mb-3 font-medium text-on-surface flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  Sinkronisasi Berhasil
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-success/10 p-3">
                    <p className="font-display text-xl font-semibold text-success">{mergeStats.inserted}</p>
                    <p className="text-[10px] text-on-surface-variant">Baru</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-3">
                    <p className="font-display text-xl font-semibold text-primary">{mergeStats.updated}</p>
                    <p className="text-[10px] text-on-surface-variant">Diupdate</p>
                  </div>
                  <div className="rounded-lg bg-warning/10 p-3">
                    <p className="font-display text-xl font-semibold text-warning">{mergeStats.deleted}</p>
                    <p className="text-[10px] text-on-surface-variant">Dihapus</p>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3">
                    <p className="font-display text-xl font-semibold text-on-surface-variant">{mergeStats.skipped}</p>
                    <p className="text-[10px] text-on-surface-variant">Dilewati</p>
                  </div>
                  {mergeStats.conflicts > 0 && (
                    <div className="rounded-lg bg-danger/10 p-3 col-span-2">
                      <p className="font-display text-xl font-semibold text-danger">{mergeStats.conflicts}</p>
                      <p className="text-[10px] text-on-surface-variant">Konflik (dilewati)</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(step === 0 || step === 4 || error) && (
              <button
                onClick={resetAll}
                className="w-full rounded-lg border border-outline-variant py-3 text-center text-sm font-semibold text-on-surface-variant"
              >
                Kembali ke Pilih Mode
              </button>
            )}
          </div>

          {/* Help */}
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
            <p className="font-medium mb-1">Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Pastikan kedua perangkat di WiFi yang sama (atau hotspot satu ke satu)</li>
              <li>Jika lambat, coba dekatkan perangkat (Bluetooth/USB tethering)</li>
              <li>Jangan tutup aplikasi saat transfer berlangsung</li>
              <li>Auto-retry aktif: akan coba reconnect otomatis jika putus (max 5x)</li>
              <li>Desktop: QR lebih besar, layout 2 kolom, preview diff lebih lebar</li>
            </ul>
          </div>
        </main>
      </div>
    );
  }

  // ============================================
  // DIFF PREVIEW RENDER
  // ============================================
  function renderDiffPreview() {
    if (!diffPreview) return null;

    const { tables, totalInserted, totalUpdated, totalDeleted, totalSkipped, conflicts } = diffPreview;

    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-on-surface flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Preview Perubahan ({selectedTables.length} tabel)
          </h3>
          <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
            {conflicts.length > 0 ? `${conflicts.length} konflik` : 'Tidak ada konflik'}
          </span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatCard label="Baru" value={totalInserted} color="#2f8f4e" icon={<Database className="h-4 w-4" />} />
          <StatCard label="Update" value={totalUpdated} color="#3b7dd8" icon={<ArrowUpDown className="h-4 w-4" />} />
          <StatCard label="Hapus" value={totalDeleted} color="#c14f3d" icon={<XCircle className="h-4 w-4" />} />
          <StatCard label="Lewati" value={totalSkipped} color="#76777d" icon={<Shield className="h-4 w-4" />} />
        </div>

        {/* Table Details */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {Object.entries(tables).map(([tableKey, tableDiff]) => {
            const tableMeta = SYNC_TABLES.find(t => t.key === tableKey);
            const hasChanges = tableDiff.inserted.length + tableDiff.updated.length + tableDiff.deleted.length + tableDiff.conflicts.length > 0;
            if (!hasChanges) return null;

            return (
              <details key={tableKey} className="rounded-lg border border-outline-variant bg-surface" defaultOpen>
                <summary className="flex items-center justify-between p-3 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tableMeta?.icon || '📄'}</span>
                    <span className="font-medium text-on-surface">{tableMeta?.label || tableKey}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {tableDiff.inserted.length > 0 && <span className="px-2 py-0.5 rounded bg-success/10 text-success">{tableDiff.inserted.length} baru</span>}
                    {tableDiff.updated.length > 0 && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{tableDiff.updated.length} update</span>}
                    {tableDiff.deleted.length > 0 && <span className="px-2 py-0.5 rounded bg-danger/10 text-danger">{tableDiff.deleted.length} hapus</span>}
                    {tableDiff.conflicts.length > 0 && <span className="px-2 py-0.5 rounded bg-warning/10 text-warning">{tableDiff.conflicts.length} konflik</span>}
                  </div>
                </summary>
                <div className="p-3 border-t border-outline-variant space-y-2">
                  {tableDiff.inserted.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-success">
                      <span className="w-5 text-center">+</span>
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))}
                  {tableDiff.updated.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-primary">
                      <span className="w-5 text-center">↻</span>
                      <span className="truncate">{item.name}</span>
                      <span className="text-xs text-on-surface-variant ml-auto">
                        {new Date(item.remoteUpdated).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {tableDiff.deleted.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-danger">
                      <span className="w-5 text-center">−</span>
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))}
                  {tableDiff.conflicts.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-warning p-2 rounded bg-warning/10">
                      <span className="w-5 text-center">⚠</span>
                      <span className="truncate">{item.name}</span>
                      <span className="text-xs text-on-surface-variant ml-auto">Konflik</span>
                    </div>
                  ))}
                  {(tableDiff.inserted.length > 5 || tableDiff.updated.length > 5 || tableDiff.deleted.length > 5) && (
                    <p className="text-xs text-on-surface-variant text-center py-1">
                      +{tableDiff.inserted.length - 5} lagi...
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>

        {conflicts.length > 0 && (
          <div className="mt-4 p-3 rounded-lg border border-warning bg-warning/10">
            <p className="font-medium text-warning mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Ditemukan {conflicts.length} konflik data
            </p>
            <p className="text-xs text-on-surface-variant">
              Pilih strategi resolusi di bawah sebelum merge.
            </p>
          </div>
        )}
      </div>
    );
  }
}

// ============================================
// HELPER COMPONENTS
// ============================================
function StatCard({ label, value, color, icon }) {
  return (
    <div className="rounded-lg bg-surface p-3 text-center border border-outline-variant">
      <div className="flex items-center justify-center gap-1 mb-1" style={{ color }}>
        {icon}
      </div>
      <p className="font-display text-xl font-semibold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-on-surface-variant uppercase">{label}</p>
    </div>
  );
}

// ============================================
// TABLE SELECTOR MODAL
// ============================================
function TableSelectorModal({ isOpen, onClose, selectedTables, onChange }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="flex-1 flex items-end">
        <div className="w-full rounded-t-2xl bg-surface shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-center pt-3">
            <div className="h-1 w-10 rounded-full bg-outline-variant" />
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
            <h3 className="font-display text-lg font-semibold text-on-surface">Pilih Tabel Data</h3>
            <button onClick={onClose} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex gap-2">
              <button onClick={() => onChange(getAllTableKeys())} className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 text-sm font-medium text-on-surface-variant">
                Pilih Semua
              </button>
              <button onClick={() => onChange(getDefaultSelectedTables())} className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 text-sm font-medium text-on-surface-variant">
                Default (Harian)
              </button>
            </div>

            {TABLE_CATEGORIES.map(category => (
              <div key={category.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-on-surface-variant uppercase tracking-wide text-xs">{category.label}</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={category.tables.every(t => selectedTables.includes(t))}
                      onChange={e => onChange(e.target.checked
                        ? [...new Set([...selectedTables, ...category.tables])]
                        : selectedTables.filter(t => !category.tables.includes(t)))}
                      className="h-4 w-4 rounded border-outline-variant text-primary"
                    />
                    <span className="text-xs text-on-surface-variant">Pilih semua</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {category.tables.map(tableKey => {
                    const meta = SYNC_TABLES.find(t => t.key === tableKey);
                    const checked = selectedTables.includes(tableKey);
                    return (
                      <label key={tableKey} className={`flex items-center gap-2 rounded-lg p-3 cursor-pointer transition-colors ${checked ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-lowest'} border ${checked ? 'border-primary/30' : 'border-outline-variant'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => onChange(e.target.checked
                            ? [...selectedTables, tableKey]
                            : selectedTables.filter(t => t !== tableKey))}
                          className="h-4 w-4 rounded border-outline-variant text-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface flex items-center gap-1">
                            {meta?.icon} {meta?.label}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

