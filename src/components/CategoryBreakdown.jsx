import { getIcon } from "../utils/icons";
import { formatRupiah } from "../utils/format";

export default function CategoryBreakdown({ items }) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
        Belum ada pengeluaran bulan ini.
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.total));

  return (
    <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
      {items.map((item) => {
        const Icon = getIcon(item.icon);
        const pct = max ? Math.round((item.total / max) * 100) : 0;
        return (
          <div key={item.categoryId} className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${item.color}1a`, color: item.color }}
            >
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium text-on-surface">{item.name}</span>
                <span className="ml-2 shrink-0 font-display font-semibold tabular-nums text-on-surface">
                  {formatRupiah(item.total)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
