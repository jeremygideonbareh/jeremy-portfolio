"""
Builds the hero "component cube" for the portfolio: a 3x3x3 cluster of
modular building blocks (rounded boxes, spheres, cylinders, rings, arches).
Each piece is exported as its own named mesh so Three.js can explode,
orbit and reassemble them on scroll.

Run headless:
  blender -b -P blender/build_blocks.py -- <out_dir>
Outputs:
  <out_dir>/models/blocks.glb
  <out_dir>/poster.webp (or .png)  static first-frame / no-WebGL fallback
"""
import bpy, math, random, sys, os
from mathutils import Vector

argv = sys.argv
out_dir = argv[argv.index("--") + 1] if "--" in argv else os.getcwd()
os.makedirs(os.path.join(out_dir, "models"), exist_ok=True)

random.seed(7)

# ---------- clean scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- materials ----------
def make_mat(name, color, metallic, roughness, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = (*emission, 1)
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 1.5
    return m

MATS = {
    "chrome": make_mat("chrome", (0.86, 0.86, 0.9), 1.0, 0.12),
    "ink":    make_mat("ink",    (0.025, 0.025, 0.035), 0.2, 0.35),
    "bone":   make_mat("bone",   (0.86, 0.82, 0.74), 0.0, 0.45),
    "accent": make_mat("accent", (1.0, 0.18, 0.04), 0.1, 0.3, emission=(1.0, 0.12, 0.02)),
}
MAT_POOL = ["chrome"] * 9 + ["ink"] * 7 + ["bone"] * 6 + ["accent"] * 4

# ---------- shape builders (unit cell = 1.0, piece ~0.86) ----------
S = 0.43

def add_bevel(obj, width=0.07, segments=5):
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"

def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True

def shape_box(loc):
    bpy.ops.mesh.primitive_cube_add(size=2 * S, location=loc)
    o = bpy.context.active_object
    add_bevel(o, 0.08, 6)
    smooth(o)
    return o

def shape_sphere(loc):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=S, segments=40, ring_count=20, location=loc)
    o = bpy.context.active_object
    smooth(o)
    return o

def shape_cyl(loc):
    bpy.ops.mesh.primitive_cylinder_add(radius=S, depth=2 * S, vertices=40, location=loc)
    o = bpy.context.active_object
    o.rotation_euler = random.choice([(0, 0, 0), (math.pi / 2, 0, 0), (0, math.pi / 2, 0)])
    add_bevel(o, 0.06, 4)
    smooth(o)
    return o

def shape_ring(loc):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.13,
                                     major_segments=48, minor_segments=16, location=loc)
    o = bpy.context.active_object
    o.rotation_euler = (random.uniform(0, math.pi), random.uniform(0, math.pi), 0)
    smooth(o)
    return o

def shape_arch(loc):
    bpy.ops.mesh.primitive_cube_add(size=2 * S, location=loc)
    o = bpy.context.active_object
    bpy.ops.mesh.primitive_cylinder_add(radius=S * 0.62, depth=2 * S + 0.2, vertices=40,
                                        location=(loc[0], loc[1], loc[2] - S),
                                        rotation=(math.pi / 2, 0, 0))
    cutter = bpy.context.active_object
    b = o.modifiers.new("cut", "BOOLEAN")
    b.operation = "DIFFERENCE"
    b.object = cutter
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="cut")
    bpy.data.objects.remove(cutter, do_unlink=True)
    add_bevel(o, 0.05, 4)
    smooth(o)
    o.rotation_euler = (0, 0, random.choice([0, math.pi / 2, math.pi, -math.pi / 2]))
    return o

SHAPES = [("box", shape_box)] * 9 + [("sphere", shape_sphere)] * 3 + \
         [("cyl", shape_cyl)] * 3 + [("ring", shape_ring)] * 2 + [("arch", shape_arch)] * 3

root = bpy.data.objects.new("Blocks", None)
scene.collection.objects.link(root)

count = 0
for ix in range(3):
    for iy in range(3):
        for iz in range(3):
            if (ix, iy, iz) == (1, 1, 1):
                continue  # hidden core
            loc = Vector((ix - 1, iy - 1, iz - 1)) * 1.0
            kind, fn = random.choice(SHAPES)
            o = fn(tuple(loc))
            mat_name = random.choice(MAT_POOL)
            o.data.materials.clear()
            o.data.materials.append(MATS[mat_name])
            o.name = f"piece_{count:02d}_{kind}_{mat_name}"
            o.parent = root
            count += 1

# apply modifiers so glTF ships final geometry
for o in list(root.children):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    for m in list(o.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e:
            print("modifier apply failed", o.name, e)
    o.select_set(False)

print(f"built {count} pieces")

glb_path = os.path.join(out_dir, "models", "blocks.glb")
bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", export_apply=True)
print("exported", glb_path)

# ---------- poster render ----------
root.rotation_euler = (math.radians(18), math.radians(-8), math.radians(38))

world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.012, 0.012, 0.016, 1)
bg.inputs[1].default_value = 0.6

def light(name, loc, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    ld.color = color
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    scene.collection.objects.link(lo)
    d = Vector((0, 0, 0)) - Vector(loc)
    lo.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

light("key", (5, -5, 6), 1400, 5)
light("rim", (-6, 4, 3), 900, 4, (1.0, 0.45, 0.25))
light("fill", (0, -7, -2), 300, 6, (0.6, 0.7, 1.0))

cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 70
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
cam.location = (7.5, -7.5, 5.2)
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

try:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"
except Exception as e:
    print("cycles setup issue", e)

scene.render.resolution_x = 1400
scene.render.resolution_y = 1400
scene.render.film_transparent = True

fmts = [i.identifier for i in bpy.types.ImageFormatSettings.bl_rna.properties["file_format"].enum_items]
if "WEBP" in fmts:
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 88
    poster = os.path.join(out_dir, "poster.webp")
else:
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    poster = os.path.join(out_dir, "poster.png")
scene.render.filepath = poster
bpy.ops.render.render(write_still=True)
print("poster", poster)
