import { corsHeaders, dispatchCatalogRequest } from "./catalogCore.js";
import { createBlobCatalogStore, createFsCatalogStore, hasBlobToken } from "./catalogStore.js";

const MAX_BODY = 12 * 1024 * 1024;

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  const headers = corsHeaders();
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.setHeader("Content-Length", Buffer.byteLength(json));
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Dosya çok büyük."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Geçersiz JSON."));
      }
    });
    req.on("error", reject);
  });
}

function pathnameOf(req) {
  const raw = req.url ?? "/";
  const q = raw.indexOf("?");
  return q === -1 ? raw : raw.slice(0, q);
}

function kindFromPath(url) {
  if (url === "/api/shared-catalog/frames") return "frames";
  if (url === "/api/shared-catalog") return "root";
  return null;
}

export function createSharedCatalogMiddleware(rootDir) {
  let storePromise = null;
  const getStore = () => {
    if (!storePromise) {
      storePromise = Promise.resolve(
        hasBlobToken() ? createBlobCatalogStore() : createFsCatalogStore(rootDir)
      );
    }
    return storePromise;
  };

  return async (req, res, next) => {
    const url = pathnameOf(req);

    if (req.method === "OPTIONS" && url.startsWith("/api/shared-catalog")) {
      const headers = corsHeaders();
      res.statusCode = 204;
      for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
      res.end();
      return;
    }

    if (req.method === "GET" && url.startsWith("/shared-catalog/images/")) {
      const store = await getStore();
      if (typeof store.serveLocalImage === "function") {
        store.serveLocalImage(url, res);
        return;
      }
      next();
      return;
    }

    const kind = kindFromPath(url);
    if (!kind) {
      next();
      return;
    }

    try {
      const store = await getStore();
      const body = req.method === "GET" ? {} : await readBody(req);
      const result = await dispatchCatalogRequest({
        method: req.method,
        kind,
        body,
        store,
      });
      sendJson(res, result.status, result.json);
    } catch (err) {
      sendJson(res, 500, { error: err.message || "Sunucu hatası." });
    }
  };
}
