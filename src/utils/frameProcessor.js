/**
 * Çerçeve fotoğrafı → 9-slice PNG.
 * Karton üzerindeki ham fotoğraf ve şeffaf PNG desteklenir.
 */

const MAX_PROCESS_SIDE = 1400;
const MAX_THICKNESS = 110;

function canvasCtx(canvas, read = false) {
  return canvas.getContext("2d", read ? { willReadFrequently: true } : undefined);
}

async function sourceToCanvas(source) {
  if (source instanceof Blob) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d", { willReadFrequently: true }).drawImage(bitmap, 0, 0);
        bitmap.close();
        return canvas;
      } catch {
        /* Image fallback */
      }
    }

    const url = URL.createObjectURL(source);
    try {
      return imageToCanvas(await loadImageUrl(url));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (typeof source === "string") {
    return imageToCanvas(await loadImageUrl(source));
  }

  throw new Error("Geçersiz görsel kaynağı");
}

function loadImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görsel yüklenemedi."));
    img.src = url;
  });
}

function imageToCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0);
  return canvas;
}

function resizeCanvas(canvas) {
  const max = Math.max(canvas.width, canvas.height);
  if (max <= MAX_PROCESS_SIDE) return canvas;
  const scale = MAX_PROCESS_SIDE / max;
  const out = document.createElement("canvas");
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  out.getContext("2d", { willReadFrequently: true }).drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

function cloneCanvas(canvas) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d", { willReadFrequently: true }).drawImage(canvas, 0, 0);
  return copy;
}

function pixelAt(data, w, x, y) {
  const i = (y * w + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function median(vals) {
  if (!vals.length) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

function isSolidBackground(r, g, b, a) {
  if (a < 50) return true;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const br = (r + g + b) / 3;
  if (spread < 14) {
    if (br > 215) return true;
    if (br < 40 && Math.abs(r - b) < 8) return true;
  }
  return false;
}

function isHolePixel(r, g, b, a) {
  if (a < 30) return true;
  if (isSolidBackground(r, g, b, a)) return true;
  if (a > 50 && r + g + b < 45) return false;
  if (r + g + b < 35) return true;
  const br = (r + g + b) / 3;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread < 12 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && br > 155 && br < 245) {
    return true;
  }
  if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && br > 90 && br < 170) {
    return true;
  }
  const warmth = r - b;
  if (warmth > 6 && br > 105 && br < 230) return true;
  return false;
}

function isMetallicFramePixel(r, g, b, a) {
  if (a < 50) return false;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const br = (r + g + b) / 3;
  const warmth = r - b;
  if (warmth > 10 && spread >= 18 && br > 90 && br < 200) return true;
  if (spread < 20 && br > 175 && br < 245 && warmth < 12) return true;
  return false;
}

function isFrameRailPixel(r, g, b, a) {
  if (a < 50) return false;
  if (isMetallicFramePixel(r, g, b, a)) return true;
  const br = (r + g + b) / 3;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const warmth = r - b;
  if (warmth > 10 && br < 100) return false;
  if (br > 195 && spread < 25) return true;
  if (br < 35 && spread < 22) return true;
  if (spread > 14 && br > 35 && br < 95 && warmth > -5 && warmth < 25) return true;
  return false;
}

function isHoleForDetection(r, g, b, a, centerRef = null) {
  if (a < 30) return true;
  if (isSolidBackground(r, g, b, a)) return true;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const br = (r + g + b) / 3;
  const warmth = r - b;
  if (a > 50 && r + g + b < 40) return false;
  if (a > 175 && spread < 14 && br > 225 && br < 245) return false;
  if (spread < 16 && br > 165 && br < 240 && warmth < 15) return true;
  if (spread < 12 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && br > 155 && br < 245) {
    return true;
  }
  if (centerRef && colorDist(r, g, b, centerRef[0], centerRef[1], centerRef[2]) < 28) {
    return true;
  }
  if (warmth > 8 && br > 35 && br < 135) return true;
  if (warmth > 6 && br > 105 && br < 230) return true;
  return false;
}

function isFrameAt(data, w, x, y, centerRef = null) {
  const p = pixelAt(data, w, x, y);
  return p.a > 50 && !isHoleForDetection(p.r, p.g, p.b, p.a, centerRef);
}

function sampleCenterColor(data, w, h) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const patch = Math.max(6, Math.floor(Math.min(w, h) * 0.04));
  const samples = [];
  for (let dy = -patch; dy <= patch; dy++) {
    for (let dx = -patch; dx <= patch; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const p = pixelAt(data, w, x, y);
      if (p.a > 50) samples.push([p.r, p.g, p.b]);
    }
  }
  if (!samples.length) return null;
  return [
    Math.round(median(samples.map((c) => c[0]))),
    Math.round(median(samples.map((c) => c[1]))),
    Math.round(median(samples.map((c) => c[2]))),
  ];
}

function sampleCornerLuminance(data, w, h) {
  const patch = Math.max(8, Math.min(32, Math.floor(Math.min(w, h) * 0.06)));
  const points = [
    [0, 0],
    [w - patch, 0],
    [0, h - patch],
    [w - patch, h - patch],
  ];
  const samples = [];
  for (const [x0, y0] of points) {
    for (let dy = 0; dy < patch; dy++) {
      for (let dx = 0; dx < patch; dx++) {
        const p = pixelAt(data, w, x0 + dx, y0 + dy);
        if (p.a > 50) samples.push(luminance(p.r, p.g, p.b));
      }
    }
  }
  return samples.length ? median(samples) : 128;
}

function detectInnerBoundsAt(data, w, h, cx, cy, centerRef = null) {
  let left = cx;
  while (left > 0 && !isFrameAt(data, w, left, cy, centerRef)) left -= 1;
  left += 1;

  let right = cx;
  while (right < w - 1 && !isFrameAt(data, w, right, cy, centerRef)) right += 1;
  right -= 1;

  let top = cy;
  while (top > 0 && !isFrameAt(data, w, cx, top, centerRef)) top -= 1;
  top += 1;

  let bottom = cy;
  while (bottom < h - 1 && !isFrameAt(data, w, cx, bottom, centerRef)) bottom += 1;
  bottom -= 1;

  if (right <= left || bottom <= top) return null;
  return { left, right, top, bottom };
}

function detectInnerBoundsLuminance(data, w, h) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const centerP = pixelAt(data, w, cx, cy);
  if (centerP.a < 50) return null;

  const centerLum = luminance(centerP.r, centerP.g, centerP.b);
  const bgLum = sampleCornerLuminance(data, w, h);
  const darkFrame = centerLum - bgLum > 12;
  const margin = Math.max(18, Math.min(42, Math.abs(centerLum - bgLum) * 0.35));

  const isFrameLum = (x, y) => {
    const p = pixelAt(data, w, x, y);
    if (p.a < 50) return false;
    const lum = luminance(p.r, p.g, p.b);
    return darkFrame ? lum < centerLum - margin : lum > centerLum + margin;
  };

  let left = cx;
  while (left > 0 && !isFrameLum(left, cy)) left -= 1;
  left += 1;

  let right = cx;
  while (right < w - 1 && !isFrameLum(right, cy)) right += 1;
  right -= 1;

  let top = cy;
  while (top > 0 && !isFrameLum(cx, top)) top -= 1;
  top += 1;

  let bottom = cy;
  while (bottom < h - 1 && !isFrameLum(cx, bottom)) bottom += 1;
  bottom -= 1;

  if (right <= left || bottom <= top) return null;
  return { left, right, top, bottom };
}

function detectInnerBoundsAlpha(data, w, h) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  if (data[(cy * w + cx) * 4 + 3] >= 50) return null;

  const offsets = [0, -0.08, 0.08];
  const samples = [];

  for (const oy of offsets) {
    for (const ox of offsets) {
      const sx = Math.max(0, Math.min(w - 1, Math.round(cx + w * ox)));
      const sy = Math.max(0, Math.min(h - 1, Math.round(cy + h * oy)));
      if (data[(sy * w + sx) * 4 + 3] >= 50) continue;

      let left = sx;
      while (left > 0 && data[(sy * w + left) * 4 + 3] < 50) left -= 1;
      left += 1;

      let right = sx;
      while (right < w - 1 && data[(sy * w + right) * 4 + 3] < 50) right += 1;
      right -= 1;

      let top = sy;
      while (top > 0 && data[(top * w + sx) * 4 + 3] < 50) top -= 1;
      top += 1;

      let bottom = sy;
      while (bottom < h - 1 && data[(bottom * w + sx) * 4 + 3] < 50) bottom += 1;
      bottom -= 1;

      if (right > left && bottom > top) samples.push({ left, right, top, bottom });
    }
  }

  if (!samples.length) return null;

  return {
    left: Math.round(median(samples.map((s) => s.left))),
    right: Math.round(median(samples.map((s) => s.right))),
    top: Math.round(median(samples.map((s) => s.top))),
    bottom: Math.round(median(samples.map((s) => s.bottom))),
  };
}

function detectInnerBounds(data, w, h) {
  const alphaBounds = detectInnerBoundsAlpha(data, w, h);
  if (alphaBounds) return alphaBounds;

  const centerRef = sampleCenterColor(data, w, h);
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const offsets = [0, -0.1, 0.1];
  const samples = [];

  for (const oy of offsets) {
    for (const ox of offsets) {
      const sx = Math.max(0, Math.min(w - 1, Math.round(cx + w * ox)));
      const sy = Math.max(0, Math.min(h - 1, Math.round(cy + h * oy)));
      const b = detectInnerBoundsAt(data, w, h, sx, sy, centerRef);
      if (b) samples.push(b);
    }
  }

  if (!samples.length) {
    return detectInnerBoundsLuminance(data, w, h);
  }

  return {
    left: Math.round(median(samples.map((s) => s.left))),
    right: Math.round(median(samples.map((s) => s.right))),
    top: Math.round(median(samples.map((s) => s.top))),
    bottom: Math.round(median(samples.map((s) => s.bottom))),
  };
}

function detectOuterBounds(data, w, h, centerRef = null) {
  const minRun = Math.max(14, Math.floor(Math.min(w, h) * 0.08));
  let left = 0;
  let right = w - 1;
  let top = 0;
  let bottom = h - 1;

  for (let x = 0; x < w; x++) {
    let total = 0;
    let frame = 0;
    for (let y = 0; y < h; y++) {
      const p = pixelAt(data, w, x, y);
      if (p.a < 50) continue;
      total += 1;
      if (isFrameAt(data, w, x, y, centerRef)) frame += 1;
    }
    if (total >= minRun && frame >= total * 0.32) {
      left = x;
      break;
    }
  }

  for (let x = w - 1; x >= 0; x--) {
    let total = 0;
    let frame = 0;
    for (let y = 0; y < h; y++) {
      const p = pixelAt(data, w, x, y);
      if (p.a < 50) continue;
      total += 1;
      if (isFrameAt(data, w, x, y, centerRef)) frame += 1;
    }
    if (total >= minRun && frame >= total * 0.32) {
      right = x;
      break;
    }
  }

  for (let y = 0; y < h; y++) {
    let total = 0;
    let frame = 0;
    for (let x = 0; x < w; x++) {
      const p = pixelAt(data, w, x, y);
      if (p.a < 50) continue;
      total += 1;
      if (isFrameAt(data, w, x, y, centerRef)) frame += 1;
    }
    if (total >= minRun && frame >= total * 0.32) {
      top = y;
      break;
    }
  }

  for (let y = h - 1; y >= 0; y--) {
    let total = 0;
    let frame = 0;
    for (let x = 0; x < w; x++) {
      const p = pixelAt(data, w, x, y);
      if (p.a < 50) continue;
      total += 1;
      if (isFrameAt(data, w, x, y, centerRef)) frame += 1;
    }
    if (total >= minRun && frame >= total * 0.32) {
      bottom = y;
      break;
    }
  }

  if (right - left < w * 0.2 || bottom - top < h * 0.2) return null;
  return { left, right, top, bottom };
}

function cropCanvasRegion(canvas, bounds) {
  const w = bounds.right - bounds.left + 1;
  const h = bounds.bottom - bounds.top + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d", { willReadFrequently: true }).drawImage(canvas, bounds.left, bounds.top, w, h, 0, 0, w, h);
  return out;
}

function balancedInner(inner, w, h) {
  const borders = [inner.left, inner.top, w - 1 - inner.right, h - 1 - inner.bottom];
  const B = Math.round(median(borders));
  return {
    left: B,
    right: w - 1 - B,
    top: B,
    bottom: h - 1 - B,
  };
}

function metricsFromInner(inner, w, h) {
  const borders = [inner.left, inner.top, w - 1 - inner.right, h - 1 - inner.bottom];
  if (borders.some((b) => b <= 0)) return null;

  const sorted = [...borders].sort((a, b) => a - b);
  let B = Math.round(median(borders));
  if (sorted[3] > sorted[1] * 1.45) {
    B = Math.round((sorted[0] + sorted[1]) / 2);
  }
  if (B > MAX_THICKNESS) {
    B = Math.round((sorted[0] + sorted[1]) / 2);
  }

  const holeW = inner.right - inner.left + 1;
  const holeH = inner.bottom - inner.top + 1;
  const symmetry = sorted[0] / sorted[3];

  return {
    B,
    symmetry,
    holeW,
    holeH,
    inner,
  };
}

function isValidResult(metrics, w, h) {
  if (!metrics) return false;
  const minSide = Math.min(w, h);
  if (metrics.B < 8 || metrics.B > MAX_THICKNESS) return false;
  if (metrics.symmetry < 0.22) return false;
  if (metrics.holeW < minSide * 0.06 || metrics.holeH < minSide * 0.06) return false;
  return true;
}

function buildNineSlice(ring, B, relInner) {
  const rw = ring.width;
  const rh = ring.height;
  const il = relInner.left;
  const ir = relInner.right;
  const it = relInner.top;
  const ib = relInner.bottom;
  const holeW = ir - il + 1;
  const holeH = ib - it + 1;
  const outHole = Math.max(holeW, holeH);
  const outSize = outHole + 2 * B;

  const out = document.createElement("canvas");
  out.width = outSize;
  out.height = outSize;
  const ctx = out.getContext("2d");

  const blit = (sx, sy, sw, sh, dx, dy, dw, dh) => {
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
    ctx.drawImage(ring, sx, sy, sw, sh, dx, dy, dw, dh);
  };

  const tlW = Math.min(B, il);
  const tlH = Math.min(B, it);
  const trW = Math.min(B, rw - ir - 1);
  const trH = Math.min(B, it);
  const blW = Math.min(B, il);
  const blH = Math.min(B, rh - ib - 1);
  const brW = Math.min(B, rw - ir - 1);
  const brH = Math.min(B, rh - ib - 1);

  blit(il - tlW, it - tlH, tlW, tlH, 0, 0, B, B);
  blit(ir + 1, it - trH, trW, trH, outSize - B, 0, B, B);
  blit(il - blW, ib + 1, blW, blH, 0, outSize - B, B, B);
  blit(ir + 1, ib + 1, brW, brH, outSize - B, outSize - B, B, B);

  const topSy = Math.max(0, it - B);
  const topSh = Math.min(B, it - topSy);
  blit(il, topSy, holeW, topSh, B, 0, outHole, B);

  const botSy = ib + 1;
  const botSh = Math.min(B, rh - botSy);
  blit(il, botSy, holeW, botSh, B, outSize - B, outHole, B);

  const leftSx = Math.max(0, il - B);
  const leftSw = Math.min(B, il - leftSx);
  blit(leftSx, it, leftSw, holeH, 0, B, B, outHole);

  const rightSx = ir + 1;
  const rightSw = Math.min(B, rw - rightSx);
  blit(rightSx, it, rightSw, holeH, outSize - B, B, B, outHole);

  ctx.clearRect(B, B, outHole, outHole);
  return { canvas: out, thickness: B };
}

function expandInnerBounds(inner, pad, w, h) {
  return {
    left: Math.max(0, inner.left - pad),
    right: Math.min(w - 1, inner.right + pad),
    top: Math.max(0, inner.top - pad),
    bottom: Math.min(h - 1, inner.bottom + pad),
  };
}

function cropToOpaqueBounds(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const data = canvasCtx(canvas, true).getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 50) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return canvas;

  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d", { willReadFrequently: true }).drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function extractFrameRing(canvas, inner) {
  const w = canvas.width;
  const h = canvas.height;
  const work = cloneCanvas(canvas);
  const ctx = canvasCtx(work, true);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inHole =
        x >= inner.left && x <= inner.right && y >= inner.top && y <= inner.bottom;
      if (inHole) {
        const i = (y * w + x) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return work;
}

function floodToTransparent(data, w, h, seeds, matchFn) {
  const visited = new Uint8Array(w * h);
  const queue = [];

  for (const [x, y] of seeds) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = y * w + x;
    if (visited[idx]) continue;
    const p = pixelAt(data, w, x, y);
    if (matchFn(p)) {
      visited[idx] = 1;
      queue.push([x, y]);
    }
  }

  while (queue.length) {
    const [x, y] = queue.shift();
    const pi = (y * w + x) * 4;
    data[pi + 3] = 0;

    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nidx = ny * w + nx;
      if (visited[nidx]) continue;
      const p = pixelAt(data, w, nx, ny);
      if (p.a < 20 || matchFn(p)) {
        visited[nidx] = 1;
        queue.push([nx, ny]);
      }
    }
  }
}

function shouldFloodPixel(p, ref, tol) {
  if (p.a < 20) return true;
  if (isMetallicFramePixel(p.r, p.g, p.b, p.a) || isFrameRailPixel(p.r, p.g, p.b, p.a)) return false;
  const dist = colorDist(p.r, p.g, p.b, ref[0], ref[1], ref[2]);
  if (dist > tol) return false;
  const br = (p.r + p.g + p.b) / 3;
  if (br < 58 && dist > 16) return false;
  if (br > 175 && dist > 22) return false;
  return true;
}

function floodByColor(data, w, h, seeds, ref, tol) {
  const visited = new Uint8Array(w * h);
  const queue = [];

  for (const [x, y] of seeds) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = y * w + x;
    if (visited[idx]) continue;
    const p = pixelAt(data, w, x, y);
    if (shouldFloodPixel(p, ref, tol)) {
      visited[idx] = 1;
      queue.push([x, y]);
    }
  }

  while (queue.length) {
    const [x, y] = queue.shift();
    const pi = (y * w + x) * 4;
    data[pi + 3] = 0;

    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nidx = ny * w + nx;
      if (visited[nidx]) continue;
      const p = pixelAt(data, w, nx, ny);
      if (shouldFloodPixel(p, ref, tol)) {
        visited[nidx] = 1;
        queue.push([nx, ny]);
      }
    }
  }
}

function borderSeeds(w, h) {
  const seeds = [];
  for (let x = 0; x < w; x++) seeds.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) seeds.push([0, y], [w - 1, y]);
  return seeds;
}

function sampleBackgroundColor(data, w, h) {
  const patch = Math.max(12, Math.min(48, Math.floor(Math.min(w, h) * 0.08)));
  const points = [
    [0, 0],
    [w - patch, 0],
    [0, h - patch],
    [w - patch, h - patch],
    [Math.floor(w / 2 - patch / 2), 0],
    [Math.floor(w / 2 - patch / 2), h - patch],
    [0, Math.floor(h / 2 - patch / 2)],
    [w - patch, Math.floor(h / 2 - patch / 2)],
  ];

  const collect = (accept) => {
    const samples = [];
    for (const [x0, y0] of points) {
      for (let dy = 0; dy < patch; dy++) {
        for (let dx = 0; dx < patch; dx++) {
          const p = pixelAt(data, w, x0 + dx, y0 + dy);
          if (p.a < 20) continue;
          if (!accept(p)) continue;
          samples.push([p.r, p.g, p.b]);
        }
      }
    }
    return samples;
  };

  let samples = collect(
    (p) =>
      !isMetallicFramePixel(p.r, p.g, p.b, p.a) &&
      !isFrameRailPixel(p.r, p.g, p.b, p.a) &&
      p.r + p.g + p.b >= 80 &&
      isHolePixel(p.r, p.g, p.b, p.a)
  );
  if (samples.length < 4) {
    samples = collect((p) => {
      if (isMetallicFramePixel(p.r, p.g, p.b, p.a) || isFrameRailPixel(p.r, p.g, p.b, p.a)) {
        return false;
      }
      const spread = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
      const br = (p.r + p.g + p.b) / 3;
      return p.r + p.g + p.b >= 80 && spread < 22 && br > 165;
    });
  }
  if (samples.length < 4) return null;

  return [
    Math.round(median(samples.map((c) => c[0]))),
    Math.round(median(samples.map((c) => c[1]))),
    Math.round(median(samples.map((c) => c[2]))),
  ];
}

function prepareCardboard(canvas) {
  const work = cloneCanvas(canvas);
  const w = work.width;
  const h = work.height;
  const ctx = canvasCtx(work, true);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const seeds = borderSeeds(w, h);
  const bg = sampleBackgroundColor(data, w, h);
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  floodToTransparent(data, w, h, seeds, (p) => {
    if (p.a < 30) return true;
    if (isMetallicFramePixel(p.r, p.g, p.b, p.a) || isFrameRailPixel(p.r, p.g, p.b, p.a)) {
      return false;
    }
    if (!bg) return isHolePixel(p.r, p.g, p.b, p.a);
    return shouldFloodPixel(p, bg, 40) || isHolePixel(p.r, p.g, p.b, p.a);
  });

  if (bg) {
    for (const tol of [32, 40, 48, 56, 64]) {
      floodByColor(data, w, h, seeds, bg, tol);
    }
    for (const tol of [36, 44, 52, 60]) {
      floodByColor(data, w, h, [[cx, cy]], bg, tol);
    }
  }

  floodToTransparent(data, w, h, [[cx, cy]], (p) => p.a < 30 || isSolidBackground(p.r, p.g, p.b, p.a));

  const centerSeeds = [[cx, cy]];
  for (let r = 8; r < 48; r += 8) {
    centerSeeds.push([cx, cy - r], [cx, cy + r], [cx - r, cy], [cx + r, cy]);
  }
  floodToTransparent(data, w, h, centerSeeds, (p) => {
    if (p.a < 30) return true;
    if (isFrameRailPixel(p.r, p.g, p.b, p.a)) return false;
    if (!bg) return isHolePixel(p.r, p.g, p.b, p.a);
    return shouldFloodPixel(p, bg, 55) || isHolePixel(p.r, p.g, p.b, p.a);
  });

  ctx.putImageData(imageData, 0, 0);
  return work;
}

function expandInnerToRails(data, w, h, inner) {
  let { left, right, top, bottom } = inner;
  const ys = [
    Math.floor((inner.top + inner.bottom) / 2),
    Math.min(inner.bottom - 2, inner.top + 8),
    Math.max(inner.top + 2, inner.bottom - 8),
  ];
  const xs = [
    Math.floor((inner.left + inner.right) / 2),
    Math.min(inner.right - 2, inner.left + 8),
    Math.max(inner.left + 2, inner.right - 8),
  ];
  const maxPad = Math.max(12, Math.floor(Math.min(w, h) * 0.06));

  for (let i = 0; i < maxPad; i++) {
    let moved = false;
    if (left > 0) {
      const blocked = ys.some((y) => {
        const p = pixelAt(data, w, left - 1, y);
        return p.a >= 50 && isFrameRailPixel(p.r, p.g, p.b, p.a);
      });
      if (!blocked) {
        left -= 1;
        moved = true;
      }
    }
    if (right < w - 1) {
      const blocked = ys.some((y) => {
        const p = pixelAt(data, w, right + 1, y);
        return p.a >= 50 && isFrameRailPixel(p.r, p.g, p.b, p.a);
      });
      if (!blocked) {
        right += 1;
        moved = true;
      }
    }
    if (top > 0) {
      const blocked = xs.some((x) => {
        const p = pixelAt(data, w, x, top - 1);
        return p.a >= 50 && isFrameRailPixel(p.r, p.g, p.b, p.a);
      });
      if (!blocked) {
        top -= 1;
        moved = true;
      }
    }
    if (bottom < h - 1) {
      const blocked = xs.some((x) => {
        const p = pixelAt(data, w, x, bottom + 1);
        return p.a >= 50 && isFrameRailPixel(p.r, p.g, p.b, p.a);
      });
      if (!blocked) {
        bottom += 1;
        moved = true;
      }
    }
    if (!moved) break;
  }

  if (right <= left || bottom <= top) return inner;
  return { left, right, top, bottom };
}

function forceClearHole(data, w, h, inner) {
  const hole = expandInnerBounds(inner, 2, w, h);
  for (let y = hole.top; y <= hole.bottom; y++) {
    for (let x = hole.left; x <= hole.right; x++) {
      const i = (y * w + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }
}

function clearFlatFills(canvas) {
  const work = cloneCanvas(canvas);
  const w = work.width;
  const h = work.height;
  const ctx = canvasCtx(work, true);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const seeds = borderSeeds(w, h);
  seeds.push([Math.floor(w / 2), Math.floor(h / 2)]);

  floodToTransparent(data, w, h, seeds, (p) => p.a < 30 || isSolidBackground(p.r, p.g, p.b, p.a));
  ctx.putImageData(imageData, 0, 0);
  return work;
}

function clearInnerHole(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvasCtx(canvas, true);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  let inner = detectInnerBoundsAlpha(data, w, h) || detectInnerBounds(data, w, h);
  if (!inner) return;

  inner = expandInnerToRails(data, w, h, inner);
  forceClearHole(data, w, h, inner);
  ctx.putImageData(imageData, 0, 0);
}

function transparentRatio(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const data = canvasCtx(canvas, true).getImageData(0, 0, w, h).data;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 30) transparent += 1;
  }
  return transparent / (w * h);
}

function pickBestBuild(results) {
  let best = null;
  let bestScore = Infinity;

  for (const result of results) {
    if (!result) continue;
    if (result.thickness > MAX_THICKNESS) continue;
    if ((result.symmetry ?? 0) < 0.28) continue;
    const score =
      Math.abs(result.thickness - 50) + (1 - (result.symmetry ?? 0.5)) * 50;
    if (score < bestScore) {
      bestScore = score;
      best = result;
    }
  }

  return best;
}

function tryBuildOnce(canvas) {
  const work = cropToOpaqueBounds(canvas);
  if (!work.width || !work.height) return null;

  const w = work.width;
  const h = work.height;
  const ctx = canvasCtx(work, true);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let inner = detectInnerBoundsAlpha(data, w, h) || detectInnerBounds(data, w, h);
  if (!inner) return null;

  inner = expandInnerToRails(data, w, h, inner);
  forceClearHole(data, w, h, inner);
  ctx.putImageData(imageData, 0, 0);

  const metrics = metricsFromInner(inner, w, h);
  if (!isValidResult(metrics, w, h)) return null;

  const ring = extractFrameRing(work, expandInnerBounds(inner, 1, w, h));
  const result = buildNineSlice(ring, metrics.B, inner);
  if (!result || result.thickness < 8) return null;
  return { ...result, symmetry: metrics.symmetry };
}

function tryBuildFromCanvas(canvas) {
  const cropped = cropToOpaqueBounds(canvas);
  if (!cropped.width || !cropped.height) return null;

  const w = cropped.width;
  const h = cropped.height;
  const data = canvasCtx(cropped, true).getImageData(0, 0, w, h).data;
  const outer = detectOuterBounds(data, w, h, sampleCenterColor(data, w, h));
  const source = outer ? cropCanvasRegion(cropped, outer) : cropped;

  const direct = tryBuildOnce(source);
  if (direct) return direct;

  return tryBuildOnce(cropped);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG oluşturulamadı."));
    }, "image/png");
  });
}

async function finalizeResult(result) {
  const blob = await canvasToBlob(result.canvas);
  return {
    blob,
    thickness: result.thickness,
    dataUrl: result.canvas.toDataURL("image/png"),
    width: result.canvas.width,
    height: result.canvas.height,
  };
}

export async function processFrameImage(source, options = {}) {
  const { onProgress } = options;
  onProgress?.("prep", "Çerçeve işleniyor…");

  const canvas = resizeCanvas(await sourceToCanvas(source));
  if (!canvas.width || !canvas.height) {
    throw new Error("Görsel yüklenemedi veya boyutu geçersiz.");
  }

  const opaque = transparentRatio(canvas) < 0.45;
  const results = [];

  if (opaque) {
    const prepped = prepareCardboard(canvas);
    results.push(tryBuildFromCanvas(prepped));
    if (transparentRatio(prepped) < 0.35) {
      results.push(tryBuildFromCanvas(clearFlatFills(canvas)));
      results.push(tryBuildFromCanvas(cloneCanvas(canvas)));
    }
  } else {
    results.push(
      tryBuildFromCanvas(cloneCanvas(canvas)),
      tryBuildFromCanvas(clearFlatFills(canvas)),
      tryBuildFromCanvas(prepareCardboard(canvas))
    );
  }

  const best = pickBestBuild(results.filter(Boolean));
  if (best) {
    return finalizeResult(best);
  }

  throw new Error(
    "Çerçeve algılanamadı. Çerçeveyi ortada, dört kenarı görünür ve açık renkli düz arka planla çekin."
  );
}
