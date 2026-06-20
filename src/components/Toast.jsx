import { createPortal } from "react-dom";

export default function Toast({ toast, onDismiss, onConfirm, onUndo }) {
  if (!toast) return null;

  const isConfirm = toast.type === "confirm";
  const isUndo = toast.type === "undo";
  const needsInteraction = isConfirm || isUndo;

  return createPortal(
    <div
      className={`fp-toast-wrap${needsInteraction ? " fp-toast-wrap-confirm" : ""}`}
      role="status"
      aria-live="polite"
    >
      {isConfirm ? (
        <button
          type="button"
          className="fp-toast-backdrop"
          aria-label="İptal"
          onClick={onDismiss}
        />
      ) : null}
      <div className={`fp-toast${isConfirm || isUndo ? " fp-toast-confirm" : ""}`}>
        <p className="fp-toast-message">{toast.message}</p>
        {toast.type === "confirm" ? (
          <div className="fp-toast-actions">
            <button type="button" className="fp-toast-btn fp-toast-btn-muted" onClick={onDismiss}>
              İptal
            </button>
            <button type="button" className="fp-toast-btn fp-toast-btn-danger" onClick={onConfirm}>
              Kaldır
            </button>
          </div>
        ) : null}
        {isUndo ? (
          <div className="fp-toast-actions">
            <button type="button" className="fp-toast-btn fp-toast-btn-muted" onClick={onDismiss}>
              Tamam
            </button>
            <button type="button" className="fp-toast-btn fp-toast-btn-primary" onClick={onUndo}>
              Geri Al
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
