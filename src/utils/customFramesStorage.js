import {
  blobToDataUrl,
  deleteSharedFrame,
  fetchSharedCatalog,
  patchSharedFrame,
  postSharedFrame,
  putSharedCatalog,
} from "./sharedCatalogClient";
import { markFrameRemoved, mergeCustomFrames, rememberDeletedFrameIds } from "./catalogSync";

const DB_NAME = "cerceve-custom-frames";
const DB_VERSION = 1;
const STORE = "frames";

const COLOR_DEFAULTS = {
  gumus: { id: "gumus", label: "Gümüş", hex: "#D8DCDC" },
  gümüş: { id: "gumus", label: "Gümüş", hex: "#D8DCDC" },
  ceviz: { id: "ceviz", label: "Ceviz", hex: "#5C4A3A" },
  "ceviz gümüş": { id: "ceviz-gumus", label: "Ceviz Gümüş", hex: "#4A3A32" },
  "ceviz gumus": { id: "ceviz-gumus", label: "Ceviz Gümüş", hex: "#4A3A32" },
  "oksit gümüş": { id: "oksit-gumus", label: "Oksit Gümüş", hex: "#A39E94" },
  "oksit gumus": { id: "oksit-gumus", label: "Oksit Gümüş", hex: "#A39E94" },
  siyah: { id: "siyah", label: "Siyah", hex: "#1a1a1a" },
  altin: { id: "altin", label: "Altın", hex: "#C8A84B" },
  altın: { id: "altin", label: "Altın", hex: "#C8A84B" },
  beyaz: { id: "beyaz", label: "Beyaz", hex: "#f0f0f0", stroke: "#ccc" },
  kahve: { id: "kahve", label: "Kahve", hex: "#5C3D1E" },
  "kinder mavi": { id: "kinder-mavi", label: "Kinder Mavi", hex: "#8BAEC8" },
  yeşil: { id: "yesil", label: "Yeşil", hex: "#2F5A3A" },
  yesil: { id: "yesil", label: "Yeşil", hex: "#2F5A3A" },
  "çizgili gümüş": { id: "cizgili-gumus", label: "Çizgili Gümüş", hex: "#C5C9CC" },
  lacivert: { id: "lacivert", label: "Lacivert", hex: "#1E3A5F" },
  platin: { id: "platin", label: "Platin", hex: "#E5E4E2" },
  şampanya: { id: "sampanya", label: "Şampanya", hex: "#D4C4A8" },
  sampanya: { id: "sampanya", label: "Şampanya", hex: "#D4C4A8" },
  gri: { id: "gri", label: "Gri", hex: "#6B7280" },
  bronz: { id: "bronz", label: "Bronz", hex: "#8C6A3F" },
  bakır: { id: "bakir", label: "Bakır", hex: "#B87333" },
  bakir: { id: "bakir", label: "Bakır", hex: "#B87333" },
  "eskitme altın": { id: "eskitme-altin", label: "Eskitme Altın", hex: "#A67C52" },
  "eskitme altin": { id: "eskitme-altin", label: "Eskitme Altın", hex: "#A67C52" },
  "antik bronz": { id: "antik-bronz", label: "Antik Bronz", hex: "#6E4E32" },
  "düz altın": { id: "duz-altin", label: "Düz Altın", hex: "#C8A84B" },
  "duz altin": { id: "duz-altin", label: "Düz Altın", hex: "#C8A84B" },
};

const SERIES_CATEGORY = {
  "20 lik": "20lik",
  "22 lik": "22lik",
  "FA 20": "fa20",
  "FA 22": "fa22",
  "FA 30": "fa30",
  "FA 40": "fa40",
  "29 D": "29d",
  "29 KR Düz": "29krduz",
  "29 KR": "29krduz",
  "29 kr düz": "29krduz",
  "FA 29 KR": "29krduz",
  "28 KR Boncuklu": "28krboncuklu",
  "28 KR": "28krboncuklu",
  "28 kr boncuklu": "28krboncuklu",
  "35 lik": "35lik",
  "35 L": "35l",
  "35 l": "35l",
  "34 L": "34l",
  "34 l": "34l",
  "47 L": "47l",
  "47 l": "47l",
  "FA 41": "fa41",
  "fa 41": "fa41",
  "FA 52": "fa52",
  "fa 52": "fa52",
  "F30 D91": "f30d91",
  "F30 Düz": "f30duz",
  "30 luk Ağaç Kabuğu": "30luk-agac-kabugu",
  "46 d": "46d",
  "46 D": "46d",
  "46 Ağaç Kabuğu": "46-agac-kabugu",
  "46 ağaç kabuğu": "46-agac-kabugu",
  "A 25": "a25",
  "B 26": "b26",
  "C 27": "c27",
  "D 28": "d28",
  "E 29": "e29",
  "G 20": "g20",
  "R 21": "r21",
  "Yeni 20": "yeni20",
};

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

function colorEntry(colorName) {
  const key = colorName.trim().toLowerCase();
  if (COLOR_DEFAULTS[key]) return COLOR_DEFAULTS[key];
  const id = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  return { id: id || "custom", label: colorName.trim(), hex: "#888888" };
}

export function buildFrameEntry({ code, colorName, label, categories, thickness, defaultMm, imageUrl }) {
  const cats = [...categories];
  if (code && SERIES_CATEGORY[code] && !cats.includes(SERIES_CATEGORY[code])) {
    cats.unshift(SERIES_CATEGORY[code]);
  }

  if (code && colorName) {
    const id = `custom:${code} ${colorName}:${Date.now().toString(36)}`;
    return {
      id,
      code,
      colorName,
      label: label || `${code} ${colorName}`,
      categories: cats,
      thickness,
      defaultMm,
      radius: 0,
      image: imageUrl,
      colors: [colorEntry(colorName)],
      custom: true,
      updatedAt: Date.now(),
    };
  }

  const name = label || "Özel Çerçeve";
  return {
    id: `custom:${name}`,
    label: name,
    categories: cats,
    thickness,
    defaultMm,
    radius: 0,
    image: imageUrl,
    colors: [],
    custom: true,
    updatedAt: Date.now(),
  };
}

function loadIdbRows() {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
      })
  );
}

function framesFromIdbRows(rows) {
  return rows.map((row) => {
    const imageUrl = row.imageBlob ? URL.createObjectURL(row.imageBlob) : row.image;
    const { imageBlob, ...meta } = row;
    return { ...meta, image: imageUrl, custom: true };
  });
}

async function saveToIdb(frameMeta, imageBlob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...frameMeta, imageBlob });
    tx.oncomplete = () => resolve(frameMeta);
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromIdb(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateIdbToShared() {
  const rows = await loadIdbRows();
  for (const row of rows) {
    if (!row?.id || !row.imageBlob) continue;
    try {
      const { imageBlob, ...meta } = row;
      const dataUrl = await blobToDataUrl(imageBlob);
      await postSharedFrame({ ...meta, custom: true }, dataUrl);
      await deleteFromIdb(row.id);
    } catch (err) {
      console.error("Yerel çerçeve paylaşılamadı:", row.id, err);
    }
  }
}

export async function loadCustomFrames() {
  const rows = await loadIdbRows();
  const local = framesFromIdbRows(rows);
  const shared = await fetchSharedCatalog();
  if (shared) {
    if (shared.deletedFrameIds?.length) rememberDeletedFrameIds(shared.deletedFrameIds);
    await migrateIdbToShared();
    const fresh = await fetchSharedCatalog();
    const remote = (fresh ?? shared).frames.map((f) => ({ ...f, custom: true }));
    return mergeCustomFrames(local, remote);
  }
  return local;
}

async function fitBlobForUpload(blob, maxBytes = 2800000) {
  if (!blob || blob.size <= maxBytes) return blob;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Görsel küçültülemedi."));
      image.src = url;
    });
    const scale = Math.min(0.85, Math.max(0.4, Math.sqrt(maxBytes / blob.size)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(64, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(64, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error("PNG oluşturulamadı."))),
        "image/png"
      );
    });
    return out.size < blob.size ? out : blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function saveCustomFrame(frameMeta, imageBlob) {
  const dataUrl = imageBlob ? await blobToDataUrl(await fitBlobForUpload(imageBlob)) : null;
  if (!dataUrl) {
    throw new Error("Görsel kaydedilemedi.");
  }
  try {
    const saved = await postSharedFrame({ ...frameMeta, custom: true }, dataUrl);
    try {
      await deleteFromIdb(frameMeta.id);
    } catch {
      /* yerel kopya yoksa sorun değil */
    }
    return saved;
  } catch {
    const local = { ...frameMeta, custom: true };
    local.image = URL.createObjectURL(imageBlob);
    try {
      await saveToIdb({ ...local, image: local.image }, imageBlob);
    } catch {
      /* oturum boyunca blob URL yeterli */
    }
    return local;
  }
}

export function mergeFrameMeta(
  base,
  {
    code,
    colorName,
    label,
    categories,
    defaultMm,
    price,
    pricePerCm,
    pleksiPrice,
    pleksiPricePerCm,
    camPrice,
    camPricePerCm,
    motifCamPrice,
    motifCamPricePerCm,
    accessory,
  }
) {
  const cats = [...(categories ?? base.categories ?? [])];
  const seriesCode = code?.trim() || base.code || null;
  const color = colorName?.trim() || base.colorName || null;

  if (seriesCode && SERIES_CATEGORY[seriesCode] && !cats.includes(SERIES_CATEGORY[seriesCode])) {
    cats.unshift(SERIES_CATEGORY[seriesCode]);
  }

  const next = {
    ...base,
    categories: cats,
    defaultMm: defaultMm ?? base.defaultMm,
    updatedAt: Date.now(),
  };

  if (accessory) next.accessory = accessory;

  if (seriesCode) next.code = seriesCode;
  else delete next.code;

  if (color) {
    next.colorName = color;
    next.colors = [colorEntry(color)];
  } else if (!seriesCode) {
    delete next.colorName;
  }

  if (label?.trim()) {
    next.label = label.trim();
  } else if (seriesCode && color) {
    next.label = `${seriesCode} ${color}`;
  }

  if (price !== undefined) {
    if (price === null || price === "") {
      delete next.price;
    } else {
      const parsed = Math.max(0, Math.round(Number(price)));
      next.price = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (pleksiPrice !== undefined) {
    if (pleksiPrice === null || pleksiPrice === "") {
      delete next.pleksiPrice;
    } else {
      const parsed = Math.max(0, Math.round(Number(pleksiPrice)));
      next.pleksiPrice = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (camPrice !== undefined) {
    if (camPrice === null || camPrice === "") {
      delete next.camPrice;
    } else {
      const parsed = Math.max(0, Math.round(Number(camPrice)));
      next.camPrice = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (motifCamPrice !== undefined) {
    if (motifCamPrice === null || motifCamPrice === "") {
      delete next.motifCamPrice;
    } else {
      const parsed = Math.max(0, Math.round(Number(motifCamPrice)));
      next.motifCamPrice = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (pricePerCm !== undefined) {
    if (pricePerCm === null || pricePerCm === "") {
      delete next.pricePerCm;
    } else {
      const parsed = Math.max(0, Math.round(Number(pricePerCm)));
      next.pricePerCm = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (pleksiPricePerCm !== undefined) {
    if (pleksiPricePerCm === null || pleksiPricePerCm === "") {
      delete next.pleksiPricePerCm;
    } else {
      const parsed = Math.max(0, Math.round(Number(pleksiPricePerCm)));
      next.pleksiPricePerCm = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (camPricePerCm !== undefined) {
    if (camPricePerCm === null || camPricePerCm === "") {
      delete next.camPricePerCm;
    } else {
      const parsed = Math.max(0, Math.round(Number(camPricePerCm)));
      next.camPricePerCm = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (motifCamPricePerCm !== undefined) {
    if (motifCamPricePerCm === null || motifCamPricePerCm === "") {
      delete next.motifCamPricePerCm;
    } else {
      const parsed = Math.max(0, Math.round(Number(motifCamPricePerCm)));
      next.motifCamPricePerCm = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  return next;
}

export function applyCatalogOverride(base, patch) {
  if (!patch) return base;
  const picked = {};
  for (const key of [
    "code",
    "colorName",
    "label",
    "categories",
    "defaultMm",
    "price",
    "pricePerCm",
    "pleksiPrice",
    "pleksiPricePerCm",
    "camPrice",
    "camPricePerCm",
    "motifCamPrice",
    "motifCamPricePerCm",
  ]) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      picked[key] = patch[key];
    }
  }
  const merged = mergeFrameMeta(base, picked);
  for (const key of [
    "price",
    "pricePerCm",
    "pleksiPrice",
    "pleksiPricePerCm",
    "camPrice",
    "camPricePerCm",
    "motifCamPrice",
    "motifCamPricePerCm",
  ]) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      if (patch[key] === null || patch[key] === "") {
        delete merged[key];
      } else {
        merged[key] = Math.max(0, Math.round(Number(patch[key]) || 0));
      }
    }
  }
  return merged;
}

export async function updateCustomFrame(id, updates) {
  const shared = await fetchSharedCatalog();
  if (shared?.frames.some((f) => f.id === id)) {
    const current = shared.frames.find((f) => f.id === id);
    const merged = mergeFrameMeta({ ...current, custom: true }, updates);
    const { image: _image, ...patch } = merged;
    return patchSharedFrame(id, patch);
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result;
      if (!row) {
        reject(new Error("Çerçeve bulunamadı."));
        return;
      }
      const { imageBlob, ...meta } = row;
      const updated = mergeFrameMeta({ ...meta, custom: true }, updates);
      store.put({ ...updated, imageBlob });
      tx.oncomplete = () => {
        resolve({
          ...updated,
          image: URL.createObjectURL(imageBlob),
        });
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

export async function deleteCustomFrame(id) {
  markFrameRemoved(id);
  putSharedCatalog({ deletedFrameIds: [id] }).catch((err) => {
    console.warn("Silinen çerçeve paylaşılamadı.", err);
  });
  const shared = await fetchSharedCatalog();
  if (shared?.frames.some((f) => f.id === id)) {
    await deleteSharedFrame(id);
  }
  try {
    await deleteFromIdb(id);
  } catch {
    /* yoksa sorun değil */
  }
}

export function revokeFrameUrls(frames) {
  for (const f of frames) {
    if (f.image?.startsWith("blob:")) URL.revokeObjectURL(f.image);
  }
}
