import { createPortal } from "react-dom";

export default function PhotoSourcePicker({ open, onClose, onPickGallery, onPickCamera }) {
  if (!open) return null;

  return createPortal(
    <div className="fp-photo-picker-backdrop" onClick={onClose}>
      <div className="fp-photo-picker" onClick={(e) => e.stopPropagation()}>
        <h3 className="fp-photo-picker-title">Fotoğraf Ekle</h3>
        <p className="fp-photo-picker-desc">Galeriden seçin veya yeni fotoğraf çekin.</p>
        <button type="button" className="fp-photo-picker-btn primary" onClick={onPickGallery}>
          Galeriden Seç
        </button>
        <button type="button" className="fp-photo-picker-btn secondary" onClick={onPickCamera}>
          Fotoğraf Çek
        </button>
        <button type="button" className="fp-photo-picker-btn muted" onClick={onClose}>
          İptal
        </button>
      </div>
    </div>,
    document.body
  );
}
