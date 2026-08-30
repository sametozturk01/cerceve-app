import { fetchSharedCatalog, putSharedCatalog } from "./sharedCatalogClient";
import { mergeObjectMaps } from "./catalogSync";

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

function writeLocalOnly(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function writeAll(data) {
  writeLocalOnly(data);
  putSharedCatalog({ overrides: data }).catch((err) => {
    console.warn("Fiyat/ad düzenlemeleri paylaşılamadı.", err);
  });
}

export function loadFrameOverrides() {
  return readAll();
}

export function rememberFrameOverrides(data) {
  writeLocalOnly(data ?? {});
  return data ?? {};
}

export async function hydrateFrameOverridesFromShared() {
  const shared = await fetchSharedCatalog();
  if (!shared) return readAll();
  const local = readAll();
  const merged = mergeObjectMaps(local, shared.overrides);
  rememberFrameOverrides(merged);
  const sharedKeys = Object.keys(shared.overrides ?? {});
  if (Object.keys(merged).some((k) => !sharedKeys.includes(k))) {
    writeAll(merged);
  }
  return merged;
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
