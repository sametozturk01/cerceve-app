import fs from "node:fs";
import path from "node:path";
import { del, list, put } from "@vercel/blob";
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

export function createBlobCatalogStore() {
  const CATALOG_PATH = "cerceve/shared-catalog.json";

  async function catalogUrl() {
    const { blobs } = await list({ prefix: CATALOG_PATH, limit: 20 });
    return blobs.find((b) => b.pathname === CATALOG_PATH)?.url ?? null;
  }

  return {
    async readCatalog() {
      const url = await catalogUrl();
      if (!url) return emptyCatalog();
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return emptyCatalog();
      try {
        return normalizeCatalog(await res.json());
      } catch {
        return emptyCatalog();
      }
    },

    async writeCatalog(data) {
      await put(CATALOG_PATH, `${JSON.stringify(data, null, 2)}\n`, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
        contentType: "application/json; charset=utf-8",
      });
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
