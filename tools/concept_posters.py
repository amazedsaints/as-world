"""Concept art for the studio's upcoming games (the Projects posters on
amazedsaints.com). Three small Blender scenes, rendered 720x1080:

    bpyenv/bin/python -I tools/concept_posters.py OUT_DIR

lumen_keeper.png, paper_skies.png, gravity_garden.png land in OUT_DIR.
tools/finish_posters.py then adds bloom, grain and a vignette and writes
assets/img/poster-*.webp.
"""
import bpy
import math
import os
import random
import sys
from mathutils import Vector

OUT = sys.argv[-1]
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sc.render.engine = eng
            break
        except Exception:
            pass
    sc.render.resolution_x, sc.render.resolution_y = 720, 1080
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Punchy"
    for k, v in (("taa_render_samples", 96), ("use_raytracing", True), ("volumetric_end", 90.0),
                 ("volumetric_tile_size", "4"), ("volumetric_samples", 96), ("use_shadows", True)):
        try:
            setattr(sc.eevee, k, v)
        except Exception:
            pass
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    sc.world = w
    return sc


def world_color(c, strength=1.0):
    bg = bpy.context.scene.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (*c, 1)
    bg.inputs[1].default_value = strength


def mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit is not None:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = strength
    return m


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*color, 1)
    e.inputs[1].default_value = strength
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def world_gradient(stops, strength=1.0, haze=0.0, haze_color=(1, 1, 1)):
    """The sky as a vertical colour ramp on the world itself (no card edges),
    with optional mist so lights cast visible shafts."""
    nt = bpy.context.scene.world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.15
    mr.inputs["From Max"].default_value = 0.75
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    bg = nt.nodes.new("ShaderNodeBackground")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    bg.inputs[1].default_value = strength
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        cr.elements.new(pos).color = (*col, 1)
    if haze > 0:
        vol = nt.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Density"].default_value = haze
        vol.inputs["Color"].default_value = (*haze_color, 1)
        nt.links.new(vol.outputs[0], out.inputs["Volume"])


def glow(name, color, strength, alpha):
    """A see-through glowing material (light shafts, halos)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    try:
        m.surface_render_method = "BLENDED"
    except Exception:
        m.blend_method = "BLEND"
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*color, 1)
    e.inputs[1].default_value = strength
    t = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = alpha
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(t.outputs[0], mix.inputs[1])
    nt.links.new(e.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], o.inputs[0])
    return m


def gradient_backdrop(stops, loc, rot, size, strength=1.0):
    """A big emissive card behind everything with a vertical colour ramp."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    pl = bpy.context.object
    pl.scale = (size[0], size[1], 1)
    m = bpy.data.materials.new("sky")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    em = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    em.inputs[1].default_value = strength
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        el = cr.elements.new(pos)
        el.color = (*col, 1)
    pl.data.materials.append(m)
    return pl


def camera(loc, look_at, lens=35):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    o = bpy.data.objects.new("cam", cam)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    d = Vector(look_at) - Vector(loc)
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = o
    return o


def light(kind, loc, energy, color=(1, 1, 1), rot=(0, 0, 0), size=1.0):
    ld = bpy.data.lights.new(kind, kind)
    ld.energy = energy
    ld.color = color
    if kind == "AREA":
        ld.size = size
    if kind == "SUN":
        ld.angle = math.radians(size)
    o = bpy.data.objects.new(kind, ld)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


def mesh_obj(name, verts, faces, m=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if m:
        o.data.materials.append(m)
    for p in me.polygons:
        p.use_smooth = smooth
    return o


def add(kind, m=None, smooth=True, **kw):
    getattr(bpy.ops.mesh, "primitive_%s_add" % kind)(**kw)
    o = bpy.context.object
    if m:
        o.data.materials.append(m)
    if smooth:
        bpy.ops.object.shade_smooth()
    return o


def render(name):
    bpy.context.scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ 1
def lumen_keeper():
    """A lighthouse on a rock in a night storm; its beam bounces off a
    mirror on a reef and finds a lost ship."""
    reset()
    random.seed(4)
    world_gradient([(0.0, (0.07, 0.16, 0.28)), (0.3, (0.03, 0.07, 0.14)), (1.0, (0.004, 0.008, 0.02))],
                   strength=1.0, haze=0.0)
    # moon behind thin cloud
    add("uv_sphere", emission("moon", (1.0, 0.95, 0.82), 6.0), location=(8, 55, 26), radius=3.2)
    add("uv_sphere", emission("moonhalo", (0.35, 0.45, 0.7), 0.6), location=(8, 56, 26), radius=9)
    # stars
    star = emission("star", (0.9, 0.92, 1.0), 4.0)
    for i in range(70):
        add("ico_sphere", star, smooth=False, subdivisions=1, radius=random.uniform(0.05, 0.13),
            location=(random.uniform(-45, 45), 58, random.uniform(16, 50)))
    # the sea: a subdivided plane with swell
    bpy.ops.mesh.primitive_plane_add(size=160, location=(0, 40, 0))
    sea = bpy.context.object
    sea.data.materials.append(mat("sea", (0.01, 0.03, 0.06), rough=0.12))
    sub = sea.modifiers.new("s", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = sub.render_levels = 7
    tex = bpy.data.textures.new("swell", "CLOUDS")
    tex.noise_scale = 3.5
    dis = sea.modifiers.new("d", "DISPLACE")
    dis.texture = tex
    dis.strength = 0.7
    bpy.ops.object.shade_smooth()
    # rocks
    rock = mat("rock", (0.04, 0.04, 0.05), rough=0.8)
    for loc, sc in [((-5.2, 10, 0.2), (3.2, 2.6, 2.0)), ((4.2, 13, 0.0), (1.5, 1.3, 0.9)), ((-2.6, 9, -0.2), (1.2, 1.0, 0.7))]:
        r = add("ico_sphere", rock, smooth=False, subdivisions=2, radius=1, location=loc)
        r.scale = sc
        rd = r.modifiers.new("d", "DISPLACE")
        rt = bpy.data.textures.new("rn", "VORONOI")
        rt.noise_scale = 0.6
        rd.texture = rt
        rd.strength = 0.35
    # the lighthouse
    white = mat("lh_white", (0.85, 0.84, 0.8), rough=0.5)
    red = mat("lh_red", (0.55, 0.05, 0.04), rough=0.45)
    bx, by, bz = -5.2, 10, 1.6
    tower = add("cone", white, vertices=40, radius1=0.95, radius2=0.62, depth=5.2, location=(bx, by, bz + 2.6))
    for z in (bz + 1.4, bz + 3.4):
        add("cone", red, vertices=40, radius1=0.9 - (z - bz) * 0.062, radius2=0.86 - (z - bz) * 0.062, depth=0.7, location=(bx, by, z))
    add("cylinder", mat("gallery", (0.05, 0.05, 0.06), rough=0.4, metal=0.8), vertices=40, radius=0.9, depth=0.14, location=(bx, by, bz + 5.25))
    lamp = add("cylinder", emission("lamp", (1.0, 0.86, 0.5), 30.0), vertices=32, radius=0.5, depth=0.9, location=(bx, by, bz + 5.8))
    add("cone", red, vertices=40, radius1=0.72, radius2=0.05, depth=0.8, location=(bx, by, bz + 6.65))
    light("POINT", (bx, by, bz + 5.8), 900, (1.0, 0.8, 0.5))
    # beams: lamp -> mirror -> ship (soft glowing cones)
    beam = glow("beam", (1.0, 0.8, 0.45), 3.0, 0.16)
    beam_core = glow("beam_core", (1.0, 0.92, 0.72), 9.0, 0.5)

    def ray(a, b, r0, r1, core=False):
        a, b = Vector(a), Vector(b)
        d = b - a
        o = add("cone", beam_core if core else beam, smooth=True, vertices=32, radius1=r0, radius2=r1, depth=d.length,
                location=(a + b) / 2)
        o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        return o

    mirror_p = (4.2, 13, 1.5)
    ship_p = (9.5, 30, 1.0)
    lamp_p = (bx + 0.3, by, bz + 5.8)
    ray(lamp_p, mirror_p, 0.12, 0.55)
    ray(lamp_p, mirror_p, 0.04, 0.16, core=True)
    ray(mirror_p, ship_p, 0.4, 1.6)
    ray(mirror_p, ship_p, 0.12, 0.45, core=True)
    # the mirror on the reef
    mf = add("cube", mat("frame", (0.6, 0.45, 0.2), rough=0.3, metal=1.0), smooth=False, size=1, location=mirror_p)
    mf.scale = (0.9, 0.08, 1.1)
    mf.rotation_euler = (0, 0, math.radians(35))
    mg = add("cube", emission("glass", (1.0, 0.93, 0.75), 12.0), smooth=False, size=1, location=Vector(mirror_p) + Vector((0, -0.05, 0)))
    mg.scale = (0.75, 0.06, 0.95)
    mg.rotation_euler = (0, 0, math.radians(35))
    # the lost ship, caught in the light
    hull = add("cube", mat("hull", (0.12, 0.06, 0.03), rough=0.6), smooth=False, size=1, location=ship_p)
    hull.scale = (2.6, 0.8, 0.55)
    hull.rotation_euler = (0, math.radians(4), math.radians(-18))
    sail = mat("sail", (0.9, 0.85, 0.72), rough=0.7, emit=(1.0, 0.85, 0.6), strength=0.6)
    for dx, h in ((-0.6, 2.6), (0.7, 2.1)):
        sx, sy, sz = ship_p[0] + dx, ship_p[1] - dx * 0.3, ship_p[2] + 0.3
        mesh_obj("sail", [(sx, sy, sz), (sx + 0.9, sy - 0.25, sz), (sx, sy, sz + h)], [(0, 1, 2)], sail)
    light("POINT", (ship_p[0] - 1, ship_p[1] - 2, ship_p[2] + 2), 300, (1.0, 0.8, 0.5))
    def spot(a, b, energy, angle):
        a, b = Vector(a), Vector(b)
        o = light("SPOT", a, energy, (1.0, 0.82, 0.5))
        o.data.spot_size = math.radians(angle)
        o.data.spot_blend = 0.4
        o.rotation_euler = (b - a).to_track_quat("-Z", "Y").to_euler()
    spot(lamp_p, mirror_p, 40000, 9)
    spot(mirror_p, ship_p, 30000, 12)
    light("SUN", (0, 0, 20), 1.2, (0.55, 0.65, 1.0), rot=(62, 0, 200))
    camera((-0.4, -8.5, 2.4), (0.6, 14, 4.6), lens=28)
    render("lumen_keeper")


# ------------------------------------------------------------------ 2
def paper_skies():
    """An origami crane glides over a paper city at sunset, between layers
    of cut-paper clouds."""
    reset()
    random.seed(11)
    world_gradient([(0.0, (1.0, 0.6, 0.3)), (0.22, (1.0, 0.42, 0.4)), (0.55, (0.5, 0.28, 0.6)), (1.0, (0.12, 0.09, 0.3))],
                   strength=1.0, haze=0.0)
    add("cylinder", emission("sun", (1.0, 0.85, 0.55), 5.0), vertices=64, radius=4.2, depth=0.1,
        location=(-6, 57, 5), rotation=(math.radians(90), 0, 0))
    # paper clouds: flat discs stacked in rows, each layer a shade lighter
    def cloud(cx, cy, cz, w, col):
        m = mat("cloud", col, rough=0.9)
        for i in range(7):
            r = w * random.uniform(0.25, 0.42)
            c = add("cylinder", m, vertices=48, radius=r, depth=0.25,
                    location=(cx + (i - 3) * w * 0.17, cy, cz + random.uniform(-0.1, 0.5) * r),
                    rotation=(math.radians(90), 0, 0))
            c.scale = (1, 1, 1)
    for cy, cz, col in [(48, 3.5, (0.95, 0.6, 0.62)), (40, 2.0, (1.0, 0.7, 0.66)), (30, 0.8, (1.0, 0.8, 0.72))]:
        for cx in (-22, -9, 5, 18):
            cloud(cx + random.uniform(-3, 3), cy, cz + random.uniform(-0.6, 0.6), random.uniform(6, 10), col)
    # paper city: boxes in folded-paper pastels with little lit windows
    cols = [(0.98, 0.9, 0.78), (0.55, 0.78, 0.78), (0.95, 0.55, 0.5), (0.98, 0.78, 0.5), (0.7, 0.65, 0.85)]
    win = emission("win", (1.0, 0.8, 0.45), 3.0)
    for row, (y, base) in enumerate([(22, -3.0), (16, -3.6), (11, -4.2)]):
        x = -16
        while x < 16:
            w = random.uniform(1.2, 2.6)
            h = random.uniform(1.5, 5.5) - row * 0.6
            b = add("cube", mat("paper", random.choice(cols), rough=0.95), smooth=False, size=1,
                    location=(x + w / 2, y, base + h / 2))
            b.scale = (w, 1.6, h)
            add("cone", mat("roof", random.choice(cols), rough=0.95), smooth=False, vertices=4, radius1=w * 0.75, depth=0.9,
                location=(x + w / 2, y, base + h + 0.45), rotation=(0, 0, math.radians(45)))
            for k in range(int(h)):
                if random.random() < 0.55:
                    wi = add("cube", win, smooth=False, size=0.32, location=(x + w / 2 + random.uniform(-w / 4, w / 4), y - 0.82, base + 0.6 + k))
            x += w + random.uniform(0.2, 0.7)
    # the crane: folded triangles
    paper = mat("crane", (0.97, 0.96, 0.93), rough=0.85)
    paper_shade = mat("crane2", (0.86, 0.84, 0.86), rough=0.85)
    V = [(0, -1.2, 0), (0, 1.4, 0.15), (0.35, 0.1, -0.35), (-0.35, 0.1, -0.35),      # body diamond 0-3
         (3.6, 0.6, 1.5), (3.2, -0.7, 1.0),                                          # right wing tip
         (-3.6, 0.6, 1.5), (-3.2, -0.7, 1.0),                                        # left wing tip
         (0, -2.6, 1.3), (0, -2.9, 1.05),                                            # neck / head
         (0, 2.7, 1.1)]                                                              # tail
    F_main = [(0, 2, 1), (0, 1, 3), (1, 2, 4), (2, 5, 4), (1, 3, 6), (3, 7, 6), (0, 3, 8), (0, 8, 2), (1, 10, 2)]
    F_shade = [(0, 2, 5), (0, 7, 3), (8, 9, 0), (1, 3, 10)]
    crane = mesh_obj("crane", V, F_main, paper)
    crane2 = mesh_obj("crane2", V, F_shade, paper_shade)
    for o in (crane, crane2):
        o.location = (0.4, 3.2, 3.9)
        o.rotation_euler = (math.radians(10), math.radians(-16), math.radians(-28))
        o.scale = (1.0, 1.0, 1.0)
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = 0.03
    light("SUN", (0, 0, 10), 4.5, (1.0, 0.72, 0.5), rot=(78, 0, 205), size=2)
    light("AREA", (3, -1, 7), 250, (0.75, 0.7, 1.0), rot=(35, 0, 25), size=6)
    camera((-0.6, -5.5, 2.2), (0.5, 14, 5.2), lens=26)
    render("paper_skies")


# ------------------------------------------------------------------ 3
def gravity_garden():
    """A floating garden island under violet starlight; glowing seeds roll
    toward terracotta pots as the island tilts."""
    reset()
    random.seed(7)
    world_gradient([(0.0, (0.3, 0.17, 0.5)), (0.35, (0.13, 0.06, 0.28)), (1.0, (0.02, 0.015, 0.06))],
                   strength=0.9, haze=0.0)
    star = emission("star", (1.0, 0.95, 1.0), 5.0)
    for i in range(90):
        add("ico_sphere", star, smooth=False, subdivisions=1, radius=random.uniform(0.03, 0.09),
            location=(random.uniform(-30, 30), 38, random.uniform(-6, 32)))
    tilt = (math.radians(-9), math.radians(12), 0)
    grass = mat("grass", (0.12, 0.42, 0.16), rough=0.8)
    soil = mat("soil", (0.22, 0.12, 0.07), rough=0.9)
    rock = mat("rockg", (0.18, 0.14, 0.2), rough=0.85)
    root = bpy.data.objects.new("island", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0, 8, 2.2)
    root.rotation_euler = tilt

    def child(o):
        o.parent = root
        o.location = o.location - Vector(root.location)
        return o

    top = child(add("cylinder", grass, vertices=64, radius=3.4, depth=0.35, location=(0, 8, 2.2)))
    child(add("cylinder", soil, vertices=64, radius=3.42, depth=0.4, location=(0, 8, 1.85)))
    under = child(add("cone", rock, smooth=False, vertices=12, radius1=3.3, radius2=0.25, depth=4.2, location=(0, 8, -0.45),
                      rotation=(math.radians(180), 0, 0)))
    d = under.modifiers.new("d", "DISPLACE")
    t = bpy.data.textures.new("rk", "VORONOI")
    t.noise_scale = 0.8
    d.texture = t
    d.strength = 0.5
    # pots, flowers, seeds
    pot = mat("pot", (0.72, 0.32, 0.16), rough=0.6)
    petals = [(1.0, 0.35, 0.6), (1.0, 0.8, 0.25), (0.45, 0.6, 1.0), (0.75, 0.4, 1.0)]
    stem = mat("stem", (0.15, 0.5, 0.2), rough=0.7)
    for i, (x, y) in enumerate([(-1.8, 7.0), (0.4, 9.6), (2.0, 7.6)]):
        child(add("cone", pot, vertices=32, radius1=0.38, radius2=0.5, depth=0.7, location=(x, y, 2.72)))
        child(add("cylinder", soil, vertices=32, radius=0.44, depth=0.05, location=(x, y, 3.05)))
        if i != 1:
            child(add("cylinder", stem, vertices=8, radius=0.04, depth=0.9, location=(x, y, 3.45)))
            child(add("uv_sphere", mat("petal%d" % i, petals[i], rough=0.5, emit=petals[i], strength=0.6),
                      segments=24, ring_count=12, radius=0.28, location=(x, y, 3.95)))
    for x, y, h in [(-2.6, 9.2, 1.0), (-0.6, 6.4, 0.7), (2.7, 9.0, 1.2), (1.2, 6.6, 0.6), (-1.2, 10.4, 0.8)]:
        child(add("cylinder", stem, vertices=8, radius=0.035, depth=h, location=(x, y, 2.4 + h / 2)))
        c = random.choice(petals)
        child(add("uv_sphere", mat("pp", c, rough=0.5, emit=c, strength=0.8), segments=16, ring_count=8,
                  radius=random.uniform(0.16, 0.24), location=(x, y, 2.45 + h)))
    seed_cols = [(0.3, 1.0, 0.85), (1.0, 0.85, 0.35), (0.6, 0.75, 1.0)]
    for j, (x, y) in enumerate([(-0.2, 7.6), (0.9, 8.3), (-1.0, 8.8)]):
        c = seed_cols[j]
        child(add("uv_sphere", emission("seed%d" % j, c, 9.0), segments=24, ring_count=12, radius=0.17, location=(x, y, 2.55)))
        for k in range(1, 5):   # a fading trail behind each seed
            child(add("uv_sphere", emission("trail%d%d" % (j, k), c, 3.0 / k), segments=12, ring_count=6, radius=0.1 / (1 + k * 0.3),
                      location=(x - k * 0.28, y + k * 0.12, 2.5)))
        light("POINT", (x, y, 3.0), 30, c)
    # little rocks drifting around the island
    for i in range(9):
        r = add("ico_sphere", rock, smooth=False, subdivisions=1, radius=random.uniform(0.15, 0.45),
                location=(random.uniform(-6.5, 6.5), random.uniform(4, 13), random.uniform(-2, 5.5)))
        r.rotation_euler = (random.random() * 3, random.random() * 3, 0)
    light("AREA", (-6, 2, 7), 900, (0.4, 0.85, 1.0), rot=(50, -40, 0), size=5)
    light("AREA", (6, 4, 6), 700, (1.0, 0.45, 0.85), rot=(50, 40, 0), size=5)
    light("SUN", (0, 0, 10), 1.6, (1.0, 0.9, 0.8), rot=(40, 10, 30), size=3)
    camera((0.4, -4.8, 4.2), (0, 8, 1.4), lens=30)
    render("gravity_garden")


for scene in (lumen_keeper, paper_skies, gravity_garden):
    scene()
