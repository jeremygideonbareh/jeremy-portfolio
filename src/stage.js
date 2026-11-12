// The 3D stage: a phone and a laptop (modelled in Blender, blender/build_devices.py)
// fly through the page on scroll-driven keyframes, react to the cursor, and show
// live content on their screens. Transparent canvas over the page background.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = THREE.MathUtils.lerp;
const KEYS = ['x', 'y', 'size', 'rx', 'ry', 'rz', 'lid', 'o'];

export class Stage {
  constructor(canvas, { previewCanvas, onProgress, mobile }) {
    this.canvas = canvas;
    this.previewCanvas = previewCanvas;
    this.onProgress = onProgress || (() => {});
    this.mobile = mobile;
    this.scrollY = 0;
    this.pointer = new THREE.Vector2();
    this.pointerS = new THREE.Vector2();
    this.tracks = { phone: [], laptop: [] };
    this.state = {};
    this.vel = 0;
    this.spin = 0;
    this.intro = 1;
    this.previewDirty = true;

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.6 : 2));
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);

    const pmrem = new THREE.PMREMGenerator(r);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.9;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 6, 8);
    const rim = new THREE.DirectionalLight(0x2f5bff, 7);
    rim.position.set(-7, 2, -5);
    const rim2 = new THREE.DirectionalLight(0x8ea6ff, 3);
    rim2.position.set(7, -1, -4);
    this.scene.add(key, rim, rim2, new THREE.AmbientLight(0xffffff, 0.25));
    this.resize();
  }

  async load(url) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((res, rej) => loader.load(url, res, (e) => e.total && this.onProgress(e.loaded / e.total), rej));
    const root = gltf.scene;
    const phone = root.getObjectByName('phone');
    const laptop = root.getObjectByName('laptop');
    this.lid = root.getObjectByName('laptop_lid');
    this.lidOpen = this.lid.rotation.x;
    // grab the screens before the devices are re-parented into their wrappers
    const ps = root.getObjectByName('screen_phone');
    const ls = root.getObjectByName('screen_laptop');

    // reset the poster pose from Blender; wrappers carry the animated transform
    phone.position.set(0, 0, 0);
    phone.rotation.set(Math.PI / 2, 0, 0); // screen faces the camera
    laptop.position.set(0, 0, 0);
    laptop.rotation.set(0, 0, 0);
    this.phone = new THREE.Group();
    this.phone.add(phone);
    this.laptop = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(laptop);
    const bb = new THREE.Box3().setFromObject(laptop);
    const c = bb.getCenter(new THREE.Vector3());
    laptop.position.sub(c); // centre the open laptop on the wrapper
    this.laptop.add(inner);
    this.laptopW = bb.getSize(new THREE.Vector3()).x;
    this.phoneH = 1.5;
    this.scene.add(this.phone, this.laptop);

    // materials: crisp highlights, screens unlit
    [this.phone, this.laptop].forEach((g) => g.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m && m.metalness > 0.5) { m.envMapIntensity = 1.3; m.roughness = Math.max(0.18, m.roughness); }
    }));

    const mk = (w, h) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.anisotropy = 8;
      return { cv, ctx: cv.getContext('2d'), tex };
    };
    this.phoneScreen = mk(560, 1160);
    ps.material = new THREE.MeshBasicMaterial({ map: this.phoneScreen.tex, toneMapped: false });
    this.previewTex = new THREE.CanvasTexture(this.previewCanvas);
    this.previewTex.colorSpace = THREE.SRGBColorSpace;
    this.previewTex.flipY = false;
    this.previewTex.anisotropy = 8;
    ls.material = new THREE.MeshBasicMaterial({ map: this.previewTex, toneMapped: false });
    this.laptopMat = ls.material;
    // second laptop screen: real launches play here in the Build sector (laptopMode = 'show')
    this.showScreen = mk(1280, 800);
    this.laptopMode = 'preview';
    return this;
  }

  /** viewport-relative placement → world transform */
  #apply(obj, s, baseSize, t) {
    const vh = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const vw = vh * this.camera.aspect;
    const float = Math.sin(t * 0.9 + (obj === this.phone ? 0 : 2)) * 0.012 * vh;
    obj.position.set(s.x * vw, s.y * vh + float, 0);
    const scale = (s.size * (obj === this.laptop ? vw : vh)) / baseSize;
    obj.scale.setScalar(Math.max(0.0001, scale));
    obj.rotation.set(s.rx + this.pointerS.y * 0.12, s.ry + this.pointerS.x * 0.22 + (obj === this.phone ? this.spin : 0), s.rz);
    obj.visible = s.o > 0.02 && scale > 0.001;
  }

  setTrack(name, points) { this.tracks[name] = points.slice().sort((a, b) => a.y - b.y); }

  #sample(track, y) {
    if (!track.length) return null;
    if (y <= track[0].y) return track[0].s;
    for (let i = 0; i < track.length - 1; i++) {
      const a = track[i], b = track[i + 1];
      if (y < b.y) {
        // `lin` keyframes move at a constant rate with scroll (used to ride along with a page element);
        // the rest ease in and out between poses
        const raw = (y - a.y) / Math.max(1, b.y - a.y);
        const t = b.lin ? raw : smooth(raw);
        const out = {};
        for (const k of KEYS) out[k] = lerp(a.s[k] ?? 0, b.s[k] ?? 0, t);
        return out;
      }
    }
    return track[track.length - 1].s;
  }

  frame(t, dt) {
    if (!this.phone) return;
    // scroll speed (smoothed) → a little extra spin on the phone
    const raw = (this.scrollY - (this.lastY ?? this.scrollY)) / Math.max(dt, 1e-3) / 60;
    this.lastY = this.scrollY;
    this.vel += (THREE.MathUtils.clamp(raw, -40, 40) - this.vel) * (1 - Math.exp(-dt * 2.5));
    this.spin += this.vel * dt * 0.06;
    this.spin *= Math.exp(-dt * 1.4);
    this.pointerS.lerp(this.pointer, 1 - Math.exp(-dt * 4));

    const snap = this.snapNext;
    this.snapNext = false;
    for (const name of ['phone', 'laptop']) {
      // the laptop follows its page slot tightly (no floaty lag behind fast scrolls); the phone drifts softly
      const k = snap ? 1 : 1 - Math.exp(-dt * (name === 'laptop' ? 16 : 6));
      const target = this.#sample(this.tracks[name], this.scrollY);
      if (!target) continue;
      const cur = (this.state[name] ||= { ...target });
      for (const key of KEYS) cur[key] += ((target[key] ?? 0) - cur[key]) * k;
      // intro: the phone drops in from above with a spin
      const s = name === 'phone' && this.intro > 0.001 ? { ...cur, y: cur.y + this.intro * 1.1, ry: cur.ry - this.intro * 4, rz: cur.rz + this.intro * 0.6 } : cur;
      this.#apply(this[name], s, name === 'phone' ? this.phoneH : this.laptopW, t);
      if (name === 'laptop' && this.lid) this.lid.rotation.x = this.lidOpen * cur.lid;
    }

    // live screens
    this.phoneAcc = (this.phoneAcc || 0) + dt;
    if (this.phonePainter && this.phone.visible && this.phoneAcc > 1 / 24) {
      this.phoneAcc = 0;
      this.phonePainter(this.phoneScreen.ctx, this.phoneScreen.cv.width, this.phoneScreen.cv.height, t);
      this.phoneScreen.tex.needsUpdate = true;
    }
    const showing = this.laptopMode === 'show' && this.laptopPainter;
    const want = showing ? this.showScreen.tex : this.previewTex;
    if (this.laptopMat.map !== want) { this.laptopMat.map = want; if (!showing) this.previewDirty = true; }
    if (showing && this.laptop.visible) {
      this.showAcc = (this.showAcc || 0) + dt;
      if (this.showAcc > 1 / 30) {
        this.showAcc = 0;
        this.laptopPainter(this.showScreen.ctx, this.showScreen.cv.width, this.showScreen.cv.height, t);
        this.showScreen.tex.needsUpdate = true;
      }
    } else if (this.previewDirty && this.laptop.visible) {
      this.previewTex.needsUpdate = true;
      this.previewDirty = false;
    }
    // nothing on stage → clear once, then stop drawing until a device comes back
    const anything = this.phone.visible || this.laptop.visible;
    if (anything || !this.wasEmpty) this.renderer.render(this.scene, this.camera);
    this.wasEmpty = !anything;
  }

  /** world-space viewport size at the device plane (for layout maths in main.js) */
  viewport() {
    const vh = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return { vh, vw: vh * this.camera.aspect };
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < 900 ? 38 : 30;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.env.dispose();
    this.renderer.dispose();
  }
}
