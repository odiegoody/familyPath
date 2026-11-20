# PWA Features - Requirements & Testing Guide

## 📱 Fitur PWA yang Diimplementasikan

### 1. Web Share Target (`/tambah`)
**File:** `vite.config.js` → `manifest.share_target`

**Cara kerja:**
- User di app banking (BCA, Mandiri, dll) → pilih transaksi → **Share** → pilih **FamilyPath**
- App terbuka di `/tambah?amount=50000&description=Gopay&source=BCA`
- Form terisi otomatis

**Syarat wajib:**
- ✅ App sudah di-install sebagai PWA (Add to Home Screen)
- ✅ Diakses via HTTPS (atau `localhost`)
- ✅ Browser support: Chrome 71+, Edge 79+, Safari 15.4+

**Test manual:**
1. Buka `http://localhost:5173` di Chrome desktop
2. DevTools → Application → Manifest → cek `share_target` ada
3. Install PWA: Chrome menu → "Install FamilyPath"
4. Buka app terinstall → test share dari app lain

---

### 2. Clipboard Auto-Detect (AddTransaction page)
**File:** `src/pages/AddTransaction.jsx` + `src/utils/clipboardParser.js`

**Cara kerja:**
- User copy notifikasi bank (long-press → Copy)
- Buka FamilyPath → tab **Tambah** (+)
- Banner muncul: "Transaksi terdeteksi dari clipboard"
- Klik **Gunakan** → form terisi otomatis

**Syarat wajib:**
- ✅ HTTPS (atau `localhost`) - Clipboard API butuh secure context
- ✅ User grant permission: browser minta izin "Read clipboard" saat pertama kali
- ✅ Browser support: Chrome 66+, Firefox 63+, Safari 13.1+

**Test manual:**
1. Copy teks: `Transfer masuk Rp 2.500.000 dari JOHN DOE`
2. Buka `http://localhost:5173/tambah`
3. Banner harus muncul otomatis dalam 1-2 detik
4. Atau klik tombol **📋 Paste** di field Deskripsi

**Troubleshooting:**
- Permission denied → cek Site Settings → Clipboard → Allow
- Tidak muncul → cek console log untuk debug parser
- Format tidak dikenali → tambah regex di `clipboardParser.js:BANK_PATTERNS`

---

### 3. Manual Paste Button
**Lokasi:** Field Deskripsi di halaman Tambah Transaksi

**Fungsi:** Fallback kalau auto-detect tidak jalan
- Klik 📋 Paste → baca clipboard → parse → banner atau paste teks mentah

---

## 🛠️ Development vs Production

| Fitur | Dev (`localhost:5173`) | Production (HTTPS) |
|-------|------------------------|-------------------|
| Share Target | ⚠️ Butuh install PWA dulu | ✅ Work penuh |
| Clipboard API | ✅ Work (localhost = secure) | ✅ Work |
| Service Worker | ✅ Work | ✅ Work |
| Install Prompt | ✅ Work | ✅ Work |

---

## 🔧 Testing Checklist

### Share Target
- [ ] `vite build` → `vite preview` → test di HTTPS local
- [ ] Install PWA di Android Chrome → test share dari app banking
- [ ] Test parameter: `amount`, `description`, `source`

### Clipboard Parser
- [ ] Test format BCA: `Transfer masuk Rp 2.500.000 dari JOHN DOE`
- [ ] Test format Mandiri: `Transfer ke 123456 a.n. JANE sebesar Rp 500.000`
- [ ] Test format BRI: `BRImo: Transfer Rp 500.000 ke TOKOPEDIA`
- [ ] Test format E-Wallet: `Rp 150.000 - GOPAY`
- [ ] Test fallback: teks acak → paste ke deskripsi

### Daily Limit Category Settings
- [ ] Buka More → Pengaturan Limit Harian
- [ ] Toggle kategori on/off
- [ ] Cek Dashboard → Limit Harian Aman berubah
- [ ] Mode "Semua" vs "Custom"

---

## 📝 Menambah Bank Baru ke Parser

Edit `src/utils/clipboardParser.js`:

```javascript
// Tambah ke BANK_PATTERNS array:
{
  bank: "CIMB",
  regex: /cimb\s*:\s*transfer\s+rp\s+([\d.,]+)\s+(?:ke|dari)\s+([A-Z\s]+)/i,
  map: (m) => ({
    type: m[0].toLowerCase().includes("ke") ? "expense" : "income",
    amount: parseAmount(m[1]),
    description: `Transfer ${m[0].toLowerCase().includes("ke") ? "keluar" : "masuk"} ke/dari ${m[2].trim()}`,
    categoryHint: m[0].toLowerCase().includes("ke") ? "Transfer" : "Gaji",
  }),
},
```

Test: copy notifikasi CIMB → buka Tambah → cek banner.

---

## 🚀 Deploy ke Production

1. **Build:** `npm run build` → output di folder `dist/`
2. **Deploy** ke Netlify/Vercel/Firebase Hosting (harus HTTPS)
3. **Test PWA:**
   - Lighthouse → PWA audit → 100%
   - Install di mobile → test share target
   - Test clipboard di mobile browser

---

## ⚠️ Known Limitations

1. **Share Target** tidak work di:
   - Browser in-app (WebView Instagram, WhatsApp, dll)
   - iOS Safari < 15.4
   - Belum install PWA

2. **Clipboard API** tidak work di:
   - HTTP (non-localhost)
   - Background tab
   - User deny permission

3. **Parser** hanya support bahasa Indonesia format standar bank. Format custom/abnormal mungkin butuh regex tambahan.

---

## 📞 Debug Tips

```javascript
// Di console browser:
// Test parser manual
import { parseBankNotification, looksLikeBankNotification } from './src/utils/clipboardParser.js'
parseBankNotification("Transfer masuk Rp 2.500.000 dari JOHN DOE")

// Test share target URL
// Buka: /tambah?amount=50000&description=Test&source=Manual

// Test daily limit settings
localStorage.getItem('familypath_daily_limit_categories')
// Output: "all" atau '["cat-id-1","cat-id-2"]'
```