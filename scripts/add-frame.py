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

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
FRAMES_JSON = ROOT / "src" / "data" / "frames.json"
FRAMES_DIR = ROOT / "public" / "frames"
PREVIEWS_DIR = FRAMES_DIR / "previews"

COLOR_DEFAULTS: dict[str, dict] = {
    "gumus": {"id": "gumus", "label": "Gümüş", "hex": "#D8DCDC"},
    "gümüş": {"id": "gumus", "label": "Gümüş", "hex": "#D8DCDC"},
    "ceviz": {"id": "ceviz", "label": "Ceviz", "hex": "#5C4A3A"},
    "düz ceviz": {"id": "duz-ceviz", "label": "Düz Ceviz", "hex": "#5C4A3A"},
    "duz ceviz": {"id": "duz-ceviz", "label": "Düz Ceviz", "hex": "#5C4A3A"},
    "siyah": {"id": "siyah", "label": "Siyah", "hex": "#1a1a1a"},
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
    "bej": {"id": "bej", "label": "Bej", "hex": "#C4A882"},
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
    "oksit altın": {"id": "oksit-altin", "label": "Oksit Altın", "hex": "#B8956A"},
    "oksit altin": {"id": "oksit-altin", "label": "Oksit Altın", "hex": "#B8956A"},
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
    "30 luk Ağaç Kabuğu": "30luk-agac-kabugu",
    "30 luk ağaç kabuğu": "30luk-agac-kabugu",
    "46 d": "46d",
    "46 D": "46d",
    "30 d 91": "30d91",
    "F30 D91": "f30d91",
    "f30 d91": "f30d91",
    "F30 Düz": "f30duz",
    "f30 düz": "f30duz",
    "f30 duz": "f30duz",
    "35 lik": "35lik",
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
        if brightness > 250:
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


def is_solid_outer_rim(r: int, g: int, b: int, a: int) -> bool:
    """Dış kenardaki nötr açık gri/beyaz şerit — çerçeve yüzeyi değil."""
    if a < 50:
        return True
    if is_outer_void(r, g, b, a):
        return True
    br = (r + g + b) / 3
    spread = max(r, g, b) - min(r, g, b)
    if br > 225 and spread < 20:
        return True
    return False


def is_outer_face_pixel(r: int, g: int, b: int, a: int) -> bool:
    return is_frame_pixel(r, g, b, a) and not is_solid_outer_rim(r, g, b, a)


def is_outer_void(r: int, g: int, b: int, a: int) -> bool:
    """Fotoğraf kenarındaki siyah veya beyaz boş alan."""
    if a < 50:
        return True
    brightness = (r + g + b) / 3
    if brightness < 28 and a > 100:
        return True
    return is_solid_background(r, g, b, a) and brightness > 200


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
    while bottom > ib:
        voids = sum(
            1
            for x in range(il, ir + 1)
            if is_outer_void(*px[x, bottom]) or is_hole_pixel(*px[x, bottom])
        )
        if voids < span_h * 0.5:
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
        xs = list(range(max(0, il - rail_w), il + 1)) + list(range(ir, min(w, ir + rail_w + 1)))
        return any(is_frame_pixel(*px[x, y]) for x in xs)

    def row_bottom_rail_span(y: int) -> float:
        span = ir - il + 1
        if span <= 0:
            return 0.0
        n = sum(1 for x in range(il, ir + 1) if is_frame_pixel(*px[x, y]))
        return n / span

    def col_has_rail(x: int) -> bool:
        ys = range(max(0, it - rail_w), min(h, ib + rail_w + 1))
        return any(is_frame_pixel(*px[x, y]) for y in ys)

    top = 0
    while top < it and not row_has_rail(top):
        top += 1

    bottom = h - 1
    while bottom > ib and row_bottom_rail_span(bottom) < 0.2:
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


def sample_frame_rail_brightness(
    px, w: int, h: int, il: int, it: int, ir: int, ib: int
) -> float:
    """Çerçeve gövdesinin tipik parlaklığı — mat şeridini ayırmak için."""
    samples: list[float] = []
    cy = (it + ib) // 2
    cx = (il + ir) // 2
    depth = max(4, min(il, it, w - 1 - ir, h - 1 - ib) // 3)
    for x in range(max(0, il - depth), il):
        if is_frame_pixel(*px[x, cy]):
            samples.append((px[x, cy][0] + px[x, cy][1] + px[x, cy][2]) / 3)
    for y in range(max(0, it - depth), it):
        if is_frame_pixel(*px[cx, y]):
            samples.append((px[cx, y][0] + px[cx, y][1] + px[cx, y][2]) / 3)
    for x in range(ir + 1, min(w, ir + 1 + depth)):
        if is_frame_pixel(*px[x, cy]):
            samples.append((px[x, cy][0] + px[x, cy][1] + px[x, cy][2]) / 3)
    for y in range(ib + 1, min(h, ib + 1 + depth)):
        if is_frame_pixel(*px[cx, y]):
            samples.append((px[cx, y][0] + px[cx, y][1] + px[cx, y][2]) / 3)
    return statistics.median(samples) if samples else 128.0


def is_mat_lip_pixel(
    r: int, g: int, b: int, a: int, frame_brightness: float | None = None
) -> bool:
    """İç kenardaki düz beyaz/gri mat karton — çerçeve iç beveli değil."""
    if a < 50:
        return False
    br = (r + g + b) / 3
    spread = max(r, g, b) - min(r, g, b)
    if spread >= 30:
        return False
    # Yalnızca neredeyse beyaz mat karton; çerçeve iç beveli korunsun
    return br > 242


def sample_outer_chroma(px, w: int, h: int, cx: int, it: int, ib: int) -> float:
    """Dış ray örneklerindeki renk doygunluğu — beyaz çerçeveyi ayırt etmek için."""
    spreads: list[float] = []
    for y in list(range(8, min(it - 20, 35))) + list(range(ib + 5, min(h, ib + 25))):
        if 0 <= y < h and px[cx, y][3] >= 30:
            r, g, b = px[cx, y][:3]
            spreads.append(float(max(r, g, b) - min(r, g, b)))
    return statistics.median(spreads) if spreads else 0.0


def expand_inner_neutral_bevel(
    px, w: int, h: int, il: int, it: int, ir: int, ib: int, max_scan: int = 18
) -> tuple[int, int, int, int]:
    """Renkli çerçevelerde delik kenarındaki gri-beyaz iç beveli delik say."""
    cx = (il + ir) // 2
    cy = (it + ib) // 2
    if sample_outer_chroma(px, w, h, cx, it, ib) < 25:
        return il, it, ir, ib
    if sample_frame_rail_brightness(px, w, h, il, it, ir, ib) > 170:
        return il, it, ir, ib

    def is_neutral_bevel(r: int, g: int, b: int, a: int) -> bool:
        if a < 50:
            return False
        spread = max(r, g, b) - min(r, g, b)
        br = (r + g + b) / 3
        return spread < 18 and br > 80

    y = it - 1
    scanned = 0
    while y >= 0 and scanned < max_scan:
        if is_neutral_bevel(*px[cx, y]):
            it = y
            y -= 1
            scanned += 1
        else:
            break

    y = ib + 1
    scanned = 0
    while y < h and scanned < max_scan:
        if is_neutral_bevel(*px[cx, y]):
            ib = y
            y += 1
            scanned += 1
        else:
            break

    x = il - 1
    scanned = 0
    while x >= 0 and scanned < max_scan:
        if is_neutral_bevel(*px[x, cy]):
            il = x
            x -= 1
            scanned += 1
        else:
            break

    x = ir + 1
    scanned = 0
    while x < w and scanned < max_scan:
        if is_neutral_bevel(*px[x, cy]):
            ir = x
            x += 1
            scanned += 1
        else:
            break

    return il, it, ir, ib


def _expand_side_to_groove(get_pixel, start: int, step: int, limit: int, max_scan: int) -> int:
    """Soluk iç dubayı deliğe kat; koyu oluk ilk görünür kenar kalsın."""
    coord = start + step
    eaten = 0
    last = start
    while eaten < max_scan:
        if (step < 0 and coord < limit) or (step > 0 and coord > limit):
            break
        r, g, b, a = get_pixel(coord)
        if a < 50:
            break
        br = (r + g + b) / 3
        if br <= 150:
            break
        last = coord
        coord += step
        eaten += 1
    return last


def expand_light_inner_lip(
    px, w: int, h: int, il: int, it: int, ir: int, ib: int, max_scan: int = 5
) -> tuple[int, int, int, int]:
    """Açık çerçevede fotoğrafın oturmadığı soluk dubayı delik say; 3D oluk kalsın."""
    if sample_frame_rail_brightness(px, w, h, il, it, ir, ib) <= 170:
        return il, it, ir, ib

    cx = (il + ir) // 2
    cy = (it + ib) // 2
    it = _expand_side_to_groove(lambda y: px[cx, y], it, -1, 0, max_scan)
    ib = _expand_side_to_groove(lambda y: px[cx, y], ib, 1, h - 1, max_scan)
    il = _expand_side_to_groove(lambda x: px[x, cy], il, -1, 0, max_scan)
    ir = _expand_side_to_groove(lambda x: px[x, cy], ir, 1, w - 1, max_scan)
    return il, it, ir, ib


def expand_hole_past_mat_lip(
    px, w: int, h: int, il: int, it: int, ir: int, ib: int, max_scan: int = 16
) -> tuple[int, int, int, int]:
    """Mat şeridini delik say; önizlemede iç boşluk kalmasın."""
    cx = (il + ir) // 2
    cy = (it + ib) // 2
    frame_br = sample_frame_rail_brightness(px, w, h, il, it, ir, ib)

    y = it - 1
    scanned = 0
    while y >= 0 and scanned < max_scan:
        if is_mat_lip_pixel(*px[cx, y], frame_br):
            it = y
            y -= 1
            scanned += 1
        else:
            break

    y = ib + 1
    scanned = 0
    while y < h and scanned < max_scan:
        if is_mat_lip_pixel(*px[cx, y], frame_br):
            ib = y
            y += 1
            scanned += 1
        else:
            break

    x = il - 1
    scanned = 0
    while x >= 0 and scanned < max_scan:
        if is_mat_lip_pixel(*px[x, cy], frame_br):
            il = x
            x -= 1
            scanned += 1
        else:
            break

    x = ir + 1
    scanned = 0
    while x < w and scanned < max_scan:
        if is_mat_lip_pixel(*px[x, cy], frame_br):
            ir = x
            x += 1
            scanned += 1
        else:
            break

    return il, it, ir, ib


def detect_hole_bounds(px, w: int, h: int) -> tuple[int, int, int, int]:
    cx, cy = w // 2, h // 2
    if px[cx, cy][3] < 30:
        return flood_hole_transparent(px, w, h, cx, cy)
    left, top, right, bottom = scan_hole_bounds(px, w, h, cx, cy)
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


def trim_outer_shadow_from_edge(patch: Image.Image, axis: str, max_trim: int = 5) -> Image.Image:
    """Dış kenardaki koyu gölge satır/sütunlarını at (en fazla birkaç piksel)."""
    out = patch
    for _ in range(max_trim):
        pw, ph = out.size
        if pw <= 1 or ph <= 1:
            break
        px = out.load()

        def row_avg(y: int) -> float:
            vals = [
                (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
                for x in range(pw)
                if px[x, y][3] > 50
            ]
            return sum(vals) / len(vals) if vals else 255.0

        def col_avg(x: int) -> float:
            vals = [
                (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
                for y in range(ph)
                if px[x, y][3] > 50
            ]
            return sum(vals) / len(vals) if vals else 255.0

        if axis == "bottom" and ph > 2:
            if row_avg(ph - 1) >= row_avg(ph - 2) - 1.5:
                break
            out = out.crop((0, 0, pw, ph - 1))
        elif axis == "top" and ph > 2:
            if row_avg(0) >= row_avg(1) - 1.5:
                break
            out = out.crop((0, 1, pw, ph))
        elif axis == "right" and pw > 2:
            if col_avg(pw - 1) >= col_avg(pw - 2) - 1.5:
                break
            out = out.crop((0, 0, pw - 1, ph))
        elif axis == "left" and pw > 2:
            if col_avg(0) >= col_avg(1) - 1.5:
                break
            out = out.crop((1, 0, pw, ph))
        else:
            break
    return out


def strip_output_outer_shadow(img: Image.Image, max_trim: int = 10) -> Image.Image:
    """Son PNG'den alt/sağdaki düşük gölge şeridini kırp."""
    out = img
    for _ in range(max_trim):
        pw, ph = out.size
        if pw <= 2 or ph <= 2:
            break
        px = out.load()
        trimmed = False

        def row_avg(y: int) -> float | None:
            vals = [
                (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
                for x in range(pw)
                if px[x, y][3] > 50
            ]
            return sum(vals) / len(vals) if vals else None

        def col_avg(x: int) -> float | None:
            vals = [
                (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
                for y in range(ph)
                if px[x, y][3] > 50
            ]
            return sum(vals) / len(vals) if vals else None

        ra, rb = row_avg(ph - 1), row_avg(ph - 2)
        if ra is not None and rb is not None and (
            ra < rb - 2 or (ra > rb + 1 and ra > 200)
        ):
            out = out.crop((0, 0, pw, ph - 1))
            trimmed = True

        pw, ph = out.size
        px = out.load()
        ca, cb = col_avg(pw - 1), col_avg(pw - 2)
        if ca is not None and cb is not None and (
            ca < cb - 2 or (ca > cb + 1 and ca > 200)
        ):
            out = out.crop((0, 0, pw - 1, ph))
            trimmed = True

        pw, ph = out.size
        px = out.load()
        ta, tb = row_avg(0), row_avg(1)
        if ta is not None and tb is not None and (
            ta < tb - 2 or (ta > tb + 1 and ta > 200)
        ):
            out = out.crop((0, 1, pw, ph))
            trimmed = True

        pw, ph = out.size
        px = out.load()
        la, lb = col_avg(0), col_avg(1)
        if la is not None and lb is not None and (
            la < lb - 2 or (la > lb + 1 and la > 200)
        ):
            out = out.crop((1, 0, pw, ph))
            trimmed = True

        if not trimmed:
            break
    return out


def strip_outer_corner_void(img: Image.Image, max_trim: int = 8) -> Image.Image:
    """Köşe uçlarındaki boş/gölge piksellerini kırp."""
    out = img
    for _ in range(max_trim):
        pw, ph = out.size
        if pw <= 2 or ph <= 2:
            break
        px = out.load()
        tips = [(0, 0), (pw - 1, 0), (0, ph - 1), (pw - 1, ph - 1)]
        if all(is_frame_pixel(*px[x, y]) for x, y in tips):
            break
        if not is_frame_pixel(*px[0, 0]) or not is_frame_pixel(*px[pw - 1, 0]):
            out = out.crop((0, 1, pw, ph))
            continue
        if not is_frame_pixel(*px[0, ph - 1]) or not is_frame_pixel(*px[pw - 1, ph - 1]):
            out = out.crop((0, 0, pw, ph - 1))
            continue
        if not is_frame_pixel(*px[0, 0]) or not is_frame_pixel(*px[0, ph - 1]):
            out = out.crop((1, 0, pw, ph))
            continue
        if not is_frame_pixel(*px[pw - 1, 0]) or not is_frame_pixel(*px[pw - 1, ph - 1]):
            out = out.crop((0, 0, pw - 1, ph))
    return out


def clear_inner_mat_lip_band(img: Image.Image, max_depth: int = 16) -> Image.Image:
    """Delik kenarındaki mat şeridini şeffaf yap."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    cx, cy = w // 2, h // 2

    il = 0
    while il < w and px[il, cy][3] >= 30:
        il += 1
    ir = w - 1
    while ir >= 0 and px[ir, cy][3] >= 30:
        ir -= 1
    it = 0
    while it < h and px[cx, it][3] >= 30:
        it += 1
    ib = h - 1
    while ib >= 0 and px[cx, ib][3] >= 30:
        ib -= 1

    frame_br = sample_frame_rail_brightness(px, w, h, il, it, ir, ib)

    # Açık/beyaz çerçevede mat temizliği rayları yer — koyu renklerde uygula
    if frame_br > 175:
        return out

    for y in range(it, ib + 1):
        for x in range(max(0, il - max_depth), il):
            if is_mat_lip_pixel(*px[x, y], frame_br):
                px[x, y] = (0, 0, 0, 0)
        for x in range(ir + 1, min(w, ir + 1 + max_depth)):
            if is_mat_lip_pixel(*px[x, y], frame_br):
                px[x, y] = (0, 0, 0, 0)
    for x in range(il, ir + 1):
        for y in range(max(0, it - max_depth), it):
            if is_mat_lip_pixel(*px[x, y], frame_br):
                px[x, y] = (0, 0, 0, 0)
        for y in range(ib + 1, min(h, ib + 1 + max_depth)):
            if is_mat_lip_pixel(*px[x, y], frame_br):
                px[x, y] = (0, 0, 0, 0)
    return out


def ensure_square_centered(img: Image.Image) -> Image.Image:
    """Nine-slice için kare ve ortalı çıktı."""
    w, h = img.size
    if w == h:
        return img
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def measure_output_thickness(img: Image.Image) -> int:
    px = img.load()
    w, h = img.size
    cx, cy = w // 2, h // 2

    def is_output_hole(r: int, g: int, b: int, a: int) -> bool:
        return a < 30

    il = 0
    while il < w and not is_output_hole(*px[il, cy]):
        il += 1
    ir = w - 1
    while ir >= 0 and not is_output_hole(*px[ir, cy]):
        ir -= 1
    it = 0
    while it < h and not is_output_hole(*px[cx, it]):
        it += 1
    ib = h - 1
    while ib >= 0 and not is_output_hole(*px[cx, ib]):
        ib -= 1
    rails = [il, it, w - 1 - ir, h - 1 - ib]
    return int(min(rails))


def trim_corner_tip_to_frame(patch: Image.Image, axes: tuple[str, ...]) -> Image.Image:
    """Köşe ucundaki boş veya beyaz arka plan piksellerini at."""
    out = patch
    for _ in range(max(out.width, out.height)):
        pw, ph = out.size
        if pw <= 1 or ph <= 1:
            break
        px = out.load()
        tx = 0 if "left" in axes else pw - 1
        ty = 0 if "top" in axes else ph - 1
        tip = px[tx, ty]
        if is_frame_pixel(*tip) and not is_solid_background(*tip):
            break
        if "top" in axes and ph > 1:
            out = out.crop((0, 1, pw, ph))
        elif "bottom" in axes and ph > 1:
            out = out.crop((0, 0, pw, ph - 1))
        pw, ph = out.size
        if pw <= 1 or ph <= 1:
            break
        px = out.load()
        tx = 0 if "left" in axes else pw - 1
        ty = 0 if "top" in axes else ph - 1
        tip = px[tx, ty]
        if is_frame_pixel(*tip) and not is_solid_background(*tip):
            break
        if "left" in axes and pw > 1:
            out = out.crop((1, 0, pw, ph))
        elif "right" in axes and pw > 1:
            out = out.crop((0, 0, pw - 1, ph))
    return out


def fix_assembly_corner_tips(img: Image.Image, max_search: int = 16) -> Image.Image:
    """Köşe ucundaki beyaz arka plan sızıntısını komşu çerçeve pikseliyle düzelt."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    tips = [
        (0, 0, 1, 1),
        (w - 1, 0, -1, 1),
        (0, h - 1, 1, -1),
        (w - 1, h - 1, -1, -1),
    ]
    for tx, ty, dx, dy in tips:
        if is_frame_pixel(*px[tx, ty]) and not is_solid_background(*px[tx, ty]):
            continue
        for step in range(1, max_search + 1):
            sx, sy = tx + dx * step, ty + dy * step
            if not (0 <= sx < w and 0 <= sy < h):
                break
            sample = px[sx, sy]
            if is_frame_pixel(*sample) and not is_solid_background(*sample):
                px[tx, ty] = sample
                break
    return out


def prepare_corner_patch(patch: Image.Image, axes: tuple[str, ...]) -> Image.Image:
    out = patch
    for axis in axes:
        out = trim_edge_strip(out, axis)
    out = trim_corner_tip_to_frame(out, axes)
    for axis in axes:
        out = trim_outer_shadow_from_edge(out, axis, max_trim=8)
    return out


def prepare_edge_strip(patch: Image.Image, axis: str) -> Image.Image:
    out = trim_edge_strip(patch, axis)
    if axis in ("bottom", "right"):
        out = trim_outer_shadow_from_edge(out, axis, max_trim=8)
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


def needs_bottom_profile_mirror(top_edge: Image.Image, bottom_edge: Image.Image) -> bool:
    """Alt kenarda dış oluk üsttekiyle aynı derinlikte değilse üst profili aynala."""
    top_center = outer_groove_center_offset(top_edge, "start")
    bot_center = outer_groove_center_offset(bottom_edge, "end")
    if top_center is None or bot_center is None:
        return False
    return bot_center < 8 and top_center >= 12


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


TARGET_SLICE_B = 110


def upscale_for_target_rail(
    img: Image.Image, il: int, it: int, ir: int, ib: int, target_b: int = TARGET_SLICE_B
) -> tuple[Image.Image, int, int, int, int]:
    """Kaynak rayları hedef kalınlığa yaklaştır; köşe germesini önle."""
    w, h = img.size
    px = img.load()
    bot0 = bottom_rail_start(px, w, h, il, ir, ib)
    rails = [il, it, w - 1 - ir, h - bot0]
    b_pre = statistics.median(rails)
    if b_pre <= 0 or b_pre >= target_b * 0.85:
        return img, il, it, ir, ib

    scale = target_b / b_pre
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    scaled = img.resize((new_w, new_h), Image.LANCZOS)
    px = scaled.load()
    il, it, ir, ib = detect_hole_bounds(px, new_w, new_h)
    return scaled, il, it, ir, ib


def clear_hole_interior(
    img: Image.Image, il: int, it: int, ir: int, ib: int
) -> Image.Image:
    """İç boşluğu tamamen şeffaf yap."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    for y in range(max(0, it), min(h, ib + 1)):
        for x in range(max(0, il), min(w, ir + 1)):
            px[x, y] = (0, 0, 0, 0)
    return out


def strip_outer_shadow_rim(img: Image.Image, max_trim: int = 6) -> Image.Image:
    """Dış kenardaki yumuşak gölge şeridini kırp (montaj yapmadan)."""
    out = img
    for _ in range(max_trim):
        pw, ph = out.size
        if pw <= 4 or ph <= 4:
            break
        px = out.load()
        trimmed = False

        def row_frame_ratio(y: int) -> float:
            n = sum(1 for x in range(pw) if is_frame_pixel(*px[x, y]))
            return n / pw

        def col_frame_ratio(x: int) -> float:
            n = sum(1 for y in range(ph) if is_frame_pixel(*px[x, y]))
            return n / ph

        if row_frame_ratio(ph - 1) < 0.35:
            out = out.crop((0, 0, pw, ph - 1))
            trimmed = True
        pw, ph = out.size
        px = out.load()
        if col_frame_ratio(pw - 1) < 0.35:
            out = out.crop((0, 0, pw - 1, ph))
            trimmed = True
        if not trimmed:
            break
    return out


def enhance_light_frame_grain(img: Image.Image) -> Image.Image:
    """Açık çerçevede kaynak rengi ve damarı koru; yalnızca hafif netlik."""
    px = img.load()
    w, h = img.size
    brs: list[float] = []
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            r, g, b, a = px[x, y]
            if a > 200:
                brs.append((r + g + b) / 3)
    if not brs or statistics.median(brs) <= 170:
        return img

    fill_br = int(statistics.median(brs))
    filled = img.copy()
    fpx = filled.load()
    for y in range(h):
        for x in range(w):
            if fpx[x, y][3] < 30:
                fpx[x, y] = (fill_br, fill_br, fill_br, 255)
    rgb = ImageEnhance.Sharpness(filled.convert("RGB")).enhance(1.12)
    final = rgb.convert("RGBA")
    final.putalpha(img.getchannel("A"))
    return final


def trim_asymmetric_rails(
    img: Image.Image, il: int, it: int, ir: int, ib: int
) -> tuple[Image.Image, int, int, int, int]:
    """Sol-sağ ve üst-alt ray farkını dış kırpım ile gider; dört kenarı eşitle."""
    out = img
    w, h = out.size
    left, right = il, w - 1 - ir
    top, bottom = it, h - 1 - ib

    if right > left:
        out = out.crop((0, 0, w - (right - left), h))
        w = out.width
        right = left
    elif left > right:
        d = left - right
        out = out.crop((d, 0, w, h))
        il -= d
        ir -= d
        w = out.width
        left = right

    top, bottom = it, h - 1 - ib
    if bottom > top:
        out = out.crop((0, 0, w, h - (bottom - top)))
        h = out.height
        bottom = top
    elif top > bottom:
        d = top - bottom
        out = out.crop((0, d, w, h))
        it -= d
        ib -= d
        h = out.height
        top = bottom

    left, right = il, w - 1 - ir
    top, bottom = it, h - 1 - ib
    m = min(left, right, top, bottom)
    crop_l = left - m
    crop_t = top - m
    crop_r = right - m
    crop_b = bottom - m
    if crop_l or crop_t or crop_r or crop_b:
        out = out.crop((crop_l, crop_t, w - crop_r, h - crop_b))
        il -= crop_l
        ir -= crop_l
        it -= crop_t
        ib -= crop_t

    return out, il, it, ir, ib


def process_frame_png(src: Path, dest: Path, force_thickness: int | None = None) -> int:
    """Kaynak fotoğraftaki doğal mitre köşeleri korunur — parça birleştirme yok."""
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
    raw_px = raw.load()
    il, it, ir, ib = expand_hole_past_mat_lip(raw_px, raw_w, raw_h, il, it, ir, ib)
    il, it, ir, ib = expand_inner_neutral_bevel(raw_px, raw_w, raw_h, il, it, ir, ib)
    il, it, ir, ib = expand_light_inner_lip(raw_px, raw_w, raw_h, il, it, ir, ib)
    raw, il, it, ir, ib = trim_asymmetric_rails(raw, il, it, ir, ib)

    out = clear_hole_interior(raw, il, it, ir, ib)
    out = clear_inner_mat_lip_band(out)
    out = strip_outer_shadow_rim(out)
    out = enhance_light_frame_grain(out)

    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG")
    if force_thickness is not None:
        return force_thickness
    return measure_output_thickness(out)


PREVIEW_SIDE = 320
PREVIEW_RAIL_RATIO = 0.22


def _measure_rails(img: Image.Image) -> tuple[int, int, int, int]:
    px = img.load()
    w, h = img.size
    cx, cy = w // 2, h // 2

    def is_hole(r: int, g: int, b: int, a: int) -> bool:
        return a < 30

    il = 0
    while il < w and not is_hole(*px[il, cy]):
        il += 1
    ir = w - 1
    while ir >= 0 and not is_hole(*px[ir, cy]):
        ir -= 1
    it = 0
    while it < h and not is_hole(*px[cx, it]):
        it += 1
    ib = h - 1
    while ib >= 0 and not is_hole(*px[cx, ib]):
        ib -= 1
    return il, it, w - 1 - ir, h - 1 - ib


def compose_square_preview(frame_img: Image.Image, side: int = PREVIEW_SIDE) -> Image.Image:
    """İşlenmiş çerçeveden 20 lik gibi kare, dört kenarlı swatch üretir."""
    sw, sh = frame_img.size
    left, top, right, bottom = _measure_rails(frame_img)
    if min(left, top, right, bottom) <= 0:
        cropped = crop_to_frame_content(frame_img)
        square = pad_to_square(cropped)
        return square.resize((side, side), Image.LANCZOS)

    t = max(12, round(side * PREVIEW_RAIL_RATIO))
    out = Image.new("RGBA", (side, side), (26, 26, 26, 255))

    def blit(sx: int, sy: int, sW: int, sH: int, dx: int, dy: int, dW: int, dH: int, resample=Image.LANCZOS) -> None:
        if sW <= 0 or sH <= 0 or dW <= 0 or dH <= 0:
            return
        patch = frame_img.crop((sx, sy, sx + sW, sy + sH)).resize((dW, dH), resample)
        out.paste(patch, (dx, dy), patch)

    blit(left, 0, sw - left - right, top, t, 0, side - 2 * t, t)
    blit(left, sh - bottom, sw - left - right, bottom, t, side - t, side - 2 * t, t)
    blit(0, top, left, sh - top - bottom, 0, t, t, side - 2 * t)
    blit(sw - right, top, right, sh - top - bottom, side - t, t, t, side - 2 * t)
    blit(0, 0, left, top, 0, 0, t, t, Image.NEAREST)
    blit(sw - right, 0, right, top, side - t, 0, t, t, Image.NEAREST)
    blit(0, sh - bottom, left, bottom, 0, side - t, t, t, Image.NEAREST)
    blit(sw - right, sh - bottom, right, bottom, side - t, side - t, t, t, Image.NEAREST)
    return out


def save_preview_image(src: Path, filename: str) -> str:
    """İşlenmiş çerçeveden kare, belirgin swatch önizlemesi."""
    PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
    preview_name = f"{Path(filename).stem}-preview.png"
    preview_path = PREVIEWS_DIR / preview_name

    img = Image.open(src).convert("RGBA")
    compose_square_preview(img).save(preview_path, "PNG")
    return f"/frames/previews/{preview_name}"


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
    preview_image_path: str | None = None,
) -> dict:
    if code and color_name:
        frame_id = f"{code} {color_name}"
        entry_label = label or frame_id
        entry = {
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
        if preview_image_path:
            entry["previewImage"] = preview_image_path
        return entry

    name = label or "YENİ ÇERÇEVE"
    entry = {
        "id": name,
        "label": name,
        "categories": categories,
        "thickness": thickness,
        "defaultMm": default_mm,
        "radius": 0,
        "image": image_path,
        "colors": [],
    }
    if preview_image_path:
        entry["previewImage"] = preview_image_path
    return entry


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
    args = parser.parse_args()

    src = Path(args.input).resolve()
    if not src.exists():
        raise SystemExit(f"Dosya bulunamadı: {src}")

    if args.output_name:
        filename = args.output_name
    else:
        filename = output_filename(args.code, args.color, src.stem)

    dest = FRAMES_DIR / filename
    thickness = process_frame_png(src, dest, force_thickness=args.thickness)
    image_url = f"/frames/{filename}"
    preview_url = save_preview_image(dest, filename)

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
        preview_image_path=preview_url,
    )

    frames = catalog.get("frames", [])
    existing_idx = next((i for i, f in enumerate(frames) if f.get("id") == entry["id"]), None)

    if args.update_only:
        if existing_idx is None:
            raise SystemExit(f'Kayıt bulunamadı: {entry["id"]}')
        frames[existing_idx]["thickness"] = thickness
        frames[existing_idx]["image"] = image_url
        frames[existing_idx]["previewImage"] = preview_url
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
