/** Standart tablo ölçüleri (cm). Çerçeve: çevre (m) × ₺/m birim fiyat. */
export const SIZE_OPTIONS = [
  { id: "40x30", label: "40 × 30 cm", widthCm: 40, heightCm: 30 },
  { id: "60x40", label: "60 × 40 cm", widthCm: 60, heightCm: 40 },
  { id: "50x35", label: "50 × 35 cm", widthCm: 50, heightCm: 35 },
  { id: "70x50", label: "70 × 50 cm", widthCm: 70, heightCm: 50 },
  { id: "90x60", label: "90 × 60 cm", widthCm: 90, heightCm: 60 },
];

export function parseSizeId(sizeId) {
  if (!sizeId || typeof sizeId !== "string") return null;
  const parts = sizeId.split("x").map((n) => Number(n));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { widthCm: parts[0], heightCm: parts[1] };
}
