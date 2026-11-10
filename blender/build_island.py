"""
Floating Studio Island — the 3D world the portfolio scrolls through.

Four zones sit on a floating rock, one per thing the studio builds:
  zone_store    -> online stores   (shop with striped awning + live sign screen)
  zone_gallery  -> portfolios      (three framed screens on easels)
  zone_tower    -> apps            (a phone-shaped tower with a live screen)
  zone_monitor  -> websites        (a giant monitor whose screen runs the configurator)
Plus: a central "core" monument made of building blocks, trees, lamps,
glowing ice crystals under the rock, and small satellite islands.

All meshes that Three.js drives have stable names (screen_*, core_*, beacon,
float_*, crystal_*). Run headless:
  blender -b -P blender/build_island.py -- public
"""
import bpy, math, random, sys, os
from mathutils import Vector

argv = sys.argv
out_dir = argv[argv.index("--") + 1] if "--" in argv else os.getcwd()
os.makedirs(os.path.join(out_dir, "models"), exist_ok=True)
random.seed(42)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection

# ------------------------------------------------------------------ materials
def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def mat(name, hexc, rough=0.7, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*srgb(hexc), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        key = "Emission Color" if "Emission Color" in b.inputs else "Emission"
        b.inputs[key].default_value = (*srgb(emit), 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m

M = {
    "rock":    mat("rock", "#3a2e4d", 0.9),
    "rock2":   mat("rock_dark", "#2a2138", 0.95),
    "ground":  mat("ground", "#8fb487", 0.95),
    "rim":     mat("rim", "#7c8a6c", 0.95),
    "path":    mat("path", "#efe5d3", 0.8),
    "wall":    mat("wall", "#f2eadc", 0.75),
    "roof":    mat("roof", "#2b2339", 0.6),
    "accent":  mat("accent", "#ff5a1f", 0.45, emit="#ff5a1f", emit_strength=0.25),
    "glass":   mat("glass_warm", "#ffc67a", 0.3, emit="#ffb25c", emit_strength=3.0),
    "ice":     mat("ice", "#9fd8ff", 0.2, emit="#7cc8ff", emit_strength=2.5),
    "leaf":    mat("leaf", "#2f6b5e", 0.85),
    "leaf2":   mat("leaf_light", "#4a8f6f", 0.85),
    "trunk":   mat("trunk", "#5a4033", 0.9),
    "frame":   mat("frame", "#1b1726", 0.35, 0.3),
    "chrome":  mat("chrome", "#d9dbe3", 0.15, 1.0),
    "lamp":    mat("lamp", "#ffd49a", 0.4, emit="#ffcf8a", emit_strength=6.0),
    "beacon":  mat("beacon", "#ff5a1f", 0.4, emit="#ff6a2a", emit_strength=8.0),
}

def screen_mat(name):
    return mat(name, "#ffffff", 0.4, emit="#dfe8ff", emit_strength=1.2)

# ------------------------------------------------------------------ helpers
def finish(o, material, parent=None, smooth=False, name=None):
    if name:
        o.name = name
    o.data.materials.clear()
    o.data.materials.append(material)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    if parent:
        o.parent = parent
    return o

def apply_scale(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

def bevel(o, w=0.03, seg=3):
    m = o.modifiers.new("bevel", "BEVEL")
    m.width = w
    m.segments = seg
    m.limit_method = "ANGLE"

def box(size, loc, material, parent=None, bev=0.0, rot=(0, 0, 0), name=None, smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    apply_scale(o)
    if bev:
        bevel(o, bev, 3)
        smooth = True
    return finish(o, material, parent, smooth, name)

def cyl(r, depth, loc, material, parent=None, verts=32, rot=(0, 0, 0), name=None, smooth=True, bev=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.active_object
    if bev:
        bevel(o, bev, 3)
    return finish(o, material, parent, smooth, name)

def sphere(r, loc, material, parent=None, sub=2, name=None, smooth=True, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=sub, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    apply_scale(o)
    return finish(o, material, parent, smooth, name)

def plane(w, h, loc, material, parent=None, name=None):
    # faces -Y (toward the viewer standing in front of the zone); UV u=right, v=up
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object
    o.scale = (w, h, 1)
    apply_scale(o)
    return finish(o, material, parent, False, name)

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    coll.objects.link(e)
    if parent:
        e.parent = parent
    return e

def rim_factor(theta):
    return 1 + 0.07 * math.sin(3 * theta + 0.4) + 0.045 * math.sin(7 * theta + 1.3) + 0.02 * math.sin(13 * theta)

# ------------------------------------------------------------------ island body
island = empty("Island")
R = 6.0
TOP = 0.5

# rocky underside: inverted cone, irregular rim, displaced and decimated into chunky facets
bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=0.35, radius2=R, depth=6.5, location=(0, 0, -3.25 + 0.02))
under = bpy.context.active_object
for v in under.data.vertices:
    x, y, z = v.co
    th = math.atan2(y, x)
    f = rim_factor(th)
    v.co.x *= f
    v.co.y *= f
m = under.modifiers.new("sub", "SUBSURF"); m.subdivision_type = "SIMPLE"; m.levels = 3
tex = bpy.data.textures.new("rocknoise", "CLOUDS"); tex.noise_scale = 1.4
m = under.modifiers.new("disp", "DISPLACE"); m.texture = tex; m.strength = 0.9; m.mid_level = 0.5
m = under.modifiers.new("dec", "DECIMATE"); m.ratio = 0.18
finish(under, M["rock"], island, False, "rock_under")

# ground cap with the same irregular silhouette
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=R * 1.01, depth=0.42, location=(0, 0, TOP - 0.21))
cap = bpy.context.active_object
for v in cap.data.vertices:
    th = math.atan2(v.co.y, v.co.x)
    f = rim_factor(th)
    v.co.x *= f
    v.co.y *= f
bevel(cap, 0.12, 4)
finish(cap, M["ground"], island, True, "ground")

# darker earth band under the grass lip
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=R * 1.0, depth=0.35, location=(0, 0, TOP - 0.55))
band = bpy.context.active_object
for v in band.data.vertices:
    th = math.atan2(v.co.y, v.co.x)
    f = rim_factor(th) * 0.985
    v.co.x *= f
    v.co.y *= f
finish(band, M["rock2"], island, False, "earth_band")

# glowing ice crystals hanging under the rock
for i in range(9):
    th = i / 9 * math.tau + random.uniform(-0.2, 0.2)
    rr = random.uniform(0.6, 3.4)
    length = random.uniform(1.1, 2.6) * (1.25 - rr / 6)
    # sit the crystal's base just inside the cone surface at this radius
    z = -6.48 + (rr - 0.35) / (R - 0.35) * 6.5 + 0.35
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=random.uniform(0.18, 0.32), radius2=0, depth=length,
                                    location=(math.cos(th) * rr, math.sin(th) * rr, z - length / 2),
                                    rotation=(math.pi + random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), 0))
    finish(bpy.context.active_object, M["ice"], island, False, f"crystal_{i}")

# ------------------------------------------------------------------ zones
ZONES = [("store", 45), ("gallery", 135), ("tower", 225), ("monitor", 315)]
ZR = 3.35
zone_roots = {}

def zone_root(name, deg):
    th = math.radians(deg)
    e = empty(f"zone_{name}", island)
    zone_roots[name] = (e, th)
    return e

def place_zone(name):
    e, th = zone_roots[name]
    e.location = (math.cos(th) * ZR, math.sin(th) * ZR, TOP)
    e.rotation_euler = (0, 0, th + math.pi / 2)

# --- STORE (online stores)
z = zone_root("store", 45)
box((2.0, 1.6, 0.1), (0, 0, 0.05), M["path"], z, 0.02)
box((1.6, 1.2, 1.1), (0, 0.05, 0.65), M["wall"], z, 0.03)
box((1.85, 1.45, 0.14), (0, 0.05, 1.26), M["roof"], z, 0.03)
for i in range(8):
    x = -0.7 + i * 0.2
    box((0.2, 0.5, 0.035), (x, -0.73, 1.03), M["accent"] if i % 2 == 0 else M["wall"], z,
        rot=(math.radians(-24), 0, 0), name=f"awning_{i}")
box((0.82, 0.03, 0.5), (-0.28, -0.56, 0.62), M["glass"], z, name="store_window")
box((0.36, 0.03, 0.72), (0.5, -0.56, 0.47), M["roof"], z)
sphere(0.025, (0.6, -0.59, 0.47), M["chrome"], z)
box((1.25, 0.07, 0.38), (0, -0.1, 1.55), M["frame"], z, 0.02)
plane(1.13, 0.27, (0, -0.14, 1.55), screen_mat("screen_store_mat"), z, "screen_store")
# shopping bags + crates by the door
for i, (x, y) in enumerate([(-0.72, -0.85), (-0.5, -0.92), (0.85, -0.78)]):
    box((0.18, 0.1, 0.22), (x, y, 0.21), M["accent"] if i != 1 else M["wall"], z, 0.01, rot=(0, 0, random.uniform(-0.4, 0.4)), name=f"bag_{i}")
    cyl(0.05, 0.005, (x, y, 0.33), M["frame"], z, verts=12, rot=(math.radians(90), 0, 0))
box((0.6, 0.18, 0.06), (-0.35, -0.95, 0.28), M["trunk"], z)  # bench
place_zone("store")

# --- GALLERY (portfolios)
z = zone_root("gallery", 135)
cyl(1.15, 0.1, (0, 0, 0.05), M["path"], z, verts=48, bev=0.02)
for i, (x, yy, rz) in enumerate([(-0.82, 0.12, 22), (0, -0.1, 0), (0.82, 0.12, -22)]):
    fe = empty(f"frame_{i}", z, (x, yy, 0.1))
    fe.rotation_euler = (math.radians(-6), 0, math.radians(rz))
    box((0.74, 0.07, 0.96), (0, 0, 0.78), M["frame"], fe, 0.015)
    plane(0.64, 0.86, (0, -0.04, 0.78), screen_mat(f"screen_gallery_{i}_mat"), fe, f"screen_gallery_{i}")
    box((0.04, 0.04, 0.36), (-0.22, 0.05, 0.18), M["trunk"], fe)
    box((0.04, 0.04, 0.36), (0.22, 0.05, 0.18), M["trunk"], fe)
    box((0.04, 0.04, 0.9), (0, 0.32, 0.45), M["trunk"], fe, rot=(math.radians(-18), 0, 0))
cyl(0.16, 0.5, (0.0, 0.75, 0.35), M["wall"], z, verts=24)
bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.06, location=(0, 0.75, 0.86), rotation=(math.radians(90), 0, 0))
finish(bpy.context.active_object, M["accent"], z, True, "sculpture")
place_zone("gallery")

# --- TOWER (apps): a phone standing like a monolith
z = zone_root("tower", 225)
cyl(0.85, 0.14, (0, 0, 0.07), M["path"], z, verts=48, bev=0.02)
cyl(0.62, 0.1, (0, 0, 0.19), M["roof"], z, verts=48, bev=0.02)
box((1.0, 0.18, 2.05), (0, 0, 1.27), M["frame"], z, 0.13)
plane(0.86, 1.82, (0, -0.095, 1.27), screen_mat("screen_phone_mat"), z, "screen_phone")
box((0.22, 0.012, 0.05), (0, -0.095, 2.2), M["roof"], z, 0.01)  # notch
cyl(0.025, 0.55, (0.32, 0.02, 2.55), M["chrome"], z, verts=10)
sphere(0.075, (0.32, 0.02, 2.86), M["beacon"], z, name="beacon")
# floating app icons orbiting the tower (driven in three.js)
icon_cols = [M["accent"], M["wall"], M["ice"], M["leaf2"]]
for i in range(4):
    th = i / 4 * math.tau
    box((0.24, 0.24, 0.07), (math.cos(th) * 0.95, math.sin(th) * 0.95, 1.0 + i * 0.35), icon_cols[i], z, 0.05,
        rot=(math.radians(90), 0, th + math.pi / 2), name=f"appicon_{i}")
place_zone("tower")

# --- MONITOR (websites)
z = zone_root("monitor", 315)
box((2.3, 1.5, 0.08), (0, 0.1, 0.04), M["path"], z, 0.02)
box((1.0, 0.55, 0.07), (0, 0.25, 0.115), M["chrome"], z, 0.02)
box((0.14, 0.1, 1.0), (0, 0.32, 0.6), M["chrome"], z, 0.03)
box((2.7, 0.14, 1.62), (0, 0.22, 1.72), M["frame"], z, 0.06)
plane(2.52, 1.44, (0, 0.145, 1.72), screen_mat("screen_monitor_mat"), z, "screen_monitor")
box((1.1, 0.36, 0.05), (0, -0.45, 0.105), M["wall"], z, 0.015, name="keyboard")
box((0.16, 0.24, 0.05), (0.8, -0.45, 0.105), M["wall"], z, 0.02, name="mouse")
place_zone("monitor")

# ------------------------------------------------------------------ central core monument
cyl(0.75, 0.12, (0, 0, TOP + 0.06), M["path"], island, verts=48, bev=0.02)
cyl(0.32, 0.55, (0, 0, TOP + 0.4), M["roof"], island, verts=24, bev=0.02)
core = empty("core", island, (0, 0, TOP + 1.25))
cmats = [M["accent"], M["wall"], M["chrome"], M["frame"], M["wall"], M["chrome"], M["accent"], M["frame"]]
k = 0
for ix in (-1, 1):
    for iy in (-1, 1):
        for iz in (-1, 1):
            box((0.26, 0.26, 0.26), (ix * 0.15, iy * 0.15, iz * 0.15), cmats[k], core, 0.04, name=f"core_{k}")
            k += 1

# ------------------------------------------------------------------ paths (stepping stones)
for name, deg in ZONES:
    th = math.radians(deg)
    for j in range(4):
        rr = 0.95 + j * 0.47
        cyl(0.17 + random.uniform(-0.02, 0.03), 0.06, (math.cos(th) * rr, math.sin(th) * rr, TOP + 0.02),
            M["path"], island, verts=10, smooth=False)

# ------------------------------------------------------------------ trees, rocks, lamps
zone_pts = [Vector((math.cos(math.radians(d)) * ZR, math.sin(math.radians(d)) * ZR)) for _, d in ZONES]

def free_spot(min_zone=1.65, min_center=1.2, rmax=5.2):
    for _ in range(200):
        th = random.uniform(0, math.tau)
        rr = random.uniform(min_center, rmax * rim_factor(th) * 0.95)
        p = Vector((math.cos(th) * rr, math.sin(th) * rr))
        if all((p - q).length > min_zone for q in zone_pts):
            # keep clear of the four stepping-stone paths
            ang = math.degrees(th) % 360
            if all(abs(((ang - d + 180) % 360) - 180) > 12 or rr > 3 for _, d in ZONES):
                return p
    return None

def tree(p, parent, scale=1.0, i=0):
    h = random.uniform(0.5, 0.8) * scale
    cyl(0.06 * scale, h, (p.x, p.y, TOP + h / 2), M["trunk"], parent, verts=6, smooth=False)
    leaf = M["leaf"] if random.random() < 0.6 else M["leaf2"]
    r = random.uniform(0.38, 0.55) * scale
    sphere(r, (p.x, p.y, TOP + h + r * 0.7), leaf, parent, sub=1, smooth=False, name=f"tree_{i}",
           scale=(1, 1, random.uniform(1.05, 1.45)))

for i in range(14):
    p = free_spot()
    if p:
        tree(p, island, random.uniform(0.8, 1.25), i)

for i in range(10):
    p = free_spot(1.4, 1.0, 5.6)
    if p:
        sphere(random.uniform(0.1, 0.24), (p.x, p.y, TOP + 0.04), M["rock"], island, sub=1, smooth=False,
               scale=(1, random.uniform(0.7, 1.2), 0.6))

for i, (name, deg) in enumerate(ZONES):
    th = math.radians(deg + 22)
    p = (math.cos(th) * 2.15, math.sin(th) * 2.15)
    cyl(0.03, 0.9, (p[0], p[1], TOP + 0.45), M["frame"], island, verts=8)
    sphere(0.09, (p[0], p[1], TOP + 0.95), M["lamp"], island, name=f"lamp_{i}")

# ------------------------------------------------------------------ satellite islands
for i in range(4):
    th = math.radians(20 + i * 90 + random.uniform(-15, 15))
    rr = random.uniform(8.2, 9.6)
    fz = random.uniform(-1.8, 1.6)
    fe = empty(f"float_{i}", None, (math.cos(th) * rr, math.sin(th) * rr, fz))
    s = random.uniform(0.6, 1.0)
    bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=0.08, radius2=1.0 * s, depth=1.5 * s, location=(0, 0, -0.75 * s))
    o = bpy.context.active_object
    m = o.modifiers.new("dec", "DECIMATE"); m.ratio = 0.9
    finish(o, M["rock"], fe, False)
    cyl(1.02 * s, 0.16, (0, 0, 0.0), M["ground"], fe, verts=9, smooth=False)
    if i % 2 == 0:
        tree(Vector((0.1, 0.0)), fe, 0.8 * s, 100 + i)
        # tree() places relative to TOP; shift that tree down to this rock's surface
        for c in fe.children[-2:]:
            c.location.z -= TOP - 0.08
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.2 * s, radius2=0, depth=0.9 * s, location=(0, 0, 0.5 * s))
        finish(bpy.context.active_object, M["ice"], fe, False, f"floatcrystal_{i}")

# ------------------------------------------------------------------ apply modifiers everywhere
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

tri = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("objects", len(bpy.data.objects), "faces", tri)

glb = os.path.join(out_dir, "models", "island.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", export_apply=True)
print("exported", glb)

# ------------------------------------------------------------------ poster render (static / reduced-motion fallback)
world = bpy.data.worlds.new("dusk")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (*srgb("#2a2247"), 1)
bg.inputs[1].default_value = 0.9

def area(name, loc, energy, size, color):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size; ld.color = srgb(color)
    lo = bpy.data.objects.new(name, ld); lo.location = loc; coll.objects.link(lo)
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.2; sun.color = srgb("#ffc9a0"); sun.angle = 0.15
so = bpy.data.objects.new("sun", sun); coll.objects.link(so)
so.rotation_euler = (math.radians(55), 0, math.radians(-35))
area("fill", (-10, 8, 6), 2500, 10, "#8fa8ff")
area("under", (0, 0, -10), 1500, 12, "#7cc8ff")

cd = bpy.data.cameras.new("cam"); cd.lens = 50
cam = bpy.data.objects.new("cam", cd); coll.objects.link(cam)
cam.location = (13.5, -13.5, 9.5)
cam.rotation_euler = (Vector((0, 0, -0.6)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

try:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
except Exception as e:
    print("cycles", e)
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.film_transparent = True
fmts = [i.identifier for i in bpy.types.ImageFormatSettings.bl_rna.properties["file_format"].enum_items]
scene.render.image_settings.file_format = "WEBP" if "WEBP" in fmts else "PNG"
scene.render.image_settings.color_mode = "RGBA"
ext = "webp" if "WEBP" in fmts else "png"
scene.render.filepath = os.path.join(out_dir, f"island-poster.{ext}")
bpy.ops.render.render(write_still=True)
print("poster", scene.render.filepath)
