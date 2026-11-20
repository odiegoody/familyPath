/**
 * Indonesian Bank Notification Parser
 * Parses clipboard text from bank notifications (BCA, Mandiri, BRI, BNI, etc.)
 * Returns structured transaction data or null if not recognized
 */

// Common patterns for Indonesian banks
const BANK_PATTERNS = [
  // BCA: "Transfer masuk Rp 2.500.000 dari JOHN DOE ke 1234567890"
  // BCA: "Transfer keluar Rp 500.000 ke JANE SMITH dari 1234567890"
  {
    bank: "BCA",
    regex: /(?:transfer|tf)\s+(masuk|keluar)\s+rp\s+([\d.,]+)\s+(?:dari|ke)\s+([A-Z\s]+)(?:\s+(?:ke|dari)\s+\d+)?/i,
    map: (m) => ({
      type: m[1].toLowerCase() === "masuk" ? "income" : "expense",
      amount: parseAmount(m[2]),
      description: `Transfer ${m[1].toLowerCase()} dari/ke ${m[3].trim()}`,
      categoryHint: m[1].toLowerCase() === "masuk" ? "Gaji" : "Transfer",
    }),
  },
  // BCA SMS: "BCA Info: Transfer Rp2.500.000 dr JOHN DOE ke rekening 1234567890"
  {
    bank: "BCA",
    regex: /bca\s+info:\s*transfer\s+rp([\d.,]+)\s+dr\s+([A-Z\s]+)\s+ke\s+rekening/i,
    map: (m) => ({
      type: "income",
      amount: parseAmount(m[1]),
      description: `Transfer masuk dari ${m[2].trim()}`,
      categoryHint: "Gaji",
    }),
  },
  // Mandiri: "Transfer ke 1234567890 a.n. JOHN DOE sebesar Rp 500.000"
  // Mandiri: "Transfer dari 1234567890 a.n. JANE SMITH sebesar Rp 2.500.000"
  {
    bank: "Mandiri",
    regex: /transfer\s+(?:ke|dari)\s+\d+\s+a\.n\.\s+([A-Z\s]+)\s+sebesar\s+rp\s+([\d.,]+)/i,
    map: (m) => ({
      type: m[0].toLowerCase().includes("ke") ? "expense" : "income",
      amount: parseAmount(m[2]),
      description: `Transfer ${m[0].toLowerCase().includes("ke") ? "keluar" : "masuk"} ke/dari ${m[1].trim()}`,
      categoryHint: m[0].toLowerCase().includes("ke") ? "Transfer" : "Gaji",
    }),
  },
  // BRI: "BRImo: Transfer Rp 500.000 ke JOHN DOE. Ref: 123456"
  // BRI: "BRImo: Transfer Rp 2.500.000 dari JANE SMITH. Ref: 123456"
  {
    bank: "BRI",
    regex: /bri(?:mo)?:\s*transfer\s+rp\s+([\d.,]+)\s+(?:ke|dari)\s+([A-Z\s]+)/i,
    map: (m) => ({
      type: m[0].toLowerCase().includes("ke") ? "expense" : "income",
      amount: parseAmount(m[1]),
      description: `Transfer ${m[0].toLowerCase().includes("ke") ? "keluar" : "masuk"} ke/dari ${m[2].trim()}`,
      categoryHint: m[0].toLowerCase().includes("ke") ? "Transfer" : "Gaji",
    }),
  },
  // BNI: "BNIMobile: Transfer Rp 500.000 ke JOHN DOE"
  {
    bank: "BNI",
    regex: /bni(?:mobile)?:\s*transfer\s+rp\s+([\d.,]+)\s+(?:ke|dari)\s+([A-Z\s]+)/i,
    map: (m) => ({
      type: m[0].toLowerCase().includes("ke") ? "expense" : "income",
      amount: parseAmount(m[1]),
      description: `Transfer ${m[0].toLowerCase().includes("ke") ? "keluar" : "masuk"} ke/dari ${m[2].trim()}`,
      categoryHint: m[0].toLowerCase().includes("ke") ? "Transfer" : "Gaji",
    }),
  },
  // Generic: "Rp 150.000 - GOPAY/GOFOOD/GRAB/TOKOPEDIA/SHOPEE"
  {
    bank: "E-Wallet",
    regex: /rp\s+([\d.,]+)\s*[-–]\s*([A-Z]+)/i,
    map: (m) => ({
      type: "expense",
      amount: parseAmount(m[1]),
      description: `Pembayaran ${m[2]}`,
      categoryHint: mapEwalletCategory(m[2]),
    }),
  },
  // Generic top-up: "Top up Rp 500.000 ke GOPAY/OVO/DANA/SHOPEEPAY"
  {
    bank: "E-Wallet Topup",
    regex: /top\s*up\s+rp\s+([\d.,]+)\s+ke\s+([A-Z]+)/i,
    map: (m) => ({
      type: "expense", // treating as expense (cash out from bank)
      amount: parseAmount(m[1]),
      description: `Top up ${m[2]}`,
      categoryHint: "Transfer",
    }),
  },
  // Salary: "Gaji Rp 5.000.000 dari PT ABC"
  {
    bank: "Salary",
    regex: /gaji\s+rp\s+([\d.,]+)\s+dari\s+([A-Z\s.]+)/i,
    map: (m) => ({
      type: "income",
      amount: parseAmount(m[1]),
      description: `Gaji dari ${m[2].trim()}`,
      categoryHint: "Gaji",
    }),
  },
  // Interest: "Bunga Rp 50.000"
  {
    bank: "Interest",
    regex: /bunga\s+rp\s+([\d.,]+)/i,
    map: (m) => ({
      type: "income",
      amount: parseAmount(m[1]),
      description: "Bunga tabungan",
      categoryHint: "Investasi",
    }),
  },
  // Admin fee: "Biaya admin Rp 2.500"
  {
    bank: "Fee",
    regex: /biaya\s+admin\s+rp\s+([\d.,]+)/i,
    map: (m) => ({
      type: "expense",
      amount: parseAmount(m[1]),
      description: "Biaya administrasi bank",
      categoryHint: "Lainnya (Pengeluaran)",
    }),
  },
];

function parseAmount(str) {
  // Handle "2.500.000" or "2,500,000" or "2500000"
  return parseInt(str.replace(/[.,]/g, ""), 10);
}

function mapEwalletCategory(merchant) {
  const m = merchant.toUpperCase();
  if (m.includes("GOPAY") || m.includes("GOFOOD") || m.includes("GRAB")) return "Transportasi";
  if (m.includes("TOKOPEDIA") || m.includes("SHOPEE") || m.includes("LAZADA") || m.includes("BLIBLI")) return "Belanja Rumah";
  if (m.includes("OVO") || m.includes("DANA") || m.includes("SHOPEEPAY") || m.includes("LINKAJA")) return "Lainnya (Pengeluaran)";
  return "Lainnya (Pengeluaran)";
}

/**
 * Main parser function
 * @param {string} text - Clipboard text to parse
 * @returns {Object|null} Parsed transaction or null
 */
export function parseBankNotification(text) {
  if (!text || typeof text !== "string") return null;

  const cleaned = text.trim().replace(/\s+/g, " ");

  for (const pattern of BANK_PATTERNS) {
    const match = cleaned.match(pattern.regex);
    if (match) {
      try {
        const parsed = pattern.map(match);
        if (parsed.amount && parsed.amount > 0) {
          return {
            ...parsed,
            bank: pattern.bank,
            rawText: cleaned,
            confidence: 0.85, // base confidence
            detectedAt: Date.now(),
          };
        }
      } catch (e) {
        console.warn("Parse error:", e);
      }
    }
  }

  // Fallback: try to extract any amount + merchant
  const fallbackAmount = cleaned.match(/rp\s+([\d.,]+)/i);
  const fallbackMerchant = cleaned.match(/(?:di|ke|dari|pada)\s+([A-Z][a-zA-Z\s]+)/i);

  if (fallbackAmount) {
    return {
      type: "expense",
      amount: parseAmount(fallbackAmount[1]),
      description: fallbackMerchant ? `Transaksi ${fallbackMerchant[1].trim()}` : "Transaksi dari notifikasi",
      categoryHint: "Lainnya (Pengeluaran)",
      bank: "Unknown",
      rawText: cleaned,
      confidence: 0.4,
      detectedAt: Date.now(),
    };
  }

  return null;
}

/**
 * Check if text looks like a bank notification
 */
export function looksLikeBankNotification(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const keywords = [
    "transfer", "tf ", "top up", "topup", "gaji", "bunga",
    "biaya admin", "rp ", "bca", "mandiri", "bri", "bni",
    "gopay", "ovo", "dana", "shopeepay", "linkaja", "sakuku",
    "tarik tunai", "setor tunai", "pembayaran", "payment"
  ];
  return keywords.some(k => lower.includes(k));
}

/**
 * Get suggested category ID from category list
 */
export function suggestCategoryId(parsedTransaction, categories) {
  if (!parsedTransaction || !categories?.length) return null;

  const hint = parsedTransaction.categoryHint?.toLowerCase();
  if (!hint) return null;

  // Try exact match first
  let match = categories.find(c =>
    c.name.toLowerCase() === hint && c.type === parsedTransaction.type
  );
  if (match) return match.id;

  // Try partial match
  match = categories.find(c =>
    c.name.toLowerCase().includes(hint) && c.type === parsedTransaction.type
  );
  if (match) return match.id;

  // Fallback: first category of same type
  match = categories.find(c => c.type === parsedTransaction.type);
  return match?.id || null;
}