#!/usr/bin/env python3
"""Debug single image through prepare_cardboard + try_build."""
from pathlib import Path
import sys
import importlib.util
spec = importlib.util.spec_from_file_location("mirror", Path(__file__).resolve().parent / "test-js-mirror.py")
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)
prepare_cardboard = mirror.prepare_cardboard
crop_to_opaque_bounds = mirror.crop_to_opaque_bounds
try_build = mirror.try_build
transparent_ratio = mirror.transparent_ratio
detect_bounds = mirror.detect_bounds
bounds_metrics = mirror.bounds_metrics
is_valid_metrics = mirror.is_valid_metrics
clear_inner_hole = mirror.clear_inner_hole
from PIL import Image

path = Path(sys.argv[1])
img = Image.open(path).convert("RGBA")
w, h = img.size
print("size", w, h, "trans", f"{transparent_ratio(img.load(), w, h):.3f}")

prepped = prepare_cardboard(img)
tight = crop_to_opaque_bounds(prepped)
if tight.size[0] < prepped.size[0] * 0.92:
    prepped = prepare_cardboard(tight)
else:
    prepped = tight
pw, ph = prepped.size
print("after prep", pw, ph, "trans", f"{transparent_ratio(prepped.load(), pw, ph):.3f}")

px = prepped.load()
b = detect_bounds(px, pw, ph)
print("bounds before clear", b, bounds_metrics(*b, pw, ph))
clear_inner_hole(px, pw, ph)
b2 = detect_bounds(px, pw, ph)
m = bounds_metrics(*b2, pw, ph)
print("bounds after clear", b2, m, is_valid_metrics(m, pw, ph))
r = try_build(prepped)
print("try_build", r)
