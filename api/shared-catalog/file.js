import { corsHeaders } from "../../server/catalogCore.js";
import { createGithubCatalogStore, hasGithubCatalogToken } from "../../server/githubCatalogStore.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const headers = corsHeaders();
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Yalnızca GET." });
    return;
  }
  if (!hasGithubCatalogToken()) {
    res.status(503).json({ error: "GitHub katalog bağlı değil." });
    return;
  }
  const name = String(req.query?.n ?? "");
  try {
    await createGithubCatalogStore().serveImage(name, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Görsel okunamadı." });
    }
  }
}
