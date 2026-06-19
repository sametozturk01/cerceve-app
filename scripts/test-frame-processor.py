#!/usr/bin/env python3
"""frameProcessor.js doğrulaması."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MIN_THICKNESS = 12
MAX_THICKNESS = 110


def is_hole_pixel(r, g, b, a):
    if a < 30:
        return True
    if a > 50 and r + g + b < 45:
        return False
    if r + g + b < 35:
        return True
    br = (r + g + b) / 3
    if abs(r - g) < 20 and abs(g - b) < 20 and 90 < br < 170:
        return True
    return False


def is_flat_fill(r, g, b, a):
    if a < 50:
        return True
    spread = max(r, g, b) - min(r, g, b)
    br = (r + g + b) / 3
    return spread < 12 and (br < 38 or br > 218)


def is_hole_extended(r, g, b, a):
    if is_hole_pixel(r, g, b, a):
        return True
    if is_flat_fill(r, g, b, a):
        return True
    warmth = r - b
    br = (r + g + b) / 3
    return warmth > 8 and 110 < br < 225


def is_frame_pixel(r, g, b, a, extended=False):
    hole = is_hole_extended if extended else is_hole_pixel
    return a > 50 and not hole(r, g, b, a)


def median(v):
    s = sorted(v)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def color_dist(a, b):
    return sum(abs(x - y) for x, y in zip(a, b))


def detect(px, w, h, extended=False):
    hole = is_hole_extended if extended else is_hole_pixel
    frame = lambda r, g, b, a: a > 50 and not hole(r, g, b, a)
    cx, cy = w // 2, h // 2
    left = cx
    while left > 0 and not frame(*px[left, cy]):
        left -= 1
    left += 1
    right = cx
    while right < w - 1 and not frame(*px[right, cy]):
        right += 1
    right -= 1
    top = cy
    while top > 0 and not frame(*px[cx, top]):
        top -= 1
    top += 1
    bottom = cy
    while bottom < h - 1 and not frame(*px[cx, bottom]):
        bottom += 1
    bottom -= 1
    if right <= left or bottom <= top:
        return None
    borders = [left, top, w - 1 - right, h - 1 - bottom]
    B = max(borders)
    sym = min(borders) / max(borders)
    hole_w = right - left + 1
    hole_h = bottom - top + 1
    if B < MIN_THICKNESS or B > MAX_THICKNESS:
        return None
    if sym < 0.45:
        return None
    if hole_w < w * 0.15 or hole_h < h * 0.15:
        return None
    return B


def fix_flat_fill(px, w, h):
    vis = set()
    q = deque()

    def match(p):
        return p[3] < 30 or is_flat_fill(p[0], p[1], p[2], p[3])

    def seed(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        if (x, y) in vis:
            return
        if match(px[x, y]):
            vis.add((x, y))
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)
    seed(w // 2, h // 2)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or (nx, ny) in vis:
                continue
            if match(px[nx, ny]):
                vis.add((nx, ny))
                q.append((nx, ny))


def process_removebg(img):
    im = img.copy()
    w, h = im.size
    px = im.load()
    fix_flat_fill(px, w, h)
    cx, cy = w // 2, h // 2
    left = cx
    while left > 0 and not is_frame_pixel(*px[left, cy]):
        left -= 1
    left += 1
    right = cx
    while right < w - 1 and not is_frame_pixel(*px[right, cy]):
        right += 1
    right -= 1
    top = cy
    while top > 0 and not is_frame_pixel(*px[cx, top]):
        top -= 1
    top += 1
    bottom = cy
    while bottom < h - 1 and not is_frame_pixel(*px[cx, bottom]):
        bottom += 1
    bottom -= 1
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            px[x, y] = (0, 0, 0, 0)
    return detect(px, w, h)


def flood(px, w, h, seeds, ref, tol):
    vis = set()
    q = deque()
    for x, y in seeds:
        p = px[x, y]
        if p[3] < 20 or color_dist(p[:3], ref) <= tol:
            vis.add((x, y))
            q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or (nx, ny) in vis:
                continue
            p = px[nx, ny]
            if p[3] < 20 or color_dist(p[:3], ref) <= tol:
                vis.add((nx, ny))
                q.append((nx, ny))


def sample_corner_bg(px, w, h):
    patch = max(12, min(40, int(min(w, h) * 0.06)))
    samples = []
    for x0, y0 in ((0, 0), (w - patch, 0), (0, h - patch), (w - patch, h - patch)):
        for dy in range(patch):
            for dx in range(patch):
                p = px[x0 + dx, y0 + dy]
                if p[3] < 20:
                    continue
                if is_hole_extended(p[0], p[1], p[2], p[3]):
                    samples.append(p[:3])
    if len(samples) < 4:
        return None
    return tuple(round(median([s[i] for s in samples])) for i in range(3))


def process_cardboard(img):
    best = None
    for outer in (42, 52, 62, 72):
        for inner in (42, 52, 62, 72):
            im = img.copy()
            w, h = im.size
            px = im.load()
            bg = sample_corner_bg(px, w, h)
            if not bg:
                continue
            seeds = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
            seeds += [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
            flood(px, w, h, seeds, bg, outer)
            cx, cy = w // 2, h // 2
            hole_ref = bg
            for r in range(30):
                p = px[cx + r, cy]
                if p[3] > 20:
                    hole_ref = p[:3]
                    break
            flood(px, w, h, [(cx, cy)], hole_ref, inner)
            th = detect(px, w, h, extended=True)
            if th and (best is None or abs(th - 50) < abs(best - 50)):
                best = th
    return best


def sim_photo(frame_path, pad=50):
    frame = Image.open(frame_path).convert("RGBA")
    bg = Image.new("RGBA", (frame.width + pad * 2, frame.height + pad * 2), (210, 195, 170, 255))
    bg.paste(frame, (pad, pad), frame)
    return bg


def opaque_fill(img):
    im = img.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] < 30:
                px[x, y] = (0, 0, 0, 255)
    return im


def main() -> None:
    ok = 0
    cases = [
        ("rmbg-ceviz", ROOT / "tmp-frame-test/out-ceviz_kopyas_-remove.png", "rmbg"),
        ("rmbg-beyaz", ROOT / "tmp-frame-test/out-bxxbx_kopyas_-remove.png", "rmbg"),
        ("public-siyah", ROOT / "public/frames/fa-20-siyah.png", "rmbg"),
        ("public-beyaz", ROOT / "public/frames/fa-20-beyaz.png", "rmbg"),
        ("user-ceviz2", ROOT / "tmp-frame-test/user-ceviz2.png", "rmbg"),
        ("photo-ceviz", sim_photo(ROOT / "public/frames/fa-20-ceviz.png"), "cardboard"),
        ("photo-beyaz", sim_photo(ROOT / "public/frames/fa-20-beyaz.png"), "cardboard"),
        ("photo-siyah", sim_photo(ROOT / "public/frames/fa-20-siyah.png"), "cardboard"),
    ]
    for name, path, mode in cases:
        if isinstance(path, Path) and not path.exists():
            print(f"SKIP {name}")
            continue
        img = path if isinstance(path, Image.Image) else Image.open(path).convert("RGBA")
        for suffix, variant in [("normal", img), ("opaque", opaque_fill(img.copy()))]:
            th = process_removebg(variant) if mode == "rmbg" else process_cardboard(variant)
            good = th is not None
            print(f"{'OK' if good else 'FAIL':4} {name:14} {suffix:8} {mode:9} B={th}")
            ok += good

    assets = Path("/Users/sametozturk/.cursor/projects/Users-sametozturk-Desktop-projeler-cerceve-app/assets")
    for p in sorted(assets.glob("*removebg*.png")):
        img = Image.open(p).convert("RGBA")
        th = process_removebg(img)
        good = th is not None
        print(f"{'OK' if good else 'FAIL':4} asset {p.name[:30]:30} B={th}")
        ok += good

    print(f"\n{ok} passed")
    if ok < 8:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
