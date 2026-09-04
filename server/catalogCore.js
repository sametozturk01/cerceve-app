import crypto from "node:crypto";

export const CATALOG_BLOB_PATH = "cerceve/shared-catalog.json";
export const IMAGE_BLOB_PREFIX = "cerceve/frames/";

export function emptyCatalog() {
  return {
    frames: [],
    categories: [],
    overrides: {},
    seriesLabels: {},
    hiddenSeriesIds: [],
    hiddenFrameIds: [],
    deletedCategoryIds: [],
    deletedFrameIds: [],
  };
}

export function normalizeCatalog(parsed) {
  const list = (value) =>
    Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  return {
    frames: Array.isArray(parsed?.frames) ? parsed.frames : [],
    categories: Array.isArray(parsed?.categories) ? parsed.categories : [],
    overrides: parsed?.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
    seriesLabels:
      parsed?.seriesLabels && typeof parsed.seriesLabels === "object" ? parsed.seriesLabels : {},
    hiddenSeriesIds: list(parsed?.hiddenSeriesIds),
    hiddenFrameIds: list(parsed?.hiddenFrameIds),
    deletedCategoryIds: list(parsed?.deletedCategoryIds),
    deletedFrameIds: list(parsed?.deletedFrameIds),
  };
}

export function imageFileName(id) {
  const hash = crypto.createHash("sha1").update(String(id)).digest("hex").slice(0, 10);
  const safe = String(id)
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${safe || "frame"}-${hash}.png`;
}

export function decodeImage(imageDataUrl) {
  const match = String(imageDataUrl ?? "").match(
    /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i
  );
  if (!match) throw new Error("Geçersiz görsel verisi.");
  return Buffer.from(match[2].replace(/\s/g, ""), "base64");
}

export function stripFrame(frame, imagePath) {
  const { imageBlob, ...rest } = frame ?? {};
  return {
    ...rest,
    custom: true,
    image: imagePath,
    updatedAt: Number(rest.updatedAt) || Date.now(),
  };
}

export function upsertCategoriesFromFrame(data, frame) {
  const cats = Array.isArray(frame?.categories) ? frame.categories : [];
  const label = String(frame?.code || frame?.label || "").trim();
  if (!Array.isArray(data.categories)) data.categories = [];
  const deleted = new Set(data.deletedCategoryIds ?? []);
  for (const id of cats) {
    if (!id || id === "custom" || id === "all" || deleted.has(id)) continue;
    if (data.categories.some((c) => c.id === id)) continue;
    data.categories.push({
      id,
      label: label || id,
      userAdded: true,
    });
  }
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

let writeChain = Promise.resolve();

export function withCatalogLock(fn) {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function dispatchCatalogRequest({ method, kind, body, store }) {
  if (kind === "root" && method === "GET") {
    return { status: 200, json: await store.readCatalog() };
  }

  if (kind === "root" && method === "PUT") {
    const json = await withCatalogLock(async () => {
      let current = await store.readCatalog();
      if ((current.frames?.length ?? 0) === 0 && !Array.isArray(body.frames)) {
        await new Promise((r) => setTimeout(r, 250));
        const retry = await store.readCatalog();
        if ((retry.frames?.length ?? 0) > 0) current = retry;
      }
      if (Array.isArray(body.categories)) {
        const byId = new Map((current.categories ?? []).map((c) => [c.id, c]));
        for (const cat of body.categories) {
          if (cat?.id) byId.set(cat.id, cat);
        }
        current.categories = [...byId.values()];
      }
      if (Array.isArray(body.deletedCategoryIds)) {
        const drop = new Set(body.deletedCategoryIds);
        current.categories = (current.categories ?? []).filter((c) => !drop.has(c.id));
        current.deletedCategoryIds = [...new Set([...(current.deletedCategoryIds ?? []), ...body.deletedCategoryIds])];
      }
      if (Array.isArray(body.deletedFrameIds)) {
        current.deletedFrameIds = [...new Set([...(current.deletedFrameIds ?? []), ...body.deletedFrameIds])];
        const dropFrames = new Set(body.deletedFrameIds);
        current.frames = (current.frames ?? []).filter((f) => !dropFrames.has(f.id));
      }
      if (Array.isArray(body.hiddenSeriesIds)) {
        current.hiddenSeriesIds = [...new Set([...(current.hiddenSeriesIds ?? []), ...body.hiddenSeriesIds])];
      }
      if (Array.isArray(body.unhiddenSeriesIds)) {
        const show = new Set(body.unhiddenSeriesIds);
        current.hiddenSeriesIds = (current.hiddenSeriesIds ?? []).filter((id) => !show.has(id));
      }
      if (Array.isArray(body.hiddenFrameIds)) {
        current.hiddenFrameIds = [...new Set([...(current.hiddenFrameIds ?? []), ...body.hiddenFrameIds])];
      }
      if (Array.isArray(body.unhiddenFrameIds)) {
        const show = new Set(body.unhiddenFrameIds);
        current.hiddenFrameIds = (current.hiddenFrameIds ?? []).filter((id) => !show.has(id));
      }
      if (body.overrides && typeof body.overrides === "object") {
        current.overrides = { ...(current.overrides ?? {}), ...body.overrides };
      }
      if (body.seriesLabels && typeof body.seriesLabels === "object") {
        current.seriesLabels = { ...(current.seriesLabels ?? {}), ...body.seriesLabels };
      }
      await store.writeCatalog(current);
      return current;
    });
    return { status: 200, json };
  }

  if (kind === "frames" && method === "POST") {
    const frame = body.frame;
    if (!frame?.id) return { status: 400, json: { error: "Çerçeve bilgisi eksik." } };
    const bytes = decodeImage(body.imageDataUrl);
    const fileName = imageFileName(frame.id);
    const imageUrl = await store.putImage(fileName, bytes);
    const saved = await withCatalogLock(async () => {
      const data = await store.readCatalog();
      const entry = stripFrame(frame, imageUrl);
      data.frames = [entry, ...data.frames.filter((f) => f.id !== entry.id)];
      upsertCategoriesFromFrame(data, entry);
      if (store.putFrameMeta) await store.putFrameMeta(entry);
      await store.writeCatalog(data);
      return entry;
    });
    return { status: 200, json: { frame: saved } };
  }

  if (kind === "frames" && method === "PATCH") {
    const id = body.id;
    if (!id) return { status: 400, json: { error: "id gerekli." } };
    const patch = body.patch && typeof body.patch === "object" ? { ...body.patch } : {};
    delete patch.image;
    delete patch.imageBlob;
    const next = await withCatalogLock(async () => {
      const data = await store.readCatalog();
      const idx = data.frames.findIndex((f) => f.id === id);
      if (idx === -1) return null;
      const merged = {
        ...data.frames[idx],
        ...patch,
        id,
        image: data.frames[idx].image,
        custom: true,
        updatedAt: Number(patch.updatedAt) || Date.now(),
      };
      delete merged.imageBlob;
      data.frames[idx] = merged;
      upsertCategoriesFromFrame(data, merged);
      if (store.putFrameMeta) await store.putFrameMeta(merged);
      await store.writeCatalog(data);
      return merged;
    });
    if (!next) return { status: 404, json: { error: "Çerçeve bulunamadı." } };
    return { status: 200, json: { frame: next, catalog: await store.readCatalog() } };
  }

  if (kind === "frames" && method === "DELETE") {
    const id = body.id;
    if (!id) return { status: 400, json: { error: "id gerekli." } };
    const result = await withCatalogLock(async () => {
      const data = await store.readCatalog();
      const existing = data.frames.find((f) => f.id === id);
      data.frames = data.frames.filter((f) => f.id !== id);
      data.deletedFrameIds = [...new Set([...(data.deletedFrameIds ?? []), id])];
      if (existing?.image) {
        try {
          await store.deleteImage(existing.image);
        } catch {
          /* görsel yoksa katalog yine güncellenir */
        }
      }
      if (store.deleteFrameMeta) await store.deleteFrameMeta(id);
      await store.writeCatalog(data);
      return data;
    });
    return { status: 200, json: { ok: true, catalog: result } };
  }

  return { status: 404, json: { error: "Bilinmeyen yol." } };
}
