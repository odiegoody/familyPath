import Dexie from "dexie";

// FamilyPath - offline-first database (IndexedDB via Dexie)
// Semua data disimpan lokal di perangkat, tidak ada sync ke server.
export const db = new Dexie("familypath");

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

// ---- Default seed data (runs once) ----
const DEFAULT_CATEGORIES = [
  { name: "Makanan", type: "expense", icon: "utensils", color: "#c14f3d", isDefault: 1 },
  { name: "Transportasi", type: "expense", icon: "car", color: "#8a5cf6", isDefault: 1 },
  { name: "Belanja Rumah", type: "expense", icon: "shopping-cart", color: "#d97757", isDefault: 1 },
  { name: "Listrik & Air", type: "expense", icon: "zap", color: "#e0a72c", isDefault: 1 },
  { name: "Pendidikan", type: "expense", icon: "graduation-cap", color: "#3b7dd8", isDefault: 1 },
  { name: "Kesehatan", type: "expense", icon: "heart-pulse", color: "#e0527a", isDefault: 1 },
  { name: "Hiburan", type: "expense", icon: "popcorn", color: "#00b0b9", isDefault: 1 },
  { name: "Cicilan/Hutang", type: "expense", icon: "credit-card", color: "#94564a", isDefault: 1 },
  { name: "Lainnya (Pengeluaran)", type: "expense", icon: "more-horizontal", color: "#76777d", isDefault: 1 },
  { name: "Gaji", type: "income", icon: "wallet", color: "#2f8f4e", isDefault: 1 },
  { name: "Bonus", type: "income", icon: "gift", color: "#3aa863", isDefault: 1 },
  { name: "Investasi", type: "income", icon: "trending-up", color: "#1c6b37", isDefault: 1 },
  { name: "Lainnya (Pemasukan)", type: "income", icon: "more-horizontal", color: "#5a9e6f", isDefault: 1 },
];

const DEFAULT_MEMBERS = [{ name: "Keluarga" }];

export async function seedIfEmpty() {
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
  const memberCount = await db.members.count();
  if (memberCount === 0) {
    await db.members.bulkAdd(
      DEFAULT_MEMBERS.map((m) => ({ ...m, createdAt: Date.now() }))
    );
  }
}
