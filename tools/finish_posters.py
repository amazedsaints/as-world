"""Bloom, a soft vignette and fine grain on the concept renders, saved as
assets/img/poster-<name>.webp (see tools/concept_posters.py).

    python3 tools/finish_posters.py RENDER_DIR
"""
import sys
import random
from PIL import Image, ImageFilter, ImageChops, ImageDraw

src = sys.argv[1]
for name in ("lumen_keeper", "paper_skies", "gravity_garden"):
    im = Image.open(f"{src}/{name}.png").convert("RGB")
    w, h = im.size
    # bloom: the brightest parts, blurred wide, screened back on
    lum = im.convert("L").point(lambda v: 255 if v > 200 else int(v * v / 200 / 1.6) if v > 150 else 0)
    bright = Image.composite(im, Image.new("RGB", im.size), lum)
    glow = bright.filter(ImageFilter.GaussianBlur(18))
    glow2 = bright.filter(ImageFilter.GaussianBlur(50))
    im = ImageChops.screen(im, glow)
    im = ImageChops.screen(im, Image.blend(Image.new("RGB", im.size), glow2, 0.7))
    # vignette
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((-w * 0.25, -h * 0.15, w * 1.25, h * 1.15), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(120))
    im = Image.composite(im, Image.blend(im, Image.new("RGB", im.size), 0.55), mask)
    # grain
    random.seed(1)
    noise = Image.effect_noise((w, h), 22).convert("RGB")
    im = Image.blend(im, ImageChops.overlay(im, noise), 0.12)
    im.save(f"assets/img/poster-{name.replace('_', '-')}.webp", "WEBP", quality=82, method=6)
    print(name, im.size)
