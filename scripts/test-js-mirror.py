#!/usr/bin/env python3
"""frameProcessor.js mantığının Python aynası — hızlı doğrulama."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def is_solid_background(r, g, b, a):
    if a < 50:
        return True
    spread = max(r, g, b) - min(r, g, b)
    br = (r + g + b) / 3
    if spread < 14:
        if br > 215:
            return True
        if br < 40 and abs(r - b) < 8:
            return True
    return False


def is_hole_pixel(r, g, b, a):
    if a < 30:
        return True
    if is_solid_background(r, g, b, a):
        return True
    if a > 50 and r + g + b < 45:
        return False
    if r + g + b < 35:
        return True
    br = (r + g + b) / 3
    spread = max(r, g, b) - min(r, g, b)
    if spread < 12 and abs(r - g) < 12 and abs(g - b) < 12 and 155 < br < 245:
        return True
    if abs(r - g) < 20 and abs(g - b) < 20 and 90 < br < 170:
        return True
    warmth = r - b
    if warmth > 6 and 105 < br < 230:
        return True
    return False


def is_hole_for_detection(r, g, b, a):
    if a < 30:
        return True
    if is_solid_background(r, g, b, a):
        return True
    spread = max(r, g, b) - min(r, g, b)
    br = (r + g + b) / 3
    if a > 50 and r + g + b < 80:
        return False
    if a > 50 and spread < 18 and br > 188:
        return False
    if spread < 12 and abs(r - g) < 12 and abs(g - b) < 12 and 155 < br < 245:
        return True
    warmth = r - b
    if warmth > 6 and 105 < br < 230:
        return True
    return False


def is_frame_pixel(r, g, b, a):
    return a > 50 and not is_hole_for_detection(r, g, b, a)


def median(vals):
    s = sorted(vals)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def color_dist(a, b):
    return sum(abs(x - y) for x, y in zip(a, b))


def transparent_ratio(px, w, h):
    t = sum(1 for y in range(h) for x in range(w) if px[x, y][3] < 30)
    return t / (w * h)


def detect_bounds(px, w, h):
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
    return left, right, top, bottom


def bounds_metrics(left, right, top, bottom, w, h):
    if right <= left or bottom <= top:
        return None
    borders = [left, top, w - 1 - right, h - 1 - bottom]
    B = max(borders)
    sym = min(borders) / max(borders)
    hole_w = right - left + 1
    hole_h = bottom - top + 1
    return B, sym, hole_w, hole_h


def is_valid_metrics(m, w, h, max_thickness=110):
    if not m:
        return False
    B, sym, hole_w, hole_h = m
    min_side = min(w, h)
    if B < 8 or B > max_thickness:
        return False
    if sym < 0.3:
        return False
    if hole_w < min_side * 0.1 or hole_h < min_side * 0.1:
        return False
    return True


def should_flood_pixel(p, ref, tol):
    r, g, b, a = p
    if a < 20:
        return True
    dist = color_dist(p[:3], ref)
    if dist > tol:
        return False
    br = (r + g + b) / 3
    if br < 58 and dist > 16:
        return False
    if br > 175 and dist > 22:
        return False
    return True


def flood_to_transparent(px, w, h, seeds, match_fn):
    vis = set()
    q = deque()
    for x, y in seeds:
        if match_fn(px[x, y]):
            vis.add((x, y))
            q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or (nx, ny) in vis:
                continue
            p = px[nx, ny]
            if p[3] < 20 or match_fn(p):
                vis.add((nx, ny))
                q.append((nx, ny))


def flood_by_color(px, w, h, seeds, ref, tol):
    vis = set()
    q = deque()
    for x, y in seeds:
        if should_flood_pixel(px[x, y], ref, tol):
            vis.add((x, y))
            q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or (nx, ny) in vis:
                continue
            if should_flood_pixel(px[nx, ny], ref, tol):
                vis.add((nx, ny))
                q.append((nx, ny))


def border_seeds(w, h):
    seeds = []
    for x in range(w):
        seeds.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        seeds.extend([(0, y), (w - 1, y)])
    return seeds


def sample_background_color(px, w, h):
    patch = max(12, min(48, int(min(w, h) * 0.08)))
    points = [
        (0, 0),
        (w - patch, 0),
        (0, h - patch),
        (w - patch, h - patch),
        (w // 2 - patch // 2, 0),
        (w // 2 - patch // 2, h - patch),
        (0, h // 2 - patch // 2),
        (w - patch, h // 2 - patch // 2),
    ]

    def collect(accept):
        samples = []
        for x0, y0 in points:
            for dy in range(patch):
                for dx in range(patch):
                    p = px[x0 + dx, y0 + dy]
                    if p[3] < 20:
                        continue
                    if not accept(p):
                        continue
                    samples.append(p[:3])
        return samples

    samples = collect(lambda p: p[0] + p[1] + p[2] >= 80 and is_hole_pixel(*p))
    if len(samples) < 4:
        samples = collect(
            lambda p: p[0] + p[1] + p[2] >= 80
            and max(p[:3]) - min(p[:3]) < 22
            and (p[0] + p[1] + p[2]) / 3 > 165
        )
    if len(samples) < 4:
        return None
    return tuple(round(median([s[i] for s in samples])) for i in range(3))


def clear_flat_fills(img):
    im = img.copy()
    w, h = im.size
    px = im.load()
    seeds = border_seeds(w, h)
    seeds.append((w // 2, h // 2))
    flood_to_transparent(px, w, h, seeds, lambda p: p[3] < 30 or is_solid_background(*p))
    return im


def prepare_cardboard(img):
    im = img.copy()
    w, h = im.size
    px = im.load()
    seeds = border_seeds(w, h)
    bg = sample_background_color(px, w, h)

    def border_match(p):
        if p[3] < 30:
            return True
        if not bg:
            return is_hole_pixel(*p)
        return should_flood_pixel(p, bg, 40) or is_hole_pixel(*p)

    flood_to_transparent(px, w, h, seeds, border_match)
    if bg:
        for tol in (32, 40, 48, 56, 64):
            flood_by_color(px, w, h, seeds, bg, tol)
    cx, cy = w // 2, h // 2
    if bg:
        for tol in (36, 44, 52, 60):
            flood_by_color(px, w, h, [(cx, cy)], bg, tol)
    flood_to_transparent(px, w, h, [(cx, cy)], lambda p: is_solid_background(*p) or p[3] < 30)
    return im


def clear_inner_hole(px, w, h):
    left, right, top, bottom = detect_bounds(px, w, h)
    if right <= left or bottom <= top:
        return
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            px[x, y] = (0, 0, 0, 0)


def crop_to_opaque_bounds(img):
    w, h = img.size
    px = img.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 50:
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        return img
    return img.crop((min_x, min_y, max_x + 1, max_y + 1))


def try_build(img, max_thickness=110):
    im = crop_to_opaque_bounds(img)
    w, h = im.size
    px = im.load()
    clear_inner_hole(px, w, h)
    m = bounds_metrics(*detect_bounds(px, w, h), w, h)
    if not is_valid_metrics(m, w, h, max_thickness):
        return None
    return m[0], m[1]


def pick_best(results, max_thickness=80):
    best = None
    best_score = float("inf")
    for r in results:
        if not r:
            continue
        B, sym = r
        if B > max_thickness:
            continue
        score = abs(B - 50) + (1 - sym) * 35
        if score < best_score:
            best_score = score
            best = r
    return best


def process_image(path: Path):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    ratio = transparent_ratio(px, w, h)

    results = [
        try_build(img),
        try_build(clear_flat_fills(img)),
    ]
    if ratio < 0.5:
        results.append(try_build(prepare_cardboard(img)))

    best = pick_best(results, 80) or pick_best(results, 110)
    return best, ratio, results


def main():
    cases = [
        ROOT / "tmp-frame-test/user-ref-removebg.png",
        ROOT / "tmp-frame-test/checker-ceviz.png",
        ROOT / "tmp-frame-test/sim-photo-ceviz.png",
        ROOT / "tmp-frame-test/out-ceviz_kopyas_-remove.png",
        ROOT / "public/frames/fa-20-siyah.png",
        ROOT / "public/frames/fa-20-ceviz.png",
        ROOT / "public/frames/fa-20-beyaz.png",
    ]
    ok = 0
    for path in cases:
        if not path.exists():
            print(f"SKIP {path.name}")
            continue
        best, ratio, results = process_image(path)
        paths = ["direct", "flat", "cardboard"][: len(results)]
        detail = ", ".join(f"{p}={r[0] if r else None}" for p, r in zip(paths, results))
        if best:
            print(f"OK   {path.name:35} ratio={ratio:.2f} B={best[0]} sym={best[1]:.2f}  [{detail}]")
            ok += 1
        else:
            print(f"FAIL {path.name:35} ratio={ratio:.2f}  [{detail}]")

    print(f"\n{ok}/{len(cases)} passed")
    if ok < len(cases):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
