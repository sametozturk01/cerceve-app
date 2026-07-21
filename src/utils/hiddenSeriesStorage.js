const STORAGE_KEY = "cerceve-hidden-series-ids";

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

export function loadHiddenSeriesIds() {
  return new Set(readIds());
}

export function hideSeriesCategory(id) {
  if (id === "all") return loadHiddenSeriesIds();
  const ids = readIds();
  if (!ids.includes(id)) ids.push(id);
  writeIds(ids);
  return new Set(ids);
}

export function unhideSeriesCategory(id) {
  const ids = readIds().filter((x) => x !== id);
  writeIds(ids);
  return new Set(ids);
}
