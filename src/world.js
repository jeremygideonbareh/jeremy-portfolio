// The floating studio island: one fixed WebGL canvas whose camera is driven
// by page scroll through a list of authored keyframes (a "flight path").
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { paintSite, paintStoreSign, paintPhoneApp } from './sitepainter.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpC = new THREE.Color();
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Time of day follows the story: 0 misty morning → 1 blue-hour evening → 2 night in space.
// `baked` tints the path-traced light in the island texture; `glow` drives lamps,
// windows and bollards (off in daylight, warm at dusk); `rays` = light-shaft strength.
const ATMOS = [
  { top: '#7d93ac', horizon: '#dfe6ec', bottom: '#a9b6c4', fog: '#c9d3dc', mist: '#f1f4f7', near: 48, far: 170, stars: 0.0, sun: '#fff4e4', sunI: 2.4, hemi: '#d5dfe9', hemiI: 1.2, baked: '#ffffff', glow: 0.0, rays: 1.0 },
  { top: '#1f2c42', horizon: '#8796aa', bottom: '#2a3443', fog: '#5d6b7e', mist: '#98a5b4', near: 46, far: 160, stars: 0.2, sun: '#dfe7f3', sunI: 1.2, hemi: '#8ea0b8', hemiI: 0.75, baked: '#8d9cb4', glow: 1.0, rays: 0.15 },
  { top: '#02040a', horizon: '#18212f', bottom: '#020307', fog: '#0a0f17', mist: '#2b3543', near: 70, far: 220, stars: 1.0, sun: '#c9d6ea', sunI: 1.1, hemi: '#5d6f88', hemiI: 0.45, baked: '#8391aa', glow: 1.35, rays: 0.0 },
];
const colorPairs = ['top', 'horizon', 'bottom', 'fog', 'sun', 'hemi', 'mist', 'baked'];
// sun direction (matches the Blender bake: low, behind the island from the hero view)
const SUN_DIR = new THREE.Vector3(-0.422, 0.438, -0.794).normalize();
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
    this.state = { atmo: 0, shift: 0, chapterKey: 'hero' };
    this.camPos = new THREE.Vector3(30, 30, 40);
    this.camTarget = new THREE.Vector3();
    this.disposed = false;

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    // lighting + shadows are baked into the model; no shadow maps needed at runtime

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(mobile ? 50 : 36, 1, 0.1, 600);
    this.baseFov = this.camera.fov;

    this.#buildSky();
    this.#buildLights();
    this.#buildMist();
    this.#buildRays();
    this.#buildBirds();
    this.#buildEnvironment();
    this.velocity = 0;
    this.vel = 0;

    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.42, 0.65, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.resize();
  }

  // ---------------------------------------------------------------- sky, stars, lights, clouds
  #buildSky() {
    this.skyUniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new THREE.Color('#fff6ea') },
      uSunAmt: { value: 1 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.skyUniforms,
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
        fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunAmt; varying vec3 vP;
          void main(){ vec3 d = normalize(vP); float h = d.y;
            vec3 c = h > 0. ? mix(uHorizon, uTop, pow(clamp(h,0.,1.), .55)) : mix(uHorizon, uBottom, pow(clamp(-h,0.,1.), .45));
            float s = max(dot(d, uSunDir), 0.);
            // hazy sun: tight core + wide atmospheric bloom
            c += uSunColor * uSunAmt * (pow(s, 900.) * 3.0 + pow(s, 48.) * 0.35 + pow(s, 6.) * 0.12);
            gl_FragColor = vec4(c, 1.); }`,
      })
    );
    sky.renderOrder = -1;
    this.scene.add(sky);
    this.sky = sky;

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
    this.stars = new THREE.Points(g, this.starMat);
    this.scene.add(this.stars);
    this.scene.fog = new THREE.Fog(0x283445, 24, 82);
  }

  // Reflections for glass, water + chrome: a PMREM of the morning sky (with
  // its hazy sun) plus two soft "window" strips for crisp architectural highlights.
  #buildEnvironment() {
    const envScene = new THREE.Scene();
    const skyMat = this.sky.material.clone();
    skyMat.uniforms = {
      uTop: { value: new THREE.Color('#7d93ac') },
      uHorizon: { value: new THREE.Color('#dfe6ec') },
      uBottom: { value: new THREE.Color('#8d9aab') },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new THREE.Color('#fff6ea') },
      uSunAmt: { value: 1.4 },
    };
    envScene.add(new THREE.Mesh(this.sky.geometry, skyMat));
    const m1 = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.45, 2.55) });
    const m2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.75, 1.65) });
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(260, 40), m1);
    s1.position.set(-120, 140, -260); s1.lookAt(0, 0, 0);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(60, 260), m2);
    s2.position.set(280, 60, 120); s2.lookAt(0, 0, 0);
    envScene.add(s1, s2);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(envScene, 0.02);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 1.0;
    pmrem.dispose();
    [skyMat, m1, m2].forEach((m) => m.dispose());
    s1.geometry.dispose(); s2.geometry.dispose();
  }

  #buildLights() {
    // only the real-time parts (glass, water, chrome, birds) use these;
    // the island itself carries its baked light
    this.hemi = new THREE.HemisphereLight(0xd5dfe9, 0x6f7c8c, 1.2);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xfff4e4, 2.4));
    sun.position.copy(SUN_DIR).multiplyScalar(30);
    this.scene.add(sun);
  }

  // Clouds = soft noise sprites. Static decks frame the world; "banks" sit right
  // on the camera's flight path so scrolling dives through them. Sprites fade as
  // the lens approaches, so passing through feels like weather, not a wall.
  #buildMist() {
    const tex = makeMistTexture();
    const rnd = mulberry32(11);
    this.mist = new THREE.Group();
    this.mistMats = [];
    this.mistSprites = [];
    const add = (pos, size, opacity, stretch = 1.6) => {
      const mat = new THREE.SpriteMaterial({ map: tex, color: 0xf1f4f7, transparent: true, opacity, depthWrite: false, fog: true, rotation: rnd() * Math.PI * 2 });
      const s = new THREE.Sprite(mat);
      s.position.copy(pos);
      s.scale.set(size * stretch, size, 1);
      s.userData = { spin: (rnd() - 0.5) * 0.03, base: opacity, drift: rnd() * Math.PI * 2 };
      this.mist.add(s);
      this.mistMats.push(mat);
      this.mistSprites.push(s);
    };
    const deck = (count, rMin, rMax, yMin, yMax, sMin, sMax, opacity, stretch) => {
      for (let i = 0; i < count; i++) {
        const a = rnd() * Math.PI * 2;
        const r = rMin + rnd() * (rMax - rMin);
        add(new THREE.Vector3(Math.cos(a) * r, yMin + rnd() * (yMax - yMin), Math.sin(a) * r), sMin + rnd() * (sMax - sMin), opacity * (0.6 + rnd() * 0.4), stretch);
      }
    };
    const bank = (cx, cy, cz, spread, count, sMin, sMax, opacity) => {
      for (let i = 0; i < count; i++) {
        add(new THREE.Vector3(cx + (rnd() - 0.5) * spread[0], cy + (rnd() - 0.5) * spread[1], cz + (rnd() - 0.5) * spread[2]), sMin + rnd() * (sMax - sMin), opacity * (0.7 + rnd() * 0.3), 1.3);
      }
    };
    deck(18, 12, 32, 21, 28, 9, 18, 0.5);            // high deck: the intro dives through it
    deck(26, 28, 56, -6, 1, 12, 24, 0.45);           // horizon banks around the island
    deck(40, 4, 52, -13, -9, 16, 30, 0.7, 2.2);     // the cloud sea far below
    deck(10, 9, 15, -7, -3.5, 5, 9, 0.35);          // skirt hugging the rock
    bank(10.2, 4.8, 13.4, [8, 0.8, 8], 12, 3, 5, 0.55);   // fly-through 1: sky → arrival (sits below the hero sightline)
    bank(5.5, 9.5, 9.5, [8, 2, 8], 10, 4, 7, 0.55);      // fly-through 2: island → builds overview
    bank(18, 22, 27, [12, 3, 12], 12, 6, 10, 0.55);        // fly-through 3: rising into space
    this.scene.add(this.mist);
  }

  // God rays: tall additive planes leaning away from the sun, strongest in the morning.
  #buildRays() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
    const h = ctx.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = h; ctx.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(c);
    this.rays = new THREE.Group();
    this.rayMats = [];
    const rnd = mulberry32(3);
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xfff6e8, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + rnd() * 2.6, 34), mat);
      m.userData = { base: 0.05 + rnd() * 0.07, phase: rnd() * 6 };
      const along = (i - 3) * 2.6 + (rnd() - 0.5);
      m.position.set(-4 + along * 0.55, 9, -6 + along * 0.8);
      this.rays.add(m);
      this.rayMats.push(m);
    }
    this.scene.add(this.rays);
  }

  // A small flock gliding round the island — life in the frame, wings flap with scroll speed.
  #buildBirds() {
    const geo = new THREE.BufferGeometry();
    // body + two wings as separate triangles (wing tips are verts 4 and 7)
    const v = new Float32Array([
      0, 0, 0.16, 0, 0.012, -0.12, 0, -0.01, -0.06,
      0, 0, 0.04, -0.34, 0, -0.04, 0, 0, -0.08,
      0, 0, 0.04, 0.34, 0, -0.04, 0, 0, -0.08,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a3340, side: THREE.DoubleSide, fog: true });
    this.birds = [];
    const rnd = mulberry32(9);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(geo.clone(), mat);
      m.userData = { r: 12 + rnd() * 5, y: 4.5 + rnd() * 3, speed: 0.07 + rnd() * 0.02, phase: i * 0.18 + rnd() * 0.1, flap: rnd() * 6, lane: (rnd() - 0.5) * 1.4 };
      m.scale.setScalar(0.9 + rnd() * 0.4);
      this.scene.add(m);
      this.birds.push(m);
    }
  }
  // Falling water: streaks of fbm noise scrolling down the ribbon, foam at the lip,
  // feathered edges, dissolving into mist at the bottom.
  #waterfallMaterial() {
    this.waterU = { uTime: { value: 0 }, uTint: { value: new THREE.Color('#e9f0f4') }, uLight: { value: 1 } };
    return new THREE.ShaderMaterial({
      uniforms: this.waterU,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uTint; uniform float uLight; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float v=0., a=.5; for(int k=0;k<4;k++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
        void main(){
          float v = 1. - vUv.y;                         // 0 at the lip → 1 at the bottom
          vec2 p = vec2(vUv.x * 7., v * 6. - uTime * 2.4);
          float streak = fbm(vec2(p.x * 1.8, p.y * .35)) * .7 + fbm(p * 1.3) * .5;
          float edge = smoothstep(0., .22, vUv.x) * smoothstep(1., .78, vUv.x);
          float fade = smoothstep(1., .55, v);
          float foam = smoothstep(.12, 0., v) * .6;
          float a = clamp((streak - .32) * 1.6 + foam, 0., 1.) * edge * fade;
          vec3 col = mix(uTint * .72, uTint * 1.08, streak) * uLight;
          gl_FragColor = vec4(col, a * .82);
        }`,
    });
  }

  // Close-up crispness for the lawn: a tiny tiling grass texture (world-space,
  // top-facing surfaces only) modulates the baked light, fading out with distance.
  #addGrassDetail(mat) {
    const tex = new THREE.TextureLoader().load('/textures/grass-detail.webp');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDetail = { value: tex };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying float vUp; varying float vDist;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz; vUp = normalize(mat3(modelMatrix) * normal).y; vDist = -(modelViewMatrix * vec4(position, 1.0)).z;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; varying vec3 vWPos; varying float vUp; varying float vDist;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 det = texture2D(uDetail, vWPos.xz * 0.42).rgb;
          vec3 det2 = texture2D(uDetail, vWPos.xz * 0.11 + 0.37).rgb;
          float l = dot(det * 0.6 + det2 * 0.4, vec3(0.299, 0.587, 0.114));
          float amt = 0.6 * smoothstep(0.55, 0.9, vUp) * (1.0 - smoothstep(5.0, 24.0, vDist));
          diffuseColor.rgb *= mix(1.0, clamp(l / 0.36, 0.55, 1.6), amt);`);
    };
    mat.customProgramCacheKey = () => 'grass-detail';
  }

  // spray rising from where the water dissolves
  #buildPlume() {
    if (!this.waterfall) return;
    this.waterfall.geometry.computeBoundingBox();
    const bb = this.waterfall.geometry.boundingBox;
    const base = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.min.y + 1.2, bb.max.z);
    this.waterfall.localToWorld(base);
    const tex = this.mistMats[0].map;
    this.plume = [];
    const rnd = mulberry32(17);
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: 0xf3f6f8, transparent: true, opacity: 0, depthWrite: false, fog: true });
      const s = new THREE.Sprite(mat);
      s.userData = { base: base.clone(), t: rnd(), spd: 0.08 + rnd() * 0.06, dx: (rnd() - 0.5) * 2, dz: rnd() * 1.5 };
      this.scene.add(s);
      this.plume.push(s);
    }
  }

  // ---------------------------------------------------------------- model
  async load(url) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((res, rej) =>
      loader.load(url, res, (e) => e.total && this.onProgress(e.loaded / e.total), rej)
    );
    const root = gltf.scene;
    this.root = root;
    this.scene.add(root);

    const byName = (n) => root.getObjectByName(n);
    // Baked meshes: path-traced light lives in the texture, so they render unlit.
    // Real-time meshes: physically based glass / chrome reflecting the sky.
    this.bakedMats = [];
    this.pickables = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mname = o.material?.name || '';
      if (/^baked_/.test(o.name) || /^baked_/.test(mname)) {
        const map = o.material.map;
        if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; }
        o.material = new THREE.MeshBasicMaterial({ map, fog: true, toneMapped: false });
        if (o.name === 'baked_ground') this.#addGrassDetail(o.material);
        this.bakedMats.push(o.material);
        this.pickables.push(o);
      } else if (mname === 'realtime_glass') {
        o.material = new THREE.MeshPhysicalMaterial({ color: 0x0b0f14, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.32, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
      } else if (mname === 'realtime_blackglass') {
        o.material = new THREE.MeshPhysicalMaterial({ color: 0x050608, metalness: 0.4, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 });
        this.pickables.push(o);
      } else if (mname === 'realtime_chrome') {
        o.material = new THREE.MeshPhysicalMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.12, envMapIntensity: 1.6 });
      } else if (mname === 'realtime_water') {
        o.material = new THREE.MeshPhysicalMaterial({ color: 0x3f5863, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.88, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.08 });
      } else if (/waterfall/.test(mname) || o.name === 'realtime_waterfall') {
        o.material = this.#waterfallMaterial();
        o.renderOrder = 2;
        this.waterfall = o;
      } else if (/^glow_/.test(mname)) {
        o.material = o.material.clone();
        o.material.toneMapped = false; // warm lamps / interiors bloom softly at dusk
        o.userData.glowBase = o.material.emissiveIntensity || 1;
        (this.glows ||= []).push(o.material);
        o.material.userData.base = o.userData.glowBase;
      }
    });
    this.#buildPlume();

    this.island = byName('Island');
    this.core = byName('core');
    this.coreCubes = this.core ? this.core.children.map((c) => ({ o: c, base: c.position.clone() })) : [];
    this.beacon = byName('beacon');
    if (this.beacon?.material) this.beacon.material = this.beacon.material.clone();
    this.crystals = [];
    this.lamps = [];
    this.floats = [];
    this.frames = [];

    // zones + camera keys
    this.zones = {};
    for (const z of ['store', 'gallery', 'tower', 'monitor']) {
      const o = byName(`zone_${z}`);
      const p = o.getWorldPosition(new THREE.Vector3());
      const out = new THREE.Vector3(p.x, 0, p.z).normalize();
      this.zones[z] = { o, p, out, baseScale: o.scale.clone() };
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
      if (!mesh) return;
      mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.86), fog: false });
    };

    this.signScreen = mk(1024, 64);
    apply(byName('screen_store'), this.signScreen.tex);

    this.phoneScreen = mk(270, 570);
    apply(byName('screen_phone'), this.phoneScreen.tex);

    const galleryCfgs = [
      { type: 'portfolio', name: 'Ines Duarte', palette: 'noir', font: 'serif', layout: 'editorial', radius: 4, motion: 'calm', headline: 'Light, kept.' },
      { type: 'portfolio', name: 'Studio Rhea', palette: 'glacier', font: 'mono', layout: 'centered', radius: 0, motion: 'calm', headline: 'Plans to places.' },
      { type: 'portfolio', name: 'Mara Ilic', palette: 'stone', font: 'grotesk', layout: 'centered', radius: 12, motion: 'calm', headline: 'Shapes that talk.' },
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
    const K = (pos, target, shift = 0, atmo = 0, fov) => ({ pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target), shift, atmo, fov: fov ?? this.baseFov });
    const zoneKey = (z, dist, h, side, look = 1, shift = desk ? 0.2 : 0) => {
      const { p, out } = this.zones[z];
      const sideV = tmpV.crossVectors(UP, out).normalize();
      const pos = p.clone().addScaledVector(out, dist * (desk ? 1 : 1.55)).addScaledVector(UP, h + (desk ? 0 : 0.8)).addScaledVector(sideV, side * (desk ? 1 : 0.4));
      const target = p.clone().addScaledVector(UP, look).addScaledVector(out, desk ? 0 : -0.2);
      if (!desk) target.y -= 1.7; // object sits in upper half on phones, card below
      return { pos, target, shift, atmo: 0.15, fov: this.baseFov };
    };

    // monitor push-in: screen fills ~55% of viewport width on desktop
    const mon = this.zones.monitor;
    const sc = this.monitorScreen.getWorldPosition(new THREE.Vector3());
    const vFov = THREE.MathUtils.degToRad(this.baseFov);
    const fill = 0.46;
    const d = 2.52 / (fill * 2 * Math.tan(vFov / 2) * aspect);
    const buildPos = sc.clone().addScaledVector(mon.out, Math.max(d, 1.6)).addScaledVector(UP, 0.05);

    this.keys = {
      hero: K(desk ? [12.5, 8.6, 17.5] : [12, 12.5, 21], desk ? [0, -0.6, 0] : [0, -5.6, 0], desk ? 0.27 : 0, 0),
      arrive: K([9.5, 4.0, 11.5], [0, 0.6, 0], desk ? 0.2 : 0, 0),
      store: zoneKey('store', 5.6, 1.5, 1.4, 1.0),
      gallery: zoneKey('gallery', 5.3, 1.2, -1.2, 1.0),
      tower: zoneKey('tower', 5.4, 0.9, 1.3, 1.5),
      monitor: zoneKey('monitor', 6.4, 1.1, -1.3, 1.3),
      work: K([3, 16, 10], [0, -1, 0], 0, 0.55),
      work2: K([-10, 13, 7], [0, -1, 0], 0, 0.72),
      process: K(desk ? [-13, 2.2, 8] : [-14, 4, 12], desk ? [0, -0.4, 0] : [0, 2.5, 0], desk ? -0.2 : 0, 0.86),
      // phones show the 2D preview in the page, so the camera pulls back to a wide night shot instead
      build: desk ? { pos: buildPos, target: sc.clone(), shift: 0.24, atmo: 1.1, fov: this.baseFov } : K([-12, 10, 13], [0, 3, 0], 0, 1.1),
      launch: K([30, 36, 46], [0, -3, 0], 0, 2),
    };
    // morning light holds across the island tour, then the day slowly turns
    [['store', 0.0], ['gallery', 0.06], ['tower', 0.14], ['monitor', 0.26]].forEach(([k, v]) => (this.keys[k].atmo = v));
  }

  setTrack(points) {
    this.track = points.filter((p) => this.keys[p.key]).sort((a, b) => a.y - b.y);
  }

  // ---------------------------------------------------------------- input
  setPointer(nx, ny) { this.pointer.set(nx, ny); }

  pick(nx, ny) {
    if (!this.zones) return null;
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    // geometry is merged for the bake, so map the hit point to the nearest zone
    const hits = this.raycaster.intersectObjects([...this.pickables, ...Object.values(this.zones).map((z) => z.o)], true);
    if (!hits.length) return null;
    const p = hits[0].point;
    let best = null, bestD = 2.4;
    for (const [name, z] of Object.entries(this.zones)) {
      const d = Math.hypot(p.x - z.p.x, p.z - z.p.z);
      if (d < bestD && p.y > z.p.y - 0.2) { best = name; bestD = d; }
    }
    return best;
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

    // position travels on an arc around the island (cylindrical lerp)
    const ra = Math.hypot(a.pos.x, a.pos.z), rb = Math.hypot(b.pos.x, b.pos.z);
    let ta = Math.atan2(a.pos.z, a.pos.x), tb = Math.atan2(b.pos.z, b.pos.x);
    let dth = tb - ta;
    if (dth > Math.PI) dth -= Math.PI * 2;
    if (dth < -Math.PI) dth += Math.PI * 2;
    const th = ta + dth * t;
    const rad = THREE.MathUtils.lerp(ra, rb, t);
    const desiredPos = tmpV.set(Math.cos(th) * rad, THREE.MathUtils.lerp(a.pos.y, b.pos.y, t), Math.sin(th) * rad);
    const desiredTarget = tmpV2.lerpVectors(a.target, b.target, t);

    // intro swoop after the loader
    if (this.intro > 0.001) {
      desiredPos.multiplyScalar(1 + this.intro * 0.9);
      desiredPos.y += this.intro * 14;
    }

    // slow idle orbit so the world never feels frozen
    const sway = Math.sin(time * 0.15) * 0.35;
    desiredPos.x += sway;
    desiredPos.z += Math.cos(time * 0.13) * 0.25;

    // damp in orbit space (angle / radius / height) so even big jumps swing
    // around the island instead of cutting through it
    const k = this.snapNext ? 1 : 1 - Math.exp(-dt * 3.2);
    this.snapNext = false;
    const cr = Math.hypot(this.camPos.x, this.camPos.z);
    const cth = Math.atan2(this.camPos.z, this.camPos.x);
    const dr = Math.hypot(desiredPos.x, desiredPos.z);
    let dd = Math.atan2(desiredPos.z, desiredPos.x) - cth;
    if (dd > Math.PI) dd -= Math.PI * 2;
    if (dd < -Math.PI) dd += Math.PI * 2;
    const nth = cth + dd * k;
    const nr = cr + (dr - cr) * k;
    this.camPos.set(Math.cos(nth) * nr, this.camPos.y + (desiredPos.y - this.camPos.y) * k, Math.sin(nth) * nr);
    this.camTarget.lerp(desiredTarget, k);

    // pointer parallax (camera-relative)
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 4));
    const fwd = tmpV.subVectors(this.camTarget, this.camPos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const amp = this.state.chapterKey === 'build' ? 0.06 : 0.45;
    this.camera.position.copy(this.camPos).addScaledVector(right, this.pointerSmooth.x * amp).addScaledVector(UP, this.pointerSmooth.y * amp * 0.6);
    this.camera.lookAt(this.camTarget);

    // scroll energy, measured from the smoothed scroll itself (not noisy wheel
    // events) and low-passed hard: the lens widens gently on fast scrolls only.
    if (dt > 0) {
      const raw = (this.scrollY - (this.lastScroll ?? this.scrollY)) / dt / 60;
      this.lastScroll = this.scrollY;
      this.vel += (THREE.MathUtils.clamp(raw, -30, 30) - this.vel) * (1 - Math.exp(-dt * 1.6));
    }
    const fovTarget = this.baseFov + Math.min(Math.abs(this.vel) * 0.08, 2.5);
    if (Math.abs(this.camera.fov - fovTarget) > 0.02) {
      this.camera.fov += (fovTarget - this.camera.fov) * (1 - Math.exp(-dt * 1.5));
      this.camera.updateProjectionMatrix();
    }

    // screen-space shift so the subject sits beside the copy
    const shift = THREE.MathUtils.lerp(a.shift, b.shift, t);
    this.state.shift += (shift - this.state.shift) * Math.max(k, 1 - Math.exp(-dt * 3.2));
    const w = this.width, h = this.height;
    this.camera.setViewOffset(w, h, -this.state.shift * w, 0, w, h);

    // atmosphere
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
    const mistC = tmpC.lerpColors(CA.mist, CB.mist, f);
    this.mistMats.forEach((m) => m.color.copy(mistC));
    const baked = tmpC.lerpColors(CA.baked, CB.baked, f);
    this.bakedMats?.forEach((m) => m.color.copy(baked));
    // lamps, windows and bollards switch on as evening falls
    const glow = THREE.MathUtils.lerp(A.glow, B.glow, f);
    this.glows?.forEach((m) => (m.emissiveIntensity = m.userData.base * (0.25 + glow * 1.6)));
    this.raysAmt = THREE.MathUtils.lerp(A.rays, B.rays, f);
    this.skyUniforms.uSunAmt.value = Math.max(0, 1 - v * 0.9);
    if (this.waterU) this.waterU.uLight.value = THREE.MathUtils.lerp(1, 0.55, Math.min(v, 1));
    this.bloom.strength = 0.32 + glow * 0.22;
  }

  #animateIsland(t, dt) {
    if (this.island) this.island.position.y = Math.sin(t * 0.4) * 0.08;
    // kinetic sculpture: slow, weighty, never bouncy
    if (this.core) {
      this.core.rotation.y += dt * 0.22;
      this.core.rotation.x = Math.sin(t * 0.25) * 0.35;
      const breathe = 1 + (Math.sin(t * 0.8) * 0.5 + 0.5) * 0.22;
      this.coreCubes.forEach(({ o, base }) => o.position.copy(base).multiplyScalar(breathe));
    }
    // aviation-style beacon: short flash every 2.4s
    if (this.beacon) this.beacon.material.emissiveIntensity = (t % 2.4) < 0.12 ? 22 : 0.6;
    // clouds: slow drift (faster with scroll wind) + fade as the lens flies through
    const wind = 1 + Math.min(Math.abs(this.vel) * 0.25, 6);
    const cam = this.camera.position;
    for (const s of this.mistSprites) {
      const u = s.userData;
      u.drift += dt * 0.05 * wind;
      s.material.rotation += u.spin * dt * wind;
      u.home ??= s.position.clone();
      s.position.x = u.home.x + Math.sin(u.drift) * 0.8;
      s.position.z = u.home.z + Math.cos(u.drift * 0.7) * 0.6;
      const d = s.position.distanceTo(cam);
      const near = THREE.MathUtils.smoothstep(d, s.scale.y * 0.25, s.scale.y * 0.9);
      s.material.opacity = u.base * near;
    }

    // god rays: face the camera around Y, breathe slowly
    if (this.rays) {
      for (const r of this.rayMats) {
        r.lookAt(cam.x, r.position.y, cam.z);
        r.rotateZ(0.42);
        r.material.opacity = this.raysAmt * r.userData.base * (0.75 + 0.25 * Math.sin(t * 0.4 + r.userData.phase));
      }
    }

    // birds circle the island in a loose V; wings beat faster when you scroll fast
    this.birds?.forEach((b, i) => {
      const u = b.userData;
      const a = t * u.speed + u.phase;
      const r = u.r + Math.sin(t * 0.2 + i) * 0.6;
      b.position.set(Math.cos(a) * r + u.lane, u.y + Math.sin(t * 0.5 + i) * 0.4, Math.sin(a) * r);
      b.lookAt(Math.cos(a + 0.05) * r + u.lane, b.position.y, Math.sin(a + 0.05) * r);
      u.flap += dt * (5 + Math.min(Math.abs(this.vel), 20) * 0.6);
      const wing = Math.sin(u.flap) * 0.13;
      const p = b.geometry.attributes.position;
      p.setY(4, wing); p.setY(7, wing);
      p.needsUpdate = true;
    });

    // waterfall + spray
    if (this.waterU) this.waterU.uTime.value = t;
    this.plume?.forEach((s) => {
      const u = s.userData;
      u.t = (u.t + dt * u.spd) % 1;
      s.position.set(u.base.x + u.dx * u.t, u.base.y + u.t * 2.2 - 0.6, u.base.z + u.dz * u.t);
      const size = 1.5 + u.t * 4;
      s.scale.set(size * 1.3, size, 1);
      const far = 1 - THREE.MathUtils.smoothstep(s.position.distanceTo(cam), 18, 30);
      s.material.opacity = Math.sin(u.t * Math.PI) * 0.55 * far * (1 - Math.min(this.state.atmo, 1) * 0.6);
    });

    // hovered zone: its screens brighten
    for (const [name, z] of Object.entries(this.zones)) {
      const target = this.hovered === name ? 1.0 : 0.86;
      z.screens ??= (() => { const list = []; z.o.traverse((o) => o.isMesh && /^screen_/.test(o.name) && list.push(o.material)); return list; })();
      z.screens.forEach((m) => { const c = m.color.r + (target - m.color.r) * Math.min(1, dt * 6); m.color.setScalar(c); });
    }

    // live screens
    this.signAcc = (this.signAcc || 0) + dt;
    if (this.signAcc > 1 / 30) {
      this.signAcc = 0;
      paintStoreSign(this.signScreen.ctx, 1024, 64, t);
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
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.envRT.dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
  }
}

// Soft mist puff: radial falloff modulated by layered value noise (128px, built once).
function makeMistTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const rnd = mulberry32(5);
  const grid = (n) => Array.from({ length: (n + 1) * (n + 1) }, () => rnd());
  const layers = [[4, grid(4), 0.55], [8, grid(8), 0.3], [16, grid(16), 0.15]];
  const sample = (n, g, x, y) => {
    const fx = x * n, fy = y * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const s = (t) => t * t * (3 - 2 * t);
    const at = (i, j) => g[Math.min(j, n) * (n + 1) + Math.min(i, n)];
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * s(tx);
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * s(tx);
    return a + (b - a) * s(ty);
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const fall = Math.max(0, 1 - d) ** 1.8;
      let nz = 0;
      for (const [n, g, w] of layers) nz += sample(n, g, u, v) * w;
      const a = Math.max(0, fall * (0.35 + nz * 0.9) - 0.08);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
