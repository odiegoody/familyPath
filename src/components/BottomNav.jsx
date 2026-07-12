import { NavLink, useLocation } from "react-router-dom";
import { LayoutGrid, Receipt, Grid3x3, Plus } from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/transaksi", label: "Transaksi", icon: Receipt },
  { to: "/lainnya", label: "Lainnya", icon: Grid3x3 },
];

const LAINNYA_PREFIXES = ["/lainnya", "/budget", "/goals", "/aset", "/investasi", "/hutang", "/anggota", "/kategori"];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-outline-variant bg-surface-container-lowest">
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {items.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === "/lainnya"
              ? LAINNYA_PREFIXES.some((p) => location.pathname.startsWith(p))
              : to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              <span>{label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/tambah"
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-on-surface-variant"
        >
          <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-modal">
            <Plus size={24} />
          </span>
          <span className="mt-0.5">Tambah</span>
        </NavLink>
      </div>
    </nav>
  );
}
