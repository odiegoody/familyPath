import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle, XCircle, AlertCircle, Send, Download, Smartphone, Wifi, X } from "lucide-react";
import QRCodeDisplay from "./QRCodeDisplay";
import QRCodeScanner from "./QRCodeScanner";
import { P2PSyncConnection, exportAllDataForSync, mergeReceivedData, signalingToQRData, qrDataToSignaling } from "../utils/p2pSync";
import { db } from "../db/db";

/**
 * P2P Sync Page - Kirim/Terima data via QR Code + WebRTC
 */
export default function P2PSyncPage({ onClose }) {
  const [mode, setMode] = useState(null); // 'send' | 'receive' | 'confirm'
  const [step, setStep] = useState(0); // 0: qr1, 1: qr2, 2: connecting, 3: transferring, 4: done
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [offerData, setOfferData] = useState(null);
  const [answerData, setAnswerData] = useState(null);
  const [transferProgress, setTransferProgress] = useState({ sent: 0, total: 0 });
  const [scanResult, setScanResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [mergeStats, setMergeStats] = useState(null);

  const connectionRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const updateStatus = (msg) => {
    if (isMountedRef.current) setStatus(msg);
  };

  const handleError = (err) => {
    console.error("Sync error:", err);
    if (isMountedRef.current) {
      setError(err.message || "Terjadi kesalahan");
      setStep(0);
      setMode(null);
    }
  };

  // --- SEND FLOW ---
  async function startSend() {
    setMode("send");
    setStep(0);
    setError(null);
    setStatus("Mempersiapkan data...");

    try {
      connectionRef.current = new P2PSyncConnection();
      connectionRef.current.setCallbacks({
        onStatusChange: updateStatus,
        onError: handleError,
        onDataReceived: null, // Sender doesn't receive data
      });

      // Export data
      updateStatus("Mengekspor data...");
      const data = await exportAllDataForSync(db);
      const compressed = await compressForTransfer(data);
      window.__syncDataToSend = compressed; // Store temporarily

      // Create offer
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
    // Receiver scanned our offer QR, now waiting for them to scan answer QR
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

      // Send data
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

    connectionRef.current = new P2PSyncConnection();
    connectionRef.current.setCallbacks({
      onStatusChange: updateStatus,
      onError: handleError,
      onDataReceived: handleReceivedData,
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
    updateStatus("Menerima data, menggabungkan...");

    try {
      const stats = await mergeReceivedData(db, data);
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
    connectionRef.current?.close();
    connectionRef.current = null;
  }

  function openScanner() {
    setShowScanner(true);
  }

  function handleScanResult(result) {
    setScanResult(result);
    setShowScanner(false);

    // Process based on current step
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

  // Render current view
  if (!mode) {
    return renderModeSelection();
  }

  if (showScanner) {
    return renderScanner();
  }

  return renderSyncProgress();

  function renderModeSelection() {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high" aria-label="Kembali">
            <X className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold text-on-surface">Sinkronkan Perangkat</h1>
        </header>
        <main className="mx-auto max-w-md space-y-4 px-4 pt-6 pb-24">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
            <Wifi className="h-12 w-12 mx-auto text-primary mb-4" />
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
            </ol>
          </div>
        </main>
      </div>
    );
  }

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
      { label: "Selesai", icon: "✅" },
    ];

    const qrToShow = step === 1 ? offerData : step === 2 ? answerData : null;
    const qrLabel = step === 1 ? (mode === "send" ? "QR Undangan (tampilkan ke penerima)" : "QR Undangan (dari pengirim)") :
                     step === 2 ? (mode === "send" ? "QR Jawaban (tampilkan ke pengirim)" : "QR Jawaban (tampilkan ke pengirim)") : null;
    const canScan = (mode === "send" && (step === 1 || step === 2)) || (mode === "receive" && (step === 0 || step === 2));

    return (
      <div className="min-h-screen bg-surface pb-24">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
          <button onClick={resetAll} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high" aria-label="Kembali">
            <X className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold text-on-surface">
            {mode === "send" ? "Kirim Data" : "Terima Data"}
          </h1>
          <span className="w-9" />
        </header>
        <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
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

          {/* Status */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 min-h-[80px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                {step === 3 ? <RefreshCw className="h-5 w-5 animate-spin" /> : step === 4 ? <CheckCircle className="h-5 w-5" /> : error ? <AlertCircle className="h-5 w-5 text-danger" /> : <Smartphone className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-on-surface">{status || "Menunggu..."}</p>
                {error && <p className="text-sm text-danger mt-1">{error}</p>}
              </div>
            </div>
          </div>

          {/* QR Code Display */}
          {qrToShow && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <h3 className="mb-3 font-display text-sm font-semibold text-on-surface text-center">{qrLabel}</h3>
              <QRCodeDisplay
                data={qrToShow}
                size={256}
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
                </div>
              </div>
            )}

            {step === 4 && !mergeStats && (
              <button
                onClick={resetAll}
                className="w-full rounded-lg border border-outline-variant py-3 text-center text-sm font-semibold text-on-surface"
              >
                Selesai
              </button>
            )}

            {(step === 0 || error) && (
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
            </ul>
          </div>
        </main>
      </div>
    );
  }
}

/**
 * Compress data for transfer using Web Streams API
 */
async function compressForTransfer(data) {
  const jsonString = JSON.stringify(data);

  if (typeof CompressionStream !== 'undefined') {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    writer.write(encoder.encode(jsonString));
    writer.close();

    const reader = stream.readable.getReader();
    const chunks = [];
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }

    const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }
    return compressed;
  }

  return new TextEncoder().encode(jsonString);
}