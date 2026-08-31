import { fetchSharedCatalog, putSharedCatalog } from "./sharedCatalogClient";
import { mergeIdLists } from "./catalogSync";

const STORAGE_KEY = "cerceve-hidden-frame-ids";

function readIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

export function loadHiddenFrameIds() {
  return new Set(readIds());
}

export function rememberHiddenFrameIds(ids = []) {
  const merged = mergeIdLists(readIds(), ids);
  writeIds(merged);
  return new Set(merged);
}

export function hideFrameId(id) {
  const ids = readIds();
  if (!ids.includes(id)) ids.push(id);
  writeIds(ids);
  putSharedCatalog({ hiddenFrameIds: ids }).catch((err) => {
    console.warn("Gizlenen çerçeveler paylaşılamadı.", err);
  });
  return new Set(ids);
}

export function unhideFrameId(id) {
  const ids = readIds().filter((x) => x !== id);
  writeIds(ids);
  putSharedCatalog({ hiddenFrameIds: ids, unhiddenFrameIds: [id] }).catch((err) => {
    console.warn("Çerçeve geri alınamadı.", err);
  });
  return new Set(ids);
}

export async function hydrateHiddenFramesFromShared() {
  const shared = await fetchSharedCatalog();
  if (!shared) return loadHiddenFrameIds();
  const merged = mergeIdLists(readIds(), shared.hiddenFrameIds);
  writeIds(merged);
  if (merged.some((id) => !(shared.hiddenFrameIds ?? []).includes(id))) {
    putSharedCatalog({ hiddenFrameIds: merged }).catch(() => {});
  }
  return new Set(merged);
}
