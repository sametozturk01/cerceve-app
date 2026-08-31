export async function fetchSharedCatalog() {
  try {
    const res = await fetch(`/api/shared-catalog?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.frames)) return null;
    return {
      frames: data.frames,
      categories: Array.isArray(data.categories) ? data.categories : [],
      overrides: data.overrides && typeof data.overrides === "object" ? data.overrides : {},
      seriesLabels:
        data.seriesLabels && typeof data.seriesLabels === "object" ? data.seriesLabels : {},
      hiddenSeriesIds: Array.isArray(data.hiddenSeriesIds) ? data.hiddenSeriesIds : [],
      hiddenFrameIds: Array.isArray(data.hiddenFrameIds) ? data.hiddenFrameIds : [],
      deletedCategoryIds: Array.isArray(data.deletedCategoryIds) ? data.deletedCategoryIds : [],
      deletedFrameIds: Array.isArray(data.deletedFrameIds) ? data.deletedFrameIds : [],
    };
  } catch {
    return null;
  }
}

export async function putSharedCatalog(partial) {
  const res = await fetch("/api/shared-catalog", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Paylaşılan katalog kaydedilemedi.");
  }
  return res.json();
}

export async function postSharedFrame(frame, imageDataUrl) {
  const res = await fetch("/api/shared-catalog/frames", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frame, imageDataUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Çerçeve paylaşılamadı.");
  }
  const data = await res.json();
  return data.frame;
}

export async function patchSharedFrame(id, patch) {
  const res = await fetch("/api/shared-catalog/frames", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Çerçeve güncellenemedi.");
  }
  const data = await res.json();
  return data.frame;
}

export async function deleteSharedFrame(id) {
  const res = await fetch("/api/shared-catalog/frames", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Çerçeve silinemedi.");
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.readAsDataURL(blob);
  });
}

export { blobToDataUrl };
