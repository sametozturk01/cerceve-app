/**
 * frameProcessor.js doğrulama — Node + @napi-rs/canvas
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, Image, loadImage } from "@napi-rs/canvas";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

globalThis.Image = Image;

globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(`Unsupported: ${tag}`);
    return createCanvas(1, 1);
  },
};

const { processFrameImage } = await import("../src/utils/frameProcessor.js");

function fileToDataUrl(path) {
  const buf = readFileSync(path);
  const ext = path.endsWith(".jpg") || path.endsWith(".jpeg") ? "jpeg" : "png";
  return `data:image/${ext};base64,${buf.toString("base64")}`;
}

const cases = [
  ...readdirSync(join(ROOT, "tmp-frame-test"))
    .filter((f) => f.endsWith(".png") && !f.startsWith("out-") && !f.startsWith("debug-") && !f.startsWith("fixed-") && !f.startsWith("white-") && !f.startsWith("black-") && f !== "checker-ceviz.png" && f !== "sim-photo-ceviz.png")
    .map((f) => join(ROOT, "tmp-frame-test", f)),
  ...readdirSync(join(ROOT, "public/frames"))
    .filter((f) => f.startsWith("fa-20-") && f.endsWith(".png"))
    .map((f) => join(ROOT, "public/frames", f)),
];

const assetDir = join(
  process.env.HOME || "",
  ".cursor",
  "projects",
  "Users-sametozturk-Desktop-projeler-cerceve-app",
  "assets"
);
try {
  for (const f of [
    "bxxbx-b447078c-32b9-4818-8ebf-a46a3635e1b4.png",
    "imageadd-586994f2-4d57-4118-b77c-b1a6a61d4b4b.png",
    "ceviz-5c8d4a25-14f4-4ee5-bb97-43de86449250.png",
    "kbnklbkl_kopyas_-d528b2f5-223f-438b-afb0-0e2e6cbb392e.png",
  ]) {
    const p = join(assetDir, f);
    try {
      readFileSync(p);
      cases.push(p);
    } catch {
      /* asset yok */
    }
  }
} catch {
  /* assets klasörü yok */
}

let ok = 0;
for (const path of cases) {
  try {
    const result = await processFrameImage(fileToDataUrl(path));
    console.log(`OK   ${basename(path).padEnd(35)} B=${result.thickness} ${result.width}x${result.height}`);
    ok += 1;
  } catch (err) {
    console.log(`FAIL ${basename(path).padEnd(35)} ${err.message}`);
  }
}

console.log(`\n${ok}/${cases.length} passed`);
process.exit(ok === cases.length ? 0 : 1);
