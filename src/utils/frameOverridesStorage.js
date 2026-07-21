const STORAGE_KEY = "cerceve-frame-overrides";

const PRICE_KEYS = [
  "price",
  "pricePerCm",
  "pleksiPrice",
  "pleksiPricePerCm",
  "camPrice",
  "camPricePerCm",
  "motifCamPrice",
  "motifCamPricePerCm",
];

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

/** undefined atlanır; null ilgili anahtarı siler */
export function saveFrameOverride(id, patch) {
  const all = readAll();
  const next = { ...(all[id] ?? {}) };

  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else next[key] = value;
  }

  if (Object.keys(next).length === 0) delete all[id];
  else all[id] = next;

  writeAll(all);
  return all;
}

const OVERRIDE_KEYS = [
  "code",
  "colorName",
  "label",
  "categories",
  "defaultMm",
  ...PRICE_KEYS,
];

/** Düzenleme kaydından override patch üretir (yalnızca çerçevede tanımlı fiyat alanları). */
export function overridePatchFromSavedFrame(frame) {
  const patch = {
    code: frame.code ?? null,
    colorName: frame.colorName ?? null,
    label: frame.label ?? null,
    categories: (frame.categories ?? []).filter((c) => c !== "custom"),
    defaultMm: frame.defaultMm,
  };

  for (const key of PRICE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(frame, key)) {
      patch[key] = frame[key];
    }
  }

  return patch;
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
