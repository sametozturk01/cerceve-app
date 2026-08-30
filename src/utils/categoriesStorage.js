import { fetchSharedCatalog, putSharedCatalog } from "./sharedCatalogClient";
import { clearCategoryRemoved, markCategoryRemoved, mergeCategories, mergeObjectMaps } from "./catalogSync";

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
      deletedCategoryIds: deletedIds,
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
  if (existing) return existing;

  let id = slugSeriesId(trimmed);
  const taken = new Set(
    [...knownCategories, ...readLocal()].map((c) => c.id)
  );
  if (taken.has(id) || id === "all") {
    id = `${id}_${Date.now().toString(36)}`;
  }

  const entry = { id, label: trimmed, userAdded: true };
  clearCategoryRemoved(id);
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

export async function hydrateCustomCategoriesFromShared() {
  const shared = await fetchSharedCatalog();
  if (!shared) return readLocal();
  const merged = mergeCategories(readLocal(), shared.categories);
  writeLocal(merged);
  const sharedIds = new Set((shared.categories ?? []).map((c) => c.id));
  if (merged.some((c) => !sharedIds.has(c.id))) {
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

export function loadSeriesLabelOverrides() {
  return readLabelOverrides();
}

export function saveSeriesLabelOverride(id, label) {
  const all = { ...readLabelOverrides() };
  const trimmed = (label ?? "").trim();
  if (!trimmed) delete all[id];
  else all[id] = trimmed;
  localStorage.setItem(LABEL_OVERRIDE_KEY, JSON.stringify(all));
  putSharedCatalog({ seriesLabels: all }).catch((err) => {
    console.warn("Seri adları paylaşılamadı.", err);
  });
  return all;
}

export function rememberSeriesLabels(labels) {
  localStorage.setItem(LABEL_OVERRIDE_KEY, JSON.stringify(labels ?? {}));
  return labels ?? {};
}

export async function hydrateSeriesLabelsFromShared() {
  const shared = await fetchSharedCatalog();
  if (!shared) return readLabelOverrides();
  const merged = mergeObjectMaps(readLabelOverrides(), shared.seriesLabels);
  rememberSeriesLabels(merged);
  const sharedKeys = Object.keys(shared.seriesLabels ?? {});
  if (Object.keys(merged).some((k) => !sharedKeys.includes(k))) {
    putSharedCatalog({ seriesLabels: merged }).catch(() => {});
  }
  return merged;
}
