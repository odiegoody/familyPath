/**
 * WebRTC P2P Sync for FamilyPath
 * Uses QR codes for signaling (offer/answer exchange)
 * Zero server - fully offline capable
 */

// QR code library - using a minimal implementation
// We'll use the browser's built-in capabilities or a tiny QR generator

/**
 * Generate QR code as data URL (SVG)
 * Simple QR code generator for signaling data
 */
export function generateQRCodeSVG(text, size = 256) {
  // Use a simple approach: create QR via external service or minimal implementation
  // For production, we'd use a proper QR library. Here's a minimal approach:

  // Using a data URI for a placeholder - in reality we'd use a real QR generator
  // For now, we'll use the qrcode library via CDN or implement a simple one

  // Simple QR generation using a lightweight approach
  const qrSize = size;
  const modules = generateQRModules(text);
  const moduleCount = modules.length;
  const modulePixelSize = qrSize / moduleCount;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${qrSize} ${qrSize}"><rect width="100%" height="100%" fill="white"/>`;

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (modules[r][c]) {
        const x = c * modulePixelSize;
        const y = r * modulePixelSize;
        svg += `<rect x="${x}" y="${y}" width="${modulePixelSize}" height="${modulePixelSize}" fill="black"/>`;
      }
    }
  }
  svg += '</svg>';

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Minimal QR code module generator (version 1, level L)
 * This is a simplified implementation - for production use a proper library
 */
function generateQRModules(text) {
  // This is a placeholder - in reality we need a proper QR generator
  // For now, return a simple pattern that represents the data
  // We'll use a proper QR library in the component instead
  return [];
}

/**
 * Compress data for transfer using CompressionStream API
 */
export async function compressData(data) {
  const jsonString = JSON.stringify(data);

  // Use CompressionStream (gzip) if available
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

  // Fallback: return raw JSON as Uint8Array
  return new TextEncoder().encode(jsonString);
}

/**
 * Decompress data received
 */
export async function decompressData(compressed) {
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(compressed);
    writer.close();

    const reader = stream.readable.getReader();
    const chunks = [];
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }

    const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    }

    return JSON.parse(new TextDecoder().decode(decompressed));
  }

  // Fallback
  return JSON.parse(new TextDecoder().decode(compressed));
}

/**
 * Export all FamilyPath data for sync
 */
export async function exportAllDataForSync(db) {
  const tables = [
    'members',
    'categories',
    'transactions',
    'budgets',
    'goals',
    'assets',
    'asset_value_updates',
    'liabilities',
    'liability_payments',
    'investments',
    'investment_contributions',
    'investment_value_updates',
    'investment_targets',
  ];

  const data = {};
  for (const table of tables) {
    data[table] = await db[table].toArray();
  }

  // Add metadata
  data._meta = {
    exportedAt: Date.now(),
    version: 1,
    appName: 'FamilyPath',
    deviceId: getDeviceId(),
  };

  return data;
}

/**
 * Get or create device ID
 */
function getDeviceId() {
  let id = localStorage.getItem('familypath_device_id');
  if (!id) {
    id = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('familypath_device_id', id);
  }
  return id;
}

/**
 * Merge received data into local database
 * Uses Last-Write-Wins based on updatedAt
 */
export async function mergeReceivedData(db, receivedData) {
  const tables = [
    'members',
    'categories',
    'transactions',
    'budgets',
    'goals',
    'assets',
    'asset_value_updates',
    'liabilities',
    'liability_payments',
    'investments',
    'investment_contributions',
    'investment_value_updates',
    'investment_targets',
  ];

  let stats = { inserted: 0, updated: 0, deleted: 0, skipped: 0 };

  for (const table of tables) {
    if (!receivedData[table]) continue;

    const localRecords = await db[table].toArray();
    const localMap = new Map(localRecords.map(r => [r.uuid || r.id, r]));

    for (const remoteRecord of receivedData[table]) {
      const localRecord = localMap.get(remoteRecord.uuid || remoteRecord.id);

      // If remote is deleted (soft delete)
      if (remoteRecord.deleted === 1) {
        if (localRecord) {
          await db[table].update(localRecord.id, { deleted: 1, updatedAt: remoteRecord.updatedAt || Date.now() });
          stats.deleted++;
        }
        continue;
      }

      if (!localRecord) {
        // New record - insert
        await db[table].add({ ...remoteRecord, uuid: remoteRecord.uuid || crypto.randomUUID() });
        stats.inserted++;
      } else {
        // Conflict resolution: Last-Write-Wins based on updatedAt
        const localTime = localRecord.updatedAt || localRecord.createdAt || 0;
        const remoteTime = remoteRecord.updatedAt || remoteRecord.createdAt || 0;

        if (remoteTime > localTime) {
          // Remote is newer - update
          await db[table].update(localRecord.id, { ...remoteRecord, id: localRecord.id });
          stats.updated++;
        } else {
          // Local is newer or equal - skip
          stats.skipped++;
        }
      }
    }
  }

  return stats;
}

/**
 * WebRTC P2P Connection Manager
 */
export class P2PSyncConnection {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.isInitiator = false;
    this.onDataReceived = null;
    this.onStatusChange = null;
    this.onError = null;
    this.receivedChunks = [];
    this.expectedTotalSize = 0;
  }

  setCallbacks({ onDataReceived, onStatusChange, onError }) {
    this.onDataReceived = onDataReceived;
    this.onStatusChange = onStatusChange;
    this.onError = onError;
  }

  _setStatus(status) {
    this.onStatusChange?.(status);
  }

  _handleError(error) {
    console.error('P2P Error:', error);
    this.onError?.(error);
  }

  /**
   * Create offer (initiator)
   */
  async createOffer() {
    this.isInitiator = true;
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this._setupPeerConnection();

    // Create data channel
    this.dataChannel = this.peerConnection.createDataChannel('familypath-sync', {
      ordered: true,
      maxRetransmits: 0,
    });
    this._setupDataChannel();

    // Create offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await this._waitForIceGathering();

    return this.peerConnection.localDescription;
  }

  /**
   * Create answer (receiver)
   */
  async createAnswer(offer) {
    this.isInitiator = false;
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this._setupPeerConnection();

    // Handle incoming data channel
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };

    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    await this._waitForIceGathering();

    return this.peerConnection.localDescription;
  }

  /**
   * Set remote answer (initiator)
   */
  async setRemoteAnswer(answer) {
    await this.peerConnection.setRemoteDescription(answer);
  }

  _setupPeerConnection() {
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this._setStatus(`ICE: ${state}`);

      if (state === 'connected' || state === 'completed') {
        this._setStatus('Terhubung - Siap transfer');
      } else if (state === 'failed' || state === 'disconnected') {
        this._handleError(new Error('Koneksi gagal atau terputus'));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      this._setStatus(`State: ${this.peerConnection.connectionState}`);
    };
  }

  _setupDataChannel() {
    this.dataChannel.onopen = () => {
      this._setStatus('Channel terbuka - Transfer dimulai');
    };

    this.dataChannel.onclose = () => {
      this._setStatus('Channel ditutup');
    };

    this.dataChannel.onerror = (error) => {
      this._handleError(error);
    };

    this.dataChannel.onmessage = (event) => {
      this._handleMessage(event.data);
    };
  }

  async _handleMessage(data) {
    // First message might be metadata (file size, etc.)
    if (typeof data === 'string') {
      try {
        const meta = JSON.parse(data);
        if (meta.type === 'meta') {
          this.expectedTotalSize = meta.size;
          this.receivedChunks = [];
          this._setStatus(`Menerima data (${this._formatSize(meta.size)})...`);
          return;
        }
        if (meta.type === 'complete') {
          this._assembleAndProcess();
          return;
        }
      } catch (e) {
        // Not JSON, treat as binary chunk
      }
    }

    // Binary chunk
    if (data instanceof ArrayBuffer || data instanceof Blob) {
      const chunk = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data);
      this.receivedChunks.push(chunk);

      const receivedSize = this.receivedChunks.reduce((sum, c) => sum + c.length, 0);
      const progress = this.expectedTotalSize ? (receivedSize / this.expectedTotalSize * 100).toFixed(1) : '?';
      this._setStatus(`Menerima... ${progress}% (${this._formatSize(receivedSize)})`);
    }
  }

  async _assembleAndProcess() {
    this._setStatus('Menggabungkan data...');

    const totalSize = this.receivedChunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of this.receivedChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    this._setStatus('Dekompresi & memproses...');
    const data = await decompressData(combined);

    this.onDataReceived?.(data);
    this._setStatus('Selesai!');
  }

  /**
   * Send data (initiator)
   */
  async sendData(data) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    this._setStatus('Mengompresi data...');
    const compressed = await compressData(data);

    this._setStatus('Mengirim metadata...');
    // Send metadata first
    this.dataChannel.send(JSON.stringify({
      type: 'meta',
      size: compressed.length,
    }));

    // Send in chunks (16KB each)
    const chunkSize = 16384;
    let sent = 0;

    for (let i = 0; i < compressed.length; i += chunkSize) {
      const chunk = compressed.slice(i, i + chunkSize);
      this.dataChannel.send(chunk.buffer);
      sent += chunk.length;

      const progress = (sent / compressed.length * 100).toFixed(1);
      this._setStatus(`Mengirim... ${progress}% (${this._formatSize(sent)})`);

      // Small delay to avoid overwhelming the channel
      await new Promise(r => setTimeout(r, 10));
    }

    // Send completion signal
    this.dataChannel.send(JSON.stringify({ type: 'complete' }));
    this._setStatus('Data terkirim - Menunggu konfirmasi');
  }

  _waitForIceGathering() {
    return new Promise((resolve) => {
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const check = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  _formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  close() {
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.peerConnection = null;
    this.dataChannel = null;
  }
}

/**
 * Generate QR code for signaling data using a simple approach
 * We'll use a proper QR library in the component
 */
export function signalingToQRData(signaling) {
  return JSON.stringify({
    v: 1,
    t: signaling.type, // 'offer' or 'answer'
    s: signaling.sdp,
  });
}

/**
 * Parse QR data back to signaling
 */
export function qrDataToSignaling(qrData) {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed.v === 1 && parsed.t && parsed.s) {
      return {
        type: parsed.t,
        sdp: parsed.s,
      };
    }
  } catch (e) {
    console.error('Invalid QR data:', e);
  }
  return null;
}