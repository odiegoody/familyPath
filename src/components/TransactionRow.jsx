import { getIcon } from "../utils/icons";
import { formatRupiahSigned, formatRupiah, formatDateShort } from "../utils/format";

export default function TransactionRow({ tx, category, member, goal, onClick }) {
  const isSaving = tx.type === "saving";
  const isIncome = tx.type === "income";
  const icon = isSaving ? goal?.icon || "piggy-bank" : category?.icon;
  const color = isSaving ? goal?.color || "#505f76" : category?.color || "#76777d";
  const Icon = getIcon(icon);
  const label = isSaving ? goal?.name || "Goal" : category?.name;

  let amountDisplay;
  let amountClass;
  if (isSaving) {
    const out = tx.direction === "out"; // tarik dana = uang masuk lagi ke cash
    amountDisplay = `${out ? "+" : "-"}${formatRupiah(tx.amount)}`;
    amountClass = out ? "text-success" : "text-on-surface";
  } else {
    amountDisplay = formatRupiahSigned(isIncome ? tx.amount : -tx.amount);
    amountClass = isIncome ? "text-success" : "text-on-surface";
  }

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-left last:border-b-0 active:bg-surface-container-low"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-on-surface">
          {tx.description || label || "Transaksi"}
        </span>
        <span className="block text-xs text-on-surface-variant">
          {isSaving ? `${tx.direction === "out" ? "Tarik dari" : "Setor ke"} ${label}` : label} · {member?.name} ·{" "}
          {formatDateShort(tx.date)}
        </span>
      </span>
      <span className={`shrink-0 font-display text-sm font-semibold tabular-nums ${amountClass}`}>
        {amountDisplay}
      </span>
    </button>
  );
}
