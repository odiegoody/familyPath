import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, ChevronRight } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";
import { getIcon } from "../utils/icons";

export default function Categories() {
  const navigate = useNavigate();
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const grouped = useMemo(() => {
    const expense = (categories || []).filter((c) => c.type === "expense");
    const income = (categories || []).filter((c) => c.type === "income");
    return { expense, income };
  }, [categories]);

  const loading = categories === undefined;

  function renderGroup(title, list) {
    return (
      <section>
        <h2 className="mb-2.5 font-display text-sm font-semibold text-on-surface">{title}</h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant shadow-card">
          {list.map((cat) => {
            const Icon = getIcon(cat.icon);
            return (
              <button
                key={cat.id}
                onClick={() => navigate(`/kategori/${cat.id}/edit`)}
                className="flex w-full items-center gap-3 border-b border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-left last:border-b-0 active:bg-surface-container-low"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-on-surface">
                  {cat.name}
                  {cat.isDefault ? (
                    <span className="ml-2 text-[11px] font-normal text-on-surface-variant">Default</span>
                  ) : null}
                </span>
                <ChevronRight size={16} className="shrink-0 text-on-surface-variant" />
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header
        title="Kategori"
        showBack
        right={
          <button
            onClick={() => navigate("/kategori/baru")}
            aria-label="Tambah kategori"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Plus size={18} />
          </button>
        }
      />
      <main className="mx-auto max-w-md space-y-5 px-4 pt-4">
        {loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-surface-container-high" />
        ) : (
          <>
            {renderGroup("Pengeluaran", grouped.expense)}
            {renderGroup("Pemasukan", grouped.income)}
          </>
        )}
      </main>
    </div>
  );
}
