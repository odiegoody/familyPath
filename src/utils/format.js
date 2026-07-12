// Format angka & tanggal ke gaya Indonesia

export function formatRupiah(value, { withSymbol = true } = {}) {
  const n = Number(value) || 0;
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  const sign = n < 0 ? "-" : "";
  return `${sign}${withSymbol ? "Rp" : ""}${formatted}`;
}

export function formatRupiahSigned(value) {
  const n = Number(value) || 0;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${formatRupiah(Math.abs(n))}`;
}

// Parse input string "1.000.000" atau "1000000" jadi number
export function parseRupiahInput(str) {
  if (typeof str === "number") return str;
  const cleaned = String(str).replace(/[^0-9]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

export function formatPercent(value, { showSign = true } = {}) {
  const n = Number(value) || 0;
  const sign = showSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

// ---- Helper untuk tracking periodik aset (bulanan/kuartalan) ----

// Hasilkan label periode dari tanggal, sesuai frekuensi tracking
export function getPeriodKey(dateInput, frequency) {
  const d = new Date(dateInput);
  const y = d.getFullYear();
  if (frequency === "quarterly") {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${y}-Q${q}`;
  }
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Ubah period key jadi label yang enak dibaca
export function getPeriodLabel(periodKey) {
  if (!periodKey) return "";
  if (periodKey.includes("Q")) {
    const [y, q] = periodKey.split("-Q");
    return `Kuartal ${q} ${y}`;
  }
  const [y, m] = periodKey.split("-").map(Number);
  return formatMonthYearID(new Date(y, m - 1, 1));
}

// Tanggal target update berikutnya, berdasarkan tanggal update terakhir & frekuensi
export function getNextDueDate(lastDate, frequency) {
  if (!lastDate || frequency === "manual") return null;
  const d = new Date(lastDate);
  if (frequency === "quarterly") {
    d.setMonth(d.getMonth() + 3);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.getTime();
}

// Apakah aset ini sudah waktunya diupdate lagi?
export function isUpdateDue(lastDate, frequency) {
  const nextDue = getNextDueDate(lastDate, frequency);
  if (!nextDue) return false;
  return Date.now() >= nextDue;
}

export function formatDateID(dateInput) {
  const d = new Date(dateInput);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(dateInput) {
  const d = new Date(dateInput);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatMonthYearID(dateInput) {
  const d = new Date(dateInput);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

// "2026-07" - dipakai sebagai key bulan untuk budget
export function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyToLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return formatMonthYearID(new Date(y, m - 1, 1));
}

export function shiftMonthKey(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
}

export function monthKeyRange(key) {
  const [y, m] = key.split("-").map(Number);
  const from = new Date(y, m - 1, 1).getTime();
  const to = new Date(y, m, 0, 23, 59, 59, 999).getTime();
  return { from, to };
}
