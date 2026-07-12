import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2, Pencil, Check, X, User } from "lucide-react";
import { db } from "../db/db";
import Header from "../components/Header";

export default function Members() {
  const members = useLiveQuery(() => db.members.toArray(), []);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nameInput, setNameInput] = useState("");

  async function handleAdd() {
    const name = nameInput.trim();
    if (!name) return;
    await db.members.add({ name, createdAt: Date.now() });
    setNameInput("");
    setAdding(false);
  }

  async function handleUpdate(id) {
    const name = nameInput.trim();
    if (!name) return;
    await db.members.update(id, { name });
    setEditingId(null);
    setNameInput("");
  }

  async function handleDelete(id) {
    const txCount = await db.transactions.where("memberId").equals(id).count();
    const msg =
      txCount > 0
        ? `Anggota ini punya ${txCount} transaksi tercatat. Menghapus anggota TIDAK menghapus transaksinya, tapi label "dicatat oleh" jadi tidak valid. Lanjutkan hapus?`
        : "Hapus anggota ini?";
    if (!confirm(msg)) return;
    await db.members.delete(id);
  }

  const loading = members === undefined;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Header title="Anggota Keluarga" showBack />
      <main className="mx-auto max-w-md space-y-3 px-4 pt-4">
        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-surface-container-high" />
        ) : (
          <>
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5 shadow-card"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <User size={17} />
                </span>
                {editingId === m.id ? (
                  <>
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => handleUpdate(m.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setNameInput("");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-on-surface">{m.name}</span>
                    <button
                      onClick={() => {
                        setEditingId(m.id);
                        setNameInput(m.name);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container-high"
                      aria-label="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-danger active:bg-danger-container"
                      aria-label="Hapus"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            ))}

            {adding ? (
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5 shadow-card">
                <input
                  autoFocus
                  placeholder="Nama anggota"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleAdd}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setNameInput("");
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAdding(true);
                  setNameInput("");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant py-3 text-sm font-semibold text-secondary"
              >
                <Plus size={16} /> Tambah Anggota
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
