import { useState, useRef } from "react";
import { processFrameImage } from "../utils/frameProcessor";
import { EDITABLE_CATEGORY_OPTIONS, SERIES_OPTIONS } from "../data/frameFormOptions";
import { buildFrameEntry, saveCustomFrame } from "../utils/customFramesStorage";

const CATEGORY_OPTIONS = EDITABLE_CATEGORY_OPTIONS;

const STEPS = {
  idle: "idle",
  processing: "processing",
  ready: "ready",
  saving: "saving",
  error: "error",
};

export default function FrameAddModal({ open, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(STEPS.idle);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [processed, setProcessed] = useState(null);

  const [code, setCode] = useState("FA 20");
  const [colorName, setColorName] = useState("");
  const [label, setLabel] = useState("");
  const [defaultMm, setDefaultMm] = useState(20);
  const [selectedCats, setSelectedCats] = useState(["fa20"]);

  const [progressText, setProgressText] = useState("");

  if (!open) return null;

  const reset = () => {
    setStep(STEPS.idle);
    setError("");
    setPreview(null);
    setProcessed(null);
    setProgressText("");
    setCode("FA 20");
    setColorName("");
    setLabel("");
    setDefaultMm(20);
    setSelectedCats(["fa20"]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleCategory = (id) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const processFile = async (file) => {
    setError("");
    setPreview(URL.createObjectURL(file));

    try {
      setStep(STEPS.processing);
      const result = await processFrameImage(file, {
        onProgress: (_stage, text) => setProgressText(text),
      });
      setProcessed(result);
      setStep(STEPS.ready);
    } catch (err) {
      console.error(err);
      setStep(STEPS.error);
      setError(err.message || "İşlem başarısız oldu. Başka bir fotoğraf deneyin.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleSave = async () => {
    if (!processed) return;
    if (!colorName.trim() && !label.trim()) {
      setError("Renk adı veya etiket girin.");
      return;
    }

    setStep(STEPS.saving);
    setError("");

    try {
      const imageUrl = URL.createObjectURL(processed.blob);
      const entry = buildFrameEntry({
        code: code.trim() || null,
        colorName: colorName.trim() || null,
        label: label.trim() || null,
        categories: selectedCats,
        thickness: processed.thickness,
        defaultMm,
        imageUrl,
      });

      await saveCustomFrame(
        { ...entry, image: imageUrl },
        processed.blob
      );

      onSaved(entry);
      handleClose();
    } catch (err) {
      console.error(err);
      setStep(STEPS.ready);
      setError(err.message || "Kayıt başarısız.");
    }
  };

  const busy = [STEPS.processing, STEPS.saving].includes(step);

  return (
    <div className="fp-modal-backdrop" onClick={handleClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fp-modal-header">
          <h2>Çerçeve Ekle</h2>
          <button type="button" className="fp-modal-close" onClick={handleClose} aria-label="Kapat">
            ×
          </button>
        </div>

        <p className="fp-modal-desc">
          Çerçeve fotoğrafını yükleyin (JPG/PNG). Arka plan otomatik silinir, kenarlar hizalanır.
          Açık renkli düz arka plan (beyaz/karton) en iyi sonucu verir.
          <strong> Önemli:</strong> Fotoğrafı çerçeveye yakın kırpın; cetvel, ölçü yazısı (“20 cm”) veya cetvel görünmesin.
        </p>

        {step === STEPS.idle && (
          <button
            type="button"
            className="fp-modal-upload-zone"
            onClick={() => fileRef.current?.click()}
          >
            <span className="fp-modal-upload-icon">+</span>
            <span>Çerçeve fotoğrafı seç</span>
            <span className="fp-modal-upload-hint">JPG/PNG · karton veya düz arka plan · çerçeve ortada</span>
          </button>
        )}

        {busy && (
          <div className="fp-modal-progress">
            <div className="fp-modal-spinner" />
            <p>{step === STEPS.saving ? "Kaydediliyor…" : progressText || "Çerçeve işleniyor…"}</p>
            <p className="fp-modal-progress-sub">Çerçeve ortada, düz ve net olsun.</p>
          </div>
        )}

        {step === STEPS.ready && processed && (
          <div className="fp-modal-preview-row">
            {preview && (
              <div className="fp-modal-preview-box">
                <span className="fp-modal-preview-label">Orijinal</span>
                <img src={preview} alt="Orijinal" />
              </div>
            )}
            <div className="fp-modal-preview-box">
              <span className="fp-modal-preview-label">Hazır</span>
              <img src={processed.dataUrl} alt="İşlenmiş çerçeve" />
            </div>
          </div>
        )}

        {step === STEPS.ready && (
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

            <div className="fp-modal-field">
              <label>Renk adı</label>
              <input
                type="text"
                placeholder="ör. gümüş, ceviz, siyah"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
              />
            </div>

            <div className="fp-modal-field">
              <label>Etiket (opsiyonel)</label>
              <input
                type="text"
                placeholder="Boş bırakılırsa kod + renk kullanılır"
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
                {CATEGORY_OPTIONS.map((cat) => (
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

            <p className="fp-modal-meta">
              Kenar kalınlığı: <strong>{processed?.thickness}px</strong> (otomatik ölçüldü)
            </p>
          </div>
        )}

        {error && <p className="fp-modal-error">{error}</p>}

        <div className="fp-modal-actions">
          <button type="button" className="fp-modal-btn secondary" onClick={handleClose}>
            İptal
          </button>
          {step === STEPS.ready && (
            <button type="button" className="fp-modal-btn primary" onClick={handleSave}>
              Listeye Ekle
            </button>
          )}
          {(step === STEPS.error || step === STEPS.ready) && (
            <button
              type="button"
              className="fp-modal-btn secondary"
              onClick={() => {
                setStep(STEPS.idle);
                setError("");
                fileRef.current?.click();
              }}
            >
              Başka Fotoğraf
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
