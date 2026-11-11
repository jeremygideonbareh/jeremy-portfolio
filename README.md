# Jeremy — Track Day portfolio

A motion-heavy portfolio for an independent designer & developer, built as a racing lap:
start-light loader, a racing line that draws down the page, a horizontal speed run through
real, live launches, a laptop that opens on scroll, a pit-stop configurator that renders a visitor's
own site live on 3D devices, and a chequered-flag contact form.

**Live:** https://jeremygideonbareh.github.io/jeremy-portfolio/

## Stack
Vite · GSAP + ScrollTrigger · Lenis · Three.js · Blender (devices and ceramics) · Playwright (capture tooling)

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Make it yours
Edit `src/config.js`: `SITE.email`, `SITE.formEndpoint` (e.g. Formspree), `SITE.socials`, and the
`WORK` list (each entry is a GitHub Pages repo; `featured: true` puts it in the speed run and on the podium).

To refresh screenshots of live sites:
```bash
node tools/shoot-sites.mjs shots-sites the-ark-music-shillong meghalaya-mun            # desktop, 1200x750
MOBILE=1 node tools/shoot-sites.mjs shots-sites the-ark-music-shillong meghalaya-mun   # phone, saved as <name>-m.webp
```
Then resize into `public/images/work/` (960x600 desktop; phone shots as-is).

Scrolling filmstrips (used by the telemetry sheet, onboard phones, 3D screens and speed-run hovers):
```bash
node tools/shoot-strips.mjs                 # every project in WORK
node tools/shoot-strips.mjs the-ark-music-shillong   # just one (by `shot`)
```

## 3D assets
- `blender/build_devices.py`: phone and laptop → `public/models/devices.glb`, compressed with
  `gltf-transform` (meshopt)
- `blender/render_ceramics.py`: product shots for the Kiln & Co. concept
- Concept photography: CC0 from Poly Haven. See `public/images/CREDITS.txt`.

Deploys to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`).
