"""Download CC0 PBR textures from Poly Haven (bake-time only; never shipped to the site).
usage: python blender/fetch_textures.py
"""
import json, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "textures")
SETS = {
    "cliff_side": "2k",          # rock underside
    "aerial_grass_rock": "2k",   # island top
    "concrete_slab_wall": "2k",  # architecture
    "concrete_pavers_02": "1k",  # paths / plaza
    "dark_rock": "1k",           # boulders + satellite rocks
}
MAPS = {"Diffuse": "diff", "nor_gl": "nor", "Rough": "rough"}
UA = {"User-Agent": "portfolio-asset-fetch/1.0"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()

MODELS = ["namaqualand_boulder_02", "namaqualand_boulder_03"]  # scanned rocks, decimated at build time

for asset in MODELS:
    entry = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))["gltf"]["1k"]["gltf"]
    base = os.path.join(HERE, "models", asset)
    os.makedirs(os.path.join(base, "textures"), exist_ok=True)
    for rel, meta in [(f"{asset}.gltf", entry), *entry["include"].items()]:
        dest = os.path.join(base, rel)
        if not os.path.exists(dest):
            with open(dest, "wb") as f:
                f.write(get(meta["url"]))
        print(asset, rel, os.path.getsize(dest) // 1024, "KB")

for asset, res in SETS.items():
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))
    os.makedirs(os.path.join(OUT, asset), exist_ok=True)
    for key, short in MAPS.items():
        entry = files.get(key, {}).get(res, {})
        fmt = "jpg" if "jpg" in entry else "png"
        url = entry[fmt]["url"]
        dest = os.path.join(OUT, asset, f"{short}.{fmt}")
        if not os.path.exists(dest):
            with open(dest, "wb") as f:
                f.write(get(url))
        print(asset, short, os.path.getsize(dest) // 1024, "KB")
