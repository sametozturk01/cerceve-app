export default function Toast({ toast, onDismiss, onConfirm }) {
  if (!toast) return null;

  const isConfirm = toast.type === "confirm";

  return (
    <div
      className={`fp-toast-wrap${isConfirm ? " fp-toast-wrap-confirm" : ""}`}
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
      <div className={`fp-toast${isConfirm ? " fp-toast-confirm" : ""}`}>
        <p className="fp-toast-message">{toast.message}</p>
        {isConfirm ? (
          <div className="fp-toast-actions">
            <button type="button" className="fp-toast-btn fp-toast-btn-muted" onClick={onDismiss}>
              İptal
            </button>
            <button type="button" className="fp-toast-btn fp-toast-btn-danger" onClick={onConfirm}>
              Kaldır
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
