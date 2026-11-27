"""The hero fly-through for amazedsaints.com: a camera glides across the
golden-hour farm painting, through the open barn doors and into the barn.

The farm painting is split into three depth layers (sky and hills; the
barn with its hay bales and cart; the log pile, fence and near ground).
Each frame scales every layer by its own depth as the camera moves forward
(nearer layers grow faster) and pans toward the barn doors. A second
painting, the barn's inside, shows through the doorway: first as a warm
glow, then clearly, and at the end it fills the frame.

    python3 tools/flythrough.py FARM.jpg INSIDE_WIDE.jpg INSIDE_TALL.jpg OUT_DIR [frames]

Writes OUT_DIR/wide/NNN.webp (1600x900) and OUT_DIR/tall/NNN.webp
(720x1280). The site scrubs through them as the visitor scrolls.
"""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, INT_WIDE, INT_TALL, OUT = sys.argv[1:5]
N = int(sys.argv[5]) if len(sys.argv) > 5 else 96

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
near = poly_mask([(0, 1358), (150, 1352), (300, 1372), (335, 1388), (420, 1394), (470, 1428), (600, 1434), (700, 1438), (735, 1500), (770, 1560),
                  (900, 1575), (985, 1470), (1008, 1338), (1180, 1330), (1400, 1325), (1620, 1322),
                  (1620, H), (0, H)], blur=4)
# middle layer: the barn, the hay bales, the cart and the yard in front
mid = poly_mask([(0, 1318), (95, 1300), (105, 1240), (160, 1185), (235, 1122), (330, 1118), (420, 1130),
                 (470, 1170), (560, 1150), (578, 1092), (640, 1080), (700, 1015), (925, 785), (1345, 788),
                 (1612, 1072), (1620, 1080), (1620, H), (0, H)], blur=3)   # (with all the ground in front)
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
# Behind the log pile and the fence the yard carries on: the smooth fill is
# mixed with real ground, a strip of the sunlit yard in front of the barn
# tiled (mirrored) over the hidden part, so it does not read as a smudge
# once the near layer has passed the camera.
hole = np.clip(near * 1.15 - 0.05, 0, 1)
smooth = inpaint(img, hole)
patch = img[1402:1466, 670:990]
tile = np.concatenate([patch, patch[::-1]], 0)
tile = np.concatenate([tile, tile[:, ::-1]], 1)
ground = np.tile(tile, (H // tile.shape[0] + 1, W // tile.shape[1] + 1, 1))[:H, :W]
shade = np.clip(1.0 - (yy_ := (np.arange(H, dtype=np.float32)[:, None] - 1400) / 2400), 0.55, 1.0)[..., None]
filled = (0.3 * smooth + 0.7 * ground) * shade
mid_rgb = img * (1 - hole[..., None]) + filled * hole[..., None]


def rgba(rgb, alpha):
    a = np.dstack([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)[..., None]])
    return Image.fromarray((a * 255).astype(np.uint8), "RGBA")


L_BACK = Image.fromarray((back_rgb * 255).astype(np.uint8)).convert("RGBA")
L_NEAR = rgba(img, near)
L_MID = rgba(mid_rgb, mid)
# the barn's inside, seen through the doorway (one painting per screen shape)
DOOR_MASK = Image.fromarray((door * 255).astype(np.uint8), "L")
INTERIOR = {"wide": Image.open(INT_WIDE).convert("RGB"), "tall": Image.open(INT_TALL).convert("RGB")}

# depth of each layer (in the same units the camera moves)
Z_BACK, Z_MID, Z_NEAR = 14.0, 4.0, 1.7
M_END = 15.0                                     # how many times bigger the barn is at the end


def ease(t):
    return t * t * (3 - 2 * t)


def clamp01(v):
    return max(0.0, min(1.0, v))


def frame(t, size, view_w, start_center, interior):
    ow, oh = size
    # the barn grows at a steady rate to the eye (each step the same percentage)
    e = t ** 1.15
    m_mid = math.exp(math.log(M_END) * e)
    k = Z_MID * (1 - 1 / m_mid)
    centre = start_center + (FOCUS - start_center) * ease(min(1.0, e * 1.6))
    out = Image.new("RGBA", size, (0, 0, 0, 255))
    base = view_w / ow                           # source px per output px at the start

    def coeffs(z):
        m = z / max(z - k, 1e-3)
        s = base / m
        # output (x, y) -> source (centre + (x - ow/2) * s, ...)
        return (s, 0, centre[0] - ow / 2 * s, 0, s, centre[1] - oh / 2 * s), m

    def place(layer, z, resample=Image.BICUBIC):
        c, m = coeffs(z)
        return layer.transform(size, Image.AFFINE, c, resample=resample), m

    back, _ = place(L_BACK, Z_BACK)
    out.alpha_composite(back)
    mid_l, _ = place(L_MID, Z_MID)
    out.alpha_composite(mid_l)

    # Through the doorway: the inside of the barn. Far off it is only a warm
    # glow; closer, the glow clears and the room is there. It is always big
    # enough to fill the part of the doorway that is on screen, and at the end
    # it fills the frame.
    mask, _ = place(DOOR_MASK, Z_MID, Image.BILINEAR)
    door_w, door_h = (DOOR[2] - DOOR[0]) * m_mid / base, (DOOR[3] - DOOR[1]) * m_mid / base
    iw, ih = interior.size
    S = max(min(door_w, ow) / iw, min(door_h, oh) / ih) * (1.04 + 0.08 * ease(clamp01((e - 0.55) / 0.45)))
    dx, dy = (FOCUS - centre) * m_mid / base + np.array([ow / 2, oh / 2])       # the doorway's middle on screen
    inner = interior.transform(size, Image.AFFINE, (1 / S, 0, iw / 2 - dx / S, 0, 1 / S, ih * 0.52 - dy / S),
                               resample=Image.BICUBIC)
    haze = 0.82 * (1 - ease(clamp01((e - 0.12) / 0.5)))
    if haze > 0:
        inner = Image.blend(inner, Image.new("RGB", size, (255, 222, 160)), haze)
    reveal = ease(clamp01(e / 0.22))
    m_arr = (np.asarray(mask).astype(np.float32) * reveal).astype(np.uint8)
    out.paste(inner, (0, 0), Image.fromarray(m_arr, "L"))

    if k < Z_NEAR * 0.86:                        # the near layer passes the camera and is gone
        near_l, mn = place(L_NEAR, Z_NEAR)
        if mn > 4.0:
            a = np.asarray(near_l).copy()
            a[..., 3] = (a[..., 3] * max(0.0, 1 - (mn - 4.0) / 3.0)).astype(np.uint8)
            near_l = Image.fromarray(a, "RGBA")
        out.alpha_composite(near_l)
    rgb = out.convert("RGB")
    # warm light spilling from the doorway onto the frame and the yard,
    # fading once the camera is close
    bloom = reveal * 0.55 * (1 - ease(clamp01((e - 0.45) / 0.4)))
    if bloom > 0.01:
        r = max(3.0, door_w * 0.35)
        halo = Image.fromarray(m_arr, "L").filter(ImageFilter.GaussianBlur(r))
        add = np.asarray(halo).astype(np.float32)[..., None] / 255.0 * np.array([255, 205, 130], np.float32) * bloom
        rgb = Image.fromarray(np.clip(np.asarray(rgb).astype(np.float32) + add, 0, 255).astype(np.uint8))
    return rgb


for name, size, view_w, start in (("wide", (1600, 900), 1620.0, np.array([810.0, 1055.0])),
                                   ("tall", (720, 1280), 1620.0, np.array([810.0, 1440.0]))):
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    for i in range(N):
        t = i / (N - 1)
        frame(t, size, view_w, start, INTERIOR[name]).save(
            os.path.join(OUT, name, "%03d.webp" % i), "WEBP", quality=70, method=6)
    print(name, "done")
