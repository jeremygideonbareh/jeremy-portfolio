"""Product shots for the "Kiln & Co." concept store: four glazed ceramics on a stone sweep.
Run: blender -b -P blender/render_ceramics.py -- public/images
"""
import bpy, math, sys, os
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "."
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def glaze(name, hexc, rough=0.22, speckle=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    b = next(n for n in N if n.type == "BSDF_PRINCIPLED")
    b.inputs["Roughness"].default_value = rough
    for k in ("Coat Weight", "Clearcoat"):
        if k in b.inputs: b.inputs[k].default_value = 0.6; break
    base = (*srgb(hexc), 1)
    if speckle:
        nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 180; nz.inputs["Detail"].default_value = 2
        ramp = N.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.62; ramp.color_ramp.elements[0].color = base
        ramp.color_ramp.elements[1].position = 0.66; ramp.color_ramp.elements[1].color = (*srgb("#2b2622"), 1)
        L.new(nz.outputs["Fac"], ramp.inputs["Fac"]); L.new(ramp.outputs["Color"], b.inputs["Base Color"])
    else:
        b.inputs["Base Color"].default_value = base
    return m

def lathe(name, profile, mat, loc=(0, 0, 0)):
    """profile: list of (radius, z) from bottom centre outward/up; revolved around Z."""
    verts = [(r, 0, z) for r, z in profile]
    edges = [(i, i + 1) for i in range(len(verts) - 1)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, edges, [])
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.location = loc
    sc = o.modifiers.new("screw", "SCREW"); sc.steps = 96; sc.render_steps = 96; sc.use_merge_vertices = True
    so = o.modifiers.new("solid", "SOLIDIFY"); so.thickness = 0.012
    sub = o.modifiers.new("sub", "SUBSURF"); sub.levels = 2; sub.render_levels = 2
    me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    return o

PIECES = [
    ("vase", glaze("charcoal", "#26282b", 0.3, speckle=1), [(0.0, 0), (0.16, 0), (0.24, 0.12), (0.27, 0.32), (0.2, 0.52), (0.09, 0.62), (0.075, 0.74), (0.1, 0.78)]),
    ("mug", glaze("slate", "#3b4a5c", 0.2), [(0.0, 0), (0.17, 0), (0.19, 0.04), (0.2, 0.3), (0.2, 0.36), (0.185, 0.36), (0.185, 0.06)]),
    ("bowl", glaze("sand", "#d8c9b0", 0.26, speckle=1), [(0.0, 0), (0.12, 0), (0.13, 0.02), (0.3, 0.12), (0.38, 0.2), (0.4, 0.22), (0.385, 0.22), (0.29, 0.135), (0.0, 0.04)]),
    ("plate", glaze("bone", "#ece6da", 0.18, speckle=1), [(0.0, 0.0), (0.2, 0.0), (0.22, 0.015), (0.42, 0.04), (0.46, 0.06), (0.445, 0.06), (0.4, 0.045), (0.0, 0.025)]),
]

# stone sweep (cyclorama)
bpy.ops.mesh.primitive_plane_add(size=1)
sweep = bpy.context.active_object
sweep.data.materials.append(glaze("stone", "#dcd6cc", 0.8))
me = sweep.data
import bmesh
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=40, use_grid_fill=True)
bm.to_mesh(me); bm.free()
for v in me.vertices:
    x, y = v.co.x * 6, v.co.y * 6
    z = 0.0 if y < 0.8 else (y - 0.8) ** 2 * 0.6
    v.co = Vector((x, y, z))
for p in me.polygons: p.use_smooth = True

world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
next(n for n in world.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (*srgb("#dcd6cc"), 1)

def area(name, loc, energy, size, target=(0, 0, 0.25)):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size
    lo = bpy.data.objects.new(name, ld); lo.location = loc; coll.objects.link(lo)
    lo.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("key", (-1.6, -1.2, 2.0), 260, 1.6)
area("rim", (1.8, 1.4, 1.2), 140, 1.2)
area("fill", (1.2, -2.2, 0.6), 60, 2.0)

cd = bpy.data.cameras.new("cam"); cd.lens = 70
cam = bpy.data.objects.new("cam", cd); coll.objects.link(cam); scene.camera = cam
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"; prefs.get_devices()
    for d in prefs.devices: d.use = d.type == "OPTIX"
    scene.cycles.device = "GPU"
except Exception as e:
    print("cpu", e)
scene.cycles.samples = 96; scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 640
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "WEBP"; scene.render.image_settings.quality = 82

objs = []
for name, mat, prof in PIECES:
    o = lathe(name, prof, mat)
    if name == "mug":  # handle
        bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.022, location=(0.23, 0, 0.19), rotation=(math.radians(90), 0, 0))
        h = bpy.context.active_object; h.data.materials.append(mat); h.parent = o
        for p in h.data.polygons: p.use_smooth = True
    objs.append(o)

for i, o in enumerate(objs):
    for other in objs:
        other.hide_render = other is not o
        for c in other.children: c.hide_render = other is not o
    o.rotation_euler = (0, 0, math.radians(20))
    h = max((v.co.z for v in o.data.vertices), default=0.4)
    cam.location = (0.0, -2.6, 0.55 + h * 0.4)
    cam.rotation_euler = (Vector((0, 0, h * 0.42)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(out, f"kiln-{i + 1}.webp")
    bpy.ops.render.render(write_still=True)
    print("rendered", scene.render.filepath)
