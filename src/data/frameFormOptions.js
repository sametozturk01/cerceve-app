export const SERIES_OPTIONS = ["20 lik", "22 lik", "29 D", "29 KR", "29 -210", "30 luk", "30 d 91", "34 L", "48 L", "41 lik", "41 -545", "41 -13", "41 -11", "41 -07", "41 -03", "41 -02", "41 -01", "52 B", ""];

export const BASE_CATEGORY_OPTIONS = [
  { id: "20lik", label: "20 lik" },
  { id: "22lik", label: "22 lik" },
  { id: "29d", label: "29 D" },
  { id: "fa29kr", label: "29 KR" },
  { id: "29210", label: "29 -210" },
  { id: "30luk", label: "30 luk" },
  { id: "30d91", label: "30 d 91" },
  { id: "34l", label: "34 L" },
  { id: "48l", label: "48 L" },
  { id: "41lik", label: "41 lik" },
  { id: "41545", label: "41 -545" },
  { id: "4113", label: "41 -13" },
  { id: "4111", label: "41 -11" },
  { id: "4107", label: "41 -07" },
  { id: "4103", label: "41 -03" },
  { id: "4102", label: "41 -02" },
  { id: "4101", label: "41 -01" },
  { id: "52b", label: "52 B" },
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
