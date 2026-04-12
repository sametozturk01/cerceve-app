import { useState, useRef, useEffect } from "react";

// ─── Veri (MM DESTEKLİ) ────────────────────────────────────────────────────────

// YENİ EKLENEN: "defaultMm" özelliği.
// thickness: PNG dosyasının kesim payı (Bunu elleme, resmin bozulmamasını sağlar)
// defaultMm: Bu çerçeve seçildiğinde kaydırıcının geleceği varsayılan kalınlık (Örn: 40mm = 4cm)
const FRAME_TYPES = [
  {
    id: "none",
    label: "Yok",
    thickness: 0,
    defaultMm: 0,
    radius: 0,
    image: null,
    colors: [],
  },
  {
    id: "ANTRASİT GRİ",
    label: "ANTRASİT GRİ",
    // İŞTE HATA BURADAYDI: 90 çok fazla. Resmindeki ahşabın gerçek pikselini girmelisin.
    thickness: 45, // <--- BURAYI 90 YERİNE 45 YAP
    defaultMm: 40, 
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
    // BUNU DA DÜŞÜR
    thickness: 35, // <--- BURAYI 70 YERİNE 40 YAP
    defaultMm: 30, 
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
    // BUNU DA DÜŞÜR
    thickness: 45, // <--- BURAYI 90 YERİNE 45 YAP
    defaultMm: 45, 
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

// ─── Canvas Önizleme (MM HESAPLAMALI GERÇEK DÜNYA MOTORU) ─────────────────────

const CANVAS_SIZE = 640;


function PreviewCanvas({ imageUrl, frameType, frameColor, activeView, selectedSize, customThickness }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d", { alpha: false });
    const dpr = window.devicePixelRatio || 1;
    const W = CANVAS_SIZE;
    const H = CANVAS_SIZE;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    //canvas.style.width = `${W}px`;
    //canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    async function draw() {
      ctx.fillStyle = activeView === "dekor" ? "#f8fafc" : "#ffffff";
      ctx.fillRect(0, 0, W, H);

      if (activeView === "dekor") {
        const decorImg = await loadImage(DECOR_SAMPLES[0].url).catch(() => null);
        if (decorImg) ctx.drawImage(decorImg, 0, 0, W, H);
      }

      const photo = await loadImage(imageUrl).catch(() => null);
      if (!photo) return;

      const [sizeW, sizeH] = selectedSize.id.split('x').map(Number);
      const frameRatio = sizeW / sizeH;

      const maxDimCm = Math.max(sizeW, sizeH); 
      const sizeMultiplier = 0.6 + ((maxDimCm / 80) * 0.4);

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

      // MİLİMETRE (MM) - PİKSEL (PX) DÖNÜŞÜM MOTORU
      const pxPerMm = tW / (sizeW * 10);
      const rawThickPx = customThickness * pxPerMm;
      
      const targetThickPx = Math.min(rawThickPx, (tW / 2) - 2, (tH / 2) - 2);

      // --- İŞTE ÇÖZÜM BURADA: TAŞMA PAYI (BLEED) ---
      // Fotoğrafı her yönden 3 piksel dışa taşırıp çerçevenin ahşabının altına saklıyoruz.
      // Böylece aradan asla beyaz tuval sızamaz!
      const ix = tX + targetThickPx - 3;
      const iy = tY + targetThickPx - 3;
      const iw = tW - (2 * targetThickPx) + 6;
      const ih = tH - (2 * targetThickPx) + 6;

      const imgRatio = photo.width / photo.height;
      const targetRatio = iw / ih;
      
      let sx = 0, sy = 0, sWidth = photo.width, sHeight = photo.height;

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

      // 9-SLICE (9-DİLİM) GERÇEK ÇERÇEVE ÇİZİM MANTIĞI
      if (frameType.image) {
        const frameImg = await loadImage(frameType.image).catch(() => null);
        if (frameImg) {
          const sw = frameImg.width;
          const sh = frameImg.height;
          // PNG dosyasındaki kesim noktası (Veriden gelen thickness)
          const s = frameType.thickness; 
          const t = targetThickPx;       

          if (s > 0) {
            ctx.drawImage(frameImg, 0, 0, s, s, tX, tY, t, t);
            ctx.drawImage(frameImg, sw-s, 0, s, s, tX+tW-t, tY, t, t);
            ctx.drawImage(frameImg, 0, sh-s, s, s, tX, tY+tH-t, t, t);
            ctx.drawImage(frameImg, sw-s, sh-s, s, s, tX+tW-t, tY+tH-t, t, t);

            ctx.drawImage(frameImg, s, 0, sw-2*s, s, tX+t, tY, tW-2*t, t);
            ctx.drawImage(frameImg, s, sh-s, sw-2*s, s, tX+t, tY+tH-t, tW-2*t, t);
            ctx.drawImage(frameImg, 0, s, s, sh-2*s, tX, tY+t, t, tH-2*t);
            ctx.drawImage(frameImg, sw-s, s, s, sh-2*s, tX+tW-t, tY+t, t, tH-2*t);
          } else {
            ctx.drawImage(frameImg, tX, tY, tW, tH);
          }
        }
      }
      
      if (activeView === "dekor" || activeView === "tablo") {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 10;
        ctx.strokeRect(tX, tY, tW, tH);
      }
    }

    draw();
  }, [imageUrl, frameType, frameColor, activeView, selectedSize, customThickness]);

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

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function FramePicker() {
  const [uploadedImage, setUploadedImage] = useState(PLACEHOLDER_SRC);
  
  const [selectedFrame, setSelectedFrame] = useState(FRAME_TYPES[1]);
  const [selectedColor, setSelectedColor] = useState(FRAME_TYPES[1].colors[0]);
  const [selectedSize,  setSelectedSize]  = useState(SIZES[0]);
  const [activeView,    setActiveView]    = useState("tablo");
  const [added,         setAdded]         = useState(false);

  const [isCustomThickness, setIsCustomThickness] = useState(false);
  const [customThicknessVal, setCustomThicknessVal] = useState("");
  
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [customW, setCustomW] = useState(""); 
  const [customH, setCustomH] = useState(""); 

  const fileInputRef = useRef(null);

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
    
    // Çerçeve değiştiğinde kalınlık ayarını sıfırlayıp kapatırız ki eski ölçüler bozulmasın
    setIsCustomThickness(false);
    setCustomThicknessVal("");
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

  // --- YENİ: GÜVENLİ KALINLIK KÖPRÜSÜ ---
  // Eğer özel kalınlık açıksa ve kutu boş değilse o sayıyı kullan, yoksa çerçevenin orijinal defaultMm değerini kullan.
  const activeThickness = isCustomThickness && customThicknessVal !== ""
    ? Number(customThicknessVal) 
    : selectedFrame.defaultMm;

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
            selectedSize={activeSizeForCanvas} 
            customThickness={activeThickness} /* GÜVENLİ KALINLIK BURADAN GİDER */
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

        {/* --- YENİ: ÇERÇEVE KALINLIĞI KONTROLÜ --- */}
        {selectedFrame.id !== "none" && (
          <div style={{ marginTop: '15px' }}>
         <button 
              className="fp-upload-btn" 
              style={{ 
                marginTop: 0, 
                minHeight: '45px',       // Sabit height yerine minHeight
                height: 'auto',           // Otomatik yükseklik
                padding: '10px 15px',     // İç boşluk
                lineHeight: '1.2',        // Satır aralığı
                fontSize: '13px', 
                background: isCustomThickness ? '#4f46e5' : '#6366f1' 
              }}
              onClick={() => { 
                setIsCustomThickness(!isCustomThickness); 
                if(!isCustomThickness) setCustomThicknessVal(selectedFrame.defaultMm.toString()); 
              }}
            >
              {isCustomThickness ? "KALINLIĞI KAPAT" : "İSTEĞE BAĞLI ÇERÇEVE KALINLIĞI"}
            </button>

            {isCustomThickness && (
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                 
                 {/* SIFIRLA BUTONU VE BAŞLIK YAN YANA */}
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
                   <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                     Çerçeve Kalınlığı (MM)
                   </label>
                   <button 
                     onClick={() => setCustomThicknessVal(selectedFrame.defaultMm.toString())}
                     style={{ background: 'transparent', border: 'none', color: '#e11d48', fontSize: '10px', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                   >
                     ↺ SIFIRLA
                   </button>
                 </div>

                 <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={customThicknessVal}
                      onChange={e => {
                        // Sadece rakamlara izin ver
                        let val = e.target.value.replace(/[^0-9]/g, '');
                        // MAKSİMUM 50 SINIRI BURADA EKLENDİ
                        if (Number(val) > 50) val = '50';
                        setCustomThicknessVal(val);
                      }}
                      placeholder={`Örn: ${selectedFrame.defaultMm}`}
                      style={{ width: '100%', border: 'none', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}
                    />
                    <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, marginLeft: '5px' }}>mm</span>
                 </div>
                 <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                   *Zarif bir görünüm için 20mm - 50mm arası önerilir.
                 </p>
              </div>
            )}
          </div>
        )}

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