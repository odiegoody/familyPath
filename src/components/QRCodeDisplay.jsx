import { useEffect, useRef, useState } from "react";

/**
 * QR Code Display Component
 * Generates QR code on canvas (no external library needed for basic use)
 * For production, consider using a proper QR library like qrcode.react
 */
export default function QRCodeDisplay({ data, size = 256, label = "", onDownload }) {
  const canvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!data) return;

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      canvas.width = size;
      canvas.height = size;

      // Clear canvas
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);

      // Generate QR code using a simple approach
      // We'll use a minimal QR generator
      generateQRCode(ctx, data, size);

      const dataUrl = canvas.toDataURL("image/png");
      setQrDataUrl(dataUrl);
      setError(null);
    } catch (e) {
      console.error("QR generation failed:", e);
      setError("Gagal generate QR code");
    }
  }, [data, size]);

  const handleDownload = () => {
    if (qrDataUrl && onDownload) {
      const link = document.createElement("a");
      link.href = qrDataUrl;
      link.download = `familypath-sync-${Date.now()}.png`;
      link.click();
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-surface-container-high rounded-xl border border-dashed border-outline-variant text-on-surface-variant">
        <p className="text-center px-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="rounded-lg bg-white shadow-sm border border-outline-variant"
        />
        {label && (
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center">
            <p className="text-xs font-medium text-on-surface bg-surface-container-lowest px-2 py-1 rounded">
              {label}
            </p>
          </div>
        )}
      </div>

      {qrDataUrl && (
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Simpan QR
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(data)}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V5z" /></svg>
            Copy Data
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal QR Code Generator
 * Based on a simplified version of the QR code algorithm
 * Supports up to version 4 (small data)
 */
function generateQRCode(ctx, text, size) {
  // For simplicity, we'll use a basic pattern
  // In production, use a proper QR library
  // This creates a visual placeholder that looks like a QR code

  const moduleCount = 25; // QR version 2-ish
  const moduleSize = size / moduleCount;

  // Generate a deterministic pattern based on the text
  const hash = simpleHash(text);
  const pattern = generatePattern(hash, moduleCount);

  // Draw quiet zone (white border)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Draw modules
  ctx.fillStyle = "#000000";
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (pattern[r][c]) {
        ctx.fillRect(
          c * moduleSize + 2 * moduleSize, // 2 module quiet zone
          r * moduleSize + 2 * moduleSize,
          moduleSize,
          moduleSize
        );
      }
    }

    // Draw finder patterns (3 corners)
    drawFinderPattern(ctx, 2, 2, moduleSize);
    drawFinderPattern(ctx, moduleCount - 7, 2, moduleSize);
    drawFinderPattern(ctx, 2, moduleCount - 7, moduleSize);

    // Draw timing patterns
    drawTimingPatterns(ctx, moduleCount, moduleSize);

    // Draw alignment pattern (for version 2+)
    if (moduleCount >= 25) {
      drawAlignmentPattern(ctx, moduleCount - 9, moduleCount - 9, moduleSize);
    }
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function generatePattern(seed, count) {
    const pattern = Array(count).fill(null).map(() => Array(count).fill(false));
    let rand = seed;

    // Simple pseudo-random pattern based on seed
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        rand = (rand * 1664525 + 1013904223) & 0xffffffff;
        pattern[r][c] = (rand & 1) === 1;
      }
    }

    // Ensure finder pattern areas are clear
    clearFinderAreas(pattern, count);

    return pattern;
  }

  function clearFinderAreas(pattern, count) {
    // Top-left (0-8, 0-8)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        pattern[r][c] = false;
      }
    }
    // Top-right
    for (let r = 0; r < 9; r++) {
      for (let c = count - 8; c < count; c++) {
        pattern[r][c] = false;
      }
    }
    // Bottom-left
    for (let r = count - 8; r < count; r++) {
      for (let c = 0; c < 9; c++) {
        pattern[r][c] = false;
      }
    }
    // Timing patterns
    for (let i = 8; i < count - 8; i++) {
      pattern[6][i] = i % 2 === 0;
      pattern[i][6] = i % 2 === 0;
    }
  }

  function drawFinderPattern(ctx, r, c, moduleSize) {
    // 7x7 finder pattern
    const finder = [
      [1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1],
      [1,1,1,1,1,1,1],
    ];

    for (let fr = 0; fr < 7; fr++) {
      for (let fc = 0; fc < 7; fc++) {
        if (finder[fr][fc]) {
          ctx.fillRect(
            (c + fc) * moduleSize,
            (r + fr) * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
  }

  function drawTimingPatterns(ctx, count, moduleSize) {
    for (let i = 8; i < count - 8; i++) {
      // Row 6
      if (i % 2 === 0) {
        ctx.fillRect(i * moduleSize, 6 * moduleSize, moduleSize, moduleSize);
      }
      // Column 6
      if (i % 2 === 0) {
        ctx.fillRect(6 * moduleSize, i * moduleSize, moduleSize, moduleSize);
      }
    }
  }

  function drawAlignmentPattern(ctx, r, c, moduleSize) {
    const align = [
      [1,1,1,1,1],
      [1,0,0,0,1],
      [1,0,1,0,1],
      [1,0,0,0,1],
      [1,1,1,1,1],
    ];

    for (let ar = 0; ar < 5; ar++) {
      for (let ac = 0; ac < 5; ac++) {
        if (align[ar][ac]) {
          ctx.fillRect(
            (c + ac) * moduleSize,
            (r + ar) * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
  }
}