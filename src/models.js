import * as THREE from 'three';
import { TEAM_COLORS } from './config.js';
import { addRim, glow } from './gfx.js';

// ---------- shared toon look ----------
const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([105, 170, 228, 255]), 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

// Materials created while a model is being built share that model's "hit flash" uniform.
let curFlash;
export const toon = (color, extra = {}) => addRim(new THREE.MeshToonMaterial({ color, gradientMap, ...extra }), curFlash);
const basic = (color) => new THREE.MeshBasicMaterial({ color });
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x17132f, side: THREE.BackSide });

// Add a mesh to `parent`. `o.outline` (default on) draws an inverted hull for the cartoon outline.
function add(parent, geo, mat, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (o.p) m.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]);
  if (o.s !== undefined) { if (typeof o.s === 'number') m.scale.setScalar(o.s); else m.scale.set(o.s[0], o.s[1], o.s[2]); }
  m.castShadow = o.shadow !== false;
  if (o.outline !== false) {
    const hull = new THREE.Mesh(geo, OUTLINE);
    hull.scale.setScalar(1 + (o.outline ?? 0.07));
    m.add(hull);
  }
  parent.add(m);
  return m;
}
// Detail piece: no outline, no shadow (keeps draw calls down).
const det = (parent, geo, mat, o = {}) => add(parent, geo, mat, { outline: false, shadow: false, ...o });

const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const sphere = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const torus = (r, tube, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, 7, 20, arc);

const WHITE = toon(0xffffff);
const GLINT = basic(0xffffff);
const INK = basic(0x1b1630);

// ---------- heroes ----------
// In a match every hero is their own artwork: a cut-out figure that always faces the camera
// and is animated by bending the picture (walk cycle, arm swing, breathing, lean, squash).
// A small paint drone in the team colour hovers beside the hero and shows where they aim.
export const CAM_PITCH = Math.atan2(17.6, 12); // how steeply the match camera looks down
const TILT = 0.55; // figures lean back toward the camera so they are not squashed by the view angle

const textures = new Map();
function artTexture(def) {
  if (!textures.has(def.id)) {
    const tex = new THREE.TextureLoader().load(def.art);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    textures.set(def.id, tex);
  }
  return textures.get(def.id);
}

const FIGURE_VERT = `
  uniform float uTime, uMove, uKick, uLean, uCheer, uH;
  uniform vec3 uRig; // x: hip height, y: neck height, z: where the arms start (all 0..1 of the picture)
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float ny = uv.y, nx = uv.x - 0.5, side = sign(nx);
    float ph = uTime * 11.0;
    float swing = sin(ph) * side;
    float legW = clamp((uRig.x - ny) / uRig.x, 0.0, 1.0) * step(0.02, abs(nx));
    p.y += max(0.0, swing) * 0.1 * uH * legW * uMove;                       // legs lift in turn
    p.y += abs(sin(ph)) * 0.03 * uH * uMove * smoothstep(0.0, uRig.x, ny);   // body bob
    float armW = smoothstep(uRig.z, uRig.z + 0.14, abs(nx)) * smoothstep(uRig.x - 0.08, uRig.x + 0.1, ny) * (1.0 - smoothstep(uRig.y, uRig.y + 0.12, ny));
    p.y += (-swing * 0.055 * uMove + sin(uTime * 2.4 + side) * 0.008 + uCheer * 0.2 * abs(sin(uTime * 7.0))) * uH * armW;
    p.y += sin(uTime * 2.4) * 0.012 * uH * smoothstep(uRig.x, 1.0, ny);       // breathing
    p.x += max(0.0, ny - 0.08) * uH * (uLean * 0.2 + sin(uTime * 1.7) * 0.01); // lean into the run
    p.x += smoothstep(uRig.y, 1.0, ny) * uH * sin(uTime * 1.3 + 1.0) * 0.012;  // head sway
    p.y *= 1.0 - uKick * 0.09;
    p.x *= 1.0 + uKick * 0.09;
    p.y += uCheer * abs(sin(uTime * 7.0)) * 0.3;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const FIGURE_FRAG = `
  uniform sampler2D map;
  uniform vec2 uTexel;
  uniform float uFlash, uFade;
  uniform vec3 uTint;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    // ink outline: widest alpha found around this pixel
    float n = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982;
      vec2 d = vec2(cos(a), sin(a)) * uTexel;
      n = max(n, texture2D(map, vUv + d * 9.0).a);
      n = max(n, texture2D(map, vUv + d * 4.5).a);
    }
    float alpha = max(c.a, n);
    if (alpha < 0.08) discard;
    vec3 col = mix(vec3(0.012, 0.008, 0.03), c.rgb, smoothstep(0.45, 0.8, c.a));
    col = mix(col, vec3(1.0, 0.98, 0.94), uFlash * 0.6) * uTint;
    gl_FragColor = vec4(col, alpha * uFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// Default picture proportions; individual heroes override them with `def.rig`.
const RIG = [0.44, 0.74, 0.27];

export function buildHero(def, team = 0) {
  const flash = { value: 0 };
  const root = new THREE.Group();
  const tilt = grp(root);
  const H = 3.1 * (def.size || 1), W = H * def.aspect;
  const tex = artTexture(def);
  const uniforms = {
    map: { value: tex }, uTexel: { value: new THREE.Vector2(1 / (660 * def.aspect), 1 / 660) },
    uTime: { value: 0 }, uMove: { value: 0 }, uKick: { value: 0 }, uLean: { value: 0 }, uCheer: { value: 0 }, uH: { value: H },
    uRig: { value: new THREE.Vector3(...(def.rig || RIG)) }, uFlash: flash, uFade: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: FIGURE_VERT, fragmentShader: FIGURE_FRAG, alphaToCoverage: true, side: THREE.DoubleSide });
  const figure = new THREE.Mesh(new THREE.PlaneGeometry(W, H, 10, 14).translate(0, H / 2 - H * 0.036, 0), mat);
  figure.castShadow = true;
  figure.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  figure.frustumCulled = false;
  tilt.add(figure);

  // paint drone: carries the team colour and points where the hero aims
  curFlash = undefined;
  const drone = grp(root, 0, 1.3, 0);
  const core = basic(glow(TEAM_COLORS[team], 1.3));
  add(drone, sphere(0.24, 14, 10), toon(0x2a2748), { s: [1, 0.9, 1.15] });
  det(drone, sphere(0.17, 12, 9), core, { p: [0, 0.12, -0.02] });
  det(drone, cone(0.12, 0.3, 10), toon(0xc9d0ee), { p: [0, -0.02, 0.3], r: [Math.PI / 2, 0, 0], shadow: true });
  det(drone, torus(0.1, 0.035), core, { p: [0, -0.02, 0.44] });
  det(drone, torus(0.3, 0.03), core, { r: [Math.PI / 2, 0, 0] });

  return { root, tilt, figure, drone, flash, u: uniforms, H, W, team, tiltNow: TILT, flip: 1, droneAng: team === 0 ? Math.PI / 2 : -Math.PI / 2, topY: H, topZ: 0 };
}

export const prepHero = (m) => m;

// s: { moving 0..1, kick 0..1, cheer, dir (aim angle), vx (sideways speed -1..1), spin, clear (free space behind the figure) }
export function animateHero(m, t, dt, s) {
  const u = m.u;
  u.uTime.value = t;
  u.uMove.value = s.moving || 0;
  u.uKick.value = s.kick || 0;
  u.uCheer.value += ((s.cheer ? 1 : 0) - u.uCheer.value) * Math.min(1, dt * 8);
  u.uLean.value += ((s.vx || 0) * (s.moving || 0) - u.uLean.value) * Math.min(1, dt * 8);
  m.flash.value = Math.max(0, m.flash.value - dt * 7);
  // lean back toward the camera, but stand up straight when a wall is right behind
  const want = Math.min(TILT, Math.asin(Math.min(0.52, Math.max(0, (s.clear ?? 3) / m.H))));
  m.tiltNow += (want - m.tiltNow) * Math.min(1, dt * 10);
  const stretch = 0.96 / Math.cos(CAM_PITCH - m.tiltNow);
  m.tilt.rotation.x = -m.tiltNow;
  // face left/right with a quick flip
  const dx = Math.sin(s.dir ?? 0);
  if (dx > 0.25) m.flipTo = 1; else if (dx < -0.25) m.flipTo = -1;
  m.flip += ((m.flipTo ?? 1) - m.flip) * Math.min(1, dt * 14);
  const spin = s.spin ? Math.cos(t * 22) : 1;
  const fx = (Math.abs(m.flip) < 0.15 ? 0.15 * Math.sign(m.flip || 1) : m.flip) * spin;
  m.tilt.scale.set(fx, stretch, 1);
  m.topY = m.H * 0.95 * stretch * Math.cos(m.tiltNow);
  m.topZ = -m.H * 0.95 * stretch * Math.sin(m.tiltNow);
  // drone orbits toward the aim direction
  if (s.dir !== undefined) {
    let d = s.dir - m.droneAng;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.droneAng += d * Math.min(1, dt * 14);
  }
  const r = 1.05 - (s.kick || 0) * 0.3;
  m.drone.position.set(Math.sin(m.droneAng) * r, 1.25 + Math.sin(t * 3.1) * 0.08, Math.cos(m.droneAng) * r + 0.15);
  m.drone.rotation.y = m.droneAng;
}

// ---------- minions ----------
export function buildMinion(team) {
  const flash = { value: 0 };
  curFlash = flash;
  const root = new THREE.Group();
  const rig = grp(root);
  add(rig, sphere(0.42, 14, 11), toon(TEAM_COLORS[team]), { p: [0, 0.4, 0], s: [1, 0.86, 1] });
  add(rig, new THREE.SphereGeometry(0.33, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), toon(0xe6eaff), { p: [0, 0.52, -0.02] });
  det(rig, sphere(0.06, 6, 5), basic(glow(0xffd76a, 1.2)), { p: [0, 0.87, -0.02] });
  for (const side of [-1, 1]) {
    det(rig, sphere(0.09, 8, 6), WHITE, { p: [side * 0.15, 0.42, 0.36], s: [1, 1.2, 0.45] });
    det(rig, sphere(0.05, 6, 5), INK, { p: [side * 0.15, 0.41, 0.39], s: [1, 1.2, 0.45] });
  }
  curFlash = undefined;
  return { root, rig, flash };
}

// ---------- structures ----------
export function buildTower(team) {
  const flash = { value: 0 };
  curFlash = flash;
  const root = new THREE.Group();
  const col = TEAM_COLORS[team];
  const dark = toon(0x3a3f6b), mid = toon(0x5a62a3), metal = toon(0xc3caf0);
  const glowM = basic(glow(col, 1.5));
  add(root, cyl(1.6, 1.95, 0.6, 8), dark, { p: [0, 0.3, 0], outline: 0.04 });
  det(root, torus(1.65, 0.09), glowM, { p: [0, 0.62, 0], r: [Math.PI / 2, 0, 0] });
  add(root, cyl(0.8, 1.05, 2.2, 8), mid, { p: [0, 1.7, 0], outline: 0.05 });
  det(root, torus(0.95, 0.1), metal, { p: [0, 1.3, 0], r: [Math.PI / 2, 0, 0] });
  det(root, torus(0.88, 0.06), glowM, { p: [0, 2.2, 0], r: [Math.PI / 2, 0, 0] });
  add(root, cyl(1.15, 0.85, 0.35, 8), dark, { p: [0, 2.9, 0], outline: 0.05 });
  const liquid = det(root, sphere(1.05, 20, 14), basic(glow(col, 0.8)), { p: [0, 3.9, 0], shadow: true });
  add(root, sphere(1.22, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.05 }), { p: [0, 3.9, 0], outline: 0.03, shadow: false });
  det(root, sphere(0.3, 8, 6), GLINT, { p: [-0.5, 4.5, 0.6], s: [1, 0.6, 0.6] });
  add(root, cyl(0.3, 0.55, 0.22, 10), metal, { p: [0, 5.08, 0] });
  det(root, sphere(0.16, 10, 8), glowM, { p: [0, 5.32, 0] });
  const turret = grp(root, 0, 2.95, 0);
  add(turret, cyl(0.22, 0.28, 1.3, 10), metal, { p: [0, 0, 1.0], r: [Math.PI / 2, 0, 0] });
  det(turret, torus(0.26, 0.06), glowM, { p: [0, 0, 1.6] });
  curFlash = undefined;
  return { root, turret, liquid, flash, height: 5.6 };
}

export function buildCore(team) {
  const flash = { value: 0 };
  curFlash = flash;
  const root = new THREE.Group();
  const col = TEAM_COLORS[team];
  const dark = toon(0x3a3f6b), metal = toon(0xc3caf0);
  const glowM = basic(glow(col, 1.5));
  add(root, cyl(2.0, 2.4, 0.5, 10), dark, { p: [0, 0.25, 0], outline: 0.04 });
  det(root, torus(2.05, 0.1), glowM, { p: [0, 0.52, 0], r: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    add(root, cyl(0.16, 0.26, 2.3, 8), metal, { p: [Math.cos(a) * 1.7, 1.6, Math.sin(a) * 1.7], r: [Math.sin(a) * -0.3, 0, Math.cos(a) * 0.3] });
  }
  const crystal = add(root, new THREE.IcosahedronGeometry(1.25, 0), toon(col, { emissive: col, emissiveIntensity: 1.1 }), { p: [0, 2.7, 0], outline: 0.06 });
  const ring = det(root, torus(1.9, 0.08), glowM, { p: [0, 2.7, 0] });
  const ring2 = det(root, torus(1.6, 0.05), metal, { p: [0, 2.7, 0] });
  curFlash = undefined;
  return { root, crystal, ring, ring2, flash, height: 4.6 };
}
