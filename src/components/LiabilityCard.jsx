import { getIcon } from "../utils/icons";
import { formatRupiah, formatDateID } from "../utils/format";

export default function LiabilityCard({ liability, balance, onClick }) {
  const Icon = getIcon(liability.icon);
  const paid = liability.principalAmount - balance;
  const pct = liability.principalAmount
    ? Math.min(100, Math.max(0, Math.round((paid / liability.principalAmount) * 100)))
    : 0;
  const payoff = balance <= 0;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-card"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${liability.color}1a`, color: liability.color }}
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-on-surface">{liability.name}</p>
          <p className="text-xs text-on-surface-variant">
            Sisa {formatRupiah(Math.max(0, balance))}
            {balance < 0 && ` (lebih bayar ${formatRupiah(Math.abs(balance))})`}
          </p>
        </div>
        {payoff && (
          <span className="shrink-0 rounded-full bg-success-container px-2.5 py-1 text-[11px] font-semibold text-on-success-container">
            Lunas
          </span>
        )}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: payoff ? "#2f8f4e" : liability.color }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-on-surface-variant">
        <span>{pct}% terbayar dari {formatRupiah(liability.principalAmount)}</span>
        {liability.dueDate && <span>Jatuh tempo {formatDateID(liability.dueDate)}</span>}
      </div>
    </button>
  );
}
