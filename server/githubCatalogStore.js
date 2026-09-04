import { emptyCatalog, normalizeCatalog } from "./catalogCore.js";

const INDEX_PATH = "data/shared-catalog/index.json";
const IMAGE_DIR = "data/shared-catalog/images";

export function githubCatalogToken() {
  return process.env.CATALOG_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
}

export function hasGithubCatalogToken() {
  return Boolean(githubCatalogToken());
}

function repoParts() {
  const spec = process.env.CATALOG_GITHUB_REPO || "sametozturk01/cerceve-app";
  const [owner, repo] = spec.split("/");
  return {
    owner,
    repo,
    branch: process.env.CATALOG_GITHUB_BRANCH || "catalog",
  };
}

function publicOrigin() {
  if (process.env.CATALOG_PUBLIC_ORIGIN) return process.env.CATALOG_PUBLIC_ORIGIN.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
  }
  return "https://cerceve-app.vercel.app";
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${githubCatalogToken()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cerceve-app-catalog",
  };
}

async function ghJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...ghHeaders(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  return { res, data };
}

let branchReady = null;

async function ensureBranch() {
  if (branchReady) return branchReady;
  branchReady = (async () => {
    const { owner, repo, branch } = repoParts();
    const base = `https://api.github.com/repos/${owner}/${repo}`;
    const existing = await ghJson(`${base}/git/ref/heads/${encodeURIComponent(branch)}`);
    if (existing.res.ok) return;
    const main = await ghJson(`${base}/git/ref/heads/main`);
    if (!main.res.ok) {
      throw new Error(main.data?.message || "GitHub ana dalı okunamadı.");
    }
    const created = await ghJson(`${base}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: main.data.object.sha,
      }),
    });
    if (!created.res.ok && created.res.status !== 422) {
      throw new Error(created.data?.message || "GitHub catalog dalı oluşturulamadı.");
    }
  })();
  try {
    await branchReady;
  } catch (err) {
    branchReady = null;
    throw err;
  }
}

async function getContent(path) {
  const { owner, repo, branch } = repoParts();
  const url =
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}` +
    `?ref=${encodeURIComponent(branch)}`;
  const { res, data } = await ghJson(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(data?.message || "GitHub dosyası okunamadı.");
  return data;
}

async function putContent(path, bytes, message, sha) {
  await ensureBranch();
  const { owner, repo, branch } = repoParts();
  const body = {
    message,
    content: Buffer.from(bytes).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const { res, data } = await ghJson(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (res.status === 409) {
    const latest = await getContent(path);
    if (latest?.sha && latest.sha !== sha) {
      return putContent(path, bytes, message, latest.sha);
    }
  }
  if (!res.ok) throw new Error(data?.message || "GitHub’a yazılamadı.");
  return data;
}

async function deleteContent(path) {
  const existing = await getContent(path);
  if (!existing?.sha) return;
  const { owner, repo, branch } = repoParts();
  const { res, data } = await ghJson(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `katalog: ${path} silindi`,
        sha: existing.sha,
        branch,
      }),
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(data?.message || "GitHub dosyası silinemedi.");
  }
}

export function createGithubCatalogStore() {
  return {
    async readCatalog() {
      await ensureBranch();
      const file = await getContent(INDEX_PATH);
      if (!file?.content) return emptyCatalog();
      try {
        const json = Buffer.from(String(file.content).replace(/\n/g, ""), "base64").toString("utf8");
        return normalizeCatalog(JSON.parse(json));
      } catch {
        return emptyCatalog();
      }
    },

    async writeCatalog(data) {
      const existing = await getContent(INDEX_PATH);
      const payload = `${JSON.stringify(normalizeCatalog(data), null, 2)}\n`;
      await putContent(INDEX_PATH, payload, "katalog güncellendi", existing?.sha);
    },

    async putImage(fileName, bytes) {
      const path = `${IMAGE_DIR}/${fileName}`;
      const existing = await getContent(path);
      await putContent(path, bytes, `çerçeve görseli: ${fileName}`, existing?.sha);
      return `${publicOrigin()}/api/shared-catalog/file?n=${encodeURIComponent(fileName)}`;
    },

    async deleteImage(imageUrl) {
      const match = String(imageUrl ?? "").match(/[?&]n=([^&]+)/);
      const name = match ? decodeURIComponent(match[1]) : "";
      if (!/^[a-zA-Z0-9._-]+\.png$/.test(name)) return;
      await deleteContent(`${IMAGE_DIR}/${name}`);
    },

    async serveImage(name, res) {
      if (!/^[a-zA-Z0-9._-]+\.png$/.test(name)) {
        res.statusCode = 400;
        res.end("bad name");
        return;
      }
      const { owner, repo, branch } = repoParts();
      const url =
        `https://api.github.com/repos/${owner}/${repo}/contents/${IMAGE_DIR}/${name}` +
        `?ref=${encodeURIComponent(branch)}`;
      const raw = await fetch(url, {
        headers: { ...ghHeaders(), Accept: "application/vnd.github.raw" },
      });
      if (raw.status === 404) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }
      if (!raw.ok) {
        res.statusCode = 502;
        res.end("github");
        return;
      }
      const bytes = Buffer.from(await raw.arrayBuffer());
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.end(bytes);
    },
  };
}
