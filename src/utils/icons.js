import {
  Utensils,
  Car,
  ShoppingCart,
  Zap,
  GraduationCap,
  HeartPulse,
  Popcorn,
  CreditCard,
  MoreHorizontal,
  Wallet,
  Gift,
  TrendingUp,
  TrendingDown,
  Tag,
  PiggyBank,
  Target,
  Plane,
  Home,
  ShieldCheck,
  Baby,
  Smartphone,
  Landmark,
  Coins,
  Building2,
  Banknote,
  Coffee,
  Book,
  Dumbbell,
  Shirt,
  PawPrint,
  Music,
  Gamepad2,
  Stethoscope,
  Fuel,
  Droplet,
} from "lucide-react";

export const ICON_MAP = {
  utensils: Utensils,
  car: Car,
  "shopping-cart": ShoppingCart,
  zap: Zap,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  popcorn: Popcorn,
  "credit-card": CreditCard,
  "more-horizontal": MoreHorizontal,
  wallet: Wallet,
  gift: Gift,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "piggy-bank": PiggyBank,
  target: Target,
  plane: Plane,
  home: Home,
  "shield-check": ShieldCheck,
  baby: Baby,
  smartphone: Smartphone,
  landmark: Landmark,
  coins: Coins,
  "building-2": Building2,
  banknote: Banknote,
  coffee: Coffee,
  book: Book,
  dumbbell: Dumbbell,
  shirt: Shirt,
  "paw-print": PawPrint,
  music: Music,
  gamepad: Gamepad2,
  stethoscope: Stethoscope,
  fuel: Fuel,
  droplet: Droplet,
};

export const GOAL_ICON_OPTIONS = [
  "piggy-bank",
  "home",
  "car",
  "plane",
  "graduation-cap",
  "shield-check",
  "baby",
  "smartphone",
  "target",
];

// Kategori aset — dipakai di form tambah aset & filter
export const ASSET_CATEGORIES = [
  { key: "cash", label: "Kas & Tabungan", icon: "wallet", color: "#2f8f4e" },
  { key: "stocks", label: "Saham & Reksadana", icon: "trending-up", color: "#3b7dd8" },
  { key: "property", label: "Properti", icon: "home", color: "#94564a" },
  { key: "vehicle", label: "Kendaraan", icon: "car", color: "#8a5cf6" },
  { key: "gold", label: "Emas & Logam Mulia", icon: "coins", color: "#e0a72c" },
  { key: "other", label: "Lainnya", icon: "landmark", color: "#505f76" },
];

// Kategori investasi — MODUL TERPISAH dari Aset (keputusan user).
// Beda dengan Aset: instrumen ini dibeli/disetor SECARA BERKALA (kontribusi berulang),
// jadi cost basis dihitung kumulatif dari total kontribusi, bukan nilai beli sekali di awal.
export const INVESTMENT_CATEGORIES = [
  { key: "stocks", label: "Saham", icon: "trending-up", color: "#3b7dd8" },
  { key: "mutual_fund", label: "Reksadana", icon: "landmark", color: "#1c6b37" },
  { key: "deposito", label: "Deposito", icon: "banknote", color: "#e0a72c" },
  { key: "crypto", label: "Kripto", icon: "coins", color: "#8a5cf6" },
  { key: "other", label: "Lainnya", icon: "more-horizontal", color: "#505f76" },
];

// Frekuensi tracking nilai aset — seberapa sering nilainya "seharusnya" diupdate
export const ASSET_TRACKING_FREQUENCIES = [
  { key: "monthly", label: "Bulanan" },
  { key: "quarterly", label: "Kuartalan" },
  { key: "manual", label: "Manual (kapan saja)" },
];

// Kategori liability/hutang — dipakai di form tambah hutang & filter
export const LIABILITY_CATEGORIES = [
  { key: "mortgage", label: "KPR / Kredit Rumah", icon: "home", color: "#c14f3d" },
  { key: "vehicle_loan", label: "Kredit Kendaraan", icon: "car", color: "#8a5cf6" },
  { key: "credit_card", label: "Kartu Kredit", icon: "credit-card", color: "#e0527a" },
  { key: "personal_loan", label: "Pinjaman Pribadi", icon: "banknote", color: "#e0a72c" },
  { key: "other", label: "Lainnya", icon: "landmark", color: "#505f76" },
];

// Pilihan icon untuk kategori transaksi custom (tambah/edit kategori)
export const CATEGORY_ICON_OPTIONS = [
  "utensils",
  "coffee",
  "car",
  "fuel",
  "shopping-cart",
  "home",
  "zap",
  "droplet",
  "graduation-cap",
  "book",
  "heart-pulse",
  "stethoscope",
  "dumbbell",
  "popcorn",
  "gamepad",
  "music",
  "shirt",
  "paw-print",
  "credit-card",
  "wallet",
  "gift",
  "trending-up",
  "plane",
  "smartphone",
  "piggy-bank",
  "more-horizontal",
];

// Palet warna untuk kategori custom
export const CATEGORY_COLOR_OPTIONS = [
  "#c14f3d",
  "#3b7dd8",
  "#2f8f4e",
  "#8a5cf6",
  "#e0527a",
  "#00b0b9",
  "#e0a72c",
  "#94564a",
  "#505f76",
  "#d97757",
];

export function getIcon(name) {
  return ICON_MAP[name] || Tag;
}
