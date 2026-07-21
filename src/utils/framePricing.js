export function framePerimeterCm(widthCm, heightCm) {
  const w = Math.max(0, Number(widthCm) || 0);
  const h = Math.max(0, Number(heightCm) || 0);
  return 2 * w + 2 * h;
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

/** Çerçeve tutarı = çevre (cm) × çerçeve fiyatı */
export function getFramePrice(frame, legacyPriceMap = {}, widthCm = 0, heightCm = 0) {
  if (!frame || frame.id === "none") return 0;

  const unitField = framePriceUnitField(frame);
  if (unitField) {
    const unit = readFrameUnitPrice(frame, unitField);
    if (unit <= 0) return 0;
    if (widthCm > 0 && heightCm > 0) {
      return Math.round(unit * framePerimeterCm(widthCm, heightCm));
    }
    return 0;
  }

  const legacy = legacyPriceMap[frame.id];
  if (typeof legacy === "number" && legacy >= 0) return Math.round(legacy);
  return 0;
}

export function getPleksiPrice(frame) {
  if (!frame || frame.id === "none") return 0;
  if (!Object.prototype.hasOwnProperty.call(frame, "pleksiPrice")) return 0;
  return readFrameUnitPrice(frame, "pleksiPrice");
}

export function getCamPrice(frame) {
  if (!frame || frame.id === "none") return 0;
  if (!Object.prototype.hasOwnProperty.call(frame, "camPrice")) return 0;
  return readFrameUnitPrice(frame, "camPrice");
}

export function formatTurkishPrice(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString("tr-TR");
}

export function linePriceForSize(frame, legacyPriceMap, widthCm, heightCm) {
  const framePrice = getFramePrice(frame, legacyPriceMap, widthCm, heightCm);
  const pleksiPrice = getPleksiPrice(frame);
  const camPrice = getCamPrice(frame);
  return {
    framePrice,
    pleksiPrice,
    camPrice,
    totalPrice: framePrice + pleksiPrice + camPrice,
  };
}
