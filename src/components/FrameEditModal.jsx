import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EDITABLE_CATEGORY_OPTIONS, buildSeriesOptions } from "../data/frameFormOptions";
import { mergeFrameMeta, updateCustomFrame } from "../utils/customFramesStorage";
import { saveFrameOverride, overridePatchFromSavedFrame } from "../utils/frameOverridesStorage";
import { getFrameDisplayLabel } from "../utils/frameDisplay";

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
    pleksiPrice: parsePriceString(frame.pleksiPrice),
    camPrice: parsePriceString(frame.camPrice),
    categories: [...(frame.categories ?? [])].filter((c) => c !== "custom"),
  };
}

function parsePriceInput(raw) {
  return Math.max(0, Math.round(Number(raw) || 0));
}

export default function FrameEditModal({ open, frame, onClose, onSaved, categoryOptions, seriesOptions }) {
  const effectiveCategoryOptions = categoryOptions ?? EDITABLE_CATEGORY_OPTIONS;
  const effectiveSeriesOptions = seriesOptions ?? buildSeriesOptions();
  const [code, setCode] = useState("");
  const [colorName, setColorName] = useState("");
  const [label, setLabel] = useState("");
  const [defaultMm, setDefaultMm] = useState(20);
  const [price, setPrice] = useState("");
  const [pleksiPrice, setPleksiPrice] = useState("");
  const [camPrice, setCamPrice] = useState("");
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
    setPleksiPrice(form.pleksiPrice);
    setCamPrice(form.camPrice);
    setSelectedCats(form.categories);
    setError("");
    setSaving(false);
  }, [open, frame]);

  if (!open || !frame) return null;

  const hasSeries = Boolean(code.trim() || frame.code);
  const displayLabel = getFrameDisplayLabel({ ...frame, label: label.trim() || frame.label });
  const previewPrice = price.trim() === "" ? 0 : parsePriceInput(price);
  const previewPleksi = pleksiPrice.trim() === "" ? 0 : parsePriceInput(pleksiPrice);
  const previewCam = camPrice.trim() === "" ? 0 : parsePriceInput(camPrice);

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

    const priceValue = price.trim() === "" ? null : parsePriceInput(price);
    const pleksiValue = pleksiPrice.trim() === "" ? null : parsePriceInput(pleksiPrice);
    const camValue = camPrice.trim() === "" ? null : parsePriceInput(camPrice);

    const codeTrim = code.trim();
    let categories = [...selectedCats];
    if (codeTrim) {
      const seriesCat = effectiveCategoryOptions.find((c) => c.label === codeTrim);
      if (seriesCat && !categories.includes(seriesCat.id)) {
        categories.push(seriesCat.id);
      }
    }

    const updates = {
      code: codeTrim || null,
      colorName: colorName.trim() || null,
      label: label.trim() || null,
      categories: frame.custom ? [...categories, "custom"] : categories,
      defaultMm,
      price: priceValue,
      pleksiPrice: pleksiValue,
      camPrice: camValue,
      pricePerCm: null,
      pleksiPricePerCm: null,
      camPricePerCm: null,
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
              <h2>Çerçeve Düzenle</h2>
              <p>Ad, çerçeve fiyatı, pleksi/cam ve kategorileri güncelleyin</p>
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
              Kenar: {frame.thickness}px · {frame.custom ? "Özel çerçeve" : "Katalog çerçevesi"}
            </p>
            <div className="fp-modal-edit-price-badges">
              <span className="fp-modal-edit-price-badge">
                Çerçeve fiyatı: {previewPrice.toLocaleString("tr-TR")} ₺
              </span>
              {previewPleksi > 0 && (
                <span className="fp-modal-edit-price-badge fp-modal-edit-price-badge-muted">
                  Pleksi: {previewPleksi.toLocaleString("tr-TR")} ₺
                </span>
              )}
              {previewCam > 0 && (
                <span className="fp-modal-edit-price-badge fp-modal-edit-price-badge-muted">
                  Cam: {previewCam.toLocaleString("tr-TR")} ₺
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="fp-modal-edit-body">
          <section className="fp-modal-edit-section">
            <h3 className="fp-modal-edit-section-title">Genel Bilgiler</h3>
            <div className="fp-modal-form">
              <div className="fp-modal-field">
                <label>Seri</label>
                <select value={code} onChange={(e) => setCode(e.target.value)}>
                  {effectiveSeriesOptions.map((s) => (
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
            </div>
          </section>

          <section className="fp-modal-edit-section">
            <h3 className="fp-modal-edit-section-title">Fiyatlandırma</h3>
            <div className="fp-modal-price-grid">
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
              <div className="fp-modal-price-field">
                <label>Pleksi fiyatı (₺/m²)</label>
                <div className="fp-modal-price-input-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pleksiPrice}
                    onChange={(e) => setPleksiPrice(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                  />
                  <span>₺</span>
                </div>
              </div>
              <div className="fp-modal-price-field">
                <label>Cam fiyatı (₺/m²)</label>
                <div className="fp-modal-price-input-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={camPrice}
                    onChange={(e) => setCamPrice(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                  />
                  <span>₺</span>
                </div>
              </div>
            </div>
          </section>

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
