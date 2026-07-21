import { useState, useRef, useEffect, useMemo } from "react";
import framesCatalog from "./data/frames.json";
import FrameAddModal from "./components/FrameAddModal";
import FrameEditModal from "./components/FrameEditModal";
import PreviewFullscreen from "./components/PreviewFullscreen";
import PhotoSourcePicker from "./components/PhotoSourcePicker";
import Toast from "./components/Toast";
import HorizontalScrollStrip from "./components/HorizontalScrollStrip";
import { loadCustomFrames, revokeFrameUrls, deleteCustomFrame, mergeFrameMeta, applyCatalogOverride } from "./utils/customFramesStorage";
import {
  loadHiddenFrameIds,
  hideFrameId,
  unhideFrameId,
} from "./utils/hiddenFramesStorage";
import {
  loadFrameOverrides,
  saveFrameOverride,
  overridePatchFromSavedFrame,
} from "./utils/frameOverridesStorage";
import {
  formatTurkishPrice,
  linePriceForSize,
} from "./utils/framePricing";
import { getFrameDisplayLabel } from "./utils/frameDisplay";
import { loadCustomCategories, addCustomCategory, deleteCustomCategory } from "./utils/categoriesStorage";
import { loadHiddenSeriesIds, hideSeriesCategory } from "./utils/hiddenSeriesStorage";
import { BASE_CATEGORY_OPTIONS, buildSeriesOptions } from "./data/frameFormOptions";
import { SIZE_OPTIONS, parseSizeId } from "./data/sizes";

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

const SIZES = SIZE_OPTIONS;

const FRAME_PRICE = { none: 0 };

function getActiveSizeDimensions(isCustomSize, customW, customH, selectedSize) {
  if (isCustomSize) {
    return {
      widthCm: Math.max(0, Number(customW) || 0),
      heightCm: Math.max(0, Number(customH) || 0),
    };
  }
  const parsed = parseSizeId(selectedSize?.id);
  return parsed ?? { widthCm: 0, heightCm: 0 };
}

function calculateLinePrice({ frame, widthCm, heightCm }) {
  return linePriceForSize(frame, FRAME_PRICE, widthCm, heightCm);
}

function PriceLineList({ framePrice, pleksiPrice, camPrice, className = "" }) {
  const showPleksi = pleksiPrice > 0;
  const showCam = camPrice > 0;
  return (
    <ul className={`fp-price-lines ${className}`.trim()}>
      <li>
        <span>Çerçeve</span>
        <span>{formatTurkishPrice(framePrice)} ₺</span>
      </li>
      {showPleksi && (
        <li>
          <span>Pleksi</span>
          <span>{formatTurkishPrice(pleksiPrice)} ₺</span>
        </li>
      )}
      {showCam && (
        <li>
          <span>Cam</span>
          <span>{formatTurkishPrice(camPrice)} ₺</span>
        </li>
      )}
    </ul>
  );
}

function buildSizeLabel(isCustomSize, customW, customH, selectedSize) {
  const w = Number(customW) || 0;
  const h = Number(customH) || 0;
  if (isCustomSize && w > 0 && h > 0) return `${w}×${h} cm`;
  return selectedSize.label;
}

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

function drawFrameShadow(ctx, x, y, w, h, strong = false) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);

  ctx.save();
  ctx.shadowColor = strong ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.45)";
  ctx.shadowBlur = strong ? 22 : 18;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "rgba(0,0,0,0.01)";
  ctx.fillRect(rx, ry, rw, rh);
  ctx.restore();
}

function isLightFrameColor(color) {
  const hex = color?.hex;
  if (!hex?.startsWith("#")) return false;
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r + g + b) / 3 > 190;
}

function drawLightFrameOutline(ctx, x, y, w, h) {
  const rx = Math.round(x) + 0.5;
  const ry = Math.round(y) + 0.5;
  const rw = Math.round(w) - 1;
  const rh = Math.round(h) - 1;

  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.restore();
}

function drawNineSliceFrame(ctx, frameImg, x, y, w, h, slicePx, thickPx) {
  const sw = frameImg.width;
  const sh = frameImg.height;
  const s = slicePx;
  const t = Math.max(1, Math.round(thickPx));
  const fx = Math.round(x);
  const fy = Math.round(y);
  const fw = Math.round(w);
  const fh = Math.round(h);
  const bleed = 2;

  const smooth = ctx.imageSmoothingEnabled;
  const downscale = slicePx > thickPx * 1.25;
  ctx.imageSmoothingEnabled = downscale;
  if (downscale) ctx.imageSmoothingQuality = "high";

  const blit = (sx, sy, sW, sH, dx, dy, dW, dH) => {
    if (sW <= 0 || sH <= 0 || dW <= 0 || dH <= 0) return;
    ctx.drawImage(frameImg, sx, sy, sW, sH, dx, dy, dW, dH);
  };

  // Köşeler önce; kenarlar üstte bindirme ile mitre boşluğu kalmaz
  blit(0, 0, s, s, fx, fy, t, t);
  blit(sw - s, 0, s, s, fx + fw - t, fy, t, t);
  blit(0, sh - s, s, s, fx, fy + fh - t, t, t);
  blit(sw - s, sh - s, s, s, fx + fw - t, fy + fh - t, t, t);

  blit(s, 0, sw - 2 * s, s, fx + t - bleed, fy, fw - 2 * t + 2 * bleed, t);
  blit(s, sh - s, sw - 2 * s, s, fx + t - bleed, fy + fh - t, fw - 2 * t + 2 * bleed, t);
  blit(0, s, s, sh - 2 * s, fx, fy + t - bleed, t, fh - 2 * t + 2 * bleed);
  blit(sw - s, s, s, sh - 2 * s, fx + fw - t, fy + t - bleed, t, fh - 2 * t + 2 * bleed);

  ctx.imageSmoothingEnabled = smooth;
}

// ─── Canvas Önizleme (MM HESAPLAMALI GERÇEK DÜNYA MOTORU) ─────────────────────

const CANVAS_SIZE = 640;
const FULLSCREEN_MARGIN = 28;

function getFullscreenCanvasSize(frameRatio, viewportW, viewportH) {
  const maxW = viewportW * 0.96;
  const maxH = viewportH * 0.88;
  const margin = FULLSCREEN_MARGIN * 2;

  let innerW;
  let innerH;
  if (frameRatio >= (maxW - margin) / (maxH - margin)) {
    innerW = maxW - margin;
    innerH = innerW / frameRatio;
  } else {
    innerH = maxH - margin;
    innerW = innerH * frameRatio;
  }

  return {
    w: Math.round(innerW + margin),
    h: Math.round(innerH + margin),
  };
}

function computeFrameLayout(W, H, sizeW, sizeH, activeView, fullscreen, customThickness) {
  const frameRatio = sizeW / sizeH;
  const maxDimCm = Math.max(sizeW, sizeH);

  let tW;
  let tH;

  if (fullscreen) {
    const margin = FULLSCREEN_MARGIN;
    const availW = W - margin * 2;
    const availH = H - margin * 2;

    if (frameRatio >= availW / availH) {
      tW = availW;
      tH = tW / frameRatio;
    } else {
      tH = availH;
      tW = tH * frameRatio;
    }
  } else {
    const sizeMultiplier = 0.6 + (maxDimCm / 80) * 0.4;
    const baseDrawSize = W * (activeView === "dekor" ? 0.35 : 0.85);
    const maxDrawSize = baseDrawSize * sizeMultiplier;
    tW = maxDrawSize;
    tH = maxDrawSize;

    if (frameRatio > 1) {
      tH = tW / frameRatio;
    } else if (frameRatio < 1) {
      tW = tH * frameRatio;
    }
  }

  const tX = (W - tW) / 2;
  const tY = fullscreen || activeView !== "dekor" ? (H - tH) / 2 : H * 0.15;

  const pxPerMm = tW / (sizeW * 10);
  const rawThickPx = customThickness * pxPerMm;
  const targetThickPx = Math.max(1, Math.round(Math.min(rawThickPx, tW / 2 - 2, tH / 2 - 2)));

  const ix = Math.round(tX + targetThickPx);
  const iy = Math.round(tY + targetThickPx);
  const iw = Math.round(tW - 2 * targetThickPx);
  const ih = Math.round(tH - 2 * targetThickPx);

  return { tX, tY, tW, tH, targetThickPx, ix, iy, iw, ih };
}

function PreviewCanvas({
  imageUrl,
  frameType,
  frameColor,
  activeView,
  selectedSize,
  customThickness,
  fullscreen = false,
}) {
  const canvasRef = useRef(null);
  const frameId = frameType?.id ?? "none";
  const frameImage = frameType?.image ?? null;
  const frameRender = frameType?.render ?? null;
  const sliceSize = frameType?.thickness ?? 0;

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const ctx = canvas.getContext("2d", { alpha: false });
    const dpr = window.devicePixelRatio || 1;

    const [sizeW, sizeH] = selectedSize.id.split("x").map(Number);
    const frameRatio = sizeW / sizeH;
    const canvasSize = fullscreen
      ? getFullscreenCanvasSize(frameRatio, viewport.w, viewport.h)
      : { w: CANVAS_SIZE, h: CANVAS_SIZE };
    const W = canvasSize.w;
    const H = canvasSize.h;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    async function draw() {
      ctx.fillStyle = activeView === "dekor" ? "#f8fafc" : "#e8eaed";
      ctx.fillRect(0, 0, W, H);

      if (activeView === "dekor") {
        const decorImg = await loadImage(DECOR_SAMPLES[0].url).catch(() => null);
        if (cancelled) return;
        if (decorImg) ctx.drawImage(decorImg, 0, 0, W, H);
      }

      const photo = await loadImage(imageUrl).catch(() => null);
      if (cancelled || !photo) return;

      const {
        tX,
        tY,
        tW,
        tH,
        targetThickPx,
        ix,
        iy,
        iw,
        ih,
      } = computeFrameLayout(W, H, sizeW, sizeH, activeView, fullscreen, customThickness);

      if (!fullscreen && (activeView === "dekor" || activeView === "tablo")) {
        drawFrameShadow(ctx, tX, tY, tW, tH, isLightFrameColor(frameColor));
      }

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

      const photoPad = frameColor?.id === "siyah" ? 4 : 0;
      const pX = ix - photoPad;
      const pY = iy - photoPad;
      const pW = iw + 2 * photoPad;
      const pH = ih + 2 * photoPad;

      ctx.save();
      ctx.beginPath();
      ctx.rect(pX, pY, pW, pH);
      ctx.clip();
      ctx.drawImage(photo, sx, sy, sWidth, sHeight, pX, pY, pW, pH);
      ctx.restore();

      if (frameRender === "flatMetal") {
        drawFlatMetalFrame(ctx, tX, tY, tW, tH, targetThickPx);
      } else if (frameImage) {
        const frameImg = await loadImage(frameImage).catch(() => null);
        if (cancelled || !frameImg) return;

        const s = sliceSize;
        if (s > 0) {
          drawNineSliceFrame(ctx, frameImg, tX, tY, tW, tH, s, targetThickPx);
          if (isLightFrameColor(frameColor)) {
            drawLightFrameOutline(ctx, tX, tY, tW, tH);
          }
        } else {
          ctx.drawImage(frameImg, Math.round(tX), Math.round(tY), Math.round(tW), Math.round(tH));
        }
      }

      if (cancelled) return;
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
    fullscreen,
    viewport.w,
    viewport.h,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={fullscreen ? "fp-canvas-fullscreen" : undefined}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
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
          alt={getFrameDisplayLabel(frame)}
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
    .map((id) => framesCatalog.categories.find((c) => c.id === id)?.label)
    .filter(Boolean);
  return [getFrameDisplayLabel(frame), frame.code, frame.colorName, frame.id, ...catLabels]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

function frameMatchesCategory(frame, categoryId) {
  if (categoryId === "all") return true;
  if (categoryId === "custom") return Boolean(frame.custom);
  return (frame.categories ?? []).includes(categoryId);
}

function countFramesInCategory(frames, categoryId) {
  return frames.filter((f) => f.id !== "none" && frameMatchesCategory(f, categoryId)).length;
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function FramePicker() {
  const [uploadedImage, setUploadedImage] = useState(PLACEHOLDER_SRC);
  
  const [selectedFrameId, setSelectedFrameId] = useState("none");
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [selectedSize,  setSelectedSize]  = useState(SIZES[0]);
  const [activeView,    setActiveView]    = useState("tablo");
  const [added,         setAdded]         = useState(false);
  const [cartItems,     setCartItems]     = useState([]);
  const addedTimerRef = useRef(null);
  const [frameSearch,   setFrameSearch]   = useState("");
  const [frameCategory, setFrameCategory] = useState(null);
  const [customFrames,  setCustomFrames]  = useState([]);
  const [hiddenFrameIds, setHiddenFrameIds] = useState(() => loadHiddenFrameIds());
  const [frameOverrides, setFrameOverrides] = useState(() => loadFrameOverrides());
  const [userCategories, setUserCategories] = useState(() => loadCustomCategories());
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState(() => loadHiddenSeriesIds());
  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
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
          if (!patch) return f;
          return applyCatalogOverride(f, patch);
        });
      return [...catalog, ...customFrames];
    },
    [customFrames, hiddenFrameIds, frameOverrides]
  );

  const selectedFrame = useMemo(() => {
    const found = allFrames.find((f) => f.id === selectedFrameId);
    if (found) return found;
    return allFrames[0] ?? FRAME_TYPES[0];
  }, [allFrames, selectedFrameId]);

  const selectedColor = useMemo(() => {
    const colors = selectedFrame?.colors ?? [];
    if (!colors.length) return null;
    if (selectedColorId) {
      const match = colors.find((c) => c.id === selectedColorId);
      if (match) return match;
    }
    return colors[0];
  }, [selectedFrame, selectedColorId]);

  useEffect(() => {
    if (!allFrames.length) return;
    if (!allFrames.some((f) => f.id === selectedFrameId)) {
      setSelectedFrameId(allFrames[0].id);
      setSelectedColorId(allFrames[0].colors?.[0]?.id ?? null);
    }
  }, [allFrames, selectedFrameId]);

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
    setSelectedFrameId(frame.id);
    setSelectedColorId(frame.colors?.[0]?.id ?? null);
  };

  const searchQuery = frameSearch.trim().toLocaleLowerCase("tr-TR");

  const allCategories = useMemo(
    () => [...FRAME_CATEGORIES, ...userCategories],
    [userCategories]
  );

  const visibleCategories = useMemo(
    () =>
      allCategories.filter((cat) => {
        if (hiddenSeriesIds.has(cat.id)) return false;
        return cat.id === "all" || countFramesInCategory(allFrames, cat.id) > 0 || cat.custom;
      }),
    [allCategories, allFrames, hiddenSeriesIds]
  );

  const seriesOptions = useMemo(
    () => buildSeriesOptions(userCategories, allFrames),
    [userCategories, allFrames]
  );

  const filteredFrames = useMemo(() => {
    if (!searchQuery && !frameCategory) return [];

    const noneFrame = allFrames.find((f) => f.id === "none");
    const list = allFrames.filter((f) => {
      if (f.id === "none") return false;
      if (searchQuery) {
        return frameSearchText(f).includes(searchQuery);
      }
      return frameMatchesCategory(f, frameCategory);
    });

    return noneFrame ? [noneFrame, ...list] : list;
  }, [allFrames, frameCategory, searchQuery]);

  const selectableFrameCount = filteredFrames.filter((f) => f.id !== "none").length;

  const handleFrameAdded = (entry) => {
    setCustomFrames((prev) => [...prev, entry]);
    setSelectedFrameId(entry.id);
    setSelectedColorId(entry.colors?.[0]?.id ?? null);
    setFrameCategory("custom");
  };

  const handleFrameEdited = (updated) => {
    if (!updated?.id) return;

    if (updated.custom) {
      setCustomFrames((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } else {
      const patch = overridePatchFromSavedFrame(updated);
      saveFrameOverride(updated.id, patch);
      setFrameOverrides((prev) => ({
        ...prev,
        [updated.id]: { ...(prev[updated.id] ?? {}), ...patch },
      }));
    }

    setCartItems((prev) =>
      prev.map((item) =>
        item.frameId === updated.id
          ? {
              ...item,
              ...calculateLinePrice({
                frame: updated,
                widthCm: item.widthCm,
                heightCm: item.heightCm,
              }),
            }
          : item
      )
    );

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

  const dismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
  }, []);

  const requestRemoveFrame = (frame) => {
    const name = getFrameDisplayLabel(frame);
    showToast({
      type: "confirm",
      confirmKind: "frame",
      frame,
      message: `"${name}" kaldırılsın mı?`,
      confirmLabel: "Kaldır",
    });
  };

  const requestDeleteSeries = (cat) => {
    const hint = cat.custom
      ? "Bu seri kalıcı olarak silinir."
      : "Çerçeveler silinmez; seri yalnızca listeden gizlenir.";
    showToast({
      type: "confirm",
      confirmKind: "series",
      seriesCat: cat,
      message: `"${cat.label}" serisi kaldırılsın mı? ${hint}`,
      confirmLabel: "Sil",
    });
  };

  const confirmDeleteSeries = () => {
    const cat = toast?.seriesCat;
    if (!cat) return;

    if (frameCategory === cat.id) setFrameCategory(null);
    if (cat.custom) {
      setUserCategories(deleteCustomCategory(cat.id));
    } else {
      setHiddenSeriesIds(hideSeriesCategory(cat.id));
    }
    showToast({ type: "success", message: `"${cat.label}" serisi kaldırıldı.` }, 2800);
  };

  const handleToastConfirm = () => {
    if (toast?.confirmKind === "series") {
      confirmDeleteSeries();
      return;
    }
    confirmRemoveFrame();
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

      if (selectedFrameId === frame.id) {
        const fallback = pickFallbackFrame(frame.id);
        setSelectedFrameId(fallback.id);
        setSelectedColorId(fallback.colors?.[0]?.id ?? null);
      }

      if (frame.custom) {
        showToast({ type: "success", message: "Çerçeve kaldırıldı." }, 2800);
      } else {
        showToast({
          type: "undo",
          frameId: frame.id,
          message: `"${getFrameDisplayLabel(frame)}" kaldırıldı.`,
        }, 6000);
      }
    } catch (err) {
      console.error(err);
      showToast({ type: "error", message: "Çerçeve kaldırılamadı." }, 3200);
    }
  };

  const handleToastUndo = () => {
    const id = toast?.frameId;
    if (!id) return;

    setHiddenFrameIds(unhideFrameId(id));
    setToast(null);
    showToast({ type: "success", message: "Çerçeve geri getirildi." }, 2500);
  };

  const safeW = Number(customW) || 0;
  const safeH = Number(customH) || 0;
  const { widthCm: activeWidthCm, heightCm: activeHeightCm } = getActiveSizeDimensions(
    isCustomSize,
    customW,
    customH,
    selectedSize
  );

  const {
    framePrice,
    pleksiPrice: pleksiUnit,
    camPrice: camUnit,
    totalPrice,
  } = calculateLinePrice({
    frame: selectedFrame,
    widthCm: activeWidthCm,
    heightCm: activeHeightCm,
  });

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.totalPrice, 0),
    [cartItems]
  );

  const handleAddToCart = () => {
    if (isCustomSize && (safeW < 1 || safeH < 1)) {
      showToast({ type: "error", message: "Özel ölçü için en ve boy girin." }, 3200);
      return;
    }

    const pricing = calculateLinePrice({
      frame: selectedFrame,
      widthCm: activeWidthCm,
      heightCm: activeHeightCm,
    });

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      frameId: selectedFrame.id,
      frameLabel: getFrameDisplayLabel(selectedFrame),
      sizeLabel: buildSizeLabel(isCustomSize, customW, customH, selectedSize),
      viewLabel: activeView === "dekor" ? "Dekor" : "Tablo",
      widthCm: activeWidthCm,
      heightCm: activeHeightCm,
      ...pricing,
    };

    setCartItems((prev) => [...prev, item]);
    setAdded(true);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setAdded(false), 2200);
    showToast({ type: "success", message: "Ürün sepete eklendi." }, 2200);
  };

  const removeCartItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setCartItems([]);

  const displayW = safeW > 0 ? safeW : 50;
  const displayH = safeH > 0 ? safeH : 50;

  const activeSizeForCanvas = isCustomSize 
    ? { id: `${displayW}x${displayH}` } 
    : selectedSize;

  const activeThickness =
    (selectedFrame.defaultMm ?? 20) * (selectedFrame.previewMmFactor ?? 1);

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
          <PreviewCanvas key={previewProps.frameType.id} {...previewProps} />
          <button
            type="button"
            className="fp-preview-fullscreen-btn"
            title="Tam ekran gör"
            aria-label="Tam ekran gör"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullscreenPreview(true);
            }}
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
        </div>

        <button
          className="fp-upload-btn"
          type="button"
          onClick={() => setShowPhotoPicker(true)}
        >
          <span className="fp-upload-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
              <path d="M3 16l5-5 4 4 3-3 6 6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="fp-upload-btn-text">
            <span className="fp-upload-btn-title">Fotoğraf Yükle</span>
            <span className="fp-upload-btn-sub">Galeriden seç veya fotoğraf çek</span>
          </span>
          <span className="fp-upload-btn-arrow" aria-hidden="true">›</span>
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

        <div className="fp-view-panel">
          <div className="fp-view-panel-header">
            <span className="fp-view-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <div>
              <p className="fp-view-panel-label">Önizleme Modu</p>
              <p className="fp-view-panel-hint">Çerçevenizi nasıl görmek istersiniz?</p>
            </div>
          </div>

          <div className="fp-view-toggle">
            <button
              type="button"
              className={`fp-view-btn${activeView === "tablo" ? " active" : ""}`}
              onClick={() => setActiveView("tablo")}
            >
              <span className="fp-view-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <rect x="4" y="4" width="16" height="16" rx="1" />
                  <rect x="8" y="8" width="8" height="8" rx="0.5" />
                </svg>
              </span>
              <span className="fp-view-btn-title">Tablo</span>
              <span className="fp-view-btn-sub">Yakından incele</span>
            </button>

            <button
              type="button"
              className={`fp-view-btn${activeView === "dekor" ? " active" : ""}`}
              onClick={() => setActiveView("dekor")}
            >
              <span className="fp-view-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="fp-view-btn-title">Dekor</span>
              <span className="fp-view-btn-sub">Duvarda gör</span>
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

        <div className="fp-category-panel">
          <HorizontalScrollStrip
            className="fp-category-hscroll"
            trackClassName="fp-category-row"
            ariaLabel="Çerçeve serileri"
          >
            {visibleCategories.map((cat) => (
              <span key={cat.id} className="fp-category-chip-wrap">
                <button
                  type="button"
                  className={`fp-category-chip${frameCategory === cat.id ? " active" : ""}${cat.custom ? " user-cat" : ""}`}
                  onClick={() => {
                    setFrameCategory(cat.id);
                    setFrameSearch("");
                  }}
                >
                  <span className="fp-category-chip-label">{cat.label}</span>
                  <span className="fp-category-count">{countFramesInCategory(allFrames, cat.id)}</span>
                </button>
                {cat.id !== "all" && (
                  <button
                    type="button"
                    className="fp-category-chip-delete"
                    aria-label={`${cat.label} serisini kaldır`}
                    onClick={(e) => {
                      e.stopPropagation();
                      requestDeleteSeries(cat);
                    }}
                  >×</button>
                )}
              </span>
            ))}

            {showCatInput ? (
              <span className="fp-category-add-wrap">
                <input
                  className="fp-category-add-input"
                  placeholder="Seri adı"
                  value={newCatLabel}
                  autoFocus
                  maxLength={32}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCatLabel.trim()) {
                      const entry = addCustomCategory(newCatLabel.trim());
                      setUserCategories(loadCustomCategories());
                      setNewCatLabel("");
                      setShowCatInput(false);
                      setFrameCategory(entry.id);
                      setFrameSearch("");
                    }
                    if (e.key === "Escape") {
                      setShowCatInput(false);
                      setNewCatLabel("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="fp-category-add-confirm"
                  disabled={!newCatLabel.trim()}
                  onClick={() => {
                    if (!newCatLabel.trim()) return;
                    const entry = addCustomCategory(newCatLabel.trim());
                    setUserCategories(loadCustomCategories());
                    setNewCatLabel("");
                    setShowCatInput(false);
                    setFrameCategory(entry.id);
                    setFrameSearch("");
                  }}
                >✓</button>
                <button
                  type="button"
                  className="fp-category-add-cancel"
                  onClick={() => { setShowCatInput(false); setNewCatLabel(""); }}
                >✕</button>
              </span>
            ) : (
              <button
                type="button"
                className="fp-category-chip fp-category-add-btn"
                onClick={() => setShowCatInput(true)}
                title="Yeni seri ekle"
              >
                <span className="fp-category-add-btn-icon" aria-hidden="true">+</span>
                <span>Seri</span>
              </button>
            )}
          </HorizontalScrollStrip>
          <p className="fp-scroll-hint">Serileri yana kaydırabilirsiniz</p>

          <div className="fp-category-panel-divider" aria-hidden="true" />

          <button
            type="button"
            className="fp-add-frame-btn"
            onClick={() => setShowAddModal(true)}
          >
            <span className="fp-add-frame-btn-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="1.5" />
                <path d="M12 8v8M8 12h8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="fp-add-frame-btn-text">
              <span className="fp-add-frame-btn-title">Çerçeve Ekle</span>
              <span className="fp-add-frame-btn-sub">Kendi çerçevenizi oluşturun</span>
            </span>
            <span className="fp-add-frame-btn-arrow" aria-hidden="true">›</span>
          </button>
        </div>

        <div className="fp-section-label-row">
          <p className="fp-section-label">Çerçeve Tipi</p>
          <span className="fp-section-meta">
            {searchQuery
              ? `${selectableFrameCount} sonuç`
              : frameCategory
                ? `${allCategories.find((c) => c.id === frameCategory)?.label ?? "Seri"} · ${selectableFrameCount} çerçeve`
                : "Seri seçin"}
          </span>
        </div>

        {!frameCategory && !searchQuery ? (
          <p className="fp-frame-pick-hint">
            Çerçeveleri görmek için yukarıdan bir seri seçin veya arama yapın.
          </p>
        ) : (
          <HorizontalScrollStrip
            className="fp-frame-hscroll"
            trackClassName="fp-frame-grid-wrap"
            ariaLabel="Çerçeve modelleri"
          >
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
                        {getFrameDisplayLabel(f)}
                      </span>
                    </button>
                  </div>
                ))
              ) : (
                <p className="fp-search-empty">Sonuç bulunamadı.</p>
              )}
            </div>
          </HorizontalScrollStrip>
        )}
        {(frameCategory || searchQuery) && filteredFrames.length > 0 && (
          <p className="fp-scroll-hint fp-scroll-hint-below">Çerçeveleri yana kaydırabilirsiniz</p>
        )}

        {selectedFrame.colors?.length > 0 && (
          <>
            <p className="fp-section-label">Çerçeve Rengi</p>
            <div className="fp-color-row">
              {selectedFrame.colors.map((c) => (
                <button
                  key={c.id}
                  title={c.label}
                  className={`fp-color-dot${selectedColor?.id === c.id ? " active" : ""}`}
                  onClick={() => setSelectedColorId(c.id)}
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

        <div className="fp-custom-size-panel">
          <button
            type="button"
            className={`fp-custom-size-toggle${isCustomSize ? " open" : ""}`}
            onClick={() => {
              setIsCustomSize(!isCustomSize);
              if (!isCustomSize) { setCustomW(""); setCustomH(""); }
            }}
          >
            <span className="fp-custom-size-toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" strokeLinecap="round" />
                <path d="M9 12h6M12 9v6" strokeLinecap="round" />
              </svg>
            </span>
            <span className="fp-custom-size-toggle-text">
              <span className="fp-custom-size-toggle-title">
                {isCustomSize ? "Özel Ölçü Aktif" : "İsteğe Bağlı Özel Ölçü"}
              </span>
              <span className="fp-custom-size-toggle-sub">
                {isCustomSize ? "En ve boy değerlerini girin" : "Standart boyutların dışında ölçü belirleyin"}
              </span>
            </span>
            <span className="fp-custom-size-toggle-chevron" aria-hidden="true">
              {isCustomSize ? "−" : "+"}
            </span>
          </button>

          {isCustomSize && (
            <div className="fp-custom-size-form">
              <div className="fp-custom-size-form-header">
                <span className="fp-custom-size-form-label">Özel Tablo Ölçüsü</span>
                <button
                  type="button"
                  className="fp-custom-size-clear"
                  onClick={() => { setCustomW(""); setCustomH(""); }}
                >
                  Temizle
                </button>
              </div>

              <div className="fp-custom-size-fields">
                <label className="fp-custom-size-field">
                  <span className="fp-custom-size-field-label">En (Genişlik)</span>
                  <div className="fp-custom-size-input-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={customW}
                      onChange={(e) => setCustomW(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="50"
                    />
                    <span className="fp-custom-size-unit">cm</span>
                  </div>
                </label>

                <span className="fp-custom-size-times" aria-hidden="true">×</span>

                <label className="fp-custom-size-field">
                  <span className="fp-custom-size-field-label">Boy (Yükseklik)</span>
                  <div className="fp-custom-size-input-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={customH}
                      onChange={(e) => setCustomH(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="70"
                    />
                    <span className="fp-custom-size-unit">cm</span>
                  </div>
                </label>
              </div>

              {safeW > 0 && safeH > 0 && (
                <p className="fp-custom-size-result">
                  Seçilen ölçü: <strong>{safeW}×{safeH} cm</strong>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="fp-checkout-panel">
          {selectedFrame.id !== "none" && (
            <PriceLineList
              framePrice={framePrice}
              pleksiPrice={pleksiUnit}
              camPrice={camUnit}
              className="fp-price-lines-checkout"
            />
          )}
          <div className="fp-checkout-price">
            <span className="fp-checkout-price-label">Toplam</span>
            <span className="fp-price">{totalPrice.toLocaleString("tr-TR")} ₺</span>
            {selectedFrame.id !== "none" && (
              <span className="fp-price-breakdown fp-price-breakdown-sub">
                {getFrameDisplayLabel(selectedFrame)}
              </span>
            )}
          </div>

          <button
            type="button"
            className={`fp-add-cart-btn${added ? " done" : ""}`}
            onClick={handleAddToCart}
          >
            <span className="fp-add-cart-btn-icon" aria-hidden="true">
              {added ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M6 6h15l-1.5 9h-12L4 4H2" strokeLinejoin="round" />
                  <circle cx="9" cy="19" r="1.25" fill="currentColor" stroke="none" />
                  <circle cx="17" cy="19" r="1.25" fill="currentColor" stroke="none" />
                </svg>
              )}
            </span>
            <span className="fp-add-cart-btn-text">
              <span className="fp-add-cart-btn-title">
                {added ? "Sepete Eklendi" : "Sepete Ekle"}
              </span>
              <span className="fp-add-cart-btn-sub">
                {added
                  ? "Ürün sepetinize kaydedildi"
                  : `${totalPrice.toLocaleString("tr-TR")} ₺ tutarındaki seçimi ekle`}
              </span>
            </span>
            {!added && <span className="fp-add-cart-btn-arrow" aria-hidden="true">›</span>}
          </button>
        </div>

        {cartItems.length > 0 && (
          <div className="fp-cart-panel">
            <div className="fp-cart-header">
              <h3 className="fp-cart-title">Sepet ({cartItems.length})</h3>
              <button type="button" className="fp-cart-clear" onClick={clearCart}>
                Temizle
              </button>
            </div>
            <ul className="fp-cart-list">
              {cartItems.map((item) => (
                <li key={item.id} className="fp-cart-item">
                  <div className="fp-cart-item-main">
                    <div className="fp-cart-item-info">
                      <strong>{item.frameLabel}</strong>
                      <span>{item.sizeLabel} · {item.viewLabel}</span>
                    </div>
                    <PriceLineList
                      framePrice={item.framePrice}
                      pleksiPrice={item.pleksiPrice}
                      camPrice={item.camPrice}
                      className="fp-price-lines-cart"
                    />
                  </div>
                  <div className="fp-cart-item-actions">
                    <button
                      type="button"
                      className="fp-cart-item-remove"
                      aria-label="Ürünü sepetten çıkar"
                      onClick={() => removeCartItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="fp-cart-total">
              <span>Sepet Toplamı</span>
              <strong>{cartTotal.toLocaleString("tr-TR")} ₺</strong>
            </div>
          </div>
        )}

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
        <PreviewCanvas key={`fs-${previewProps.frameType.id}`} {...previewProps} fullscreen />
      </PreviewFullscreen>

      <FrameAddModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={handleFrameAdded}
        categoryOptions={[...BASE_CATEGORY_OPTIONS, ...userCategories]}
        seriesOptions={seriesOptions}
      />

      <FrameEditModal
        open={showEditModal}
        frame={editingFrame}
        onClose={closeEditModal}
        onSaved={handleFrameEdited}
        categoryOptions={[...BASE_CATEGORY_OPTIONS, ...userCategories]}
        seriesOptions={seriesOptions}
      />

      <Toast
        toast={toast}
        onDismiss={dismissToast}
        onConfirm={handleToastConfirm}
        onUndo={handleToastUndo}
      />
    </div>
  );
}