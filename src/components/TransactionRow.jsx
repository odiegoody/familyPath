import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { getIcon } from "../utils/icons";
import { formatRupiahSigned, formatRupiah, formatDateShort } from "../utils/format";

const DELETE_WIDTH = 76; // px width of the revealed delete panel
const OPEN_THRESHOLD = 40; // px drag distance to snap open
const TAP_THRESHOLD = 6; // px movement below which it's treated as a tap, not a swipe

export default function TransactionRow({ tx, category, member, goal, onClick, onDelete, isOpen, onOpenChange }) {
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

  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const lockedAxis = useRef(null); // "x" | "y" | null
  const [dragX, setDragX] = useState(0); // live drag offset while touching
  const open = !!isOpen; // snapped-open state, controlled by parent so only one row is open at a time

  const translateX = dragging.current ? dragX : open ? -DELETE_WIDTH : 0;

  function handleTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
    lockedAxis.current = null;
  }

  function handleTouchMove(e) {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!lockedAxis.current) {
      if (Math.abs(dx) < TAP_THRESHOLD && Math.abs(dy) < TAP_THRESHOLD) return;
      lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (lockedAxis.current !== "x") return; // let vertical scroll happen normally

    e.preventDefault();
    const base = open ? -DELETE_WIDTH : 0;
    let next = base + dx;
    next = Math.min(0, Math.max(-DELETE_WIDTH - 12, next)); // small rubber-band past the edge
    setDragX(next);
  }

  function handleTouchEnd() {
    if (!dragging.current) return;
    dragging.current = false;
    if (lockedAxis.current === "x") {
      const shouldOpen = dragX <= -OPEN_THRESHOLD;
      onOpenChange?.(shouldOpen ? tx.id : null);
    }
    lockedAxis.current = null;
    setDragX(0);
  }

  function handleRowClick() {
    if (open) {
      onOpenChange?.(null); // tap while open just closes it, doesn't navigate
      return;
    }
    onClick?.();
  }

  return (
    <div className="relative overflow-hidden border-b border-outline-variant/60 last:border-b-0">
      <button
        onClick={() => {
          onOpenChange?.(null);
          onDelete?.(tx);
        }}
        className="absolute inset-y-0 right-0 flex w-[76px] flex-col items-center justify-center gap-1 bg-danger text-white"
        aria-label="Hapus transaksi"
      >
        <Trash2 size={18} />
        <span className="text-[11px] font-medium">Hapus</span>
      </button>

      <button
        onClick={handleRowClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging.current ? "none" : "transform 180ms ease-out",
        }}
        className="relative z-10 flex w-full items-center gap-3 bg-surface-container-lowest px-4 py-3 text-left active:bg-surface-container-low"
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
    </div>
  );
}
