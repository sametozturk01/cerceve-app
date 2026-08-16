#!/usr/bin/env python3
"""
Yeni çerçeve PNG'sini işler, public/frames/ altına kaydeder ve frames.json günceller.

Kullanım:
  python3 scripts/add-frame.py \\
    --input yeni-cerceve.png \\
    --code "FA 20" \\
    --color "gümüş" \\
    --categories fa20,metal \\
    --default-mm 20

  # Mevcut kaydı sadece PNG ile yenile:
  python3 scripts/add-frame.py --input yeni.png --code "FA 20" --color "gümüş" --update-only
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import unicodedata
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FRAMES_JSON = ROOT / "src" / "data" / "frames.json"
FRAMES_DIR = ROOT / "public" / "frames"

COLOR_DEFAULTS: dict[str, dict] = {
    "gumus": {"id": "gumus", "label": "Gümüş", "hex": "#D8DCDC"},
    "gümüş": {"id": "gumus", "label": "Gümüş", "hex": "#D8DCDC"},
    "ceviz": {"id": "ceviz", "label": "Ceviz", "hex": "#5C4A3A"},
    "düz ceviz": {"id": "duz-ceviz", "label": "Düz Ceviz", "hex": "#5C4A3A"},
    "duz ceviz": {"id": "duz-ceviz", "label": "Düz Ceviz", "hex": "#5C4A3A"},
    "siyah": {"id": "siyah", "label": "Siyah", "hex": "#1a1a1a"},
    "siyah silikonlu": {"id": "siyah-silikonlu", "label": "Siyah Silikonlu", "hex": "#1a1a1a"},
    "gümüş silikonlu": {"id": "gumus-silikonlu", "label": "Gümüş Silikonlu", "hex": "#C5C9CC"},
    "gumus silikonlu": {"id": "gumus-silikonlu", "label": "Gümüş Silikonlu", "hex": "#C5C9CC"},
    "silikonlu gümüş": {"id": "gumus-silikonlu", "label": "Gümüş Silikonlu", "hex": "#C5C9CC"},
    "altın silikonlu": {"id": "altin-silikonlu", "label": "Altın Silikonlu", "hex": "#C8A84B"},
    "altin silikonlu": {"id": "altin-silikonlu", "label": "Altın Silikonlu", "hex": "#C8A84B"},
    "silikonlu altın": {"id": "altin-silikonlu", "label": "Altın Silikonlu", "hex": "#C8A84B"},
    "silikonlu altin": {"id": "altin-silikonlu", "label": "Altın Silikonlu", "hex": "#C8A84B"},
    "altin": {"id": "altin", "label": "Altın", "hex": "#C8A84B"},
    "altın": {"id": "altin", "label": "Altın", "hex": "#C8A84B"},
    "düz altın": {"id": "duz-altin", "label": "Düz Altın", "hex": "#C8A84B"},
    "duz altin": {"id": "duz-altin", "label": "Düz Altın", "hex": "#C8A84B"},
    "beyaz": {"id": "beyaz", "label": "Beyaz", "hex": "#f0f0f0", "stroke": "#ccc"},
    "ağaç kabuğu beyaz": {"id": "agac-kabugu-beyaz", "label": "Ağaç Kabuğu Beyaz", "hex": "#f5f5f5", "stroke": "#d4d4d4"},
    "agac kabugu beyaz": {"id": "agac-kabugu-beyaz", "label": "Ağaç Kabuğu Beyaz", "hex": "#f5f5f5", "stroke": "#d4d4d4"},
    "ağaç kabuğu siyah": {"id": "agac-kabugu-siyah", "label": "Ağaç Kabuğu Siyah", "hex": "#1a1a1a"},
    "agac kabugu siyah": {"id": "agac-kabugu-siyah", "label": "Ağaç Kabuğu Siyah", "hex": "#1a1a1a"},
    "ağaç kabuğu platin": {"id": "agac-kabugu-platin", "label": "Ağaç Kabuğu Platin", "hex": "#E5E4E2"},
    "agac kabugu platin": {"id": "agac-kabugu-platin", "label": "Ağaç Kabuğu Platin", "hex": "#E5E4E2"},
    "ağaç kabuğu altın": {"id": "agac-kabugu-altin", "label": "Ağaç Kabuğu Altın", "hex": "#C8A84B"},
    "agac kabugu altin": {"id": "agac-kabugu-altin", "label": "Ağaç Kabuğu Altın", "hex": "#C8A84B"},
    "ağaç kabuğu ceviz": {"id": "agac-kabugu-ceviz", "label": "Ağaç Kabuğu Ceviz", "hex": "#5C4A3A"},
    "agac kabugu ceviz": {"id": "agac-kabugu-ceviz", "label": "Ağaç Kabuğu Ceviz", "hex": "#5C4A3A"},
    "kahve": {"id": "kahve", "label": "Kahve", "hex": "#5C3D1E"},
    "kinder mavi": {"id": "kinder-mavi", "label": "Kinder Mavi", "hex": "#8BAEC8"},
    "mavi": {"id": "mavi", "label": "Mavi", "hex": "#5B7FA6"},
    "yeşil": {"id": "yesil", "label": "Yeşil", "hex": "#2F5A3A"},
    "yesil": {"id": "yesil", "label": "Yeşil", "hex": "#2F5A3A"},
    "çizgili gümüş": {"id": "cizgili-gumus", "label": "Çizgili Gümüş", "hex": "#C5C9CC"},
    "cizgili gumus": {"id": "cizgili-gumus", "label": "Çizgili Gümüş", "hex": "#C5C9CC"},
    "lacivert": {"id": "lacivert", "label": "Lacivert", "hex": "#1E3A5F"},
    "platin": {"id": "platin", "label": "Platin", "hex": "#E5E4E2"},
    "şampanya": {"id": "sampanya", "label": "Şampanya", "hex": "#D4C4A8"},
    "sampanya": {"id": "sampanya", "label": "Şampanya", "hex": "#D4C4A8"},
    "oksit gümüş": {"id": "oksit-gumus", "label": "Oksit Gümüş", "hex": "#A39E94"},
    "oksit gumus": {"id": "oksit-gumus", "label": "Oksit Gümüş", "hex": "#A39E94"},
    "eskitme gümüş": {"id": "eskitme-gumus", "label": "Eskitme Gümüş", "hex": "#B8B0A4"},
    "eskitme gumus": {"id": "eskitme-gumus", "label": "Eskitme Gümüş", "hex": "#B8B0A4"},
    "oksit altın": {"id": "oksit-altin", "label": "Oksit Altın", "hex": "#B8956A"},
    "oksit altin": {"id": "oksit-altin", "label": "Oksit Altın", "hex": "#B8956A"},
    "barok altın": {"id": "barok-altin", "label": "Barok Altın", "hex": "#8B6914"},
    "barok altin": {"id": "barok-altin", "label": "Barok Altın", "hex": "#8B6914"},
    "67": {"id": "67", "label": "67", "hex": "#6B4A2E"},
    "66": {"id": "66", "label": "66", "hex": "#5A3D28"},
    "turuncu": {"id": "turuncu", "label": "Turuncu", "hex": "#E86B1A"},
    "sarı": {"id": "sari", "label": "Sarı", "hex": "#E8C91A"},
    "sari": {"id": "sari", "label": "Sarı", "hex": "#E8C91A"},
    "kırmızı": {"id": "kirmizi", "label": "Kırmızı", "hex": "#C62828"},
    "kirmizi": {"id": "kirmizi", "label": "Kırmızı", "hex": "#C62828"},
}

SERIES_CATEGORY = {
    "FA 20": "fa20",
    "FA 22": "fa22",
    "FA 30": "fa30",
    "FA 40": "fa40",
    "29 D": "29d",
    "29 KR": "fa29kr",
    "FA 29 KR": "fa29kr",
    "29 -210": "29210",
    "A 25": "a25",
    "B 26": "b26",
    "C 27": "c27",
    "D 28": "d28",
    "E 29": "e29",
    "G 20": "g20",
    "R 21": "r21",
    "Yeni 20": "yeni20",
    "22 lik": "22lik",
    "20 lik": "20lik",
    "30 luk": "30luk",
    "30 d 91": "30d91",
    "34 L": "34l",
    "48 L": "48l",
    "41 lik": "41lik",
    "41 -545": "41545",
    "41 -13": "4113",
    "41 -11": "4111",
    "41 -07": "4107",
    "41 -03": "4103",
    "41 -02": "4102",
    "41 -01": "4101",
    "52 B 64": "52b",
    "52 B": "52b",
}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text or "frame"


def output_filename(code: str | None, color: str | None, stem: str) -> str:
    if code and color:
        return f"{slugify(code)}-{slugify(color)}.png"
    return slugify(stem) + ".png"


def is_solid_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 50:
        return True
    spread = max(r, g, b) - min(r, g, b)
    brightness = (r + g + b) / 3
    if spread < 14:
        if brightness > 235:
            return True
        # Yarı saydam koyu arka plan — opak koyu çerçeve rayını delik sanma
        if brightness < 40 and a < 90:
            return True
    return False


def is_hole_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a < 30:
        return True
    if is_solid_background(r, g, b, a):
        return True
    brightness = (r + g + b) / 3
    spread = max(r, g, b) - min(r, g, b)
    # Yalnızca opak siyah iç boşluk — koyu renkli çerçeve (yeşil vb.) delik sayılmasın
    if brightness < 42 and a > 120 and spread < 12:
        return True
    return False


def is_frame_pixel(r: int, g: int, b: int, a: int) -> bool:
    return a > 50 and not is_hole_pixel(r, g, b, a)


def is_outer_void(r: int, g: int, b: int, a: int) -> bool:
    """Fotoğraf kenarındaki siyah veya beyaz boş alan."""
    if a < 50:
        return True
    brightness = (r + g + b) / 3
    if brightness < 28 and a > 100:
        return True
    return is_solid_background(r, g, b, a) and brightness > 200


def _side_rail_columns(w: int, il: int, ir: int, rail_w: int) -> list[int]:
    return list(range(max(0, il - rail_w), il + 1)) + list(range(ir, min(w, ir + rail_w + 1)))


def strip_outer_void_band(
    img: Image.Image, il: int, it: int, ir: int, ib: int
) -> tuple[Image.Image, int, int, int, int]:
    """Fotoğrafın dışındaki siyah/beyaz boş şeritleri at."""
    px = img.load()
    w, h = img.size
    span_h = ir - il + 1
    span_v = ib - it + 1

    top = 0
    while top < it:
        voids = sum(1 for x in range(il, ir + 1) if is_outer_void(*px[x, top]))
        if voids < span_h * 0.85:
            break
        top += 1

    bottom = h - 1
    side_cols = _side_rail_columns(w, il, ir, max(8, (ir - il + 1) // 4))
    while bottom > ib:
        side_frame = sum(1 for x in side_cols if is_frame_pixel(*px[x, bottom]))
        if side_frame >= 4:
            break
        bottom -= 1

    left = 0
    while left < il:
        voids = sum(1 for y in range(it, ib + 1) if is_outer_void(*px[left, y]))
        if voids < span_v * 0.85:
            break
        left += 1

    right = w - 1
    while right > ir:
        voids = sum(1 for y in range(it, ib + 1) if is_outer_void(*px[right, y]))
        if voids < span_v * 0.85:
            break
        right -= 1

    if top == 0 and bottom == h - 1 and left == 0 and right == w - 1:
        return img, il, it, ir, ib

    cropped = img.crop((left, top, right + 1, bottom + 1))
    return cropped, il - left, it - top, ir - left, ib - top


def trim_photo_margin(
    img: Image.Image, il: int, it: int, ir: int, ib: int
) -> tuple[Image.Image, int, int, int, int]:
    """Çerçeve rayları dışındaki fotoğraf boşluğunu at (ortadaki beyaz alanı sayma)."""
    px = img.load()
    w, h = img.size
    rail_w = max(8, (ir - il + 1) // 4)

    def row_has_rail(y: int) -> bool:
        xs = _side_rail_columns(w, il, ir, rail_w)
        return any(is_frame_pixel(*px[x, y]) for x in xs)

    def col_has_rail(x: int) -> bool:
        ys = range(max(0, it - rail_w), min(h, ib + rail_w + 1))
        return any(is_frame_pixel(*px[x, y]) for y in ys)

    top = 0
    while top < it and not row_has_rail(top):
        top += 1

    bottom = h - 1
    while bottom > ib and not row_has_rail(bottom):
        bottom -= 1

    left = 0
    while left < il and not col_has_rail(left):
        left += 1

    right = w - 1
    while right > ir and not col_has_rail(right):
        right -= 1

    if top == 0 and bottom == h - 1 and left == 0 and right == w - 1:
        return img, il, it, ir, ib

    cropped = img.crop((left, top, right + 1, bottom + 1))
    return cropped, il - left, it - top, ir - left, ib - top


def is_true_hole_seed(r: int, g: int, b: int, a: int) -> bool:
    return a > 100 and r + g + b < 8


def flood_hole_bounds(px, w: int, h: int, cx: int, cy: int) -> tuple[int, int, int, int]:
    vis = bytearray(w * h)
    q: deque[tuple[int, int]] = deque([(cx, cy)])
    vis[cy * w + cx] = 1
    box = [cx, cy, cx, cy]
    while q:
        x, y = q.popleft()
        box[0] = min(box[0], x)
        box[1] = min(box[1], y)
        box[2] = max(box[2], x)
        box[3] = max(box[3], y)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not vis[i] and is_true_hole_seed(*px[nx, ny]):
                    vis[i] = 1
                    q.append((nx, ny))
    return box[0], box[1], box[2], box[3]


def scan_hole_bounds(px, w: int, h: int, cx: int, cy: int) -> tuple[int, int, int, int]:
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
    return left, top, right, bottom


def local_color_variance(px, w: int, h: int, x: int, y: int, rad: int = 4) -> float:
    vals: list[float] = []
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                r, g, b, a = px[nx, ny]
                if a > 128:
                    vals.append(r + g + b)
    if len(vals) < 5:
        return 9999.0
    mean = sum(vals) / len(vals)
    return sum((v - mean) ** 2 for v in vals) / len(vals)


def is_smooth_inner_pixel(px, w: int, h: int, x: int, y: int, var_threshold: float = 20.0) -> bool:
    """Dokulu çerçevede düz iç mat (siyah silikon vb.)."""
    r, g, b, a = px[x, y]
    if a < 128:
        return False
    if (r + g + b) / 3 > 85:
        return False
    return local_color_variance(px, w, h, x, y) < var_threshold


def scan_smooth_inner_bounds(px, w: int, h: int) -> tuple[int, int, int, int]:
    cx, cy = w // 2, h // 2
    left = cx
    while left > 0 and is_smooth_inner_pixel(px, w, h, left, cy):
        left -= 1
    left += 1
    right = cx
    while right < w - 1 and is_smooth_inner_pixel(px, w, h, right, cy):
        right += 1
    right -= 1
    top = cy
    while top > 0 and is_smooth_inner_pixel(px, w, h, cx, top):
        top -= 1
    top += 1
    bottom = cy
    while bottom < h - 1 and is_smooth_inner_pixel(px, w, h, cx, bottom):
        bottom += 1
    bottom -= 1
    return left, top, right, bottom


def detect_hole_bounds(px, w: int, h: int) -> tuple[int, int, int, int]:
    cx, cy = w // 2, h // 2
    if px[cx, cy][3] < 30:
        return flood_hole_transparent(px, w, h, cx, cy)
    left, top, right, bottom = scan_hole_bounds(px, w, h, cx, cy)
    if right <= left or bottom <= top:
        left, top, right, bottom = scan_smooth_inner_bounds(px, w, h)
    rails = [left, top, w - 1 - right, h - 1 - bottom]
    if right <= left or bottom <= top:
        return flood_hole_bounds(px, w, h, cx, cy)
    if max(rails) - min(rails) > 12:
        return flood_hole_bounds(px, w, h, cx, cy)
    return left, top, right, bottom


def flood_hole_transparent(px, w: int, h: int, cx: int, cy: int) -> tuple[int, int, int, int]:
    def seed(r: int, g: int, b: int, a: int) -> bool:
        return a < 30

    vis = bytearray(w * h)
    q: deque[tuple[int, int]] = deque([(cx, cy)])
    vis[cy * w + cx] = 1
    box = [cx, cy, cx, cy]
    while q:
        x, y = q.popleft()
        box[0] = min(box[0], x)
        box[1] = min(box[1], y)
        box[2] = max(box[2], x)
        box[3] = max(box[3], y)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not vis[i] and seed(*px[nx, ny]):
                    vis[i] = 1
                    q.append((nx, ny))
    return box[0], box[1], box[2], box[3]


def pad_to_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    if w == h:
        return img
    side = max(w, h)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - w) // 2
    oy = (side - h) // 2
    out.paste(img, (ox, oy))
    return out


def crop_clamped(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    l, t, r, b = box
    w, h = img.size
    l = max(0, l)
    t = max(0, t)
    r = min(w, r)
    b = min(h, b)
    if r <= l or b <= t:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return img.crop((l, t, r, b))


def trim_edge_strip(patch: Image.Image, axis: str, min_frame_ratio: float = 0.5) -> Image.Image:
    """Kenar bandından dıştaki siyah/boş satır-sütunları at."""
    if patch.width <= 0 or patch.height <= 0:
        return patch
    px = patch.load()
    pw, ph = patch.size

    if axis in ("top", "bottom"):

        def row_ratio(y: int) -> float:
            n = sum(1 for x in range(pw) if is_frame_pixel(*px[x, y]))
            return n / pw

        if axis == "top":
            y0 = 0
            while y0 < ph - 1 and row_ratio(y0) < min_frame_ratio:
                y0 += 1
            return patch.crop((0, y0, pw, ph)) if y0 else patch

        y1 = ph - 1
        while y1 > 0 and row_ratio(y1) < min_frame_ratio:
            y1 -= 1
        return patch.crop((0, 0, pw, y1 + 1)) if y1 + 1 < ph else patch

    def col_ratio(x: int) -> float:
        n = sum(1 for y in range(ph) if is_frame_pixel(*px[x, y]))
        return n / ph

    if axis == "left":
        x0 = 0
        while x0 < pw - 1 and col_ratio(x0) < min_frame_ratio:
            x0 += 1
        return patch.crop((x0, 0, pw, ph)) if x0 else patch

    x1 = pw - 1
    while x1 > 0 and col_ratio(x1) < min_frame_ratio:
        x1 -= 1
    return patch.crop((0, 0, x1 + 1, ph)) if x1 + 1 < pw else patch


def align_strip_outer_face(patch: Image.Image, axis: str) -> Image.Image:
    """Dış yüzey satırını bandın başına hizala (koyu bevel/arka planı at)."""
    if patch.width <= 0 or patch.height <= 0:
        return patch
    px = patch.load()
    pw, ph = patch.size

    if axis in ("top", "bottom"):

        def row_brightness(y: int) -> float:
            vals = [
                (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
                for x in range(pw)
                if is_frame_pixel(*px[x, y])
            ]
            return sum(vals) / len(vals) if vals else 0.0

        search = max(1, ph // 3)
        if axis == "top":
            best_y = max(range(search), key=row_brightness)
            return patch.crop((0, best_y, pw, ph)) if best_y else patch

        start = max(0, ph - search)
        best_y = max(range(start, ph), key=row_brightness)
        return patch.crop((0, 0, pw, best_y + 1)) if best_y + 1 < ph else patch

    def col_brightness(x: int) -> float:
        vals = [
            (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
            for y in range(ph)
            if is_frame_pixel(*px[x, y])
        ]
        return sum(vals) / len(vals) if vals else 0.0

    search = max(1, pw // 3)
    if axis == "left":
        best_x = max(range(search), key=col_brightness)
        return patch.crop((best_x, 0, pw, ph)) if best_x else patch

    start = max(0, pw - search)
    best_x = max(range(start, pw), key=col_brightness)
    return patch.crop((0, 0, best_x + 1, ph)) if best_x + 1 < pw else patch


def trim_corner_outer_void(patch: Image.Image) -> Image.Image:
    """Köşe yamasındaki dış beyaz/siyah boşluğu at."""
    if patch.width <= 0 or patch.height <= 0:
        return patch
    px = patch.load()
    l, t, r, b = 0, 0, patch.width, patch.height

    while t < b - 1:
        solid = sum(1 for x in range(l, r) if not is_outer_void(*px[x, t]))
        if solid >= (r - l) * 0.25:
            break
        t += 1

    while l < r - 1:
        solid = sum(1 for y in range(t, b) if not is_outer_void(*px[l, y]))
        if solid >= (b - t) * 0.25:
            break
        l += 1

    # Dış köşedeki açık gri fotoğraf arka planını at
    while t < b - 1:
        bright = sum(
            1 for x in range(l, r)
            if px[x, t][3] > 128 and (px[x, t][0] + px[x, t][1] + px[x, t][2]) / 3 > 90
        )
        if bright < (r - l) * 0.35:
            break
        t += 1

    while l < r - 1:
        bright = sum(
            1 for y in range(t, b)
            if px[l, y][3] > 128 and (px[l, y][0] + px[l, y][1] + px[l, y][2]) / 3 > 90
        )
        if bright < (b - t) * 0.35:
            break
        l += 1

    if l == 0 and t == 0 and r == patch.width and b == patch.height:
        return patch
    return patch.crop((l, t, r, b))


def prepare_rail_edge_strip(patch: Image.Image, axis: str) -> Image.Image:
    """Üst/alt ray profili — trim_edge_strip iç mat satırına çökmez; dış yüz korunur."""
    return align_strip_outer_face(patch, axis)


def prepare_corner_patch(patch: Image.Image, axes: tuple[str, ...]) -> Image.Image:
    out = trim_corner_outer_void(patch)
    for axis in axes:
        out = trim_edge_strip(out, axis)
        out = align_strip_outer_face(out, axis)
    return out


def row_min_brightness(px, il: int, ir: int, y: int) -> float:
    vals = [
        (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
        for x in range(il, ir + 1)
        if px[x, y][3] > 50
    ]
    return min(vals) if vals else 255.0


def bottom_rail_start(px, w: int, h: int, il: int, ir: int, ib: int, max_scan: int = 12) -> int:
    """Alt ray: delikten hemen sonraki satırdan başla (üstte it-1 oluk satırına simetrik)."""
    return ib + 1


def _strip_row_min_brightness(patch: Image.Image, y: int) -> float:
    px = patch.load()
    pw, ph = patch.size
    if y < 0 or y >= ph:
        return 255.0
    vals = [
        (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
        for x in range(pw)
        if px[x, y][3] > 50
    ]
    return min(vals) if vals else 255.0


def outer_groove_strength(patch: Image.Image, outer_at: str) -> int:
    """Dış kenardan içe doğru üst üste koyu oluk satırı sayısı."""
    ph = patch.height
    if ph <= 0:
        return 0
    limit = max(3, ph // 3)
    rows = range(ph) if outer_at == "start" else range(ph - 1, -1, -1)
    best = cur = scanned = 0
    for y in rows:
        if _strip_row_min_brightness(patch, y) < 55:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
        scanned += 1
        if scanned >= limit:
            break
    return best


def outer_groove_center_offset(patch: Image.Image, outer_at: str) -> int | None:
    """Dış yarıdaki en geniş koyu oluk bandının merkezinin dış kenara uzaklığı."""
    ph = patch.height
    if ph <= 0:
        return None
    rows = list(range(ph) if outer_at == "start" else range(ph - 1, -1, -1))
    rows = rows[: max(8, ph // 2)]
    best_len = 0
    best_center = None
    cur_start = 0
    cur_len = 0
    for i, y in enumerate(rows):
        if _strip_row_min_brightness(patch, y) < 25:
            if cur_len == 0:
                cur_start = i
            cur_len += 1
        else:
            if cur_len > best_len:
                best_len = cur_len
                best_center = cur_start + cur_len // 2
            cur_len = 0
    if cur_len > best_len:
        best_center = cur_start + cur_len // 2
    return best_center


def mean_rail_brightness(edge: Image.Image) -> float:
    px = edge.load()
    w, h = edge.size
    vals: list[float] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128:
                vals.append((r + g + b) / 3)
    return statistics.mean(vals) if vals else 0.0


def inner_edge_brightness(edge: Image.Image, row: int) -> float:
    px = edge.load()
    w, h = edge.size
    y = row if row >= 0 else h + row
    if y < 0 or y >= h:
        return 0.0
    vals = [(px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3 for x in range(w) if px[x, y][3] > 128]
    return statistics.mean(vals) if vals else 0.0


def rails_brightness_mismatch(top_edge: Image.Image, bottom_edge: Image.Image, threshold: float = 25.0) -> bool:
    top_inner = inner_edge_brightness(top_edge, -1)
    bot_inner = inner_edge_brightness(bottom_edge, 0)
    if top_inner < 15 or bot_inner < 15:
        return False
    if abs(top_inner - bot_inner) > threshold:
        return True
    top_b = mean_rail_brightness(top_edge)
    bot_b = mean_rail_brightness(bottom_edge)
    if top_b < 15 or bot_b < 15:
        return False
    return abs(top_b - bot_b) > 30.0


def needs_bottom_profile_mirror(top_edge: Image.Image, bottom_edge: Image.Image) -> bool:
    """Alt kenarda dış oluk üsttekiyle aynı derinlikte değilse üst profili aynala."""
    top_center = outer_groove_center_offset(top_edge, "start")
    bot_center = outer_groove_center_offset(bottom_edge, "end")
    if top_center is None or bot_center is None:
        return False
    return bot_center < 8 and top_center >= 12


def needs_bottom_rail_mirror(top_edge: Image.Image, bottom_edge: Image.Image) -> bool:
    if bottom_edge.height < max(4, top_edge.height // 3):
        return True
    if top_edge.height > 0 and bottom_edge.height <= top_edge.height * 0.92:
        return True
    if rails_brightness_mismatch(top_edge, bottom_edge):
        return True
    return needs_bottom_profile_mirror(top_edge, bottom_edge)


def mirror_bottom_from_top(
    top_edge: Image.Image, top_left: Image.Image, top_right: Image.Image
) -> tuple[Image.Image, Image.Image, Image.Image]:
    """Üst profili dikey aynala; alt kenarda eksik dış oluk için."""
    flip = Image.FLIP_TOP_BOTTOM
    return top_edge.transpose(flip), top_left.transpose(flip), top_right.transpose(flip)


def paste_resized(out: Image.Image, patch: Image.Image, dest: tuple[int, int, int, int]) -> None:
    dx0, dy0, dx1, dy1 = dest
    dw, dh = dx1 - dx0, dy1 - dy0
    if dw <= 0 or dh <= 0:
        return
    if patch.size == (dw, dh):
        out.paste(patch, (dx0, dy0))
        return
    out.paste(patch.resize((dw, dh), Image.LANCZOS), (dx0, dy0))


def crop_to_frame_content(img: Image.Image) -> Image.Image:
    """Siyah dış boşluğu at; yalnızca çerçeve malzemesinin sıkı sınır kutusu."""
    px = img.load()
    w, h = img.size
    left, top, right, bottom = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if is_frame_pixel(*px[x, y]):
                found = True
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
    if not found:
        return img
    return img.crop((left, top, right + 1, bottom + 1))


def center_frame_hole(img: Image.Image, il: int, it: int, ir: int, ib: int) -> tuple[Image.Image, int, int, int, int]:
    """Deliği kare tuvalin ortasına al; dört kenar kalınlığı eşitlensin."""
    w, h = img.size
    hcx, hcy = (il + ir) / 2, (it + ib) / 2
    side = max(w, h)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = int(round(side / 2 - hcx))
    oy = int(round(side / 2 - hcy))
    out.paste(img, (ox, oy))
    return out, il + ox, it + oy, ir + ox, ib + oy


def is_colored_frame_pixel(r: int, g: int, b: int, a: int) -> bool:
    """Altın/gümüş gibi renkli profil pikselleri (iç mat değil)."""
    if a < 128:
        return False
    brightness = (r + g + b) / 3
    spread = max(r, g, b) - min(r, g, b)
    return brightness > 85 and spread > 8


def is_inner_mat_pixel(r: int, g: int, b: int, a: int) -> bool:
    """Siyah/kahverengi silikon mat (dokulu altın profilden ayrılır)."""
    if a < 128:
        return False
    return (r + g + b) / 3 < 55


def measure_outward_dark_band(
    px, w: int, h: int, edge_x: int, edge_y: int, dx: int, dy: int
) -> int:
    """Delik kenarından dışarı: renkli profile kadar kalan ince siyah mat şeridi."""
    x, y = edge_x + dx, edge_y + dy
    band = 0
    while 0 <= x < w and 0 <= y < h:
        r, g, b, a = px[x, y]
        if is_colored_frame_pixel(r, g, b, a):
            break
        if is_inner_mat_pixel(r, g, b, a) or is_hole_pixel(r, g, b, a):
            band += 1
            x += dx
            y += dy
            continue
        break
    return band


def measure_outward_to_profile_edge(
    px, w: int, h: int, edge_x: int, edge_y: int, dx: int, dy: int, bright_threshold: float = 140.0
) -> int:
    """Delik kenarından dışarı: parlak çerçeve profiline kadar koyu bölge derinliği."""
    x, y = edge_x + dx, edge_y + dy
    dist = 0
    while 0 <= x < w and 0 <= y < h and dist < 80:
        r, g, b, a = px[x, y]
        if a < 128:
            break
        if (r + g + b) / 3 >= bright_threshold:
            break
        dist += 1
        x += dx
        y += dy
    return dist


def compute_inner_mat_inset(
    px, w: int, h: int, il: int, it: int, ir: int, ib: int, target_mat_px: int = 22
) -> int:
    """Renkli silikonlu profillerde iç siyah mat bandını korumak için deliği küçült."""
    cx, cy = w // 2, h // 2
    bands = [
        measure_outward_dark_band(px, w, h, il, cy, -1, 0),
        measure_outward_dark_band(px, w, h, ir, cy, 1, 0),
        measure_outward_dark_band(px, w, h, cx, it, 0, -1),
        measure_outward_dark_band(px, w, h, cx, ib, 0, 1),
    ]
    insets = [max(0, target_mat_px - band) for band in bands if 0 < band < target_mat_px]
    if insets:
        return max(insets)

    # Gümüş gibi profillerde ince mat doğrudan ölçülemezse parlak kenara kadar koyu bölge varsa sabit pay
    profile_depths = [
        measure_outward_to_profile_edge(px, w, h, il, cy, -1, 0),
        measure_outward_to_profile_edge(px, w, h, ir, cy, 1, 0),
        measure_outward_to_profile_edge(px, w, h, cx, it, 0, -1),
        measure_outward_to_profile_edge(px, w, h, cx, ib, 0, 1),
    ]
    deep_sides = [d for d in profile_depths if d >= 8]
    if len(deep_sides) >= 3:
        return target_mat_px
    return 0


def inset_hole_bounds(
    il: int, it: int, ir: int, ib: int, inset: int, w: int, h: int
) -> tuple[int, int, int, int]:
    inset = max(0, inset)
    il += inset
    it += inset
    ir -= inset
    ib -= inset
    if ir <= il or ib <= it:
        raise ValueError("İç mat payı delik sınırlarını aşıyor. PNG'yi kontrol edin.")
    return il, it, ir, ib


def punch_hole_transparent(img: Image.Image, il: int, it: int, ir: int, ib: int) -> Image.Image:
    """İç boşluğu şeffaf yap; köşe profili bozulmasın (flat asset)."""
    out = img.copy()
    px = out.load()
    for y in range(it, ib + 1):
        for x in range(il, ir + 1):
            px[x, y] = (0, 0, 0, 0)
    return out


def process_frame_flat(src: Path, dest: Path) -> int:
    """Kaynak çerçeveyi nine-slice parçalamadan düz PNG olarak kaydet."""
    raw = Image.open(src).convert("RGBA")
    raw = crop_to_frame_content(raw)
    w, h = raw.size
    px = raw.load()
    il, it, ir, ib = detect_hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        raise ValueError("Çerçeve kenarı tespit edilemedi. PNG'yi kontrol edin.")

    raw, il, it, ir, ib = strip_outer_void_band(raw, il, it, ir, ib)
    raw, il, it, ir, ib = trim_photo_margin(raw, il, it, ir, ib)

    punched = punch_hole_transparent(raw, il, it, ir, ib)
    img, il, it, ir, ib = center_frame_hole(punched, il, it, ir, ib)
    w, h = img.size
    B = int(round(statistics.median([il, it, w - 1 - ir, h - 1 - ib])))

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG")
    return B


def process_frame_png(src: Path, dest: Path, force_thickness: int | None = None) -> int:
    raw = Image.open(src).convert("RGBA")
    raw = crop_to_frame_content(raw)
    raw_w, raw_h = raw.size
    raw_px = raw.load()
    il, it, ir, ib = detect_hole_bounds(raw_px, raw_w, raw_h)
    if ir <= il or ib <= it:
        raise ValueError("Çerçeve kenarı tespit edilemedi. PNG'yi kontrol edin.")

    raw, il, it, ir, ib = strip_outer_void_band(raw, il, it, ir, ib)
    raw, il, it, ir, ib = trim_photo_margin(raw, il, it, ir, ib)
    raw_w, raw_h = raw.size
    rail_sizes = [il, it, raw_w - 1 - ir, raw_h - 1 - ib]
    B = force_thickness if force_thickness is not None else int(round(statistics.median(rail_sizes)))
    B = min(B, *rail_sizes)

    img, il, it, ir, ib = center_frame_hole(raw, il, it, ir, ib)
    w, h = img.size
    px = img.load()
    bot0 = bottom_rail_start(px, w, h, il, ir, ib)

    hole_size = max(ir - il + 1, ib - it + 1)
    out_size = hole_size + 2 * B
    out = Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))

    tl = prepare_corner_patch(crop_clamped(img, (il - B, it - B, il, it)), ("top", "left"))
    tr = prepare_corner_patch(crop_clamped(img, (ir + 1, it - B, ir + 1 + B, it)), ("top", "right"))
    top_e = prepare_rail_edge_strip(crop_clamped(img, (il, it - B, ir + 1, it)), "top")
    bot_src = prepare_rail_edge_strip(crop_clamped(img, (il, bot0, ir + 1, bot0 + B)), "bottom")
    if needs_bottom_rail_mirror(top_e, bot_src):
        bot_e, bl, br = mirror_bottom_from_top(top_e, tl, tr)
    else:
        bot_e = bot_src
        bl = prepare_corner_patch(crop_clamped(img, (il - B, bot0, il, bot0 + B)), ("bottom", "left"))
        br = prepare_corner_patch(crop_clamped(img, (ir + 1, bot0, ir + 1 + B, bot0 + B)), ("bottom", "right"))
    lef_e = trim_edge_strip(crop_clamped(img, (il - B, it, il, ib + 1)), "left")
    rig_e = trim_edge_strip(crop_clamped(img, (ir + 1, it, ir + 1 + B, ib + 1)), "right")

    paste_resized(out, tl, (0, 0, B, B))
    paste_resized(out, tr, (out_size - B, 0, out_size, B))
    paste_resized(out, bl, (0, out_size - B, B, out_size))
    paste_resized(out, br, (out_size - B, out_size - B, out_size, out_size))
    paste_resized(out, top_e, (B, 0, B + hole_size, B))
    paste_resized(out, bot_e, (B, out_size - B, B + hole_size, out_size))
    paste_resized(out, lef_e, (0, B, B, B + hole_size))
    paste_resized(out, rig_e, (out_size - B, B, out_size, B + hole_size))

    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG")
    return B


def load_catalog() -> dict:
    with open(FRAMES_JSON, encoding="utf-8") as f:
        return json.load(f)


def save_catalog(data: dict) -> None:
    with open(FRAMES_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def parse_categories(raw: str | None, code: str | None) -> list[str]:
    cats: list[str] = []
    if raw:
        cats = [c.strip() for c in raw.split(",") if c.strip()]
    if code and code in SERIES_CATEGORY:
        series_id = SERIES_CATEGORY[code]
        if series_id not in cats:
            cats.insert(0, series_id)
    return cats


def color_entry(color_name: str) -> dict:
    key = color_name.strip().lower()
    if key in COLOR_DEFAULTS:
        return COLOR_DEFAULTS[key]
    return {"id": slugify(color_name).replace("-", ""), "label": color_name.strip(), "hex": "#888888"}


def build_frame_entry(
    *,
    code: str | None,
    color_name: str | None,
    label: str | None,
    categories: list[str],
    thickness: int,
    default_mm: int,
    image_path: str,
) -> dict:
    if code and color_name:
        frame_id = f"{code} {color_name}"
        entry_label = label or frame_id
        return {
            "id": frame_id,
            "code": code,
            "colorName": color_name,
            "label": entry_label,
            "categories": categories,
            "thickness": thickness,
            "defaultMm": default_mm,
            "radius": 0,
            "image": image_path,
            "colors": [color_entry(color_name)],
        }

    name = label or "YENİ ÇERÇEVE"
    return {
        "id": name,
        "label": name,
        "categories": categories,
        "thickness": thickness,
        "defaultMm": default_mm,
        "radius": 0,
        "image": image_path,
        "colors": [],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Çerçeve PNG işle ve frames.json güncelle")
    parser.add_argument("--input", "-i", required=True, help="Kaynak PNG dosyası")
    parser.add_argument("--code", "-c", help='Seri kodu, örn. "FA 20"')
    parser.add_argument("--color", help="Renk adı, örn. gümüş")
    parser.add_argument("--label", "-l", help="Görünen etiket (opsiyonel)")
    parser.add_argument("--categories", help="Virgülle ayrılmış: fa20,metal,klasik")
    parser.add_argument("--default-mm", type=int, default=20, help="Varsayılan kalınlık mm")
    parser.add_argument("--output-name", help="Dosya adı (örn. fa-20-gumus.png)")
    parser.add_argument("--thickness", type=int, help="Nine-slice kalınlığı (px); verilmezse otomatik tespit")
    parser.add_argument("--update-only", action="store_true", help="Sadece mevcut kaydın PNG/thickness güncelle")
    parser.add_argument(
        "--flat",
        action="store_true",
        help="Nine-slice parçalama yok; kaynak profili düz PNG olarak kaydet (41 lik vb.)",
    )
    args = parser.parse_args()

    src = Path(args.input).resolve()
    if not src.exists():
        raise SystemExit(f"Dosya bulunamadı: {src}")

    if args.output_name:
        filename = args.output_name
    else:
        filename = output_filename(args.code, args.color, src.stem)

    dest = FRAMES_DIR / filename
    if args.flat:
        thickness = process_frame_flat(src, dest)
    else:
        thickness = process_frame_png(src, dest, force_thickness=args.thickness)
    image_url = f"/frames/{filename}"

    catalog = load_catalog()
    categories = parse_categories(args.categories, args.code)
    entry = build_frame_entry(
        code=args.code,
        color_name=args.color,
        label=args.label,
        categories=categories,
        thickness=thickness,
        default_mm=args.default_mm,
        image_path=image_url,
    )

    frames = catalog.get("frames", [])
    existing_idx = next((i for i, f in enumerate(frames) if f.get("id") == entry["id"]), None)

    if args.update_only:
        if existing_idx is None:
            raise SystemExit(f'Kayıt bulunamadı: {entry["id"]}')
        frames[existing_idx]["thickness"] = thickness
        frames[existing_idx]["image"] = image_url
        print(f"Güncellendi: {entry['id']} → thickness={thickness}")
    elif existing_idx is not None:
        frames[existing_idx] = entry
        print(f"Mevcut kayıt yenilendi: {entry['id']}")
    else:
        frames.append(entry)
        print(f"Yeni kayıt eklendi: {entry['id']}")

    catalog["frames"] = frames
    save_catalog(catalog)
    print(f"PNG: {dest}")
    print(f"JSON: {FRAMES_JSON}")


if __name__ == "__main__":
    main()
