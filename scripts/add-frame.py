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
    "ceviz gümüş": {"id": "ceviz-gumus", "label": "Ceviz Gümüş", "hex": "#4A3A32"},
    "ceviz gumus": {"id": "ceviz-gumus", "label": "Ceviz Gümüş", "hex": "#4A3A32"},
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
    "gri": {"id": "gri", "label": "Gri", "hex": "#6B7280"},
    "bronz": {"id": "bronz", "label": "Bronz", "hex": "#8C6A3F"},
    "bakır": {"id": "bakir", "label": "Bakır", "hex": "#B87333"},
    "bakir": {"id": "bakir", "label": "Bakır", "hex": "#B87333"},
    "eskitme altın": {"id": "eskitme-altin", "label": "Eskitme Altın", "hex": "#A67C52"},
    "eskitme altin": {"id": "eskitme-altin", "label": "Eskitme Altın", "hex": "#A67C52"},
    "yeşil eskitme": {"id": "yesileskitme", "label": "Yeşil Eskitme", "hex": "#3D6B5C"},
    "yesil eskitme": {"id": "yesileskitme", "label": "Yeşil Eskitme", "hex": "#3D6B5C"},
    "mavi eskitme": {"id": "mavieskitme", "label": "Mavi Eskitme", "hex": "#5A6A78"},
    "kahve eskitme": {"id": "kahveeskitme", "label": "Kahve Eskitme", "hex": "#3D2A1F"},
    "gümüş eskitme": {"id": "gumuseskitme", "label": "Gümüş Eskitme", "hex": "#8A8580"},
    "gumus eskitme": {"id": "gumuseskitme", "label": "Gümüş Eskitme", "hex": "#8A8580"},
    "gümüş ceviz": {"id": "gumusceviz", "label": "Gümüş Ceviz", "hex": "#8A7B6E"},
    "gumus ceviz": {"id": "gumusceviz", "label": "Gümüş Ceviz", "hex": "#8A7B6E"},
    "kahve altın": {"id": "kahvealtin", "label": "Kahve Altın", "hex": "#6B4A30"},
    "kahve altin": {"id": "kahvealtin", "label": "Kahve Altın", "hex": "#6B4A30"},
    "antik bronz": {"id": "antik-bronz", "label": "Antik Bronz", "hex": "#6E4E32"},
}

SERIES_CATEGORY = {
    "FA 20": "fa20",
    "FA 22": "fa22",
    "FA 30": "fa30",
    "FA 40": "fa40",
    "29 D": "29d",
    "29 KR": "29krduz",
    "29 KR Düz": "29krduz",
    "29 kr düz": "29krduz",
    "29 kr duz": "29krduz",
    "FA 29 KR": "29krduz",
    "28 KR Boncuklu": "28krboncuklu",
    "28 KR": "28krboncuklu",
    "28 kr boncuklu": "28krboncuklu",
    "28 kr": "28krboncuklu",
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
    "46 Ağaç Kabuğu": "46-agac-kabugu",
    "46 ağaç kabuğu": "46-agac-kabugu",
    "30 d 91": "30d91",
    "F30 D91": "f30d91",
    "f30 d91": "f30d91",
    "F30 Düz": "f30duz",
    "f30 düz": "f30duz",
    "f30 duz": "f30duz",
    "35 lik": "35lik",
    "35 L": "35l",
    "35 l": "35l",
    "34 L": "34l",
    "34 l": "34l",
    "47 L": "47l",
    "47 l": "47l",
    "FA 41": "fa41",
    "fa 41": "fa41",
    "Fa 41": "fa41",
    "FA 52": "fa52",
    "fa 52": "fa52",
    "Fa 52": "fa52",
}


def slugify(text: str) -> str:
    text = (
        str(text)
        .replace("ı", "i")
        .replace("İ", "i")
        .replace("ş", "s")
        .replace("Ş", "s")
        .replace("ğ", "g")
        .replace("Ğ", "g")
        .replace("ü", "u")
        .replace("Ü", "u")
        .replace("ö", "o")
        .replace("Ö", "o")
        .replace("ç", "c")
        .replace("Ç", "c")
    )
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
        if brightness > 248:
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
        if is_true_hole_seed(*px[cx, cy]):
            return flood_hole_bounds(px, w, h, cx, cy)
        return left, top, right, bottom
    if max(rails) - min(rails) > 12 and is_true_hole_seed(*px[cx, cy]):
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

    def rail_width(start: int, end: int, step: int, sample) -> int:
        i = start
        while (step > 0 and i < end) or (step < 0 and i > end):
            if not is_output_hole(*sample(i)):
                break
            i += step
        begin = i
        while (step > 0 and i < end) or (step < 0 and i > end):
            if is_output_hole(*sample(i)):
                break
            i += step
        return abs(i - begin)

    rails = [
        rail_width(0, w, 1, lambda x: px[x, cy]),
        rail_width(w - 1, -1, -1, lambda x: px[x, cy]),
        rail_width(0, h, 1, lambda y: px[cx, y]),
        rail_width(h - 1, -1, -1, lambda y: px[cx, y]),
    ]
    usable = [r for r in rails if r >= 8]
    if not usable:
        return int(min(rails)) if rails else 0
    return int(min(usable))


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


def _color_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def _median_i(values: list[int]) -> int:
    s = sorted(values)
    return s[(len(s) - 1) // 2]


def _px_br(p: tuple[int, int, int]) -> float:
    return (p[0] + p[1] + p[2]) / 3.0


def _px_spread(p: tuple[int, int, int]) -> int:
    return max(p[0], p[1], p[2]) - min(p[0], p[1], p[2])


def _px_warmth(p: tuple[int, int, int]) -> int:
    return p[0] + p[1] - 2 * p[2]


def _is_studio_frame_body(p: tuple[int, int, int], center: tuple[int, int, int]) -> bool:
    """Koyu iç oluk, boyalı/ahşap yüz veya krem (sıcak) açık çerçeve."""
    br = _px_br(p)
    spread = _px_spread(p)
    if br < 135:
        return True
    if spread > 22:
        return True
    warmth = _px_warmth(p)
    center_w = _px_warmth(center)
    return br > 165 and warmth > center_w + 12 and spread >= 8


def _is_studio_insert(p: tuple[int, int, int], center: tuple[int, int, int]) -> bool:
    """İç karton/duvar: nötr gri-beyaz. Krem çerçeve yüzünü insert sayma."""
    if _is_studio_frame_body(p, center):
        return False
    spread = _px_spread(p)
    if spread > 16:
        return False
    br, cbr = _px_br(p), _px_br(center)
    if _color_dist(p, center) < 22:
        return True
    return br >= 155 and spread < 14 and abs(br - cbr) < 60


def _is_studio_wall_pixel(p: tuple[int, int, int], wall: tuple[int, int, int], center: tuple[int, int, int]) -> bool:
    if _is_studio_frame_body(p, center):
        return False
    if _px_spread(p) > 14 or _px_warmth(p) > _px_warmth(center) + 8:
        return False
    if _color_dist(p, wall) < 14:
        return True
    return _px_spread(p) < 10 and abs(_px_br(p) - _px_br(wall)) < 18


def _is_studio_drop_shadow(p: tuple[int, int, int], wall: tuple[int, int, int], center: tuple[int, int, int]) -> bool:
    if _is_studio_frame_body(p, center):
        return False
    if _px_spread(p) > 10 or _px_warmth(p) > _px_warmth(center) + 4:
        return False
    br, wbr = _px_br(p), _px_br(wall)
    return wbr - 60 <= br <= wbr - 20 and abs(p[0] - p[1]) < 8 and abs(p[1] - p[2]) < 10


def _sample_centerish_wall(px, w: int, h: int, side: str, center: tuple[int, int, int]):
    samples: list[tuple[int, int, int]] = []
    if side == "left":
        coords = ((x, y) for y in range(2, h - 2, 2) for x in range(1, min(9, w // 25 + 2)))
    elif side == "right":
        coords = ((x, y) for y in range(2, h - 2, 2) for x in range(w - 2, max(w - 10, w * 19 // 20), -1))
    elif side == "top":
        coords = ((x, y) for x in range(2, w - 2, 2) for y in range(1, min(9, h // 25 + 2)))
    else:
        coords = ((x, y) for x in range(2, w - 2, 2) for y in range(h - 2, max(h - 10, h * 19 // 20), -1))
    for x, y in coords:
        p = px[x, y][:3]
        if _is_studio_frame_body(p, center):
            continue
        if _color_dist(p, center) < 42 and _px_spread(p) < 18:
            samples.append(p)
    if len(samples) < 6:
        return None
    return _median_rgb(samples)


def _scan_studio_inner(px, x: int, y: int, dx: int, dy: int, w: int, h: int, center: tuple[int, int, int]) -> int | None:
    """İç kartonu atla; fotoğrafın oturacağı koyu iç dudağı (yoksa çerçeve yüzünü) bul."""
    while 0 < x < w - 1 and 0 < y < h - 1:
        x += dx
        y += dy
        p = px[x, y][:3]
        if _is_studio_insert(p, center):
            continue
        break
    else:
        return None

    first_body: int | None = None
    sx, sy = x, y
    for _ in range(42):
        if not (1 <= sx < w - 1 and 1 <= sy < h - 1):
            break
        q = px[sx, sy][:3]
        coord = sx if dx else sy
        if _px_br(q) < 125:
            return coord
        if first_body is None and _is_studio_frame_body(q, center):
            first_body = coord
        sx += dx
        sy += dy
    if first_body is not None:
        return first_body
    return x if dx else y


def _scan_studio_outer(px, x: int, y: int, dx: int, dy: int, w: int, h: int, wall, center: tuple[int, int, int]) -> int | None:
    if wall is None:
        return None
    last = x if dx else y
    wall_run = 0
    shadow_run = 0
    while 0 < x < w - 1 and 0 < y < h - 1:
        x += dx
        y += dy
        coord = x if dx else y
        p = px[x, y][:3]
        if _is_studio_wall_pixel(p, wall, center):
            wall_run += 1
            shadow_run = 0
            if wall_run >= 3:
                return last
        elif _is_studio_drop_shadow(p, wall, center):
            shadow_run += 1
            wall_run = 0
            if shadow_run >= 3:
                return last
        else:
            wall_run = 0
            shadow_run = 0
            last = coord
    return None


def _pick_studio_rail(raw: list[int]) -> int | None:
    valid = [r for r in raw if r >= 24]
    if not valid:
        return None
    valid = sorted(valid)
    lo = valid[(len(valid) - 1) // 2]
    tight = [r for r in valid if r <= lo * 1.18]
    if len(tight) >= 2:
        return tight[(len(tight) - 1) // 2]
    return lo


def _looks_like_insert_or_wall(p: tuple[int, int, int], center: tuple[int, int, int]) -> bool:
    if _is_studio_frame_body(p, center):
        return False
    return _is_studio_insert(p, center)


def peel_outer_studio_wall(img: Image.Image, center: tuple[int, int, int], max_peel: int = 12) -> Image.Image:
    """Kenarın ortası duvar ise o satırı/sütunu kırp; krem çerçeve yüzüne girme."""
    out = img
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 40 or h < 40:
            break

        def mid_edge_wall(side: str) -> bool:
            if side == "top":
                samples = [px[x, 0] for x in range(w // 4, (3 * w) // 4, 2)]
            elif side == "bottom":
                samples = [px[x, h - 1] for x in range(w // 4, (3 * w) // 4, 2)]
            elif side == "left":
                samples = [px[0, y] for y in range(h // 4, (3 * h) // 4, 2)]
            else:
                samples = [px[w - 1, y] for y in range(h // 4, (3 * h) // 4, 2)]
            n = len(samples)
            if n < 6:
                return False
            wallish = 0
            body = 0
            for r, g, b, a in samples:
                if a < 30:
                    wallish += 1
                    continue
                p = (r, g, b)
                if _is_studio_frame_body(p, center):
                    body += 1
                elif _is_studio_insert(p, center):
                    wallish += 1
            return wallish >= n * 0.75 and body <= n * 0.08

        cropped = False
        if mid_edge_wall("top"):
            out = out.crop((0, 1, w, h))
            cropped = True
        elif mid_edge_wall("bottom"):
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        elif mid_edge_wall("left"):
            out = out.crop((1, 0, w, h))
            cropped = True
        elif mid_edge_wall("right"):
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        if not cropped:
            break
    return out


def clear_corner_studio_wall(img: Image.Image, center: tuple[int, int, int], max_depth: int = 22) -> Image.Image:
    """Köşede kalan duvar üçgenini sil; çerçeve gövdesinde dur."""
    w, h = img.size
    px = img.load()
    corners = ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))
    vis = bytearray(w * h)
    q: deque[tuple[int, int, int, int]] = deque()
    for cx0, cy0 in corners:
        r, g, b, a = px[cx0, cy0]
        if a < 30:
            continue
        p = (r, g, b)
        if _is_studio_frame_body(p, center) or not _is_studio_insert(p, center):
            continue
        vis[cy0 * w + cx0] = 1
        q.append((cx0, cy0, cx0, cy0))
    if not q:
        return img
    out = img.copy()
    opx = out.load()
    while q:
        x, y, ox, oy = q.popleft()
        if abs(x - ox) + abs(y - oy) > max_depth:
            continue
        r, g, b, a = opx[x, y]
        if a >= 30:
            opx[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            i = ny * w + nx
            if vis[i]:
                continue
            nr, ng, nb, na = opx[nx, ny]
            if na < 30:
                vis[i] = 1
                q.append((nx, ny, ox, oy))
                continue
            npx = (nr, ng, nb)
            if _is_studio_frame_body(npx, center):
                vis[i] = 1
                continue
            if _is_studio_insert(npx, center):
                vis[i] = 1
                q.append((nx, ny, ox, oy))
    return out


def expand_hole_through_insert(img: Image.Image, center: tuple[int, int, int]) -> Image.Image:
    """İçteki kalan duvar/karton bandını deliğe katar; çerçeve gövdesine dokunmaz."""
    w, h = img.size
    px = img.load()
    vis = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for y in range(h):
        row = y * w
        for x in range(w):
            if px[x, y][3] < 30:
                vis[row + x] = 1
                q.append((x, y))
    if not q:
        return img
    out = img.copy()
    opx = out.load()
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            i = ny * w + nx
            if vis[i]:
                continue
            r, g, b, a = opx[nx, ny]
            if a < 30:
                vis[i] = 1
                q.append((nx, ny))
                continue
            if _looks_like_insert_or_wall((r, g, b), center):
                vis[i] = 1
                opx[nx, ny] = (0, 0, 0, 0)
                q.append((nx, ny))
    return out


def clear_outer_studio_wall(img: Image.Image, center: tuple[int, int, int]) -> Image.Image:
    """Dış kenardaki gri duvar ve gölgeyi sil; çerçeve malzemesini bırak."""
    w, h = img.size
    px = img.load()
    seeds: list[tuple[int, int]] = []
    for x in range(w):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(h):
        seeds.append((0, y))
        seeds.append((w - 1, y))
    vis = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for sx, sy in seeds:
        r, g, b, a = px[sx, sy]
        if a < 30:
            continue
        if not _looks_like_insert_or_wall((r, g, b), center):
            continue
        i = sy * w + sx
        if vis[i]:
            continue
        vis[i] = 1
        q.append((sx, sy))
    if not q:
        return img
    out = img.copy()
    opx = out.load()
    while q:
        x, y = q.popleft()
        r, g, b, a = opx[x, y]
        if a >= 30:
            opx[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            i = ny * w + nx
            if vis[i]:
                continue
            nr, ng, nb, na = opx[nx, ny]
            if na < 30 or _looks_like_insert_or_wall((nr, ng, nb), center):
                vis[i] = 1
                q.append((nx, ny))
    return out


def dilate_opaque_into_hole(img: Image.Image, radius: int = 2) -> Image.Image:
    """Ölçeklerken şeffaf delikle karışan silik kenarı önlemek için dudağı 1–2 px içeri yay."""
    out = img.convert("RGBA")
    for _ in range(max(0, radius)):
        px = out.load()
        w, h = out.size
        nxt = out.copy()
        npx = nxt.load()
        for y in range(h):
            for x in range(w):
                if px[x, y][3] >= 30:
                    continue
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] >= 30:
                        npx[x, y] = px[nx, ny]
                        break
        out = nxt
    return out


def peel_dark_alias_outer(img: Image.Image, max_peel: int = 4) -> Image.Image:
    """Beyaz kare: dıştaki 1 px siyah alias tırtıklanmasın."""
    out = img.convert("RGBA")
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 80 or h < 80:
            break
        cx, cy = w // 2, h // 2

        def dark_fringe(x: int, y: int) -> bool:
            r, g, b, a = px[x, y]
            if a < 30:
                return True
            br = (r + g + b) / 3
            spr = max(r, g, b) - min(r, g, b)
            return br < 48 and spr < 22

        left = dark_fringe(0, cy)
        right = dark_fringe(w - 1, cy)
        top = dark_fringe(cx, 0)
        bot = dark_fringe(cx, h - 1)
        if not (left or right or top or bot):
            break
        l = 1 if left else 0
        t = 1 if top else 0
        rgt = (w - 1) if right else w
        boty = (h - 1) if bot else h
        if rgt - l < 60 or boty - t < 60:
            break
        out = out.crop((l, t, rgt, boty))
    return out


def peel_until_light_outer(img: Image.Image, min_br: float = 140, max_peel: int = 8) -> Image.Image:
    """Mat beyaz: dıştaki koyu JPEG aliasını at, gerçek açık pahla başla."""
    out = img.convert("RGBA")
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 80 or h < 80:
            break
        ys = (h // 8, h // 4, h // 2, (3 * h) // 4, (7 * h) // 8)
        xs = (w // 8, w // 4, w // 2, (3 * w) // 4, (7 * w) // 8)

        def too_dark(edge_x: int | None, edge_y: int | None) -> bool:
            darkest = 255.0
            if edge_x is not None:
                pts = ((edge_x, y) for y in ys)
            else:
                pts = ((x, edge_y) for x in xs)
            for x, y in pts:
                r, g, b, a = px[x, y]
                br = 0.0 if a < 30 else (r + g + b) / 3
                if br < darkest:
                    darkest = br
            return darkest < min_br

        left = too_dark(0, None)
        right = too_dark(w - 1, None)
        top = too_dark(None, 0)
        bot = too_dark(None, h - 1)
        if not (left or right or top or bot):
            break
        l = 1 if left else 0
        t = 1 if top else 0
        rgt = (w - 1) if right else w
        boty = (h - 1) if bot else h
        if rgt - l < 60 or boty - t < 60:
            break
        out = out.crop((l, t, rgt, boty))
    return out


def heal_dark_outer_edge(img: Image.Image, min_br: float = 150, depth: int = 3) -> Image.Image:
    """Dış kenardaki koyu aliası içeri doğru açık pah rengine boya — tırtık olmasın."""
    out = img.convert("RGBA")
    px = out.load()
    w, h = out.size

    def ok(p: tuple[int, int, int, int]) -> bool:
        return p[3] >= 30 and (p[0] + p[1] + p[2]) / 3 >= min_br

    def heal(x: int, y: int, dx: int, dy: int) -> None:
        p = px[x, y]
        if p[3] < 30 or (p[0] + p[1] + p[2]) / 3 >= min_br:
            return
        for s in range(1, 8):
            nx, ny = x + dx * s, y + dy * s
            if not (0 <= nx < w and 0 <= ny < h):
                return
            q = px[nx, ny]
            if ok(q):
                px[x, y] = q
                return

    for y in range(h):
        for k in range(depth):
            heal(k, y, 1, 0)
            heal(w - 1 - k, y, -1, 0)
    for x in range(w):
        for k in range(depth):
            heal(x, k, 0, 1)
            heal(x, h - 1 - k, 0, -1)
    return out


def snap_inner_dark_alias(img: Image.Image, thresh: float = 58) -> Image.Image:
    """İç kenardaki 1 px siyah aliası bir içteki pah rengine çek."""
    out = img.convert("RGBA")
    px = out.load()
    w, h = out.size
    cx, cy = w // 2, h // 2

    def is_hole(x: int, y: int) -> bool:
        return px[x, y][3] < 30

    il = 0
    while il < w and not is_hole(il, cy):
        il += 1
    ir = w - 1
    while ir >= 0 and not is_hole(ir, cy):
        ir -= 1
    it = 0
    while it < h and not is_hole(cx, it):
        it += 1
    ib = h - 1
    while ib >= 0 and not is_hole(cx, ib):
        ib -= 1
    if ir <= il + 20 or ib <= it + 20:
        return out

    def dark(p: tuple[int, int, int, int]) -> bool:
        return p[3] >= 30 and (p[0] + p[1] + p[2]) / 3 < thresh

    if il > 0:
        for y in range(it, ib + 1):
            if dark(px[il - 1, y]) and px[max(0, il - 2), y][3] >= 30:
                px[il - 1, y] = px[il - 2, y]
    if ir < w - 1:
        for y in range(it, ib + 1):
            if dark(px[ir + 1, y]) and px[min(w - 1, ir + 2), y][3] >= 30:
                px[ir + 1, y] = px[ir + 2, y]
    if it > 0:
        for x in range(il, ir + 1):
            if dark(px[x, it - 1]) and px[x, max(0, it - 2)][3] >= 30:
                px[x, it - 1] = px[x, it - 2]
    if ib < h - 1:
        for x in range(il, ir + 1):
            if dark(px[x, ib + 1]) and px[x, min(h - 1, ib + 2)][3] >= 30:
                px[x, ib + 1] = px[x, ib + 2]
    return out


def extract_matte_white_on_black(img: Image.Image) -> Image.Image:
    """Siyah fondaki mat beyaz kare: flood delik/fon, koyu dış alias yok."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def is_void(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 30:
            return True
        br = (r + g + b) / 3
        spr = max(r, g, b) - min(r, g, b)
        return br < 32 and spr < 12

    vis = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for sx, sy in (
        (cx, cy),
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (cx, 0),
        (cx, h - 1),
        (0, cy),
        (w - 1, cy),
    ):
        if 0 <= sx < w and 0 <= sy < h and is_void(sx, sy) and not vis[sy * w + sx]:
            vis[sy * w + sx] = 1
            q.append((sx, sy))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            i = ny * w + nx
            if 0 <= nx < w and 0 <= ny < h and not vis[i] and is_void(nx, ny):
                vis[i] = 1
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if vis[row + x]:
                continue
            r, g, b, _a = px[x, y]
            opx[x, y] = (r, g, b, 255)

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    out = peel_until_light_outer(out, min_br=140, max_peel=8)

    px = out.load()
    w, h = out.size
    cx, cy = w // 2, h // 2

    def trans(x: int, y: int) -> bool:
        return px[x, y][3] < 30

    top = 0
    while top < h and trans(cx, top):
        top += 1
    bot = h - 1
    while bot >= 0 and trans(cx, bot):
        bot -= 1
    left = 0
    while left < w and trans(left, cy):
        left += 1
    right = w - 1
    while right >= 0 and trans(right, cy):
        right -= 1
    if left < right and top < bot:
        out = out.crop((left, top, right + 1, bot + 1))

    out = heal_dark_outer_edge(out)
    out = snap_inner_dark_alias(out, thresh=90)
    out = dilate_opaque_into_hole(out, 1)
    rgb = ImageEnhance.Sharpness(out.convert("RGB")).enhance(1.12)
    alpha = out.getchannel("A")
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def extract_opaque_on_black(img: Image.Image) -> Image.Image:
    """Siyah fon/delikli kare: çerçeve birebir; dış peel ve iç snap yok."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def is_void(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 30:
            return True
        br = (r + g + b) / 3
        spr = max(r, g, b) - min(r, g, b)
        return br < 24 and spr < 12

    vis = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for sx, sy in (
        (cx, cy),
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (cx, 0),
        (cx, h - 1),
        (0, cy),
        (w - 1, cy),
    ):
        if 0 <= sx < w and 0 <= sy < h and is_void(sx, sy) and not vis[sy * w + sx]:
            vis[sy * w + sx] = 1
            q.append((sx, sy))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            i = ny * w + nx
            if 0 <= nx < w and 0 <= ny < h and not vis[i] and is_void(nx, ny):
                vis[i] = 1
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if vis[row + x]:
                continue
            r, g, b, _a = px[x, y]
            opx[x, y] = (r, g, b, 255)

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    px = out.load()
    w, h = out.size
    cx, cy = w // 2, h // 2

    def trans(x: int, y: int) -> bool:
        return px[x, y][3] < 30

    top = 0
    while top < h and trans(cx, top):
        top += 1
    bot = h - 1
    while bot >= 0 and trans(cx, bot):
        bot -= 1
    left = 0
    while left < w and trans(left, cy):
        left += 1
    right = w - 1
    while right >= 0 and trans(right, cy):
        right -= 1
    if left < right and top < bot:
        out = out.crop((left, top, right + 1, bot + 1))
    px = out.load()
    w, h = out.size
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir > il and ib > it:
        rails = [il, it, w - 1 - ir, h - 1 - ib]
        if max(rails) - min(rails) <= 8:
            out, *_ = trim_asymmetric_rails(out, il, it, ir, ib)
            bbox = out.getbbox()
            if bbox:
                out = out.crop(bbox)
    return out


def extract_black_satin_square(img: Image.Image) -> Image.Image:
    """Siyah fon + siyah saten kare: oluk gölgesi delik olmasın, gövde opak kalsın."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def brightness(x: int, y: int) -> float:
        r, g, b, _a = px[x, y]
        return (r + g + b) / 3

    def walk_to(x: int, y: int, dx: int, dy: int, thresh: float, run_need: int = 2):
        run = 0
        first: tuple[int, int] | None = None
        while 0 <= x < w and 0 <= y < h:
            if brightness(x, y) >= thresh:
                if first is None:
                    first = (x, y)
                run += 1
                if run >= run_need:
                    return first
            else:
                run = 0
                first = None
            x += dx
            y += dy
        return first

    def expand(x: int, y: int, dx: int, dy: int, thresh: float, limit: int = 12) -> tuple[int, int]:
        last = (x, y)
        for _ in range(limit):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < w and 0 <= ny < h):
                break
            if brightness(nx, ny) >= thresh:
                last = (nx, ny)
                x, y = nx, ny
            else:
                break
        return last

    body = 8.0
    left_o = walk_to(0, cy, 1, 0, body)
    right_o = walk_to(w - 1, cy, -1, 0, body)
    top_o = walk_to(cx, 0, 0, 1, body)
    bot_o = walk_to(cx, h - 1, 0, -1, body)
    left_i = walk_to(cx, cy, -1, 0, body)
    right_i = walk_to(cx, cy, 1, 0, body)
    top_i = walk_to(cx, cy, 0, -1, body)
    bot_i = walk_to(cx, cy, 0, 1, body)
    if not all((left_o, right_o, top_o, bot_o, left_i, right_i, top_i, bot_i)):
        return src

    ol, _ = expand(*left_o, -1, 0, 4.0)
    oright, _ = expand(*right_o, 1, 0, 4.0)
    _, ot = expand(*top_o, 0, -1, 4.0)
    _, ob = expand(*bot_o, 0, 1, 4.0)
    il, _ = expand(*left_i, 1, 0, 4.0)
    ir, _ = expand(*right_i, -1, 0, 4.0)
    _, it = expand(*top_i, 0, 1, 4.0)
    _, ib = expand(*bot_i, 0, -1, 4.0)

    if il - ol < 40 or it - ot < 40 or ir - il < 40 or ib - it < 40:
        return src

    cw, ch = oright - ol + 1, ob - ot + 1
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    opx = out.load()
    for y in range(ot, ob + 1):
        for x in range(ol, oright + 1):
            if il < x < ir and it < y < ib:
                continue
            r, g, b, _a = px[x, y]
            opx[x - ol, y - ot] = (r, g, b, 255)

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)

    px = out.load()
    w, h = out.size
    cx, cy = w // 2, h // 2

    def trans(x: int, y: int) -> bool:
        return px[x, y][3] < 30

    top = 0
    while top < h and trans(cx, top):
        top += 1
    bot = h - 1
    while bot >= 0 and trans(cx, bot):
        bot -= 1
    left = 0
    while left < w and trans(left, cy):
        left += 1
    right = w - 1
    while right >= 0 and trans(right, cy):
        right -= 1
    if left < right and top < bot:
        out = out.crop((left, top, right + 1, bot + 1))
    return dilate_opaque_into_hole(out, 2)


def extract_faithful_black_square(
    img: Image.Image,
    *,
    keep_dark_specks: bool = False,
    peel_dark_outer: bool = False,
    dilate_hole: int = 0,
) -> Image.Image:
    """Siyah fondaki kare çerçeveyi birebir kopyala; iç/dış koyu dudağı koru."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def br_spr(x: int, y: int) -> tuple[float, int]:
        r, g, b, _a = px[x, y]
        return (r + g + b) / 3, max(r, g, b) - min(r, g, b)

    hole_br, hole_spr = br_spr(cx, cy)
    white_hole = px[cx, cy][3] > 80 and hole_br > 180 and hole_spr < 16

    def is_body(x: int, y: int) -> bool:
        r, g, b, _a = px[x, y]
        br, spr = br_spr(x, y)
        if white_hole:
            return spr >= 18 and 38 < br < 200 and (r - b) >= 18
        # Matte beyaz: düşük spread. Koyu ahşap: spread'li gövde.
        if br > 28:
            return True
        return spr >= 12 and br > 16

    def is_dark_rim(x: int, y: int) -> bool:
        br, spr = br_spr(x, y)
        if 3.0 <= br <= 42:
            return True
        if white_hole:
            return 3.0 <= br <= 80 and spr < 14
        return False

    def walk_to_body(x: int, y: int, dx: int, dy: int) -> tuple[int, int] | None:
        while 0 <= x < w and 0 <= y < h:
            if is_body(x, y):
                return x, y
            x += dx
            y += dy
        return None

    def expand_rim(x: int, y: int, dx: int, dy: int, toward_hole: bool) -> tuple[int, int]:
        last = (x, y)
        steps = 0
        nx, ny = x + dx, y + dy
        while 0 <= nx < w and 0 <= ny < h and steps < 24:
            if toward_hole:
                br0 = br_spr(nx, ny)[0]
                if br0 < 8:
                    break
                if is_dark_rim(nx, ny):
                    last = (nx, ny)
                else:
                    break
            else:
                if is_dark_rim(nx, ny):
                    last = (nx, ny)
                elif br_spr(nx, ny)[0] < 3:
                    break
                else:
                    break
            nx += dx
            ny += dy
            steps += 1
        return last

    left_b = walk_to_body(cx, cy, -1, 0)
    right_b = walk_to_body(cx, cy, 1, 0)
    top_b = walk_to_body(cx, cy, 0, -1)
    bot_b = walk_to_body(cx, cy, 0, 1)
    if not (left_b and right_b and top_b and bot_b):
        return src

    inner_l, _ = expand_rim(*left_b, 1, 0, True)
    inner_r, _ = expand_rim(*right_b, -1, 0, True)
    _, inner_t = expand_rim(*top_b, 0, 1, True)
    _, inner_b = expand_rim(*bot_b, 0, -1, True)

    left_outer = walk_to_body(0, cy, 1, 0) or left_b
    right_outer = walk_to_body(w - 1, cy, -1, 0) or right_b
    top_outer = walk_to_body(cx, 0, 0, 1) or top_b
    bot_outer = walk_to_body(cx, h - 1, 0, -1) or bot_b

    outer_l, _ = expand_rim(*left_outer, -1, 0, False)
    outer_r, _ = expand_rim(*right_outer, 1, 0, False)
    _, outer_t = expand_rim(*top_outer, 0, -1, False)
    _, outer_b = expand_rim(*bot_outer, 0, 1, False)

    if inner_l - outer_l < 40 or inner_t - outer_t < 40:
        return src

    cw, ch = outer_r - outer_l + 1, outer_b - outer_t + 1
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    opx = out.load()
    for y in range(outer_t, outer_b + 1):
        for x in range(outer_l, outer_r + 1):
            if inner_l < x < inner_r and inner_t < y < inner_b:
                continue
            r, g, b, _a = px[x, y]
            if not keep_dark_specks and (r + g + b) / 3 < 8:
                continue
            opx[x - outer_l, y - outer_t] = (r, g, b, 255)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    # Ortası şeffaf kalan dış satır/sütunu at (nine-slice rayı 0 olmasın).
    px = out.load()
    w, h = out.size
    cx, cy = w // 2, h // 2

    def trans(x: int, y: int) -> bool:
        return px[x, y][3] < 30

    top = 0
    while top < h and trans(cx, top):
        top += 1
    bot = h - 1
    while bot >= 0 and trans(cx, bot):
        bot -= 1
    left = 0
    while left < w and trans(left, cy):
        left += 1
    right = w - 1
    while right >= 0 and trans(right, cy):
        right -= 1
    if left < right and top < bot:
        out = out.crop((left, top, right + 1, bot + 1))
    if peel_dark_outer:
        out = peel_dark_alias_outer(out)
    if dilate_hole:
        out = dilate_opaque_into_hole(out, dilate_hole)
    return out


def extract_white_studio_frame(img: Image.Image) -> Image.Image:
    """Beyaz duvar + beyaz paspartu: oluk/iç dudak ile delik; dış pahı kesme."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def br(x: int, y: int) -> float:
        r, g, b, _a = px[x, y]
        return (r + g + b) / 3

    def spr(x: int, y: int) -> int:
        r, g, b, _a = px[x, y]
        return max(r, g, b) - min(r, g, b)

    def in_b(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h

    hole = br(cx, cy)

    def find_outer(x: int, y: int, dx: int, dy: int) -> tuple[int, int] | None:
        run = 0
        first: tuple[int, int] | None = None
        while in_b(x, y):
            if br(x, y) < 205:
                if first is None:
                    first = (x, y)
                run += 1
                if run >= 2:
                    return first
            else:
                run = 0
                first = None
            x += dx
            y += dy
        return first

    def find_groove(dx: int, dy: int) -> tuple[int, int] | None:
        x, y = cx, cy
        while in_b(x, y):
            if br(x, y) < 175:
                return x, y
            x += dx
            y += dy
        return None

    def inner_from_groove(gx: int, gy: int, dx: int, dy: int) -> tuple[int, int]:
        x, y = gx, gy
        last = (x, y)
        while in_b(x, y):
            if br(x, y) >= hole - 8:
                return last
            last = (x, y)
            x += dx
            y += dy
        return last

    def leave_mat(dx: int, dy: int) -> tuple[int, int] | None:
        x, y = cx, cy
        while in_b(x, y):
            if not (abs(br(x, y) - hole) < 12 and spr(x, y) < 14):
                return x, y
            x += dx
            y += dy
        return None

    def side_inner(dx: int, dy: int, hx: int, hy: int) -> tuple[int, int] | None:
        g = find_groove(dx, dy)
        if g is not None:
            gx, gy = g
            if 40 <= gx <= w - 41 and 40 <= gy <= h - 41:
                return inner_from_groove(gx, gy, hx, hy)
        return leave_mat(dx, dy)

    inner_l = side_inner(-1, 0, 1, 0)
    inner_r = side_inner(1, 0, -1, 0)
    inner_top = side_inner(0, -1, 0, 1)
    inner_bot = side_inner(0, 1, 0, -1)
    outer_l = find_outer(0, cy, 1, 0)
    outer_r = find_outer(w - 1, cy, -1, 0)
    outer_top = find_outer(cx, 0, 0, 1)
    outer_bot = find_outer(cx, h - 1, 0, -1)
    if not all((inner_l, inner_r, inner_top, inner_bot, outer_l, outer_r, outer_top, outer_bot)):
        return src

    ol, ot = outer_l[0], outer_top[1]
    oright, ob = outer_r[0], outer_bot[1]
    il, it = inner_l[0], inner_top[1]
    ir, ib = inner_r[0], inner_bot[1]
    if il - ol < 40 or it - ot < 40 or oright - ir < 40 or ob - ib < 40:
        return src

    cw, ch = oright - ol + 1, ob - ot + 1
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    opx = out.load()
    for y in range(ot, ob + 1):
        for x in range(ol, oright + 1):
            if il < x < ir and it < y < ib:
                continue
            r, g, b, _a = px[x, y]
            opx[x - ol, y - ot] = (r, g, b, 255)
    return _stain_pale_white_outers(out)


def extract_white_profile_frame(img: Image.Image) -> Image.Image:
    """Siyah fondaki beyaz kare: siyahı flood et, kalıp ve gönye birebir."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def is_void(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 30:
            return True
        br = (r + g + b) / 3
        spr = max(r, g, b) - min(r, g, b)
        return br < 28 and spr < 14

    vis = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for sx, sy in (
        (cx, cy),
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (cx, 0),
        (cx, h - 1),
        (0, cy),
        (w - 1, cy),
    ):
        if 0 <= sx < w and 0 <= sy < h and is_void(sx, sy) and not vis[sy * w + sx]:
            vis[sy * w + sx] = 1
            q.append((sx, sy))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            i = ny * w + nx
            if 0 <= nx < w and 0 <= ny < h and not vis[i] and is_void(nx, ny):
                vis[i] = 1
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if vis[row + x]:
                continue
            r, g, b, _a = px[x, y]
            opx[x, y] = (r, g, b, 255)

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    px2 = out.load()
    w2, h2 = out.size
    cx2, cy2 = w2 // 2, h2 // 2

    def trans(x: int, y: int) -> bool:
        return px2[x, y][3] < 30

    top = 0
    while top < h2 and trans(cx2, top):
        top += 1
    bot = h2 - 1
    while bot >= 0 and trans(cx2, bot):
        bot -= 1
    left = 0
    while left < w2 and trans(left, cy2):
        left += 1
    right = w2 - 1
    while right >= 0 and trans(right, cy2):
        right -= 1
    if left < right and top < bot:
        out = out.crop((left, top, right + 1, bot + 1))
    px3 = out.load()
    w3, h3 = out.size
    hil, hit, hir, hib = _hole_bounds(px3, w3, h3)
    if hir > hil and hib > hit:
        out, *_ = trim_asymmetric_rails(out, hil, hit, hir, hib)
        bbox = out.getbbox()
        if bbox:
            out = out.crop(bbox)
    return out


def extract_fa41_product_frame(img: Image.Image) -> Image.Image:
    """FA 41 ürün fotoğrafı: duvar + krem paspartu; çerçeve pikselleri birebir."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def rgb(x: int, y: int) -> tuple[int, int, int]:
        r, g, b, _a = px[x, y]
        return r, g, b

    def br(x: int, y: int) -> float:
        r, g, b = rgb(x, y)
        return (r + g + b) / 3

    def spr(x: int, y: int) -> int:
        r, g, b = rgb(x, y)
        return max(r, g, b) - min(r, g, b)

    def rmb(x: int, y: int) -> int:
        r, _g, b = rgb(x, y)
        return r - b

    def in_b(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h

    def edge_wall(x0: int, y0: int, dx: int, dy: int, n: int = 10) -> float:
        vals: list[float] = []
        x, y = x0, y0
        for _ in range(n):
            if not in_b(x, y):
                break
            vals.append(br(x, y))
            x += dx
            y += dy
        return sorted(vals)[len(vals) // 2] if vals else 220.0

    hole = br(cx, cy)
    wall_l = edge_wall(0, cy, 1, 0)
    wall_r = edge_wall(w - 1, cy, -1, 0)
    wall_t = edge_wall(cx, 0, 0, 1)
    wall_b = edge_wall(cx, h - 1, 0, -1)

    def find_inner(dx: int, dy: int) -> tuple[int, int] | None:
        x, y = cx, cy
        while in_b(x, y) and abs(br(x, y) - hole) <= 12:
            x += dx
            y += dy
        while in_b(x, y) and br(x, y) >= 152:
            x += dx
            y += dy
        if not in_b(x, y):
            return None
        return x, y

    def find_outer_from_edge(dx: int, dy: int, wall_br: float) -> tuple[int, int] | None:
        if dx == 1:
            x, y = 0, cy
        elif dx == -1:
            x, y = w - 1, cy
        elif dy == 1:
            x, y = cx, 0
        else:
            x, y = cx, h - 1
        last = (x, y)

        def step() -> bool:
            nonlocal x, y, last
            last = (x, y)
            x += dx
            y += dy
            return in_b(x, y)

        for _ in range(max(w, h)):
            if not in_b(x, y):
                return last
            b, s, rb = br(x, y), spr(x, y), rmb(x, y)
            if abs(b - wall_br) <= 14 and s < 12:
                if not step():
                    return last
                continue
            break
        for _ in range(max(w, h)):
            if not in_b(x, y):
                return last
            b, s, rb = br(x, y), spr(x, y), rmb(x, y)
            if b < 115 or s >= 24:
                return x, y
            if b >= 148 and s < 24:
                if not step():
                    return last
                continue
            return x, y
        return last

    ilp = find_inner(-1, 0)
    irp = find_inner(1, 0)
    itp = find_inner(0, -1)
    ibp = find_inner(0, 1)
    olp = find_outer_from_edge(1, 0, wall_l)
    orp = find_outer_from_edge(-1, 0, wall_r)
    otp = find_outer_from_edge(0, 1, wall_t)
    obp = find_outer_from_edge(0, -1, wall_b)
    if not all((ilp, irp, itp, ibp, olp, orp, otp, obp)):
        return src

    ol, ot = olp[0], otp[1]
    oright, ob = orp[0], obp[1]
    il, it = ilp[0], itp[1]
    ir, ib = irp[0], ibp[1]
    if il <= ol or ir >= oright or it <= ot or ib >= ob:
        return src
    if il - ol < 36 or it - ot < 36 or oright - ir < 36 or ob - ib < 36:
        return src

    brs: list[float] = []
    goldish = 0
    for frac in (0.28, 0.4, 0.5, 0.62, 0.75):
        sx = int(ol + (il - ol) * frac)
        sr, sg, sb = rgb(sx, cy)
        brs.append((sr + sg + sb) / 3)
        if (sr - sb) >= 18 and (max(sr, sg, sb) - min(sr, sg, sb)) >= 20:
            goldish += 1
    mbr = sorted(brs)[len(brs) // 2]
    if mbr < 70:
        kind = "dark"
    elif goldish >= 4:
        kind = "gold"
    else:
        kind = "metal"

    def snap_inner_to_bead(x: int, y: int, dx: int, dy: int) -> tuple[int, int]:
        """Krem paspartuda kalan iç kenarı koyu iç boncuğa kadar ilerlet."""
        last = (x, y)
        for _ in range(22):
            if not in_b(x, y):
                return last
            if br(x, y) < 122:
                return x, y
            last = (x, y)
            x += dx
            y += dy
        return last

    def snap_inner_to_gold(x: int, y: int, dx: int, dy: int) -> tuple[int, int]:
        """Krem paspartuyu geç; altın iç dudak / koyu altın iç rim."""
        last = (x, y)
        for _ in range(28):
            if not in_b(x, y):
                return last
            b, s, rb = br(x, y), spr(x, y), rmb(x, y)
            if (rb >= 28 and s >= 28) or (b < 80 and s >= 24):
                return x, y
            last = (x, y)
            x += dx
            y += dy
        return last

    if kind == "metal":
        il, _ = snap_inner_to_bead(il, cy, -1, 0)
        ir, _ = snap_inner_to_bead(ir, cy, 1, 0)
        _, it = snap_inner_to_bead(cx, it, 0, -1)
        _, ib = snap_inner_to_bead(cx, ib, 0, 1)
        if il <= ol or ir >= oright or it <= ot or ib >= ob:
            return src
        if il - ol < 36 or it - ot < 36 or oright - ir < 36 or ob - ib < 36:
            return src
    elif kind == "gold":
        il, _ = snap_inner_to_gold(il, cy, -1, 0)
        ir, _ = snap_inner_to_gold(ir, cy, 1, 0)
        _, it = snap_inner_to_gold(cx, it, 0, -1)
        _, ib = snap_inner_to_gold(cx, ib, 0, 1)
        if il <= ol or ir >= oright or it <= ot or ib >= ob:
            return src
        if il - ol < 36 or it - ot < 36 or oright - ir < 36 or ob - ib < 36:
            return src

    def is_leftover_px(r: int, g: int, b: int) -> bool:
        bv = (r + g + b) / 3
        s = max(r, g, b) - min(r, g, b)
        rb = r - b
        if kind == "dark":
            return bv >= 145
        if kind == "gold":
            return bv >= 140 and s <= 22
        # Şampanya/gümüş: krem paspartu (düşük kroma); dışbükey metal yüz s>22.
        return bv >= 140 and s <= 22

    def is_wall_px(r: int, g: int, b: int, wall_br: float) -> bool:
        bv = (r + g + b) / 3
        s = max(r, g, b) - min(r, g, b)
        rb = r - b
        if kind in ("metal", "gold"):
            return bv >= 198 and s < 14 and abs(bv - wall_br) <= 20
        if kind != "dark":
            return False
        return bv >= 150

    cw, ch = oright - ol + 1, ob - ot + 1
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    opx = out.load()
    for y in range(ot, ob + 1):
        for x in range(ol, oright + 1):
            if il < x < ir and it < y < ib:
                continue
            r, g, b, _a = px[x, y]
            opx[x - ol, y - ot] = (r, g, b, 255)

    def punch_and_peel(im: Image.Image) -> Image.Image:
        pxh = im.load()
        ww, hh = im.size
        hil, hit, hir, hib = _hole_bounds(pxh, ww, hh)
        if hir <= hil or hib <= hit:
            return im
        clear = (0, 0, 0, 0)

        leftover_n = 28 if kind in ("metal", "gold") else 16
        for y in range(hit, hib + 1):
            x = hil - 1
            n = 0
            while x >= 0 and n < leftover_n:
                r, g, b, a = pxh[x, y]
                if a < 30 or not is_leftover_px(r, g, b):
                    break
                pxh[x, y] = clear
                x -= 1
                n += 1
            x = hir + 1
            n = 0
            while x < ww and n < leftover_n:
                r, g, b, a = pxh[x, y]
                if a < 30 or not is_leftover_px(r, g, b):
                    break
                pxh[x, y] = clear
                x += 1
                n += 1
        for x in range(hil, hir + 1):
            y = hit - 1
            n = 0
            while y >= 0 and n < leftover_n:
                r, g, b, a = pxh[x, y]
                if a < 30 or not is_leftover_px(r, g, b):
                    break
                pxh[x, y] = clear
                y -= 1
                n += 1
            y = hib + 1
            n = 0
            while y < hh and n < leftover_n:
                r, g, b, a = pxh[x, y]
                if a < 30 or not is_leftover_px(r, g, b):
                    break
                pxh[x, y] = clear
                y += 1
                n += 1

        for y in range(hh):
            x = 0
            n = 0
            while x < ww and n < 24:
                r, g, b, a = pxh[x, y]
                if a < 30:
                    break
                if not is_wall_px(r, g, b, wall_l):
                    break
                pxh[x, y] = clear
                x += 1
                n += 1
            x = ww - 1
            n = 0
            while x >= 0 and n < 24:
                r, g, b, a = pxh[x, y]
                if a < 30:
                    break
                if not is_wall_px(r, g, b, wall_r):
                    break
                pxh[x, y] = clear
                x -= 1
                n += 1
        for x in range(ww):
            y = 0
            n = 0
            while y < hh and n < 24:
                r, g, b, a = pxh[x, y]
                if a < 30:
                    break
                if not is_wall_px(r, g, b, wall_t):
                    break
                pxh[x, y] = clear
                y += 1
                n += 1
            y = hh - 1
            n = 0
            while y >= 0 and n < 24:
                r, g, b, a = pxh[x, y]
                if a < 30:
                    break
                if not is_wall_px(r, g, b, wall_b):
                    break
                pxh[x, y] = clear
                y -= 1
                n += 1
        return im

    out = punch_and_peel(out)
    if kind == "dark":
        out = expand_hole_inward(out, 2, 2, 2, 2, equalize="none")
    elif kind == "metal":
        pxh = out.load()
        ww, hh = out.size
        hil, hit, hir, hib = _hole_bounds(pxh, ww, hh)

        def inner_edge_median_br() -> float:
            vals: list[float] = []
            for y in range(hit + 8, max(hit + 9, hib - 7), 10):
                r, g, b, a = pxh[hil, y]
                if a >= 30:
                    vals.append((r + g + b) / 3)
            return sorted(vals)[len(vals) // 2] if vals else 0.0

        def groove_walk(x0: int, y0: int, dx: int, dy: int) -> int:
            seen_pale = False
            x, y = x0, y0
            for i in range(1, 24):
                x += dx
                y += dy
                if not (0 <= x < ww and 0 <= y < hh):
                    return 0
                r, g, b, a = pxh[x, y]
                if a < 30:
                    return 0
                bv = (r + g + b) / 3
                if bv >= 175:
                    seen_pale = True
                if seen_pale and bv < 100:
                    return max(0, i - 1)
            return 0

        def side_depth(vals: list[int]) -> int:
            if not vals:
                return 0
            return min(20, max(vals))

        if hir > hil and hib > hit and inner_edge_median_br() >= 160:
            ys = list(range(hit + 8, max(hit + 9, hib - 7), 6))
            xs = list(range(hil + 8, max(hil + 9, hir - 7), 6))
            left_d = side_depth([groove_walk(hil, y, -1, 0) for y in ys])
            right_d = side_depth([groove_walk(hir, y, 1, 0) for y in ys])
            top_d = side_depth([groove_walk(x, hit, 0, -1) for x in xs])
            bot_d = side_depth([groove_walk(x, hib, 0, 1) for x in xs])
            if max(left_d, right_d, top_d, bot_d) > 0:
                out = expand_hole_inward(out, top_d, right_d, bot_d, left_d, equalize="none")
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    px2 = out.load()
    w2, h2 = out.size
    hil, hit, hir, hib = _hole_bounds(px2, w2, h2)
    if hir > hil and hib > hit:
        out, *_ = trim_asymmetric_rails(out, hil, hit, hir, hib)
        bbox = out.getbbox()
        if bbox:
            out = out.crop(bbox)
    return out


def extract_35l_gumus_product(img: Image.Image) -> Image.Image:
    """35 L gümüş ürün fotoğrafı: duvar + paspartu; sağdaki speküler kesik sol raydan tamamlanır."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def rgb(x: int, y: int) -> tuple[int, int, int]:
        r, g, b, _a = px[x, y]
        return r, g, b

    def br(x: int, y: int) -> float:
        r, g, b = rgb(x, y)
        return (r + g + b) / 3

    def spr(x: int, y: int) -> int:
        r, g, b = rgb(x, y)
        return max(r, g, b) - min(r, g, b)

    def rmb(x: int, y: int) -> int:
        r, _g, b = rgb(x, y)
        return r - b

    def in_b(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h

    hole = br(cx, cy)

    def is_mat(x: int, y: int) -> bool:
        b, s = br(x, y), spr(x, y)
        return abs(b - hole) <= 16 and s <= 10

    def is_metal(x: int, y: int) -> bool:
        b, s, rb = br(x, y), spr(x, y), rmb(x, y)
        if s >= 14 or rb >= 14:
            return True
        if 80 <= b <= 200 and s >= 12:
            return True
        return False

    def is_blown(x: int, y: int) -> bool:
        return br(x, y) >= 236 and spr(x, y) <= 8

    def find_inner(dx: int, dy: int) -> tuple[int, int] | None:
        x, y = cx, cy
        while in_b(x, y) and is_mat(x, y):
            x += dx
            y += dy
        if not in_b(x, y):
            return None
        last = (x, y)
        for _ in range(90):
            if not in_b(x, y):
                return last
            if is_metal(x, y):
                return (x, y)
            if br(x, y) < 198 and spr(x, y) >= 8:
                return (x, y)
            last = (x, y)
            x += dx
            y += dy
        return last

    def find_outer(ix: int, iy: int, dx: int, dy: int) -> tuple[int, int]:
        x, y = ix, iy
        last_metal = (x, y)
        seen_metal = False
        for _ in range(max(w, h)):
            if not in_b(x, y):
                return last_metal
            if is_metal(x, y):
                seen_metal = True
                last_metal = (x, y)
            elif is_blown(x, y) and seen_metal:
                last_metal = (x, y)
            else:
                nx, ny = x, y
                found = False
                for _k in range(6):
                    nx += dx
                    ny += dy
                    if not in_b(nx, ny):
                        break
                    if is_metal(nx, ny) or (is_blown(nx, ny) and seen_metal):
                        found = True
                        break
                if found:
                    last_metal = (x, y)
                elif seen_metal:
                    return last_metal
            x += dx
            y += dy
        return last_metal

    ilp = find_inner(-1, 0)
    irp = find_inner(1, 0)
    itp = find_inner(0, -1)
    ibp = find_inner(0, 1)
    if not all((ilp, irp, itp, ibp)):
        return src

    olp = find_outer(*ilp, -1, 0)
    orp = find_outer(*irp, 1, 0)
    otp = find_outer(*itp, 0, -1)
    obp = find_outer(*ibp, 0, 1)

    ol, ot = olp[0], otp[1]
    oright, ob = orp[0], obp[1]
    il, it = ilp[0], itp[1]
    ir, ib = irp[0], ibp[1]
    if il <= ol or ir >= oright or it <= ot or ib >= ob:
        return src
    if il - ol < 36 or it - ot < 36 or oright - ir < 36 or ob - ib < 36:
        return src

    cw, ch = oright - ol + 1, ob - ot + 1
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    opx = out.load()
    for y in range(ot, ob + 1):
        for x in range(ol, oright + 1):
            if il < x < ir and it < y < ib:
                continue
            r, g, b, _a = px[x, y]
            opx[x - ol, y - ot] = (r, g, b, 255)

    pxh = out.load()
    ww, hh = out.size
    hil, hit, hir, hib = _hole_bounds(pxh, ww, hh)
    clear = (0, 0, 0, 0)
    if hir > hil and hib > hit:
        for y in range(hit, hib + 1):
            x = hil - 1
            n = 0
            while x >= 0 and n < 18:
                r, g, b, a = pxh[x, y]
                bv = (r + g + b) / 3
                s = max(r, g, b) - min(r, g, b)
                if a < 30 or s >= 13 or bv < 188:
                    break
                pxh[x, y] = clear
                x -= 1
                n += 1
            x = hir + 1
            n = 0
            while x < ww and n < 18:
                r, g, b, a = pxh[x, y]
                bv = (r + g + b) / 3
                s = max(r, g, b) - min(r, g, b)
                if a < 30 or s >= 13 or bv < 188:
                    break
                pxh[x, y] = clear
                x += 1
                n += 1
        for x in range(hil, hir + 1):
            y = hit - 1
            n = 0
            while y >= 0 and n < 18:
                r, g, b, a = pxh[x, y]
                bv = (r + g + b) / 3
                s = max(r, g, b) - min(r, g, b)
                if a < 30 or s >= 13 or bv < 188:
                    break
                pxh[x, y] = clear
                y -= 1
                n += 1
            y = hib + 1
            n = 0
            while y < hh and n < 18:
                r, g, b, a = pxh[x, y]
                bv = (r + g + b) / 3
                s = max(r, g, b) - min(r, g, b)
                if a < 30 or s >= 13 or bv < 188:
                    break
                pxh[x, y] = clear
                y += 1
                n += 1

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    out = replace_right_rail_from_left(out)
    px2 = out.load()
    w2, h2 = out.size
    hil, hit, hir, hib = _hole_bounds(px2, w2, h2)
    if hir > hil and hib > hit:
        for (x0, y0, inside) in (
            (hil, hit, lambda x, y: x >= hil and y >= hit),
            (hir, hit, lambda x, y: x <= hir and y >= hit),
            (hil, hib, lambda x, y: x >= hil and y <= hib),
            (hir, hib, lambda x, y: x <= hir and y <= hib),
        ):
            for y in range(max(0, y0 - 6), min(h2, y0 + 7)):
                for x in range(max(0, x0 - 6), min(w2, x0 + 7)):
                    r, g, b, a = px2[x, y]
                    bv = (r + g + b) / 3
                    s = max(r, g, b) - min(r, g, b)
                    if a >= 30 and bv >= 175 and s <= 16 and inside(x, y):
                        px2[x, y] = clear
        hil, hit, hir, hib = _hole_bounds(px2, w2, h2)
        out, *_ = trim_asymmetric_rails(out, hil, hit, hir, hib)
        bbox = out.getbbox()
        if bbox:
            out = out.crop(bbox)
        out = expand_hole_inward(out, 1, 1, 1, 1, equalize="none")
    return out


def peel_beige_studio_margin(img: Image.Image, max_peel: int = 80) -> Image.Image:
    """Kalan açık duvar şeridini kırp; boncuk/altın yüze girme."""
    out = img.convert("RGBA")
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 80 or h < 80:
            break

        def beige_side(side: str) -> bool:
            med_br, med_spr = _side_mid_stats(px, w, h, side)
            return med_br >= 155 and med_spr <= 28

        cropped = False
        if beige_side("right"):
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        elif beige_side("top"):
            out = out.crop((0, 1, w, h))
            cropped = True
        elif beige_side("left"):
            out = out.crop((1, 0, w, h))
            cropped = True
        elif beige_side("bottom"):
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        if not cropped:
            break
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def _is_29kr_warm_wall_or_shadow(p: tuple[int, int, int]) -> bool:
    """Ceviz ürün fotoğrafındaki bej duvar ve düşen gölge; ahşap/boncuk değil."""
    r, g, b = p[0], p[1], p[2]
    br = (r + g + b) / 3.0
    spr = max(r, g, b) - min(r, g, b)
    rb = r - b
    # Bu fotoğrafta çerçeve yüzü koyu; açık piksel duvar (altın yansımalı bile olsa).
    if br >= 145:
        return True
    # Boncuk/altın dudak
    if rb >= 20 and spr >= 16:
        return False
    if br < 108:
        return False
    if spr >= 34:
        return False
    if spr <= 10 and br >= 100:
        return True
    return 108 <= br < 145 and spr <= 22


def extract_29kr_duz_wood_on_wall(img: Image.Image) -> Image.Image:
    """Sıcak duvar + ceviz: dış gölgeyi ve iç deliği flood-fill ile sil, boncuğu bırak."""
    src = img.convert("RGBA")
    w, h = src.size
    out = src.copy()
    opx = out.load()
    visited = bytearray(w * h)

    def flood(seeds: list[tuple[int, int]]) -> None:
        q = deque(seeds)
        while q:
            x, y = q.popleft()
            i = y * w + x
            if visited[i]:
                continue
            visited[i] = 1
            r, g, b, a = opx[x, y]
            if a < 30 or not _is_29kr_warm_wall_or_shadow((r, g, b)):
                continue
            opx[x, y] = (0, 0, 0, 0)
            if x > 0:
                q.append((x - 1, y))
            if x + 1 < w:
                q.append((x + 1, y))
            if y > 0:
                q.append((x, y - 1))
            if y + 1 < h:
                q.append((x, y + 1))

    seeds: list[tuple[int, int]] = []
    for x in range(w):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(h):
        seeds.append((0, y))
        seeds.append((w - 1, y))
    seeds.append((w // 2, h // 2))
    flood(seeds)

    out = _keep_largest_opaque_component(out)
    bbox = out.getbbox()
    if not bbox:
        return src
    out = out.crop(bbox)
    out = _punch_29kr_inner_pale(out)
    out = _punch_29kr_pale_next_to_hole(out, max_steps=4)
    out = _heal_29kr_outer_corners(out)
    return _finish_29kr_duz(out)


def _keep_largest_opaque_component(img: Image.Image) -> Image.Image:
    """Kenarda kalan duvar adacıklarını at, çerçeve halkasını bırak."""
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    label = bytearray(w * h)
    best_id = 0
    best_n = 0
    next_id = 0
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if label[i0] or px[x0, y0][3] < 30:
                continue
            next_id += 1
            if next_id > 255:
                break
            n = 0
            q: deque[tuple[int, int]] = deque([(x0, y0)])
            while q:
                x, y = q.popleft()
                i = y * w + x
                if label[i]:
                    continue
                if px[x, y][3] < 30:
                    label[i] = 255
                    continue
                label[i] = next_id
                n += 1
                if x > 0:
                    q.append((x - 1, y))
                if x + 1 < w:
                    q.append((x + 1, y))
                if y > 0:
                    q.append((x, y - 1))
                if y + 1 < h:
                    q.append((x, y + 1))
            if n > best_n:
                best_n = n
                best_id = next_id
    if best_id == 0:
        return out
    for y in range(h):
        for x in range(w):
            if label[y * w + x] != best_id:
                px[x, y] = (0, 0, 0, 0)
    return out


def _punch_29kr_pale_next_to_hole(img: Image.Image, max_steps: int = 10) -> Image.Image:
    """Delikte kalan bej şeridi sil; ahşap/boncuk pikseline geçme."""
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    for _ in range(max_steps):
        to_clear: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 30 or not _is_29kr_warm_wall_or_shadow((r, g, b)):
                    continue
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < 30:
                        to_clear.append((x, y))
                        break
        if not to_clear:
            break
        for x, y in to_clear:
            px[x, y] = (0, 0, 0, 0)
    return out


def _29kr_first_opaque(px, w: int, h: int, dx: int, dy: int) -> tuple[int, int] | None:
    x, y = w // 2, h // 2
    for _ in range(max(w, h)):
        x += dx
        y += dy
        if not (0 <= x < w and 0 <= y < h):
            return None
        if px[x, y][3] >= 30:
            return x, y
    return None


def _29kr_axis_rails(img: Image.Image) -> tuple[int, int, int, int] | None:
    """Merkezden yürüyerek ray kalınlığı; kenardaki 1px çentikten etkilenmez."""
    w, h = img.size
    px = img.load()
    if px[w // 2, h // 2][3] >= 30:
        return None
    left = _29kr_first_opaque(px, w, h, -1, 0)
    right = _29kr_first_opaque(px, w, h, 1, 0)
    top = _29kr_first_opaque(px, w, h, 0, -1)
    bot = _29kr_first_opaque(px, w, h, 0, 1)
    if not all((left, right, top, bot)):
        return None
    return left[0], top[1], w - 1 - right[0], h - 1 - bot[1]


def _29kr_wood_usable(img: Image.Image) -> bool:
    rails = _29kr_axis_rails(img)
    if rails is None:
        return False
    if min(rails) < 55 or max(rails) > min(rails) * 1.45:
        return False
    return True


def _punch_29kr_inner_pale(img: Image.Image) -> Image.Image:
    """Eksen iç dikdörtgenindeki açık duvarı sil; koyu boncuk/ahşaba dokunma."""
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    left = _29kr_first_opaque(px, w, h, -1, 0)
    right = _29kr_first_opaque(px, w, h, 1, 0)
    top = _29kr_first_opaque(px, w, h, 0, -1)
    bot = _29kr_first_opaque(px, w, h, 0, 1)
    if not all((left, right, top, bot)):
        return out
    il, it, ir, ib = left[0], top[1], right[0], bot[1]
    for y in range(it, ib + 1):
        for x in range(il, ir + 1):
            r, g, b, a = px[x, y]
            if a < 30:
                continue
            br = (r + g + b) / 3.0
            if br >= 125 or _is_29kr_warm_wall_or_shadow((r, g, b)):
                px[x, y] = (0, 0, 0, 0)
    inset = 4
    for y in range(it + inset, ib - inset + 1):
        for x in range(il + inset, ir - inset + 1):
            px[x, y] = (0, 0, 0, 0)
    return out


def _heal_29kr_outer_corners(img: Image.Image, corner: int = 36) -> Image.Image:
    """Ray bölgesindeki şeffaf/bej boşluğu komşu ahşap/metalle doldur; deliğe dokunma."""
    del corner
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return out

    def is_gap(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 30:
            return True
        br = (r + g + b) / 3.0
        spr = max(r, g, b) - min(r, g, b)
        return br >= 100 and spr <= 40

    def is_body(x: int, y: int) -> bool:
        if not (0 <= x < w and 0 <= y < h):
            return False
        if il < x < ir and it < y < ib:
            return False
        r, g, b, a = px[x, y]
        if a < 30:
            return False
        br = (r + g + b) / 3.0
        spr = max(r, g, b) - min(r, g, b)
        return br < 95 or spr >= 40

    def sample(x0: int, y0: int, dx: int, dy: int) -> tuple[int, int, int, int] | None:
        x, y = x0, y0
        for _ in range(120):
            x += dx
            y += dy
            if not (0 <= x < w and 0 <= y < h):
                return None
            if is_body(x, y):
                ox = x - ((x0 - x) % 12)
                oy = y - ((y0 - y) % 12)
                if is_body(ox, oy):
                    return px[ox, oy]
                return px[x, y]
        return None

    def in_hole(x: int, y: int) -> bool:
        return il < x < ir and it < y < ib

    for y in range(h):
        for x in range(w):
            if in_hole(x, y) or not is_gap(x, y):
                continue
            bottom = y >= ib
            top = y <= it
            right = x >= ir
            left = x <= il
            picks: list[tuple[int, int, int, int]] = []
            if bottom or top:
                picks.append(sample(x, y, -1, 0))
                picks.append(sample(x, y, 1, 0))
            if left or right:
                picks.append(sample(x, y, 0, -1))
                picks.append(sample(x, y, 0, 1))
            if not picks:
                picks = [
                    sample(x, y, -1, 0),
                    sample(x, y, 1, 0),
                    sample(x, y, 0, -1),
                    sample(x, y, 0, 1),
                ]
            body = next((p for p in picks if p is not None), None)
            if body is not None:
                px[x, y] = body
    return out


def _clear_29kr_outer_corner_specks(img: Image.Image, corner: int = 28) -> Image.Image:
    """Dış köşede kalan bej üçgeni sil."""
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    boxes = (
        (0, 0, min(corner, w), min(corner, h)),
        (max(0, w - corner), 0, w, min(corner, h)),
        (0, max(0, h - corner), min(corner, w), h),
        (max(0, w - corner), max(0, h - corner), w, h),
    )
    for x0, y0, x1, y1 in boxes:
        for y in range(y0, y1):
            for x in range(x0, x1):
                r, g, b, a = px[x, y]
                if a < 30:
                    continue
                br = (r + g + b) / 3.0
                spr = max(r, g, b) - min(r, g, b)
                if br >= 130 and spr <= 36:
                    px[x, y] = (0, 0, 0, 0)
    return out


def _seal_frame_rail_gaps(img: Image.Image) -> Image.Image:
    """Ray bölgesindeki şeffaf iğne deliklerini doldur; nine-slice üst kenarı kırılmasın."""
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    in_hole = bytearray(w * h)
    cx, cy = w // 2, h // 2
    if px[cx, cy][3] < 30:
        q: deque[tuple[int, int]] = deque([(cx, cy)])
        while q:
            x, y = q.popleft()
            i = y * w + x
            if in_hole[i]:
                continue
            if px[x, y][3] >= 30:
                continue
            in_hole[i] = 1
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    q.append((nx, ny))
    for _ in range(8):
        for y in range(h):
            for x in range(w):
                if in_hole[y * w + x] or px[x, y][3] >= 30:
                    continue
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] >= 30 and not in_hole[ny * w + nx]:
                        px[x, y] = px[nx, ny]
                        break
    return out


def _straighten_hole_top_edge(img: Image.Image) -> Image.Image:
    """Üst iç kenarda boncuk bandını yiyen dalgalı deliği düzleştir."""
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il + 4 or ib <= it + 4:
        return out

    tops: list[int] = []
    for x in range(il + 2, ir - 1):
        y = 0
        while y < h and px[x, y][3] >= 30:
            y += 1
        tops.append(y)
    if not tops:
        return out

    target = max(tops)
    for x in range(il + 2, ir - 1):
        y = 0
        while y < h and px[x, y][3] >= 30:
            y += 1
        if y >= target:
            continue
        ref_y = target
        while ref_y < h and px[x, ref_y][3] < 30:
            ref_y += 1
        if ref_y >= h:
            continue
        ref = px[x, ref_y]
        for yy in range(y, target):
            px[x, yy] = ref

    for y in range(target, ib + 1):
        for x in range(il + 1, ir):
            px[x, y] = (0, 0, 0, 0)
    return out


def _merge_studio_outer_top_band(fa_img: Image.Image, studio_img: Image.Image, max_band: int = 42) -> Image.Image:
    """FA41 temiz ray + stüdyo çıkarımının üst dış oyma bandı."""
    merged = fa_img.convert("RGBA")
    bbox = studio_img.getbbox()
    if not bbox:
        return merged
    st_crop = studio_img.crop(bbox)
    fw, fh = merged.size
    if st_crop.width != fw:
        st_crop = st_crop.resize((fw, st_crop.height), Image.LANCZOS)
    mpx = merged.load()
    spx = st_crop.load()
    sw, sh = st_crop.size

    def top_rail(im: Image.Image) -> int:
        px = im.load()
        w, h = im.size
        y = 0
        while y < h and px[w // 2, y][3] >= 30:
            y += 1
        return y

    band = min(max_band, top_rail(merged), top_rail(st_crop))
    for y in range(band):
        for x in range(fw):
            if x < sw and spx[x, y][3] >= 30:
                mpx[x, y] = spx[x, y]
    return merged


def extract_28kr_boncuklu_gumus(img: Image.Image) -> Image.Image:
    """Gümüş boncuklu: FA41 iç delik + stüdyo üst dış profil."""
    rgba = img.convert("RGBA")
    fa = extract_fa41_product_frame(rgba)
    studio = extract_studio_wall_frame(rgba, keep_long_outer=True)
    if studio is not None:
        fa = _merge_studio_outer_top_band(fa, studio)
    out = _straighten_hole_top_edge(fa)
    return _seal_frame_rail_gaps(out)


def extract_28kr_boncuklu_wood(img: Image.Image) -> Image.Image:
    """Ceviz boncuklu: duvar flood + ray pinhole tamiri."""
    out = extract_29kr_duz_wood_on_wall(img)
    out = _seal_frame_rail_gaps(out)
    out = _trim_transparent_midline_padding(out)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
        out = _trim_transparent_midline_padding(out)
    return out


def extract_28kr_boncuklu_product(img: Image.Image, dest_name: str = "") -> Image.Image:
    """28 KR Boncuklu ürün fotoğrafı: iç boncuklu dudak korunur."""
    rgba = img.convert("RGBA")
    name = dest_name.lower()
    if "ceviz" in name:
        return extract_28kr_boncuklu_wood(rgba)
    if "altin" in name:
        return extract_29kr_duz_product(rgba)
    if "gumus" in name:
        return extract_28kr_boncuklu_gumus(rgba)
    studio = extract_studio_wall_frame(rgba, keep_long_outer=True)
    if studio is not None and _studio_extract_usable(studio):
        return _finish_29kr_duz(studio)
    wood = extract_29kr_duz_wood_on_wall(rgba)
    if _29kr_wood_usable(wood):
        return wood
    kr = extract_29kr_duz_product(rgba)
    if _studio_extract_usable(kr):
        return kr
    c34 = extract_34l_product_frame(rgba)
    if _studio_extract_usable(c34):
        return _finish_29kr_duz(c34)
    fa = extract_fa41_product_frame(rgba)
    if _studio_extract_usable(fa):
        return _finish_29kr_duz(fa)
    return _finish_29kr_duz(kr)


def extract_29kr_duz_product(img: Image.Image) -> Image.Image:
    """29 KR Düz ürün fotoğrafı: duvar + iç boncuklu dudak korunur."""
    rgba = img.convert("RGBA")
    studio = extract_studio_wall_frame(rgba, keep_long_outer=True)
    if studio is not None and _studio_extract_usable(studio):
        return _finish_29kr_duz(studio)
    wood = extract_29kr_duz_wood_on_wall(rgba)
    if _29kr_wood_usable(wood):
        return wood
    out = extract_34l_product_frame(rgba)
    return _finish_29kr_duz(peel_beige_studio_margin(out))


def _is_29kr_inner_leftover_wall(p: tuple[int, int, int]) -> bool:
    """Boncuk/oluk değil; deliğe bitişik kalan gölgeli duvar (parlak gümüş yüze girme)."""
    r, g, b = p[0], p[1], p[2]
    br = (r + g + b) / 3.0
    spr = max(r, g, b) - min(r, g, b)
    if spr > 20:
        return False
    return 96 <= br <= 152


def _punch_29kr_inner_leftover_from_hole(img: Image.Image, max_depth: int = 10) -> Image.Image:
    """Delikten en fazla max_depth px duvar sil; koyu oluk ve boncuğa dur."""
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    vis = bytearray(w * h)
    q: deque[tuple[int, int, int]] = deque()
    for y in range(h):
        row = y * w
        for x in range(w):
            if px[x, y][3] < 30:
                vis[row + x] = 1
                q.append((x, y, 0))
    while q:
        x, y, depth = q.popleft()
        if depth >= max_depth:
            continue
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            i = ny * w + nx
            if vis[i]:
                continue
            vis[i] = 1
            r, g, b, a = px[nx, ny]
            if a < 30:
                q.append((nx, ny, depth))
                continue
            if _is_29kr_inner_leftover_wall((r, g, b)):
                px[nx, ny] = (0, 0, 0, 0)
                q.append((nx, ny, depth + 1))
    return out


def _trim_transparent_midline_padding(img: Image.Image) -> Image.Image:
    """Orta eksende şeffaf dış payı kırp; nine-slice rayı 0 ölçmesin."""
    out = img.convert("RGBA")
    w, h = out.size
    px = out.load()
    cx, cy = w // 2, h // 2
    left = 0
    while left < w and px[left, cy][3] < 30:
        left += 1
    right = w - 1
    while right >= 0 and px[right, cy][3] < 30:
        right -= 1
    top = 0
    while top < h and px[cx, top][3] < 30:
        top += 1
    bottom = h - 1
    while bottom >= 0 and px[cx, bottom][3] < 30:
        bottom -= 1
    if right <= left or bottom <= top:
        return out
    if left == 0 and top == 0 and right == w - 1 and bottom == h - 1:
        return out
    return out.crop((left, top, right + 1, bottom + 1))


def _finish_29kr_duz(img: Image.Image) -> Image.Image:
    """Dış duvar/gölgeyi ve iç duvar artığını sil; dış profili ve boncuğu bırak."""
    out = _peel_29kr_outer_studio_margin(img)
    out = _punch_29kr_inner_leftover_from_hole(out)
    out = _trim_transparent_midline_padding(out)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
        out = _trim_transparent_midline_padding(out)
    return _heal_29kr_outer_corners(out)


def _peel_29kr_outer_studio_margin(img: Image.Image, max_peel: int = 90) -> Image.Image:
    """Dıştaki açık duvar ve düşen gölgeyi kırp; metal/ahşap yüze dur."""
    out = img.convert("RGBA")
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 80 or h < 80:
            break

        def wall_side(side: str) -> bool:
            med_br, med_spr = _side_mid_stats(px, w, h, side)
            return med_br >= 110 and med_spr <= 28

        cropped = False
        if wall_side("bottom"):
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        elif wall_side("right"):
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        elif wall_side("top"):
            out = out.crop((0, 1, w, h))
            cropped = True
        elif wall_side("left"):
            out = out.crop((1, 0, w, h))
            cropped = True
        if not cropped:
            break
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def extract_34l_product_frame(img: Image.Image) -> Image.Image:
    """34 L ürün fotoğrafı: duvar + paspartu; çerçeve pikselleri birebir, gölge dışarıda."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2

    def rgb(x: int, y: int) -> tuple[int, int, int]:
        r, g, b, _a = px[x, y]
        return r, g, b

    def br(x: int, y: int) -> float:
        r, g, b = rgb(x, y)
        return (r + g + b) / 3

    def spr(x: int, y: int) -> int:
        r, g, b = rgb(x, y)
        return max(r, g, b) - min(r, g, b)

    def rmb(x: int, y: int) -> int:
        r, _g, b = rgb(x, y)
        return r - b

    def in_b(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h

    def edge_wall(x0: int, y0: int, dx: int, dy: int, n: int = 10) -> float:
        vals: list[float] = []
        x, y = x0, y0
        for _ in range(n):
            if not in_b(x, y):
                break
            vals.append(br(x, y))
            x += dx
            y += dy
        if not vals:
            return 220.0
        mx = max(vals)
        return mx if mx >= 200 else sorted(vals)[len(vals) // 2]

    hole = br(cx, cy)
    wall_l = edge_wall(0, cy, 1, 0)
    wall_r = edge_wall(w - 1, cy, -1, 0)
    wall_t = edge_wall(cx, 0, 0, 1)
    wall_b = edge_wall(cx, h - 1, 0, -1)

    def classify_ahead(x: int, y: int, dx: int, dy: int) -> str:
        min_b, max_s, max_rb = 255.0, 0, 0
        xx, yy = x, y
        for _ in range(48):
            if not in_b(xx, yy):
                break
            b, s, rb = br(xx, yy), spr(xx, yy), rmb(xx, yy)
            min_b = min(min_b, b)
            max_s = max(max_s, s)
            max_rb = max(max_rb, rb)
            xx += dx
            yy += dy
        if min_b < 52:
            return "dark"
        if max_s >= 36 or max_rb >= 30:
            return "gold"
        if min_b < 100 and max_s >= 14:
            return "wood"
        if max_s >= 20:
            return "metal"
        return "white"

    def find_inner(dx: int, dy: int) -> tuple[int, int] | None:
        x, y = cx, cy
        while in_b(x, y) and abs(br(x, y) - hole) <= 12:
            x += dx
            y += dy
        if not in_b(x, y):
            return None
        side = classify_ahead(x, y, dx, dy)
        last = (x, y)
        seen_dip = False
        dip_pos = last
        for _ in range(90):
            if not in_b(x, y):
                return last
            b, s, rb = br(x, y), spr(x, y), rmb(x, y)
            if side == "dark":
                if b < 100:
                    return (x, y)
            elif side == "gold":
                if s >= 24 or (rb >= 22 and s >= 18):
                    return (x, y)
            elif side == "wood":
                if (b < 145 and s >= 12) or b < 90:
                    return (x, y)
            elif side == "metal":
                if s >= 20 or (b < 150 and s >= 14):
                    return (x, y)
            else:
                if b < 200:
                    seen_dip = True
                    dip_pos = (x, y)
                elif seen_dip and b >= 200:
                    return dip_pos
                elif b >= 232:
                    return last
            last = (x, y)
            x += dx
            y += dy
        return dip_pos if seen_dip else last

    def find_outer_from_edge(dx: int, dy: int, wall_br: float) -> tuple[int, int] | None:
        if dx == 1:
            x, y = 0, cy
        elif dx == -1:
            x, y = w - 1, cy
        elif dy == 1:
            x, y = cx, 0
        else:
            x, y = cx, h - 1
        last = (x, y)

        def step() -> bool:
            nonlocal x, y, last
            last = (x, y)
            x += dx
            y += dy
            return in_b(x, y)

        for _ in range(max(w, h)):
            if not in_b(x, y):
                return last
            b, s = br(x, y), spr(x, y)
            if wall_br >= 200:
                pale_wall = abs(b - wall_br) <= 12 and s <= 14
                drop_shadow = b >= 100 and b < 185 and s < 24
            else:
                pale_wall = False
                drop_shadow = s < 24 and 100 <= b < 200
            if pale_wall or drop_shadow:
                if not step():
                    return last
                continue
            return x, y
        return last

    ilp = find_inner(-1, 0)
    irp = find_inner(1, 0)
    itp = find_inner(0, -1)
    ibp = find_inner(0, 1)
    olp = find_outer_from_edge(1, 0, wall_l)
    orp = find_outer_from_edge(-1, 0, wall_r)
    otp = find_outer_from_edge(0, 1, wall_t)
    obp = find_outer_from_edge(0, -1, wall_b)
    if not all((ilp, irp, itp, ibp, olp, orp, otp, obp)):
        return src

    ol, ot = olp[0], otp[1]
    oright, ob = orp[0], obp[1]
    il, it = ilp[0], itp[1]
    ir, ib = irp[0], ibp[1]
    if il <= ol or ir >= oright or it <= ot or ib >= ob:
        return src
    if il - ol < 36 or it - ot < 36 or oright - ir < 36 or ob - ib < 36:
        return src

    rails = [il - ol, it - ot, oright - ir, ob - ib]
    target = min(rails)
    if il - ol > target:
        il = ol + target
    if oright - ir > target:
        ir = oright - target
    if it - ot > target:
        it = ot + target
    if ob - ib > target:
        ib = ob - target

    brs: list[float] = []
    goldish = 0
    woodish = 0
    for frac in (0.28, 0.4, 0.5, 0.62, 0.75):
        sx = int(ol + (il - ol) * frac)
        sr, sg, sb = rgb(sx, cy)
        bv = (sr + sg + sb) / 3
        brs.append(bv)
        spread = max(sr, sg, sb) - min(sr, sg, sb)
        if (sr - sb) >= 18 and spread >= 20:
            goldish += 1
        if 40 <= bv <= 140 and 12 <= spread <= 40:
            woodish += 1
    mbr = sorted(brs)[len(brs) // 2]
    if mbr < 70:
        kind = "dark"
    elif goldish >= 3:
        kind = "gold"
    elif woodish >= 3:
        kind = "wood"
    elif mbr >= 200:
        kind = "white"
    else:
        kind = "metal"

    def is_leftover_px(r: int, g: int, b: int) -> bool:
        bv = (r + g + b) / 3
        s = max(r, g, b) - min(r, g, b)
        if kind == "white":
            return False
        if kind == "dark":
            return bv >= 145 and s <= 16
        if kind == "gold":
            return bv >= 155 and s <= 20
        if kind == "wood":
            return bv >= 165 and s <= 14
        return bv >= 155 and s <= 18

    cw, ch = oright - ol + 1, ob - ot + 1
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    opx = out.load()
    for y in range(ot, ob + 1):
        for x in range(ol, oright + 1):
            if il < x < ir and it < y < ib:
                continue
            r, g, b, _a = px[x, y]
            opx[x - ol, y - ot] = (r, g, b, 255)

    def punch_and_peel(im: Image.Image) -> Image.Image:
        pxh = im.load()
        ww, hh = im.size
        hil, hit, hir, hib = _hole_bounds(pxh, ww, hh)
        if hir <= hil or hib <= hit:
            return im
        clear = (0, 0, 0, 0)

        leftover_n = 16 if kind in ("metal", "gold") else 12
        for y in range(hit, hib + 1):
            x = hil - 1
            n = 0
            while x >= 0 and n < leftover_n:
                r, g, b, a = pxh[x, y]
                if a < 30 or not is_leftover_px(r, g, b):
                    break
                pxh[x, y] = clear
                x -= 1
                n += 1
            x = hir + 1
            n = 0
            while x < ww and n < leftover_n:
                r, g, b, a = pxh[x, y]
                if a < 30 or not is_leftover_px(r, g, b):
                    break
                pxh[x, y] = clear
                x += 1
                n += 1
        for x in range(hil, hir + 1):
            y = hit - 1
            n = 0
            while y >= 0 and n < leftover_n:
                r, g, b, a = pxh[x, y]
                if a < 30 or not is_leftover_px(r, g, b):
                    break
                pxh[x, y] = clear
                y -= 1
                n += 1
            y = hib + 1
            n = 0
            while y < hh and n < leftover_n:
                r, g, b, a = pxh[x, y]
                if a < 30 or not is_leftover_px(r, g, b):
                    break
                pxh[x, y] = clear
                y += 1
                n += 1
        return im

    out = punch_and_peel(out)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    px2 = out.load()
    w2, h2 = out.size
    hil, hit, hir, hib = _hole_bounds(px2, w2, h2)
    rails = [hil, hit, w2 - 1 - hir, h2 - 1 - hib]
    if hir > hil and hib > hit and min(rails) >= 40:
        out, *_ = trim_asymmetric_rails(out, hil, hit, hir, hib)
        bbox = out.getbbox()
        if bbox:
            out = out.crop(bbox)
    return out


def extract_studio_wall_frame(img: Image.Image, keep_long_outer: bool = False) -> Image.Image | None:
    """Duvar fotoğrafından gölgesiz, şeffaf içli dikdörtgen çerçeve keser."""
    w, h = img.size
    px = img.load()
    cx, cy = w // 2, h // 2
    center = px[cx, cy][:3]
    if px[cx, cy][3] < 40:
        return None
    cbr = _px_br(center)
    if cbr < 165 or cbr > 252 or _px_spread(center) > 28:
        return None

    ys = [cy, max(h // 3, cy - h // 12), min(h - 1 - h // 3, cy + h // 12)]
    xs = [cx, max(w // 3, cx - w // 12), min(w - 1 - w // 3, cx + w // 12)]
    lefts, rights, tops, bottoms = [], [], [], []
    for y in ys:
        left = _scan_studio_inner(px, cx, y, -1, 0, w, h, center)
        right = _scan_studio_inner(px, cx, y, 1, 0, w, h, center)
        if left is not None:
            lefts.append(left)
        if right is not None:
            rights.append(right)
    for x in xs:
        top = _scan_studio_inner(px, x, cy, 0, -1, w, h, center)
        bottom = _scan_studio_inner(px, x, cy, 0, 1, w, h, center)
        if top is not None:
            tops.append(top)
        if bottom is not None:
            bottoms.append(bottom)
    if not (lefts and rights and tops and bottoms):
        return None

    il, ir, it, ib = _median_i(lefts), _median_i(rights), _median_i(tops), _median_i(bottoms)
    if ir - il < w * 0.2 or ib - it < h * 0.2:
        return None

    walls = {s: _sample_centerish_wall(px, w, h, s, center) for s in ("left", "right", "top", "bottom")}
    ol = _scan_studio_outer(px, il, cy, -1, 0, w, h, walls["left"], center)
    oright = _scan_studio_outer(px, ir, cy, 1, 0, w, h, walls["right"], center)
    ot = _scan_studio_outer(px, cx, it, 0, -1, w, h, walls["top"], center)
    ob = _scan_studio_outer(px, cx, ib, 0, 1, w, h, walls["bottom"], center)

    # Fotoğraf kenarına taşmış (kırpılmış) kenarları typical ray hesabına katma.
    good_rails: list[int] = []
    if walls["left"] is not None and ol is not None:
        good_rails.append(il - ol)
    if walls["top"] is not None and ot is not None:
        good_rails.append(it - ot)
    if walls["right"] is not None and oright is not None:
        good_rails.append(oright - ir)
    if walls["bottom"] is not None and ob is not None:
        good_rails.append(ob - ib)
    typical = _pick_studio_rail([r for r in good_rails if r >= 40])
    if typical is None:
        typical = _pick_studio_rail(good_rails)
    if typical is None:
        return None

    def _outer(detected: int | None, inner: int, toward_min: bool) -> int:
        guessed = inner - typical if toward_min else inner + typical
        if detected is None:
            return guessed
        rail = inner - detected if toward_min else detected - inner
        if rail < typical * 0.45:
            return guessed
        if rail > typical * 1.18:
            # İçte karton kalmışsa dış altını kesme; delik sonra içeri genişler.
            return detected if keep_long_outer else guessed
        return detected

    inset = 0 if keep_long_outer else 3
    ol = max(0, _outer(ol, il, True) + inset)
    ot = max(0, _outer(ot, it, True) + inset)
    oright = min(w - 1, _outer(oright, ir, False) - inset)
    ob = min(h - 1, _outer(ob, ib, False) - inset)
    if oright - ol < 40 or ob - ot < 40:
        return None

    cropped = img.crop((ol, ot, oright + 1, ob + 1)).copy()
    cw, ch = cropped.size
    il -= ol
    ir -= ol
    it -= ot
    ib -= ot
    opx = cropped.load()
    # Dudağı bırak: delik iç dudağın hemen içinden başlar.
    for y in range(ch):
        for x in range(cw):
            if il < x < ir and it < y < ib:
                opx[x, y] = (0, 0, 0, 0)
    cropped = expand_hole_through_insert(cropped, center)
    cropped = peel_outer_studio_wall(cropped, center)
    cropped = clear_corner_studio_wall(cropped, center)
    cw, ch = cropped.size
    cpx = cropped.load()
    hil, hit, hir, hib = detect_hole_bounds(cpx, cw, ch)
    if hir > hil and hib > hit and not keep_long_outer:
        cropped, hil, hit, hir, hib = trim_asymmetric_rails(cropped, hil, hit, hir, hib)
    bbox = cropped.getbbox()
    if bbox:
        cropped = cropped.crop(bbox)
    return cropped


def extract_fa52_product_frame(img: Image.Image) -> Image.Image:
    """FA 52 ürün fotoğrafı: dış kenarı ve iç profil çizgilerini kesmeden çıkar."""
    src = img.convert("RGBA")
    w, h = src.size
    px = src.load()
    cx, cy = w // 2, h // 2
    center = px[cx, cy][:3]
    cbr = _px_br(center)

    def is_insert(p: tuple[int, int, int]) -> bool:
        dist = _color_dist(p, center)
        br = _px_br(p)
        spr = _px_spread(p)
        # Siyah dolgulu çekim: yalnız koyu insert; krem dudağı/oluğu yeme.
        if cbr < 80:
            return br < 80
        if spr >= 26:
            return False
        if br < 160 and dist >= 18:
            return False
        if dist < 26:
            return True
        if br >= 175 and spr < 14:
            return True
        return False

    def first_inner(dx: int, dy: int, ox: int, oy: int) -> int | None:
        x, y = ox, oy
        last = x if dx else y
        streak = 0
        steps = 0
        while 0 < x < w - 1 and 0 < y < h - 1 and steps < max(w, h):
            x += dx
            y += dy
            steps += 1
            coord = x if dx else y
            if is_insert(px[x, y][:3]):
                streak = 0
                last = coord
                continue
            streak += 1
            if streak >= 3:
                return coord - 2 * dx if dx else coord - 2 * dy
        return last if last != (ox if dx else oy) else None

    def median_inner(dx: int, dy: int) -> int:
        samples: list[int] = []
        if dx:
            for i in range(3, 8):
                yy = cy + (h // 16) * (i - 5)
                yy = min(max(yy, 8), h - 9)
                v = first_inner(dx, 0, cx, yy)
                if v is not None:
                    samples.append(v)
        else:
            for i in range(3, 8):
                xx = cx + (w // 16) * (i - 5)
                xx = min(max(xx, 8), w - 9)
                v = first_inner(0, dy, xx, cy)
                if v is not None:
                    samples.append(v)
        if not samples:
            v = first_inner(dx, dy, cx, cy)
            return v if v is not None else (cx if dx else cy)
        samples.sort()
        return samples[len(samples) // 2]

    il, ir, it, ib = median_inner(-1, 0), median_inner(1, 0), median_inner(0, -1), median_inner(0, 1)
    if ir - il < w * 0.18 or ib - it < h * 0.18:
        return extract_34l_product_frame(src)

    bg = sample_border_background(px, w, h)
    bg_br = _px_br(bg)

    def is_margin(p: tuple[int, int, int]) -> bool:
        """Yalnızca stüdyo fonu; açık renk çerçeve dudağına girme."""
        if _px_spread(p) >= 14:
            return False
        br = _px_br(p)
        dist = _color_dist(p, bg)
        if dist < 12 and abs(br - bg_br) < 8:
            return True
        if bg_br >= 248 and br >= 248 and dist < 10:
            return True
        return False

    def first_outer(start_x: int, start_y: int, dx: int, dy: int, inner: int) -> int:
        x, y = start_x, start_y
        edge = x if dx else y
        while 0 <= x < w and 0 <= y < h:
            coord = x if dx else y
            if (dx > 0 and coord >= inner) or (dx < 0 and coord <= inner) or (
                dy > 0 and coord >= inner
            ) or (dy < 0 and coord <= inner):
                return edge
            p = px[x, y][:3]
            if not is_margin(p):
                return coord
            x += dx
            y += dy
        return edge

    ol = first_outer(0, cy, 1, 0, il)
    oright = first_outer(w - 1, cy, -1, 0, ir)
    ot = first_outer(cx, 0, 0, 1, it)
    ob = first_outer(cx, h - 1, 0, -1, ib)

    if oright - ol < 40 or ob - ot < 40:
        return extract_34l_product_frame(src)

    cropped = src.crop((ol, ot, oright + 1, ob + 1)).copy()
    il -= ol
    ir -= ol
    it -= ot
    ib -= ot
    cw, ch = cropped.size
    opx = cropped.load()
    clear = (0, 0, 0, 0)
    # İç dudağın ilk pikselini bırak; sadece karton/insert'i sil.
    for y in range(it + 1, ib):
        for x in range(il + 1, ir):
            opx[x, y] = clear
    return cropped


def _median_rgb(samples: list[tuple[int, int, int]]) -> tuple[int, int, int]:
    rs, gs, bs = zip(*samples)
    n = len(samples) // 2
    return (sorted(rs)[n], sorted(gs)[n], sorted(bs)[n])


def sample_border_background(px, w: int, h: int) -> tuple[int, int, int]:
    pts = [
        (8, 8),
        (w // 2, 8),
        (w - 9, 8),
        (8, h // 2),
        (w - 9, h // 2),
        (8, h - 9),
        (w // 2, h - 9),
        (w - 9, h - 9),
    ]
    samples = [px[min(max(x, 0), w - 1), min(max(y, 0), h - 1)][:3] for x, y in pts]
    return _median_rgb(samples)


def flood_similar_mask(
    px, w: int, h: int, seeds: list[tuple[int, int]], tol: int, ref_color: tuple[int, int, int] | None = None
) -> bytearray:
    vis = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for sx, sy in seeds:
        if 0 <= sx < w and 0 <= sy < h:
            i = sy * w + sx
            if vis[i]:
                continue
            vis[i] = 1
            q.append((sx, sy))
    while q:
        x, y = q.popleft()
        ref = ref_color or px[x, y][:3]
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            i = ny * w + nx
            if vis[i]:
                continue
            r, g, b, a = px[nx, ny]
            if a < 50:
                vis[i] = 1
                q.append((nx, ny))
                continue
            if abs(r - ref[0]) <= tol and abs(g - ref[1]) <= tol and abs(b - ref[2]) <= tol:
                vis[i] = 1
                q.append((nx, ny))
    return vis


def clear_studio_backdrop(img: Image.Image) -> Image.Image:
    """Gri stüdyo duvarını ve iç boşluğu şeffaflaştır; beyaz karton çekimlerine dokunma."""
    w, h = img.size
    if w < 40 or h < 40:
        return img
    px = img.load()
    bg = sample_border_background(px, w, h)
    bg_br = sum(bg) / 3
    bg_spread = max(bg) - min(bg)
    if bg_br > 247 or bg_br < 165 or bg_spread > 22:
        return img

    cx, cy = w // 2, h // 2
    border_seeds = [
        (8, 8),
        (w // 2, 8),
        (w - 9, 8),
        (8, h // 2),
        (w - 9, h // 2),
        (8, h - 9),
        (w // 2, h - 9),
        (w - 9, h - 9),
    ]
    outer = flood_similar_mask(px, w, h, border_seeds, tol=12, ref_color=bg)
    inner_ref = px[cx, cy][:3]
    inner = flood_similar_mask(px, w, h, [(cx, cy)], tol=14, ref_color=inner_ref)
    out = img.copy()
    opx = out.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if outer[row + x] or inner[row + x]:
                r, g, b, _a = opx[x, y]
                opx[x, y] = (r, g, b, 0)
    return out


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


def _hole_bounds(px, w: int, h: int) -> tuple[int, int, int, int]:
    cx, cy = w // 2, h // 2

    def is_hole(x: int, y: int) -> bool:
        return px[x, y][3] < 30

    il = 0
    while il < w and not is_hole(il, cy):
        il += 1
    ir = w - 1
    while ir >= 0 and not is_hole(ir, cy):
        ir -= 1
    it = 0
    while it < h and not is_hole(cx, it):
        it += 1
    ib = h - 1
    while ib >= 0 and not is_hole(cx, ib):
        ib -= 1
    return il, it, ir, ib


def expand_hole_inward(
    img: Image.Image,
    top: int,
    right: int,
    bottom: int,
    left: int,
    equalize: str = "outer",
) -> Image.Image:
    """Deliği içeri büyüt; kalan gri/krem iç bandı fotoğrafın altına alır."""
    if top <= 0 and right <= 0 and bottom <= 0 and left <= 0 and equalize == "none":
        return img
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img

    il = max(0, il - max(0, left))
    it = max(0, it - max(0, top))
    ir = min(w - 1, ir + max(0, right))
    ib = min(h - 1, ib + max(0, bottom))
    out = img.copy()
    opx = out.load()
    for y in range(it, ib + 1):
        for x in range(il, ir + 1):
            opx[x, y] = (0, 0, 0, 0)

    if equalize == "inner":
        w, h = out.size
        opx = out.load()
        il, it, ir, ib = _hole_bounds(opx, w, h)
        left_r, top_r, right_r, bottom_r = il, it, w - 1 - ir, h - 1 - ib
        m = min(left_r, top_r, right_r, bottom_r)
        if m > 0:
            il = max(0, il - (left_r - m))
            it = max(0, it - (top_r - m))
            ir = min(w - 1, ir + (right_r - m))
            ib = min(h - 1, ib + (bottom_r - m))
            for y in range(it, ib + 1):
                for x in range(il, ir + 1):
                    opx[x, y] = (0, 0, 0, 0)
    elif equalize == "outer":
        out, il, it, ir, ib = trim_asymmetric_rails(out, il, it, ir, ib)

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def _haze_walk(
    px, x: int, y: int, dx: int, dy: int, limit: int, is_haze, w: int, h: int
) -> int:
    if x < 0 or y < 0 or x >= w or y >= h:
        return 0
    r0, g0, b0, a0 = px[x, y]
    if a0 < 30:
        return 0
    start_br = _px_br((r0, g0, b0))
    dist = 0
    while dist < limit:
        if x < 0 or y < 0 or x >= w or y >= h:
            break
        r, g, b, a = px[x, y]
        if a < 30:
            break
        p = (r, g, b)
        br = _px_br(p)
        if br > start_br + 14:
            break
        if not is_haze(br, _px_spread(p), p):
            break
        dist += 1
        x += dx
        y += dy
    return dist


def _side_haze_depth(
    px, w: int, h: int, il: int, it: int, ir: int, ib: int, side: str, is_haze, max_d: int, pct: float
) -> int:
    depths: list[int] = []
    if side in ("top", "bottom"):
        xs = [il + (ir - il) * i // 8 for i in range(2, 7)]
        for x in xs:
            if side == "top":
                depths.append(_haze_walk(px, x, it - 1, 0, -1, min(max_d, it), is_haze, w, h))
            else:
                depths.append(_haze_walk(px, x, ib + 1, 0, 1, min(max_d, h - 1 - ib), is_haze, w, h))
    else:
        ys = [it + (ib - it) * i // 8 for i in range(2, 7)]
        for y in ys:
            if side == "left":
                depths.append(_haze_walk(px, il - 1, y, -1, 0, min(max_d, il), is_haze, w, h))
            else:
                depths.append(_haze_walk(px, ir + 1, y, 1, 0, min(max_d, w - 1 - ir), is_haze, w, h))
    if not depths:
        return 0
    depths.sort()
    idx = min(len(depths) - 1, max(0, round((len(depths) - 1) * pct)))
    return depths[idx]


def expand_studio_inner_haze(img: Image.Image, kind: str, equalize: str = "outer") -> Image.Image:
    """Yalnızca sorunlu 35 lik / 34 L renklerde iç karton/gri bandı deliğe katar."""
    if kind == "altin":
        is_haze = lambda br, spr, _p: spr < 26 and br > 55
        max_d, pct = 70, 0.5
    elif kind == "lacivert":
        is_haze = lambda br, spr, _p: spr < 24 and br > 80
        max_d, pct = 22, 0.5
    elif kind == "pale":
        is_haze = lambda br, spr, _p: br > 185 and spr < 28
        max_d, pct = 22, 0.5
    elif kind == "cream-lip":
        # Oksit gümüş: karton 110–185, çerçeve gövdesi chroma ≥ 38.
        is_haze = lambda br, spr, _p: br > 110 and spr < 38
        max_d, pct = 28, 0.5
    elif kind == "grey-mat":
        # Altın sağ iç: nötr karton br~195→130; altın dudağı chroma ≥ 36.
        is_haze = lambda br, spr, _p: br > 120 and spr < 34
        max_d, pct = 56, 0.7
    elif kind == "eskitme":
        # Yalnızca stüdyo kartonu; iç altın dudağı ve siyah damarı yeme.
        is_haze = lambda br, spr, _p: br > 135 and spr < 34
        max_d, pct = 36, 0.55
    elif kind == "grey-lip":
        # Siyah iç oluk: nötr gri dudağı koyu gövdeye kadar al.
        is_haze = lambda br, spr, _p: br > 70 and spr < 22
        max_d, pct = 22, 0.5
    elif kind == "bronz-right":
        # Bronz sağ iç: nötr gri bant, altın gövde chroma > 40.
        is_haze = lambda br, spr, _p: spr < 40 and br > 75
        max_d, pct = 24, 0.5
    elif kind == "beyaz":
        return _expand_beyaz_inner(img)
    elif kind == "34-beyaz":
        return _expand_34_beyaz_inner(img)
    elif kind == "fa52-beyaz":
        return _expand_fa52_beyaz_inner(img)
    else:
        return img

    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img
    top = _side_haze_depth(px, w, h, il, it, ir, ib, "top", is_haze, max_d, pct)
    right = _side_haze_depth(px, w, h, il, it, ir, ib, "right", is_haze, max_d, pct)
    bottom = _side_haze_depth(px, w, h, il, it, ir, ib, "bottom", is_haze, max_d, pct)
    left = _side_haze_depth(px, w, h, il, it, ir, ib, "left", is_haze, max_d, pct)
    return expand_hole_inward(img, top, right, bottom, left, equalize=equalize)


def _expand_fa52_beyaz_inner(img: Image.Image) -> Image.Image:
    """FA 52 beyaz: yalnız parlak insert artığını al; iç dudağı ve oluğu bırak."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img
    cx = (il + ir) // 2
    cy = (it + ib) // 2

    def walk(get, start: int, step: int, limit: int) -> int:
        coord = start + step
        eaten = 0
        last = start
        while eaten < 20:
            if (step < 0 and coord < limit) or (step > 0 and coord > limit):
                break
            r, g, b, a = get(coord)
            if a < 50:
                break
            br = (r + g + b) / 3
            spr = max(r, g, b) - min(r, g, b)
            if br < 182 or spr > 16:
                break
            last = coord
            coord += step
            eaten += 1
        return last

    it2 = walk(lambda y: px[cx, y], it, -1, 0)
    ib2 = walk(lambda y: px[cx, y], ib, 1, h - 1)
    il2 = walk(lambda x: px[x, cy], il, -1, 0)
    ir2 = walk(lambda x: px[x, cy], ir, 1, w - 1)
    return expand_hole_inward(img, it - it2, ir2 - ir, ib2 - ib, il - il2, equalize="none")


def thicken_inner_cream_lip(img: Image.Image, pad: int = 20) -> Image.Image:
    """İç krem dudağı deliğe doğru kalınlaştır; oluk fotoğrafın yanında gri halka olmasın."""
    out = img.convert("RGBA").copy()
    px = out.load()
    w, h = out.size
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir - il < pad * 2 + 16 or ib - it < pad * 2 + 16:
        return img
    cx, cy = (il + ir) // 2, (it + ib) // 2

    def cream_row_y(start: int, step: int, limit: int) -> int:
        y = start + step
        fallback = start + step
        for _ in range(28):
            if (step < 0 and y < limit) or (step > 0 and y > limit):
                break
            r, g, b, a = px[cx, y]
            if a >= 50:
                br = (r + g + b) / 3
                if 148 <= br <= 178:
                    return y
                fallback = y
            y += step
        return fallback

    def cream_col_x(start: int, step: int, limit: int) -> int:
        x = start + step
        fallback = start + step
        for _ in range(28):
            if (step < 0 and x < limit) or (step > 0 and x > limit):
                break
            r, g, b, a = px[x, cy]
            if a >= 50:
                br = (r + g + b) / 3
                if 148 <= br <= 178:
                    return x
                fallback = x
            x += step
        return fallback

    src_t = cream_row_y(it, -1, 0)
    src_b = cream_row_y(ib, 1, h - 1)
    src_l = cream_col_x(il, -1, 0)
    src_r = cream_col_x(ir, 1, w - 1)

    for d in range(pad):
        y = it + d
        for x in range(il, ir + 1):
            px[x, y] = px[x, src_t]
        y = ib - d
        for x in range(il, ir + 1):
            px[x, y] = px[x, src_b]
        x = il + d
        for y in range(it, ib + 1):
            px[x, y] = px[src_l, y]
        x = ir - d
        for y in range(it, ib + 1):
            px[x, y] = px[src_r, y]
    return out


def _expand_beyaz_inner(img: Image.Image) -> Image.Image:
    """Karton beyazını ve girintili kenarı al; krem çerçeve yüzünü bırak."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img

    def is_cardboard(br: float, spr: int, _p) -> bool:
        return br > 218 and spr < 25

    def is_light_band(br: float, spr: int, _p) -> bool:
        return br > 198 and spr < 22

    top = _side_haze_depth(px, w, h, il, it, ir, ib, "top", is_cardboard, 12, 0.5)
    right = max(
        _side_haze_depth(px, w, h, il, it, ir, ib, "right", is_cardboard, 12, 0.5),
        _side_haze_depth(px, w, h, il, it, ir, ib, "right", is_light_band, 8, 0.5),
    )
    bottom = _side_haze_depth(px, w, h, il, it, ir, ib, "bottom", is_cardboard, 16, 0.5)
    left = _side_haze_depth(px, w, h, il, it, ir, ib, "left", is_cardboard, 12, 0.5)

    def hole(x: int, y: int) -> bool:
        return px[x, y][3] < 30

    left_xs = []
    for y in range(it + 4, ib - 3, 6):
        x = il
        while x > 0 and hole(x, y):
            x -= 1
        left_xs.append(x)
    right_xs = []
    for y in range(it + 4, ib - 3, 6):
        x = ir
        while x < w - 1 and hole(x, y):
            x += 1
        right_xs.append(x)
    if left_xs:
        left = max(left, max(0, il - min(left_xs) - 1))
    if right_xs:
        right = max(right, max(0, max(right_xs) - ir - 1))
    return expand_hole_inward(img, top, right, bottom, left)


def _expand_34_beyaz_inner(img: Image.Image) -> Image.Image:
    """34 L beyaz: sağdaki oluğa ve üstteki gri dudağa kadar; krem yüzü bırak."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img

    def is_grey_lip(br: float, spr: int, _p) -> bool:
        return 168 < br < 205 and spr < 22

    def is_to_groove(br: float, spr: int, _p) -> bool:
        return br > 132 and spr < 22

    def is_cardboard(br: float, spr: int, _p) -> bool:
        return br > 218 and spr < 16

    top = _side_haze_depth(px, w, h, il, it, ir, ib, "top", is_grey_lip, 8, 0.5)
    right = max(
        _side_haze_depth(px, w, h, il, it, ir, ib, "right", is_grey_lip, 8, 0.5),
        _side_haze_depth(px, w, h, il, it, ir, ib, "right", is_to_groove, 14, 0.5),
    )
    bottom = max(
        _side_haze_depth(px, w, h, il, it, ir, ib, "bottom", is_cardboard, 8, 0.5),
        _side_haze_depth(px, w, h, il, it, ir, ib, "bottom", lambda br, spr, _p: br > 205 and spr < 20, 8, 0.5),
    )
    left = max(
        _side_haze_depth(px, w, h, il, it, ir, ib, "left", is_cardboard, 8, 0.5),
        _side_haze_depth(px, w, h, il, it, ir, ib, "left", lambda br, spr, _p: br > 205 and spr < 20, 8, 0.5),
    )
    return expand_hole_inward(img, top, right, bottom, left)


def _side_mid_stats(px, w: int, h: int, side: str) -> tuple[float, int]:
    if side == "top":
        samples = [px[x, 0] for x in range(w // 4, (3 * w) // 4, 2)]
    elif side == "bottom":
        samples = [px[x, h - 1] for x in range(w // 4, (3 * w) // 4, 2)]
    elif side == "left":
        samples = [px[0, y] for y in range(h // 4, (3 * h) // 4, 2)]
    else:
        samples = [px[w - 1, y] for y in range(h // 4, (3 * h) // 4, 2)]
    opaque = [(r, g, b) for r, g, b, a in samples if a >= 30]
    if len(opaque) < 6:
        return 0.0, 99
    brs = sorted(_px_br(p) for p in opaque)
    sprs = sorted(_px_spread(p) for p in opaque)
    return brs[len(brs) // 2], sprs[len(sprs) // 2]


def peel_leftover_pale_outer(img: Image.Image, max_peel: int = 14) -> Image.Image:
    """Stüdyo duvarı kalan açık kenarı kırp; beyaz/krem çerçeve yüzüne girme."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img

    inner_samples: list[float] = []
    cx, cy = w // 2, h // 2
    for d in (8, 16, 24):
        if it - d > 0:
            inner_samples.append(_px_br(px[cx, it - d][:3]))
        if ib + d < h - 1:
            inner_samples.append(_px_br(px[cx, ib + d][:3]))
        if il - d > 0:
            inner_samples.append(_px_br(px[il - d, cy][:3]))
        if ir + d < w - 1:
            inner_samples.append(_px_br(px[ir + d, cy][:3]))
    inner_samples = [b for b in inner_samples if b > 0]
    if not inner_samples:
        return img
    inner_face = sorted(inner_samples)[len(inner_samples) // 2]
    if inner_face > 175:
        return img

    cut = max(inner_face + 45, 150)

    def should_peel(side: str) -> bool:
        med_br, med_spr = _side_mid_stats(px, w, h, side)
        if med_spr > 28:
            return False
        return med_br >= cut or (med_br > 190 and med_spr < 22)

    out = img
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 40 or h < 40:
            break
        cropped = False
        if should_peel("top"):
            out = out.crop((0, 1, w, h))
            cropped = True
        elif should_peel("bottom"):
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        elif should_peel("left"):
            out = out.crop((1, 0, w, h))
            cropped = True
        elif should_peel("right"):
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        if not cropped:
            break
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def peel_to_dark_outer_rim(img: Image.Image, max_peel: int = 18, min_br: float = 118) -> Image.Image:
    """Açık stüdyo duvarını koyu dış fitile kadar kırp."""
    out = img
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 40 or h < 40:
            break

        def pale_wall(side: str) -> bool:
            med_br, med_spr = _side_mid_stats(px, w, h, side)
            return med_br > min_br and med_spr < 50

        cropped = False
        if pale_wall("left"):
            out = out.crop((1, 0, w, h))
            cropped = True
        elif pale_wall("right"):
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        elif pale_wall("top"):
            out = out.crop((0, 1, w, h))
            cropped = True
        elif pale_wall("bottom"):
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        if not cropped:
            break
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def peel_dark_studio_outer(img: Image.Image, min_cream_br: float = 145, max_peel: int = 24) -> Image.Image:
    """FA 52 beyaz: siyah/gri stüdyo kenarını krem dış dudağa kadar soy."""
    out = img.convert("RGBA")
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 40 or h < 40:
            break
        cropped = False
        med_br, _ = _side_mid_stats(px, w, h, "bottom")
        if med_br < min_cream_br:
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        elif _side_mid_stats(px, w, h, "left")[0] < min_cream_br:
            out = out.crop((1, 0, w, h))
            cropped = True
        elif _side_mid_stats(px, w, h, "right")[0] < min_cream_br:
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        elif _side_mid_stats(px, w, h, "top")[0] < min_cream_br:
            out = out.crop((0, 1, w, h))
            cropped = True
        if not cropped:
            break

    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            if 4 <= x < w - 4 and 4 <= y < h - 4:
                continue
            r, g, b, a = px[x, y]
            if a >= 30 and (r + g + b) / 3 < 80:
                px[x, y] = (0, 0, 0, 0)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def peel_neutral_studio_margin(img: Image.Image, max_peel: int = 18) -> Image.Image:
    """Beyaz duvar ve nötr stüdyo gölgesini kırp; ahşap dış fitile dokunma."""
    out = img
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 40 or h < 40:
            break

        def leftover(side: str) -> bool:
            if side == "top":
                samples = [px[x, 0][:3] for x in range(w // 4, (3 * w) // 4, 2) if px[x, 0][3] >= 30]
            elif side == "bottom":
                samples = [px[x, h - 1][:3] for x in range(w // 4, (3 * w) // 4, 2) if px[x, h - 1][3] >= 30]
            elif side == "left":
                samples = [px[0, y][:3] for y in range(h // 4, (3 * h) // 4, 2) if px[0, y][3] >= 30]
            else:
                samples = [px[w - 1, y][:3] for y in range(h // 4, (3 * h) // 4, 2) if px[w - 1, y][3] >= 30]
            if len(samples) < 6:
                return False
            brs = sorted(_px_br(p) for p in samples)
            sprs = sorted(_px_spread(p) for p in samples)
            warms = sorted(_px_warmth(p) for p in samples)
            med_br = brs[len(brs) // 2]
            med_spr = sprs[len(sprs) // 2]
            med_w = warms[len(warms) // 2]
            if med_br > 228 and med_spr < 22:
                return True
            return med_br > 112 and med_spr < 14 and med_w <= 12

        cropped = False
        if leftover("top"):
            out = out.crop((0, 1, w, h))
            cropped = True
        elif leftover("bottom"):
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        elif leftover("left"):
            out = out.crop((1, 0, w, h))
            cropped = True
        elif leftover("right"):
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        if not cropped:
            break
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def _stain_pale_white_outers(img: Image.Image, depth: int = 10) -> Image.Image:
    """Üst/sol dış pahı sağ-alt gölge rengine çek; gri zeminde kaybolmasın."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    if w < 40 or h < 40:
        return out
    cx, cy = w // 2, h // 2
    refs: list[tuple[int, int, int]] = []
    for i in range(8):
        pr = px[max(0, w - 1 - i), cy]
        pb = px[cx, max(0, h - 1 - i)]
        if pr[3] >= 30:
            refs.append(pr[:3])
        if pb[3] >= 30:
            refs.append(pb[:3])
    if not refs:
        return out
    ref = _median_rgb(refs)
    for y in range(min(depth, h)):
        t = (depth - y) / depth * 0.62
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 30:
                continue
            px[x, y] = (
                int(r * (1 - t) + ref[0] * t),
                int(g * (1 - t) + ref[1] * t),
                int(b * (1 - t) + ref[2] * t),
                a,
            )
    for x in range(min(depth, w)):
        t = (depth - x) / depth * 0.62
        for y in range(h):
            r, g, b, a = px[x, y]
            if a < 30:
                continue
            px[x, y] = (
                int(r * (1 - t) + ref[0] * t),
                int(g * (1 - t) + ref[1] * t),
                int(b * (1 - t) + ref[2] * t),
                a,
            )
    return out


def stain_lit_wood_outers(img: Image.Image, depth: int = 8) -> Image.Image:
    """Üst/sol açık dış highlight'ı koyu fitile çek; gri zeminde kaybolmasın."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    if w < 40 or h < 40:
        return out
    cx, cy = w // 2, h // 2
    darks: list[tuple[int, int, int]] = []
    for y in range(max(0, h - 28), h):
        p = px[cx, y]
        if p[3] >= 30 and _px_br(p[:3]) < 55:
            darks.append(p[:3])
    for x in range(max(0, w - 28), w):
        p = px[x, cy]
        if p[3] >= 30 and _px_br(p[:3]) < 55:
            darks.append(p[:3])
    if not darks:
        return out
    ref = _median_rgb(darks)
    for y in range(min(depth, h)):
        t = (depth - y) / depth * 0.72
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 30 or _px_br((r, g, b)) < 90:
                continue
            px[x, y] = (
                int(r * (1 - t) + ref[0] * t),
                int(g * (1 - t) + ref[1] * t),
                int(b * (1 - t) + ref[2] * t),
                a,
            )
    for x in range(min(depth, w)):
        t = (depth - x) / depth * 0.55
        for y in range(h):
            r, g, b, a = px[x, y]
            if a < 30 or _px_br((r, g, b)) < 90:
                continue
            px[x, y] = (
                int(r * (1 - t) + ref[0] * t),
                int(g * (1 - t) + ref[1] * t),
                int(b * (1 - t) + ref[2] * t),
                a,
            )
    return out


def prepend_bottom_outer_shadow(img: Image.Image, n: int = 5) -> Image.Image:
    """Üstte stüdyo gölgesi yoksa alttaki dış gölge şeridini üste ekle (tüm rayı kopyalama)."""
    _left, top, _right, bottom = _measure_rails(img)
    if min(top, bottom) <= 0:
        return img
    w, h = img.size
    n = max(3, min(n, bottom // 6, 8))
    strip = img.crop((0, h - n, w, h)).transpose(Image.FLIP_TOP_BOTTOM)
    out = Image.new("RGBA", (w, h + n), (0, 0, 0, 0))
    out.paste(strip, (0, 0))
    out.paste(img, (0, n), img)
    return out


def pad_inner_lip_from_opposite(img: Image.Image) -> Image.Image:
    """İnce sağ/alt iç dudağı karşı rayın iç profilinden tamamla; dış pahı çoğaltma."""
    left, top, right, bottom = _measure_rails(img)
    if min(left, top, right, bottom) <= 0:
        return img
    pad_r = max(0, left - right)
    pad_b = max(0, top - bottom)
    if pad_r == 0 and pad_b == 0:
        return img
    out = img.copy()
    px = out.load()
    src = img.load()
    w, h = out.size
    il, it, ir, ib = _hole_bounds(src, w, h)
    if pad_r > 0 and pad_r < left and ir - pad_r > il:
        for y in range(it, ib + 1):
            for i in range(pad_r):
                sx = il - 1 - i
                dx = ir - i
                if 0 <= sx < w and 0 <= dx < w:
                    px[dx, y] = src[sx, y]
    src = out.load()
    il, it, ir, ib = _hole_bounds(src, w, h)
    if pad_b > 0 and pad_b < top and ib - pad_b > it:
        for x in range(il, ir + 1):
            for i in range(pad_b):
                sy = it - 1 - i
                dy = ib - i
                if 0 <= sy < h and 0 <= dy < h:
                    px[x, dy] = src[x, sy]
    return out


def replace_top_rail_from_bottom(img: Image.Image) -> Image.Image:
    """Kesik üst rayı alttaki tam profilin dikey aynası ile değiştir; kalınlık eşitlenir."""
    _left, top, _right, bottom = _measure_rails(img)
    if min(top, bottom) <= 0:
        return img
    w, h = img.size
    rest = img.crop((0, top, w, h))
    bot = img.crop((0, h - bottom, w, h)).transpose(Image.FLIP_TOP_BOTTOM)
    out = Image.new("RGBA", (w, rest.height + bottom), (0, 0, 0, 0))
    out.paste(bot, (0, 0))
    out.paste(rest, (0, bottom), rest)
    return out


def replace_left_rail_from_right(img: Image.Image) -> Image.Image:
    """İnce/soluk sol rayı sağdaki tam profilin yatay aynası ile değiştir."""
    left, _top, right, _bottom = _measure_rails(img)
    if min(left, right) <= 0:
        return img
    w, h = img.size
    rest = img.crop((left, 0, w, h))
    src = img.crop((w - right, 0, w, h)).transpose(Image.FLIP_LEFT_RIGHT)
    out = Image.new("RGBA", (rest.width + right, h), (0, 0, 0, 0))
    out.paste(src, (0, 0))
    out.paste(rest, (right, 0), rest)
    return out


def replace_right_rail_from_left(img: Image.Image) -> Image.Image:
    """Ekran görüntüsünde kesilmiş sağ rayı sol profilin yatay aynası ile tamamla."""
    left, _top, right, _bottom = _measure_rails(img)
    if min(left, right) <= 0 or right >= left - 2:
        return img
    w, h = img.size
    rest = img.crop((0, 0, w - right, h))
    src = img.crop((0, 0, left, h)).transpose(Image.FLIP_LEFT_RIGHT)
    out = Image.new("RGBA", (rest.width + left, h), (0, 0, 0, 0))
    out.paste(rest, (0, 0), rest)
    out.paste(src, (rest.width, 0))
    return out


def restore_cropped_top_from_bottom(img: Image.Image, n: int = 10) -> Image.Image:
    """Üst dış fitili kesilmişse alttaki koyu dış şeridi çevirip üste ekle."""
    w, h = img.size
    px = img.load()
    cx = w // 2

    def br(y: int) -> float:
        r, g, b, _a = px[cx, y]
        return (r + g + b) / 3

    top0 = 0
    while top0 < 8 and br(top0) > 120:
        top0 += 1
    work = img.crop((0, top0, w, h)) if top0 else img
    w, h = work.size
    px = work.load()
    cx = w // 2

    def br2(y: int) -> float:
        r, g, b, _a = px[cx, y]
        return (r + g + b) / 3

    y = h - 1
    while y > h - 24 and br2(y) > 90:
        y -= 1
    end = min(h, y + 3)
    start = max(0, y - (n - 1))
    if end - start < 4:
        return img
    bot = work.crop((0, start, w, end)).transpose(Image.FLIP_TOP_BOTTOM)
    nh = bot.height
    out = Image.new("RGBA", (w, h + nh), (0, 0, 0, 0))
    out.paste(bot, (0, 0), bot)
    out.paste(work, (0, nh), work)
    return out


def pad_thin_outers_from_opposite(img: Image.Image) -> Image.Image:
    """Eksik sağ/alt dış pahı karşı rayın dış şeridinden tamamla; iç profili ezme."""
    left, top, right, bottom = _measure_rails(img)
    if min(left, top, right, bottom) <= 0:
        return img
    pad_r = max(0, left - right)
    pad_b = max(0, top - bottom)
    if pad_r == 0 and pad_b == 0:
        return img
    w, h = img.size
    out = img
    if pad_r > 0:
        strip = out.crop((0, 0, pad_r, h)).transpose(Image.FLIP_LEFT_RIGHT)
        wide = Image.new("RGBA", (w + pad_r, h), (0, 0, 0, 0))
        wide.paste(out, (0, 0), out)
        wide.paste(strip, (w, 0), strip)
        out = wide
        w, h = out.size
    if pad_b > 0:
        strip = out.crop((0, 0, w, pad_b)).transpose(Image.FLIP_TOP_BOTTOM)
        tall = Image.new("RGBA", (w, h + pad_b), (0, 0, 0, 0))
        tall.paste(out, (0, 0), out)
        tall.paste(strip, (0, h), strip)
        out = tall
    return out


def peel_neutral_outer_haze(img: Image.Image, max_peel: int = 8) -> Image.Image:
    """Dıştaki nötr stüdyo duvarını kırp; koyu dış fitilde dur."""
    out = img
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 40 or h < 40:
            break

        def haze_side(side: str) -> bool:
            med_br, med_spr = _side_mid_stats(px, w, h, side)
            return med_spr < 22 and med_br > 90

        cropped = False
        if haze_side("left"):
            out = out.crop((1, 0, w, h))
            cropped = True
        elif haze_side("right"):
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        elif haze_side("top"):
            out = out.crop((0, 1, w, h))
            cropped = True
        elif haze_side("bottom"):
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        if not cropped:
            break
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def clear_corner_pale(img: Image.Image, max_depth: int = 28) -> Image.Image:
    """Köşede kalan stüdyo beyazını sil."""
    w, h = img.size
    px = img.load()
    corners = ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))
    vis = bytearray(w * h)
    q: deque[tuple[int, int, int, int]] = deque()
    for cx0, cy0 in corners:
        r, g, b, a = px[cx0, cy0]
        if a < 30:
            continue
        p = (r, g, b)
        if _px_br(p) < 175 or _px_spread(p) > 30:
            continue
        vis[cy0 * w + cx0] = 1
        q.append((cx0, cy0, cx0, cy0))
    if not q:
        return img
    out = img.copy()
    opx = out.load()
    while q:
        x, y, ox, oy = q.popleft()
        if abs(x - ox) > max_depth or abs(y - oy) > max_depth:
            continue
        opx[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            i = ny * w + nx
            if vis[i]:
                continue
            nr, ng, nb, na = opx[nx, ny]
            if na < 30:
                vis[i] = 1
                q.append((nx, ny, ox, oy))
                continue
            np = (nr, ng, nb)
            if _px_br(np) < 175 or _px_spread(np) > 30:
                continue
            vis[i] = 1
            q.append((nx, ny, ox, oy))
    return out


def punch_pale_rim_pixels(img: Image.Image, max_in: int = 10) -> Image.Image:
    """Kenarda köşeye bağlı olmayan stüdyo beyazını sil; beyaz çerçeveye dokunma."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img
    inner_brs: list[float] = []
    cx, cy = w // 2, h // 2
    for d in (10, 20):
        if it - d > 0 and px[cx, it - d][3] >= 30:
            inner_brs.append(_px_br(px[cx, it - d][:3]))
        if ib + d < h and px[cx, ib + d][3] >= 30:
            inner_brs.append(_px_br(px[cx, ib + d][:3]))
        if il - d > 0 and px[il - d, cy][3] >= 30:
            inner_brs.append(_px_br(px[il - d, cy][:3]))
        if ir + d < w and px[ir + d, cy][3] >= 30:
            inner_brs.append(_px_br(px[ir + d, cy][:3]))
    if inner_brs and sorted(inner_brs)[len(inner_brs) // 2] > 175:
        return img

    def is_pale(p: tuple[int, int, int, int]) -> bool:
        if p[3] < 30:
            return False
        rgb = (p[0], p[1], p[2])
        return _px_br(rgb) > 175 and _px_spread(rgb) < 28

    vis = bytearray(w * h)
    q: deque[tuple[int, int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_pale(px[x, y]):
                vis[y * w + x] = 1
                q.append((x, y, 0))
    for y in range(h):
        for x in (0, w - 1):
            if is_pale(px[x, y]) and not vis[y * w + x]:
                vis[y * w + x] = 1
                q.append((x, y, 0))
    if not q:
        return img
    out = img.copy()
    opx = out.load()
    while q:
        x, y, dist = q.popleft()
        opx[x, y] = (0, 0, 0, 0)
        if dist >= max_in:
            continue
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            i = ny * w + nx
            if vis[i]:
                continue
            if not is_pale(opx[nx, ny]):
                continue
            vis[i] = 1
            q.append((nx, ny, dist + 1))
    return out


def peel_ragged_transparent_outer(img: Image.Image, max_peel: int = 12) -> Image.Image:
    """Kenarda delik açılmış (şeffaf) stüdyo kalıntısını kırp; rayı boş bırakma."""
    out = img
    for _ in range(max_peel):
        px = out.load()
        w, h = out.size
        if w < 40 or h < 40:
            break
        il, it, ir, ib = _hole_bounds(px, w, h)
        if ir <= il or ib <= it:
            break

        def ragged(side: str) -> bool:
            trans = 0
            n = 0
            if side == "right":
                for y in range(0, h, 2):
                    n += 1
                    if px[w - 1, y][3] < 30:
                        trans += 1
            elif side == "left":
                for y in range(0, h, 2):
                    n += 1
                    if px[0, y][3] < 30:
                        trans += 1
            elif side == "top":
                for x in range(0, w, 2):
                    n += 1
                    if px[x, 0][3] < 30:
                        trans += 1
            else:
                for x in range(0, w, 2):
                    n += 1
                    if px[x, h - 1][3] < 30:
                        trans += 1
            return n >= 8 and trans / n >= 0.04

        cropped = False
        if ragged("right"):
            out = out.crop((0, 0, w - 1, h))
            cropped = True
        elif ragged("left"):
            out = out.crop((1, 0, w, h))
            cropped = True
        elif ragged("top"):
            out = out.crop((0, 1, w, h))
            cropped = True
        elif ragged("bottom"):
            out = out.crop((0, 0, w, h - 1))
            cropped = True
        if not cropped:
            break
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def complete_dark_outer_rim(img: Image.Image, dark_br: float = 58, max_depth: int = 12) -> Image.Image:
    """Siyah dış fitili olan kenarın medyan profilini eksik kenarlara yaz."""
    w, h = img.size
    px = img.load()

    def walk(side: str) -> tuple[int, int]:
        if side == "left":
            return (0, 1)
        if side == "right":
            return (w - 1, -1)
        if side == "top":
            return (0, 1)
        return (h - 1, -1)

    def sample_at(side: str, along: int, depth: int) -> tuple[int, int, int, int]:
        if side in ("left", "right"):
            origin, step = walk(side)
            return px[origin + step * depth, along]
        origin, step = walk(side)
        return px[along, origin + step * depth]

    def along_range(side: str) -> range:
        span = h if side in ("left", "right") else w
        return range(span // 6, (5 * span) // 6, 3)

    def side_depth(side: str) -> int:
        ds: list[int] = []
        for along in along_range(side):
            d = 0
            while d < max_depth + 4:
                r, g, b, a = sample_at(side, along, d)
                if a < 30 or _px_br((r, g, b)) > dark_br:
                    break
                d += 1
            ds.append(d)
        if not ds:
            return 0
        ds.sort()
        return ds[len(ds) // 2]

    def outer_br(side: str) -> float:
        brs: list[float] = []
        for along in along_range(side):
            r, g, b, a = sample_at(side, along, 0)
            if a < 30:
                continue
            brs.append(_px_br((r, g, b)))
        if not brs:
            return 255.0
        brs.sort()
        return brs[len(brs) // 2]

    depths = {s: side_depth(s) for s in ("left", "right", "top", "bottom")}
    edge_br = {s: outer_br(s) for s in depths}
    donors = [s for s, d in depths.items() if d >= 4]
    if not donors:
        return img
    target = min(max_depth, max(depths[s] for s in donors))
    if target < 4:
        return img

    profile: list[tuple[int, int, int, int]] = []
    for d in range(target):
        rs, gs, bs, n = [], [], [], 0
        for side in donors:
            if d >= depths[side]:
                continue
            for along in along_range(side):
                r, g, b, a = sample_at(side, along, d)
                if a < 30 or _px_br((r, g, b)) > dark_br:
                    continue
                rs.append(r)
                gs.append(g)
                bs.append(b)
                n += 1
        if n < 8:
            if profile:
                profile.append(profile[-1])
            else:
                profile.append((28, 24, 18, 255))
            continue
        rs.sort()
        gs.sort()
        bs.sort()
        mid = n // 2
        profile.append((rs[mid], gs[mid], bs[mid], 255))

    out = img.copy()
    opx = out.load()

    def paint_side(side: str) -> None:
        span = h if side in ("left", "right") else w
        for along in range(span):
            for d in range(target):
                sr, sg, sb, sa = profile[d]
                if side == "left":
                    x, y = d, along
                elif side == "right":
                    x, y = w - 1 - d, along
                elif side == "top":
                    x, y = along, d
                else:
                    x, y = along, h - 1 - d
                dr, dg, db, da = opx[x, y]
                if da < 30:
                    continue
                dest_br = _px_br((dr, dg, db))
                src_br = _px_br((sr, sg, sb))
                # Gerçek siyah fitili açma; dıştaki açık saçağı her zaman boya.
                if d > 0 and dest_br <= src_br:
                    continue
                if d > 0 and dest_br <= dark_br and dest_br <= src_br + 8:
                    continue
                fade = 1.0 if d < target - 2 else max(0.45, (target - d) / 2.0)
                opx[x, y] = (
                    int(sr * fade + dr * (1 - fade)),
                    int(sg * fade + dg * (1 - fade)),
                    int(sb * fade + db * (1 - fade)),
                    255,
                )

    for side in ("left", "right", "top", "bottom"):
        missing_outer = edge_br[side] > dark_br
        thin = depths[side] < target * 0.75
        if missing_outer or thin:
            paint_side(side)

    # Dış 1–2px açık saçağı her kenarda tek tek koyulaştır (medyan atlamasın).
    cap = max(dark_br, _px_br(profile[0][:3]) + 4)
    sr0, sg0, sb0, _sa0 = profile[0]
    sr1, sg1, sb1, _sa1 = profile[min(1, target - 1)]
    for side in ("left", "right", "top", "bottom"):
        span = h if side in ("left", "right") else w
        for along in range(span):
            for d, (sr, sg, sb) in ((0, (sr0, sg0, sb0)), (1, (sr1, sg1, sb1))):
                if side == "left":
                    x, y = d, along
                elif side == "right":
                    x, y = w - 1 - d, along
                elif side == "top":
                    x, y = along, d
                else:
                    x, y = along, h - 1 - d
                dr, dg, db, da = opx[x, y]
                if da < 30:
                    continue
                if _px_br((dr, dg, db)) > cap:
                    opx[x, y] = (sr, sg, sb, 255)
    return out


def mirror_left_rail_from_right(img: Image.Image) -> Image.Image:
    """Sol rayı sağ profilin yatay aynasıyla değiştir; dört kenar aynı kalınlık."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img
    left, right = il, w - 1 - ir
    if right < 40:
        return img
    shift = right - left
    new_w = w + shift
    canvas = Image.new("RGBA", (new_w, h), (0, 0, 0, 0))
    if shift >= 0:
        canvas.paste(img, (shift, 0))
    else:
        canvas.paste(img.crop((-shift, 0, w, h)), (0, 0))
    right_strip = img.crop((w - right, 0, w, h)).transpose(Image.FLIP_LEFT_RIGHT)
    canvas.paste(right_strip, (0, 0))
    return canvas


def rebuild_horizontal_rails_from_right(img: Image.Image) -> Image.Image:
    """Dört rayı sağ kolun parlak oluk + koyu iç dudak profilinden eşit bas."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img
    left, top, right, bottom = il, it, w - 1 - ir, h - 1 - ib
    t = right
    if t < 40 or min(left, top, bottom) < 40:
        return img

    scoop_d = min(20, t - 1)
    y0, y1 = top + 8, h - bottom - 8
    best_y, best = (y0 + y1) // 2, -1e9
    found = False
    for y in range(y0, y1):
        scoop = sum(px[w - 1 - scoop_d, y][:3]) / 3
        inner = sum(px[w - t, y][:3]) / 3
        if scoop < 165:
            continue
        score = scoop - 1.5 * inner
        if score > best:
            best, best_y, found = score, y, True
    if not found:
        best = -1.0
        for y in range(y0, y1):
            scoop = sum(px[w - 1 - scoop_d, y][:3]) / 3
            if scoop > best:
                best, best_y = scoop, y

    profile = [px[w - 1 - d, best_y] for d in range(t)]
    out = img.copy()
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if left <= x <= ir and top <= y <= ib:
                continue
            d = min(y, h - 1 - y, x, w - 1 - x)
            if d < t:
                opx[x, y] = profile[d]
    return out


def _fa52_walk_inner_mat(
    get, start: int, step: int, limit: int, max_eat: int = 24
) -> int:
    """İç krem/gri matı ye; koyu oluk veya renkli gövdeye gelince dur."""
    coord = start + step
    eaten = 0
    last = start
    while eaten < max_eat:
        if (step < 0 and coord < limit) or (step > 0 and coord > limit):
            break
        r, g, b, a = get(coord)
        if a < 50:
            break
        br = (r + g + b) / 3
        spr = max(r, g, b) - min(r, g, b)
        if br < 70 and spr < 30:
            break
        if spr >= 42 and br > 95:
            break
        if eaten == 0 and br < 118 and spr < 22:
            break
        if br > 118 and spr < 38:
            last = coord
            coord += step
            eaten += 1
            continue
        if eaten > 0 and br > 100 and spr < 24 and eaten < 16:
            last = coord
            coord += step
            eaten += 1
            continue
        break
    return last


def punch_fa52_inner_mat(img: Image.Image) -> Image.Image:
    """FA 52: kenar başına iç matı aç; koyu iç çizgiler rayda kalsın."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il or ib <= it:
        return img
    cx = (il + ir) // 2
    cy = (it + ib) // 2
    it2 = _fa52_walk_inner_mat(lambda y: px[cx, y], it, -1, 0)
    ib2 = _fa52_walk_inner_mat(lambda y: px[cx, y], ib, 1, h - 1)
    il2 = _fa52_walk_inner_mat(lambda x: px[x, cy], il, -1, 0)
    ir2 = _fa52_walk_inner_mat(lambda x: px[x, cy], ir, 1, w - 1)
    return expand_hole_inward(img, it - it2, ir2 - ir, ib2 - ib, il - il2, equalize="none")


def finalize_asymmetric_frame_hole(img: Image.Image) -> Image.Image:
    """Deliği gerçek sınırlarda dikdörtgen yap; ray dokusunu koru."""
    w, h = img.size
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il + 8 or ib <= it + 8:
        return img
    out = img.convert("RGBA").copy()
    px = out.load()
    clear = (0, 0, 0, 0)
    for y in range(it, ib + 1):
        for x in range(il, ir + 1):
            px[x, y] = clear

    for _ in range(4):
        changed = False
        nxt = out.copy()
        npx = nxt.load()
        px = out.load()
        for y in range(h):
            in_rail_y = y < it or y > ib
            for x in range(w):
                in_rail_x = x < il or x > ir
                if not (in_rail_x or in_rail_y):
                    continue
                if px[x, y][3] >= 250:
                    continue
                acc = [0, 0, 0]
                n = 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        r, g, b, a = px[nx, ny]
                        if a >= 250:
                            acc[0] += r
                            acc[1] += g
                            acc[2] += b
                            n += 1
                if n:
                    npx[x, y] = (acc[0] // n, acc[1] // n, acc[2] // n, 255)
                    changed = True
        out = nxt
        if not changed:
            break
    return out


def finalize_fa52_frame(img: Image.Image, dest_name: str) -> Image.Image:
    """FA 52: deliği düzelt; beyazda açık iç duvarı al, oluğu bırak."""
    if dest_name == "fa-52-beyaz.png":
        img = peel_dark_studio_outer(img)
        img = _expand_fa52_beyaz_inner(img)
    return finalize_asymmetric_frame_hole(img)


def normalize_rectangular_frame_hole(img: Image.Image) -> Image.Image:
    """Dört rayı eşitler ve deliği dikdörtgen yapar; fotoğraf kaymasın."""
    left, top, right, bottom = _measure_rails(img)
    s = min(left, top, right, bottom)
    if s < 8:
        return img
    w, h = img.size
    if w < s * 2 + 8 or h < s * 2 + 8:
        return img
    out = img.convert("RGBA").copy()
    px = out.load()
    clear = (0, 0, 0, 0)
    for y in range(s, h - s):
        for x in range(s, w - s):
            px[x, y] = clear

    # Ray içindeki şeffaf/silik pikselleri komşudan doldur.
    for _ in range(4):
        changed = False
        nxt = out.copy()
        npx = nxt.load()
        px = out.load()
        for y in range(h):
            in_rail_y = y < s or y >= h - s
            for x in range(w):
                in_rail_x = x < s or x >= w - s
                if not (in_rail_x or in_rail_y):
                    continue
                if px[x, y][3] >= 250:
                    continue
                acc = [0, 0, 0]
                n = 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        r, g, b, a = px[nx, ny]
                        if a >= 250:
                            acc[0] += r
                            acc[1] += g
                            acc[2] += b
                            n += 1
                if n:
                    npx[x, y] = (acc[0] // n, acc[1] // n, acc[2] // n, 255)
                    changed = True
        out = nxt
        if not changed:
            break
    return out


def _postprocess_named_frame(img: Image.Image, dest_name: str) -> Image.Image:
    haze_kind = STUDIO_INNER_HAZE.get(dest_name)
    if dest_name in STUDIO_EQUALIZE_INWARD:
        equalize = "inner"
    elif dest_name in STUDIO_EQUALIZE_NONE:
        equalize = "none"
    else:
        equalize = "outer"
    if haze_kind:
        img = expand_studio_inner_haze(img, haze_kind, equalize=equalize)
    extra = STUDIO_EXTRA_INWARD.get(dest_name)
    if extra:
        img = expand_hole_inward(img, *extra, equalize=equalize)
    if dest_name in STUDIO_MIRROR_LEFT_FROM_RIGHT:
        img = mirror_left_rail_from_right(img)
        img = rebuild_horizontal_rails_from_right(img)
    if dest_name in STUDIO_GREY_OUTER:
        img = peel_neutral_outer_haze(img)
        img = expand_hole_inward(img, 0, 0, 0, 0, equalize="inner")
    if dest_name in STUDIO_PEEL_OUTER_PALE:
        img = peel_leftover_pale_outer(img)
        img = peel_to_dark_outer_rim(img)
        img = clear_corner_pale(img)
    if dest_name in STUDIO_OUTER_PALE:
        img = peel_leftover_pale_outer(img)
        img = clear_corner_pale(img)
        img = punch_pale_rim_pixels(img)
        img = peel_ragged_transparent_outer(img)
        px = img.load()
        w, h = img.size
        il, it, ir, ib = _hole_bounds(px, w, h)
        if ir > il and ib > it:
            img, il, it, ir, ib = trim_asymmetric_rails(img, il, it, ir, ib)
            bbox = img.getbbox()
            if bbox:
                img = img.crop(bbox)
    if dest_name in STUDIO_PEEL_NEUTRAL_MARGIN:
        img = peel_neutral_studio_margin(img)
    if dest_name in STUDIO_STAIN_WOOD_OUTER:
        img = stain_lit_wood_outers(img)
    if dest_name in STUDIO_PAD_INNER_FROM_OPPOSITE:
        img = pad_inner_lip_from_opposite(img)
    if dest_name in STUDIO_REPLACE_TOP_FROM_BOTTOM:
        img = replace_top_rail_from_bottom(img)
    if dest_name in STUDIO_REPLACE_LEFT_FROM_RIGHT:
        img = replace_left_rail_from_right(img)
    if dest_name in STUDIO_RESTORE_TOP_FROM_BOTTOM:
        img = restore_cropped_top_from_bottom(img)
    if dest_name in STUDIO_DARK_OUTER_RIM:
        img = complete_dark_outer_rim(img)
    if dest_name in STUDIO_PEEL_GREY_DARK_OUTER:
        img = peel_to_dark_outer_rim(img, min_br=70)
        img = complete_dark_outer_rim(img)
        px = img.load()
        w, h = img.size
        il, it, ir, ib = _hole_bounds(px, w, h)
        if ir > il and ib > it:
            img, *_ = trim_asymmetric_rails(img, il, it, ir, ib)
            bbox = img.getbbox()
            if bbox:
                img = img.crop(bbox)
    if dest_name == "fa-41-beyaz.png":
        px = img.load()
        w, h = img.size
        il, it, ir, ib = _hole_bounds(px, w, h)
        if ir > il and ib > it:
            img, *_ = trim_asymmetric_rails(img, il, it, ir, ib)
            bbox = img.getbbox()
            if bbox:
                img = img.crop(bbox)
    if dest_name == "22-lik-siyah.png":
        img = peel_to_dark_outer_rim(img, min_br=78)
        img = compose_square_tile(img)
    if dest_name in STUDIO_FA52_PRODUCT:
        img = finalize_fa52_frame(img, dest_name)
    return img


# Yalnızca iç bant kalan stüdyo çekimleri.
STUDIO_INNER_HAZE: dict[str, str] = {
    "35-lik-altin.png": "altin",
    "35-lik-lacivert.png": "lacivert",
    "35-lik-beyaz.png": "beyaz",
    "35-l-bej.png": "pale",
    "35-l-oksit-gumus.png": "cream-lip",
    "47-l-altin.png": "grey-mat",
    "fa-41-kahve.png": "cream-lip",
    "fa-41-ceviz-gumus.png": "pale",
}

STUDIO_EQUALIZE_INWARD: set[str] = set()

STUDIO_EQUALIZE_NONE: set[str] = {
    "47-l-altin.png",
    "47-l-kahve.png",
    "fa-41-ceviz-gumus.png",
    "fa-41-beyaz.png",
    "fa-52-yesil-eskitme.png",
    "fa-52-altin.png",
    "fa-52-ceviz.png",
    "fa-52-gumus-ceviz.png",
    "fa-52-oksit-gumus.png",
    "fa-52-beyaz.png",
    "fa-52-mavi-eskitme.png",
    "fa-52-kahve-eskitme.png",
    "fa-52-kahve.png",
    "fa-52-sampanya.png",
    "fa-52-siyah.png",
    "fa-52-kahve-altin.png",
}

STUDIO_MIRROR_LEFT_FROM_RIGHT: set[str] = set()

STUDIO_GREY_OUTER: set[str] = set()

STUDIO_PEEL_OUTER_PALE: set[str] = {
    "47-l-altin.png",
}

STUDIO_OUTER_PALE: set[str] = {
    "35-l-bakir.png",
    "35-l-duz-altin.png",
    "35-l-oksit-gumus.png",
    "fa-41-oksit-gumus.png",
}

STUDIO_DARK_OUTER_RIM: set[str] = {
    "35-l-duz-altin.png",
}

STUDIO_PEEL_GREY_DARK_OUTER: set[str] = set()

STUDIO_RESTORE_TOP_FROM_BOTTOM: set[str] = set()

STUDIO_PEEL_NEUTRAL_MARGIN: set[str] = {
    "47-l-kahve.png",
}

STUDIO_STAIN_WOOD_OUTER: set[str] = {
    "47-l-kahve.png",
}

STUDIO_PAD_INNER_FROM_OPPOSITE: set[str] = set()

STUDIO_REPLACE_TOP_FROM_BOTTOM: set[str] = set()

STUDIO_REPLACE_LEFT_FROM_RIGHT: set[str] = set()

STUDIO_FAITHFUL_BLACK_SQUARE: set[str] = {
    "35-l-bronz.png",
    "35-l-altin.png",
    "47-l-ceviz.png",
}

# Eskitme altın çatlakları delik olmasın (35 L'ye dokunma).
STUDIO_KEEP_DARK_SPECKS: set[str] = {
    "47-l-ceviz.png",
}

STUDIO_PEEL_DARK_ALIAS_OUTER: set[str] = set()

STUDIO_DILATE_HOLE: set[str] = {
    "47-l-ceviz.png",
}

STUDIO_MATTE_WHITE_BLACK: set[str] = {
    "47-l-beyaz.png",
    "34-l-beyaz.png",
}

STUDIO_BLACK_SATIN: set[str] = {
    "47-l-siyah.png",
}

STUDIO_WHITE_STUDIO: set[str] = set()

STUDIO_WHITE_PROFILE: set[str] = {
    "fa-41-beyaz.png",
}

STUDIO_FA41_PRODUCT: set[str] = {
    "fa-41-siyah.png",
    "fa-41-altin.png",
    "fa-41-gumus.png",
    "fa-41-sampanya.png",
}

STUDIO_35L_GUMUS: set[str] = {
    "35-l-gumus.png",
}

STUDIO_29KR_DUZ: set[str] = {
    "29-kr-duz-ceviz.png",
    "29-kr-duz-altin.png",
    "29-kr-duz-gumus.png",
}

STUDIO_28KR_BONCUKLU: set[str] = {
    "28-kr-boncuklu-ceviz.png",
    "28-kr-boncuklu-altin.png",
    "28-kr-boncuklu-gumus.png",
}

STUDIO_34L_PRODUCT: set[str] = {
    "34-l-siyah.png",
    "34-l-ceviz.png",
    "34-l-eskitme-altin.png",
    "34-l-sampanya.png",
}

STUDIO_FA52_PRODUCT: set[str] = {
    "fa-52-yesil-eskitme.png",
    "fa-52-altin.png",
    "fa-52-ceviz.png",
    "fa-52-gumus-ceviz.png",
    "fa-52-oksit-gumus.png",
    "fa-52-beyaz.png",
    "fa-52-mavi-eskitme.png",
    "fa-52-kahve-eskitme.png",
    "fa-52-kahve.png",
    "fa-52-sampanya.png",
    "fa-52-siyah.png",
    "fa-52-kahve-altin.png",
    "fa-52-gumus-eskitme.png",
}

STUDIO_KEEP_LONG_OUTER: set[str] = {
    "47-l-altin.png",
    "47-l-kahve.png",
}

# T, R, B, L extra hole expand after haze (kalan krem şerit).
STUDIO_EXTRA_INWARD: dict[str, tuple[int, int, int, int]] = {
    "47-l-altin.png": (0, 4, 0, 0),
    "fa-41-ceviz-gumus.png": (2, 0, 2, 8),
}


def _studio_extract_usable(img: Image.Image) -> bool:
    """Peel/taşma sonucu incelmiş veya deliksiz çıktıyı reddet."""
    w, h = img.size
    if w < 80 or h < 80:
        return False
    px = img.load()
    il, it, ir, ib = _hole_bounds(px, w, h)
    if ir <= il + 20 or ib <= it + 20:
        return False
    rails = [il, it, w - 1 - ir, h - 1 - ib]
    if min(rails) < 40:
        return False
    if max(rails) > min(rails) * 2.4:
        return False
    return True


def process_frame_png(src: Path, dest: Path, force_thickness: int | None = None) -> int:
    """Kaynak fotoğraftaki doğal mitre köşeleri korunur — parça birleştirme yok."""
    raw = Image.open(src).convert("RGBA")
    if dest.name in STUDIO_BLACK_SATIN:
        out = extract_black_satin_square(raw)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_MATTE_WHITE_BLACK:
        out = extract_matte_white_on_black(raw)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_FAITHFUL_BLACK_SQUARE:
        out = extract_faithful_black_square(
            raw,
            keep_dark_specks=dest.name in STUDIO_KEEP_DARK_SPECKS,
            peel_dark_outer=dest.name in STUDIO_PEEL_DARK_ALIAS_OUTER,
            dilate_hole=2 if dest.name in STUDIO_DILATE_HOLE else 0,
        )
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_WHITE_PROFILE:
        out = extract_white_profile_frame(raw)
        out = _postprocess_named_frame(out, dest.name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_FA41_PRODUCT:
        out = extract_fa41_product_frame(raw)
        out = _postprocess_named_frame(out, dest.name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_35L_GUMUS:
        out = extract_opaque_on_black(raw)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_29KR_DUZ:
        out = extract_29kr_duz_product(raw)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_28KR_BONCUKLU:
        out = extract_28kr_boncuklu_product(raw, dest.name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_FA52_PRODUCT:
        out = extract_fa52_product_frame(raw)
        out = finalize_fa52_frame(out, dest.name)
        out = compose_square_tile(out)
        out = finalize_asymmetric_frame_hole(out)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_34L_PRODUCT:
        out = extract_34l_product_frame(raw)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    if dest.name in STUDIO_WHITE_STUDIO:
        out = extract_white_studio_frame(raw)
        out = _postprocess_named_frame(out, dest.name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(out)
    studio = extract_studio_wall_frame(raw, keep_long_outer=dest.name in STUDIO_KEEP_LONG_OUTER)
    if studio is not None and not _studio_extract_usable(studio):
        studio = None
    if studio is not None:
        studio = _postprocess_named_frame(studio, dest.name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        studio.save(dest, "PNG")
        if force_thickness is not None:
            return force_thickness
        return measure_output_thickness(studio)

    raw = clear_studio_backdrop(raw)
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

    out = _postprocess_named_frame(out, dest.name)

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


def compose_square_tile(frame_img: Image.Image) -> Image.Image:
    """Her rayı dıştan iç dudağa tam al; üst/iç profil kesilmez."""
    img = frame_img.convert("RGBA")
    left, top, right, bottom = _measure_rails(img)
    if min(left, top, right, bottom) <= 0:
        img = crop_to_frame_content(img)
        left, top, right, bottom = _measure_rails(img)
        if min(left, top, right, bottom) <= 0:
            return pad_to_square(img)

    sw, sh = img.size
    s = max(left, top, right, bottom)
    inner = max(sw - left - right, sh - top - bottom, 8)
    side = inner + 2 * s
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))

    def blit_box(src: tuple[int, int, int, int], dest: tuple[int, int, int, int], resample=Image.LANCZOS) -> None:
        sx0, sy0, sx1, sy1 = src
        dx, dy, dw, dh = dest
        if sx1 <= sx0 or sy1 <= sy0 or dw <= 0 or dh <= 0:
            return
        patch = img.crop((sx0, sy0, sx1, sy1)).resize((dw, dh), resample)
        out.paste(patch, (dx, dy), patch)

    blit_box((left, 0, sw - right, top), (s, 0, inner, s))
    blit_box((left, sh - bottom, sw - right, sh), (s, side - s, inner, s))
    blit_box((0, top, left, sh - bottom), (0, s, s, inner))
    blit_box((sw - right, top, sw, sh - bottom), (side - s, s, s, inner))
    blit_box((0, 0, left, top), (0, 0, s, s), Image.NEAREST)
    blit_box((sw - right, 0, sw, top), (side - s, 0, s, s), Image.NEAREST)
    blit_box((0, sh - bottom, left, sh), (0, side - s, s, s), Image.NEAREST)
    blit_box((sw - right, sh - bottom, sw, sh), (side - s, side - s, s, s), Image.NEAREST)
    return out


def compose_square_preview(frame_img: Image.Image, side: int = PREVIEW_SIDE) -> Image.Image:
    """İşlenmiş çerçeveden 20 lik gibi kare, dört kenarlı swatch üretir."""
    square = compose_square_tile(frame_img)
    left, top, right, bottom = _measure_rails(square)
    if min(left, top, right, bottom) <= 0:
        return square.resize((side, side), Image.LANCZOS)

    t = max(12, round(side * PREVIEW_RAIL_RATIO))
    out = Image.new("RGBA", (side, side), (26, 26, 26, 255))
    sw, sh = square.size
    s = min(left, top, right, bottom)

    def blit(sx: int, sy: int, sW: int, sH: int, dx: int, dy: int, dW: int, dH: int, resample=Image.LANCZOS) -> None:
        if sW <= 0 or sH <= 0 or dW <= 0 or dH <= 0:
            return
        patch = square.crop((sx, sy, sx + sW, sy + sH)).resize((dW, dH), resample)
        out.paste(patch, (dx, dy), patch)

    blit(s, 0, sw - 2 * s, s, t, 0, side - 2 * t, t)
    blit(s, sh - s, sw - 2 * s, s, t, side - t, side - 2 * t, t)
    blit(0, s, s, sh - 2 * s, 0, t, t, side - 2 * t)
    blit(sw - s, s, s, sh - 2 * s, side - t, t, t, side - 2 * t)
    blit(0, 0, s, s, 0, 0, t, t, Image.NEAREST)
    blit(sw - s, 0, s, s, side - t, 0, t, t, Image.NEAREST)
    blit(0, sh - s, s, s, 0, side - t, t, t, Image.NEAREST)
    blit(sw - s, sh - s, s, s, side - t, side - t, t, t, Image.NEAREST)
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
