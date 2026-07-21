import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z" strokeLinejoin="round" />
      <path d="M13.5 6.5l3 3" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M10 11v5M14 11v5M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SeriesManageModal({
  open,
  onClose,
  categories,
  getCount,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}) {
  const [newSeriesName, setNewSeriesName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    setNewSeriesName("");
    setEditingId(null);
    setEditingLabel("");
  }, [open]);

  if (!open) return null;

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditingLabel(cat.label);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingLabel("");
  };

  const submitAdd = () => {
    const name = newSeriesName.trim();
    if (!name) return;
    onAdd(name);
    setNewSeriesName("");
  };

  const submitRename = (cat) => {
    const name = editingLabel.trim();
    if (!name || name === cat.label) {
      cancelEdit();
      return;
    }
    onRename(cat, name);
    cancelEdit();
  };

  return createPortal(
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal fp-modal-series-manage" onClick={(e) => e.stopPropagation()}>
        <div className="fp-modal-series-manage-header">
          <div className="fp-modal-series-manage-header-text">
            <span className="fp-modal-series-manage-eyebrow">Seriler</span>
            <h2>Serileri düzenle</h2>
            <p>Ekleyin, yeniden adlandırın veya kaldırın</p>
          </div>
          <button type="button" className="fp-modal-close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        <div className="fp-series-manage-add">
          <label className="fp-series-manage-add-label" htmlFor="fp-new-series-name">
            Yeni seri
          </label>
          <div className="fp-series-manage-add-row">
            <input
              id="fp-new-series-name"
              type="text"
              className="fp-series-manage-add-input"
              placeholder="Örn. Yeni 25"
              value={newSeriesName}
              maxLength={32}
              onChange={(e) => setNewSeriesName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAdd();
              }}
            />
            <button
              type="button"
              className="fp-series-manage-add-btn"
              disabled={!newSeriesName.trim()}
              onClick={submitAdd}
              aria-label="Seri ekle"
            >
              <IconPlus />
              <span>Ekle</span>
            </button>
          </div>
        </div>

        <ul className="fp-series-manage-list">
          {categories.map((cat) => {
            const count = getCount(cat.id);
            const isSelected = selectedId === cat.id;
            const canManage = cat.id !== "all";
            const isEditing = editingId === cat.id;

            return (
              <li key={cat.id} className={`fp-series-manage-item${isSelected ? " selected" : ""}`}>
                {isEditing ? (
                  <div className="fp-series-manage-edit">
                    <input
                      type="text"
                      className="fp-series-manage-edit-input"
                      value={editingLabel}
                      maxLength={32}
                      autoFocus
                      aria-label="Seri adı"
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename(cat);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <div className="fp-series-manage-edit-actions">
                      <button type="button" className="fp-series-manage-edit-save" onClick={() => submitRename(cat)}>
                        Kaydet
                      </button>
                      <button type="button" className="fp-series-manage-edit-cancel" onClick={cancelEdit}>
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="fp-series-manage-row">
                    <button
                      type="button"
                      className="fp-series-manage-main"
                      onClick={() => {
                        onSelect(cat.id);
                        onClose();
                      }}
                    >
                      <span className="fp-series-manage-label-row">
                        <span className="fp-series-manage-label">{cat.label}</span>
                        {isSelected && <span className="fp-series-manage-badge">Seçili</span>}
                      </span>
                      <span className="fp-series-manage-meta">{count} çerçeve</span>
                    </button>
                    {canManage ? (
                      <div className="fp-series-manage-toolbar">
                        <button
                          type="button"
                          className="fp-series-manage-icon-btn"
                          aria-label={`${cat.label} adını düzenle`}
                          onClick={() => startEdit(cat)}
                        >
                          <IconPencil />
                        </button>
                        <button
                          type="button"
                          className="fp-series-manage-icon-btn fp-series-manage-icon-btn-danger"
                          aria-label={`${cat.label} serisini kaldır`}
                          onClick={() => onDelete(cat)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="fp-modal-series-manage-footer">
          <button type="button" className="fp-series-manage-done" onClick={onClose}>
            Tamam
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
