"""
Track Day hero devices: a modern phone and an open laptop, product-render quality.

Everything is plain PBR (aluminium, glass, ceramic black) so Three.js lights it
with an environment map at runtime — no textures to download, tiny file.
Animatable / live parts have stable names:
  phone            root of the phone
  screen_phone     rounded screen (UV 0..1 across the glass) for a live canvas
  laptop           root of the laptop
  laptop_lid       hinge pivot (rotate X to open / close)
  screen_laptop    16:10 screen (UV 0..1) for the live configurator preview

Run:  blender -b -P blender/build_devices.py -- public
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_dir = argv[0] if argv else os.getcwd()
os.makedirs(os.path.join(out_dir, "models"), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def mat(name, hexc, rough, metal=0.0, coat=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*srgb(hexc), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for key in ("Coat Weight", "Clearcoat"):
        if key in b.inputs:
            b.inputs[key].default_value = coat
            break
    if emit:
        key = "Emission Color" if "Emission Color" in b.inputs else "Emission"
        b.inputs[key].default_value = (*srgb(emit), 1)
        b.inputs["Emission Strength"].default_value = strength
    return m

M = {
    "alu":      mat("aluminium", "#c9ccd1", 0.32, 1.0),
    "alu_dark": mat("aluminium_dark", "#3a3e45", 0.38, 1.0),
    "titanium": mat("titanium", "#9aa0a8", 0.26, 1.0),
    "backglass": mat("back_glass", "#1d2633", 0.42, 0.0, coat=1.0),
    "black":    mat("ceramic_black", "#07080a", 0.18, 0.0, coat=1.0),
    "key":      mat("keycap", "#15171b", 0.55),
    "lens":     mat("lens_glass", "#050608", 0.04, 0.0, coat=1.0),
    "accent":   mat("accent_blue", "#2f5bff", 0.3, 0.0, emit="#2f5bff", strength=0.6),
    "screen":   mat("screen", "#000000", 0.2, emit="#ffffff", strength=1.0),
}

def link(o, m, parent=None, name=None, smooth=True):
    if name:
        o.name = name
    o.data.materials.clear()
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    if parent:
        o.parent = parent
    return o

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    coll.objects.link(e)
    if parent:
        e.parent = parent
    return e

def rounded_rect_bm(w, h, r, seg=12):
    """bmesh face of a rounded rectangle centred on origin in XY."""
    bm = bmesh.new()
    pts = []
    corners = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]
    for cx, cy, start in corners:
        for i in range(seg + 1):
            a = math.radians(start + 90 * i / seg)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r, 0))
    verts = [bm.verts.new(p) for p in pts]
    bm.faces.new(verts)
    return bm

def slab(name, w, h, d, r, material, parent=None, loc=(0, 0, 0), edge=0.012, seg=12):
    """Rounded-rectangle slab (XY footprint, thickness d along Z) with softened edges."""
    bm = rounded_rect_bm(w, h, r, seg)
    ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    for v in [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]:
        v.co.z += d
    for v in bm.verts:
        v.co.z -= d / 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = loc
    if edge:
        bv = o.modifiers.new("bevel", "BEVEL"); bv.width = edge; bv.segments = 5; bv.limit_method = "ANGLE"; bv.angle_limit = math.radians(50)
    ws = o.modifiers.new("ws", "WEIGHTED_NORMAL"); ws.keep_sharp = True
    return link(o, material, parent)

def screen_plane(name, w, h, r, parent, loc, seg=12):
    """Rounded screen surface facing +Z with planar UVs spanning the glass 0..1."""
    bm = rounded_rect_bm(w, h, r, seg)
    bmesh.ops.triangle_fill(bm, edges=bm.edges[:], use_beauty=True) if False else None
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = ((l.vert.co.x + w / 2) / w, (l.vert.co.y + h / 2) / h)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = loc
    o.parent = parent
    o.data.materials.append(M["screen"])
    return o

# ------------------------------------------------------------------ PHONE (≈ 0.72 × 1.5 × 0.075)
phone = empty("phone")
PW, PH, PD, PR = 0.72, 1.5, 0.078, 0.115
slab("phone_frame", PW, PH, PD, PR, M["titanium"], phone, edge=0.018)
slab("phone_back", PW - 0.012, PH - 0.012, 0.004, PR - 0.006, M["backglass"], phone, loc=(0, 0, -PD / 2 - 0.0005), edge=0.0015)
slab("phone_front", PW - 0.008, PH - 0.008, 0.004, PR - 0.004, M["black"], phone, loc=(0, 0, PD / 2 + 0.0005), edge=0.0015)
screen_plane("screen_phone", PW - 0.05, PH - 0.05, PR - 0.024, phone, (0, 0, PD / 2 + 0.0028))
# dynamic-island capsule
slab("phone_island", 0.17, 0.05, 0.002, 0.025, M["black"], phone, loc=(0, PH / 2 - 0.07, PD / 2 + 0.0034), edge=0)
# camera plateau + lenses on the back
cam = slab("phone_camera", 0.3, 0.3, 0.012, 0.075, M["backglass"], phone, loc=(-PW / 2 + 0.2, PH / 2 - 0.2, -PD / 2 - 0.007), edge=0.004)
for i, (dx, dy) in enumerate([(-0.065, 0.065), (-0.065, -0.065), (0.07, 0.0)]):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.052, depth=0.016, vertices=48,
                                        location=(-PW / 2 + 0.2 + dx, PH / 2 - 0.2 + dy, -PD / 2 - 0.016))
    ring = link(bpy.context.active_object, M["titanium"], phone, f"phone_lens_ring_{i}")
    bpy.ops.mesh.primitive_cylinder_add(radius=0.038, depth=0.004, vertices=48,
                                        location=(-PW / 2 + 0.2 + dx, PH / 2 - 0.2 + dy, -PD / 2 - 0.0245))
    link(bpy.context.active_object, M["lens"], phone, f"phone_lens_{i}")
# side buttons
for i, (y, h) in enumerate([(0.32, 0.16), (0.12, 0.1), (-0.0, 0.1)]):
    slab(f"phone_btn_{i}", 0.012, h, 0.022, 0.005, M["titanium"], phone, loc=(-PW / 2 - 0.004, y, 0), edge=0)
slab("phone_power", 0.012, 0.2, 0.022, 0.005, M["titanium"], phone, loc=(PW / 2 + 0.004, 0.22, 0), edge=0)
for o in [o for o in phone.children if o.name.startswith("phone_btn") or o.name == "phone_power"]:
    o.rotation_euler = (0, math.radians(90), 0)

# ------------------------------------------------------------------ LAPTOP (≈ 2.4 × 1.62)
laptop = empty("laptop", loc=(0, 0, 0))
LW, LDp, LT, LR = 2.4, 1.62, 0.055, 0.07
base = slab("laptop_base", LW, LDp, LT, LR, M["alu"], laptop, loc=(0, 0, LT / 2), edge=0.012)
# keyboard well + keys
slab("laptop_well", LW * 0.86, LDp * 0.42, 0.006, 0.03, M["alu_dark"], laptop, loc=(0, LDp * 0.17, LT + 0.0005), edge=0.002)
kw, kh, gap = 0.128, 0.11, 0.021
rows = 6
for r_ in range(rows):
    widths = [1.0] * 14 if r_ < 5 else [1.0, 1.0, 1.0, 1.25, 5.6, 1.25, 1.0, 1.0, 1.0]
    widths = [w * kw for w in widths]
    total = sum(widths) + gap * (len(widths) - 1)
    x = -total / 2
    y = LDp * 0.17 + LDp * 0.18 - r_ * (kh + gap * 0.8) - kh / 2 + 0.03
    for c_, w in enumerate(widths):
        slab(f"key_{r_}_{c_}", w, kh * (0.55 if r_ == 0 else 1), 0.012, 0.012, M["key"], laptop, loc=(x + w / 2, y, LT + 0.006), edge=0.003, seg=4)
        x += w + gap
slab("laptop_trackpad", 0.86, 0.52, 0.002, 0.04, M["alu"], laptop, loc=(0, -LDp * 0.28, LT + 0.0003), edge=0.001)
# hinge pivot at the back edge; lid built lying flat then rotated open
lid = empty("laptop_lid", laptop, loc=(0, LDp / 2 - 0.02, LT))
LIDT = 0.038
slab("laptop_lid_shell", LW, LDp - 0.02, LIDT, LR, M["alu"], lid, loc=(0, -(LDp - 0.02) / 2, LIDT / 2), edge=0.01)
slab("laptop_bezel", LW - 0.03, LDp - 0.05, 0.003, LR - 0.01, M["black"], lid, loc=(0, -(LDp - 0.02) / 2, -0.0005), edge=0.001)
sw, sh = LW - 0.16, (LW - 0.16) / 1.6
screen_plane("screen_laptop", sw, sh, 0.02, lid, (0, -(LDp - 0.02) / 2 - 0.012, -0.0025))
# the screen plane faces +Z in lid space; the lid's inner side is -Z → flip it
scr = bpy.data.objects["screen_laptop"]
scr.rotation_euler = (math.radians(180), 0, 0)
scr.location.y = -(LDp - 0.02) / 2 + 0.012
slab("laptop_notch", 0.22, 0.04, 0.002, 0.02, M["black"], lid, loc=(0, -0.045, -0.0035), edge=0)
lid.rotation_euler = (math.radians(-108), 0, 0)  # open ~108° (0 = closed)

# apply modifiers
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.modifiers:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception as e:
                print("apply", o.name, e)

# join static sub-parts to cut draw calls (keep screens, lid pivot, roots separate)
def join_children(parent, keep):
    parts = [o for o in parent.children if o.type == "MESH" and o.name not in keep]
    by_mat = {}
    for o in parts:
        by_mat.setdefault(o.data.materials[0].name, []).append(o)
    for mname, objs in by_mat.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        bpy.context.active_object.name = f"{parent.name}_{mname}"

join_children(phone, {"screen_phone"})
join_children(laptop, set())
join_children(lid, {"screen_laptop"})

# side-by-side for the poster; Three.js re-positions them
phone.location = (1.85, -0.35, 0.78)
phone.rotation_euler = (math.radians(74), math.radians(-12), math.radians(-24))
laptop.rotation_euler = (0, 0, math.radians(18))

faces = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("faces", faces)
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, "models", "devices.glb"), export_format="GLB", export_apply=True)
print("exported devices.glb")

# ------------------------------------------------------------------ poster (studio product shot)
world = bpy.data.worlds.new("studio"); scene.world = world; world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (*srgb("#0b0d12"), 1); bg.inputs[1].default_value = 0.6
def area(name, loc, energy, size, color="#ffffff", target=(0, 0, 0.4)):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size; ld.color = srgb(color)
    lo = bpy.data.objects.new(name, ld); lo.location = loc; coll.objects.link(lo)
    lo.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("key", (3, -4, 5), 900, 4)
area("rim", (-4, 3, 3), 700, 3, "#5f86ff")
area("fill", (0, -6, 1), 200, 6)
cd = bpy.data.cameras.new("cam"); cd.lens = 55
cam_o = bpy.data.objects.new("cam", cd); coll.objects.link(cam_o)
cam_o.location = (3.2, -5.6, 3.1)
cam_o.rotation_euler = (Vector((0.4, 0, 0.55)) - cam_o.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam_o
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"; prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "OPTIX"
    scene.cycles.device = "GPU"
except Exception as e:
    print("cpu render", e)
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1600, 1100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 86
scene.render.filepath = os.path.join(out_dir, "devices-poster.webp")
bpy.ops.render.render(write_still=True)
print("poster saved")
