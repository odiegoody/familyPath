import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Wallet, Target, Landmark, CreditCard, Users, Tag, TrendingUp, DatabaseBackup, Settings, Target as TargetIcon, Bell, Wifi, Smartphone } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { formatRupiah } from "../utils/format";
import DailyLimitCategorySettings from "../components/DailyLimitCategorySettings";
import NotificationSettings from "../components/NotificationSettings";
import P2PSyncPage from "../components/P2PSyncPage";

export default function More() {
  const navigate = useNavigate();
  const [showDailyLimitSettings, setShowDailyLimitSettings] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showP2PSync, setShowP2PSync] = useState(false);

  const budgetCount = useLiveQuery(
    async () => (await db.budgets.toArray()).filter((b) => !b.deleted).length,
    []
  );
  const goalCount = useLiveQuery(
    async () => (await db.goals.toArray()).filter((g) => !g.deleted).length,
    []
  );
  const assetCount = useLiveQuery(
    async () => (await db.assets.toArray()).filter((a) => !a.deleted).length,
    []
  );
  const investmentCount = useLiveQuery(
    async () => (await db.investments.toArray()).filter((i) => !i.deleted).length,
    []
  );
  const liabilityCount = useLiveQuery(
    async () => (await db.liabilities.toArray()).filter((l) => !l.deleted).length,
    []
  );
  const categoryCount = useLiveQuery(
    async () => (await db.categories.toArray()).filter((c) => !c.deleted).length,
    []
  );

  const categories = useLiveQuery(
    () => db.categories.filter((c) => !c.deleted).toArray(),
    []
  );

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
    {
      key: "daily-limit",
      label: "Pengaturan Limit Harian",
      desc: "Pilih kategori yang dihitung untuk limit harian aman (50/30/20)",
      icon: Settings,
      color: "#e0a72c",
      count: null,
    },
    {
      key: "notifications",
      label: "Pengaturan Notifikasi",
      desc: "Limit harian, budget, ringkasan bulanan, pengingat harian",
      icon: Bell,
      color: "#e0527a",
      count: null,
    },
    {
      key: "p2p-sync",
      label: "Sinkronkan Perangkat",
      desc: "Transfer data antar HP via QR Code + WebRTC (offline)",
      icon: Wifi,
      color: "#3b7dd8",
      count: null,
    },
  ];

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header title="Lainnya" />
      <main className="mx-auto max-w-md space-y-3 px-4 pt-4">
        {items.map((item) => (
          <button
            key={item.to || item.key}
            onClick={() => {
              if (item.key === "daily-limit") {
                setShowDailyLimitSettings(true);
              } else if (item.key === "notifications") {
                setShowNotificationSettings(true);
              } else if (item.key === "p2p-sync") {
                setShowP2PSync(true);
              } else if (item.to) {
                navigate(item.to);
              }
            }}
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

        {/* Daily Limit Settings Modal */}
        {showDailyLimitSettings && categories && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/30 backdrop-blur-sm" onClick={() => setShowDailyLimitSettings(false)}>
            <div className="flex-1 flex items-end">
              <div className="w-full rounded-t-2xl bg-surface shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-center pt-3">
                  <div className="h-1 w-10 rounded-full bg-outline-variant" />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
                  <h3 className="font-display text-lg font-semibold text-on-surface">Pengaturan Limit Harian</h3>
                  <button onClick={() => setShowDailyLimitSettings(false)} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high" aria-label="Tutup">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <DailyLimitCategorySettings
                    categories={categories}
                    onClose={() => setShowDailyLimitSettings(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings Modal */}
        {showNotificationSettings && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/30 backdrop-blur-sm" onClick={() => setShowNotificationSettings(false)}>
            <div className="flex-1 flex items-end">
              <div className="w-full rounded-t-2xl bg-surface shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-center pt-3">
                  <div className="h-1 w-10 rounded-full bg-outline-variant" />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
                  <h3 className="font-display text-lg font-semibold text-on-surface">Pengaturan Notifikasi</h3>
                  <button onClick={() => setShowNotificationSettings(false)} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high" aria-label="Tutup">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <NotificationSettings onClose={() => setShowNotificationSettings(false)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* P2P Sync Modal */}
        {showP2PSync && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/30 backdrop-blur-sm" onClick={() => setShowP2PSync(false)}>
            <div className="flex-1 flex items-end">
              <div className="w-full rounded-t-2xl bg-surface shadow-xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-center pt-3">
                  <div className="h-1 w-10 rounded-full bg-outline-variant" />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
                  <h3 className="font-display text-lg font-semibold text-on-surface">Sinkronkan Perangkat</h3>
                  <button onClick={() => setShowP2PSync(false)} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high" aria-label="Tutup">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <P2PSyncPage onClose={() => setShowP2PSync(false)} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
