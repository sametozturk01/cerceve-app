/** Siparişte paspartu türü: çerçeve veya kağıt */
export const PASPARTU_FRAME_ID = "cerceve-paspartu";
export const PASPARTU_PAPER_KIND_ID = "kagit-paspartu";
/** Eski kayıtlar / kısayol: çerçeve paspartu */
export const PASPARTU_VAR_ID = PASPARTU_FRAME_ID;
export const PASPARTU_YOK_ID = "paspartu-yok";

export const PASPARTU_OPTIONS = [
  {
    id: PASPARTU_FRAME_ID,
    label: "Çerçeve paspartu",
    hint: "İkinci çerçeve dışın içinde oturur",
  },
  {
    id: PASPARTU_PAPER_KIND_ID,
    label: "Kağıt paspartu",
    hint: "Fotoğraftan kağıt paspartu seçin",
  },
  {
    id: PASPARTU_YOK_ID,
    label: "Paspartu yok",
    hint: "Sadece dış çerçeve",
  },
];

export function findPaspartuOption(id) {
  if (id === "ic-ice" || id === "paspartu-var") return PASPARTU_OPTIONS[0];
  return PASPARTU_OPTIONS.find((o) => o.id === id) ?? null;
}

export function isNestedPaspartuId(id) {
  return id === PASPARTU_FRAME_ID || id === "paspartu-var" || id === "ic-ice";
}

export function isPaperPaspartuId(id) {
  return id === PASPARTU_PAPER_KIND_ID;
}

export const PASPARTU_ACCESSORY = "paspartu";
export const PAPER_ACCESSORY = "paper";
export const PASPARTU_CATEGORY_ID = "paspartu";
export const PAPER_CATEGORY_ID = "kagit";

export function isPaspartuAccessoryFrame(frame) {
  if (!frame) return false;
  if (frame.accessory === PASPARTU_ACCESSORY) return true;
  return (frame.categories ?? []).includes(PASPARTU_CATEGORY_ID);
}

export function isPaperAccessoryFrame(frame) {
  if (!frame) return false;
  if (frame.accessory === PAPER_ACCESSORY) return true;
  return (frame.categories ?? []).includes(PAPER_CATEGORY_ID);
}

export function isAccessoryFrame(frame) {
  return isPaspartuAccessoryFrame(frame) || isPaperAccessoryFrame(frame);
}

/** Paspartu çerçeve listesi. Şimdilik boş; buraya eklenecek. */
export const PASPARTU_FRAMES = [];
