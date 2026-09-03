import { fetchSharedCatalog, putSharedCatalog } from "./sharedCatalogClient";
import { mergeObjectMaps } from "./catalogSync";
import framesCatalog from "../data/frames.json";

const STORAGE_KEY = "cerceve-frame-overrides";

const STALE_DEFAULT_MM_BY_CODE = {
  "46 d": 30,
  "46 ağaç kabuğu": 30,
  "35 l": 34,
  "47 l": 34,
};

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

/** Eski kayıtlarda seri kalınlığı yanlış mm ile override edilmişse temizler. */
export function migrateLegacySeriesDefaultMm(all = readAll()) {
  const next = { ...all };
  let changed = false;

  for (const frame of framesCatalog.frames ?? []) {
    if (!frame?.id || frame.id === "none") continue;
    const codeKey = String(frame.code ?? "").trim().toLocaleLowerCase("tr-TR");
    const staleMm = STALE_DEFAULT_MM_BY_CODE[codeKey];
    if (staleMm === undefined) continue;
    if ((frame.defaultMm ?? 0) <= staleMm) continue;

    const patch = next[frame.id];
    if (!patch || patch.defaultMm !== staleMm) continue;

    const cleaned = { ...patch };
    delete cleaned.defaultMm;
    if (Object.keys(cleaned).length === 0) delete next[frame.id];
    else next[frame.id] = cleaned;
    changed = true;
  }

  if (changed) writeAll(next);
  return next;
}

export function loadFrameOverrides() {
  return migrateLegacySeriesDefaultMm();
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
  return migrateLegacySeriesDefaultMm();
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
