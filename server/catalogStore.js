import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { del, get, list, put } from "@vercel/blob";
import { emptyCatalog, normalizeCatalog } from "./catalogCore.js";

export function createFsCatalogStore(rootDir) {
  const dir = path.join(rootDir, "data", "shared-catalog");
  const indexFile = path.join(dir, "index.json");
  const imagesDir = path.join(dir, "images");

  function ensure() {
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  return {
    async readCatalog() {
      ensure();
      if (!fs.existsSync(indexFile)) return emptyCatalog();
      try {
        return normalizeCatalog(JSON.parse(fs.readFileSync(indexFile, "utf8")));
      } catch {
        return emptyCatalog();
      }
    },

    async writeCatalog(data) {
      ensure();
      const tmp = `${indexFile}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
      fs.renameSync(tmp, indexFile);
    },

    async putImage(fileName, bytes) {
      ensure();
      fs.writeFileSync(path.join(imagesDir, fileName), bytes);
      return `/shared-catalog/images/${fileName}`;
    },

    async deleteImage(imageUrl) {
      if (!imageUrl?.startsWith("/shared-catalog/images/")) return;
      const file = path.join(imagesDir, path.basename(imageUrl));
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },

    serveLocalImage(url, res) {
      const name = path.basename(url);
      if (!/^[a-zA-Z0-9._-]+\.png$/.test(name)) {
        res.statusCode = 400;
        res.end("bad name");
        return true;
      }
      const file = path.join(imagesDir, name);
      if (!fs.existsSync(file)) {
        res.statusCode = 404;
        res.end("not found");
        return true;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      fs.createReadStream(file).pipe(res);
      return true;
    },
  };
}

export function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function metaPath(id) {
  const hash = crypto.createHash("sha1").update(String(id)).digest("hex").slice(0, 16);
  return `cerceve/frame-meta/${hash}.json`;
}

export function createBlobCatalogStore() {
  const CATALOG_PATH = "cerceve/shared-catalog.json";

  async function listFrameMeta() {
    const frames = [];
    let cursor;
    do {
      const result = await list({ prefix: "cerceve/frame-meta/", limit: 200, cursor });
      for (const blob of result.blobs ?? []) {
        if (!blob.pathname.endsWith(".json")) continue;
        try {
          const res = await fetch(blob.url, { cache: "no-store" });
          if (!res.ok) continue;
          const entry = await res.json();
          if (entry?.id) frames.push(entry);
        } catch {
          /* tek kayıt bozuksa diğerlerini yine yükle */
        }
      }
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
    return frames;
  }

  async function mergeRecoveredFrames(catalog) {
    if ((catalog.frames?.length ?? 0) > 0) return catalog;
    const recovered = await listFrameMeta();
    const dropped = new Set(catalog.deletedFrameIds ?? []);
    const frames = recovered.filter((frame) => frame?.id && !dropped.has(frame.id));
    if (!frames.length) return catalog;
    const byId = new Map();
    for (const frame of frames) byId.set(frame.id, frame);
    return { ...catalog, frames: [...byId.values()] };
  }

  return {
    async readCatalog() {
      const result = await get(CATALOG_PATH, { access: "public", useCache: false });
      if (!result || result.statusCode !== 200) {
        return mergeRecoveredFrames(emptyCatalog());
      }
      const text = await new Response(result.stream).text();
      let parsed = emptyCatalog();
      try {
        parsed = normalizeCatalog(JSON.parse(text));
      } catch {
        parsed = emptyCatalog();
      }
      return mergeRecoveredFrames(parsed);
    },

    async writeCatalog(data) {
      const incoming = normalizeCatalog(data);
      if ((incoming.frames?.length ?? 0) === 0) {
        const recovered = await listFrameMeta();
        const dropped = new Set(incoming.deletedFrameIds ?? []);
        const frames = recovered.filter((frame) => frame?.id && !dropped.has(frame.id));
        if (frames.length) incoming.frames = frames;
      }
      await put(CATALOG_PATH, `${JSON.stringify(incoming, null, 2)}\n`, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
        contentType: "application/json; charset=utf-8",
      });
    },

    async putFrameMeta(frame) {
      if (!frame?.id) return;
      await put(metaPath(frame.id), `${JSON.stringify(frame)}\n`, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
        contentType: "application/json; charset=utf-8",
      });
    },

    async deleteFrameMeta(id) {
      if (!id) return;
      try {
        await del(metaPath(id));
      } catch {
        /* yedek yoksa silme yine devam eder */
      }
    },

    async putImage(fileName, bytes) {
      const result = await put(`cerceve/frames/${fileName}`, bytes, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/png",
        cacheControlMaxAge: 60 * 60 * 24 * 30,
      });
      return result.url;
    },

    async deleteImage(imageUrl) {
      if (!imageUrl || !String(imageUrl).includes("blob.vercel-storage.com")) return;
      await del(imageUrl);
    },
  };
}
