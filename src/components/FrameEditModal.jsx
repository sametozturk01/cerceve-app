import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EDITABLE_CATEGORY_OPTIONS, SERIES_OPTIONS } from "../data/frameFormOptions";
import { mergeFrameMeta, updateCustomFrame } from "../utils/customFramesStorage";
import { saveFrameOverride } from "../utils/frameOverridesStorage";
import { getFrameDisplayLabel } from "../utils/frameDisplay";

function frameToForm(frame) {
  return {
    code: frame.code ?? "",
    colorName: frame.colorName ?? "",
    label: frame.label ?? "",
    defaultMm: frame.defaultMm ?? 20,
    categories: [...(frame.categories ?? [])].filter((c) => c !== "custom"),
  };
}

export default function FrameEditModal({ open, frame, onClose, onSaved }) {
  const [code, setCode] = useState("");
  const [colorName, setColorName] = useState("");
  const [label, setLabel] = useState("");
  const [defaultMm, setDefaultMm] = useState(20);
  const [selectedCats, setSelectedCats] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !frame) return;
    const form = frameToForm(frame);
    setCode(form.code);
    setColorName(form.colorName);
    setLabel(form.label);
    setDefaultMm(form.defaultMm);
    setSelectedCats(form.categories);
    setError("");
    setSaving(false);
  }, [open, frame]);

  if (!open || !frame) return null;

  const hasSeries = Boolean(code.trim() || frame.code);
  const displayLabel = getFrameDisplayLabel({ ...frame, label: label.trim() || frame.label });

  const toggleCategory = (id) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!label.trim() && !colorName.trim() && !frame.label) {
      setError("İsim veya renk adı girin.");
      return;
    }
    if (selectedCats.length === 0) {
      setError("En az bir kategori seçin.");
      return;
    }

    const updates = {
      code: code.trim() || null,
      colorName: colorName.trim() || null,
      label: label.trim() || null,
      categories: frame.custom ? [...selectedCats, "custom"] : selectedCats,
      defaultMm,
    };

    setSaving(true);
    setError("");

    try {
      let saved;
      if (frame.custom) {
        saved = await updateCustomFrame(frame.id, updates);
        if (frame.image?.startsWith("blob:") && frame.image !== saved.image) {
          URL.revokeObjectURL(frame.image);
        }
      } else {
        saveFrameOverride(frame.id, updates);
        saved = mergeFrameMeta(frame, updates);
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Kayıt başarısız.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fp-modal-header">
          <h2>Çerçeve Düzenle</h2>
          <button type="button" className="fp-modal-close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        <p className="fp-modal-desc">
          Seçili çerçevenin adını, seri kodunu, kategorilerini ve kalınlığını güncelleyin.
        </p>

        <div className="fp-modal-edit-preview">
          {frame.image ? (
            <img src={frame.image} alt={displayLabel} />
          ) : (
            <div className="fp-modal-edit-preview-empty" />
          )}
          <div>
            <strong>{displayLabel}</strong>
            <p className="fp-modal-meta">
              Kenar: {frame.thickness}px · {frame.custom ? "Özel çerçeve" : "Katalog çerçevesi"}
            </p>
          </div>
        </div>

        <div className="fp-modal-form">
          <div className="fp-modal-field">
            <label>Seri kodu</label>
            <select value={code} onChange={(e) => setCode(e.target.value)}>
              {SERIES_OPTIONS.map((s) => (
                <option key={s || "none"} value={s}>
                  {s || "— Seri yok —"}
                </option>
              ))}
            </select>
          </div>

          {hasSeries && (
            <div className="fp-modal-field">
              <label>Renk adı</label>
              <input
                type="text"
                placeholder="ör. altın, kinder mavi"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
              />
            </div>
          )}

          <div className="fp-modal-field">
            <label>Görünen isim</label>
            <input
              type="text"
              placeholder={hasSeries ? "Boş bırakılırsa kod + renk kullanılır" : "Çerçeve adı"}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="fp-modal-field">
            <label>Kalınlık (mm)</label>
            <input
              type="number"
              min={5}
              max={80}
              value={defaultMm}
              onChange={(e) => setDefaultMm(Number(e.target.value) || 20)}
            />
          </div>

          <div className="fp-modal-field">
            <label>Kategoriler</label>
            <div className="fp-category-row">
              {EDITABLE_CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`fp-category-chip${selectedCats.includes(cat.id) ? " active" : ""}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="fp-modal-error">{error}</p>}

        <div className="fp-modal-actions">
          <button type="button" className="fp-modal-btn secondary" onClick={onClose} disabled={saving}>
            İptal
          </button>
          <button type="button" className="fp-modal-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
