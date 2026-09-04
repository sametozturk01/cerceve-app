const SHARED_CATALOG_ORIGIN = (
  import.meta.env.VITE_SHARED_CATALOG_ORIGIN ||
  (import.meta.env.DEV ? "https://cerceve-app.vercel.app" : "")
).replace(/\/$/, "");

function catalogUrl(path) {
  return `${SHARED_CATALOG_ORIGIN}${path}`;
}

const FETCH_MS = 25000;

async function fetchCatalog(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    return await fetch(catalogUrl(path), { ...options, signal: ctrl.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Sunucu yanıt vermedi. Sayfayı yenileyip tekrar deneyin.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readError(res, fallback) {
  if (res.status === 413) return "Fotoğraf çok büyük. Daha yakın kırpılmış bir fotoğraf deneyin.";
  if (res.status === 500) return "Sunucu kaydı alamadı. Biraz sonra tekrar deneyin.";
  const err = await res.json().catch(() => ({}));
  return err.error || fallback;
}

export async function fetchSharedCatalog() {
  try {
    const res = await fetchCatalog(`/api/shared-catalog?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || Array.isArray(data) || data.error) return null;
    if (!Array.isArray(data.frames)) return null;
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
  const res = await fetchCatalog("/api/shared-catalog", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Paylaşılan katalog kaydedilemedi."));
  }
  return res.json();
}

export async function postSharedFrame(frame, imageDataUrl) {
  const res = await fetchCatalog("/api/shared-catalog/frames", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frame, imageDataUrl }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Çerçeve paylaşılamadı."));
  }
  const data = await res.json();
  return data.frame;
}

export async function patchSharedFrame(id, patch) {
  const res = await fetchCatalog("/api/shared-catalog/frames", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Çerçeve güncellenemedi."));
  }
  const data = await res.json();
  return data.frame;
}

export async function deleteSharedFrame(id) {
  const res = await fetchCatalog("/api/shared-catalog/frames", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Çerçeve silinemedi."));
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
