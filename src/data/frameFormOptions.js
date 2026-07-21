export const SERIES_OPTIONS = ["Yeni 20", ""];

export const BASE_CATEGORY_OPTIONS = [
  { id: "yeni20", label: "Yeni 20" },
  { id: "metal", label: "Metal" },
  { id: "ahsap", label: "Ahşap" },
];

export const EDITABLE_CATEGORY_OPTIONS = BASE_CATEGORY_OPTIONS;

/** Düzenleme/ekleme modallarında Seri seçenekleri: sabit liste + kullanıcı serileri + katalog kodları */
export function buildSeriesOptions(userCategories = [], frames = []) {
  const ordered = [];
  const seen = new Set();

  const add = (value) => {
    const v = (value ?? "").trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    ordered.push(v);
  };

  SERIES_OPTIONS.filter(Boolean).forEach(add);
  userCategories.forEach((c) => add(c.label));
  frames.forEach((f) => {
    if (f?.id === "none") return;
    add(f.code);
  });

  return ["", ...ordered];
}
