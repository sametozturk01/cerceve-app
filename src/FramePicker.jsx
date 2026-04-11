import { useState, useRef, useEffect } from "react";

// ─── Veri ────────────────────────────────────────────────────────────────────

// thickness: çerçeve PNG'nin iç kenarı kaç piksel uzakta (640px canvas üzerinden)
// Kendi PNG'ne göre bu değeri ayarla:
//   - Çerçeve ince görünüyorsa artır (ör: 80 → 100)
//   - Çerçeve kalın görünüyorsa azalt (ör: 80 → 60)
const FRAME_TYPES = [
  {
    id: "none",
    label: "Yok",
    thickness: 0,
    radius: 0,
    image: null,
    colors: [],
  },
  {
    id: "ANTRASİT GRİ",
    label: "ANTRASİT GRİ",
    thickness: 90,          // ← PNG'nin iç boşluğuna göre ayarla
    radius: 0,
    image: "/frames/koseli.png",
    colors: [
      { id: "siyah", label: "Siyah", hex: "#1a1a1a" },
      { id: "kahve", label: "Kahve", hex: "#5C3D1E" },
      { id: "beyaz", label: "Beyaz", hex: "#f0f0f0", stroke: "#ccc" },
      { id: "altin", label: "Altın", hex: "#C8A84B" },
      { id: "gumus", label: "Gümüş", hex: "#9E9E9E" },
    ],
  },
  {
    id: "SARI",
    label: "SARI",
    thickness: 70,
    radius: 0,
    image: "/frames/sari.png",
    colors: [
      { id: "siyah", label: "Siyah", hex: "#1a1a1a" },
      { id: "beyaz", label: "Beyaz", hex: "#f0f0f0", stroke: "#ccc" },
      { id: "altin", label: "Altın", hex: "#C8A84B" },
      { id: "gumus", label: "Gümüş", hex: "#9E9E9E" },
    ],
  },
  {
    id: "KOYU MÜRDÜM",
    label: "KOYU MÜRDÜM",
    thickness: 90,
    radius: 0,
    image: "/frames/mürdüm.png",
    colors: [
      { id: "siyah", label: "Siyah", hex: "#1a1a1a" },
      { id: "altin", label: "Altın", hex: "#C8A84B" },
      { id: "gumus", label: "Gümüş", hex: "#9E9E9E" },
      { id: "beyaz", label: "Beyaz", hex: "#f0f0f0", stroke: "#ccc" },
    ],
  },
];


const DECOR_SAMPLES = [
  { 
    id: 'benimSalon',         // Benzersiz bir ID ver
    label: 'Benim Salonum',   // Ekranda görünecek isim
    url: '/public/koltuk.png' // public klasöründeki dosya yolu (başında / olmalı)
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

// ─── Canvas Önizleme ──────────────────────────────────────────────────────────

// CANVAS_SIZE: yüksek çözünürlük için 640, CSS'de %100 gösterilir
const CANVAS_SIZE = 640;

function PreviewCanvas({ imageUrl, frameType, frameColor, activeView }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = CANVAS_SIZE;
    const H = CANVAS_SIZE;

    async function draw() {
      ctx.clearRect(0, 0, W, H);

      // 1. DEKOR MODU KONTROLÜ
      if (activeView === "dekor") {
        const decorImg = await loadImage(DECOR_SAMPLES[0].url).catch(() => null);
        if (decorImg) {
          ctx.drawImage(decorImg, 0, 0, W, H);
        }
      }

      const photo = await loadImage(imageUrl).catch(() => null);
      if (!photo) return;

      // 2. TABLO BOYUTU (Dekor modunda tabloyu %30 küçültüp yukarı taşıyoruz)
      let tW = W, tH = H, tX = 0, tY = 0;
      if (activeView === "dekor") {
        tW = W * 0.35; // Tablo genişliği dekorun %35'i kadar olsun
        tH = H * 0.35;
        tX = (W - tW) / 2; // Ortala
        tY = H * 0.0;      // Biraz yukarı as
      }

      // 3. FOTOĞRAF VE ÇERÇEVE ÇİZİMİ (Senin mevcut mantığın, tX, tY eklenmiş hali)
      const t = (frameType.thickness * (tW / W)); // Thickness'ı ölçeklendir

      // Fotoğraf
      const ix = tX + t, iy = tY + t, iw = tW - 2 * t, ih = tH - 2 * t;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ix, iy, iw, ih);
      ctx.clip();
      ctx.drawImage(photo, ix, iy, iw, ih);
      ctx.restore();

      // Çerçeve (Eğer varsa)
      if (frameType.image) {
        const frameImg = await loadImage(frameType.image).catch(() => null);
        if (frameImg) {
          // Renk tint mantığını buraya aynen ekle (offscreen canvas ile)
          ctx.drawImage(frameImg, tX, tY, tW, tH);
        }
      }
      
      // Gölge ekleyelim (Duvara asılmış gibi dursun)
      if (activeView === "dekor") {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 10;
        ctx.strokeRect(tX, tY, tW, tH);
      }
    }

    draw();
  }, [imageUrl, frameType, frameColor, activeView]);

  return <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ width: "100%", height: "100%" }} />;
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

  if (frame.image) {
    return (
      <div className="fp-swatch">
        <img
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

// ─── Rozet ────────────────────────────────────────────────────────────────────

function Badge({ icon, text }) {
  return (
    <div className="fp-badge">
      <span className="fp-badge-icon">{icon}</span>
      <span className="fp-badge-text">{text}</span>
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function FramePicker() {
  const [uploadedImage, setUploadedImage] = useState(PLACEHOLDER_SRC);
  const [selectedFrame, setSelectedFrame] = useState(FRAME_TYPES[0]);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize,  setSelectedSize]  = useState(SIZES[0]);
  const [activeView,    setActiveView]    = useState("tablo");
  const [added,         setAdded]         = useState(false);

  const fileInputRef = useRef(null);

  const totalPrice = selectedSize.price + (FRAME_PRICE[selectedFrame.id] ?? 0);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleFrameSelect = (frame) => {
    setSelectedFrame(frame);
    setSelectedColor(frame.colors?.[0] ?? null);
  };

  const handleAddToCart = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div className="fp-container">

      {/* ══ Sol: Önizleme ══ */}
      <div className="fp-left">
        <div className="fp-preview-box">
          <PreviewCanvas
            imageUrl={uploadedImage}
            frameType={selectedFrame}
            frameColor={selectedColor}
            activeView={activeView}
          />
        </div>

        <button
          className="fp-upload-btn"
          onClick={() => fileInputRef.current.click()}
        >
          Fotoğraf Yükle
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />

        <div className="fp-view-toggle">
          {[
            { id: "tablo", label: "Tablo" },
            { id: "dekor", label: "Dekorda Gör" },
          ].map((v) => (
            <button
              key={v.id}
              className={`fp-view-btn${activeView === v.id ? " active" : ""}`}
              onClick={() => setActiveView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Sağ: Seçenekler ══ */}
      <div className="fp-right">

        <p className="fp-section-label">Çerçeve Tipi</p>
        <div className="fp-frame-grid">
          {FRAME_TYPES.map((f) => (
            <button
              key={f.id}
              className={`fp-frame-btn${selectedFrame.id === f.id ? " active" : ""}`}
              onClick={() => handleFrameSelect(f)}
            >
              <FrameSwatch frame={f} />
              <span className="fp-frame-btn-label">{f.label}</span>
            </button>
          ))}
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
              className={`fp-size-btn${selectedSize.id === s.id ? " active" : ""}`}
              onClick={() => setSelectedSize(s)}
            >
              {s.label}
            </button>
          ))}
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
    </div>
  );
}

