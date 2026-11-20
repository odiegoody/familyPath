import { useEffect, useRef, useState } from "react";
import { X, Camera, RotateCcw } from "lucide-react";

/**
 * QR Code Scanner Component
 * Uses Barcode Detection API (native in Chrome/Edge) or fallback
 */
export default function QRCodeScanner({ onScan, onClose, facingMode = "environment" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState(facingMode);
  const scanIntervalRef = useRef(null);
  const barcodeDetectorRef = useRef(null);

  useEffect(() => {
    initCamera();
    initBarcodeDetector();

    return () => {
      stopCamera();
      stopScanning();
    };
  }, [currentFacingMode]);

  async function initCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasPermission(true);
        startScanning();
      }
    } catch (e) {
      console.error("Camera access failed:", e);
      setError("Tidak bisa akses kamera. Berikan izin kamera di browser.");
      setHasPermission(false);
    }
  }

  function initBarcodeDetector() {
    // Check for Barcode Detection API (Chrome 88+)
    if ("BarcodeDetector" in window) {
      try {
        barcodeDetectorRef.current = new BarcodeDetector({
          formats: ["qr_code"],
        });
      } catch (e) {
        console.warn("BarcodeDetector not fully supported:", e);
      }
    }
  }

  function startScanning() {
    if (scanning) return;
    setScanning(true);

    const scan = async () => {
      if (!scanning || !videoRef.current || videoRef.current.readyState !== 4) {
        scanIntervalRef.current = requestAnimationFrame(scan);
        return;
      }

      try {
        let result = null;

        // Try BarcodeDetector API first
        if (barcodeDetectorRef.current) {
          const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            result = barcodes[0].rawValue;
          }
        }

        // Fallback: could use jsQR library here if needed
        // For now, we rely on BarcodeDetector

        if (result) {
          stopScanning();
          onScan(result);
          return;
        }
      } catch (e) {
        console.debug("Scan error:", e);
      }

      scanIntervalRef.current = requestAnimationFrame(scan);
    };

    scan();
  }

  function stopScanning() {
    setScanning(false);
    if (scanIntervalRef.current) {
      cancelAnimationFrame(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }

  function stopCamera() {
    stopScanning();
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }

  const switchCamera = () => {
    const newMode = currentFacingMode === "environment" ? "user" : "environment";
    setCurrentFacingMode(newMode);
  };

  if (!hasPermission && error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Scan QR Code</h3>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center text-white/80">
            <Camera className="h-16 w-16 mx-auto mb-4 text-white/30" />
            <p className="text-lg mb-2">{error}</p>
            <p className="text-sm text-white/50">Buka pengaturan browser → Izin Kamera → Allow</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
        <h3 className="font-semibold text-white">Scan QR Code</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={switchCamera}
            className="p-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20"
            aria-label="Ganti kamera"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Scan frame overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[70%] aspect-square max-w-[280px] border-2 border-white/50 rounded-lg relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              Arahkan ke QR Code
            </div>
            {/* Corner brackets */}
            <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-primary" />
            <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-primary" />
            <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-primary" />
            <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-primary" />
          </div>
        </div>

        {/* Scanning indicator */}
        {scanning && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Memindai...</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 bg-black/80 border-t border-white/10">
        <p className="text-center text-white/70 text-sm">
          Posisikan QR code di dalam kotak. Akan otomatis terbaca.
        </p>
      </div>
    </div>
  );
}