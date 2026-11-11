// v1 — the floating studio island (low-poly, dusk, orange accent).
// One fixed WebGL canvas whose camera flies a scroll-driven path of keyframes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { paintSite, paintStoreSign, paintPhoneApp } from './sitepainter.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Atmosphere presets: 0 dusk → 1 night → 2 space
const ATMOS = [
  { top: '#2a1f5c', horizon: '#f08a6c', bottom: '#1d1736', fog: '#7a5578', near: 26, far: 75, stars: 0.0, sun: '#ffb98a', sunI: 2.8, hemi: '#a9b2ff', hemiI: 1.15 },
  { top: '#0b0a24', horizon: '#56397a', bottom: '#08070f', fog: '#2d2348', near: 28, far: 90, stars: 0.7, sun: '#ffd2b0', sunI: 1.6, hemi: '#7480d0', hemiI: 0.9 },
  { top: '#030309', horizon: '#1d1744', bottom: '#020205', fog: '#0c0a1c', near: 70, far: 190, stars: 1.0, sun: '#ffd8bd', sunI: 2.0, hemi: '#7480d0', hemiI: 0.8 },
];
const colorPairs = ['top', 'horizon', 'bottom', 'fog', 'sun', 'hemi'];
const ATMOS_C = ATMOS.map((a) => Object.fromEntries(colorPairs.map((k) => [k, new THREE.Color(a[k])])));

export class World {
  constructor(canvas, { previewCanvas, onProgress, mobile }) {
    this.canvas = canvas;
    this.previewCanvas = previewCanvas;
    this.onProgress = onProgress || (() => {});
    this.mobile = mobile;
    this.scrollY = 0;
    this.track = [];
    this.keys = {};
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSmooth = new THREE.Vector2(0, 0);
    this.intro = 1;
    this.previewDirty = true;
    this.hovered = null;
    this.velocity = 0;
    this.state = { atmo: 0, shift: 0, chapterKey: 'hero' };
    this.camPos = new THREE.Vector3(30, 30, 40);
    this.camTarget = new THREE.Vector3();
    this.disposed = false;

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(mobile ? 50 : 36, 1, 0.1, 600);

    const pmrem = new THREE.PMREMGenerator(r);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.#buildSky();
    this.#buildLights();
    this.#buildClouds();

    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.55, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.resize();
  }

  // ---------------------------------------------------------------- sky, stars, lights, clouds
  #buildSky() {
    this.skyUniforms = { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() } };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.skyUniforms,
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
        fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; varying vec3 vP;
          void main(){ float h = normalize(vP).y;
            vec3 c = h > 0. ? mix(uHorizon, uTop, pow(clamp(h,0.,1.), .55)) : mix(uHorizon, uBottom, pow(clamp(-h,0.,1.), .45));
            gl_FragColor = vec4(c, 1.); }`,
      })
    );
    sky.renderOrder = -1;
    this.scene.add(sky);

    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      tmpV.randomDirection().multiplyScalar(300);
      if (tmpV.y < -40) tmpV.y *= -1;
      pos.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xfff4e6, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.scene.add(new THREE.Points(g, this.starMat));
    this.scene.fog = new THREE.Fog(0x7a5578, 26, 75);
  }

  #buildLights() {
    this.hemi = new THREE.HemisphereLight(0xa9b2ff, 0x3a2e4d, 1.15);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffb98a, 2.8));
    sun.position.set(9, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    // cold light from below makes the ice crystals and rock underside glow
    this.under = new THREE.PointLight(0x7cc8ff, 40, 14, 1.6);
    this.under.position.set(0, -5, 0);
    this.scene.add(this.under);
  }

  #buildClouds() {
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcfc3e0, roughness: 1, emissive: 0x4a3c78, emissiveIntensity: 0.22 });
    const puffs = [];
    const rnd = mulberry32(11);
    const cluster = (cx, cy, cz, s) => {
      const k = 5 + Math.floor(rnd() * 4);
      for (let i = 0; i < k; i++) {
        const r = s * (0.55 + rnd() * 0.6);
        puffs.push([cx + (rnd() - 0.5) * s * 2.6, cy + (rnd() - 0.2) * s * 0.6, cz + (rnd() - 0.5) * s * 1.4, r]);
      }
    };
    // upper deck above the hero camera — the intro swoop dives down through it
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
      const rad = 8 + rnd() * 14;
      cluster(Math.cos(a) * rad, 21 + rnd() * 5, Math.sin(a) * rad, 1.6 + rnd() * 1.4);
    }
    // horizon banks that frame the world
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rnd() * 0.3;
      const rad = 27 + rnd() * 14;
      cluster(Math.cos(a) * rad, -2 + rnd() * 4, Math.sin(a) * rad, 2.2 + rnd() * 1.8);
    }
    // skirt around the rock, below the grass line
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
      const rad = 10.5 + rnd() * 3;
      cluster(Math.cos(a) * rad, -3.5 - rnd() * 1.5, Math.sin(a) * rad, 0.9 + rnd() * 0.6);
    }
    // lower deck beneath the island
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rnd() * 0.4;
      const rad = 9 + rnd() * 12;
      cluster(Math.cos(a) * rad, -7 - rnd() * 3, Math.sin(a) * rad, 1.4 + rnd() * 1.2);
    }
    const mesh = new THREE.InstancedMesh(geo, mat, puffs.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    puffs.forEach(([x, y, z, r], i) => {
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r * 1.25, r * 0.8, r));
      mesh.setMatrixAt(i, m);
    });
    this.clouds = new THREE.Group();
    this.clouds.add(mesh);
    this.scene.add(this.clouds);
  }

  // ---------------------------------------------------------------- model
  async load(url) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((res, rej) => loader.load(url, res, (e) => e.total && this.onProgress(e.loaded / e.total), rej));
    const root = gltf.scene;
    this.root = root;
    this.scene.add(root);

    const byName = (n) => root.getObjectByName(n);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const isGlow = /screen|crystal|lamp|beacon|glass|window/.test(o.name) || /ice|lamp|beacon|glass/.test(o.material?.name || '');
      o.castShadow = !isGlow;
      o.receiveShadow = true;
      if (o.material?.name === 'ground') o.material.color.set('#8fb487');
      if (o.material?.name === 'glass_warm') o.material.emissiveIntensity = 0.9;
    });

    this.island = byName('Island');
    this.core = byName('core');
    this.coreCubes = this.core ? this.core.children.map((c) => ({ o: c, base: c.position.clone() })) : [];
    this.beacon = byName('beacon');
    this.crystals = [];
    root.traverse((o) => { if (/^(crystal_|floatcrystal_)/.test(o.name)) this.crystals.push(o); });
    this.lamps = [0, 1, 2, 3].map((i) => byName(`lamp_${i}`)).filter(Boolean);
    this.floats = [0, 1, 2, 3].map((i) => byName(`float_${i}`)).filter(Boolean).map((o, i) => ({ o, y: o.position.y, p: i * 1.7 }));
    this.frames = [0, 1, 2].map((i) => byName(`frame_${i}`)).filter(Boolean).map((o) => ({ o, rz: o.rotation.z }));
    [this.beacon, ...this.crystals, ...this.lamps].forEach((o) => { if (o?.material) o.material = o.material.clone(); });

    // tower app icons orbit on a pivot
    const tower = byName('zone_tower');
    if (tower) {
      this.iconPivot = new THREE.Group();
      tower.add(this.iconPivot);
      [0, 1, 2, 3].forEach((i) => { const ic = byName(`appicon_${i}`); if (ic) this.iconPivot.attach(ic); });
    }

    this.zones = {};
    for (const z of ['store', 'gallery', 'tower', 'monitor']) {
      const o = byName(`zone_${z}`);
      const p = o.getWorldPosition(new THREE.Vector3());
      this.zones[z] = { o, p, out: new THREE.Vector3(p.x, 0, p.z).normalize() };
    }

    this.#buildScreens(byName);
    this.computeKeys();
    return this;
  }

  #buildScreens(byName) {
    const mk = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false; // glTF UV convention
      tex.anisotropy = 8;
      return { c, ctx: c.getContext('2d'), tex };
    };
    const apply = (mesh, tex) => {
      if (mesh) mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.86), fog: false });
    };
    this.signScreen = mk(512, 128);
    apply(byName('screen_store'), this.signScreen.tex);
    this.phoneScreen = mk(270, 570);
    apply(byName('screen_phone'), this.phoneScreen.tex);
    const galleryCfgs = [
      { type: 'portfolio', name: 'Ines Duarte', palette: 'noir', font: 'serif', layout: 'editorial', radius: 4, motion: 'calm', headline: 'Light, kept.' },
      { type: 'portfolio', name: 'Studio Rhea', palette: 'glacier', font: 'mono', layout: 'centered', radius: 0, motion: 'calm', headline: 'Plans to places.' },
      { type: 'portfolio', name: 'Mara Ilic', palette: 'candy', font: 'grotesk', layout: 'centered', radius: 20, motion: 'calm', headline: 'Shapes that talk.' },
    ];
    this.galleryScreens = galleryCfgs.map((cfg, i) => {
      const s = mk(600, 800);
      s.cfg = cfg;
      apply(byName(`screen_gallery_${i}`), s.tex);
      return s;
    });
    this.paintGallery();
    this.monitorTex = new THREE.CanvasTexture(this.previewCanvas);
    this.monitorTex.colorSpace = THREE.SRGBColorSpace;
    this.monitorTex.flipY = false;
    this.monitorTex.anisotropy = 8;
    this.monitorScreen = byName('screen_monitor');
    apply(this.monitorScreen, this.monitorTex);
  }

  paintGallery() {
    this.galleryScreens?.forEach((s) => {
      paintSite(s.ctx, s.c.width, s.c.height, s.cfg, 0, 1, { chrome: false });
      s.tex.needsUpdate = true;
    });
  }

  // ---------------------------------------------------------------- camera keyframes
  computeKeys() {
    if (!this.zones) return;
    const desk = !this.mobile;
    const aspect = this.camera.aspect;
    const K = (pos, target, shift = 0, atmo = 0) => ({ pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target), shift, atmo });
    const zoneKey = (z, dist, h, side, look = 1, shift = desk ? 0.2 : 0) => {
      const { p, out } = this.zones[z];
      const sideV = tmpV.crossVectors(UP, out).normalize();
      const pos = p.clone().addScaledVector(out, dist * (desk ? 1 : 1.55)).addScaledVector(UP, h + (desk ? 0 : 0.8)).addScaledVector(sideV, side * (desk ? 1 : 0.4));
      const target = p.clone().addScaledVector(UP, look).addScaledVector(out, desk ? 0 : -0.2);
      if (!desk) target.y -= 1.7; // object in the upper half on phones, card below
      return { pos, target, shift, atmo: 0.15 };
    };
    // monitor push-in: the configurator preview fills the right side of the screen
    const mon = this.zones.monitor;
    const sc = this.monitorScreen.getWorldPosition(new THREE.Vector3());
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const d = 2.52 / (0.46 * 2 * Math.tan(vFov / 2) * aspect);
    const buildPos = sc.clone().addScaledVector(mon.out, Math.max(d, 1.6)).addScaledVector(UP, 0.05);

    this.keys = {
      hero: K(desk ? [11.2, 8.4, 16] : [11, 12, 20], desk ? [0, -0.2, 0] : [0, -5.2, 0], desk ? 0.27 : 0, 0),
      arrive: K([8.5, 4.2, 10.5], [0, 0.8, 0], desk ? 0.2 : 0, 0.05),
      store: zoneKey('store', 4.4, 1.7, 1.2, 0.9),
      gallery: zoneKey('gallery', 4.1, 1.5, -1.0, 0.9),
      tower: zoneKey('tower', 5.0, 1.2, 1.2, 1.5),
      monitor: zoneKey('monitor', 5.2, 1.4, -1.1, 1.5),
      work: K([3, 16, 10], [0, -1, 0], 0, 0.9),
      work2: K([-10, 13, 7], [0, -1, 0], 0, 1.0),
      process: K(desk ? [-13, 2.2, 8] : [-14, 4, 12], desk ? [0, -0.4, 0] : [0, 2.5, 0], desk ? -0.2 : 0, 1.0),
      build: desk ? { pos: buildPos, target: sc.clone(), shift: 0.24, atmo: 1.1 } : K([-12, 10, 13], [0, 3, 0], 0, 1.1),
      launch: K([30, 36, 46], [0, -3, 0], 0, 2),
    };
  }

  setTrack(points) {
    this.track = points.filter((p) => this.keys[p.key]).sort((a, b) => a.y - b.y);
  }

  // ---------------------------------------------------------------- input
  setPointer(nx, ny) { this.pointer.set(nx, ny); }

  pick(nx, ny) {
    if (!this.zones) return null;
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const hits = this.raycaster.intersectObjects(Object.values(this.zones).map((z) => z.o), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !/^zone_/.test(o.name)) o = o.parent;
    return o ? o.name.replace('zone_', '') : null;
  }

  // ---------------------------------------------------------------- per frame
  #sample(y) {
    const tr = this.track;
    if (!tr.length) return { a: this.keys.hero, b: this.keys.hero, t: 0, key: 'hero' };
    if (y <= tr[0].y) return { a: this.keys[tr[0].key], b: this.keys[tr[0].key], t: 0, key: tr[0].key };
    for (let i = 0; i < tr.length - 1; i++) {
      if (y < tr[i + 1].y) {
        const t = (y - tr[i].y) / Math.max(1, tr[i + 1].y - tr[i].y);
        return { a: this.keys[tr[i].key], b: this.keys[tr[i + 1].key], t: smooth(t), key: t < 0.5 ? tr[i].key : tr[i + 1].key };
      }
    }
    const last = tr[tr.length - 1];
    return { a: this.keys[last.key], b: this.keys[last.key], t: 0, key: last.key };
  }

  frame(time, dt) {
    if (!this.root || this.disposed) return;
    const { a, b, t, key } = this.#sample(this.scrollY);
    this.state.chapterKey = key;

    // the path arcs around the island (cylindrical interpolation)
    const ra = Math.hypot(a.pos.x, a.pos.z), rb = Math.hypot(b.pos.x, b.pos.z);
    const ta = Math.atan2(a.pos.z, a.pos.x), tb = Math.atan2(b.pos.z, b.pos.x);
    let dth = tb - ta;
    if (dth > Math.PI) dth -= Math.PI * 2;
    if (dth < -Math.PI) dth += Math.PI * 2;
    const th = ta + dth * t;
    const rad = THREE.MathUtils.lerp(ra, rb, t);
    const desiredPos = tmpV.set(Math.cos(th) * rad, THREE.MathUtils.lerp(a.pos.y, b.pos.y, t), Math.sin(th) * rad);
    const desiredTarget = tmpV2.lerpVectors(a.target, b.target, t);

    if (this.intro > 0.001) { // intro swoop after the loader
      desiredPos.multiplyScalar(1 + this.intro * 0.9);
      desiredPos.y += this.intro * 14;
    }
    desiredPos.x += Math.sin(time * 0.15) * 0.35; // slow idle drift
    desiredPos.z += Math.cos(time * 0.13) * 0.25;

    // damp in orbit space so fast jumps swing around the island, never through it
    const k = this.snapNext ? 1 : 1 - Math.exp(-dt * 3.2);
    this.snapNext = false;
    const cr = Math.hypot(this.camPos.x, this.camPos.z);
    const cth = Math.atan2(this.camPos.z, this.camPos.x);
    const dr = Math.hypot(desiredPos.x, desiredPos.z);
    let dd = Math.atan2(desiredPos.z, desiredPos.x) - cth;
    if (dd > Math.PI) dd -= Math.PI * 2;
    if (dd < -Math.PI) dd += Math.PI * 2;
    const nth = cth + dd * k, nr = cr + (dr - cr) * k;
    this.camPos.set(Math.cos(nth) * nr, this.camPos.y + (desiredPos.y - this.camPos.y) * k, Math.sin(nth) * nr);
    this.camTarget.lerp(desiredTarget, k);

    // gentle pointer parallax (no scroll-velocity roll: keeps the island rock-steady)
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 4));
    const fwd = tmpV.subVectors(this.camTarget, this.camPos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const amp = this.state.chapterKey === 'build' ? 0.06 : 0.45;
    this.camera.position.copy(this.camPos).addScaledVector(right, this.pointerSmooth.x * amp).addScaledVector(UP, this.pointerSmooth.y * amp * 0.6);
    this.camera.lookAt(this.camTarget);

    // screen-space shift so the subject sits beside the copy
    const shift = THREE.MathUtils.lerp(a.shift, b.shift, t);
    this.state.shift += (shift - this.state.shift) * Math.max(k, 1 - Math.exp(-dt * 3.2));
    this.camera.setViewOffset(this.width, this.height, -this.state.shift * this.width, 0, this.width, this.height);

    const atmo = THREE.MathUtils.lerp(a.atmo, b.atmo, t);
    this.state.atmo += (atmo - this.state.atmo) * k;
    this.#applyAtmo(this.state.atmo);

    this.#animateIsland(time, dt);
    this.composer.render(dt);
  }

  #applyAtmo(v) {
    const i = Math.min(Math.floor(v), ATMOS.length - 2);
    const f = THREE.MathUtils.clamp(v - i, 0, 1);
    const A = ATMOS[i], B = ATMOS[i + 1], CA = ATMOS_C[i], CB = ATMOS_C[i + 1];
    this.skyUniforms.uTop.value.lerpColors(CA.top, CB.top, f);
    this.skyUniforms.uHorizon.value.lerpColors(CA.horizon, CB.horizon, f);
    this.skyUniforms.uBottom.value.lerpColors(CA.bottom, CB.bottom, f);
    this.scene.fog.color.lerpColors(CA.fog, CB.fog, f);
    this.scene.fog.near = THREE.MathUtils.lerp(A.near, B.near, f);
    this.scene.fog.far = THREE.MathUtils.lerp(A.far, B.far, f);
    this.starMat.opacity = THREE.MathUtils.lerp(A.stars, B.stars, f);
    this.sun.color.lerpColors(CA.sun, CB.sun, f);
    this.sun.intensity = THREE.MathUtils.lerp(A.sunI, B.sunI, f);
    this.hemi.color.lerpColors(CA.hemi, CB.hemi, f);
    this.hemi.intensity = THREE.MathUtils.lerp(A.hemiI, B.hemiI, f);
  }

  #animateIsland(t, dt) {
    if (this.island) this.island.position.y = Math.sin(t * 0.4) * 0.08;
    if (this.core) {
      this.core.rotation.y += dt * 0.6;
      this.core.rotation.x = Math.sin(t * 0.4) * 0.4;
      const breathe = 1 + (Math.sin(t * 1.3) * 0.5 + 0.5) * 0.35;
      this.coreCubes.forEach(({ o, base }) => o.position.copy(base).multiplyScalar(breathe));
    }
    if (this.iconPivot) {
      this.iconPivot.rotation.y += dt * 0.7;
      this.iconPivot.position.y = Math.sin(t * 1.1) * 0.08;
    }
    if (this.beacon) this.beacon.material.emissiveIntensity = 5 + Math.sin(t * 4) * 4;
    this.crystals.forEach((c, i) => (c.material.emissiveIntensity = 1.8 + Math.sin(t * 1.6 + i) * 0.9));
    this.lamps.forEach((l, i) => (l.material.emissiveIntensity = 5 + Math.sin(t * 9 + i * 3) * 0.4 + (Math.sin(t * 23 + i) > 0.97 ? -3 : 0)));
    this.floats.forEach((f) => { f.o.position.y = f.y + Math.sin(t * 0.7 + f.p) * 0.35; f.o.rotation.y += dt * 0.08; });
    this.frames.forEach((f, i) => (f.o.rotation.z = f.rz + Math.sin(t * 0.9 + i) * 0.03));
    this.clouds.rotation.y += dt * 0.012;

    // hovered zone lifts slightly
    for (const [name, z] of Object.entries(this.zones)) {
      const target = this.hovered === name ? 1.06 : 1;
      z.o.scale.setScalar(z.o.scale.x + (target - z.o.scale.x) * Math.min(1, dt * 8));
    }

    // live screens
    this.signAcc = (this.signAcc || 0) + dt;
    if (this.signAcc > 1 / 30) {
      this.signAcc = 0;
      paintStoreSign(this.signScreen.ctx, 512, 128, t);
      this.signScreen.tex.needsUpdate = true;
      paintPhoneApp(this.phoneScreen.ctx, 270, 570, t);
      this.phoneScreen.tex.needsUpdate = true;
    }
    if (this.previewDirty) {
      this.monitorTex.needsUpdate = true;
      this.previewDirty = false;
    }
  }

  resize() {
    const w = (this.width = window.innerWidth);
    const h = (this.height = window.innerHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.computeKeys();
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.envRT.dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
