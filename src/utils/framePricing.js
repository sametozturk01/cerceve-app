export function framePerimeterCm(widthCm, heightCm) {
  const w = Math.max(0, Number(widthCm) || 0);
  const h = Math.max(0, Number(heightCm) || 0);
  return 2 * w + 2 * h;
}

export function framePerimeterMeters(widthCm, heightCm) {
  return framePerimeterCm(widthCm, heightCm) / 100;
}

/** Görüntü alanı (m²) — en × boy cm’den */
export function frameAreaSquareMeters(widthCm, heightCm) {
  const w = Math.max(0, Number(widthCm) || 0) / 100;
  const h = Math.max(0, Number(heightCm) || 0) / 100;
  return w * h;
}

export function readFrameUnitPrice(frame, field) {
  if (!frame || frame.id === "none") return 0;
  const raw = frame[field];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Math.round(Number(raw));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

function framePriceUnitField(frame) {
  if (!frame) return null;
  if (Object.prototype.hasOwnProperty.call(frame, "price")) return "price";
  if (Object.prototype.hasOwnProperty.call(frame, "pricePerCm")) return "pricePerCm";
  return null;
}

/** Çerçeve tutarı = çevre (m) × çerçeve fiyatı (₺/m); eski pricePerCm alanı cm başına kalır */
export function getFramePrice(frame, legacyPriceMap = {}, widthCm = 0, heightCm = 0) {
  if (!frame || frame.id === "none") return 0;

  const unitField = framePriceUnitField(frame);
  if (unitField) {
    const unit = readFrameUnitPrice(frame, unitField);
    if (unit <= 0) return 0;
    if (widthCm > 0 && heightCm > 0) {
      if (unitField === "pricePerCm") {
        return Math.round(unit * framePerimeterCm(widthCm, heightCm));
      }
      return Math.round(unit * framePerimeterMeters(widthCm, heightCm));
    }
    return 0;
  }

  const legacy = legacyPriceMap[frame.id];
  if (typeof legacy === "number" && legacy >= 0) return Math.round(legacy);
  return 0;
}

function surfaceMaterialPrice(frame, m2Field, cm2LegacyField, widthCm, heightCm) {
  if (!frame || frame.id === "none") return 0;
  if (widthCm <= 0 || heightCm <= 0) return 0;

  if (Object.prototype.hasOwnProperty.call(frame, m2Field)) {
    const unit = readFrameUnitPrice(frame, m2Field);
    if (unit <= 0) return 0;
    return Math.round(unit * frameAreaSquareMeters(widthCm, heightCm));
  }

  if (Object.prototype.hasOwnProperty.call(frame, cm2LegacyField)) {
    const unit = readFrameUnitPrice(frame, cm2LegacyField);
    if (unit <= 0) return 0;
    const w = Math.max(0, Number(widthCm) || 0);
    const h = Math.max(0, Number(heightCm) || 0);
    return Math.round(unit * w * h);
  }

  return 0;
}

export function getPleksiPrice(frame, widthCm = 0, heightCm = 0) {
  return surfaceMaterialPrice(frame, "pleksiPrice", "pleksiPricePerCm", widthCm, heightCm);
}

export function getCamPrice(frame, widthCm = 0, heightCm = 0) {
  return surfaceMaterialPrice(frame, "camPrice", "camPricePerCm", widthCm, heightCm);
}

export function formatTurkishPrice(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString("tr-TR");
}

export function linePriceForSize(frame, legacyPriceMap, widthCm, heightCm) {
  const framePrice = getFramePrice(frame, legacyPriceMap, widthCm, heightCm);
  const pleksiPrice = getPleksiPrice(frame, widthCm, heightCm);
  const camPrice = getCamPrice(frame, widthCm, heightCm);
  return {
    framePrice,
    pleksiPrice,
    camPrice,
    totalPrice: framePrice + pleksiPrice + camPrice,
  };
}
