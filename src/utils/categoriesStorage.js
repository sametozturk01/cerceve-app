const LS_KEY = "cerceve-custom-categories";

export function loadCustomCategories() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addCustomCategory(label) {
  const id = "cat_" + label.trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32)
    + "_" + Date.now().toString(36);

  const entry = { id, label: label.trim(), custom: true };
  const cats = loadCustomCategories();
  cats.push(entry);
  localStorage.setItem(LS_KEY, JSON.stringify(cats));
  return entry;
}

export function deleteCustomCategory(id) {
  const cats = loadCustomCategories().filter((c) => c.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(cats));
  return cats;
}

export function renameCustomCategory(id, newLabel) {
  const cats = loadCustomCategories().map((c) =>
    c.id === id ? { ...c, label: newLabel.trim() } : c
  );
  localStorage.setItem(LS_KEY, JSON.stringify(cats));
  return cats;
}

const LABEL_OVERRIDE_KEY = "cerceve-series-label-overrides";

export function loadSeriesLabelOverrides() {
  try {
    const raw = localStorage.getItem(LABEL_OVERRIDE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSeriesLabelOverride(id, label) {
  const all = { ...loadSeriesLabelOverrides() };
  const trimmed = (label ?? "").trim();
  if (!trimmed) delete all[id];
  else all[id] = trimmed;
  localStorage.setItem(LABEL_OVERRIDE_KEY, JSON.stringify(all));
  return all;
}
