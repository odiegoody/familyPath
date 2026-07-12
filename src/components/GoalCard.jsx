import { getIcon } from "../utils/icons";
import { formatRupiah, formatDateID } from "../utils/format";

export default function GoalCard({ goal, current, onClick }) {
  const Icon = getIcon(goal.icon);
  const pct = goal.targetAmount ? Math.min(100, Math.round((current / goal.targetAmount) * 100)) : 0;
  const achieved = current >= goal.targetAmount;
  const remaining = Math.max(0, goal.targetAmount - current);

  // proyeksi bulan tersisa & kebutuhan tabungan/bulan jika ada target tanggal
  let monthsLeft = null;
  let perMonth = null;
  if (goal.targetDate && !achieved) {
    const now = new Date();
    const target = new Date(goal.targetDate);
    monthsLeft = Math.max(
      1,
      (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
    );
    perMonth = Math.ceil(remaining / monthsLeft);
  }

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-card"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${goal.color}1a`, color: goal.color }}
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-on-surface">{goal.name}</p>
          <p className="text-xs text-on-surface-variant">
            {formatRupiah(current)} dari {formatRupiah(goal.targetAmount)}
          </p>
        </div>
        {achieved && (
          <span className="shrink-0 rounded-full bg-success-container px-2.5 py-1 text-[11px] font-semibold text-on-success-container">
            Tercapai
          </span>
        )}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: achieved ? "#2f8f4e" : goal.color }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-on-surface-variant">
        <span>{pct}% tercapai</span>
        {goal.targetDate && (
          <span>Target {formatDateID(goal.targetDate)}</span>
        )}
      </div>

      {!achieved && perMonth !== null && (
        <p className="mt-2 rounded-lg bg-secondary-container px-3 py-2 text-xs text-on-secondary-container">
          Perlu nabung ~{formatRupiah(perMonth)}/bulan selama {monthsLeft} bulan untuk capai target
        </p>
      )}
    </button>
  );
}
