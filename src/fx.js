import * as THREE from 'three';

const MAX = 320;
const tmp = new THREE.Object3D();
const col = new THREE.Color();

// Cheap visual effects: one instanced mesh for paint droplets, pooled ground rings and beams.
export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.shake = 0;
    this.p = [];
    for (let i = 0; i < MAX; i++) this.p.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, max: 1 });
    this.next = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.mesh.frustumCulled = false;
    tmp.scale.setScalar(0);
    tmp.updateMatrix();
    for (let i = 0; i < MAX; i++) { this.mesh.setMatrixAt(i, tmp.matrix); this.mesh.setColorAt(i, col.set(0xffffff)); }
    scene.add(this.mesh);

    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.86, 1, 48);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 3;
      scene.add(m);
      this.rings.push({ m, t: 0, dur: 1, r: 1 });
    }

    this.beams = [];
    const beamGeo = new THREE.BoxGeometry(1, 0.35, 1);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.beams.push({ m, t: 0 });
    }
  }

  splash(x, y, z, color, n = 8, power = 5) {
    for (let i = 0; i < n; i++) {
      const p = this.p[this.next];
      const idx = this.next;
      this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2, s = power * (0.35 + Math.random() * 0.65);
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = power * (0.5 + Math.random() * 0.9);
      p.life = p.max = 0.45 + Math.random() * 0.35;
      p.size = 0.7 + Math.random() * 1.1;
      this.mesh.setColorAt(idx, col.set(color).offsetHSL(0, 0, (Math.random() - 0.4) * 0.15));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  ring(x, z, radius, color, dur = 0.45) {
    let slot = this.rings.find((r) => !r.m.visible) || this.rings[0];
    slot.t = 0; slot.dur = dur; slot.r = radius;
    slot.m.position.set(x, 0.07, z);
    slot.m.material.color.set(color);
    slot.m.visible = true;
  }

  beam(x0, z0, x1, z1, width, color) {
    const slot = this.beams.find((b) => !b.m.visible) || this.beams[0];
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    slot.m.position.set((x0 + x1) / 2, 1.1, (z0 + z1) / 2);
    slot.m.rotation.y = Math.atan2(dx, dz);
    slot.m.scale.set(width, 1, len);
    slot.w = width;
    slot.m.material.color.set(color);
    slot.m.material.opacity = 1;
    slot.m.visible = true;
    slot.t = 0.28;
  }

  addShake(v) { this.shake = Math.min(1.2, this.shake + v); }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 22 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.08) { p.y = 0.08; p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; }
      const s = p.life > 0 ? p.size * Math.min(1, (p.life / p.max) * 1.6) : 0;
      tmp.position.set(p.x, p.y, p.z);
      tmp.scale.setScalar(s);
      tmp.updateMatrix();
      this.mesh.setMatrixAt(i, tmp.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.m.visible = false; continue; }
      const e = 1 - (1 - k) * (1 - k);
      r.m.scale.setScalar(r.r * (0.25 + 0.75 * e));
      r.m.material.opacity = 0.9 * (1 - k);
    }
    for (const b of this.beams) {
      if (!b.m.visible) continue;
      b.t -= dt;
      if (b.t <= 0) { b.m.visible = false; continue; }
      b.m.material.opacity = b.t / 0.28;
      b.m.scale.x = b.w * (0.4 + 0.6 * (b.t / 0.28));
    }
    this.shake = Math.max(0, this.shake - dt * 2.6);
  }
}
