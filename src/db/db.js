import Dexie from "dexie";

// FamilyPath - offline-first database (IndexedDB via Dexie)
// Semua data disimpan lokal di perangkat, tidak ada sync ke server.
export const db = new Dexie("familypath");

// ---- Sinkronisasi antar-device (Tahap 9) ----
// Karena app 100% offline, sinkronisasi dilakukan manual lewat Export/Import (lihat pages/Backup.jsx).
// Supaya data dari device berbeda bisa digabung (merge) tanpa bentrok atau duplikat, setiap row di
// tabel-tabel utama punya 3 field tambahan:
//   - uuid: identitas unik GLOBAL (bukan cuma per-device), dipakai sebagai kunci saat merge.
//           id (++id) tetap dipakai sebagai primary key LOKAL Dexie seperti sebelumnya — tidak diganti,
//           supaya semua kode existing yang pakai .update(id, ...) / .delete(id) tetap jalan tanpa ubah.
//   - updatedAt: timestamp terakhir row ini diubah. Dipakai untuk resolusi "last-write-wins" saat merge:
//           kalau uuid yang sama sudah ada di device tujuan, yang updatedAt lebih baru yang menang.
//   - deleted: soft-delete flag (0/1). Penghapusan tidak langsung hapus row secara permanen, supaya
//           informasi "ini sudah dihapus" ikut ter-merge ke device lain juga (bukan cuma insert yang sync).
//
// deviceId: dibuat sekali per device, disimpan di localStorage (BUKAN di IndexedDB, supaya tetap ada
// walau database di-reset), dipakai untuk menandai row ini dibuat/diubah oleh device mana.
const DEVICE_ID_KEY = "familypath_device_id";
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function newUuid() {
  return crypto.randomUUID();
}

// Helper untuk dipakai di semua pages saat .add(...): melengkapi row baru dengan field sync.
// Pemakaian: db.transactions.add(withSync({ type, amount, categoryId, ... }))
export function withSync(row) {
  return {
    ...row,
    uuid: row.uuid || newUuid(),
    updatedAt: Date.now(),
    deleted: 0,
  };
}

// Helper untuk dipakai saat .update(id, ...): otomatis mem-bump updatedAt supaya perubahan ini
// "menang" saat di-merge ke device lain nanti.
export function withUpdatedAt(changes) {
  return { ...changes, updatedAt: Date.now() };
}

// ---- Soft-delete (Tahap 10, lanjutan sinkronisasi) ----
// Sebelumnya semua "hapus" di app ini pakai db.tabel.delete(id) — hapus PERMANEN dari device ini.
// Masalahnya: penghapusan itu tidak pernah ter-export/ter-merge, jadi kalau row itu dihapus di HP A
// tapi masih ada di HP B, saat HP B export lalu HP A "Gabungkan Data", row yang tadi dihapus akan
// muncul lagi di HP A (karena bagi HP B, row itu memang masih ada & valid).
//
// Solusinya: hapus = update row jadi deleted:1 (bukan benar-benar dibuang dari IndexedDB). Field
// deleted ini ikut ter-export dan ter-merge seperti field lain, jadi penghapusan ikut nyebar ke
// device lain lewat mekanisme last-write-wins yang sama seperti perubahan data biasa.
// Konsekuensinya: SEMUA query yang menampilkan daftar row (useLiveQuery) HARUS ikut filter
// baris yang deleted:1, supaya data yang "dihapus" tidak muncul lagi di UI meski masih ada di DB.
//
// softDelete(table, id): untuk hapus SATU row.
export async function softDelete(table, id) {
  await db[table].update(id, { deleted: 1, updatedAt: Date.now() });
}

// softDeleteWhere(table, indexName, value): untuk hapus BANYAK row sekaligus (misal semua
// liability_payments milik satu liabilityId yang dihapus). Pakai Dexie .modify() supaya semua
// row yang cocok di-update bareng, bukan dihapus fisik.
export async function softDeleteWhere(table, indexName, value) {
  const now = Date.now();
  await db[table]
    .where(indexName)
    .equals(value)
    .modify({ deleted: 1, updatedAt: now });
}

// notDeleted(row): dipakai di dalam .filter()/.and() pada query, untuk menyaring row yang sudah
// di-soft-delete supaya tidak ikut ditampilkan.
export function notDeleted(row) {
  return !row.deleted;
}

db.version(1).stores({
  // ++id = auto increment primary key
  members: "++id, name, createdAt",
  categories: "++id, name, type, icon, color, isDefault",
  transactions: "++id, type, amount, categoryId, memberId, date, createdAt",
});

// v2: tambah tabel budgets (Tahap 2)
db.version(2).stores({
  members: "++id, name, createdAt",
  categories: "++id, name, type, icon, color, isDefault",
  transactions: "++id, type, amount, categoryId, memberId, date, createdAt",
  budgets: "++id, categoryId, month, amount, [categoryId+month]",
});

// v3: tambah tabel goals (Tahap 3) + field goalId & direction pada transactions
// transaksi tipe "saving" tercatat di riwayat TAPI tidak memengaruhi Saldo Keluarga
// direction: "in" (setor) menambah progress goal, "out" (tarik) mengurangi progress goal
db.version(3).stores({
  members: "++id, name, createdAt",
  categories: "++id, name, type, icon, color, isDefault",
  transactions: "++id, type, amount, categoryId, memberId, date, createdAt, goalId, direction",
  budgets: "++id, categoryId, month, amount, [categoryId+month]",
  goals: "++id, name, icon, color, targetAmount, targetDate, createdAt",
});

// v4: tambah tabel assets & asset_value_updates (Tahap 4)
// Nilai aset dicatat manual (snapshot per tanggal), bukan live price feed, karena app offline.
// currentValue suatu aset = nilai dari asset_value_updates terakhir (by date), fallback ke initialValue kalau belum pernah diupdate.
db.version(4).stores({
  members: "++id, name, createdAt",
  categories: "++id, name, type, icon, color, isDefault",
  transactions: "++id, type, amount, categoryId, memberId, date, createdAt, goalId, direction",
  budgets: "++id, categoryId, month, amount, [categoryId+month]",
  goals: "++id, name, icon, color, targetAmount, targetDate, createdAt",
  assets: "++id, name, category, icon, color, quantity, initialValue, purchaseDate, notes, createdAt",
  asset_value_updates: "++id, assetId, value, date, note, createdAt",
});

// v5: tambah tabel liabilities & liability_payments (Tahap 5)
// currentBalance suatu liability = principalAmount - total pembayaran (liability_payments)
db.version(5).stores({
  members: "++id, name, createdAt",
  categories: "++id, name, type, icon, color, isDefault",
  transactions: "++id, type, amount, categoryId, memberId, date, createdAt, goalId, direction",
  budgets: "++id, categoryId, month, amount, [categoryId+month]",
  goals: "++id, name, icon, color, targetAmount, targetDate, createdAt",
  assets: "++id, name, category, icon, color, quantity, initialValue, purchaseDate, notes, createdAt",
  asset_value_updates: "++id, assetId, value, date, note, createdAt",
  liabilities:
    "++id, name, category, icon, color, principalAmount, interestRate, dueDate, notes, createdAt",
  liability_payments: "++id, liabilityId, amount, date, note, createdAt",
});

// v6: aset & investasi jadi TRACKING periodik, bukan cuma catatan bebas (revisi Tahap 4)
// trackingFrequency menentukan seberapa sering nilai aset "seharusnya" diupdate (bulanan/kuartalan/manual)
// period pada asset_value_updates = label periode ("2026-07" untuk bulanan, "2026-Q3" untuk kuartalan) agar mudah dicek duplikat & dibuat grafik tren
db.version(6).stores({
  members: "++id, name, createdAt",
  categories: "++id, name, type, icon, color, isDefault",
  transactions: "++id, type, amount, categoryId, memberId, date, createdAt, goalId, direction",
  budgets: "++id, categoryId, month, amount, [categoryId+month]",
  goals: "++id, name, icon, color, targetAmount, targetDate, createdAt",
  assets:
    "++id, name, category, icon, color, quantity, initialValue, purchaseDate, notes, createdAt, trackingFrequency",
  asset_value_updates: "++id, assetId, value, date, note, createdAt, period, [assetId+period]",
  liabilities:
    "++id, name, category, icon, color, principalAmount, interestRate, dueDate, notes, createdAt",
  liability_payments: "++id, liabilityId, amount, date, note, createdAt",
});

// v7: PEMISAHAN Aset vs Investasi (KEPUTUSAN USER) — Investasi jadi modul TERSENDIRI, terpisah dari Aset.
// Beda logika dengan Aset: Aset dibeli SEKALI lalu nilainya diupdate (currentValue = update terakhir, fallback initialValue).
// Investasi dibeli SECARA BERKALA (kontribusi berulang, misal setor reksadana tiap bulan) dan dihitung KUMULATIF sebagai cost basis:
//   totalContributed = SUM(investment_contributions.amount) untuk investasi tsb.
// Nilai sekarang tetap bisa diupdate manual per investasi (investment_value_updates), terpisah dari histori kontribusi.
//   currentValue = investment_value_updates terakhir (by date), fallback ke totalContributed kalau belum pernah diupdate.
// Data assets/asset_value_updates LAMA tidak dimigrasi — tetap di tabel assets seperti sebelumnya (keputusan user).
db.version(7).stores({
  members: "++id, name, createdAt",
  categories: "++id, name, type, icon, color, isDefault",
  transactions: "++id, type, amount, categoryId, memberId, date, createdAt, goalId, direction",
  budgets: "++id, categoryId, month, amount, [categoryId+month]",
  goals: "++id, name, icon, color, targetAmount, targetDate, createdAt",
  assets:
    "++id, name, category, icon, color, quantity, initialValue, purchaseDate, notes, createdAt, trackingFrequency",
  asset_value_updates: "++id, assetId, value, date, note, createdAt, period, [assetId+period]",
  liabilities:
    "++id, name, category, icon, color, principalAmount, interestRate, dueDate, notes, createdAt",
  liability_payments: "++id, liabilityId, amount, date, note, createdAt",
  investments: "++id, name, category, icon, color, notes, createdAt",
  investment_contributions: "++id, investmentId, amount, date, note, createdAt",
  investment_value_updates: "++id, investmentId, value, date, note, createdAt",
});

// v8: tambah tabel investment_targets — target investasi dengan proyeksi Future Value,
// bisa diset user (modal awal, setoran bulanan, target return %/tahun, durasi tahun),
// dibandingkan dengan realisasi aktual (total investment_value_updates) dalam grafik garis.
db.version(8).stores({
  members: "++id, name, createdAt",
  categories: "++id, name, type, icon, color, isDefault",
  transactions: "++id, type, amount, categoryId, memberId, date, createdAt, goalId, direction",
  budgets: "++id, categoryId, month, amount, [categoryId+month]",
  goals: "++id, name, icon, color, targetAmount, targetDate, createdAt",
  assets:
    "++id, name, category, icon, color, quantity, initialValue, purchaseDate, notes, createdAt, trackingFrequency",
  asset_value_updates: "++id, assetId, value, date, note, createdAt, period, [assetId+period]",
  liabilities:
    "++id, name, category, icon, color, principalAmount, interestRate, dueDate, notes, createdAt",
  liability_payments: "++id, liabilityId, amount, date, note, createdAt",
  investments: "++id, name, category, icon, color, notes, createdAt",
  investment_contributions: "++id, investmentId, amount, date, note, createdAt",
  investment_value_updates: "++id, investmentId, value, date, note, createdAt",
  investment_targets:
    "++id, name, startDate, initialAmount, monthlyContribution, annualReturnRate, years, createdAt",
});

// v9: tambah field sinkronisasi (uuid, updatedAt, deleted) ke semua tabel utama, supaya data dari
// device berbeda (misal HP suami & HP istri) bisa digabung lewat Export/Import di halaman Backup,
// tanpa ID lokal (++id) saling bentrok atau data terduplikasi saat di-merge.
// uuid ditambahkan sebagai INDEX (bukan primary key) — primary key tetap ++id seperti sebelumnya,
// supaya semua kode lama yang pakai .update(id,...) / .delete(id) tidak perlu diubah.
db.version(9)
  .stores({
    members: "++id, uuid, name, createdAt, updatedAt, deleted",
    categories: "++id, uuid, name, type, icon, color, isDefault, updatedAt, deleted",
    transactions:
      "++id, uuid, type, amount, categoryId, memberId, date, createdAt, goalId, direction, updatedAt, deleted",
    budgets: "++id, uuid, categoryId, month, amount, [categoryId+month], updatedAt, deleted",
    goals: "++id, uuid, name, icon, color, targetAmount, targetDate, createdAt, updatedAt, deleted",
    assets:
      "++id, uuid, name, category, icon, color, quantity, initialValue, purchaseDate, notes, createdAt, trackingFrequency, updatedAt, deleted",
    asset_value_updates:
      "++id, uuid, assetId, value, date, note, createdAt, period, [assetId+period], updatedAt, deleted",
    liabilities:
      "++id, uuid, name, category, icon, color, principalAmount, interestRate, dueDate, notes, createdAt, updatedAt, deleted",
    liability_payments: "++id, uuid, liabilityId, amount, date, note, createdAt, updatedAt, deleted",
    investments: "++id, uuid, name, category, icon, color, notes, createdAt, updatedAt, deleted",
    investment_contributions: "++id, uuid, investmentId, amount, date, note, createdAt, updatedAt, deleted",
    investment_value_updates: "++id, uuid, investmentId, value, date, note, createdAt, updatedAt, deleted",
    investment_targets:
      "++id, uuid, name, startDate, initialAmount, monthlyContribution, annualReturnRate, years, createdAt, updatedAt, deleted",
  })
  .upgrade(async (tx) => {
    // Backfill: semua row LAMA (dibuat sebelum v9) belum punya uuid/updatedAt/deleted.
    // Kasih nilai default supaya langsung siap dipakai untuk merge, tanpa perlu migrasi manual lagi.
    //
    // Kategori bawaan (isDefault=1) DIKECUALIKAN dari uuid random: mereka dapat uuid DETERMINISTIK
    // yang sama persis dengan yang dipakai seedIfEmpty() untuk install baru. Ini supaya HP yang sudah
    // lama pakai app ini (data di-migrasi lewat sini) dan HP yang baru install (di-seed lewat
    // seedIfEmpty) sama-sama punya uuid identik untuk "Makanan", "Transportasi", dst — kalau tidak,
    // saat merge nanti kategori bawaan akan terduplikasi.
    const DEFAULT_CATEGORY_KEYS = {
      Makanan: "makanan",
      Transportasi: "transportasi",
      "Belanja Rumah": "belanja-rumah",
      "Listrik & Air": "listrik-air",
      Pendidikan: "pendidikan",
      Kesehatan: "kesehatan",
      Hiburan: "hiburan",
      "Cicilan/Hutang": "cicilan-hutang",
      "Lainnya (Pengeluaran)": "lainnya-pengeluaran",
      Gaji: "gaji",
      Bonus: "bonus",
      Investasi: "investasi",
      "Lainnya (Pemasukan)": "lainnya-pemasukan",
    };

    await tx
      .table("categories")
      .toCollection()
      .modify((row) => {
        if (!row.uuid) {
          row.uuid =
            row.isDefault && DEFAULT_CATEGORY_KEYS[row.name]
              ? `default-category-${DEFAULT_CATEGORY_KEYS[row.name]}`
              : crypto.randomUUID();
        }
        if (!row.updatedAt) row.updatedAt = row.createdAt || Date.now();
        if (row.deleted === undefined) row.deleted = 0;
      });

    await tx
      .table("members")
      .toCollection()
      .modify((row) => {
        // Member default "Keluarga" (dibuat lewat seed, bukan ditambah manual) juga disamakan uuid-nya.
        if (!row.uuid) {
          row.uuid = row.name === "Keluarga" ? "default-member-keluarga" : crypto.randomUUID();
        }
        if (!row.updatedAt) row.updatedAt = row.createdAt || Date.now();
        if (row.deleted === undefined) row.deleted = 0;
      });

    const otherTables = [
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
    for (const name of otherTables) {
      await tx
        .table(name)
        .toCollection()
        .modify((row) => {
          if (!row.uuid) row.uuid = crypto.randomUUID();
          if (!row.updatedAt) row.updatedAt = row.createdAt || Date.now();
          if (row.deleted === undefined) row.deleted = 0;
        });
    }
  });

// ---- Default seed data (runs once) ----
// PENTING untuk merge antar-device: kategori & member default ini di-seed SECARA INDEPENDEN di tiap
// device (setiap HP baru install app akan menjalankan seedIfEmpty sendiri-sendiri). Kalau uuid-nya
// dibuat random seperti row lain, "Makanan" di HP suami dan "Makanan" di HP istri akan punya uuid
// BEDA meski sebenarnya kategori yang sama secara konsep — akibatnya saat merge nanti, kategori
// default akan terduplikasi (jadi 2x "Makanan", 2x "Transportasi", dst).
// Makanya uuid default ini dibuat DETERMINISTIK (fixed string, sama di semua device), bukan random.
function defaultUuid(key) {
  return `default-${key}`;
}

const DEFAULT_CATEGORIES = [
  { key: "makanan", name: "Makanan", type: "expense", icon: "utensils", color: "#c14f3d", isDefault: 1 },
  { key: "transportasi", name: "Transportasi", type: "expense", icon: "car", color: "#8a5cf6", isDefault: 1 },
  { key: "belanja-rumah", name: "Belanja Rumah", type: "expense", icon: "shopping-cart", color: "#d97757", isDefault: 1 },
  { key: "listrik-air", name: "Listrik & Air", type: "expense", icon: "zap", color: "#e0a72c", isDefault: 1 },
  { key: "pendidikan", name: "Pendidikan", type: "expense", icon: "graduation-cap", color: "#3b7dd8", isDefault: 1 },
  { key: "kesehatan", name: "Kesehatan", type: "expense", icon: "heart-pulse", color: "#e0527a", isDefault: 1 },
  { key: "hiburan", name: "Hiburan", type: "expense", icon: "popcorn", color: "#00b0b9", isDefault: 1 },
  { key: "cicilan-hutang", name: "Cicilan/Hutang", type: "expense", icon: "credit-card", color: "#94564a", isDefault: 1 },
  { key: "lainnya-pengeluaran", name: "Lainnya (Pengeluaran)", type: "expense", icon: "more-horizontal", color: "#76777d", isDefault: 1 },
  { key: "gaji", name: "Gaji", type: "income", icon: "wallet", color: "#2f8f4e", isDefault: 1 },
  { key: "bonus", name: "Bonus", type: "income", icon: "gift", color: "#3aa863", isDefault: 1 },
  { key: "investasi", name: "Investasi", type: "income", icon: "trending-up", color: "#1c6b37", isDefault: 1 },
  { key: "lainnya-pemasukan", name: "Lainnya (Pemasukan)", type: "income", icon: "more-horizontal", color: "#5a9e6f", isDefault: 1 },
];

const DEFAULT_MEMBERS = [{ key: "keluarga", name: "Keluarga" }];

export async function seedIfEmpty() {
  // Hitung cuma row yang masih aktif (belum di-soft-delete) — kalau tidak, app baru install yang
  // sedang restore backup lama (yang seluruh kategori defaultnya kebetulan pernah dihapus) akan
  // salah kira "sudah ada data" dan gagal seed ulang.
  const catCount = (await db.categories.toArray()).filter((c) => !c.deleted).length;
  if (catCount === 0) {
    const now = Date.now();
    await db.categories.bulkAdd(
      DEFAULT_CATEGORIES.map(({ key, ...c }) => ({
        ...c,
        uuid: defaultUuid(`category-${key}`),
        updatedAt: now,
        deleted: 0,
      }))
    );
  }
  const memberCount = (await db.members.toArray()).filter((m) => !m.deleted).length;
  if (memberCount === 0) {
    const now = Date.now();
    await db.members.bulkAdd(
      DEFAULT_MEMBERS.map(({ key, ...m }) => ({
        ...m,
        uuid: defaultUuid(`member-${key}`),
        createdAt: now,
        updatedAt: now,
        deleted: 0,
      }))
    );
  }
}
