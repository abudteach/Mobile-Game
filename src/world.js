import * as THREE from 'three';
import { MAP_W, MAP_H, HALF_W, HALF_H, OBSTACLES, SPAWN, TEAM_COLORS } from './config.js';
import { toon } from './models.js';

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x17132f, side: THREE.BackSide });

// Builds the static arena: painted floor, cover blocks, rails, spawn pads, lights and backdrop.
export function buildArena(scene, paint) {
  scene.background = new THREE.Color(0x1a1440);
  scene.fog = new THREE.Fog(0x1a1440, 48, 95);

  const hemi = new THREE.HemisphereLight(0xdfe6ff, 0x4a3566, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -24; sc.right = 24; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 70;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // outer ground
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(260, 220), new THREE.MeshBasicMaterial({ color: 0x15102f }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.06;
  scene.add(outer);

  // arena floor with the paint canvas
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_W, MAP_H),
    new THREE.MeshStandardMaterial({ map: paint.texture, emissiveMap: paint.texture, emissive: 0xffffff, emissiveIntensity: 0.34, roughness: 0.5, metalness: 0.0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // neon rails around the arena
  const railMat = toon(0x3a2f86);
  const neon = new THREE.MeshBasicMaterial({ color: 0xb48cff });
  const rail = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), railMat);
    m.position.set(x, 0.5, z);
    m.receiveShadow = true;
    scene.add(m);
    const n = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.12, d + 0.02), neon);
    n.position.set(x, 1.02, z);
    scene.add(n);
  };
  rail(0, -HALF_H - 0.5, MAP_W + 2, 1);
  rail(0, HALF_H + 0.5, MAP_W + 2, 1);
  rail(-HALF_W - 0.5, 0, 1, MAP_H);
  rail(HALF_W + 0.5, 0, 1, MAP_H);

  // cover blocks
  const blockMat = toon(0x6a55e8), topMat = toon(0xa594ff), stripe = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  for (const o of OBSTACLES) {
    const geo = new THREE.BoxGeometry(o.w, o.h, o.d);
    const m = new THREE.Mesh(geo, blockMat);
    m.position.set(o.x, o.h / 2, o.z);
    m.castShadow = true;
    m.receiveShadow = true;
    const hull = new THREE.Mesh(geo, OUTLINE);
    hull.scale.set(1 + 0.12 / o.w, 1 + 0.12 / o.h, 1 + 0.12 / o.d);
    m.add(hull);
    scene.add(m);
    const top = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.25, 0.14, o.d - 0.25), topMat);
    top.position.set(o.x, o.h + 0.06, o.z);
    scene.add(top);
    const band = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.04, 0.16, o.d + 0.04), stripe);
    band.position.set(o.x, o.h * 0.55, o.z);
    scene.add(band);
    paint.block(o.x, o.z, o.w, o.d);
  }

  // spawn pads
  for (let team = 0; team < 2; team++) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, 0.12, 28), toon(0x2f3470));
    pad.position.set(SPAWN[team].x, 0.06, SPAWN[team].z);
    pad.receiveShadow = true;
    scene.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.1, 8, 40), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team] }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(SPAWN[team].x, 0.14, SPAWN[team].z);
    scene.add(ring);
  }

  // backdrop: glowing pylons and floating shapes so the world doesn't end at the rail
  const deco = [];
  const palette = [0x18d6ff, 0xff2f8e, 0xffd76a, 0xb48cff];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const x = -42 + (i >> 1) * 7 + (Math.random() - 0.5) * 3;
    const z = side * (HALF_H + 5 + Math.random() * 9) - (side < 0 ? 4 : -2);
    const h = 2 + Math.random() * 7;
    const col = palette[i % palette.length];
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), toon(0x2a2468));
    pylon.position.set(x, h / 2, z);
    scene.add(pylon);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 1.7), new THREE.MeshBasicMaterial({ color: col }));
    cap.position.set(x, h + 0.1, z);
    scene.add(cap);
    if (i % 3 === 0) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshBasicMaterial({ color: col }));
      gem.position.set(x, h + 2, z);
      gem.userData.y0 = h + 2;
      gem.userData.ph = Math.random() * 6;
      scene.add(gem);
      deco.push(gem);
    }
  }

  return {
    sun,
    update(t, focus) {
      sun.position.set(focus.x - 9, 24, focus.z + 10);
      sun.target.position.set(focus.x, 0, focus.z);
      for (const g of deco) { g.rotation.y = t * 0.8 + g.userData.ph; g.position.y = g.userData.y0 + Math.sin(t * 1.3 + g.userData.ph) * 0.5; }
    },
  };
}

// ---------- collision helpers (XZ plane) ----------
const BOXES = OBSTACLES.map((o) => ({ x0: o.x - o.w / 2, x1: o.x + o.w / 2, z0: o.z - o.d / 2, z1: o.z + o.d / 2 }));
export { BOXES };

// Push a circle out of walls, cover blocks and (optionally) round structures.
export function resolveCollisions(u, structures) {
  const r = u.radius;
  for (const b of BOXES) {
    const nx = Math.max(b.x0, Math.min(u.x, b.x1));
    const nz = Math.max(b.z0, Math.min(u.z, b.z1));
    let dx = u.x - nx, dz = u.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      u.x = nx + (dx / d) * r;
      u.z = nz + (dz / d) * r;
    } else {
      // centre is inside the box: leave through the nearest face
      const l = u.x - b.x0, rr = b.x1 - u.x, t = u.z - b.z0, bt = b.z1 - u.z;
      const m = Math.min(l, rr, t, bt);
      if (m === l) u.x = b.x0 - r; else if (m === rr) u.x = b.x1 + r; else if (m === t) u.z = b.z0 - r; else u.z = b.z1 + r;
    }
  }
  if (structures) {
    for (const s of structures) {
      if (!s.alive || s === u) continue;
      const dx = u.x - s.x, dz = u.z - s.z, min = r + s.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001;
        u.x = s.x + (dx / d) * min;
        u.z = s.z + (dz / d) * min;
      }
    }
  }
  u.x = Math.max(-HALF_W + r, Math.min(HALF_W - r, u.x));
  u.z = Math.max(-HALF_H + r, Math.min(HALF_H - r, u.z));
}

// Entry parameter (0..1) of segment a->b into a box grown by `grow`, or -1 if it misses.
export function segBox(ax, az, bx, bz, b, grow) {
  const x0 = b.x0 - grow, x1 = b.x1 + grow, z0 = b.z0 - grow, z1 = b.z1 + grow;
  const dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) { if (ax < x0 || ax > x1) return -1; } else {
    let ta = (x0 - ax) / dx, tb = (x1 - ax) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  if (Math.abs(dz) < 1e-9) { if (az < z0 || az > z1) return -1; } else {
    let ta = (z0 - az) / dz, tb = (z1 - az) / dz;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return t0;
}

export function pointInBox(x, z, grow = 0) {
  for (const b of BOXES) if (x > b.x0 - grow && x < b.x1 + grow && z > b.z0 - grow && z < b.z1 + grow) return true;
  return false;
}

// True if nothing solid is between the two points (used for line-of-fire checks).
export function clearLine(ax, az, bx, bz, grow = 0.1) {
  for (const b of BOXES) if (segBox(ax, az, bx, bz, b, grow) >= 0) return false;
  return true;
}

const out = { x: 0, z: 0 };
// Local path planner: returns a unit direction from the unit toward (tx,tz) that walks
// around cover blocks (via their corners) and around round structures.
export function steer(u, tx, tz, structures, ignore) {
  const r = u.radius;
  let hit = null, hitT = 2;
  for (const b of BOXES) {
    const t = segBox(u.x, u.z, tx, tz, b, r + 0.05);
    if (t >= 0 && t < hitT) { hitT = t; hit = b; }
  }
  let gx = tx, gz = tz;
  if (hit) {
    const g = r + 0.55;
    const corners = [[hit.x0 - g, hit.z0 - g], [hit.x1 + g, hit.z0 - g], [hit.x0 - g, hit.z1 + g], [hit.x1 + g, hit.z1 + g]];
    let best = Infinity;
    for (const [cx, cz] of corners) {
      if (Math.abs(cx) > HALF_W - r || Math.abs(cz) > HALF_H - r) continue;
      if (segBox(u.x, u.z, cx, cz, hit, r - 0.02) >= 0) continue;
      const d = Math.hypot(cx - u.x, cz - u.z) + Math.hypot(tx - cx, tz - cz);
      if (d < best) { best = d; gx = cx; gz = cz; }
    }
  } else if (structures) {
    for (const s of structures) {
      if (!s.alive || s === ignore) continue;
      const dx = tx - u.x, dz = tz - u.z;
      const len2 = dx * dx + dz * dz;
      if (len2 < 0.01) continue;
      const t = ((s.x - u.x) * dx + (s.z - u.z) * dz) / len2;
      if (t <= 0 || t >= 1) continue;
      const px = u.x + dx * t, pz = u.z + dz * t;
      const clear = s.radius + r + 0.3;
      let ox = px - s.x, oz = pz - s.z;
      const od = Math.hypot(ox, oz);
      if (od >= clear) continue;
      if (od < 0.05) { const len = Math.sqrt(len2); ox = -dz / len; oz = dx / len; } else { ox /= od; oz /= od; }
      gx = s.x + ox * (clear + 0.6);
      gz = s.z + oz * (clear + 0.6);
      break;
    }
  }
  const dx = gx - u.x, dz = gz - u.z;
  const d = Math.hypot(dx, dz) || 1;
  out.x = dx / d; out.z = dz / d;
  return out;
}
