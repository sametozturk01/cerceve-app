/** Çerçeve adını tüm arayüzde aynı göstermek için tek kaynak. */
export function getFrameDisplayLabel(frame) {
  if (!frame) return "Çerçeve";

  const label = frame.label?.trim();
  if (label) return label;

  const code = frame.code?.trim();
  const color = frame.colorName?.trim();
  if (code && color) return `${code} ${color}`;
  return code || color || frame.id || "Çerçeve";
}
