import { fetchSharedCatalog, putSharedCatalog } from "./sharedCatalogClient";
import { clearCategoryRemoved, mergeIdLists } from "./catalogSync";

const STORAGE_KEY = "cerceve-hidden-series-ids";
const UNHIDDEN_KEY = "cerceve-unhidden-series-ids";

function readIds(key = STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key, ids) {
  localStorage.setItem(key, JSON.stringify([...new Set(ids.filter(Boolean))]));
}

function withoutUnhidden(ids) {
  const skip = new Set(readIds(UNHIDDEN_KEY));
  return ids.filter((id) => !skip.has(id));
}

export function loadHiddenSeriesIds() {
  return new Set(withoutUnhidden(readIds()));
}

export function rememberHiddenSeriesIds(ids = []) {
  const merged = withoutUnhidden(mergeIdLists(readIds(), ids));
  writeIds(STORAGE_KEY, merged);
  return new Set(merged);
}

export function hideSeriesCategory(id) {
  if (id === "all") return loadHiddenSeriesIds();
  const ids = readIds();
  if (!ids.includes(id)) ids.push(id);
  writeIds(STORAGE_KEY, ids);
  writeIds(
    UNHIDDEN_KEY,
    readIds(UNHIDDEN_KEY).filter((item) => item !== id)
  );
  putSharedCatalog({ hiddenSeriesIds: ids }).catch((err) => {
    console.warn("Gizlenen seriler paylaşılamadı.", err);
  });
  return new Set(ids);
}

export function unhideSeriesCategory(id) {
  const ids = readIds().filter((x) => x !== id);
  writeIds(STORAGE_KEY, ids);
  const unhidden = readIds(UNHIDDEN_KEY);
  if (!unhidden.includes(id)) unhidden.push(id);
  writeIds(UNHIDDEN_KEY, unhidden);
  putSharedCatalog({ hiddenSeriesIds: ids, unhiddenSeriesIds: [id] }).catch((err) => {
    console.warn("Seri geri alınamadı.", err);
  });
  return new Set(ids);
}

export function restoreCatalogSeriesOnce(id) {
  const flag = `cerceve-restored-series:${id}`;
  if (!id || localStorage.getItem(flag)) return loadHiddenSeriesIds();
  localStorage.setItem(flag, "1");
  clearCategoryRemoved(id);
  return unhideSeriesCategory(id);
}

export async function hydrateHiddenSeriesFromShared() {
  const shared = await fetchSharedCatalog();
  if (!shared) return loadHiddenSeriesIds();
  const merged = withoutUnhidden(mergeIdLists(readIds(), shared.hiddenSeriesIds));
  writeIds(STORAGE_KEY, merged);
  if (merged.some((id) => !(shared.hiddenSeriesIds ?? []).includes(id))) {
    putSharedCatalog({ hiddenSeriesIds: merged }).catch(() => {});
  }
  return new Set(merged);
}

