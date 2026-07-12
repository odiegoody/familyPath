import { TrendingUp, TrendingDown } from "lucide-react";
import { formatRupiah } from "../utils/format";

export default function BalanceCard({ balance, income, expense, monthLabel }) {
  const net = income - expense;
  const isPositive = net >= 0;

  return (
    <div className="rounded-xl bg-primary-container p-5 text-on-primary shadow-modal">
      <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-on-primary/60">
        Saldo Keluarga
      </p>
      <p className="mt-1 font-display text-[34px] font-semibold leading-tight tracking-tight">
        {formatRupiah(balance)}
      </p>

      <div
        className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
          isPositive ? "bg-success/20 text-tertiary-fixed" : "bg-danger/25 text-red-200"
        }`}
      >
        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {formatRupiah(Math.abs(net))} bulan ini
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-on-primary/50">
            Pemasukan · {monthLabel}
          </p>
          <p className="mt-0.5 font-display text-base font-semibold text-tertiary-fixed">
            {formatRupiah(income)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-on-primary/50">
            Pengeluaran · {monthLabel}
          </p>
          <p className="mt-0.5 font-display text-base font-semibold text-red-300">
            {formatRupiah(expense)}
          </p>
        </div>
      </div>
    </div>
  );
}
