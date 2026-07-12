import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Header({ title, showBack = false, right = null }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface/95 px-4 py-3.5 backdrop-blur">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Kembali"
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-on-surface active:bg-surface-container-high"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="font-display text-xl font-semibold tracking-tight text-on-surface">
          {title}
        </h1>
      </div>
      {right}
    </header>
  );
}
