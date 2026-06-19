import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, Image } from "@napi-rs/canvas";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.Image = Image;
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(tag);
    return createCanvas(1, 1);
  },
};

const { _frameDebug: fp } = await import(join(ROOT, "src/utils/frameProcessor.js"));

const path = process.argv[2];
const buf = readFileSync(path);
const img = await (await import("@napi-rs/canvas")).loadImage(buf);
const canvas = createCanvas(img.width, img.height);
canvas.getContext("2d").drawImage(img, 0, 0);

console.log("size", canvas.width, canvas.height, "trans", fp.transparentRatio(canvas).toFixed(3));

let prepped = fp.prepareCardboard(canvas);
let tight = fp.cropToOpaqueBounds(prepped);
if (tight.width < prepped.width * 0.92 || tight.height < prepped.height * 0.92) {
  prepped = fp.prepareCardboard(tight);
} else {
  prepped = tight;
}
console.log("after prep", prepped.width, prepped.height, "trans", fp.transparentRatio(prepped).toFixed(3));

const work = fp.cropToOpaqueBounds(prepped);
fp.clearCenterHole(work);
const w = work.width;
const h = work.height;
const data = work.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;

const inner = fp.detectInnerBounds(data, w, h);
console.log("inner", inner, inner ? `hole ${inner.right - inner.left + 1}x${inner.bottom - inner.top + 1}` : null);

const outer = inner ? fp.detectOuterBounds(data, w, h, inner) : null;
console.log("outer", outer);

const metrics = outer && inner ? fp.estimateThickness(outer, inner) : null;
console.log("metrics", metrics, metrics ? fp.isValidResult(metrics, w, h) : null);

const result = fp.tryBuildFromCanvas(prepped);
console.log("tryBuild", result ? `B=${result.thickness} sym=${result.symmetry?.toFixed(3)}` : null);
