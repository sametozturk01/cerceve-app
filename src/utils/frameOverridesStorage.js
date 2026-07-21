const STORAGE_KEY = "cerceve-frame-overrides";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadFrameOverrides() {
  return readAll();
}

export function saveFrameOverride(id, patch) {
  const all = readAll();
  all[id] = { ...(all[id] ?? {}), ...patch };
  writeAll(all);
  return all;
}

const OVERRIDE_KEYS = [
  "code",
  "colorName",
  "label",
  "categories",
  "defaultMm",
  "price",
  "pricePerCm",
  "pleksiPrice",
  "pleksiPricePerCm",
  "camPrice",
  "camPricePerCm",
];

/** Düzenleme kaydından override patch üretir */
export function overridePatchFromSavedFrame(frame) {
  return {
    code: frame.code ?? null,
    colorName: frame.colorName ?? null,
    label: frame.label ?? null,
    categories: (frame.categories ?? []).filter((c) => c !== "custom"),
    defaultMm: frame.defaultMm,
    price: frame.price,
    pricePerCm: frame.pricePerCm,
    pleksiPrice: frame.pleksiPrice,
    pleksiPricePerCm: frame.pleksiPricePerCm,
    camPrice: frame.camPrice,
    camPricePerCm: frame.camPricePerCm,
  };
}

/** localStorage override'ını katalog çerçevesine uygular (yalnızca patch'te olan alanlar). */
export function pickOverridePatch(patch) {
  if (!patch || typeof patch !== "object") return {};
  const updates = {};
  for (const key of OVERRIDE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      updates[key] = patch[key];
    }
  }
  return updates;
}
