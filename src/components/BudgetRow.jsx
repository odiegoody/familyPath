import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { getIcon } from "../utils/icons";
import { formatRupiah, parseRupiahInput } from "../utils/format";

export default function BudgetRow({ category, spent, budget, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budget ? String(budget) : "");

  const Icon = getIcon(category.icon);
  const hasBudget = budget > 0;
  const pct = hasBudget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const over = hasBudget && spent > budget;
  const remaining = hasBudget ? budget - spent : 0;

  function startEdit() {
    setValue(budget ? String(budget) : "");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    const amount = parseRupiahInput(value);
    onSave(amount);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${category.color}1a`, color: category.color }}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-on-surface">{category.name}</p>
          {!editing && (
            <p className="text-xs text-on-surface-variant">
              {hasBudget ? (
                <>
                  {formatRupiah(spent)} dari {formatRupiah(budget)}
                </>
              ) : (
                "Belum ada budget"
              )}
            </p>
          )}
        </div>

        {editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <input
              autoFocus
              inputMode="numeric"
              value={value ? formatRupiah(parseRupiahInput(value), { withSymbol: false }) : ""}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-24 rounded-md border border-outline-variant bg-surface px-2 py-1.5 text-right text-sm font-medium text-on-surface outline-none focus:border-primary"
            />
            <button
              onClick={save}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white"
              aria-label="Simpan"
            >
              <Check size={15} />
            </button>
            <button
              onClick={cancel}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
              aria-label="Batal"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="flex shrink-0 items-center gap-1 rounded-full border border-outline-variant px-2.5 py-1 text-xs font-medium text-on-surface-variant"
          >
            <Pencil size={12} />
            {hasBudget ? "Ubah" : "Atur"}
          </button>
        )}
      </div>

      {hasBudget && !editing && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className={`h-full rounded-full ${over ? "bg-danger" : ""}`}
              style={{ width: `${pct}%`, backgroundColor: over ? undefined : category.color }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium">
            <span className={over ? "text-danger" : "text-on-surface-variant"}>
              {over ? "Melebihi budget" : `${pct}% terpakai`}
            </span>
            <span className={over ? "text-danger" : "text-success"}>
              {over
                ? `-${formatRupiah(Math.abs(remaining))}`
                : `Sisa ${formatRupiah(remaining)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
