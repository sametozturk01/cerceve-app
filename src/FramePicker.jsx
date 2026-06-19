import { useState, useRef, useEffect, useMemo } from "react";
import framesCatalog from "./data/frames.json";
import FrameAddModal from "./components/FrameAddModal";
import FrameEditModal from "./components/FrameEditModal";
import PreviewFullscreen from "./components/PreviewFullscreen";
import PhotoSourcePicker from "./components/PhotoSourcePicker";
import Toast from "./components/Toast";
import { loadCustomFrames, revokeFrameUrls, deleteCustomFrame, mergeFrameMeta } from "./utils/customFramesStorage";
import { loadHiddenFrameIds, hideFrameId } from "./utils/hiddenFramesStorage";
import { loadFrameOverrides } from "./utils/frameOverridesStorage";

// ─── Veri (frames.json) ───────────────────────────────────────────────────────

const FRAME_CATEGORIES = framesCatalog.categories;
const FRAME_TYPES = framesCatalog.frames;

const DECOR_SAMPLES = [
  { 
    id: 'benimSalon',
    label: 'Benim Salonum',
    url: '/koltuk.png'
  },
];

const SIZES = [
  { id: "20x20", label: "20×20 cm", price: 149 },
  { id: "30x30", label: "30×30 cm", price: 199 },
  { id: "40x40", label: "40×40 cm", price: 279 },
  { id: "50x50", label: "50×50 cm", price: 349 },
  { id: "60x40", label: "60×40 cm", price: 319 },
  { id: "80x60", label: "80×60 cm", price: 449 },
];

const FRAME_PRICE = { none: 0, koseli: 89, ince: 59, yuvarlak: 99 };

const PLACEHOLDER_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#87CEEB"/>
          <stop offset="100%" stop-color="#E0F4FF"/>
        </linearGradient>
      </defs>
      <rect width="640" height="640" fill="url(#sky)"/>
      <ellipse cx="180" cy="160" rx="110" ry="60" fill="#fff" opacity="0.7"/>
      <ellipse cx="450" cy="130" rx="90"  ry="50" fill="#fff" opacity="0.6"/>
      <polygon points="120,450 260,270 400,450" fill="#6a7f5c"/>
      <polygon points="320,450 480,250 640,450" fill="#5a7048"/>
      <rect x="0"   y="450" width="640" height="190" fill="#8bc34a" opacity="0.6"/>
      <rect x="0"   y="500" width="640" height="140" fill="#7cb342" opacity="0.5"/>
      <rect x="240" y="375" width="45"  height="75"  fill="#8B4513"/>
      <rect x="218" y="345" width="88"  height="44"  fill="#CD5C5C"/>
    </svg>
  `);

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const imgCache = {};
function loadImage(src) {
  if (imgCache[src]) return Promise.resolve(imgCache[src]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => { imgCache[src] = img; resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Gümüş 20: canvas üzerinde fırçalı metal (fotoğraf tonları) ───────────────

const METAL = {
  outer: "#EDECEA",
  face:  "#D8DCDC",
  mid:   "#C8CCCC",
  inner: "#A8ACAC",
  deep:  "#8E9292",
};

const metalPatternCache = new Map();

function metalNoise(i) {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function getBrushedMetalPattern(ctx, thickPx) {
  const key = Math.max(4, Math.round(thickPx));
  if (metalPatternCache.has(key)) return metalPatternCache.get(key);

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const tileW = 512;
  const tileH = key;
  const off = document.createElement("canvas");
  off.width = tileW * dpr;
  off.height = tileH * dpr;
  const cx = off.getContext("2d");
  cx.scale(dpr, dpr);

  const g = cx.createLinearGradient(0, 0, 0, tileH);
  g.addColorStop(0, METAL.outer);
  g.addColorStop(0.1, METAL.face);
  g.addColorStop(0.72, METAL.mid);
  g.addColorStop(0.9, METAL.inner);
  g.addColorStop(1, METAL.deep);
  cx.fillStyle = g;
  cx.fillRect(0, 0, tileW, tileH);

  for (let x = 0; x < tileW; x++) {
    const n = metalNoise(x);
    const highlight = x % 4 < 2;
    cx.fillStyle = highlight
      ? `rgba(255,255,255,${0.018 + n * 0.04})`
      : `rgba(120,125,125,${0.01 + n * 0.025})`;
    cx.fillRect(x, 0, 1, tileH);
  }

  cx.fillStyle = "rgba(255,255,255,0.28)";
  cx.fillRect(0, tileH - 1, tileW, 1);

  const pattern = ctx.createPattern(off, "repeat");
  metalPatternCache.set(key, pattern);
  return pattern;
}

function drawFlatMetalFrame(ctx, x, y, w, h, t) {
  const pat = getBrushedMetalPattern(ctx, t);

  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, t);

  ctx.save();
  ctx.translate(x, y + h);
  ctx.scale(1, -1);
  ctx.fillRect(0, 0, w, t);
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.fillRect(0, 0, h, t);
  ctx.restore();

  ctx.save();
  ctx.translate(x + w, y + h);
  ctx.rotate(Math.PI);
  ctx.fillRect(0, 0, h, t);
  ctx.restore();
}

// ─── Canvas Önizleme (MM HESAPLAMALI GERÇEK DÜNYA MOTORU) ─────────────────────

const CANVAS_SIZE = 640;


function PreviewCanvas({ imageUrl, frameType, frameColor, activeView, selectedSize, customThickness }) {
  const canvasRef = useRef(null);
  const frameId = frameType?.id ?? "none";
  const frameImage = frameType?.image ?? null;
  const frameRender = frameType?.render ?? null;
  const sliceSize = frameType?.thickness ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const ctx = canvas.getContext("2d", { alpha: false });
    const dpr = window.devicePixelRatio || 1;
    const W = CANVAS_SIZE;
    const H = CANVAS_SIZE;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    async function draw() {
      ctx.fillStyle = activeView === "dekor" ? "#f8fafc" : "#ffffff";
      ctx.fillRect(0, 0, W, H);

      if (activeView === "dekor") {
        const decorImg = await loadImage(DECOR_SAMPLES[0].url).catch(() => null);
        if (cancelled) return;
        if (decorImg) ctx.drawImage(decorImg, 0, 0, W, H);
      }

      const photo = await loadImage(imageUrl).catch(() => null);
      if (cancelled || !photo) return;

      const [sizeW, sizeH] = selectedSize.id.split("x").map(Number);
      const frameRatio = sizeW / sizeH;

      const maxDimCm = Math.max(sizeW, sizeH);
      const sizeMultiplier = 0.6 + (maxDimCm / 80) * 0.4;

      const baseDrawSize = W * (activeView === "dekor" ? 0.35 : 0.85);
      const maxDrawSize = baseDrawSize * sizeMultiplier;

      let tW = maxDrawSize;
      let tH = maxDrawSize;

      if (frameRatio > 1) {
        tH = tW / frameRatio;
      } else if (frameRatio < 1) {
        tW = tH * frameRatio;
      }

      const tX = (W - tW) / 2;
      const tY = activeView === "dekor" ? H * 0.15 : (H - tH) / 2;

      const pxPerMm = tW / (sizeW * 10);
      const rawThickPx = customThickness * pxPerMm;

      const targetThickPx = Math.min(rawThickPx, tW / 2 - 2, tH / 2 - 2);

      const ix = tX + targetThickPx - 3;
      const iy = tY + targetThickPx - 3;
      const iw = tW - 2 * targetThickPx + 6;
      const ih = tH - 2 * targetThickPx + 6;

      const imgRatio = photo.width / photo.height;
      const targetRatio = iw / ih;

      let sx = 0;
      let sy = 0;
      let sWidth = photo.width;
      let sHeight = photo.height;

      if (imgRatio > targetRatio) {
        sWidth = photo.height * targetRatio;
        sx = (photo.width - sWidth) / 2;
      } else {
        sHeight = photo.width / targetRatio;
        sy = (photo.height - sHeight) / 2;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(ix, iy, iw, ih);
      ctx.clip();
      ctx.drawImage(photo, sx, sy, sWidth, sHeight, ix, iy, iw, ih);
      ctx.restore();

      if (frameRender === "flatMetal") {
        drawFlatMetalFrame(ctx, tX, tY, tW, tH, targetThickPx);
      } else if (frameImage) {
        const frameImg = await loadImage(frameImage).catch(() => null);
        if (cancelled || !frameImg) return;

        const sw = frameImg.width;
        const sh = frameImg.height;
        const s = sliceSize;
        const t = targetThickPx;

        if (s > 0) {
          ctx.drawImage(frameImg, 0, 0, s, s, tX, tY, t, t);
          ctx.drawImage(frameImg, sw - s, 0, s, s, tX + tW - t, tY, t, t);
          ctx.drawImage(frameImg, 0, sh - s, s, s, tX, tY + tH - t, t, t);
          ctx.drawImage(frameImg, sw - s, sh - s, s, s, tX + tW - t, tY + tH - t, t, t);

          ctx.drawImage(frameImg, s, 0, sw - 2 * s, s, tX + t, tY, tW - 2 * t, t);
          ctx.drawImage(frameImg, s, sh - s, sw - 2 * s, s, tX + t, tY + tH - t, tW - 2 * t, t);
          ctx.drawImage(frameImg, 0, s, s, sh - 2 * s, tX, tY + t, t, tH - 2 * t);
          ctx.drawImage(frameImg, sw - s, s, s, sh - 2 * s, tX + tW - t, tY + t, t, tH - 2 * t);
        } else {
          ctx.drawImage(frameImg, tX, tY, tW, tH);
        }
      }

      if (cancelled) return;

      if (activeView === "dekor" || activeView === "tablo") {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 10;
        ctx.strokeRect(tX, tY, tW, tH);
      }
    }

    draw();

    return () => {
      cancelled = true;
    };
  }, [
    imageUrl,
    frameId,
    frameImage,
    frameRender,
    sliceSize,
    frameColor?.id,
    activeView,
    selectedSize.id,
    customThickness,
  ]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block" }} />;
}

// ─── Çerçeve Swatch ───────────────────────────────────────────────────────────

function FrameSwatch({ frame }) {
  if (frame.id === "none") {
    return (
      <div className="fp-swatch" style={{ background: "#f0f0f0" }}>
        <div className="fp-swatch-none" />
      </div>
    );
  }

  if (frame.render === "flatMetal") {
    return (
      <div
        className="fp-swatch"
        style={{
          background: `linear-gradient(180deg, ${METAL.outer} 0%, ${METAL.face} 35%, ${METAL.inner} 100%)`,
          padding: 3,
          borderRadius: 2,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        <div className="fp-swatch-inner" style={{ background: "#1a1a1a", borderRadius: 1 }} />
      </div>
    );
  }

  if (frame.image) {
    return (
      <div className="fp-swatch">
        <img
          key={`${frame.id}:${frame.image}`}
          src={frame.image}
          alt={frame.label}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 2 }}
        />
      </div>
    );
  }

  const color = frame.colors?.[0];
  const bg    = color?.hex ?? "#1a1a1a";
  return (
    <div
      className="fp-swatch"
      style={{
        background:   bg,
        borderRadius: frame.radius > 0 ? 6 : 2,
        padding:      Math.max(2, frame.thickness / 16),
        border:       color?.stroke ? `1px solid ${color.stroke}` : "none",
      }}
    >
      <div
        className="fp-swatch-inner"
        style={{ borderRadius: frame.radius > 0 ? 4 : 1 }}
      />
    </div>
  );
}

function frameSearchText(frame) {
  const catLabels = (frame.categories ?? [])
    .map((id) => FRAME_CATEGORIES.find((c) => c.id === id)?.label)
    .filter(Boolean);
  return [frame.label, frame.code, frame.colorName, frame.id, ...catLabels]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

function frameMatchesCategory(frame, categoryId) {
  if (categoryId === "all") return true;
  return (frame.categories ?? []).includes(categoryId);
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function FramePicker() {
  const [uploadedImage, setUploadedImage] = useState(PLACEHOLDER_SRC);
  
  const [selectedFrame, setSelectedFrame] = useState(FRAME_TYPES[1]);
  const [selectedColor, setSelectedColor] = useState(FRAME_TYPES[1].colors[0]);
  const [selectedSize,  setSelectedSize]  = useState(SIZES[0]);
  const [activeView,    setActiveView]    = useState("tablo");
  const [added,         setAdded]         = useState(false);
  const [frameSearch,   setFrameSearch]   = useState("");
  const [frameCategory, setFrameCategory] = useState("all");
  const [customFrames,  setCustomFrames]  = useState([]);
  const [hiddenFrameIds, setHiddenFrameIds] = useState(() => loadHiddenFrameIds());
  const [frameOverrides, setFrameOverrides] = useState(() => loadFrameOverrides());
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFrame, setEditingFrame] = useState(null);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [toast,         setToast]         = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadCustomFrames().then((frames) => {
      if (active) setCustomFrames(frames);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => () => revokeFrameUrls(customFrames), [customFrames]);

  const allFrames = useMemo(
    () => {
      const catalog = FRAME_TYPES
        .filter((f) => !hiddenFrameIds.has(f.id))
        .map((f) => {
          const patch = frameOverrides[f.id];
          return patch ? mergeFrameMeta(f, patch) : f;
        });
      return [...catalog, ...customFrames];
    },
    [customFrames, hiddenFrameIds, frameOverrides]
  );

  useEffect(() => {
    const latest = allFrames.find((f) => f.id === selectedFrame.id);
    if (!latest) return;
    if (
      latest.image !== selectedFrame.image
      || latest.thickness !== selectedFrame.thickness
      || latest.label !== selectedFrame.label
      || latest.defaultMm !== selectedFrame.defaultMm
    ) {
      setSelectedFrame(latest);
      setSelectedColor(latest.colors?.[0] ?? null);
    }
  }, [allFrames, selectedFrame.id, selectedFrame.image, selectedFrame.thickness, selectedFrame.label, selectedFrame.defaultMm]);

  const pickFallbackFrame = (excludeId) =>
    allFrames.find((f) => f.id !== excludeId) ?? FRAME_TYPES[0];

  const [isCustomSize, setIsCustomSize] = useState(false);
  const [customW, setCustomW] = useState(""); 
  const [customH, setCustomH] = useState(""); 

  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const openGalleryPicker = () => {
    setShowPhotoPicker(false);
    galleryInputRef.current?.click();
  };

  const openCameraPicker = () => {
    setShowPhotoPicker(false);
    cameraInputRef.current?.click();
  };

  const handleFrameSelect = (frame) => {
    setSelectedFrame(frame);
    setSelectedColor(frame.colors?.[0] ?? null);
  };

  const searchQuery = frameSearch.trim().toLocaleLowerCase("tr-TR");
  const filteredFrames = allFrames.filter((f) => {
    if (!frameMatchesCategory(f, frameCategory)) return false;
    if (!searchQuery) return true;
    return frameSearchText(f).includes(searchQuery);
  });

  const handleFrameAdded = (entry) => {
    setCustomFrames((prev) => [...prev, entry]);
    setSelectedFrame(entry);
    setSelectedColor(entry.colors?.[0] ?? null);
    setFrameCategory("custom");
  };

  const handleFrameEdited = (updated) => {
    if (updated.custom) {
      setCustomFrames((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } else {
      setFrameOverrides(loadFrameOverrides());
    }
    if (selectedFrame.id === updated.id) {
      setSelectedFrame(updated);
      setSelectedColor(updated.colors?.[0] ?? null);
    }
    setEditingFrame(null);
    showToast({ type: "success", message: "Çerçeve güncellendi." }, 2500);
  };

  const openEditFrame = (frame) => {
    setEditingFrame(frame);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingFrame(null);
  };

  const showToast = (nextToast, autoDismissMs = 0) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(nextToast);
    if (autoDismissMs > 0) {
      toastTimerRef.current = setTimeout(() => setToast(null), autoDismissMs);
    }
  };

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const requestRemoveFrame = (frame) => {
    const name = frame.label || frame.colorName || frame.code || "Bu çerçeve";
    showToast({
      type: "confirm",
      frame,
      message: `"${name}" kaldırılsın mı?`,
    });
  };

  const confirmRemoveFrame = async () => {
    const frame = toast?.frame;
    if (!frame) return;

    try {
      if (frame.custom) {
        await deleteCustomFrame(frame.id);
        if (frame.image?.startsWith("blob:")) URL.revokeObjectURL(frame.image);
        setCustomFrames((prev) => prev.filter((f) => f.id !== frame.id));
      } else {
        setHiddenFrameIds(hideFrameId(frame.id));
      }

      if (selectedFrame.id === frame.id) {
        const fallback = pickFallbackFrame(frame.id);
        setSelectedFrame(fallback);
        setSelectedColor(fallback.colors?.[0] ?? null);
      }
      showToast({ type: "success", message: "Çerçeve kaldırıldı." }, 2800);
    } catch (err) {
      console.error(err);
      showToast({ type: "error", message: "Çerçeve kaldırılamadı." }, 3200);
    }
  };

  const safeW = Number(customW) || 0;
  const safeH = Number(customH) || 0;

  const customBasePrice = Math.round(safeW * safeH * 0.15); 
  const currentBasePrice = isCustomSize ? customBasePrice : selectedSize.price;
  const totalPrice = currentBasePrice + (FRAME_PRICE[selectedFrame.id] ?? 0);

  const displayW = safeW > 0 ? safeW : 50;
  const displayH = safeH > 0 ? safeH : 50;

  const activeSizeForCanvas = isCustomSize 
    ? { id: `${displayW}x${displayH}` } 
    : selectedSize;

  const activeThickness = selectedFrame.defaultMm;

  const previewProps = {
    imageUrl: uploadedImage,
    frameType: selectedFrame,
    frameColor: selectedColor,
    activeView,
    selectedSize: activeSizeForCanvas,
    customThickness: activeThickness,
  };

  return (
    <div className="fp-container">

      {/* ══ Sol: Önizleme ══ */}
      <div className="fp-left">
        <div className="fp-preview-box">
          <button
            type="button"
            className="fp-preview-fullscreen-btn"
            title="Tam ekran gör"
            aria-label="Tam ekran gör"
            onClick={() => setShowFullscreenPreview(true)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <PreviewCanvas key={previewProps.frameType.id} {...previewProps} />
        </div>

        <button
          className="fp-upload-btn"
          type="button"
          onClick={() => setShowPhotoPicker(true)}
        >
          Fotoğraf Yükle
        </button>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '24px', border: '1px solid #e2e8f0', marginTop: '5px' }}>
          <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            👁️ Önizleme Modu
          </p>
          
          <div className="fp-view-toggle">
            <button
              className={`fp-view-btn${activeView === "tablo" ? " active" : ""}`}
              onClick={() => setActiveView("tablo")}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '12px 0 !important' }}
            >
              <span style={{ fontSize: '14px' }}>Tablo</span>
              <span style={{ fontSize: '9px', opacity: 0.75, letterSpacing: '0.5px' }}>YAKINDAN İNCELE</span>
            </button>
            
            <button
              className={`fp-view-btn${activeView === "dekor" ? " active" : ""}`}
              onClick={() => setActiveView("dekor")}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '12px 0 !important' }}
            >
              <span style={{ fontSize: '14px' }}>Dekor</span>
              <span style={{ fontSize: '9px', opacity: 0.75, letterSpacing: '0.5px' }}>DUVARDA GÖR</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══ Sağ: Seçenekler ══ */}
      <div className="fp-right">

        <div className="fp-search-wrap">
          <input
            type="search"
            className="fp-search-input"
            placeholder="Çerçeve ara… (ör. FA 20, gümüş, sarı)"
            value={frameSearch}
            onChange={(e) => setFrameSearch(e.target.value)}
          />
        </div>

        <div className="fp-category-row">
          {FRAME_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`fp-category-chip${frameCategory === cat.id ? " active" : ""}`}
              onClick={() => setFrameCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
          <button
            type="button"
            className="fp-category-chip fp-add-frame-chip"
            onClick={() => setShowAddModal(true)}
          >
            + Çerçeve Ekle
          </button>
        </div>

        <p className="fp-section-label">Çerçeve Tipi</p>
        <div className="fp-frame-grid">
          {filteredFrames.length > 0 ? (
            filteredFrames.map((f) => (
              <div
                key={f.id}
                className={`fp-frame-card${selectedFrame.id === f.id ? " active" : ""}`}
              >
                {f.id !== "none" && (
                  <div className="fp-frame-card-tools">
                    <button
                      type="button"
                      className="fp-frame-tool fp-frame-tool-edit"
                      title="Çerçeve Düzenle"
                      aria-label="Çerçeve Düzenle"
                      onClick={() => openEditFrame(f)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="fp-frame-tool fp-frame-tool-remove"
                      title="Çerçeve Kaldır"
                      aria-label="Çerçeve Kaldır"
                      onClick={() => requestRemoveFrame(f)}
                    >
                      ×
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className={`fp-frame-btn${selectedFrame.id === f.id ? " active" : ""}`}
                  onClick={() => handleFrameSelect(f)}
                >
                  <FrameSwatch frame={f} />
                  <span className="fp-frame-btn-label">
                    {f.code ? (
                      <>
                        {f.code}{" "}
                        <span className="fp-frame-color-name">{f.colorName}</span>
                      </>
                    ) : (
                      f.label
                    )}
                  </span>
                </button>
              </div>
            ))
          ) : (
            <p className="fp-search-empty">Sonuç bulunamadı.</p>
          )}
        </div>

        {selectedFrame.colors?.length > 0 && (
          <>
            <p className="fp-section-label">Çerçeve Rengi</p>
            <div className="fp-color-row">
              {selectedFrame.colors.map((c) => (
                <button
                  key={c.id}
                  title={c.label}
                  className={`fp-color-dot${selectedColor?.id === c.id ? " active" : ""}`}
                  onClick={() => setSelectedColor(c)}
                  style={{
                    background: c.hex,
                    border: c.stroke
                      ? `1.5px solid ${c.stroke}`
                      : "1.5px solid transparent",
                  }}
                />
              ))}
            </div>
          </>
        )}

        <p className="fp-section-label">Boyut</p>
        <div className="fp-size-grid">
          {SIZES.map((s) => (
            <button
              key={s.id}
              className={`fp-size-btn${!isCustomSize && selectedSize.id === s.id ? " active" : ""}`}
              onClick={() => {
                setSelectedSize(s);
                setIsCustomSize(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="fp-section-label" style={{ marginTop: '20px' }}>Seçenekler</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}></div>

        <div style={{ marginTop: '15px' }}>
          {/* BUTON 1: ÖZEL ÖLÇÜ */}
          <button 
            className="fp-upload-btn" 
            style={{ 
              marginTop: 0, 
              minHeight: '45px',       // Sabit height yerine minHeight yapıyoruz
              height: 'auto',           // Yazı sığmazsa buton otomatik uzasın
              padding: '10px 15px',     // İçeriden nefes payı veriyoruz
              lineHeight: '1.2',        // Satırlar birbirine girmesin
              fontSize: '13px', 
              background: isCustomSize ? '#4f46e5' : '#6366f1' 
            }}
            onClick={() => { 
              setIsCustomSize(!isCustomSize); 
              if(!isCustomSize){setCustomW(""); setCustomH("");} 
            }}
          >
            {isCustomSize ? " ÖZEL ÖLÇÜYÜ KAPAT" : " İSTEĞE BAĞLI ÖZEL ÖLÇÜ"}
          </button>
          
          {isCustomSize && (
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
               
               {/* TEMİZLE BUTONU VE BAŞLIK YAN YANA */}
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                 <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                   Özel Tablo Ölçüsü
                 </label>
                 <button 
                   onClick={() => { setCustomW(""); setCustomH(""); }}
                   style={{ background: 'transparent', border: 'none', color: '#e11d48', fontSize: '10px', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                 >
                   ↺ TEMİZLE
                 </button>
               </div>

               <div style={{ display: 'flex', gap: '15px' }}>
                 <div style={{ flex: 1 }}>
                   <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                     En (Genişlik)
                   </label>
                   <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px' }}>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customW} 
                        onChange={e => setCustomW(e.target.value.replace(/[^0-9]/g, ''))} 
                        placeholder="Örn: 50"
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a' }} 
                      />
                      <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, marginLeft: '5px' }}>cm</span>
                   </div>
                 </div>

                 <div style={{ flex: 1 }}>
                   <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                     Boy (Yükseklik)
                   </label>
                   <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px' }}>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customH} 
                        onChange={e => setCustomH(e.target.value.replace(/[^0-9]/g, ''))} 
                        placeholder="Örn: 70"
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a' }} 
                      />
                      <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, marginLeft: '5px' }}>cm</span>
                   </div>
                 </div>
               </div>

            </div>
          )}
        </div>

        <div className="fp-price-row">
          <span className="fp-price">
            {totalPrice.toLocaleString("tr-TR")} ₺
          </span>
          {selectedFrame.id !== "none" && (
            <span className="fp-price-sub">
              Çerçeve: +{FRAME_PRICE[selectedFrame.id]} ₺
            </span>
          )}
        </div>

      </div>

      <PhotoSourcePicker
        open={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onPickGallery={openGalleryPicker}
        onPickCamera={openCameraPicker}
      />

      <PreviewFullscreen
        open={showFullscreenPreview}
        onClose={() => setShowFullscreenPreview(false)}
      >
        <PreviewCanvas key={`fs-${previewProps.frameType.id}`} {...previewProps} />
      </PreviewFullscreen>

      <FrameAddModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={handleFrameAdded}
      />

      <FrameEditModal
        open={showEditModal}
        frame={editingFrame}
        onClose={closeEditModal}
        onSaved={handleFrameEdited}
      />

      <Toast
        toast={toast}
        onDismiss={() => setToast(null)}
        onConfirm={confirmRemoveFrame}
      />
    </div>
  );
}