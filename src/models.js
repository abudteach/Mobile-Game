import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 5, 12);
const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 2, r);
const torus = (r, tube, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, 7, 20, arc);
const octa = (r) => new THREE.OctahedronGeometry(r);

const WHITE = toon(0xffffff);
const GLINT = basic(0xffffff);
const INK = basic(0x1b1630);

// Big cartoon eye with an eyelid line; `tilt` slants the lid for a confident look.
function eye(parent, x, y, z, r = 0.11, iris = 0x2a1f4d, tilt = 0.25) {
  const g = grp(parent, x, y, z);
  det(g, sphere(r, 12, 9), WHITE, { s: [1, 1.18, 0.45] });
  det(g, sphere(r * 0.66, 10, 8), basic(iris), { p: [0, -r * 0.08, r * 0.3], s: [1, 1.15, 0.45] });
  det(g, sphere(r * 0.34, 8, 6), INK, { p: [0, -r * 0.08, r * 0.46], s: [1, 1.15, 0.4] });
  det(g, sphere(r * 0.2, 6, 5), GLINT, { p: [r * 0.28, r * 0.38, r * 0.56] });
  return g;
}

function blank() {
  const flash = { value: 0 };
  curFlash = flash;
  const root = new THREE.Group();
  const rig = grp(root);
  return { root, rig, flash, head: null, torso: null, armL: null, armR: null, footL: null, footR: null, tail: null, eyes: [], teamMats: [], glowMats: [], armBase: { l: [0.12, -0.22], r: [-1.2, 0.12] }, footZ: 0, spinners: [], wings: [] };
}

// Shared body: chunky boots, legs, hips, torso, arms and a team-coloured paint blaster.
// c = materials { skin, top, trim, pants, leg, boot, bootTrim, sole, sleeve, fore, glove }
function humanoid(m, c, o = {}) {
  const b = o.bulk || 1, rig = m.rig, hr = o.headR || 0.44;
  for (const side of [-1, 1]) {
    const f = grp(rig, side * 0.19 * b, 0, 0);
    det(f, rbox(0.31 * b, 0.08, 0.58, 0.03), c.sole, { p: [0, 0.04, 0.07] });
    add(f, rbox(0.3 * b, 0.26, 0.52, 0.1), c.boot, { p: [0, 0.19, 0.07] });
    det(f, rbox(0.33 * b, 0.14, 0.37, 0.06), c.bootTrim, { p: [0, 0.37, 0] });
    det(f, capsule(0.115 * b, 0.2), c.leg || c.pants, { p: [0, 0.57, 0], shadow: true });
    if (side < 0) m.footL = f; else m.footR = f;
  }
  add(rig, rbox(0.6 * b, 0.3, 0.42 * b, 0.12), c.pants, { p: [0, 0.82, 0] });
  const torso = m.torso = grp(rig, 0, 1.16, 0);
  add(torso, capsule(0.3 * b, 0.22), c.top, { s: [1, 1, 0.8] });
  det(torso, torus(0.2 * b, 0.07), c.trim, { p: [0, 0.3, 0], r: [Math.PI / 2, 0, 0] });
  const head = m.head = grp(rig, 0, 1.54 + hr * 0.82 + (o.neck || 0), 0);
  for (const side of [-1, 1]) {
    const a = grp(rig, side * (0.36 * b + 0.05), 1.36, 0);
    add(a, capsule(0.105 * b, 0.18), c.sleeve || c.top, { p: [0, -0.14, 0] });
    det(a, capsule(0.095 * b, 0.14), c.fore || c.skin, { p: [0, -0.4, 0], shadow: true });
    add(a, sphere(0.125 * b, 12, 10), c.glove || c.skin, { p: [0, -0.6, 0] });
    if (side < 0) m.armL = a; else m.armR = a;
  }
  // paint blaster: the one part of every hero that carries the team colour
  const gun = toon(0x2a2748), team = basic(0xffffff);
  m.glowMats.push(team);
  const g = grp(m.armR, 0, -0.7, 0.05);
  add(g, rbox(0.19 * b, 0.38, 0.25 * b, 0.06), gun, { p: [0, 0, 0] });
  det(g, cyl(0.075 * b, 0.085 * b, 0.3), gun, { p: [0, -0.32, 0], shadow: true });
  det(g, torus(0.09 * b, 0.035), team, { p: [0, -0.47, 0], r: [Math.PI / 2, 0, 0] });
  det(g, sphere(0.135 * b, 12, 9), team, { p: [0, 0.04, 0.2 * b] });
  det(g, torus(0.1 * b, 0.03), toon(0xc9d0ee), { p: [0, 0.04, 0.2 * b], r: [0.4, 0, 0] });
  return { head, torso, hr, b };
}

// Human face on an existing head group.
function face(m, head, skin, o = {}) {
  const hr = o.hr || 0.44;
  add(head, sphere(hr, 20, 16), skin);
  det(head, sphere(hr * 0.2, 8, 6), skin, { p: [-hr * 0.98, -0.04, 0] });
  det(head, sphere(hr * 0.2, 8, 6), skin, { p: [hr * 0.98, -0.04, 0] });
  for (const side of [-1, 1]) {
    m.eyes.push(eye(head, side * hr * 0.4, -0.02, hr * 0.86, hr * 0.26, o.iris ?? 0x6b3f1d));
    det(head, box(hr * 0.46, hr * 0.085, 0.04), o.brow || INK, { p: [side * hr * 0.4, hr * 0.37, hr * 0.9], r: [0, 0, side * -0.22] });
  }
  det(head, sphere(hr * 0.09, 6, 5), o.nose || skin, { p: [0, -hr * 0.2, hr * 0.99] });
  det(head, torus(hr * 0.2, 0.02, Math.PI), INK, { p: [0.02, -hr * 0.42, hr * 0.9], r: [0, 0, Math.PI] });
}

const mats = (colors) => { const out = {}; for (const k in colors) out[k] = toon(colors[k]); return out; };

// ---------- 1. JARO: dreadlocked speedster in green ----------
function buildJaro() {
  const m = blank();
  const c = mats({ skin: 0x9a5a34, top: 0x1f7a5c, trim: 0x9be0c2, pants: 0x2e2a5e, boot: 0xf1e6d0, bootTrim: 0x1f7a5c, sole: 0x2a2545, fore: 0x1f7a5c, glove: 0x2a2545, hair: 0x2b2530, lime: 0xb9f23a, cream: 0xe8d8b0 });
  c.sleeve = c.trim;
  const { head, torso, hr } = humanoid(m, c);
  face(m, head, c.skin, { iris: 0xf2a81d });
  for (const side of [-1, 1]) det(head, cone(0.06, 0.14, 3), c.lime, { p: [side * 0.24, -0.13, 0.36], r: [Math.PI / 2 + 0.3, 0, side * 0.6] });
  add(head, new THREE.SphereGeometry(hr * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), c.hair, { p: [0, 0.03, -0.04], r: [-0.3, 0, 0] });
  det(head, torus(0.16, 0.06), c.trim, { p: [0, 0.5, -0.08], r: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, t = 0.35 + (i % 3) * 0.18;
    add(head, capsule(0.07, 0.3), c.hair, { p: [Math.cos(a) * 0.12, 0.72, -0.08 + Math.sin(a) * 0.12], r: [Math.sin(a) * t, 0, -Math.cos(a) * t], outline: i % 3 === 0 ? 0.07 : false });
  }
  for (let i = 0; i < 5; i++) { const a = Math.PI * (0.15 + i * 0.175); det(head, capsule(0.065, 0.2), c.hair, { p: [Math.cos(a) * 0.4, -0.02, -0.12 - Math.sin(a) * 0.3], r: [0.3, 0, Math.cos(a) * 0.3], shadow: true }); }
  det(torso, rbox(0.3, 0.2, 0.3, 0.07), c.lime, { p: [-0.37, 0.26, 0] });
  det(torso, cone(0.07, 0.16, 3), c.lime, { p: [-0.1, 0.08, 0.26], r: [Math.PI / 2, 0, 0] });
  det(torso, torus(0.3, 0.05), c.cream, { p: [0, -0.22, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.85, 1] });
  det(torso, cyl(0.06, 0.06, 0.2), basic(0xe8f4ff), { p: [-0.3, -0.3, 0.18] });
  m.scarf = grp(torso, 0.2, 0.28, -0.22);
  add(m.scarf, box(0.36, 0.7, 0.05), c.trim, { p: [0.06, -0.3, -0.12], r: [0.5, 0, -0.25], outline: 0.05 });
  return m;
}

// ---------- 2. PIPPA: red panda gardener ----------
function buildPippa() {
  const m = blank();
  const c = mats({ skin: 0x6e2e22, top: 0x4e6b3a, trim: 0x7d9a4a, pants: 0xe0a030, leg: 0x6e2e22, boot: 0xf1dfc0, bootTrim: 0x4e6b3a, sole: 0x33402a, sleeve: 0xf2a183, fore: 0xc2552d, glove: 0x3f5a34, fur: 0xc2552d, cream: 0xf5dfc0, hair: 0xd9532b, peach: 0xf7a58a });
  const { head, torso, hr } = humanoid(m, c, { headR: 0.47 });
  add(head, sphere(hr, 20, 16), c.fur);
  det(head, sphere(hr * 0.55, 12, 10), c.cream, { p: [0, -hr * 0.3, hr * 0.62], s: [1.2, 0.8, 1] });
  det(head, sphere(0.055, 6, 5), INK, { p: [0, -hr * 0.2, hr * 1.12] });
  for (const side of [-1, 1]) {
    const ear = grp(head, side * 0.36, 0.38, -0.02);
    add(ear, sphere(0.24, 12, 10), c.skin, { s: [1, 1.05, 0.5] });
    det(ear, sphere(0.15, 10, 8), c.cream, { p: [0, -0.01, 0.07], s: [1, 1.05, 0.5] });
    add(head, cone(0.17, 0.34, 8), c.cream, { p: [side * 0.47, -0.18, 0.1], r: [0, 0, side * -1.85], outline: 0.06 });
    det(head, sphere(0.1, 8, 6), c.skin, { p: [side * 0.2, -0.17, hr * 0.84], s: [0.8, 1.3, 0.4] });
    det(head, sphere(0.07, 8, 6), c.cream, { p: [side * 0.19, 0.2, hr * 0.9], s: [1.4, 0.8, 0.4] });
    m.eyes.push(eye(head, side * 0.19, 0, hr * 0.86, 0.11, 0x6f9a3a));
  }
  add(head, sphere(0.2, 12, 10), c.hair, { p: [0.03, 0.42, 0.14], s: [1.5, 0.9, 1.1], outline: 0.06 });
  det(head, sphere(0.13, 10, 8), c.hair, { p: [-0.2, 0.36, 0.26], shadow: true });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; det(head, sphere(0.06, 6, 5), c.peach, { p: [0.33 + Math.cos(a) * 0.07, 0.26 + Math.sin(a) * 0.07, 0.25] }); }
  det(head, sphere(0.04, 6, 5), basic(0xffd76a), { p: [0.33, 0.26, 0.29] });
  // vest details + backpack with two amber seed pods
  det(torso, rbox(0.16, 0.14, 0.08, 0.03), c.trim, { p: [-0.16, -0.02, 0.24] });
  det(torso, rbox(0.16, 0.14, 0.08, 0.03), c.trim, { p: [0.16, -0.02, 0.24] });
  det(torso, box(0.09, 0.66, 0.03), toon(0xe0a030), { p: [0, 0.02, 0.26], r: [0, 0, -0.75] });
  add(torso, rbox(0.56, 0.5, 0.26, 0.08), c.top, { p: [0, 0.02, -0.34] });
  for (const side of [-1, 1]) {
    det(torso, cyl(0.15, 0.15, 0.14), c.cream, { p: [side * 0.34, 0.24, -0.36], shadow: true });
    add(torso, sphere(0.17, 12, 9), basic(glow(0xffb347, 0.95)), { p: [side * 0.34, 0.4, -0.36], outline: 0.06 });
  }
  m.tail = grp(m.rig, 0, 0.78, -0.24);
  [[0.17, 0.02, -0.12, 0], [0.22, 0.02, -0.34, 1], [0.25, 0.06, -0.58, 0], [0.25, 0.14, -0.82, 1], [0.2, 0.24, -1.02, 0]].forEach(([r, y, z, k], i) => add(m.tail, sphere(r, 12, 9), k ? c.cream : c.fur, { p: [0, y, z], outline: i === 2 ? 0.07 : false }));
  return m;
}

// ---------- 3. ZYRO: crystal dragon ----------
function buildZyro() {
  const m = blank();
  const c = mats({ skin: 0x4fbf95, top: 0x2a2a52, trim: 0xeedfc0, pants: 0x1f5a56, leg: 0x4fbf95, boot: 0xeedfc0, bootTrim: 0x1f5a56, sole: 0x1f4a48, sleeve: 0x4fbf95, fore: 0x1f5a56, glove: 0x4fbf95, cream: 0xeedfc0, dark: 0x1f5a56 });
  const crystal = new THREE.MeshToonMaterial({ color: 0xbff5ee, gradientMap, emissive: 0xb48cff, emissiveIntensity: 0.45, transparent: true, opacity: 0.88 });
  const { head, torso, hr } = humanoid(m, c, { bulk: 1.18 });
  add(head, sphere(hr, 20, 16), c.skin, { s: [1.05, 0.95, 1] });
  add(head, rbox(0.42, 0.24, 0.34, 0.1), c.skin, { p: [0, -0.14, 0.36] });
  det(head, rbox(0.38, 0.12, 0.3, 0.05), c.cream, { p: [0, -0.26, 0.34] });
  for (const side of [-1, 1]) {
    det(head, sphere(0.025, 5, 4), INK, { p: [side * 0.08, -0.08, 0.535] });
    m.eyes.push(eye(head, side * 0.2, 0.06, hr * 0.8, 0.105, 0x1fc7c0, 0.4));
    add(head, cone(0.085, 0.36, 8), c.cream, { p: [side * 0.26, 0.5, -0.06], r: [-0.25, 0, side * -0.45], outline: 0.08 });
    add(head, cone(0.11, 0.3, 6), c.skin, { p: [side * 0.48, 0.02, -0.02], r: [0, 0, side * -1.5], outline: 0.07 });
    det(head, cone(0.09, 0.24, 6), c.cream, { p: [side * 0.44, -0.2, 0.04], r: [0, 0, side * -1.9] });
  }
  det(head, cone(0.12, 0.34, 5), crystal, { p: [0, 0.5, 0.08], r: [0.35, 0, 0] });
  det(head, cone(0.09, 0.24, 5), crystal, { p: [0, 0.48, -0.16], r: [-0.4, 0, 0] });
  det(torso, octa(0.09), basic(glow(0xffa21f, 1.2)), { p: [0, 0.12, 0.3], s: [1, 1.3, 0.5] });
  det(torso, rbox(0.4, 0.5, 0.06, 0.03), c.cream, { p: [0, 0.02, 0.26], s: [0.5, 1, 1] });
  for (const side of [-1, 1]) {
    const w = grp(torso, side * 0.24, 0.22, -0.3);
    w.rotation.set(0.15, side * 0.5, side * -0.3);
    [[0.1, 0.4, 0.9, 0], [0.34, 0.24, 0.72, -0.5], [0.52, 0.02, 0.5, -0.95]].forEach(([x, y, len, rz]) => add(w, octa(0.2), crystal, { p: [side * x, y, 0], s: [0.55, len / 0.4, 0.14], r: [0, 0, side * rz], outline: false }));
    m.wings.push(w);
  }
  m.tail = grp(m.rig, 0, 0.78, -0.26);
  [[0.17, 0, -0.14], [0.14, -0.04, -0.38], [0.11, 0, -0.6], [0.09, 0.08, -0.78]].forEach(([r, y, z], i) => add(m.tail, sphere(r, 10, 8), c.skin, { p: [0, y, z], outline: i < 2 ? 0.07 : false }));
  det(m.tail, octa(0.17), crystal, { p: [0, 0.2, -0.98], s: [0.6, 1.2, 0.6], r: [0.8, 0, 0] });
  return m;
}

// ---------- 4. BYTE: little robot with a visor face ----------
function buildByte() {
  const m = blank();
  const c = mats({ skin: 0x33334f, top: 0x2f3f9a, trim: 0xf07a2a, pants: 0xf1e6d0, leg: 0x33334f, boot: 0x33334f, bootTrim: 0xf1e6d0, sole: 0xffb21f, sleeve: 0x4a5a9a, fore: 0xf1e6d0, glove: 0x55556f, cream: 0xf1e6d0, yellow: 0xffb21f, dark: 0x22223a });
  const { head, torso } = humanoid(m, c, { neck: 0.1, bulk: 0.92 });
  det(m.rig, cyl(0.08, 0.08, 0.22), c.dark, { p: [0, 1.6, 0] });
  add(head, rbox(1.0, 0.72, 0.78, 0.26), c.cream, { p: [0, 0.04, 0] });
  det(head, rbox(0.74, 0.44, 0.2, 0.12), c.dark, { p: [0, 0.02, 0.32] });
  det(head, rbox(0.4, 0.08, 0.5, 0.03), c.yellow, { p: [0, 0.4, 0.05] });
  det(head, rbox(0.3, 0.07, 0.2, 0.03), c.yellow, { p: [0, -0.33, 0.3] });
  const led = basic(glow(0x5dffb0, 1.4));
  for (const side of [-1, 1]) {
    const e = det(head, rbox(0.11, 0.2, 0.04, 0.03), led, { p: [side * 0.17, 0.05, 0.425], r: [0, 0, side * 0.2] });
    m.eyes.push(e);
    det(head, box(0.2, 0.05, 0.04), led, { p: [side * 0.17, 0.2, 0.425], r: [0, 0, side * -0.35] });
    add(head, cyl(0.2, 0.2, 0.12), c.cream, { p: [side * 0.53, 0, 0], r: [0, 0, Math.PI / 2], outline: 0.06 });
    det(head, cyl(0.11, 0.11, 0.14), c.yellow, { p: [side * 0.54, 0, 0], r: [0, 0, Math.PI / 2] });
  }
  det(head, box(0.14, 0.035, 0.04), led, { p: [0.03, -0.1, 0.425], r: [0, 0, 0.2] });
  det(head, cyl(0.035, 0.035, 0.2), c.dark, { p: [0.3, 0.48, -0.1] });
  add(head, capsule(0.055, 0.2), c.yellow, { p: [0.3, 0.7, -0.1], outline: 0.08 });
  det(torso, rbox(0.3, 0.42, 0.1, 0.05), c.cream, { p: [0, 0.02, 0.2] });
  det(torso, cyl(0.1, 0.1, 0.04), c.yellow, { p: [0, 0.08, 0.26], r: [Math.PI / 2, 0, 0] });
  det(torso, rbox(0.14, 0.14, 0.08, 0.03), c.trim, { p: [-0.2, -0.14, 0.22] });
  det(torso, rbox(0.14, 0.14, 0.08, 0.03), c.trim, { p: [0.2, -0.14, 0.22] });
  add(torso, cyl(0.13, 0.13, 0.56), basic(glow(0xffb21f, 1.0)), { p: [0.2, 0.14, -0.32], outline: 0.06 });
  det(torso, cyl(0.15, 0.15, 0.08), c.dark, { p: [0.2, 0.44, -0.32] });
  return m;
}

// ---------- 5. MELLI: honey engineer with goggles ----------
function buildMelli() {
  const m = blank();
  const c = mats({ skin: 0xb5683c, top: 0xf2b22e, trim: 0x7b2f5b, pants: 0xf2b22e, boot: 0xf1e2c8, bootTrim: 0x4a3350, sole: 0x4a3350, sleeve: 0x7b2f5b, glove: 0xb5683c, hair: 0x7a2433, cream: 0xf1e2c8, brass: 0xd9a441, mint: 0x9be0c2 });
  const amber = basic(glow(0xffb02e, 1.05));
  c.fore = c.cream;
  const { head, torso, hr } = humanoid(m, c, { bulk: 1.22 });
  face(m, head, c.skin, { iris: 0xd9871d });
  [[0, 0.42, -0.02, 0.3], [-0.26, 0.36, 0.06, 0.22], [0.26, 0.36, 0.06, 0.22], [-0.4, 0.14, -0.06, 0.2], [0.4, 0.14, -0.06, 0.2], [-0.2, 0.3, -0.28, 0.24], [0.2, 0.3, -0.28, 0.24], [0, 0.1, -0.4, 0.26], [-0.34, -0.1, -0.2, 0.17], [0.34, -0.1, -0.2, 0.17], [0.12, 0.58, 0.08, 0.17], [-0.14, 0.56, -0.1, 0.18]]
    .forEach(([x, y, z, r], i) => add(head, sphere(r, 10, 8), c.hair, { p: [x, y, z], outline: i < 5 ? 0.07 : false }));
  for (const side of [-1, 1]) {
    det(head, torus(0.11, 0.04), c.brass, { p: [side * 0.15, 0.3, 0.36], r: [-0.5, 0, 0] });
    det(head, cyl(0.1, 0.1, 0.03), amber, { p: [side * 0.15, 0.3, 0.36], r: [Math.PI / 2 - 0.5, 0, 0] });
  }
  det(torso, rbox(0.36, 0.3, 0.08, 0.04), c.top, { p: [0, 0.12, 0.26] });
  det(torso, cyl(0.1, 0.1, 0.05, 6), amber, { p: [0, -0.2, 0.31], r: [Math.PI / 2, 0, 0] });
  det(torso, torus(0.37, 0.05), c.cream, { p: [0, -0.2, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.82, 1] });
  for (const side of [-1, 1]) {
    add(torso, cyl(0.24, 0.24, 0.5, 6), amber, { p: [side * 0.28, 0.22, -0.4], outline: 0.06 });
    det(torso, cyl(0.27, 0.27, 0.1, 6), c.cream, { p: [side * 0.28, 0.5, -0.4], shadow: true });
    det(torso, cyl(0.27, 0.27, 0.1, 6), c.cream, { p: [side * 0.28, -0.05, -0.4] });
    const w = grp(torso, side * 0.5, 0.3, -0.42);
    add(w, rbox(0.4, 0.14, 0.04, 0.02), c.mint, { p: [side * 0.2, 0, 0], r: [0, 0, side * 0.25], outline: false });
    add(w, rbox(0.34, 0.12, 0.04, 0.02), c.mint, { p: [side * 0.18, -0.14, 0], r: [0, 0, side * -0.1], outline: false });
    m.wings.push(w);
    det(side < 0 ? m.armL : m.armR, cyl(0.15, 0.15, 0.14, 6), amber, { p: [0, -0.4, 0] });
  }
  return m;
}

// ---------- 6. NIMBI: cloud girl with twin buns ----------
function buildNimbi() {
  const m = blank();
  const c = mats({ skin: 0xf0a070, top: 0xb49ae6, trim: 0x5a2d6b, pants: 0xf3e9da, leg: 0x5a2d6b, boot: 0xf6efe6, bootTrim: 0x5a2d6b, sole: 0xb49ae6, sleeve: 0xb49ae6, glove: 0x9be0c2, hair: 0xf08a3c, cream: 0xf3e9da, lilac: 0xb9a2e8 });
  const { head, torso, hr } = humanoid(m, c, { bulk: 0.95 });
  face(m, head, c.skin, { iris: 0xd9741d, brow: toon(0xa8481f) });
  add(head, new THREE.SphereGeometry(hr * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), c.hair, { p: [0, 0.03, -0.05], r: [-0.25, 0, 0] });
  [[-0.2, 0.34, 0.3, 0.15], [0.02, 0.4, 0.32, 0.16], [0.22, 0.33, 0.3, 0.14], [-0.38, 0.1, 0.16, 0.13], [0.38, 0.1, 0.16, 0.13]].forEach(([x, y, z, r]) => det(head, sphere(r, 8, 7), c.hair, { p: [x, y, z], shadow: true }));
  for (const side of [-1, 1]) {
    det(head, torus(0.11, 0.05), c.lilac, { p: [side * 0.38, 0.42, -0.04], r: [Math.PI / 2, 0, side * 0.6] });
    add(head, sphere(0.25, 12, 10), c.hair, { p: [side * 0.48, 0.58, -0.06], outline: 0.07 });
    det(head, sphere(0.14, 8, 7), c.hair, { p: [side * 0.62, 0.74, -0.02], shadow: true });
    det(head, sphere(0.13, 8, 7), c.hair, { p: [side * 0.34, 0.76, -0.1], shadow: true });
    // bunny-ear paddles on the backpack
    add(torso, capsule(0.13, 0.36), c.lilac, { p: [side * 0.3, 0.52, -0.34], s: [1, 1, 0.3], r: [0, 0, side * -0.25], outline: 0.06 });
    det(torso, capsule(0.08, 0.26), c.cream, { p: [side * 0.3, 0.52, -0.325], s: [1, 1, 0.3], r: [0, 0, side * -0.25] });
  }
  add(torso, cyl(0.22, 0.66, 0.46, 16), c.top, { p: [0, 0.12, 0] });
  det(torso, cyl(0.225, 0.5, 0.3, 16, 1, false), c.cream, { p: [0, 0.14, 0.02], s: [0.6, 1, 1.06] });
  add(torso, torus(0.2, 0.1), c.trim, { p: [0, 0.34, 0], r: [Math.PI / 2, 0, 0], outline: 0.05 });
  add(torso, rbox(0.5, 0.44, 0.24, 0.08), c.cream, { p: [0, 0, -0.34] });
  add(m.rig, rbox(0.34, 0.26, 0.14, 0.05), c.lilac, { p: [0.36, 0.86, 0.14], r: [0, -0.4, 0], outline: 0.06 });
  for (const [x, r] of [[-0.07, 0.06], [0, 0.08], [0.08, 0.06]]) det(m.rig, sphere(r, 8, 6), c.cream, { p: [0.4 + x, 0.88, 0.22 - x * 0.4] });
  return m;
}

// ---------- 7. LUMA: axolotl moon mage ----------
function buildLuma() {
  const m = blank();
  const c = mats({ skin: 0xf7a8c8, top: 0x4a2a7a, trim: 0xe9c48a, pants: 0x4a2a7a, boot: 0xf3e3da, bootTrim: 0x6a3fb0, sole: 0x4a2a7a, sleeve: 0x4a2a7a, glove: 0x6a3fb0, gill: 0xd93a84, lilac: 0xb58be6 });
  const { head, torso, hr } = humanoid(m, c, { headR: 0.48 });
  add(head, sphere(hr, 20, 16), c.skin, { s: [1.22, 0.95, 1.02] });
  det(head, sphere(0.16, 10, 8), c.skin, { p: [0, -0.16, 0.4], s: [1.3, 0.6, 0.9] });
  det(head, torus(0.13, 0.018, Math.PI), INK, { p: [0, -0.2, 0.46], r: [0, 0, Math.PI] });
  const pearl = basic(glow(0xf3e8ff, 1.0));
  det(head, torus(0.07, 0.022, Math.PI * 1.3), pearl, { p: [0, 0.28, 0.4], r: [-0.5, 0, 2.2] });
  for (const side of [-1, 1]) {
    m.eyes.push(eye(head, side * 0.25, 0.02, hr * 0.84, 0.115, 0x7a3fd0, 0.35));
    det(head, torus(0.04, 0.014, Math.PI * 1.3), pearl, { p: [side * 0.2, 0.3, 0.38], r: [-0.5, 0, 2.2] });
    det(head, sphere(0.05, 6, 5), pearl, { p: [side * 0.42, -0.14, 0.34], s: [1, 0.6, 0.3] });
    const gills = grp(head, side * 0.5, 0.06, -0.06);
    [[0.75, 0.52], [0.1, 0.5], [-0.55, 0.44]].forEach(([rz, len], i) => {
      const g = grp(gills, 0, 0, 0);
      g.rotation.z = side * -(Math.PI / 2 - rz);
      add(g, capsule(0.07, len), c.skin, { p: [0, len / 2 + 0.05, 0], outline: i === 1 ? 0.08 : false });
      for (let k = 0; k < 4; k++) det(g, sphere(0.1, 7, 6), c.gill, { p: [(k % 2 ? 0.09 : -0.09), 0.2 + k * (len / 4), -0.02], s: [1, 1, 0.45], shadow: true });
      det(g, sphere(0.11, 7, 6), c.gill, { p: [0, len + 0.14, -0.02], s: [1, 1, 0.45] });
    });
    m.wings.push(gills);
  }
  add(torso, cyl(0.2, 0.52, 0.26, 12), c.lilac, { p: [0, 0.22, 0] });
  det(torso, torus(0.5, 0.03), c.trim, { p: [0, 0.1, 0], r: [Math.PI / 2, 0, 0] });
  det(torso, torus(0.07, 0.025, Math.PI * 1.4), c.trim, { p: [0, 0.22, 0.3], r: [0, 0, 2.3] });
  det(torso, torus(0.3, 0.05), c.lilac, { p: [0, -0.2, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.85, 1] });
  det(torso, sphere(0.1, 8, 7), basic(glow(0xff5fa8, 1.1)), { p: [-0.32, -0.34, 0.14] });
  m.tail = grp(m.rig, 0, 0.74, -0.24);
  add(m.tail, sphere(0.3, 12, 9), new THREE.MeshToonMaterial({ color: 0xffb7d6, gradientMap, emissive: 0xb48cff, emissiveIntensity: 0.3, transparent: true, opacity: 0.9 }), { p: [0, 0.05, -0.42], s: [0.22, 0.95, 1.7], r: [0.35, 0, 0], outline: false });
  det(m.tail, sphere(0.13, 8, 7), c.skin, { p: [0, 0, -0.12], shadow: true });
  return m;
}

// ---------- 8. BRUNO: bearded heavy with paint tanks ----------
function buildBruno() {
  const m = blank();
  const c = mats({ skin: 0xc98a5a, top: 0xf0a92a, trim: 0x24405e, pants: 0x2c4a68, boot: 0xf1e2c8, bootTrim: 0x2a2a45, sole: 0x2a2a45, sleeve: 0xf0a92a, glove: 0x2a2a45, hair: 0xd4d2da, beard: 0x55525e, cream: 0xf1e2c8, red: 0xe8563f, dark: 0x3a364a });
  const { head, torso, hr } = humanoid(m, c, { bulk: 1.42, headR: 0.42 });
  face(m, head, c.skin, { iris: 0x8a4a1d, brow: c.beard });
  add(head, new THREE.SphereGeometry(hr * 1.04, 16, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), c.beard, { p: [0, -0.02, 0.01], r: [0.28, 0, 0], outline: false });
  det(head, sphere(0.12, 8, 7), c.hair, { p: [0, -0.34, 0.3], s: [0.9, 1.2, 0.8] });
  det(head, capsule(0.035, 0.2), c.beard, { p: [0, -0.16, 0.42], r: [0, 0, Math.PI / 2] });
  add(head, new THREE.SphereGeometry(hr * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.36), c.hair, { p: [0, 0.03, -0.03], r: [-0.2, 0, 0], outline: false });
  [[-0.14, 0.44, 0.16, 0.5, 0.3], [0.04, 0.5, 0.14, 0.4, 0], [0.2, 0.44, 0.1, 0.5, -0.4], [0, 0.46, -0.1, -0.2, 0.1]].forEach(([x, y, z, rx, rz], i) => add(head, cone(0.13, 0.36, 7), c.hair, { p: [x, y, z], r: [rx, 0, rz], outline: i < 2 ? 0.07 : false }));
  det(torso, rbox(0.34, 0.5, 0.1, 0.05), c.trim, { p: [0, 0.04, 0.28] });
  det(torso, box(0.12, 0.9, 0.04), c.dark, { p: [0, 0.04, 0.34], r: [0, 0, 0.8] });
  det(torso, rbox(0.14, 0.12, 0.06, 0.03), c.red, { p: [0.1, 0.16, 0.36] });
  add(torso, sphere(0.26, 12, 9), c.cream, { p: [-0.52, 0.3, 0], s: [1, 0.8, 1.1], outline: 0.06 });
  det(torso, sphere(0.09, 7, 6), c.red, { p: [-0.56, 0.44, 0.1], s: [1, 0.4, 1] });
  det(torso, torus(0.44, 0.07), c.dark, { p: [0, -0.24, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.82, 1] });
  det(torso, rbox(0.14, 0.2, 0.1, 0.03), c.red, { p: [0.26, -0.28, 0.34] });
  det(torso, rbox(0.14, 0.2, 0.1, 0.03), c.red, { p: [0.42, -0.28, 0.26] });
  for (const side of [-1, 1]) {
    add(torso, cyl(0.26, 0.26, 0.7), c.red, { p: [side * 0.3, 0.26, -0.46], outline: 0.06 });
    det(torso, cyl(0.2, 0.2, 0.14), c.cream, { p: [side * 0.3, 0.68, -0.46], shadow: true });
    det(torso, torus(0.27, 0.035), c.cream, { p: [side * 0.3, 0.3, -0.46], r: [Math.PI / 2, 0, 0] });
    det(torso, torus(0.3, 0.05, Math.PI), c.dark, { p: [side * 0.42, 0.5, -0.3], r: [0, Math.PI / 2, 0] });
  }
  return m;
}

// ---------- 9. SKYE: winged flyer with a white quiff ----------
function buildSkye() {
  const m = blank();
  const c = mats({ skin: 0xd9925a, top: 0xf1e6d0, trim: 0x1f7a7a, pants: 0x2d2a4d, boot: 0xf1e6d0, bootTrim: 0xf0685a, sole: 0x2d2a4d, sleeve: 0xf1e6d0, fore: 0x2d2a4d, glove: 0x2d2a4d, hair: 0xf3ece6, teal: 0x1f7a7a, coral: 0xf0685a, cream: 0xf1e6d0 });
  const { head, torso, hr } = humanoid(m, c, { bulk: 0.95 });
  face(m, head, c.skin, { iris: 0x1fb3b3 });
  add(head, new THREE.SphereGeometry(hr * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), c.teal, { p: [0, 0.03, -0.04], r: [-0.25, 0, 0], outline: false });
  [[-0.1, 0.4, 0.22, 0.28, 0.9, 0.5], [-0.3, 0.34, 0.12, 0.24, 0.6, 0.9], [0.06, 0.5, 0.06, 0.26, 0.3, 0.2], [-0.2, 0.52, -0.1, 0.24, -0.2, 0.6], [-0.42, 0.14, 0.04, 0.18, 0.2, 1.3], [0.02, 0.4, -0.26, 0.22, -0.8, 0.2]]
    .forEach(([x, y, z, r, rx, rz], i) => add(head, cone(r, r * 2.4, 8), c.hair, { p: [x, y, z], r: [rx, 0, rz], outline: i < 3 ? 0.07 : false }));
  det(head, rbox(0.12, 0.05, 0.03, 0.01), c.cream, { p: [-0.2, -0.12, 0.38], r: [0, -0.3, 0.2] });
  det(torso, box(0.08, 0.5, 0.04), c.pants, { p: [0, 0.04, 0.25] });
  det(torso, box(0.5, 0.07, 0.04), c.coral, { p: [0, 0.14, 0.26] });
  det(torso, box(0.07, 0.4, 0.04), c.coral, { p: [-0.16, 0.1, 0.25] });
  det(torso, box(0.07, 0.4, 0.04), c.coral, { p: [0.16, 0.1, 0.25] });
  det(torso, torus(0.3, 0.045), c.coral, { p: [0, -0.22, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.85, 1] });
  add(torso, cyl(0.1, 0.1, 0.24), basic(glow(0x2ee0d0, 1.05)), { p: [-0.34, -0.34, 0.12], outline: 0.07 });
  for (const side of [-1, 1]) {
    const w = grp(torso, side * 0.26, 0.24, -0.2);
    w.rotation.set(0.2, side * 0.35, side * -0.45);
    add(w, rbox(0.72, 0.3, 0.07, 0.035), c.cream, { p: [side * 0.4, 0, 0], outline: 0.05 });
    det(w, rbox(0.62, 0.2, 0.06, 0.03), c.coral, { p: [side * 0.42, -0.2, 0.02], r: [0, 0, side * 0.14], shadow: true });
    det(w, rbox(0.2, 0.08, 0.08, 0.02), c.teal, { p: [side * 0.56, 0.04, 0.02] });
    m.wings.push(w);
  }
  return m;
}

// ---------- 10. GROM: armoured juggernaut with a water dome ----------
function buildGrom() {
  const m = blank();
  const c = mats({ skin: 0x3f6b52, top: 0xf0dfc0, trim: 0xf07a2a, pants: 0x2a2a4a, boot: 0xf0dfc0, bootTrim: 0xf07a2a, sole: 0x2a2a4a, sleeve: 0x2a2a4a, fore: 0xf0dfc0, glove: 0x3f6b52, cream: 0xf0dfc0, orange: 0xf07a2a, navy: 0x2a2a4a, tan: 0xb89462 });
  const { head, torso } = humanoid(m, c, { bulk: 1.72, headR: 0.3, neck: 0.06 });
  add(head, sphere(0.3, 16, 12), c.skin);
  det(head, rbox(0.2, 0.3, 0.1, 0.04), c.cream, { p: [0, 0.16, 0.24], r: [-0.3, 0, 0] });
  det(head, rbox(0.1, 0.24, 0.2, 0.04), c.cream, { p: [-0.27, 0, 0.06] });
  det(head, rbox(0.1, 0.24, 0.2, 0.04), c.cream, { p: [0.27, 0, 0.06] });
  const fire = basic(glow(0xff9a1f, 1.3));
  for (const side of [-1, 1]) {
    const e = det(head, sphere(0.055, 8, 6), fire, { p: [side * 0.11, 0, 0.27], s: [1.2, 0.8, 0.5] });
    m.eyes.push(e);
    det(head, box(0.14, 0.04, 0.04), INK, { p: [side * 0.11, 0.07, 0.28], r: [0, 0, side * -0.4] });
  }
  det(head, torus(0.06, 0.015, Math.PI), INK, { p: [0, -0.13, 0.27], r: [0, 0, Math.PI] });
  add(torso, torus(0.36, 0.14), c.cream, { p: [0, 0.4, 0.02], r: [Math.PI / 2, 0, 0], outline: 0.05 });
  det(torso, rbox(0.7, 0.4, 0.14, 0.06), c.cream, { p: [0, 0.06, 0.36] });
  det(torso, torus(0.11, 0.04), c.orange, { p: [0, 0.08, 0.44] });
  det(torso, sphere(0.3, 10, 8), c.skin, { p: [0, -0.2, 0.2], s: [1.3, 0.7, 0.8] });
  det(torso, torus(0.52, 0.09), c.tan, { p: [0, -0.34, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.82, 1] });
  det(torso, rbox(0.18, 0.14, 0.1, 0.03), c.orange, { p: [0, -0.34, 0.46] });
  add(torso, sphere(0.36, 14, 10), c.orange, { p: [-0.72, 0.3, 0], s: [1, 0.85, 1.05], outline: 0.06 });
  add(torso, sphere(0.3, 14, 10), c.cream, { p: [0.7, 0.28, 0], s: [1, 0.8, 1.05], outline: 0.06 });
  // water dome on the back
  add(torso, cyl(0.42, 0.42, 0.56, 8), basic(glow(0x35e0e0, 0.95)), { p: [0, 0.72, -0.34], outline: 0.05 });
  det(torso, cyl(0.46, 0.46, 0.12, 8), c.cream, { p: [0, 1.04, -0.34], shadow: true });
  det(torso, cyl(0.48, 0.5, 0.14, 8), c.cream, { p: [0, 0.42, -0.34] });
  det(torso, rbox(0.3, 0.1, 0.2, 0.03), c.orange, { p: [0, 1.12, -0.34] });
  for (const arm of [m.armL, m.armR]) add(arm, cyl(0.24, 0.27, 0.34, 10), c.cream, { p: [0, -0.36, 0], outline: 0.06 });
  for (const arm of [m.armL, m.armR]) det(arm, cyl(0.28, 0.28, 0.09, 10), c.orange, { p: [0, -0.48, 0] });
  return m;
}

const BUILDERS = { jaro: buildJaro, pippa: buildPippa, zyro: buildZyro, byte: buildByte, melli: buildMelli, nimbi: buildNimbi, luma: buildLuma, bruno: buildBruno, skye: buildSkye, grom: buildGrom };

export function buildHero(id, team = 0) {
  const m = (BUILDERS[id] || buildJaro)();
  curFlash = undefined;
  m.root.scale.setScalar(1.34);
  m.blinkT = 1 + Math.random() * 3;
  setTeam(m, team);
  return m;
}

export function setTeam(m, team) {
  for (const mat of m.teamMats) mat.color.setHex(TEAM_COLORS[team]);
  for (const mat of m.glowMats) mat.color.copy(glow(TEAM_COLORS[team], 1.3));
}

// Procedural animation shared by all heroes.
// s: { moving 0..1, kick 0..1 (attack recoil), cheer }
export function animateHero(m, t, dt, s) {
  const mv = s.moving, k = s.kick || 0;
  const step = Math.sin(t * 13);
  m.rig.position.y = Math.abs(step) * 0.07 * mv + Math.sin(t * 2.4) * 0.02 + (s.cheer ? Math.abs(Math.sin(t * 7)) * 0.35 : 0);
  m.rig.rotation.x = mv * 0.13 - k * 0.2;
  m.rig.scale.set(1 + k * 0.08, 1 - k * 0.09, 1 + k * 0.08);
  if (m.footL) {
    m.footL.position.z = step * 0.26 * mv;
    m.footR.position.z = -step * 0.26 * mv;
    m.footL.position.y = Math.max(0, step) * 0.14 * mv;
    m.footR.position.y = Math.max(0, -step) * 0.14 * mv;
    m.footL.rotation.x = -step * 0.35 * mv;
    m.footR.rotation.x = step * 0.35 * mv;
  }
  if (m.torso) { m.torso.rotation.y = step * 0.12 * mv; m.torso.scale.y = 1 + Math.sin(t * 2.4) * 0.015; }
  if (m.armL) {
    m.armL.rotation.x = m.armBase.l[0] - step * 0.6 * mv - (s.cheer ? 2.6 : 0);
    m.armL.rotation.z = m.armBase.l[1] - (s.cheer ? 0.3 : 0);
    m.armR.rotation.x = m.armBase.r[0] + k * 0.45 + Math.sin(t * 2.4) * 0.03;
    m.armR.rotation.z = m.armBase.r[1];
  }
  if (m.head) { m.head.rotation.z = Math.sin(t * 1.7) * 0.04; m.head.rotation.x = k * 0.1 - mv * 0.05; }
  if (m.tail) { m.tail.rotation.y = Math.sin(t * (3 + mv * 6)) * 0.4; m.tail.rotation.x = Math.sin(t * 2.1) * 0.08; }
  if (m.scarf) m.scarf.rotation.x = 0.1 + mv * 0.7 + Math.sin(t * 6) * 0.12;
  for (let i = 0; i < m.wings.length; i++) {
    const w = m.wings[i];
    if (w.userData.rz === undefined) w.userData.rz = w.rotation.z;
    w.rotation.z = w.userData.rz + Math.sin(t * (2.5 + mv * 5)) * 0.1 * (i % 2 ? -1 : 1);
  }
  m.blinkT -= dt;
  const blink = m.blinkT < 0.12 ? 0.12 : 1;
  if (m.blinkT < 0) m.blinkT = 2 + Math.random() * 3;
  for (const e of m.eyes) e.scale.y = (e.userData.sy ?? (e.userData.sy = e.scale.y)) * blink;
  m.flash.value = Math.max(0, m.flash.value - dt * 7);
}

export const prepHero = (m) => m;

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
