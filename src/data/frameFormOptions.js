export const SERIES_OPTIONS = ["20 lik", "22 lik", "29 D", "F30 D91", "F30 Düz", "30 luk Ağaç Kabuğu", "46 d", ""];

export const BASE_CATEGORY_OPTIONS = [
  { id: "20lik", label: "20 lik" },
  { id: "22lik", label: "22 lik" },
  { id: "29d", label: "29 D" },
  { id: "f30d91", label: "F30 D91" },
  { id: "f30duz", label: "F30 Düz" },
  { id: "30luk-agac-kabugu", label: "30 luk Ağaç Kabuğu" },
  { id: "46d", label: "46 d" },
];

export const EDITABLE_CATEGORY_OPTIONS = BASE_CATEGORY_OPTIONS;

export function defaultMmFromSeriesLabel(label) {
  const key = String(label ?? "").trim().toLocaleLowerCase("tr-TR");
  if (key === "46 d" || key === "46d") return 30;
  const m = String(label ?? "").match(/(\d+)/);
  if (!m) return 20;
  const n = Number(m[1]);
  return n >= 10 && n <= 80 ? n : 20;
}

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
