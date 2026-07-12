# FamilyPath — Structure & Progress Tracker

Aplikasi pencatat keuangan keluarga, offline-first (PWA), React + Vite + IndexedDB (Dexie).
Desain mengikuti referensi "WealthPath" (navy/slate/hijau/coral, font Geist + Inter).

> **Riwayat nama**: proyek ini awalnya bernama "KeluargaPath", di-rename total ke **FamilyPath** (kode, judul halaman, PWA manifest, nama database IndexedDB, nama folder/package). Kalau ada instance app lama yang sempat di-install di HP dengan nama/DB lama, datanya TIDAK otomatis pindah — karena nama database Dexie ikut berubah (`keluargapath` → `familypath`), yang secara teknis jadi IndexedDB terpisah. Ini disengaja sesuai keputusan user, dilakukan saat masih tahap development jadi belum ada data produksi yang hilang.

## Tech Stack
- React 19 + Vite 8
- Tailwind CSS 3 (token warna custom di `tailwind.config.js`, sesuai WealthPath DESIGN.md)
- Dexie (IndexedDB) — semua data lokal di HP, tanpa server/sync
- react-router-dom (HashRouter — dipilih agar routing tetap jalan saat di-load sebagai PWA/file lokal)
- vite-plugin-pwa — offline caching + installable manifest
- lucide-react — icon set
- recharts — sudah terpasang, belum dipakai (untuk grafik tren nanti)

## Status: TAHAP 1–5 SELESAI ✅ + Reorganisasi Navigasi + Kategori Custom + PWA Fix + Asset Tracking Periodik
- **Tahap 1**: Transaksi + Dashboard
- **Tahap 2**: Budget
- **Tahap 3**: Goal Tracker
- **Tahap 4**: Aset & Investasi
- **Tahap 5**: Liability & Hutang
- **+ Reorganisasi nav**: bottom nav disederhanakan jadi Dashboard/Transaksi/Lainnya + FAB
- **+ Halaman kelola Anggota Keluarga**
- **+ Kelola Kategori custom** (tambah/edit/hapus kategori transaksi sendiri)
- **+ Rename total**: KeluargaPath → **FamilyPath**
- **+ Revisi logika saldo**: setor ke goal sekarang MENGURANGI saldo, tarik dana MENAMBAH saldo
- **+ Fix PWA install di Vercel** (MIME type manifest & service worker)
- **+ Revisi Aset & Investasi jadi TRACKING periodik** (bulanan/kuartalan), bukan cuma catatan bebas

### Fix PWA install di Vercel (KEPUTUSAN TEKNIS)
Gejala: setelah deploy, "Add to Home Screen" di Android Chrome cuma bikin bookmark biasa (ada address bar), bukan install PWA standalone. Penyebab: Vercel kadang serve `manifest.webmanifest` dan `sw.js`/`registerSW.js` dengan Content-Type yang salah (bukan `application/manifest+json` / `application/javascript`), jadi Chrome gagal mem-parse manifest dan menganggap site TIDAK installable.
- **Fix di `vercel.json`**: tambah `headers` array yang eksplisit set Content-Type untuk `/manifest.webmanifest`, `/sw.js`, `/registerSW.js`
- **Fix di `index.html`**: tambah atribut `type="application/manifest+json"` di tag `<link rel="manifest">`
- Kalau masih bermasalah setelah patch ini, langkah debug selanjutnya: cek response header asli pakai `curl -I <url>/manifest.webmanifest` dari terminal, pastikan `Content-Type` sudah benar setelah redeploy

### Asset & Investasi — revisi jadi Tracking Periodik (KEPUTUSAN PENTING DARI USER)
User menegaskan: tujuan modul Aset & Investasi adalah **tracking perkembangan**, bukan sekadar pencatatan nilai bebas kapan saja. Nilai aset "seharusnya" diupdate secara rutin (bulanan/kuartalan) supaya kelihatan growth-nya dari waktu ke waktu.
- **Schema v6**: `assets` dapat field baru `trackingFrequency` (`"monthly"` / `"quarterly"` / `"manual"`, default `"monthly"`). `asset_value_updates` dapat field `period` (label periode, misal `"2026-07"` untuk bulanan atau `"2026-Q3"` untuk kuartalan) + compound index `[assetId+period]` untuk deteksi duplikat.
- Helper baru di `format.js`: `getPeriodKey()`, `getPeriodLabel()`, `getNextDueDate()`, `isUpdateDue()` — logika kapan sebuah aset "jatuh tempo" untuk diupdate berdasarkan frekuensi trackingnya.
- `AddAsset.jsx`: sekarang ada pilihan Frekuensi Tracking (Bulanan/Kuartalan/Manual) saat bikin aset baru.
- `AssetCard.jsx` & `Assets.jsx`: badge merah "Perlu update" muncul otomatis kalau aset sudah lewat jadwal tracking-nya (dihitung dari update terakhir + frekuensi).
- `AssetDetail.jsx`:
  - Banner peringatan kalau aset itu due untuk diupdate
  - **Grafik tren nilai** (line chart pakai `recharts`, baru dipakai pertama kali di app ini) — muncul otomatis kalau riwayat sudah ≥2 titik data
  - Form "Update Nilai" sekarang cek periode: kalau user mau nambah entri untuk periode yang SUDAH ada datanya (misal 2 entri di bulan yang sama untuk tracking bulanan), muncul peringatan (bukan blokir keras, cuma warning) supaya user sadar
  - Riwayat nilai menampilkan label periode + persentase perubahan antar periode (bukan cuma nominal delta seperti sebelumnya)
- **Catatan**: recharts nambah ukuran bundle JS cukup signifikan (~350KB), muncul warning "chunk size" saat build — belum masalah fungsional, tapi kalau nanti mau dioptimasi bisa pakai code-splitting/dynamic import khusus untuk halaman yang pakai chart

### File yang sudah dibuat
```
src/
  db/db.js                     -- schema Dexie v5: members, categories, transactions, budgets, goals, assets, asset_value_updates, liabilities, liability_payments + seed default
  utils/format.js               -- format Rupiah, tanggal ID, parse input angka, month key helpers, formatPercent
  utils/icons.js                -- mapping nama icon -> komponen lucide-react + GOAL_ICON_OPTIONS + ASSET_CATEGORIES + LIABILITY_CATEGORIES
  components/
    BottomNav.jsx                -- nav bawah: Dashboard / Transaksi / Lainnya / Tambah (FAB) — "Lainnya" ikut aktif kalau di /budget /goals /aset /hutang /anggota
    Header.jsx                   -- header + tombol back opsional
    BalanceCard.jsx               -- hero card saldo (dashboard)
    TransactionRow.jsx            -- baris transaksi, handle 3 tipe: expense/income/saving (goal)
    CategoryBreakdown.jsx         -- breakdown pengeluaran per kategori (bar list, dashboard)
    BudgetRow.jsx                 -- baris budget per kategori: inline edit + progress bar
    GoalCard.jsx                  -- card goal untuk list: progress bar, proyeksi nabung/bulan
    AssetCard.jsx                  -- card aset untuk list: nilai saat ini, gain/loss %
    LiabilityCard.jsx              -- card hutang untuk list: sisa hutang, progress terbayar
  pages/
    Dashboard.jsx                 -- ringkasan saldo (exclude tipe saving), breakdown kategori, transaksi terbaru
    Transactions.jsx              -- daftar transaksi lengkap, filter tipe (+saving) & anggota, grouped by date
    AddTransaction.jsx            -- form tambah/edit transaksi: expense/income (kategori) ATAU saving (goal + arah setor/tarik)
    More.jsx                      -- menu "Lainnya": link ke Budget, Goals, Aset, Liability, Anggota (dengan badge jumlah data)
    Budget.jsx                    -- set & pantau budget per kategori per bulan, month switcher, ringkasan total (showBack)
    Goals.jsx                     -- daftar goal, total tersimpan semua goal (showBack)
    AddGoal.jsx                   -- form buat/edit goal (nama, target, tanggal, icon, warna)
    GoalDetail.jsx                 -- detail goal: progress, tombol Setor/Tarik cepat, riwayat kontribusi
    Assets.jsx                    -- daftar aset dikelompokkan per kategori, total nilai & gain/loss (showBack)
    AddAsset.jsx                   -- form buat/edit aset (nama, kategori, nilai awal, jumlah/unit, tanggal beli, catatan)
    AssetDetail.jsx                 -- detail aset: nilai saat ini, gain/loss, tombol "Update Nilai", riwayat nilai
    Liabilities.jsx                -- daftar hutang, total sisa hutang keseluruhan
    AddLiability.jsx                -- form buat/edit hutang (nama, kategori, pokok, bunga opsional, jatuh tempo, catatan)
    LiabilityDetail.jsx             -- detail hutang: sisa hutang, progress terbayar, tombol "Catat Pembayaran", riwayat pembayaran
    Members.jsx                     -- kelola anggota keluarga: tambah/edit/hapus (inline edit, konfirmasi kalau member punya transaksi terkait)
    Categories.jsx                   -- daftar kategori transaksi, dikelompokkan Pengeluaran/Pemasukan
    AddCategory.jsx                  -- form buat/edit kategori (nama, jenis, icon, warna); kategori default jenisnya tidak bisa diubah; hapus diblokir kalau masih dipakai transaksi/budget
  App.jsx                        -- HashRouter + layout + seed data on load, hide nav di halaman form
  main.jsx                       -- entry point
  index.css                      -- Tailwind directives
tailwind.config.js               -- token warna & tipografi WealthPath
vite.config.js                   -- konfigurasi PWA (manifest, service worker, cache)
vercel.json                      -- SPA rewrite untuk Vercel
public/icons/                    -- icon-192.png, icon-512.png (placeholder, bisa diganti nanti)
```

### Reorganisasi Navigasi (KEPUTUSAN DARI USER)
Nav bawah tadinya 6 ikon (Dashboard/Transaksi/Budget/Goals/Aset/FAB) dan bakal makin sesak kalau Liability ditambah tab sendiri. User memilih: **bikin tab "Lainnya" berisi menu ke Budget/Goals/Aset/Liability/Anggota**, supaya nav utama tetap ramping.
- Bottom nav sekarang: Dashboard, Transaksi, Lainnya, + FAB Tambah (4 slot total)
- `More.jsx` = halaman menu/hub — list card dengan icon, deskripsi singkat, badge jumlah data
- Custom logic di `BottomNav.jsx`: tab "Lainnya" ikut ke-highlight kalau user di `/budget`, `/goals`, `/aset`, `/hutang`, atau `/anggota`
- Halaman Budget/Goals/Aset (dulu top-level tab tanpa tombol back) sekarang pakai `showBack` di Header, karena diakses lewat More

### Tahap 3 — detail fitur Goal Tracker (KEPUTUSAN DIREVISI ⚠️)
- **Tabel `goals`**: `{ id, name, icon, color, targetAmount, targetDate, createdAt }`
- **Transaksi tipe ketiga: `saving`** (selain `income`/`expense`), field tambahan: `goalId`, `direction` (`"in"` setor / `"out"` tarik)
- **KEPUTUSAN TERBARU (merevisi keputusan awal)**: transaksi tipe `saving` SEKARANG memengaruhi Saldo Keluarga — setor (`direction: "in"`) MENGURANGI saldo (uang cash pindah ke pot goal), tarik (`direction: "out"`) MENAMBAH saldo lagi (uang kembali ke cash). Ini kebalikan dari keputusan awal Tahap 3 (yang sebelumnya sengaja mengecualikan saving dari perhitungan saldo). `Dashboard.jsx` dan `Transactions.jsx` (day total) sudah diupdate untuk menghitung dampak saving ke saldo — JANGAN dikembalikan ke logika lama tanpa diskusi ulang.
- Tampilan `TransactionRow.jsx` untuk tipe saving disesuaikan: setor tampil "-Rp X" (warna netral, seperti expense), tarik tampil "+Rp X" (warna hijau, seperti income) — merepresentasikan dampak ke cash, BUKAN dampak ke progress goal (progress goal sendiri di `GoalDetail.jsx` tetap: setor = +, tarik = -, karena itu dari sudut pandang goal bukan cash)
- `AddTransaction.jsx` punya toggle 3 tipe: Pengeluaran / Pemasukan / Tabungan
- `GoalDetail.jsx` punya tombol pintasan "Setor"/"Tarik Dana" (query param `?type=saving&goal=ID&dir=in|out`)
- Proyeksi "perlu nabung Rp X/bulan" otomatis di `GoalCard.jsx` kalau ada target tanggal
- **Keputusan eksplisit user**: "Tarik Dana" TIDAK divalidasi terhadap saldo goal — boleh jadi minus. Disengaja, jangan tambah validasi tanpa diminta.

### Tahap 4 — detail fitur Aset & Investasi
- **Tabel `assets`**: `{ id, name, category, icon, color, quantity, initialValue, purchaseDate, notes, createdAt }`
- **Tabel `asset_value_updates`**: `{ id, assetId, value, date, note, createdAt }` — riwayat nilai dari waktu ke waktu
- **KEPUTUSAN DESAIN**: app offline, tidak ada feed harga live → nilai aset di-update MANUAL lewat tombol "Update Nilai". `currentValue` = entri `asset_value_updates` terbaru, fallback ke `initialValue`.
- Saat aset baru dibuat, otomatis dicatat 1 entri riwayat nilai = initialValue
- 6 kategori: Kas & Tabungan, Saham & Reksadana, Properti, Kendaraan, Emas, Lainnya

### Tahap 5 — detail fitur Liability & Hutang
- **Tabel `liabilities`**: `{ id, name, category, icon, color, principalAmount, interestRate, dueDate, notes, createdAt }`
- **Tabel `liability_payments`**: `{ id, liabilityId, amount, date, note, createdAt }` — riwayat pembayaran
- `currentBalance` = `principalAmount` - total `liability_payments` (dihitung real-time, bukan field tersimpan)
- 5 kategori: KPR/Kredit Rumah, Kredit Kendaraan, Kartu Kredit, Pinjaman Pribadi, Lainnya
- Pola UI konsisten dengan Assets/Goals: halaman detail punya tombol aksi cepat ("Catat Pembayaran"), progress bar, riwayat
- Bayar lebih dari sisa hutang → balance boleh minus ("lebih bayar"), konsisten dengan keputusan "biarkan minus" di Goal Tracker

### Yang BELUM terhubung (net worth gabungan)
Saldo Keluarga (Dashboard), Total Aset, dan Total Hutang masih **section terpisah**, belum digabung jadi satu angka "Net Worth Keluarga" (= saldo + aset - hutang). Ini kandidat kuat untuk fitur berikutnya kalau dibutuhkan.

### Fitur yang sudah jalan (ringkasan lengkap)
- Transaksi: catat/edit/hapus, 3 tipe (pengeluaran/pemasukan/tabungan-goal), kategori, multi-anggota, filter & grouping by date
- Dashboard: saldo keluarga, ringkasan bulan berjalan, breakdown kategori, transaksi terbaru
- Budget: per kategori per bulan, progress bar, warna merah kalau over budget
- Goal Tracker: target tabungan, setor/tarik, proyeksi nabung/bulan
- Aset & Investasi: 6 kategori, update nilai manual, riwayat & gain/loss
- Liability & Hutang: 5 kategori, catat pembayaran, progress terbayar
- Anggota Keluarga: tambah/edit/hapus
- Offline penuh: IndexedDB, PWA installable, service worker cache semua asset
- Seed data otomatis: 13 kategori transaksi default, 1 member default "Keluarga"

### Kategori Custom — detail fitur
- Pakai tabel `categories` yang sudah ada sejak Tahap 1 (tidak perlu migrasi schema baru)
- Kategori default (`isDefault: 1`) jenisnya (expense/income) TIDAK bisa diubah lewat form edit (supaya tidak merusak asumsi seed data), tapi nama/icon/warna tetap bisa diedit
- Kategori baru yang dibuat user otomatis `isDefault: 0`
- Hapus kategori diblokir (pakai `alert`, bukan langsung dihapus) kalau kategori itu masih dipakai di transaksi ATAU budget manapun — user harus beresin dulu data yang terkait
- Icon & warna dipilih dari daftar kurasi (`CATEGORY_ICON_OPTIONS`, `CATEGORY_COLOR_OPTIONS` di `icons.js`), bukan bebas pilih semua icon lucide-react

## Belum dikerjakan (kandidat tahap selanjutnya)
- [ ] Net worth gabungan: Saldo Keluarga + Total Aset - Total Liability
- [ ] Grafik tren untuk area lain (budget/goal), recharts sudah dipakai di Assets, bisa direplikasi
- [ ] Notifikasi/peringatan proaktif saat mendekati/melebihi budget (saat ini baru visual)
- [ ] Export/import data (backup manual, karena tidak ada server sync) — PENTING karena semua data cuma di 1 device
- [ ] Laporan bulanan otomatis (ringkasan yang bisa di-share/print)
- [ ] Optimasi bundle size (code-splitting recharts) kalau performa jadi masalah

## Cara Deploy
1. Push folder ini ke GitHub repo (`odiegoody/keluargapath` misalnya)
2. Import project di Vercel → auto-detect Vite → deploy
3. Buka di HP → "Add to Home Screen" → jadi app offline

## Catatan penting untuk sesi berikutnya
- Semua warna/style HARUS pakai token di `tailwind.config.js` (jangan hardcode hex baru) supaya konsisten dengan desain WealthPath
- HashRouter dipakai (bukan BrowserRouter) supaya routing aman untuk PWA/static hosting tanpa server-side rewrite tambahan (vercel.json tetap disertakan sebagai jaga-jaga)
- Setiap nambah field/tabel baru di `db.js`, WAJIB tetap sertakan definisi versi-versi sebelumnya (Dexie butuh rantai migrasi lengkap v1→v2→v3→dst), jangan cuma tambah versi terbaru dan hapus yang lama
- Pola konsisten yang dipakai di Goals/Assets/Liabilities: tabel utama + tabel riwayat terpisah (kontribusi/update nilai/pembayaran), currentValue/balance dihitung real-time dari riwayat, bukan disimpan sebagai field statis
