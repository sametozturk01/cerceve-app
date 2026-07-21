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
