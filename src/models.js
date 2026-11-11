import * as THREE from 'three';
import { TEAM_COLORS } from './config.js';

// ---------- shared toon look ----------
const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([110, 175, 230, 255]), 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

export const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
const glowMat = (color = 0xffffff) => new THREE.MeshBasicMaterial({ color });
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x17132f, side: THREE.BackSide });

// Add a mesh to `parent`. `o.outline` draws an inverted hull for the cartoon outline.
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

const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const sphere = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 14) => new THREE.ConeGeometry(r, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const torus = (r, tube, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, 8, 24, arc);

const WHITE = toon(0xffffff);
const GLINT = glowMat(0xffffff);

function eye(parent, x, y, z, r = 0.13, iris = 0x2a1f4d) {
  const g = grp(parent, x, y, z);
  add(g, sphere(r, 14, 10), WHITE, { s: [1, 1.2, 0.45], outline: 0.1, shadow: false });
  add(g, sphere(r * 0.62, 12, 8), glowMat(iris), { p: [0, -r * 0.05, r * 0.3], s: [1, 1.2, 0.45], outline: false, shadow: false });
  add(g, sphere(r * 0.22, 8, 6), GLINT, { p: [r * 0.25, r * 0.4, r * 0.5], outline: false, shadow: false });
  return g;
}

function blank() {
  const root = new THREE.Group();
  const rig = grp(root);
  return { root, rig, head: null, armL: null, armR: null, footL: null, footR: null, tail: null, eyes: [], teamMats: [], glowMats: [], armBase: { l: [0, 0], r: [0, 0] }, footZ: 0, spin: [] };
}

// ---------- RIKO: skater kid with twin spray cans ----------
function buildRiko() {
  const m = blank(), rig = m.rig;
  const skin = toon(0xffcfa3), hoodie = toon(0xffc928), pants = toon(0x2b2f55), hair = toon(0x4a2c1a), dark = toon(0x23213f), metal = toon(0xc9d0ee);
  const team = toon(0xffffff), glow = glowMat();
  m.teamMats.push(team); m.glowMats.push(glow);

  // hover board
  m.board = grp(rig, 0, 0.1, 0);
  add(m.board, capsule(0.3, 0.95), dark, { r: [Math.PI / 2, 0, 0], s: [1, 1, 0.17] });
  add(m.board, capsule(0.24, 0.85), glow, { p: [0, -0.06, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.1], outline: false, shadow: false });
  add(m.board, capsule(0.08, 0.7), team, { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.3], outline: false, shadow: false });

  for (const side of [-1, 1]) {
    const f = grp(rig, side * 0.2, 0.27, 0);
    add(f, box(0.25, 0.18, 0.44), WHITE, { p: [0, 0, 0.05] });
    add(f, box(0.27, 0.06, 0.46), team, { p: [0, -0.08, 0.05], outline: false });
    add(f, cyl(0.11, 0.12, 0.3), pants, { p: [0, 0.22, 0] });
    if (side < 0) m.footL = f; else m.footR = f;
  }

  add(rig, capsule(0.36, 0.3), hoodie, { p: [0, 0.98, 0] });
  add(rig, box(0.4, 0.16, 0.1), toon(0xf2b400), { p: [0, 0.82, 0.33], outline: false });
  add(rig, sphere(0.3), hoodie, { p: [0, 1.3, -0.3], s: [1.2, 0.8, 0.8] });

  const head = m.head = grp(rig, 0, 1.74, 0);
  add(head, sphere(0.5), skin);
  for (const [x, rz] of [[-0.16, 0.5], [0, 0], [0.16, -0.5]]) add(head, cone(0.1, 0.3, 8), hair, { p: [x, 0.3, 0.42], r: [1.9, 0, rz], outline: false });
  add(head, sphere(0.14), hair, { p: [-0.42, 0.05, 0.12], outline: false });
  add(head, sphere(0.14), hair, { p: [0.42, 0.05, 0.12], outline: false });
  add(head, new THREE.SphereGeometry(0.535, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), team, { p: [0, 0.07, -0.02], r: [-0.12, 0, 0] });
  add(head, cyl(0.3, 0.3, 0.05), team, { p: [0, 0.14, -0.52], s: [1, 1, 1.15], r: [0.15, 0, 0] });
  add(head, sphere(0.06), WHITE, { p: [0, 0.6, -0.08], outline: false });
  add(head, torus(0.56, 0.05, Math.PI), dark, { p: [0, 0.02, 0], outline: false });
  for (const side of [-1, 1]) {
    add(head, cyl(0.17, 0.17, 0.12), dark, { p: [side * 0.54, -0.02, 0], r: [0, 0, Math.PI / 2] });
    add(head, cyl(0.1, 0.1, 0.02), glow, { p: [side * 0.61, -0.02, 0], r: [0, 0, Math.PI / 2], outline: false, shadow: false });
    add(head, box(0.2, 0.045, 0.04), hair, { p: [side * 0.2, 0.17, 0.44], r: [0, 0, side * -0.3], outline: false, shadow: false });
  }
  m.eyes.push(eye(head, -0.19, -0.02, 0.43), eye(head, 0.19, -0.02, 0.43));
  add(head, sphere(0.07, 10, 8), toon(0x7a2b2b), { p: [0.03, -0.24, 0.44], s: [1.25, 0.8, 0.4], outline: false, shadow: false });

  for (const side of [-1, 1]) {
    const a = grp(rig, side * 0.42, 1.2, 0);
    add(a, capsule(0.1, 0.28), hoodie, { p: [0, -0.2, 0] });
    add(a, sphere(0.12), skin, { p: [0, -0.42, 0] });
    add(a, cyl(0.1, 0.1, 0.3), metal, { p: [0, -0.6, 0] });
    add(a, cyl(0.105, 0.105, 0.1), team, { p: [0, -0.6, 0], outline: false });
    add(a, cyl(0.05, 0.07, 0.08), dark, { p: [0, -0.79, 0], outline: false });
    if (side < 0) { m.armL = a; m.armBase.l = [-1.25, -0.12]; } else { m.armR = a; m.armBase.r = [-1.25, 0.12]; }
  }
  return m;
}

// ---------- BOMBO: chunky cannon robot ----------
function buildBombo() {
  const m = blank(), rig = m.rig;
  const orange = toon(0xff8a3d), metal = toon(0x8f97c4), dark = toon(0x2a2d55), visor = toon(0x1d2040);
  const team = toon(0xffffff), glow = glowMat();
  m.teamMats.push(team); m.glowMats.push(glow);

  for (const side of [-1, 1]) {
    const f = grp(rig, side * 0.38, 0.14, 0);
    add(f, box(0.42, 0.26, 0.62), metal, { p: [0, 0, 0.05] });
    add(f, cyl(0.17, 0.17, 0.3), dark, { p: [0, 0.25, 0] });
    if (side < 0) m.footL = f; else m.footR = f;
  }

  add(rig, sphere(0.8, 24, 18), orange, { p: [0, 1.05, 0], s: [1, 0.9, 0.92], outline: 0.05 });
  add(rig, torus(0.79, 0.05), dark, { p: [0, 1.05, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.92, 1], outline: false });
  add(rig, torus(0.4, 0.06), dark, { p: [0, 1.0, 0.64], outline: false });
  add(rig, cyl(0.38, 0.38, 0.08), glow, { p: [0, 1.0, 0.66], r: [Math.PI / 2, 0, 0], outline: false, shadow: false });
  add(rig, box(0.5, 0.07, 0.06), dark, { p: [0, 1.0, 0.71], outline: false, shadow: false });

  const head = m.head = grp(rig, 0, 1.95, 0.05);
  add(head, sphere(0.42), visor);
  add(head, new THREE.SphereGeometry(0.46, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), orange, { p: [0, 0.03, -0.03], r: [-0.25, 0, 0] });
  for (const side of [-1, 1]) {
    const e = add(head, sphere(0.1, 12, 8), glowMat(0xfff27a), { p: [side * 0.16, -0.02, 0.38], s: [1, 1.35, 0.4], outline: false, shadow: false });
    m.eyes.push(e);
    add(head, cyl(0.1, 0.1, 0.1), metal, { p: [side * 0.44, 0, 0], r: [0, 0, Math.PI / 2] });
  }
  add(head, cyl(0.025, 0.025, 0.36), metal, { p: [0, 0.6, -0.05], outline: false });
  add(head, sphere(0.09), glow, { p: [0, 0.8, -0.05], shadow: false });

  add(rig, sphere(0.3), metal, { p: [-0.88, 1.45, 0] });
  add(rig, sphere(0.3), metal, { p: [0.88, 1.45, 0] });

  const armR = m.armR = grp(rig, 0.98, 1.3, 0);
  add(armR, cyl(0.3, 0.26, 1.0), dark, { p: [0, -0.5, 0] });
  add(armR, torus(0.31, 0.07), team, { p: [0, -0.95, 0], r: [Math.PI / 2, 0, 0], outline: false });
  add(armR, torus(0.29, 0.05), metal, { p: [0, -0.35, 0], r: [Math.PI / 2, 0, 0], outline: false });
  add(armR, cyl(0.22, 0.22, 0.04), glow, { p: [0, -1.01, 0], outline: false, shadow: false });
  m.armBase.r = [-1.45, 0];

  const armL = m.armL = grp(rig, -0.98, 1.3, 0);
  add(armL, capsule(0.16, 0.3), metal, { p: [0, -0.3, 0] });
  add(armL, sphere(0.32), orange, { p: [0, -0.72, 0] });
  m.armBase.l = [-0.35, -0.25];

  add(rig, capsule(0.26, 0.5), team, { p: [0, 1.3, -0.78] });
  add(rig, cyl(0.2, 0.2, 0.12), metal, { p: [0, 1.85, -0.78], outline: false });
  return m;
}

// ---------- KIRA: fox mage with a paint staff ----------
function buildKira() {
  const m = blank(), rig = m.rig;
  const fur = toon(0xff8a3c), cream = toon(0xfff4e6), cloak = toon(0x6c3df2), dark = toon(0x3b2350), gold = toon(0xffd76a);
  const team = toon(0xffffff), glow = glowMat();
  m.teamMats.push(team); m.glowMats.push(glow);

  for (const side of [-1, 1]) {
    const f = grp(rig, side * 0.17, 0.14, 0);
    add(f, sphere(0.16), dark, { p: [0, 0, 0.05], s: [1, 0.8, 1.4] });
    add(f, cyl(0.09, 0.09, 0.3), fur, { p: [0, 0.25, 0] });
    if (side < 0) m.footL = f; else m.footR = f;
  }

  add(rig, cyl(0.22, 0.44, 0.78), cloak, { p: [0, 0.9, 0] });
  add(rig, torus(0.43, 0.045), gold, { p: [0, 0.53, 0], r: [Math.PI / 2, 0, 0], outline: false });
  add(rig, torus(0.25, 0.11), team, { p: [0, 1.28, 0], r: [Math.PI / 2, 0, 0] });
  m.scarf = grp(rig, 0.16, 1.26, -0.24);
  add(m.scarf, box(0.17, 0.55, 0.06), team, { p: [0, -0.24, -0.06], r: [0.5, 0, 0] });

  const head = m.head = grp(rig, 0, 1.76, 0);
  add(head, sphere(0.48), fur);
  add(head, sphere(0.24), cream, { p: [0, -0.16, 0.34], s: [1.15, 0.8, 1], outline: false });
  add(head, sphere(0.06), dark, { p: [0, -0.1, 0.57], outline: false, shadow: false });
  add(head, cone(0.1, 0.3, 8), fur, { p: [0.04, 0.46, 0.22], r: [0.7, 0, -0.2], outline: false });
  for (const side of [-1, 1]) {
    add(head, cone(0.16, 0.32, 8), cream, { p: [side * 0.46, -0.16, 0.05], r: [0, 0, side * -1.75] });
    const ear = grp(head, side * 0.27, 0.36, 0);
    ear.rotation.z = side * -0.28;
    add(ear, cone(0.2, 0.52, 10), fur, { p: [0, 0.22, 0] });
    add(ear, cone(0.11, 0.34, 8), cream, { p: [0, 0.17, 0.08], outline: false, shadow: false });
    add(ear, cone(0.085, 0.2, 8), dark, { p: [0, 0.4, 0], outline: false });
    m.eyes.push(eye(head, side * 0.2, 0.02, 0.4, 0.12, 0x15935a));
    add(head, box(0.2, 0.04, 0.04), dark, { p: [side * 0.21, 0.19, 0.4], r: [0, 0, side * 0.25], outline: false, shadow: false });
  }

  m.tail = grp(rig, 0, 0.75, -0.3);
  add(m.tail, sphere(0.2), fur, { p: [0, 0.05, -0.15] });
  add(m.tail, sphere(0.26), fur, { p: [0, 0.2, -0.4] });
  add(m.tail, sphere(0.28), fur, { p: [0, 0.42, -0.6] });
  add(m.tail, sphere(0.2), cream, { p: [0, 0.64, -0.72] });

  for (const side of [-1, 1]) {
    const a = grp(rig, side * 0.33, 1.15, 0);
    add(a, capsule(0.08, 0.25), cloak, { p: [0, -0.18, 0] });
    add(a, sphere(0.1), fur, { p: [0, -0.38, 0] });
    if (side < 0) { m.armL = a; m.armBase.l = [0.1, -0.3]; } else {
      m.armR = a; m.armBase.r = [-1.0, 0.1];
      const staff = grp(a, 0, -0.38, 0);
      staff.rotation.x = 1.0;
      add(staff, cyl(0.035, 0.035, 1.9, 8), gold, { p: [0, 0.25, 0] });
      add(staff, sphere(0.2), glow, { p: [0, 1.32, 0], shadow: false });
      add(staff, torus(0.29, 0.04, Math.PI * 1.4), gold, { p: [0, 1.32, 0], r: [0, 0, -0.6], outline: false });
      m.orb = staff;
    }
  }
  return m;
}

// ---------- MOCHI: squishy blob cat healer ----------
function buildMochi() {
  const m = blank(), rig = m.rig;
  const cream = toon(0xfff3f7), pink = toon(0xffa9c9), dark = toon(0x3a2a55), gold = toon(0xffd76a);
  const team = toon(0xffffff), glow = glowMat();
  m.teamMats.push(team); m.glowMats.push(glow);

  for (const side of [-1, 1]) {
    const f = grp(rig, side * 0.3, 0.1, 0.1);
    add(f, sphere(0.18), pink, { s: [1, 0.6, 1.3] });
    if (side < 0) m.footL = f; else m.footR = f;
  }

  const head = m.head = grp(rig, 0, 0.88, 0);
  add(head, sphere(0.78, 26, 18), cream, { s: [1.05, 0.92, 1], outline: 0.05 });
  for (const side of [-1, 1]) {
    const ear = grp(head, side * 0.42, 0.56, 0);
    ear.rotation.z = side * -0.32;
    add(ear, cone(0.22, 0.42, 10), cream, { p: [0, 0.16, 0] });
    add(ear, cone(0.12, 0.26, 8), pink, { p: [0, 0.13, 0.09], outline: false, shadow: false });
    m.eyes.push(eye(head, side * 0.27, 0.12, 0.66, 0.15, 0x2a2f7a));
    add(head, sphere(0.1, 10, 8), pink, { p: [side * 0.47, -0.08, 0.58], s: [1.2, 0.7, 0.3], outline: false, shadow: false });
    add(head, torus(0.05, 0.018, Math.PI), dark, { p: [side * 0.05, -0.07, 0.765], r: [0, 0, Math.PI], outline: false, shadow: false });
    add(head, box(0.3, 0.015, 0.015), dark, { p: [side * 0.62, -0.02, 0.48], r: [0, side * 0.5, side * 0.12], outline: false, shadow: false });
    add(head, box(0.3, 0.015, 0.015), dark, { p: [side * 0.62, -0.1, 0.48], r: [0, side * 0.5, side * -0.12], outline: false, shadow: false });
  }
  add(head, sphere(0.035, 8, 6), pink, { p: [0, -0.01, 0.775], outline: false, shadow: false });
  // bow
  add(head, sphere(0.14), team, { p: [-0.36, 0.7, 0.2], s: [1.2, 0.8, 0.5] });
  add(head, sphere(0.14), team, { p: [-0.1, 0.74, 0.2], s: [1.2, 0.8, 0.5] });
  add(head, sphere(0.07), gold, { p: [-0.23, 0.72, 0.24], outline: false });

  add(rig, torus(0.71, 0.07), team, { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0], outline: false });
  add(rig, sphere(0.1), gold, { p: [0, 0.44, 0.73] });

  for (const side of [-1, 1]) {
    const a = grp(rig, side * 0.74, 0.82, 0.18);
    add(a, sphere(0.15), cream, { p: [0, -0.08, 0], s: [1, 1.2, 1] });
    if (side < 0) { m.armL = a; m.armBase.l = [0, 0]; } else {
      m.armR = a; m.armBase.r = [-0.2, 0];
      add(a, cyl(0.03, 0.03, 0.75, 8), gold, { p: [0, 0.22, 0.08] });
      add(a, torus(0.2, 0.045), glow, { p: [0, 0.78, 0.08], outline: false, shadow: false });
      add(a, sphere(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }), { p: [0, 0.78, 0.08], outline: false, shadow: false });
    }
  }

  m.tail = grp(rig, 0, 0.55, -0.7);
  add(m.tail, sphere(0.13), cream, { p: [0, 0, -0.1] });
  add(m.tail, sphere(0.12), cream, { p: [0, 0.15, -0.25] });
  add(m.tail, sphere(0.14), pink, { p: [0, 0.33, -0.33] });
  m.squishy = true;
  return m;
}

const BUILDERS = { riko: buildRiko, bombo: buildBombo, kira: buildKira, mochi: buildMochi };

export function buildHero(id, team = 0) {
  const m = BUILDERS[id]();
  m.root.scale.setScalar(1.28);
  m.blinkT = 1 + Math.random() * 3;
  setTeam(m, team);
  return m;
}

export function setTeam(m, team) {
  for (const mat of m.teamMats) mat.color.setHex(TEAM_COLORS[team]);
  for (const mat of m.glowMats) mat.color.setHex(TEAM_COLORS[team]).lerp(new THREE.Color(0xffffff), 0.35);
}

// Procedural animation shared by all heroes.
// s: { moving 0..1, kick 0..1 (attack recoil), spin (rad/s extra rotation), cheer }
export function animateHero(m, t, dt, s) {
  const mv = s.moving, k = s.kick || 0;
  const step = Math.sin(t * 13);
  m.rig.position.y = Math.abs(step) * 0.07 * mv + Math.sin(t * 2.4) * 0.025 + (s.cheer ? Math.abs(Math.sin(t * 7)) * 0.35 : 0);
  m.rig.rotation.x = mv * 0.13 - k * 0.22;
  const sq = m.squishy ? 0.07 * Math.sin(t * (mv ? 13 : 3)) : 0;
  m.rig.scale.set(1 + k * 0.09 + sq, 1 - k * 0.1 - sq, 1 + k * 0.09 + sq);
  if (m.footL && !m.board) {
    m.footL.position.z = m.footZ + step * 0.24 * mv;
    m.footR.position.z = m.footZ - step * 0.24 * mv;
    m.footL.position.y = m.footL.userData.y0 + Math.max(0, step) * 0.12 * mv;
    m.footR.position.y = m.footR.userData.y0 + Math.max(0, -step) * 0.12 * mv;
  }
  if (m.board) { m.board.rotation.x = -mv * 0.12; m.board.rotation.z = Math.sin(t * 5) * 0.06 * mv; }
  if (m.armL) {
    m.armL.rotation.x = m.armBase.l[0] + (m.armBase.l[0] > -0.6 ? -step * 0.5 * mv : 0) - k * 0.35 - (s.cheer ? 2.4 : 0);
    m.armL.rotation.z = m.armBase.l[1];
    m.armR.rotation.x = m.armBase.r[0] + (m.armBase.r[0] > -0.6 ? step * 0.5 * mv : 0) - k * 0.35;
    m.armR.rotation.z = m.armBase.r[1];
  }
  if (m.head) { m.head.rotation.z = Math.sin(t * 1.7) * 0.05; m.head.rotation.x = k * 0.12; }
  if (m.tail) { m.tail.rotation.y = Math.sin(t * (3 + mv * 6)) * 0.4; m.tail.rotation.x = Math.sin(t * 2.1) * 0.08; }
  if (m.scarf) m.scarf.rotation.x = 0.2 + mv * 0.6 + Math.sin(t * 6) * 0.15;
  m.blinkT -= dt;
  const blink = m.blinkT < 0.12 ? 0.12 : 1;
  if (m.blinkT < 0) m.blinkT = 2 + Math.random() * 3;
  for (const e of m.eyes) e.scale.y = (e.userData.sy ?? (e.userData.sy = e.scale.y)) * blink;
}

// Remember rest positions once so the walk cycle has something to offset from.
export function prepHero(m) {
  for (const f of [m.footL, m.footR]) if (f) f.userData.y0 = f.position.y;
  m.footZ = m.footL ? m.footL.position.z : 0;
  return m;
}

// ---------- minions ----------
export function buildMinion(team) {
  const root = new THREE.Group();
  const body = toon(TEAM_COLORS[team]);
  const rig = grp(root);
  add(rig, sphere(0.42, 16, 12), body, { p: [0, 0.4, 0], s: [1, 0.86, 1] });
  add(rig, new THREE.SphereGeometry(0.33, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), toon(0xdfe4ff), { p: [0, 0.52, -0.02] });
  add(rig, sphere(0.05, 6, 5), toon(0xffd76a), { p: [0, 0.87, -0.02], outline: false });
  eye(rig, -0.15, 0.42, 0.36, 0.09);
  eye(rig, 0.15, 0.42, 0.36, 0.09);
  return { root, rig };
}

// ---------- structures ----------
export function buildTower(team) {
  const root = new THREE.Group();
  const col = TEAM_COLORS[team];
  const dark = toon(0x3a3f6b), mid = toon(0x5a62a3), metal = toon(0xb8c0ea);
  const glow = glowMat(new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.25));
  add(root, cyl(1.6, 1.95, 0.6, 8), dark, { p: [0, 0.3, 0], outline: 0.04 });
  add(root, torus(1.65, 0.09), glow, { p: [0, 0.62, 0], r: [Math.PI / 2, 0, 0], outline: false, shadow: false });
  add(root, cyl(0.8, 1.05, 2.2, 8), mid, { p: [0, 1.7, 0], outline: 0.05 });
  add(root, torus(0.95, 0.1), metal, { p: [0, 1.3, 0], r: [Math.PI / 2, 0, 0], outline: false });
  add(root, cyl(1.15, 0.85, 0.35, 8), dark, { p: [0, 2.9, 0], outline: 0.05 });
  const liquid = add(root, sphere(1.05, 20, 14), toon(col, { emissive: col, emissiveIntensity: 0.35 }), { p: [0, 3.9, 0], outline: false });
  add(root, sphere(1.22, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.1 }), { p: [0, 3.9, 0], outline: 0.03, shadow: false });
  add(root, cyl(0.3, 0.55, 0.22, 10), metal, { p: [0, 5.08, 0] });
  add(root, sphere(0.16, 10, 8), glow, { p: [0, 5.32, 0], outline: false, shadow: false });
  const turret = grp(root, 0, 2.95, 0);
  add(turret, cyl(0.22, 0.28, 1.3, 10), metal, { p: [0, 0, 1.0], r: [Math.PI / 2, 0, 0] });
  add(turret, torus(0.26, 0.06), glow, { p: [0, 0, 1.6], outline: false, shadow: false });
  return { root, turret, liquid, height: 5.6 };
}

export function buildCore(team) {
  const root = new THREE.Group();
  const col = TEAM_COLORS[team];
  const dark = toon(0x3a3f6b), metal = toon(0xb8c0ea);
  const glow = glowMat(new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.25));
  add(root, cyl(2.0, 2.4, 0.5, 10), dark, { p: [0, 0.25, 0], outline: 0.04 });
  add(root, torus(2.05, 0.1), glow, { p: [0, 0.52, 0], r: [Math.PI / 2, 0, 0], outline: false, shadow: false });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    add(root, cyl(0.16, 0.26, 2.3, 8), metal, { p: [Math.cos(a) * 1.7, 1.6, Math.sin(a) * 1.7], r: [Math.sin(a) * -0.3, 0, Math.cos(a) * 0.3] });
  }
  const crystal = add(root, new THREE.IcosahedronGeometry(1.25, 0), toon(col, { emissive: col, emissiveIntensity: 0.5 }), { p: [0, 2.7, 0], outline: 0.06 });
  const ring = add(root, torus(1.9, 0.08), glow, { p: [0, 2.7, 0], outline: false, shadow: false });
  const ring2 = add(root, torus(1.6, 0.05), metal, { p: [0, 2.7, 0], outline: false, shadow: false });
  return { root, crystal, ring, ring2, height: 4.6 };
}
