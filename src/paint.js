import * as THREE from 'three';
import { MAP_W, MAP_H, HALF_W, HALF_H, CELL, TEAM_CSS, SPAWN } from './config.js';

const PPU = 16; // canvas pixels per world unit
const VARIANTS = [
  ['#18d6ff', '#37e0ff', '#0cc4f2'],
  ['#ff2f8e', '#ff4fa2', '#f51c7c'],
];
const HILITE = ['#9af0ff', '#ffa3cf'];

// The paint layer: a logic grid (who owns each cell) plus a canvas texture that is
// mapped onto the arena floor. Gameplay reads the grid, players see the canvas.
export class Paint {
  constructor() {
    this.gw = MAP_W / CELL;
    this.gh = MAP_H / CELL;
    this.owner = new Uint8Array(this.gw * this.gh); // 0 = empty, 1/2 = team, 255 = blocked
    this.count = [0, 0];
    this.total = this.gw * this.gh;
    this.canvas = document.createElement('canvas');
    this.canvas.width = MAP_W * PPU;
    this.canvas.height = MAP_H * PPU;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.dirty = true;
    this.uploadT = 0;
    this.drawBase();
  }

  drawBase() {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.fillStyle = '#272a52';
    c.fillRect(0, 0, W, H);
    // checker tiles
    const tile = 4 * PPU;
    for (let y = 0; y < H / tile; y++) {
      for (let x = 0; x < W / tile; x++) {
        if ((x + y) % 2 === 0) { c.fillStyle = '#2d3160'; c.fillRect(x * tile, y * tile, tile, tile); }
      }
    }
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 2;
    for (let x = 0; x <= W; x += tile) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y <= H; y += tile) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // mid lane + centre circle
    c.strokeStyle = 'rgba(255,255,255,0.10)';
    c.lineWidth = 5;
    c.setLineDash([26, 20]);
    c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke();
    c.setLineDash([]);
    c.beginPath(); c.arc(W / 2, H / 2, 4.2 * PPU, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.035)';
    c.fillRect(0, H / 2 - 2.6 * PPU, W, 5.2 * PPU);
    // faint team tint around both bases
    for (let team = 0; team < 2; team++) {
      const px = (SPAWN[team].x + HALF_W) * PPU;
      const g = c.createRadialGradient(px, H / 2, 10, px, H / 2, 13 * PPU);
      g.addColorStop(0, TEAM_CSS[team] + '55');
      g.addColorStop(1, TEAM_CSS[team] + '00');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
  }

  // Mark a rectangle as not paintable (cover blocks, structures).
  block(x, z, w, d) {
    const x0 = Math.max(0, Math.floor((x - w / 2 + HALF_W) / CELL));
    const x1 = Math.min(this.gw - 1, Math.ceil((x + w / 2 + HALF_W) / CELL) - 1);
    const z0 = Math.max(0, Math.floor((z - d / 2 + HALF_H) / CELL));
    const z1 = Math.min(this.gh - 1, Math.ceil((z + d / 2 + HALF_H) / CELL) - 1);
    for (let j = z0; j <= z1; j++) {
      for (let i = x0; i <= x1; i++) {
        const k = j * this.gw + i;
        if (this.owner[k] !== 255) { this.owner[k] = 255; this.total--; }
      }
    }
  }

  // Paint a circle. Returns how many cells were newly won for `team`.
  paint(x, z, r, team) {
    const gw = this.gw, gh = this.gh, o = this.owner, id = team + 1;
    const cx = (x + HALF_W) / CELL, cz = (z + HALF_H) / CELL, cr = r / CELL;
    const x0 = Math.max(0, Math.floor(cx - cr)), x1 = Math.min(gw - 1, Math.ceil(cx + cr));
    const z0 = Math.max(0, Math.floor(cz - cr)), z1 = Math.min(gh - 1, Math.ceil(cz + cr));
    const r2 = cr * cr;
    let gained = 0;
    for (let j = z0; j <= z1; j++) {
      const dz = j + 0.5 - cz;
      for (let i = x0; i <= x1; i++) {
        const dx = i + 0.5 - cx;
        if (dx * dx + dz * dz > r2) continue;
        const k = j * gw + i, cur = o[k];
        if (cur === id || cur === 255) continue;
        if (cur) this.count[cur - 1]--;
        o[k] = id;
        this.count[team]++;
        gained++;
      }
    }
    if (gained) this.splat(x, z, r, team);
    return gained;
  }

  splat(x, z, r, team) {
    const c = this.ctx;
    const px = (x + HALF_W) * PPU, py = (z + HALF_H) * PPU, pr = r * PPU;
    const v = VARIANTS[team];
    c.fillStyle = v[(Math.random() * v.length) | 0];
    c.beginPath();
    c.arc(px, py, pr * 0.9, 0, Math.PI * 2);
    const lobes = r < 0.8 ? 3 : 7;
    for (let i = 0; i < lobes; i++) {
      const a = Math.random() * Math.PI * 2;
      const lr = pr * (0.25 + Math.random() * 0.3);
      const ld = pr * (0.7 + Math.random() * 0.15);
      c.moveTo(px + Math.cos(a) * ld + lr, py + Math.sin(a) * ld);
      c.arc(px + Math.cos(a) * ld, py + Math.sin(a) * ld, lr, 0, Math.PI * 2);
    }
    if (r >= 0.8) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const ld = pr * (1.15 + Math.random() * 0.3), lr = pr * (0.06 + Math.random() * 0.08);
        c.moveTo(px + Math.cos(a) * ld + lr, py + Math.sin(a) * ld);
        c.arc(px + Math.cos(a) * ld, py + Math.sin(a) * ld, lr, 0, Math.PI * 2);
      }
    }
    c.fill();
    if (r >= 0.8) {
      c.globalAlpha = 0.28;
      c.fillStyle = HILITE[team];
      c.beginPath();
      c.ellipse(px - pr * 0.25, py - pr * 0.3, pr * 0.32, pr * 0.16, -0.5, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    this.dirty = true;
  }

  // -1 = empty/blocked, otherwise the owning team.
  ownerAt(x, z) {
    const i = Math.floor((x + HALF_W) / CELL), j = Math.floor((z + HALF_H) / CELL);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) return -1;
    const c = this.owner[j * this.gw + i];
    return c === 1 || c === 2 ? c - 1 : -1;
  }

  // Share of paintable cells inside a circle that belong to `team` (0..1).
  share(x, z, r, team) {
    const gw = this.gw, gh = this.gh, o = this.owner, id = team + 1;
    const cx = (x + HALF_W) / CELL, cz = (z + HALF_H) / CELL, cr = r / CELL;
    const x0 = Math.max(0, Math.floor(cx - cr)), x1 = Math.min(gw - 1, Math.ceil(cx + cr));
    const z0 = Math.max(0, Math.floor(cz - cr)), z1 = Math.min(gh - 1, Math.ceil(cz + cr));
    const r2 = cr * cr;
    let own = 0, all = 0;
    for (let j = z0; j <= z1; j++) {
      const dz = j + 0.5 - cz;
      for (let i = x0; i <= x1; i++) {
        const dx = i + 0.5 - cx;
        if (dx * dx + dz * dz > r2) continue;
        const c = o[j * gw + i];
        if (c === 255) continue;
        all++;
        if (c === id) own++;
      }
    }
    return all ? own / all : 0;
  }

  coverage(team) { return this.count[team] / this.total; }

  // Upload the canvas to the GPU at most ~30x per second.
  update(dt) {
    this.uploadT -= dt;
    if (this.dirty && this.uploadT <= 0) {
      this.texture.needsUpdate = true;
      this.dirty = false;
      this.uploadT = 0.033;
    }
  }

  dispose() { this.texture.dispose(); }
}
