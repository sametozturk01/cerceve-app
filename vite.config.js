import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createSharedCatalogMiddleware } from "./server/sharedCatalogApi.js";

function sharedCatalogPlugin() {
  return {
    name: "shared-catalog-api",
    configureServer(server) {
      server.middlewares.use(createSharedCatalogMiddleware(server.config.root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createSharedCatalogMiddleware(server.config.root));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.BLOB_READ_WRITE_TOKEN) {
    process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN;
  }

  return {
    plugins: [react(), sharedCatalogPlugin()],
    server: {
      host: true,
    },
    preview: {
      host: true,
    },
  };
});
