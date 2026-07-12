import { getIcon } from "../utils/icons";
import { formatRupiah, formatPercent, isUpdateDue } from "../utils/format";

export default function AssetCard({ asset, currentValue, lastUpdateDate, onClick }) {
  const Icon = getIcon(asset.icon);
  const gain = currentValue - asset.initialValue;
  const gainPct = asset.initialValue ? (gain / asset.initialValue) * 100 : 0;
  const isPositive = gain >= 0;
  const due = isUpdateDue(lastUpdateDate, asset.trackingFrequency);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-card"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${asset.color}1a`, color: asset.color }}
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">{asset.name}</p>
        <p className="font-display text-base font-semibold text-on-surface">
          {formatRupiah(currentValue)}
        </p>
        {due && (
          <span className="mt-1 inline-block rounded-full bg-danger-container px-2 py-0.5 text-[10px] font-semibold text-on-danger-container">
            Perlu update
          </span>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            isPositive ? "bg-success-container text-on-success-container" : "bg-danger-container text-on-danger-container"
          }`}
        >
          {formatPercent(gainPct)}
        </span>
        <p className={`mt-1 text-[11px] font-medium ${isPositive ? "text-success" : "text-danger"}`}>
          {formatRupiah(gain)}
        </p>
      </div>
    </button>
  );
}
