import { corsHeaders, dispatchCatalogRequest } from "./catalogCore.js";
import { resolveCatalogStore } from "./catalogStore.js";

export const vercelCatalogConfig = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: "4.5mb",
    },
  },
};

function send(res, status, json) {
  const headers = corsHeaders();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.status(status).json(json);
}

export async function handleVercelCatalog(req, res, kind) {
  if (req.method === "OPTIONS") {
    const headers = corsHeaders();
    res.statusCode = 204;
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    res.end();
    return;
  }

  const store = resolveCatalogStore();
  if (!store) {
    send(res, 503, {
      error:
        "Paylaşılan katalog bağlı değil. Vercel Environment Variables’a CATALOG_GITHUB_TOKEN ekleyin.",
    });
    return;
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await dispatchCatalogRequest({
      method: req.method,
      kind,
      body,
      store,
    });
    send(res, result.status, result.json);
  } catch (err) {
    send(res, 500, { error: err.message || "Sunucu hatası." });
  }
}
