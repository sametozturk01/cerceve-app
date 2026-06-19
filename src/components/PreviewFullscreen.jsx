import { useEffect } from "react";

export default function PreviewFullscreen({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fp-fullscreen-backdrop" onClick={onClose}>
      <div className="fp-fullscreen-panel" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="fp-fullscreen-close"
          onClick={onClose}
          aria-label="Tam ekranı kapat"
        >
          ×
        </button>
        <div className="fp-fullscreen-canvas-wrap">{children}</div>
        <p className="fp-fullscreen-hint">Tam ekran · Kapatmak için Esc veya dışarı tıklayın</p>
      </div>
    </div>
  );
}
