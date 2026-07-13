import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Wallet, Target, Landmark, CreditCard, Users, Tag, TrendingUp, DatabaseBackup } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { formatRupiah } from "../utils/format";

export default function More() {
  const navigate = useNavigate();

  const budgetCount = useLiveQuery(() => db.budgets.count(), []);
  const goalCount = useLiveQuery(() => db.goals.count(), []);
  const assetCount = useLiveQuery(() => db.assets.count(), []);
  const investmentCount = useLiveQuery(() => db.investments.count(), []);
  const liabilityCount = useLiveQuery(() => db.liabilities.count(), []);
  const categoryCount = useLiveQuery(() => db.categories.count(), []);

  const items = [
    {
      to: "/budget",
      label: "Budget",
      desc: "Atur & pantau batas pengeluaran per kategori",
      icon: Wallet,
      color: "#3b7dd8",
      count: budgetCount,
    },
    {
      to: "/goals",
      label: "Goal Tracker",
      desc: "Target tabungan keluarga",
      icon: Target,
      color: "#2f8f4e",
      count: goalCount,
    },
    {
      to: "/aset",
      label: "Aset & Liability",
      desc: "Kas, properti, kendaraan, emas — dibeli sekali, nilai diupdate",
      icon: Landmark,
      color: "#94564a",
      count: assetCount,
    },
    {
      to: "/investasi",
      label: "Investasi",
      desc: "Saham, reksadana, deposito, kripto — setoran berkala",
      icon: TrendingUp,
      color: "#1c6b37",
      count: investmentCount,
    },
    {
      to: "/hutang",
      label: "Liability & Hutang",
      desc: "Cicilan, pinjaman, kartu kredit",
      icon: CreditCard,
      color: "#c14f3d",
      count: liabilityCount,
    },
    {
      to: "/anggota",
      label: "Anggota Keluarga",
      desc: "Kelola siapa saja yang mencatat transaksi",
      icon: Users,
      color: "#505f76",
      count: null,
    },
    {
      to: "/kategori",
      label: "Kategori",
      desc: "Kelola kategori pengeluaran & pemasukan",
      icon: Tag,
      color: "#8a5cf6",
      count: categoryCount,
    },
    {
      to: "/backup",
      label: "Backup & Restore",
      desc: "Amankan semua data ke file, atau pulihkan dari backup",
      icon: DatabaseBackup,
      color: "#00b0b9",
      count: null,
    },
  ];

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header title="Lainnya" />
      <main className="mx-auto max-w-md space-y-3 px-4 pt-4">
        {items.map((item) => (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className="flex w-full items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-card"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${item.color}1a`, color: item.color }}
            >
              <item.icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-on-surface">{item.label}</p>
              <p className="truncate text-xs text-on-surface-variant">{item.desc}</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
          </button>
        ))}
      </main>
    </div>
  );
}
