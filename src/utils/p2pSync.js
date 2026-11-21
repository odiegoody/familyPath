/**
 * WebRTC P2P Sync for FamilyPath
 * Uses QR codes for signaling (offer/answer exchange)
 * Zero server - fully offline capable
 */

// ============================================
// TABLE DEFINITIONS
// ============================================

export const SYNC_TABLES = [
  { key: 'members', label: 'Anggota Keluarga', icon: '👥', category: 'core' },
  { key: 'categories', label: 'Kategori', icon: '🏷️', category: 'core' },
  { key: 'transactions', label: 'Transaksi', icon: '💳', category: 'finance' },
  { key: 'budgets', label: 'Budget', icon: '📊', category: 'finance' },
  { key: 'goals', label: 'Target Tabungan', icon: '🎯', category: 'finance' },
  { key: 'assets', label: 'Aset', icon: '🏠', category: 'wealth' },
  { key: 'asset_value_updates', label: 'Nilai Aset', icon: '📈', category: 'wealth' },
  { key: 'liabilities', label: 'Hutang/Piutang', icon: '💳', category: 'wealth' },
  { key: 'liability_payments', label: 'Pembayaran Hutang', icon: '💰', category: 'wealth' },
  { key: 'investments', label: 'Investasi', icon: '📈', category: 'wealth' },
  { key: 'investment_contributions', label: 'Kontribusi Investasi', icon: '💰', category: 'wealth' },
  { key: 'investment_value_updates', label: 'Nilai Investasi', icon: '📈', category: 'wealth' },
  { key: 'investment_targets', label: 'Target Investasi', icon: '🎯', category: 'wealth' },
];

export const TABLE_CATEGORIES = [
  { key: 'core', label: 'Inti (Wajib)', tables: ['members', 'categories'] },
  { key: 'finance', label: 'Keuangan Harian', tables: ['transactions', 'budgets', 'goals'] },
  { key: 'wealth', label: 'Kekayaan & Investasi', tables: ['assets', 'asset_value_updates', 'liabilities', 'liability_payments', 'investments', 'investment_contributions', 'investment_value_updates', 'investment_targets'] },
];

export function getAllTableKeys() {
  return SYNC_TABLES.map(t => t.key);
}

export function getDefaultSelectedTables() {
  // Default: core + finance (daily use)
  return ['members', 'categories', 'transactions', 'budgets', 'goals'];
}

// ============================================
// QR CODE SIGNALING
// ============================================

export function signalingToQRData(signaling) {
  return JSON.stringify({
    v: 1,
    t: signaling.type, // 'offer' or 'answer'
    s: signaling.sdp,
  });
}

export function qrDataToSignaling(qrData) {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed.v === 1 && parsed.t && parsed.s) {
      return { type: parsed.t, sdp: parsed.s };
    }
  } catch (e) {
    console.error('Invalid QR data:', e);
  }
  return null;
}

// ============================================
// DATA EXPORT / IMPORT
// ============================================

export async function exportAllDataForSync(db, selectedTables = null) {
  const tablesToExport = selectedTables || getAllTableKeys();
  const data = {};

  for (const table of tablesToExport) {
    data[table] = await db[table].toArray();
  }

  data._meta = {
    exportedAt: Date.now(),
    version: 1,
    appName: 'FamilyPath',
    deviceId: getDeviceId(),
    tables: tablesToExport,
  };

  return data;
}

function getDeviceId() {
  let id = localStorage.getItem('familypath_device_id');
  if (!id) {
    id = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('familypath_device_id', id);
  }
  return id;
}

// ============================================
// COMPRESSION
// ============================================

export async function compressData(data) {
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
  return JSON.parse(new TextDecoder().decode(compressed));
}

// ============================================
// DIFF / PREVIEW
// ============================================

/**
 * Generate a diff preview between local and remote data
 * Returns summary of what would change
 */
export async function generateDiffPreview(db, receivedData, selectedTables = null) {
  const tablesToCheck = selectedTables || getAllTableKeys();
  const diff = {
    tables: {},
    totalInserted: 0,
    totalUpdated: 0,
    totalDeleted: 0,
    totalSkipped: 0,
    conflicts: [], // Records where both local and remote changed
  };

  for (const table of tablesToCheck) {
    if (!receivedData[table]) continue;

    const localRecords = await db[table].toArray();
    const localMap = new Map(localRecords.map(r => [r.uuid || r.id, r]));
    const remoteRecords = receivedData[table] || [];

    const tableDiff = {
      inserted: [],
      updated: [],
      deleted: [],
      skipped: [],
      conflicts: [],
    };

    for (const remoteRecord of remoteRecords) {
      const localRecord = localMap.get(remoteRecord.uuid || remoteRecord.id);

      if (remoteRecord.deleted === 1) {
        if (localRecord) {
          tableDiff.deleted.push({
            id: remoteRecord.uuid || remoteRecord.id,
            name: getRecordName(remoteRecord, table),
            localUpdated: localRecord.updatedAt,
            remoteUpdated: remoteRecord.updatedAt,
          });
        }
        continue;
      }

      if (!localRecord) {
        tableDiff.inserted.push({
          id: remoteRecord.uuid || remoteRecord.id,
          name: getRecordName(remoteRecord, table),
        });
      } else {
        const localTime = localRecord.updatedAt || localRecord.createdAt || 0;
        const remoteTime = remoteRecord.updatedAt || remoteRecord.createdAt || 0;

        if (remoteTime > localTime) {
          // Check if local also has changes (conflict)
          const localChanged = localRecord.updatedAt > localRecord.createdAt;
          const remoteChanged = remoteRecord.updatedAt > (remoteRecord.createdAt || 0);

          if (localChanged && remoteChanged && localTime !== remoteTime) {
            tableDiff.conflicts.push({
              id: remoteRecord.uuid || remoteRecord.id,
              name: getRecordName(remoteRecord, table),
              localUpdated: localTime,
              remoteUpdated: remoteTime,
              localData: localRecord,
              remoteData: remoteRecord,
            });
            diff.conflicts.push({ table, ...tableDiff.conflicts[tableDiff.conflicts.length - 1] });
          } else {
            tableDiff.updated.push({
              id: remoteRecord.uuid || remoteRecord.id,
              name: getRecordName(remoteRecord, table),
              localUpdated: localTime,
              remoteUpdated: remoteTime,
            });
          }
        } else {
          tableDiff.skipped.push({
            id: remoteRecord.uuid || remoteRecord.id,
            name: getRecordName(remoteRecord, table),
          });
        }
      }
    }

    diff.tables[table] = tableDiff;
    diff.totalInserted += tableDiff.inserted.length;
    diff.totalUpdated += tableDiff.updated.length;
    diff.totalDeleted += tableDiff.deleted.length;
    diff.totalSkipped += tableDiff.skipped.length;
  }

  return diff;
}

function getRecordName(record, table) {
  if (record.name) return record.name;
  if (record.description) return record.description.slice(0, 30);
  if (record.amount) return `${record.type || 'tx'} ${record.amount}`;
  return record.uuid?.slice(0, 8) || record.id?.toString().slice(0, 8) || 'Unknown';
}

// ============================================
// MERGE WITH OPTIONS
// ============================================

export async function mergeReceivedData(db, receivedData, options = {}) {
  const {
    selectedTables = null,
    conflictResolution = 'remote-wins', // 'remote-wins' | 'local-wins' | 'manual'
    dryRun = false,
  } = options;

  const tables = selectedTables || getAllTableKeys();
  let stats = { inserted: 0, updated: 0, deleted: 0, skipped: 0, conflicts: 0 };

  for (const table of tables) {
    if (!receivedData[table]) continue;

    const localRecords = await db[table].toArray();
    const localMap = new Map(localRecords.map(r => [r.uuid || r.id, r]));

    for (const remoteRecord of receivedData[table]) {
      const localRecord = localMap.get(remoteRecord.uuid || remoteRecord.id);

      if (remoteRecord.deleted === 1) {
        if (localRecord && !dryRun) {
          await db[table].update(localRecord.id, { deleted: 1, updatedAt: remoteRecord.updatedAt || Date.now() });
        }
        if (!dryRun) stats.deleted++;
        continue;
      }

      if (!localRecord) {
        if (!dryRun) {
          await db[table].add({ ...remoteRecord, uuid: remoteRecord.uuid || crypto.randomUUID() });
        }
        stats.inserted++;
      } else {
        const localTime = localRecord.updatedAt || localRecord.createdAt || 0;
        const remoteTime = remoteRecord.updatedAt || remoteRecord.createdAt || 0;

        if (remoteTime > localTime) {
          if (!dryRun) {
            await db[table].update(localRecord.id, { ...remoteRecord, id: localRecord.id });
          }
          stats.updated++;
        } else if (localTime > remoteTime) {
          // Local is newer
          if (conflictResolution === 'local-wins') {
            if (!dryRun) {
              // Keep local, do nothing
            }
            stats.skipped++;
          } else if (conflictResolution === 'remote-wins') {
            if (!dryRun) {
              await db[table].update(localRecord.id, { ...remoteRecord, id: localRecord.id });
            }
            stats.updated++;
          } else {
            // Manual - skip for now
            stats.conflicts++;
            stats.skipped++;
          }
        } else {
          stats.skipped++;
        }
      }
    }
  }

  return stats;
}

// ============================================
// P2P CONNECTION WITH AUTO-RETRY
// ============================================

export class P2PSyncConnection {
  constructor(options = {}) {
    this.peerConnection = null;
    this.dataChannel = null;
    this.isInitiator = false;
    this.onDataReceived = null;
    this.onStatusChange = null;
    this.onError = null;
    this.onConnectionStateChange = null;

    // Auto-retry config
    this.autoRetry = options.autoRetry !== false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000;
    this.currentRetry = 0;
    this.isRetrying = false;

    this.receivedChunks = [];
    this.expectedTotalSize = 0;

    this.onDataReceived = null;
    this.onStatusChange = null;
    this.onError = null;
    this.receivedChunks = [];
    this.expectedTotalSize = 0;
  }

  setCallbacks({ onDataReceived, onStatusChange, onError, onConnectionStateChange }) {
    this.onDataReceived = onDataReceived;
    this.onStatusChange = onStatusChange;
    this.onError = onError;
    this.onConnectionStateChange = onConnectionStateChange;
  }

  _setStatus(status) {
    this.onStatusChange?.(status);
  }

  _handleError(error) {
    console.error('P2P Error:', error);
    this.onError?.(error);
  }

  _notifyConnectionState(state) {
    this.onConnectionStateChange?.(state);
  }

  /**
   * Create offer (initiator)
   */
  async createOffer() {
    this.isInitiator = true;
    this.currentRetry = 0;

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
    });

    this._setupPeerConnection();
    this._setupDataChannel();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this._waitForIceGathering();

    return this.peerConnection.localDescription;
  }

  async createAnswer(offer) {
    this.isInitiator = false;
    this.currentRetry = 0;

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
    });

    this._setupPeerConnection();

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

  async setRemoteAnswer(answer) {
    await this.peerConnection.setRemoteDescription(answer);
  }

  _setupPeerConnection() {
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this._setStatus(`ICE: ${state}`);
      this._notifyConnectionState({ ice: state });

      if (state === 'connected' || state === 'completed') {
        this._setStatus('Terhubung - Siap transfer');
        this.currentRetry = 0; // Reset retry on success
      } else if (state === 'failed' || state === 'disconnected') {
        this._setStatus(`Koneksi ${state === 'failed' ? 'gagal' : 'terputus'}`);
        this._handleConnectionFailure();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this._setStatus(`State: ${state}`);
      this._notifyConnectionState({ connection: state });

      if (state === 'failed' || state === 'disconnected') {
        this._handleConnectionFailure();
      }
    };

    // Monitor data channel state
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };
  }

  _setupDataChannel() {
    this.dataChannel.onopen = () => {
      this._setStatus('Channel terbuka - Transfer dimulai');
      this._notifyConnectionState({ dataChannel: 'open' });
    };

    this.dataChannel.onclose = () => {
      this._setStatus('Channel ditutup');
      this._notifyConnectionState({ dataChannel: 'closed' });
    };

    this.dataChannel.onerror = (error) => {
      this._handleError(error);
    };

    this.dataChannel.onmessage = (event) => {
      this._handleMessage(event.data);
    };
  }

  _handleConnectionFailure() {
    if (!this.autoRetry || this.isRetrying) return;

    if (this.currentRetry < this.maxRetries) {
      this.currentRetry++;
      this.isRetrying = true;
      this._setStatus(`Koneksi terputus. Mencoba kembali (${this.currentRetry}/${this.maxRetries})...`);

      setTimeout(() => {
        this.isRetrying = false;
        this._attemptReconnect();
      }, this.retryDelay * this.currentRetry);
    } else {
      this._setStatus('Gagal reconnect setelah ' + this.maxRetries + ' percobaan');
      this._handleError(new Error('Max retries exceeded'));
    }
  }

  async _attemptReconnect() {
    try {
      this._setStatus('Mencoba reconnect...');

      // For receiver: need to re-create answer
      // For sender: need to re-create offer
      // This is complex - for now just restart the connection
      if (this.peerConnection) {
        this.peerConnection.close();
      }

      // Recreate peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      });

      this._setupPeerConnection();
      this._setupDataChannel();

      if (this.isInitiator) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        await this._waitForIceGathering();
        // Need to send new offer via QR
        this._setStatus('Koneksi baru dibuat. Silakan scan QR baru.');
        // Could emit event for UI to show new QR
      } else {
        // Receiver would need new offer from sender
        this._setStatus('Menunggu offer baru dari pengirim...');
      }
    } catch (e) {
      console.error('Reconnect failed:', e);
      this._handleConnectionFailure();
    }
  }

  async _handleMessage(data) {
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
        if (meta.type === 'ping') {
          // Respond to keep-alive
          this.dataChannel.send(JSON.stringify({ type: 'pong' }));
          return;
        }
      } catch (e) {
        // Not JSON, treat as binary chunk
      }
    }

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

  async sendData(data) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    this._setStatus('Mengompresi data...');
    const compressed = await compressData(data);

    this._setStatus('Mengirim metadata...');
    this.dataChannel.send(JSON.stringify({ type: 'meta', size: compressed.length }));

    const chunkSize = 16384;
    let sent = 0;

    for (let i = 0; i < compressed.length; i += chunkSize) {
      // Check if channel is still open
      if (this.dataChannel.readyState !== 'open') {
        throw new Error('Channel closed during transfer');
      }

      const chunk = compressed.slice(i, i + chunkSize);
      this.dataChannel.send(chunk.buffer);
      sent += chunk.length;

      const progress = (sent / compressed.length * 100).toFixed(1);
      this._setStatus(`Mengirim... ${progress}% (${this._formatSize(sent)})`);

      await new Promise(r => setTimeout(r, 5));
    }

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
    this.autoRetry = false;
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.peerConnection = null;
    this.dataChannel = null;
  }
}