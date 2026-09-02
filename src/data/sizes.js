/** Standart tablo ölçüleri (cm). Çerçeve: çevre (m) × ₺/m birim fiyat. */
export const SIZE_OPTIONS = [
  { id: "30x40", label: "30 × 40 cm", widthCm: 30, heightCm: 40 },
  { id: "40x60", label: "40 × 60 cm", widthCm: 40, heightCm: 60 },
  { id: "35x50", label: "35 × 50 cm", widthCm: 35, heightCm: 50 },
  { id: "50x70", label: "50 × 70 cm", widthCm: 50, heightCm: 70 },
  { id: "60x90", label: "60 × 90 cm", widthCm: 60, heightCm: 90 },
];

export function parseSizeId(sizeId) {
  if (!sizeId || typeof sizeId !== "string") return null;
  const parts = sizeId.split("x").map((n) => Number(n));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { widthCm: parts[0], heightCm: parts[1] };
}
