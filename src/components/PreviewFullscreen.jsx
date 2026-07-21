import { useEffect } from "react";
import { createPortal } from "react-dom";

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

  return createPortal(
    <div className="fp-fullscreen-backdrop" onClick={onClose}>
      <div className="fp-fullscreen-panel" onClick={(e) => e.stopPropagation()}>
        <div className="fp-fullscreen-preview-stack">
          <button
            type="button"
            className="fp-fullscreen-close"
            onClick={onClose}
            aria-label="Tam ekranı kapat"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M7 7l10 10M17 7L7 17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="fp-fullscreen-canvas-wrap">{children}</div>
        </div>
        <p className="fp-fullscreen-hint fp-fullscreen-hint--desktop">
          Önizlemenin üzerinde gezdirin — büyüteç imleci takip eder · Kapatmak için dışarı tıklayın
        </p>
        <p className="fp-fullscreen-hint fp-fullscreen-hint--touch">
          Parmağınızı önizlemede gezdirin — büyüteç parmağı takip eder · Kapatmak için dışarı tıklayın
        </p>
      </div>
    </div>,
    document.body
  );
}
