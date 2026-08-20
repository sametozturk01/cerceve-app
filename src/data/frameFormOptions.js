export const SERIES_OPTIONS = ["20 lik", "22 lik", "29 D", "29 KR", "29 -210", "30 luk", "30 d 91", "35 lik", ""];

export const BASE_CATEGORY_OPTIONS = [
  { id: "20lik", label: "20 lik" },
  { id: "22lik", label: "22 lik" },
  { id: "29d", label: "29 D" },
  { id: "fa29kr", label: "29 KR" },
  { id: "29210", label: "29 -210" },
  { id: "30luk", label: "30 luk" },
  { id: "30d91", label: "30 d 91" },
  { id: "35lik", label: "35 lik" },
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
