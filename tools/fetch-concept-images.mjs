// Real imagery for the concept builds: CC0 photographs from Poly Haven (polyhaven.com),
// cropped from the horizon band of each panorama and saved as small WebP tiles.
// usage: node tools/fetch-concept-images.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const SETS = {
  ines: ['fish_hoek_beach', 'gray_pier', 'cloudy_cliffside_road', 'beach_cloudy_bridge'],
  rhea: ['concrete_tunnel_02', 'hangar_interior', 'events_hall_interior', 'afrikaans_church_interior'],
  bloom: ['glasshouse_interior', 'abandoned_greenhouse', 'green_sanctuary', 'garden_nook'],
  northline: ['comfy_cafe', 'german_town_street'],
};
const UA = { 'User-Agent': 'portfolio-asset-fetch/1.0' };
fs.mkdirSync('public/images', { recursive: true });
const credits = [];

for (const [set, ids] of Object.entries(SETS)) {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
    const url = files.tonemapped?.url;
    if (!url) { console.log('no tonemapped for', id); continue; }
    const buf = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer());
    const img = sharp(buf);
    const { width, height } = await img.metadata();
    // a ~100° window centred on the panorama's front, around the horizon
    const w = Math.round(width * 0.28), h = Math.round(w * 0.625);
    const left = Math.round(width * 0.5 - w / 2) + (i % 2 ? Math.round(width * 0.25) : 0);
    const top = Math.round(height * 0.5 - h * 0.55);
    const out = `public/images/${set}-${i + 1}.webp`;
    await sharp(buf).extract({ left: Math.min(left, width - w), top, width: w, height: h }).resize(800, 500).modulate({ saturation: 0.92 }).webp({ quality: 74 }).toFile(out);
    credits.push(`${out} — "${id}" by Poly Haven (CC0), https://polyhaven.com/a/${id}`);
    console.log(out, fs.statSync(out).size >> 10, 'KB');
  }
}
fs.writeFileSync('public/images/CREDITS.txt', credits.join('\n') + '\n');
