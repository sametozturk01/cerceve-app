import { fetchSharedCatalog, putSharedCatalog } from "./sharedCatalogClient";
import {
  clearCategoryRemoved,
  markCategoryRemoved,
  mergeCategories,
  mergeObjectMaps,
  rememberDeletedCategoryIds,
  loadDeletedCategoryIds,
} from "./catalogSync";
import { unhideSeriesCategory } from "./hiddenSeriesStorage";

const LS_KEY = "cerceve-custom-categories";

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(cats) {
  localStorage.setItem(LS_KEY, JSON.stringify(cats));
}

export function loadCustomCategories() {
  return readLocal();
}

export function stripCatalogDuplicateCategories(userCats = [], catalogCats = []) {
  const catalogIds = new Set(
    (catalogCats ?? []).map((c) => c?.id).filter((id) => id && id !== "all")
  );
  const catalogLabels = new Set(
    (catalogCats ?? [])
      .map((c) => normalizeLabel(c?.label))
      .filter((label) => label && label !== "tümü")
  );
  return (userCats ?? []).filter((cat) => {
    if (!cat?.id) return false;
    if (catalogIds.has(cat.id)) return false;
    const label = normalizeLabel(cat.label);
    if (label && catalogLabels.has(label)) return false;
    return true;
  });
}

export function sanitizeSeriesLabelOverrides(overrides = {}, catalogCats = []) {
  const next = { ...(overrides ?? {}) };
  const cats = catalogCats ?? [];
  for (const [id, label] of Object.entries(next)) {
    const key = normalizeLabel(label);
    if (!key) {
      delete next[id];
      continue;
    }
    const official = cats.find((c) => c?.id === id)?.label;
    if (official && normalizeLabel(official) === key) {
      delete next[id];
      continue;
    }
    const taken = cats.some(
      (c) => c?.id && c.id !== id && c.id !== "all" && normalizeLabel(c.label) === key
    );
    if (taken) delete next[id];
  }
  return next;
}

export function mergeVisibleCategories(catalogCats = [], userCats = [], labelOverrides = {}) {
  const seenIds = new Set();
  const seenLabels = new Set();
  const extras = stripCatalogDuplicateCategories(userCats, catalogCats);
  const overrides = sanitizeSeriesLabelOverrides(labelOverrides, catalogCats);
  const out = [];
  for (const cat of [...catalogCats, ...extras]) {
    if (!cat?.id || seenIds.has(cat.id)) continue;
    const label = overrides[cat.id] ?? cat.label;
    const key = normalizeLabel(label);
    if (key && seenLabels.has(key) && cat.id !== "all") continue;
    seenIds.add(cat.id);
    if (key) seenLabels.add(key);
    out.push({ ...cat, label });
  }
  return out;
}

export function pruneCatalogDuplicateCategories(catalogCats = []) {
  const current = readLocal();
  const cleaned = stripCatalogDuplicateCategories(current, catalogCats);
  if (cleaned.length === current.length) return cleaned;
  persistCategories(cleaned);
  return cleaned;
}

export function isUserSeries(cat) {
  return Boolean(cat?.userAdded || cat?.custom);
}

function normalizeLabel(label) {
  return String(label ?? "").trim().toLocaleLowerCase("tr-TR");
}

export function slugSeriesId(label) {
  const slug = String(label ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 32);
  return slug || "seri";
}

function findSeriesByLabel(label, lists) {
  const key = normalizeLabel(label);
  if (!key) return null;
  for (const list of lists) {
    const match = (list ?? []).find((c) => normalizeLabel(c.label) === key);
    if (match) return match;
  }
  return null;
}

async function persistCategories(cats, deletedIds = []) {
  writeLocal(cats);
  try {
    await putSharedCatalog({
      categories: cats,
      deletedCategoryIds: [...new Set([...loadDeletedCategoryIds(), ...deletedIds])],
    });
  } catch (err) {
    console.warn("Seriler paylaşılamadı.", err);
  }
  return cats;
}

export function addCustomCategory(label, knownCategories = []) {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const existing = findSeriesByLabel(trimmed, [knownCategories, readLocal()]);
  if (existing) {
    clearCategoryRemoved(existing.id);
    unhideSeriesCategory(existing.id);
    return existing;
  }

  let id = slugSeriesId(trimmed);
  const taken = new Set(
    [...knownCategories, ...readLocal()].map((c) => c.id)
  );
  if (taken.has(id) || id === "all") {
    id = `${id}_${Date.now().toString(36)}`;
  }

  const entry = { id, label: trimmed, userAdded: true };
  clearCategoryRemoved(id);
  unhideSeriesCategory(id);
  persistCategories([...readLocal(), entry]);
  return entry;
}

export function deleteCustomCategory(id) {
  markCategoryRemoved(id);
  const cats = readLocal().filter((c) => c.id !== id);
  persistCategories(cats, [id]);
  return cats;
}

export function renameCustomCategory(id, newLabel) {
  const cats = readLocal().map((c) =>
    c.id === id ? { ...c, label: newLabel.trim() } : c
  );
  persistCategories(cats);
  return cats;
}

export function rememberCategories(cats) {
  writeLocal(cats);
  return cats;
}

export async function hydrateCustomCategoriesFromShared(catalogCats = []) {
  const shared = await fetchSharedCatalog();
  if (!shared) return stripCatalogDuplicateCategories(readLocal(), catalogCats);
  if (shared.deletedCategoryIds?.length) {
    rememberDeletedCategoryIds(shared.deletedCategoryIds);
  }
  const merged = stripCatalogDuplicateCategories(
    mergeCategories(readLocal(), shared.categories),
    catalogCats
  );
  writeLocal(merged);
  const sharedClean = stripCatalogDuplicateCategories(shared.categories ?? [], catalogCats);
  const sharedIds = new Set(sharedClean.map((c) => c.id));
  if (
    merged.some((c) => !sharedIds.has(c.id)) ||
    sharedClean.length !== (shared.categories ?? []).length
  ) {
    persistCategories(merged);
  }
  return merged;
}

const LABEL_OVERRIDE_KEY = "cerceve-series-label-overrides";

function readLabelOverrides() {
  try {
    const raw = localStorage.getItem(LABEL_OVERRIDE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadSeriesLabelOverrides(catalogCats = []) {
  return sanitizeSeriesLabelOverrides(readLabelOverrides(), catalogCats);
}

export function saveSeriesLabelOverride(id, label, catalogCats = []) {
  const all = { ...readLabelOverrides() };
  const trimmed = (label ?? "").trim();
  if (!trimmed) delete all[id];
  else all[id] = trimmed;
  const cleaned = sanitizeSeriesLabelOverrides(all, catalogCats);
  localStorage.setItem(LABEL_OVERRIDE_KEY, JSON.stringify(cleaned));
  putSharedCatalog({ seriesLabels: cleaned }).catch((err) => {
    console.warn("Seri adları paylaşılamadı.", err);
  });
  return cleaned;
}

export function rememberSeriesLabels(labels) {
  localStorage.setItem(LABEL_OVERRIDE_KEY, JSON.stringify(labels ?? {}));
  return labels ?? {};
}

export async function hydrateSeriesLabelsFromShared(catalogCats = []) {
  const shared = await fetchSharedCatalog();
  const merged = sanitizeSeriesLabelOverrides(
    shared
      ? mergeObjectMaps(readLabelOverrides(), shared.seriesLabels)
      : readLabelOverrides(),
    catalogCats
  );
  rememberSeriesLabels(merged);
  const sharedLabels = shared?.seriesLabels ?? {};
  const changed = JSON.stringify(merged) !== JSON.stringify(sharedLabels);
  if (changed) {
    putSharedCatalog({ seriesLabels: merged }).catch(() => {});
  }
  return merged;
}
