/** Siparişte tek seçim: paspartu var / yok */
export const PASPARTU_VAR_ID = "paspartu-var";
export const PASPARTU_YOK_ID = "paspartu-yok";

export const PASPARTU_OPTIONS = [
  {
    id: PASPARTU_VAR_ID,
    label: "Paspartu var",
    hint: "Paspartu ve kağıt seçin",
  },
  {
    id: PASPARTU_YOK_ID,
    label: "Paspartu yok",
    hint: "Sadece çerçeve",
  },
];

export const PASPARTU_PAPER_OPTIONS = [
  { id: "beyaz", label: "Beyaz", hex: "#f4f1ea" },
  { id: "krem", label: "Krem", hex: "#e8dcc4" },
  { id: "fildisi", label: "Fildişi", hex: "#f3ead2" },
  { id: "siyah", label: "Siyah", hex: "#1c1c1c" },
  { id: "gri", label: "Gri", hex: "#9aa0a6" },
];

export function findPaspartuOption(id) {
  if (id === "ic-ice") return PASPARTU_OPTIONS[0];
  return PASPARTU_OPTIONS.find((o) => o.id === id) ?? null;
}

export function findPaspartuPaper(id) {
  return PASPARTU_PAPER_OPTIONS.find((o) => o.id === id) ?? null;
}

export function isNestedPaspartuId(id) {
  return id === PASPARTU_VAR_ID || id === "ic-ice";
}

/** Paspartu çerçeve listesi. Şimdilik boş; buraya eklenecek. */
export const PASPARTU_FRAMES = [];
