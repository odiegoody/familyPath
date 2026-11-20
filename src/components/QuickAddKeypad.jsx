import { useState, useMemo } from "react";
import { getIcon } from "../utils/icons";
import { getQuickAddTemplates } from "../utils/analytics";
import { formatRupiah, parseRupiahInput } from "../utils/format";

/**
 * Quick-Add Keypad with templates (Savvr-style)
 * Fast transaction entry with amount pad + common templates
 */
export default function QuickAddKeypad({
  onAddTransaction,
  categories,
  members,
  goals,
  defaultMemberId,
  isOpen,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("templates"); // templates | keypad
  const [amountStr, setAmountStr] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [type, setType] = useState("expense");
  const [categoryId, setCategoryId] = useState(null);
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState("in");

  const templates = useMemo(() => getQuickAddTemplates(), []);
  const filteredTemplates = templates.filter(t => t.type === type);

  const categoryMap = useMemo(() => {
    const map = {};
    (categories || []).forEach(c => map[c.id] = c);
    return map;
  }, [categories]);

  const filteredCategories = useMemo(
    () => (categories || []).filter(c => c.type === type),
    [categories, type]
  );

  // When template selected, prefill form
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setAmountStr(String(template.amount));
    setType(template.type);
    setDirection(template.direction || "in");
    if (template.categoryHint) {
      const cat = categories?.find(c =>
        c.name.toLowerCase().includes(template.categoryHint.toLowerCase()) && c.type === template.type
      );
      if (cat) setCategoryId(cat.id);
    }
    setDescription(template.label);
    setActiveTab("keypad");
  };

  const handleKeypadInput = (key) => {
    if (key === "backspace") {
      setAmountStr(prev => prev.slice(0, -1));
    } else if (key === "clear") {
      setAmountStr("");
    } else if (/^\d$/.test(key)) {
      setAmountStr(prev => {
        const num = parseRupiahInput(prev + key);
        return formatRupiah(num, { withSymbol: false });
      });
    }
  };

  const amount = parseRupiahInput(amountStr);
  const canSave = amount > 0 && memberId && (type === "saving" ? goals?.length : categoryId);

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onAddTransaction({
        type,
        amount,
        categoryId: type === "saving" ? null : categoryId,
        goalId: type === "saving" ? categoryId : null, // reuse categoryId for goal when saving
        direction: type === "saving" ? direction : null,
        memberId,
        date: new Date(date).getTime(),
        description: description.trim() || (selectedTemplate?.label || "Transaksi cepat"),
        notes: notes.trim(),
      });
      resetForm();
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setAmountStr("");
    setSelectedTemplate(null);
    setCategoryId(null);
    setDescription("");
    setNotes("");
    setDirection("in");
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="flex-1 flex items-end">
        <div className="w-full rounded-t-2xl bg-surface shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Handle bar */}
          <div className="flex items-center justify-center pt-3">
            <div className="h-1 w-10 rounded-full bg-outline-variant" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
            <h3 className="font-display text-lg font-semibold text-on-surface">Transaksi Cepat</h3>
            <button onClick={onClose} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high" aria-label="Tutup">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-3 pb-3 border-b border-outline-variant">
            {[
              { key: "templates", label: "Template", count: filteredTemplates.length },
              { key: "keypad", label: "Keypad" },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === t.key
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-on-primary/20">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === "templates" && (
              <div className="space-y-3">
                {/* Type filter for templates */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {["expense", "income", "saving"].map(t => (
                    <button
                      key={t}
                      onClick={() => { setType(t); setSelectedTemplate(null); }}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                        type === t
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
                      }`}
                    >
                      {t === "expense" ? "💸 Keluar" : t === "income" ? "💰 Masuk" : "🐷 Tabung"}
                    </button>
                  ))}
                </div>

                {/* Template grid */}
                <div className="grid grid-cols-3 gap-2">
                  {filteredTemplates.map((template, i) => {
                    const Icon = getIcon(template.icon);
                    const isSelected = selectedTemplate?.label === template.label;
                    return (
                      <button
                        key={template.label}
                        onClick={() => handleTemplateSelect(template)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 transition-all ${
                          isSelected
                            ? "border-primary bg-primary-container text-on-primary-container shadow-sm"
                            : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/50"
                        }`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${template.color || "#76777d"}1a`, color: template.color || "#76777d" }}>
                          <Icon size={20} />
                        </div>
                        <span className="text-xs font-medium truncate w-full text-center">{template.label}</span>
                        <span className="font-display text-sm font-semibold tabular-nums">{formatRupiah(template.amount)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "keypad" && (
              <div className="space-y-4">
                {/* Amount display */}
                <div className="flex items-baseline justify-between px-2">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wide">Jumlah</span>
                  <span className="font-display text-3xl font-semibold tabular-nums text-on-surface">
                    {amountStr ? `Rp ${amountStr}` : "Rp 0"}
                  </span>
                </div>

                {/* Type selector */}
                <div className="grid grid-cols-3 gap-2">
                  {["expense", "income", "saving"].map(t => (
                    <button
                      key={t}
                      onClick={() => { setType(t); setCategoryId(null); }}
                      className={`rounded-lg border py-2.5 text-sm font-semibold ${
                        type === t
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant text-on-surface"
                      }`}
                    >
                      {t === "expense" ? "Pengeluaran" : t === "income" ? "Pemasukan" : "Tabungan"}
                    </button>
                  ))}
                </div>

                {type === "saving" && (
                  <div className="grid grid-cols-2 gap-2">
                    {["in", "out"].map(d => (
                      <button
                        key={d}
                        onClick={() => setDirection(d)}
                        className={`rounded-lg border py-2 text-sm font-medium ${
                          direction === d
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant text-on-surface"
                        }`}
                      >
                        {d === "in" ? "Setor" : "Tarik"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Category/Goal selector */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {type === "saving" ? "Goal" : "Kategori"}
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {(type === "saving" ? goals : filteredCategories).map(item => {
                      const Icon = getIcon(item.icon);
                      const active = categoryId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setCategoryId(item.id)}
                          className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center ${
                            active
                              ? "border-primary bg-primary text-on-primary"
                              : "border-outline-variant bg-surface-container-lowest text-on-surface"
                          }`}
                        >
                          <Icon size={16} style={{ color: active ? undefined : item.color }} />
                          <span className="text-[10px] font-medium leading-tight truncate w-full">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[1,2,3,4,5,6,7,8,9,"backspace",0,"clear"].map(key => (
                    <button
                      key={key}
                      onClick={() => handleKeypadInput(key.toString())}
                      className={`aspect-square rounded-xl border flex items-center justify-center font-display text-xl font-medium transition-colors ${
                        key === "backspace" || key === "clear"
                          ? "border-outline-variant bg-surface-container-lowest text-on-surface-variant active:bg-surface-container-high"
                          : "border-outline-variant bg-surface text-on-surface active:bg-surface-container-high"
                      }`}
                    >
                      {key === "backspace" ? (
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      ) : key === "clear" ? (
                        <span className="text-sm font-semibold">C</span>
                      ) : (
                        key
                      )}
                    </button>
                  ))}
                </div>

                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-1.5 pt-2">
                  {[50000, 100000, 200000, 500000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setAmountStr(String(amt))}
                      className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 text-sm font-medium text-on-surface active:bg-surface-container-high"
                    >
                      {formatRupiah(amt, { withSymbol: true })}
                    </button>
                  ))}
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    Deskripsi
                  </label>
                  <input
                    type="text"
                    placeholder="Untuk apa?"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
                  />
                </div>

                {/* Member + Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      Dicatat oleh
                    </label>
                    <select
                      value={memberId ?? ""}
                      onChange={e => setMemberId(Number(e.target.value))}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                    >
                      {(members || []).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="w-full rounded-lg bg-primary py-3.5 text-center text-sm font-semibold text-on-primary disabled:opacity-40 mt-2"
                >
                  {saving ? "Menyimpan..." : "Simpan Transaksi"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}