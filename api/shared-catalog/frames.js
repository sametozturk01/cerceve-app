import { handleVercelCatalog, vercelCatalogConfig } from "../../server/vercelCatalogHandler.js";

export const config = vercelCatalogConfig;

export default async function handler(req, res) {
  await handleVercelCatalog(req, res, "frames");
}
