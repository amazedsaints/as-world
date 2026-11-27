"""The hero fly-through for amazedsaints.com: a camera glides across the
golden-hour farm painting and through the open barn doors into light.

The painting is split into three depth layers (sky and hills; the barn
with its hay bales and cart; the log pile, fence and near ground). Each
frame scales every layer by its own depth as the camera moves forward
(nearer layers grow faster), pans toward the barn doors, and fills the
doorway with warm light that blooms over the screen at the end.

    python3 tools/flythrough.py PAINTING.jpg OUT_DIR [frames]

Writes OUT_DIR/wide/NNN.webp (1280x720) and OUT_DIR/tall/NNN.webp
(640x1138). The site scrubs through them as the visitor scrolls.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 96

paint = Image.open(SRC).convert("RGB")
W, H = paint.size                      # 1620 x 2880
img = np.asarray(paint).astype(np.float32) / 255.0

DOOR = (878, 1102, 1002, 1318)         # the dark doorway (x0, y0, x1, y1)
FOCUS = np.array([940.0, 1215.0])      # where the camera heads


def poly_mask(points, blur=3):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m).astype(np.float32) / 255.0


# near layer: the log pile, the fence and all the ground below them
near = poly_mask([(0, 1358), (150, 1352), (300, 1372), (420, 1405), (520, 1452), (640, 1520), (760, 1560),
                  (900, 1575), (985, 1470), (1008, 1338), (1180, 1330), (1400, 1325), (1620, 1322),
                  (1620, H), (0, H)], blur=4)
# middle layer: the barn, the hay bales, the cart and the yard in front
mid = poly_mask([(0, 1318), (95, 1300), (105, 1240), (160, 1185), (235, 1122), (330, 1118), (420, 1130),
                 (470, 1170), (560, 1150), (578, 1092), (640, 1080), (700, 1015), (925, 785), (1345, 788),
                 (1612, 1072), (1620, 1080), (1620, 1400), (0, 1400)], blur=3)
mid = np.maximum(mid, near)            # (its lower part is hidden behind the near layer)
door = poly_mask([DOOR[:2], (DOOR[2], DOOR[1]), DOOR[2:], (DOOR[0], DOOR[3])], blur=2)


def inpaint(rgb, hole):
    """Fill the hole with colour pulled in from around it (pull-push)."""
    known = 1.0 - hole
    levels = []
    c, w = rgb * known[..., None], known.copy()
    while min(w.shape) > 4:
        levels.append((c, w))
        h2, w2 = (w.shape[0] // 2) * 2, (w.shape[1] // 2) * 2
        c = c[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2, 3).sum((1, 3))
        w = w[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))
    fill = c / np.maximum(w, 1e-6)[..., None]
    for c, w in reversed(levels):
        up = np.asarray(Image.fromarray((np.clip(fill, 0, 1) * 255).astype(np.uint8)).resize(
            (w.shape[1], w.shape[0]), Image.BILINEAR)).astype(np.float32) / 255.0
        own = c / np.maximum(w, 1e-6)[..., None]
        a = np.clip(w, 0, 1)[..., None]
        fill = own * a + up * (1 - a)
    return rgb * known[..., None] + fill * hole[..., None]


back_rgb = inpaint(img, np.clip(mid * 1.15, 0, 1))
mid_rgb = inpaint(img, np.clip(near * 1.15 - 0.05, 0, 1)) * (1 - near[..., None]) + img * near[..., None]


def rgba(rgb, alpha):
    a = np.dstack([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)[..., None]])
    return Image.fromarray((a * 255).astype(np.uint8), "RGBA")


L_BACK = Image.fromarray((back_rgb * 255).astype(np.uint8)).convert("RGBA")
L_NEAR = rgba(img, near)
L_MID = rgba(mid_rgb, mid)
# light that fills the doorway (brightest low and in the middle, like a lit
# barn floor), faded in frame by frame over the dark interior
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
cx, cy = (DOOR[0] + DOOR[2]) / 2, DOOR[3] - 30
fall = np.clip(1 - np.hypot((xx - cx) / 140, (yy - cy) / 260), 0, 1)
light_rgb = np.dstack([np.ones_like(fall), 0.86 + 0.1 * fall, 0.62 + 0.3 * fall])
L_DOOR = rgba(light_rgb, door * (0.55 + 0.45 * fall))

# depth of each layer (in the same units the camera moves)
Z_BACK, Z_MID, Z_NEAR = 14.0, 4.0, 1.7
K_END = 3.62                                     # how far the camera travels


def ease(t):
    return t * t * (3 - 2 * t)


def frame(t, size, view_w, start_center):
    ow, oh = size
    k = K_END * (t ** 1.55)
    centre = start_center + (FOCUS - start_center) * ease(min(1.0, t * 1.15))
    out = Image.new("RGBA", size, (0, 0, 0, 255))
    base = view_w / ow                           # source px per output px at the start

    def place(layer, z):
        m = z / max(z - k, 1e-3)
        s = base / m
        # output (x, y) -> source (centre + (x - ow/2) * s, ...)
        return layer.transform(size, Image.AFFINE, (s, 0, centre[0] - ow / 2 * s, 0, s, centre[1] - oh / 2 * s),
                               resample=Image.BICUBIC), m

    back, _ = place(L_BACK, Z_BACK)
    out.alpha_composite(back)
    # warm light behind the doorway, brighter as we near it
    m_mid = Z_MID / (Z_MID - k)
    dx, dy = (FOCUS - centre) * m_mid / base + np.array([ow / 2, oh / 2])
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gl = 0.08 + 0.92 * ease(min(1.0, t * 1.1))
    r = (DOOR[2] - DOOR[0]) * 0.75 * m_mid / base
    gd = ImageDraw.Draw(glow)
    for i in range(14, 0, -1):
        rr = r * (0.4 + i * 0.12)
        a = int(255 * gl * (1 - i / 15) ** 1.4)
        gd.ellipse((dx - rr, dy - rr * 1.5, dx + rr, dy + rr * 1.5), fill=(255, 226, 170, a))
    glow = glow.filter(ImageFilter.GaussianBlur(max(2, r * 0.25)))
    out.alpha_composite(glow)
    mid_l, _ = place(L_MID, Z_MID)
    out.alpha_composite(mid_l)
    b = ease(min(1.0, max(0.0, (t - 0.04) / 0.6)))
    if b > 0:
        dl, _ = place(L_DOOR, Z_MID)
        a = np.asarray(dl).copy()
        a[..., 3] = (a[..., 3] * b).astype(np.uint8)
        out.alpha_composite(Image.fromarray(a, "RGBA"))
    if k < Z_NEAR * 0.86:                        # the near layer passes the camera and is gone
        near_l, mn = place(L_NEAR, Z_NEAR)
        if mn > 4.0:
            a = np.asarray(near_l).copy()
            a[..., 3] = (a[..., 3] * max(0.0, 1 - (mn - 4.0) / 3.0)).astype(np.uint8)
            near_l = Image.fromarray(a, "RGBA")
        out.alpha_composite(near_l)
    rgb = out.convert("RGB")
    # light spilling out of the doorway over everything, then a warm white-out
    spill = Image.new("RGB", size, (0, 0, 0))
    sd = ImageDraw.Draw(spill)
    rs = r * (2.2 + 3.0 * t)
    sd.ellipse((dx - rs, dy - rs * 1.3, dx + rs, dy + rs * 1.3), fill=(255, 214, 150))
    spill = spill.filter(ImageFilter.GaussianBlur(max(4, rs * 0.45)))
    strength = 0.04 + 0.8 * max(0.0, (t - 0.4) / 0.6) ** 1.6
    rgb = Image.fromarray(np.clip(np.asarray(rgb).astype(np.float32) + np.asarray(spill).astype(np.float32) * strength, 0, 255).astype(np.uint8))
    white = max(0.0, (t - 0.86) / 0.14) ** 1.3
    if white > 0:
        rgb = Image.blend(rgb, Image.new("RGB", size, (255, 240, 214)), white)
    return rgb


for name, size, view_w, start in (("wide", (1280, 720), 1620.0, np.array([810.0, 1055.0])),
                                   ("tall", (640, 1138), 1620.0, np.array([810.0, 1440.0]))):
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    for i in range(N):
        t = i / (N - 1)
        frame(t, size, view_w if name == "wide" else view_w, start).save(
            os.path.join(OUT, name, "%03d.webp" % i), "WEBP", quality=58, method=6)
    print(name, "done")
