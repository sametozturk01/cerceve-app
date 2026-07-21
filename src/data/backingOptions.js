/** Siparişte tek seçim: pleksi veya cam türü (₺/m² müşteri girer) */
export const BACKING_OPTIONS = [
  {
    id: "pleksi",
    label: "Pleksi",
    priceField: "pleksiPrice",
    legacyField: "pleksiPricePerCm",
  },
  {
    id: "duz_cam",
    label: "Düz cam",
    priceField: "camPrice",
    legacyField: "camPricePerCm",
  },
  {
    id: "motif_cam",
    label: "Motobel cam",
    priceField: "motifCamPrice",
    legacyField: "motifCamPricePerCm",
  },
];

export function findBackingOption(id) {
  return BACKING_OPTIONS.find((o) => o.id === id) ?? null;
}
