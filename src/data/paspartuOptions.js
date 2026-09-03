/** Siparişte tek seçim: paspartu türü */
export const PASPARTU_OPTIONS = [
  {
    id: "ic-ice",
    label: "Çerçeveleri iç içe",
    hint: "Listeden ikinci çerçeveyi içe yerleştirin",
  },
  {
    id: "bez-tasarim",
    label: "Bez tasarım",
    hint: "Bez paspartu ile tabloyu tamamlayın",
  },
];

export function findPaspartuOption(id) {
  return PASPARTU_OPTIONS.find((o) => o.id === id) ?? null;
}
