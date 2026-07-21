/** Standart tablo ölçüleri (cm). Çerçeve: çevre (m) × ₺/m birim fiyat. */
export const SIZE_OPTIONS = [
  { id: "20x20", label: "20×20 cm", widthCm: 20, heightCm: 20 },
  { id: "30x30", label: "30×30 cm", widthCm: 30, heightCm: 30 },
  { id: "40x40", label: "40×40 cm", widthCm: 40, heightCm: 40 },
  { id: "50x50", label: "50×50 cm", widthCm: 50, heightCm: 50 },
  { id: "60x40", label: "60×40 cm", widthCm: 60, heightCm: 40 },
  { id: "80x60", label: "80×60 cm", widthCm: 80, heightCm: 60 },
];

export function parseSizeId(sizeId) {
  if (!sizeId || typeof sizeId !== "string") return null;
  const parts = sizeId.split("x").map((n) => Number(n));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { widthCm: parts[0], heightCm: parts[1] };
}
