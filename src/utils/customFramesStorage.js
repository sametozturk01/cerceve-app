const DB_NAME = "cerceve-custom-frames";
const DB_VERSION = 1;
const STORE = "frames";

const COLOR_DEFAULTS = {
  gumus: { id: "gumus", label: "Gümüş", hex: "#D8DCDC" },
  gümüş: { id: "gumus", label: "Gümüş", hex: "#D8DCDC" },
  ceviz: { id: "ceviz", label: "Ceviz", hex: "#5C4A3A" },
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
  gri: { id: "gri", label: "Gri", hex: "#948073" },
};

const SERIES_CATEGORY = {
  "FA 20": "fa20",
  "FA 22": "fa22",
  "FA 30": "fa30",
  "FA 40": "fa40",
  "29 D": "29d",
  "FA 29 KR": "fa29kr",
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
  if (!cats.includes("custom")) cats.push("custom");

  if (code && colorName) {
    const id = `custom:${code} ${colorName}`;
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
  };
}

export async function loadCustomFrames() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = req.result ?? [];
      const frames = rows.map((row) => {
        const imageUrl = URL.createObjectURL(row.imageBlob);
        const { imageBlob, ...meta } = row;
        return { ...meta, image: imageUrl };
      });
      resolve(frames);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomFrame(frameMeta, imageBlob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...frameMeta, imageBlob });
    tx.oncomplete = () => resolve(frameMeta);
    tx.onerror = () => reject(tx.error);
  });
}

export function mergeFrameMeta(base, { code, colorName, label, categories, defaultMm, price }) {
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
  };

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

  return next;
}

export async function updateCustomFrame(id, updates) {
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
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function revokeFrameUrls(frames) {
  for (const f of frames) {
    if (f.image?.startsWith("blob:")) URL.revokeObjectURL(f.image);
  }
}
