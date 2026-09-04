import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { processFrameImage } from "../utils/frameProcessor";
import { EDITABLE_CATEGORY_OPTIONS, buildSeriesOptions, defaultMmFromSeriesLabel } from "../data/frameFormOptions";
import { buildFrameEntry, saveCustomFrame } from "../utils/customFramesStorage";
import {
  PASPARTU_ACCESSORY,
  PAPER_ACCESSORY,
  PASPARTU_CATEGORY_ID,
  PAPER_CATEGORY_ID,
} from "../data/paspartuOptions";
import SeriesCreateField from "./SeriesCreateField";

// fallback; overridden by prop when passed from parent
const DEFAULT_CATEGORY_OPTIONS = EDITABLE_CATEGORY_OPTIONS;

const STEPS = {
  idle: "idle",
  processing: "processing",
  ready: "ready",
  saving: "saving",
  error: "error",
};

const PURPOSE_COPY = {
  frame: {
    title: "Çerçeve Ekle",
    desc: "Çerçeve fotoğrafını yükleyin (JPG/PNG). Arka plan otomatik silinir, kenarlar hizalanır. Kayıt sunucuya yazılır; siz ve diğer cihazlar aynı listede görür. Açık renkli düz arka plan (beyaz/karton) en iyi sonucu verir.",
    upload: "Çerçeve fotoğrafı seç",
    hint: "JPG/PNG · karton veya düz arka plan · çerçeve ortada",
  },
  paspartu: {
    title: "Paspartu Ekle",
    desc: "Paspartu çerçevesi fotoğrafını yükleyin (JPG/PNG). Arka plan otomatik silinir, kenarlar hizalanır. Kayıt sunucuya yazılır; paspartu listesinde tüm cihazlarda görünür. Açık renkli düz arka plan en iyi sonucu verir.",
    upload: "Paspartu fotoğrafı seç",
    hint: "JPG/PNG · karton veya düz arka plan · çerçeve ortada",
  },
  paper: {
    title: "Kağıt Ekle",
    desc: "Kağıt fotoğrafını yükleyin (JPG/PNG). Aynı çerçeve sistemiyle işlenir ve kağıt seçeneklerine eklenir. Kayıt sunucuya yazılır; tüm cihazlarda görünür. Açık, düz arka plan en iyi sonucu verir.",
    upload: "Kağıt fotoğrafı seç",
    hint: "JPG/PNG · düz arka plan · kağıt ortada",
  },
};

export default function FrameAddModal({
  open,
  onClose,
  onSaved,
  purpose = "frame",
  categoryOptions,
  seriesOptions,
  defaultCode = "20 lik",
  defaultCategoryId = "20lik",
  defaultThicknessMm = 20,
  onAddSeries,
}) {
  const CATEGORY_OPTIONS = categoryOptions ?? DEFAULT_CATEGORY_OPTIONS;
  const effectiveSeriesOptions = seriesOptions ?? buildSeriesOptions();
  const fileRef = useRef(null);
  const sessionInitRef = useRef(false);
  const [step, setStep] = useState(STEPS.idle);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [processed, setProcessed] = useState(null);

  const [code, setCode] = useState(defaultCode);
  const [colorName, setColorName] = useState("");
  const [label, setLabel] = useState("");
  const [defaultMm, setDefaultMm] = useState(defaultThicknessMm);
  const [selectedCats, setSelectedCats] = useState(defaultCategoryId ? [defaultCategoryId] : []);

  const [progressText, setProgressText] = useState("");

  const isAccessory = purpose === "paspartu" || purpose === "paper";
  const copy = PURPOSE_COPY[purpose] ?? PURPOSE_COPY.frame;

  const applySeries = (seriesLabel, options = CATEGORY_OPTIONS) => {
    const trimmed = (seriesLabel ?? "").trim();
    setCode(trimmed);
    const cat = options.find((c) => c.label === trimmed);
    setSelectedCats(cat ? [cat.id] : []);
    if (trimmed) setDefaultMm(defaultMmFromSeriesLabel(trimmed));
  };

  const initForm = () => {
    if (purpose === "paspartu") {
      setCode("Paspartu");
      setSelectedCats([PASPARTU_CATEGORY_ID]);
      setDefaultMm(28);
      return;
    }
    if (purpose === "paper") {
      setCode("Kağıt");
      setSelectedCats([PAPER_CATEGORY_ID]);
      setDefaultMm(5);
      return;
    }
    applySeries(defaultCode);
    if (defaultCategoryId) setSelectedCats([defaultCategoryId]);
    setDefaultMm(defaultThicknessMm);
  };

  useEffect(() => {
    if (!open) {
      sessionInitRef.current = false;
      return;
    }
    if (sessionInitRef.current) return;
    sessionInitRef.current = true;
    initForm();
  }, [open, purpose, defaultCode, defaultCategoryId, defaultThicknessMm]);

  if (!open) return null;

  const reset = () => {
    setStep(STEPS.idle);
    setError("");
    setPreview(null);
    setProcessed(null);
    setProgressText("");
    setColorName("");
    setLabel("");
    initForm();
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
    if (!isAccessory && !code.trim()) {
      setError("Bir seri seçin veya yeni seri ekleyin.");
      return;
    }

    setStep(STEPS.saving);
    setError("");

    try {
      const codeTrim = isAccessory
        ? (purpose === "paspartu" ? "Paspartu" : "Kağıt")
        : (code.trim() || null);
      let categories = isAccessory
        ? [purpose === "paspartu" ? PASPARTU_CATEGORY_ID : PAPER_CATEGORY_ID]
        : [...selectedCats];
      if (!isAccessory && codeTrim) {
        const seriesCat = CATEGORY_OPTIONS.find((c) => c.label === codeTrim);
        if (seriesCat && !categories.includes(seriesCat.id)) {
          categories.push(seriesCat.id);
        }
      }

      const entry = buildFrameEntry({
        code: codeTrim,
        colorName: colorName.trim() || null,
        label: label.trim() || null,
        categories,
        thickness: processed.thickness,
        defaultMm,
        imageUrl: "",
      });
      if (purpose === "paspartu") entry.accessory = PASPARTU_ACCESSORY;
      if (purpose === "paper") entry.accessory = PAPER_ACCESSORY;

      const saved = await saveCustomFrame(entry, processed.blob);
      onSaved(saved);
      handleClose();
    } catch (err) {
      console.error(err);
      setStep(STEPS.ready);
      setError(err.message || "Kayıt başarısız.");
    }
  };

  const busy = [STEPS.processing, STEPS.saving].includes(step);

  return createPortal(
    <div className="fp-modal-backdrop" onClick={handleClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fp-modal-header">
          <h2>{copy.title}</h2>
          <button type="button" className="fp-modal-close" onClick={handleClose} aria-label="Kapat">
            ×
          </button>
        </div>

        <p className="fp-modal-desc">
          {copy.desc}
          <strong> Önemli:</strong> Fotoğrafı yakın kırpın; cetvel, ölçü yazısı (“20 cm”) veya cetvel görünmesin.
        </p>

        {step === STEPS.idle && (
          <button
            type="button"
            className="fp-modal-upload-zone"
            onClick={() => fileRef.current?.click()}
          >
            <span className="fp-modal-upload-icon">+</span>
            <span>{copy.upload}</span>
            <span className="fp-modal-upload-hint">{copy.hint}</span>
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
            {!isAccessory && (
              <div className="fp-modal-field">
                <label>Seri</label>
                <div className="fp-category-row fp-modal-series-row">
                  {(code && !effectiveSeriesOptions.includes(code)
                    ? [...effectiveSeriesOptions.filter(Boolean), code]
                    : effectiveSeriesOptions.filter(Boolean)
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`fp-category-chip${code === s ? " active" : ""}`}
                      onClick={() => applySeries(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
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

            <div className="fp-modal-field">
              <label>Renk adı</label>
              <input
                type="text"
                placeholder={isAccessory ? "ör. krem, fildişi, siyah" : "ör. gümüş, ceviz, siyah"}
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
                onChange={(e) => setDefaultMm(Number(e.target.value) || (isAccessory ? 10 : 20))}
              />
            </div>

            {!isAccessory && (
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
            )}

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
    </div>,
    document.body
  );
}
