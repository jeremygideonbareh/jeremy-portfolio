"""
Floating Studio Island v2 — realistic, baked.

A sculpted cliff-rock island at blue hour carrying four pieces of quiet,
board-formed concrete architecture (one per thing the studio builds):
  zone_store    online stores  — glass-fronted boutique pavilion, LED fascia (screen_store)
  zone_gallery  portfolios     — gallery wall with three lit screens (screen_gallery_0..2)
  zone_tower    apps           — black-glass monolith with a phone screen (screen_phone)
  zone_monitor  websites       — concrete studio frame around a large display (screen_monitor)

Lighting (moon, warm interiors, bollards, gallery uplights, screen spill) is
baked with Cycles into two atlases so the browser shows path-traced light for
the cost of a texture lookup:
  baked_top  (4096) terrain + architecture + vegetation
  baked_rock (2048) cliff underside + satellite rocks
Reflective / animated parts stay real-time: realtime_*, core_*, glow_*, screen_*.

Run headless:   blender -b -P blender/build_island_v2.py -- public [--fast]
Textures:       python blender/fetch_textures.py  (CC0, Poly Haven; bake-time only)
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_dir = argv[0] if argv else os.getcwd()
FAST = "--fast" in argv
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "textures")
os.makedirs(os.path.join(out_dir, "models"), exist_ok=True)
RAW = os.path.join(HERE, "out")  # raw GLB + bake PNGs (not shipped; tools/optimize compresses into public/)
os.makedirs(RAW, exist_ok=True)
random.seed(21)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection

# ------------------------------------------------------------------ render device
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for dev_type in ("OPTIX", "CUDA", "HIP"):
        try:
            prefs.compute_device_type = dev_type
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == dev_type]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == dev_type
                scene.cycles.device = "GPU"
                print("cycles device", dev_type, [d.name for d in gpus])
                break
        except TypeError:
            continue
except Exception as e:
    print("gpu setup failed, using CPU", e)
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"

# ------------------------------------------------------------------ materials
def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def bsdf_of(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")

def tex_mat(name, folder, scale, proj="BOX", sat=1.0, val=1.0, bump=0.35, rough_add=0.0, hue=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt, N, L = m.node_tree, m.node_tree.nodes, m.node_tree.links
    b = bsdf_of(m)
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    L.new(tc.outputs["Object"], mp.inputs["Vector"])

    def img(short, noncolor=False):
        path = os.path.join(TEX, folder, f"{short}.jpg")
        if not os.path.exists(path):
            path = path[:-3] + "png"
        n = N.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(path, check_existing=True)
        if noncolor:
            n.image.colorspace_settings.name = "Non-Color"
        n.projection = proj
        if proj == "BOX":
            n.projection_blend = 0.3
        L.new(mp.outputs["Vector"], n.inputs["Vector"])
        return n

    d = img("diff")
    hsv = N.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = sat
    hsv.inputs["Hue"].default_value = hue
    hsv.inputs["Value"].default_value = val
    L.new(d.outputs["Color"], hsv.inputs["Color"])
    L.new(hsv.outputs["Color"], b.inputs["Base Color"])
    r = img("rough", True)
    if rough_add:
        ma = N.new("ShaderNodeMath"); ma.operation = "ADD"; ma.inputs[1].default_value = rough_add; ma.use_clamp = True
        L.new(r.outputs["Color"], ma.inputs[0]); L.new(ma.outputs[0], b.inputs["Roughness"])
    else:
        L.new(r.outputs["Color"], b.inputs["Roughness"])
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    bp.inputs["Distance"].default_value = 0.02
    L.new(d.outputs["Color"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def flat_mat(name, hexc, rough=0.6, metal=0.0, emit=None, strength=0.0, alpha=1.0, noise_var=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = bsdf_of(m)
    b.inputs["Base Color"].default_value = (*srgb(hexc), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        key = "Emission Color" if "Emission Color" in b.inputs else "Emission"
        b.inputs[key].default_value = (*srgb(emit), 1)
        b.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    if noise_var:
        N, L = m.node_tree.nodes, m.node_tree.links
        nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 9
        hsv = N.new("ShaderNodeHueSaturation")
        hsv.inputs["Color"].default_value = (*srgb(hexc), 1)
        mr = N.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 1 - noise_var; mr.inputs["To Max"].default_value = 1 + noise_var
        L.new(nz.outputs["Fac"], mr.inputs["Value"]); L.new(mr.outputs["Result"], hsv.inputs["Value"])
        L.new(hsv.outputs["Color"], b.inputs["Base Color"])
    return m

M = {
    "rock":     tex_mat("rock", "cliff_side", 0.32, sat=0.55, val=0.8, bump=0.6),
    "soil":     tex_mat("soil", "cliff_side", 0.6, sat=0.4, val=0.55, bump=0.5),
    "boulder":  tex_mat("boulder", "dark_rock", 0.9, sat=0.5, val=0.9, bump=0.5),
    "grass":    tex_mat("grass", "aerial_grass_rock", 0.22, proj="FLAT", sat=1.05, val=1.05, bump=0.25, hue=0.535),
    "concrete": tex_mat("concrete", "concrete_slab_wall", 0.42, sat=0.25, val=1.1, bump=0.25),
    "pavers":   tex_mat("pavers", "concrete_pavers_02", 0.7, proj="FLAT", sat=0.2, val=1.0, bump=0.2),
    "steel":    flat_mat("steel", "#16181c", 0.45, 0.0),
    "foliage":  flat_mat("foliage", "#24342a", 0.85, noise_var=0.35),
    "foliage2": flat_mat("foliage_light", "#33473a", 0.85, noise_var=0.3),
    "bark":     flat_mat("bark", "#2b231e", 0.9),
    "ceramic":  flat_mat("ceramic", "#d8d2c8", 0.5),
    # real-time (kept as PBR in three.js)
    "glass":    flat_mat("realtime_glass", "#0b0f14", 0.05, 0.0, alpha=0.28),
    "blackglass": flat_mat("realtime_blackglass", "#07090c", 0.12, 0.6),
    "chrome":   flat_mat("realtime_chrome", "#d6d9de", 0.08, 1.0),
    # emitters (exported as emissive, also light the bake)
    "warm":     flat_mat("glow_warm", "#ffe9cc", 0.5, emit="#ffe2bd", strength=3.0),
    "warmsoft": flat_mat("glow_interior", "#fff0dc", 0.6, emit="#ffe4c0", strength=2.2),
    "beacon":   flat_mat("glow_beacon", "#ffffff", 0.4, emit="#e8f0ff", strength=12.0),
}

def screen_mat(name):
    return flat_mat(name, "#dfe6f0", 0.4, emit="#cfdcff", strength=2.2)

# ------------------------------------------------------------------ helpers
GROUP_A, GROUP_B, GROUP_G = [], [], []   # baked atlases: architecture+vegetation, rock, ground

def link(o, material, parent=None, group=None, smooth=False, name=None):
    if name:
        o.name = name
    if material is not None:
        o.data.materials.clear()
        o.data.materials.append(material)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    if parent:
        o.parent = parent
    if group is not None:
        group.append(o)
    return o

def apply_scale(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

def bevel(o, w=0.015, seg=2):
    m = o.modifiers.new("bevel", "BEVEL"); m.width = w; m.segments = seg; m.limit_method = "ANGLE"

def box(size, loc, material, parent=None, group=GROUP_A, bev=0.012, rot=(0, 0, 0), name=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    apply_scale(o)
    if bev:
        bevel(o, bev, 2)
    return link(o, material, parent, group, smooth=bool(bev), name=name)

def cyl(r, depth, loc, material, parent=None, group=GROUP_A, verts=48, rot=(0, 0, 0), name=None, bev=0.01):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.active_object
    if bev:
        bevel(o, bev, 2)
    return link(o, material, parent, group, smooth=True, name=name)

def plane(w, h, loc, material, parent=None, name=None, group=None):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object
    o.scale = (w, h, 1)
    apply_scale(o)
    return link(o, material, parent, group, name=name)

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    coll.objects.link(e)
    if parent:
        e.parent = parent
    return e

def point_light(name, loc, watts, color, radius=0.05, parent=None):
    ld = bpy.data.lights.new(name, "POINT"); ld.energy = watts; ld.color = srgb(color)
    ld.shadow_soft_size = radius
    lo = bpy.data.objects.new(name, ld); lo.location = loc; coll.objects.link(lo)
    if parent:
        lo.parent = parent
    return lo

def spot_light(name, loc, rot, watts, color, size_deg=50, parent=None):
    ld = bpy.data.lights.new(name, "SPOT"); ld.energy = watts; ld.color = srgb(color)
    ld.spot_size = math.radians(size_deg); ld.spot_blend = 0.6; ld.shadow_soft_size = 0.04
    lo = bpy.data.objects.new(name, ld); lo.location = loc; lo.rotation_euler = rot; coll.objects.link(lo)
    if parent:
        lo.parent = parent
    return lo

def displace(o, kind, size, strength, mid=0.5, direction="NORMAL"):
    t = bpy.data.textures.new(f"{o.name}_{kind}", kind)
    t.noise_scale = size
    m = o.modifiers.new(f"disp_{kind}", "DISPLACE"); m.texture = t; m.strength = strength; m.mid_level = mid; m.direction = direction
    m.texture_coords = "GLOBAL"

def rim_factor(th):
    return 1 + 0.07 * math.sin(3 * th + 0.4) + 0.045 * math.sin(7 * th + 1.3) + 0.02 * math.sin(13 * th)

# ------------------------------------------------------------------ layout constants
R = 6.6
TOP = 0.5
ZR = 3.6
ZONES = [("store", 45), ("gallery", 135), ("tower", 225), ("monitor", 315)]
zone_xy = {n: Vector((math.cos(math.radians(d)) * ZR, math.sin(math.radians(d)) * ZR)) for n, d in ZONES}
island = empty("Island")

def seg_dist(p, a, b):
    ab = b - a
    t = max(0, min(1, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length

# pond + stream that spills over the rim as a waterfall (between tower and monitor)
POND = Vector((0.0, -4.55))
POND_R = (1.15, 0.8)
def rim_at(deg):
    return R * rim_factor(math.radians(deg))
STREAM_END = Vector((0.0, -rim_at(270) + 0.05))

def pond_d(p):
    """signed-ish distance: <0 inside pond ellipse."""
    q = Vector(((p.x - POND.x) / POND_R[0], (p.y - POND.y) / POND_R[1]))
    return (q.length - 1.0) * min(POND_R)

def flatness(p):
    """0 on built features (pads, plaza, paths, water), 1 in the wild."""
    d = min([(p - q).length - 2.0 for q in zone_xy.values()] + [p.length - 1.5] +
            [seg_dist(p, Vector((0, 0)), q) - 0.55 for q in zone_xy.values()] +
            [pond_d(p) - 0.6, seg_dist(p, POND, STREAM_END) - 0.6])
    return max(0.0, min(1.0, d / 1.2))

def smooth01(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

def terrain_h(x, y):
    p = Vector((x, y))
    n = noise.noise(Vector((x * 0.35, y * 0.35, 1.7))) * 0.22 + noise.noise(Vector((x * 1.3, y * 1.3, 4.2))) * 0.05
    h = TOP + n * flatness(p)
    # carve pond bowl + stream bed
    h -= 0.32 * (1 - smooth01(-0.35, 0.25, pond_d(p)))
    h -= 0.2 * (1 - smooth01(0.12, 0.4, seg_dist(p, POND, STREAM_END)))
    return h

# ------------------------------------------------------------------ cliff underside (atlas B)
bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.4, radius2=R * 0.975, depth=7.2, location=(0, 0, TOP - 0.42 - 3.6))
under = bpy.context.active_object
for v in under.data.vertices:
    th = math.atan2(v.co.y, v.co.x)
    f = rim_factor(th)
    v.co.x *= f; v.co.y *= f
m = under.modifiers.new("sub", "SUBSURF"); m.subdivision_type = "SIMPLE"; m.levels = 4 if not FAST else 3
displace(under, "CLOUDS", 1.5, 1.15)
displace(under, "VORONOI", 0.7, 0.35)
displace(under, "CLOUDS", 0.25, 0.08)
link(under, M["rock"], island, GROUP_B, smooth=True, name="rock_under")

# ------------------------------------------------------------------ terrain cap (atlas A) — grass top, soil rim
res = 110 if not FAST else 70
bpy.ops.mesh.primitive_grid_add(x_subdivisions=res, y_subdivisions=res, size=2 * R * 1.12, location=(0, 0, 0))
terr = bpy.context.active_object
bm = bmesh.new(); bm.from_mesh(terr.data)
kill = [v for v in bm.verts if Vector((v.co.x, v.co.y)).length > R * rim_factor(math.atan2(v.co.y, v.co.x))]
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bm.verts.ensure_lookup_table()
for v in bm.verts:
    if v.is_boundary:   # snap the stair-stepped grid edge onto the smooth rim curve
        th = math.atan2(v.co.y, v.co.x)
        rr = R * rim_factor(th) * (1 + 0.012 * noise.noise(Vector((math.cos(th) * 3, math.sin(th) * 3, 0.5))))
        v.co.x, v.co.y = math.cos(th) * rr, math.sin(th) * rr
for v in bm.verts:
    v.co.z = terrain_h(v.co.x, v.co.y)
bm.to_mesh(terr.data); bm.free()
terr.data.materials.append(M["grass"]); terr.data.materials.append(M["soil"])
sol = terr.modifiers.new("solid", "SOLIDIFY"); sol.thickness = 0.55; sol.offset = -1; sol.material_offset_rim = 1; sol.material_offset = 1
displace(terr, "CLOUDS", 0.6, 0.06)
link(terr, None, island, GROUP_G, smooth=True, name="terrain")

# ------------------------------------------------------------------ plaza, paths, centre sculpture
cyl(1.25, 0.08, (0, 0, TOP + 0.02), M["pavers"], island, verts=96, bev=0.01)
cyl(0.32, 0.75, (0, 0, TOP + 0.43), M["concrete"], island, verts=64, bev=0.02)
core = empty("core", island, (0, 0, TOP + 1.35))
k = 0
for ix in (-1, 1):
    for iy in (-1, 1):
        for iz in (-1, 1):
            box((0.24, 0.24, 0.24), (ix * 0.14, iy * 0.14, iz * 0.14), M["chrome"], core, group=None, bev=0.03, name=f"core_{k}")
            k += 1

for name, deg in ZONES:
    th = math.radians(deg)
    for j in range(5):
        rr = 1.45 + j * 0.42
        x, y = math.cos(th) * rr, math.sin(th) * rr
        box((0.62, 0.32, 0.06), (x, y, TOP + 0.02), M["pavers"], island, rot=(0, 0, th + math.pi / 2), bev=0.008)

# bollard lights along each path
for i, (name, deg) in enumerate(ZONES):
    th = math.radians(deg)
    side = Vector((-math.sin(th), math.cos(th)))
    for j, rr in enumerate((1.7, 2.75)):
        base = Vector((math.cos(th) * rr, math.sin(th) * rr)) + side * (0.55 if j == 0 else -0.55)
        box((0.07, 0.07, 0.55), (base.x, base.y, TOP + 0.275), M["steel"], island, bev=0.006)
        box((0.072, 0.072, 0.03), (base.x, base.y, TOP + 0.5), M["warm"], island, group=None, bev=0, name=f"glow_bollard_{i}_{j}")
        point_light(f"bollard_light_{i}_{j}", (base.x, base.y, TOP + 0.47), 3, "#ffe2bf", 0.03, island)

# ------------------------------------------------------------------ zones
zone_roots = {}
def zone_root(name):
    e = empty(f"zone_{name}", island)
    zone_roots[name] = e
    return e

def place_zone(name, deg):
    e = zone_roots[name]
    th = math.radians(deg)
    e.location = (math.cos(th) * ZR, math.sin(th) * ZR, TOP)
    e.rotation_euler = (0, 0, th + math.pi / 2)

# --- STORE: glass-fronted boutique pavilion
z = zone_root("store")
box((3.0, 2.4, 0.12), (0, 0, 0.06), M["pavers"], z)
box((2.5, 0.26, 1.42), (0, 0.92, 0.83), M["concrete"], z)
for sx in (-1, 1):
    box((0.26, 1.9, 1.42), (sx * 1.12, 0.1, 0.83), M["concrete"], z)
box((3.1, 2.5, 0.18), (0, -0.05, 1.63), M["concrete"], z, bev=0.01)
box((2.0, 1.55, 0.02), (0, 0.1, 0.13), M["pavers"], z)                    # interior floor
for i, x in enumerate((-0.6, 0.0, 0.6)):                                   # display plinths + objects
    box((0.42, 0.42, 0.5 + i * 0.08), (x, 0.35, 0.37 + i * 0.04), M["concrete"], z)
    cyl(0.09 + 0.02 * i, 0.22 + 0.06 * i, (x, 0.35, 0.73 + i * 0.1), M["ceramic"], z, verts=32, bev=0.02)
plane(2.0, 1.25, (0, 0.785, 0.78), M["warmsoft"], z, "glow_store_back")   # lit back wall
point_light("store_light_a", (-0.5, 0.0, 1.3), 30, "#ffe6c8", 0.3, z)
point_light("store_light_b", (0.5, 0.0, 1.3), 30, "#ffe6c8", 0.3, z)
glass = plane(2.0, 1.4, (0, -0.83, 0.83), M["glass"], z, "realtime_glass_store")
glass.hide_render = True
for x in (-0.99, 0.99):
    box((0.03, 0.05, 1.4), (x, -0.84, 0.83), M["steel"], z, bev=0)
plane(2.3, 0.12, (0, -1.305, 1.63), screen_mat("screen_store_mat"), z, "screen_store")
place_zone("store", 45)

# --- GALLERY: concrete wall with three lit screens
z = zone_root("gallery")
box((3.8, 1.9, 0.1), (0, 0.1, 0.05), M["pavers"], z)
box((3.5, 0.32, 1.6), (0, 0.55, 0.9), M["concrete"], z)
box((3.6, 0.42, 0.08), (0, 0.55, 1.74), M["concrete"], z)
for i, x in enumerate((-1.1, 0.0, 1.1)):
    box((0.76, 0.05, 0.98), (x, 0.375, 1.0), M["steel"], z, bev=0.006)
    plane(0.66, 0.88, (x, 0.348, 1.0), screen_mat(f"screen_gallery_{i}_mat"), z, f"screen_gallery_{i}")
    cyl(0.05, 0.06, (x, -0.15, 0.13), M["steel"], z, verts=16, bev=0)
    spot_light(f"gallery_up_{i}", (x, -0.15, 0.2), (math.radians(-28), 0, 0), 14, "#fff1de", 46, z)
box((1.3, 0.42, 0.42), (0, -0.55, 0.31), M["concrete"], z)                  # bench
place_zone("gallery", 135)

# --- TOWER: black-glass monolith (phone)
z = zone_root("tower")
box((1.6, 1.2, 0.26), (0, 0, 0.13), M["concrete"], z, bev=0.015)
box((1.0, 0.18, 2.25), (0, 0, 1.385), M["blackglass"], z, group=None, bev=0.11, name="realtime_tower")
plane(0.86, 2.0, (0, -0.0915, 1.385), screen_mat("screen_phone_mat"), z, "screen_phone")
cyl(0.012, 0.5, (0.3, 0.0, 2.75), M["steel"], z, verts=8, bev=0)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(0.3, 0.0, 3.01))
link(bpy.context.active_object, M["beacon"], z, None, True, "beacon")
place_zone("tower", 225)

# --- MONITOR: concrete studio frame around a large display
z = zone_root("monitor")
box((4.0, 2.6, 0.1), (0, 0.1, 0.05), M["pavers"], z)
for sx in (-1, 1):
    box((0.32, 1.3, 2.25), (sx * 1.78, 0.25, 1.2), M["concrete"], z)
box((3.9, 1.3, 0.3), (0, 0.25, 2.45), M["concrete"], z)
box((3.24, 0.22, 2.25), (0, 0.79, 1.2), M["concrete"], z)
box((2.66, 0.04, 1.58), (0, 0.66, 1.2), M["blackglass"], z, group=None, bev=0.012, name="realtime_bezel")
plane(2.52, 1.44, (0, 0.635, 1.2), screen_mat("screen_monitor_mat"), z, "screen_monitor")
box((1.8, 0.5, 0.36), (0, -0.55, 0.28), M["concrete"], z)                  # low bench
place_zone("monitor", 315)

# ------------------------------------------------------------------ vegetation + boulders
def free_spot(min_zone=2.3, min_center=1.7, rmax=6.0):
    for _ in range(400):
        th = random.uniform(0, math.tau)
        rr = random.uniform(min_center, rmax * rim_factor(th) * 0.93)
        p = Vector((math.cos(th) * rr, math.sin(th) * rr))
        if flatness(p) > 0.6 and all((p - q).length > min_zone for q in zone_xy.values()):
            return p
    return None

def conifer(p, s, i, parent=island, z0=None):
    """Tiered fir: a trunk plus 7–9 drooping, noise-broken branch skirts."""
    z0 = terrain_h(p.x, p.y) if z0 is None else z0
    group = GROUP_A if parent is island else GROUP_B
    h = random.uniform(2.1, 3.1) * s
    cyl(0.06 * s, h * 0.92, (p.x, p.y, z0 + h * 0.46), M["bark"], parent, verts=8, bev=0)
    tiers = random.randint(10, 13)
    parts = []
    spin = random.uniform(0, math.tau)
    for k in range(tiers):
        t = k / (tiers - 1)
        rad = (0.62 * (1 - t) ** 0.85 + 0.06) * s * random.uniform(0.9, 1.1)
        depth = h * (0.24 - 0.08 * t)
        zc = z0 + 0.35 * s + t * h * 0.78
        bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=rad, radius2=rad * 0.12, depth=depth,
                                        location=(p.x, p.y, zc), rotation=(0, 0, spin + k * 0.7))
        c = bpy.context.active_object
        # droop the skirt edge and jag it like branch tips
        for v in c.data.vertices:
            r = math.hypot(v.co.x, v.co.y)
            if r > rad * 0.5:
                ang = math.atan2(v.co.y, v.co.x)
                jag = 1 + 0.22 * math.sin(ang * 7 + k) + random.uniform(-0.08, 0.08)
                v.co.x *= jag; v.co.y *= jag
                v.co.z -= depth * 0.25
        m = c.modifiers.new("sub", "SUBSURF"); m.subdivision_type = "SIMPLE"; m.levels = 2
        displace(c, "CLOUDS", 0.07, 0.05)
        parts.append(c)
    bpy.ops.object.select_all(action="DESELECT")
    for c in parts:
        bpy.context.view_layer.objects.active = c
        for mm in list(c.modifiers):
            bpy.ops.object.modifier_apply(modifier=mm.name)
        c.select_set(True)
    bpy.ops.object.join()
    o = bpy.context.active_object
    link(o, M["foliage"] if i % 3 else M["foliage2"], parent, group, smooth=True, name=f"conifer_{i}")

# scanned boulders (Poly Haven, CC0) — decimated once, then instanced as real copies for the bake
SCANS = []
for asset in ("namaqualand_boulder_02", "namaqualand_boulder_03"):
    path = os.path.join(HERE, "models", asset, f"{asset}.gltf")
    if not os.path.exists(path):
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    src = meshes[0]
    for o in new:
        if o is not src:
            bpy.data.objects.remove(o, do_unlink=True)
    src.parent = None
    bpy.context.view_layer.objects.active = src
    bpy.ops.object.select_all(action="DESELECT"); src.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    target = 2600
    dec = src.modifiers.new("dec", "DECIMATE"); dec.ratio = min(1.0, target / max(1, len(src.data.polygons)))
    bpy.ops.object.modifier_apply(modifier="dec")
    # normalise: centre at origin, largest dimension 1 m, base on z=0
    bb = [src.matrix_world @ Vector(c) for c in src.bound_box]
    mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    size = max(mx - mn)
    for v in src.data.vertices:
        v.co = (v.co - Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))) / size
    for p in src.data.polygons:
        p.use_smooth = True
    src.hide_render = True
    src.hide_viewport = True
    SCANS.append(src)
    print("scan", asset, len(src.data.polygons), "faces")

def scan_rock(p, s, parent=island, group=GROUP_A, z0=None, sink=0.18):
    if not SCANS:
        return boulder(p, s * 0.5, parent, group, z0)
    src = random.choice(SCANS)
    o = src.copy(); o.data = src.data.copy()
    coll.objects.link(o)
    o.hide_render = False; o.hide_viewport = False
    z0 = terrain_h(p.x, p.y) if z0 is None else z0
    o.location = (p.x, p.y, z0 - s * sink)
    o.rotation_euler = (0, 0, random.uniform(0, math.tau))
    o.scale = (s, s * random.uniform(0.8, 1.15), s * random.uniform(0.7, 1.0))
    o.parent = parent
    group.append(o)
    return o

def shrub(p, s, i):
    z0 = terrain_h(p.x, p.y)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.22 * s, subdivisions=2, location=(p.x, p.y, z0 + 0.1 * s))
    o = bpy.context.active_object
    o.scale = (1, 1, 0.7); apply_scale(o)
    displace(o, "CLOUDS", 0.08, 0.05)
    link(o, M["foliage2"] if i % 2 else M["foliage"], island, GROUP_A, smooth=True)

def boulder(p, s, parent=island, group=GROUP_A, z0=None):
    z0 = terrain_h(p.x, p.y) if z0 is None else z0
    bpy.ops.mesh.primitive_ico_sphere_add(radius=s, subdivisions=3, location=(p.x, p.y, z0 + s * 0.25))
    o = bpy.context.active_object
    o.scale = (1, random.uniform(0.7, 1.1), random.uniform(0.45, 0.7)); apply_scale(o)
    o.rotation_euler = (0, 0, random.uniform(0, math.tau))
    displace(o, "VORONOI", 0.35 * s, 0.25 * s)
    link(o, M["boulder"], parent, group, smooth=True)

n_trees = 0
for i in range(26 if not FAST else 12):
    p = free_spot()
    if p:
        conifer(p, random.uniform(0.75, 1.2), n_trees); n_trees += 1
for i in range(40 if not FAST else 16):
    p = free_spot(2.0, 1.5, 6.1)
    if p:
        shrub(p, random.uniform(0.6, 1.3), i)
for i in range(12):
    p = free_spot(2.1, 1.6, 6.2)
    if p:
        scan_rock(p, random.uniform(0.35, 0.85))

# ------------------------------------------------------------------ pond, stream, waterfall
# dark wet bed under the water so the bake reads depth
bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1.0, fill_type="NGON", location=(POND.x, POND.y, TOP - 0.3))
bed = bpy.context.active_object
bed.scale = (POND_R[0] * 1.05, POND_R[1] * 1.05, 1); apply_scale(bed)
link(bed, M["soil"], island, GROUP_A)
# water surface: pond ellipse + stream strip, one real-time mesh
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=1.0, fill_type="NGON", location=(POND.x, POND.y, TOP - 0.14))
water = bpy.context.active_object
water.scale = (POND_R[0] * 0.98, POND_R[1] * 0.98, 1); apply_scale(water)
stream_len = (POND - STREAM_END).length
bpy.ops.mesh.primitive_plane_add(size=1, location=((POND.x + STREAM_END.x) / 2, (POND.y + STREAM_END.y) / 2, TOP - 0.12))
strip = bpy.context.active_object
strip.scale = (0.42, stream_len, 1); apply_scale(strip)
bpy.ops.object.select_all(action="DESELECT"); water.select_set(True); strip.select_set(True)
bpy.context.view_layer.objects.active = water
bpy.ops.object.join()
water = bpy.context.active_object
M["water"] = flat_mat("realtime_water", "#1c2a30", 0.05, 0.0)
link(water, M["water"], island, None, name="realtime_water")
water.hide_render = False  # visible in the poster render; hidden again for the bake

# waterfall ribbon: leaves the rim and arcs down into the mist (v = 0 top → 1 bottom)
wf_mesh = bpy.data.meshes.new("waterfall")
bmw = bmesh.new()
rows, cols = 48, 6
grid = []
for r_ in range(rows + 1):
    t = r_ / rows
    yy = STREAM_END.y - 0.15 - 0.9 * math.sqrt(t) - 0.4 * t
    zz = TOP - 0.13 - 10.0 * t ** 1.7
    w = 0.38 + 1.5 * t
    row = []
    for c_ in range(cols + 1):
        u = c_ / cols
        xx = STREAM_END.x + (u - 0.5) * w + math.sin(t * 9 + u * 3) * 0.04 * t
        row.append(bmw.verts.new((xx, yy, zz)))
    grid.append(row)
uvl = bmw.loops.layers.uv.new("UVMap")
for r_ in range(rows):
    for c_ in range(cols):
        f = bmw.faces.new((grid[r_][c_], grid[r_][c_ + 1], grid[r_ + 1][c_ + 1], grid[r_ + 1][c_]))
        for loop, (uu, vv) in zip(f.loops, ((c_, r_), (c_ + 1, r_), (c_ + 1, r_ + 1), (c_, r_ + 1))):
            loop[uvl].uv = (uu / cols, 1 - vv / rows)
bmw.to_mesh(wf_mesh); bmw.free()
wf = bpy.data.objects.new("realtime_waterfall", wf_mesh); coll.objects.link(wf)
wf.data.materials.append(flat_mat("realtime_waterfall_mat", "#dfe8ee", 0.2))
wf.parent = island
wf.hide_render = True
for k in range(6):  # scanned rocks framing the pond + lip of the fall
    a = k / 6 * math.tau + 0.3
    p = POND + Vector((math.cos(a) * POND_R[0] * 1.15, math.sin(a) * POND_R[1] * 1.2))
    scan_rock(p, random.uniform(0.28, 0.5), sink=0.3)
for sx in (-0.42, 0.45):
    scan_rock(STREAM_END + Vector((sx, 0.25)), random.uniform(0.35, 0.55), sink=0.25)

# ------------------------------------------------------------------ satellite rocks (atlas B, static)
for i in range(4):
    th = math.radians(20 + i * 90 + random.uniform(-15, 15))
    rr = random.uniform(9.0, 10.5)
    fz = random.uniform(-2.0, 1.6)
    s = random.uniform(0.55, 0.95)
    c = Vector((math.cos(th) * rr, math.sin(th) * rr, fz))
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.08, radius2=1.05 * s, depth=1.8 * s, location=(c.x, c.y, c.z - 0.9 * s))
    o = bpy.context.active_object
    m = o.modifiers.new("sub", "SUBSURF"); m.subdivision_type = "SIMPLE"; m.levels = 3
    displace(o, "CLOUDS", 0.6, 0.35)
    link(o, M["rock"], island, GROUP_B, smooth=True, name=f"float_rock_{i}")
    bpy.ops.mesh.primitive_cylinder_add(radius=1.06 * s, depth=0.14, vertices=24, location=(c.x, c.y, c.z + 0.02))
    t = bpy.context.active_object
    displace(t, "CLOUDS", 0.3, 0.05)
    link(t, M["grass"], island, GROUP_B, smooth=True)
    if i % 2 == 0:
        conifer(Vector((c.x + 0.1, c.y)), 0.7 * s, 100 + i, island, z0=c.z + 0.09)
        GROUP_A.remove(bpy.data.objects[f"conifer_{100 + i}"]) if bpy.data.objects[f"conifer_{100 + i}"] in GROUP_A else None
    else:
        scan_rock(Vector((c.x, c.y)), 0.55 * s, island, GROUP_B, z0=c.z + 0.08, sink=0.1)
# the conifer helper put satellite trunks in GROUP_A — move all objects near satellites to B
for o in list(GROUP_A):
    if Vector((o.matrix_world.translation.x, o.matrix_world.translation.y)).length > 8.0:
        GROUP_A.remove(o); GROUP_B.append(o)

# ------------------------------------------------------------------ lights for the bake + poster
world = bpy.data.worlds.new("bluehour")
scene.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
bg = next(n for n in wn if n.type == "BACKGROUND")
grad = wn.new("ShaderNodeTexGradient"); grad.gradient_type = "LINEAR"
tcw = wn.new("ShaderNodeTexCoord"); mpw = wn.new("ShaderNodeMapping")
mpw.inputs["Rotation"].default_value = (0, math.radians(90), 0)
ramp = wn.new("ShaderNodeValToRGB")
# soft, misty morning: a bright cool sky dome does most of the work
ramp.color_ramp.elements[0].color = (*srgb("#8193aa"), 1)
ramp.color_ramp.elements[1].color = (*srgb("#cfd8e2"), 1)
wl.new(tcw.outputs["Generated"], mpw.inputs["Vector"]); wl.new(mpw.outputs["Vector"], grad.inputs["Vector"])
wl.new(grad.outputs["Fac"], ramp.inputs["Fac"]); wl.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.15

# low, hazy sun: warm-white (not orange), wide angle = soft long shadows
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.4; sun.color = srgb("#fff4e4"); sun.angle = math.radians(6)
so = bpy.data.objects.new("sun", sun); coll.objects.link(so)
so.rotation_euler = (math.radians(64), 0, math.radians(208))
def area(name, loc, energy, size, color):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size; ld.color = srgb(color)
    lo = bpy.data.objects.new(name, ld); lo.location = loc; coll.objects.link(lo)
    lo.rotation_euler = (Vector((0, 0, -2)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("mist_bounce", (0, 0, -12), 700, 16, "#aebdcc")   # light bouncing up off the cloud sea

# ------------------------------------------------------------------ apply modifiers
for o in list(bpy.data.objects):
    if o.type != "MESH" or not o.modifiers:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e:
            print("apply failed", o.name, m.name, e)

# ------------------------------------------------------------------ poster render (real materials, before baking replaces them)
cd = bpy.data.cameras.new("cam"); cd.lens = 50
cam = bpy.data.objects.new("cam", cd); coll.objects.link(cam)
cam.location = (13.5, -19.5, 9.0)
cam.rotation_euler = (Vector((0, 0, -1.0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
scene.cycles.samples = 64 if FAST else 160
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 86
scene.render.filepath = os.path.join(out_dir, "island-poster.webp")
bpy.ops.render.render(write_still=True)
print("poster saved")

# ------------------------------------------------------------------ bake
def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.parent = island
    return o

def bake_atlas(obj, size, samples, label):
    me = obj.data
    uv = me.uv_layers.new(name="bake")
    me.uv_layers.active = uv
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0015, area_weight=0.0, scale_to_bounds=False)
    try:
        bpy.ops.uv.pack_islands(margin=0.0015, rotate=True)
    except Exception as e:
        print("pack", e)
    bpy.ops.object.mode_set(mode="OBJECT")

    img = bpy.data.images.new(f"bake_{label}", size, size, alpha=False, float_buffer=False)
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = img
        uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "bake"
        nt.links.new(uvn.outputs["UV"], n.inputs["Vector"])
        for x in nt.nodes:
            x.select = False
        n.select = True
        nt.nodes.active = n

    scene.cycles.samples = samples
    scene.render.bake.margin = 6
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_diffuse = True
    scene.render.bake.use_pass_glossy = False
    scene.render.bake.use_pass_transmission = False
    scene.render.bake.use_pass_emit = True
    bpy.ops.object.bake(type="COMBINED")
    print("baked", label)

    # swap to a single baked material, keep only the bake UVs
    bm_ = bpy.data.materials.new(f"baked_{label}")
    bm_.use_nodes = True
    b = bsdf_of(bm_)
    tn = bm_.node_tree.nodes.new("ShaderNodeTexImage"); tn.image = img
    bm_.node_tree.links.new(tn.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 1.0
    me.materials.clear()
    me.materials.append(bm_)
    for layer in [l for l in me.uv_layers if l.name != "bake"]:
        me.uv_layers.remove(layer)
    for p in me.polygons:
        p.material_index = 0
    img.file_format = "PNG"
    img.filepath_raw = os.path.join(RAW, f"bake_{label}.png")
    img.save()

def cull_hidden(obj, kind):
    """Drop faces no camera ever sees so the atlas spends its pixels on visible surfaces."""
    bm = bmesh.new(); bm.from_mesh(obj.data)
    mw = obj.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    dead = []
    for f in bm.faces:
        n = (nm @ f.normal).normalized()
        c = mw @ f.calc_center_median()
        if kind == "down" and n.z < -0.7 and c.z < TOP + 0.3:
            dead.append(f)          # undersides of slabs, boulders, terrain shell
        elif kind == "cap" and n.z > 0.9 and c.z > TOP - 1.2:
            dead.append(f)          # rock cone lid hidden under the terrain
    bmesh.ops.delete(bm, geom=dead, context="FACES")
    bm.to_mesh(obj.data); bm.free()
    print("culled", obj.name, len(dead))

ARCH_MATS = {"concrete", "pavers", "steel", "ceramic"}
def is_arch(o):
    return o.type == "MESH" and o.data.materials and all(m and m.name in ARCH_MATS for m in o.data.materials)
alive = [o for o in GROUP_A if o.name in bpy.data.objects]
arch_list = [o for o in alive if is_arch(o)]
veg_list = [o for o in alive if not is_arch(o)]
arch = join(arch_list, "baked_arch")
water.hide_render = True  # baked bed + banks see the sky, not a mirror
top = join(veg_list, "baked_top")
cull_hidden(arch, "down")
ground = join([o for o in GROUP_G if o.name in bpy.data.objects], "baked_ground")
rock = join([o for o in GROUP_B if o.name in bpy.data.objects], "baked_rock")
cull_hidden(top, "down")
cull_hidden(ground, "down")
cull_hidden(rock, "cap")
bake_atlas(arch, 2048 if FAST else 4096, 48 if FAST else 256, "arch")
bake_atlas(top, 1024 if FAST else 2048, 48 if FAST else 200, "top")
bake_atlas(ground, 1024 if FAST else 2048, 48 if FAST else 256, "ground")
bake_atlas(rock, 1024 if FAST else 2048, 48 if FAST else 160, "rock")

# ------------------------------------------------------------------ export (lights stay in .blend only)
for s in SCANS:
    bpy.data.objects.remove(s, do_unlink=True)
for o in (water, wf):
    o.hide_render = False
for o in list(bpy.data.objects):
    if o.type in ("LIGHT", "CAMERA"):
        bpy.data.objects.remove(o, do_unlink=True)
glass.hide_render = False
faces = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("meshes", len([o for o in bpy.data.objects if o.type == "MESH"]), "faces", faces)
glb = os.path.join(RAW, "island-raw.glb")
kw = dict(filepath=glb, export_format="GLB", export_apply=True, export_lights=False, export_cameras=False)
try:
    bpy.ops.export_scene.gltf(**kw, export_image_format="WEBP")
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print("exported", glb)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "island_v2.blend"))
