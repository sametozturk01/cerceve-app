import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EDITABLE_CATEGORY_OPTIONS, buildSeriesOptions, defaultMmFromSeriesLabel } from "../data/frameFormOptions";
import { mergeFrameMeta, updateCustomFrame } from "../utils/customFramesStorage";
import { saveFrameOverride, overridePatchFromSavedFrame } from "../utils/frameOverridesStorage";
import { getFrameDisplayLabel } from "../utils/frameDisplay";
import SeriesCreateField from "./SeriesCreateField";
import {
  isAccessoryFrame,
  isPaspartuAccessoryFrame,
  PASPARTU_ACCESSORY,
  PAPER_ACCESSORY,
  PASPARTU_CATEGORY_ID,
  PAPER_CATEGORY_ID,
} from "../data/paspartuOptions";

function parsePriceString(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.max(0, Math.round(value)));
  return "";
}

function frameToForm(frame) {
  return {
    code: frame.code ?? "",
    colorName: frame.colorName ?? "",
    label: frame.label ?? "",
    defaultMm: frame.defaultMm ?? 20,
    price: parsePriceString(frame.price ?? frame.pricePerCm),
    categories: [...(frame.categories ?? [])].filter((c) => c !== "custom"),
  };
}

function parsePriceInput(raw) {
  return Math.max(0, Math.round(Number(raw) || 0));
}

export default function FrameEditModal({ open, frame, onClose, onSaved, categoryOptions, seriesOptions, onAddSeries }) {
  const effectiveCategoryOptions = categoryOptions ?? EDITABLE_CATEGORY_OPTIONS;
  const effectiveSeriesOptions = seriesOptions ?? buildSeriesOptions();
  const [code, setCode] = useState("");
  const [colorName, setColorName] = useState("");
  const [label, setLabel] = useState("");
  const [defaultMm, setDefaultMm] = useState(20);
  const [price, setPrice] = useState("");
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
    setPrice(form.price);
    setSelectedCats(form.categories);
    setError("");
    setSaving(false);
  }, [open, frame?.id]);

  if (!open || !frame) return null;

  const accessoryKind = isPaspartuAccessoryFrame(frame)
    ? "paspartu"
    : isAccessoryFrame(frame)
      ? "paper"
      : null;
  const hasSeries = Boolean(code.trim() || frame.code);
  const displayLabel = getFrameDisplayLabel({ ...frame, label: label.trim() || frame.label });
  const previewPrice = price.trim() === "" ? 0 : parsePriceInput(price);
  const editTitle = accessoryKind === "paspartu"
    ? "Paspartu Düzenle"
    : accessoryKind === "paper"
      ? "Kağıt Düzenle"
      : "Çerçeve Düzenle";
  const editSubtitle = accessoryKind
    ? "Ad ve birim fiyatını güncelleyin"
    : "Ad, kategori ve çerçeve birim fiyatını (₺/m) güncelleyin";

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
    if (!accessoryKind && selectedCats.length === 0) {
      setError("En az bir kategori seçin.");
      return;
    }

    const priceValue = price.trim() === "" ? null : parsePriceInput(price);

    const codeTrim = accessoryKind
      ? (accessoryKind === "paspartu" ? "Paspartu" : "Kağıt")
      : code.trim();
    let categories = accessoryKind
      ? [accessoryKind === "paspartu" ? PASPARTU_CATEGORY_ID : PAPER_CATEGORY_ID]
      : [...selectedCats];
    if (!accessoryKind && codeTrim) {
      const seriesCat = effectiveCategoryOptions.find((c) => c.label === codeTrim);
      if (seriesCat && !categories.includes(seriesCat.id)) {
        categories.push(seriesCat.id);
      }
    }

    const updates = {
      code: codeTrim || null,
      colorName: colorName.trim() || null,
      label: label.trim() || null,
      categories,
      defaultMm,
      price: priceValue,
      pricePerCm: null,
    };
    if (accessoryKind) {
      updates.accessory = accessoryKind === "paspartu" ? PASPARTU_ACCESSORY : PAPER_ACCESSORY;
    }

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
        saved = mergeFrameMeta(frame, updates);
        saveFrameOverride(frame.id, overridePatchFromSavedFrame(saved));
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
      <div className="fp-modal fp-modal-edit" onClick={(e) => e.stopPropagation()}>
        <div className="fp-modal-edit-header">
          <div className="fp-modal-edit-header-main">
            <span className="fp-modal-edit-header-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z" strokeLinejoin="round" />
                <path d="M13.5 6.5l3 3" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <h2>{editTitle}</h2>
              <p>{editSubtitle}</p>
            </div>
          </div>
          <button type="button" className="fp-modal-close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        <div className="fp-modal-edit-preview-card">
          <div className="fp-modal-edit-preview-media">
            {frame.image ? (
              <img src={frame.image} alt={displayLabel} />
            ) : (
              <div className="fp-modal-edit-preview-empty" />
            )}
          </div>
          <div className="fp-modal-edit-preview-info">
            <strong>{displayLabel}</strong>
            <p className="fp-modal-meta">
              Kenar: {frame.thickness}px · {frame.custom ? "Yüklenen çerçeve" : "Katalog çerçevesi"}
            </p>
            <div className="fp-modal-edit-price-badges">
              <span className="fp-modal-edit-price-badge">
                Çerçeve fiyatı: {previewPrice.toLocaleString("tr-TR")} ₺/m
              </span>
            </div>
          </div>
        </div>

        <div className="fp-modal-edit-body">
          <section className="fp-modal-edit-section">
            <h3 className="fp-modal-edit-section-title">Genel Bilgiler</h3>
            <div className="fp-modal-form">
              {!accessoryKind && (
                <div className="fp-modal-field">
                  <label>Seri</label>
                  <select
                    value={code}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCode(next);
                      const cat = effectiveCategoryOptions.find((c) => c.label === next);
                      if (cat) setSelectedCats([cat.id]);
                      if (next) setDefaultMm(defaultMmFromSeriesLabel(next));
                    }}
                  >
                    {(code && !effectiveSeriesOptions.includes(code)
                      ? [...effectiveSeriesOptions, code]
                      : effectiveSeriesOptions
                    ).map((s) => (
                      <option key={s || "none"} value={s}>
                        {s || "— Seri yok —"}
                      </option>
                    ))}
                  </select>
                  {onAddSeries && (
                    <SeriesCreateField
                      onAdd={(name) => {
                        const entry = onAddSeries(name);
                        if (!entry) return;
                        setCode(entry.label);
                        setSelectedCats([entry.id]);
                        setDefaultMm(defaultMmFromSeriesLabel(entry.label));
                      }}
                    />
                  )}
                </div>
              )}

              {(hasSeries || accessoryKind) && (
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
            </div>
          </section>

          <section className="fp-modal-edit-section">
            <h3 className="fp-modal-edit-section-title">Fiyatlandırma</h3>
            <div className="fp-modal-price-grid fp-modal-price-grid-single">
              <div className="fp-modal-price-field">
                <label>Çerçeve fiyatı (₺/m)</label>
                <div className="fp-modal-price-input-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                  />
                  <span>₺</span>
                </div>
              </div>
            </div>
          </section>

          {!accessoryKind && (
            <section className="fp-modal-edit-section">
              <h3 className="fp-modal-edit-section-title">Kategoriler</h3>
              <div className="fp-modal-edit-categories">
                {effectiveCategoryOptions.map((cat) => (
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
            </section>
          )}
        </div>

        {error && <p className="fp-modal-error">{error}</p>}

        <div className="fp-modal-edit-actions">
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
