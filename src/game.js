import * as THREE from 'three';
import {
  HALF_W, HALF_H, TEAM_COLORS, TEAM_CSS, MATCH_TIME, WAVE_INTERVAL, MAX_LEVEL,
  SPAWN, CORE_POS, TOWER_POS, BOT_NAMES,
} from './config.js';
import { Paint } from './paint.js';
import { buildArena, resolveCollisions, steer, segBox, pointInBox, clearLine, BOXES } from './world.js';
import { buildHero, animateHero, buildMinion, buildTower, buildCore, buildTurret, buildWell } from './models.js';
import { HEROES, heroById, TALENTS, TALENT_LEVELS } from './heroes.js';
import { Fx } from './fx.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { initAI, updateAI } from './ai.js';
import { audio } from './audio.js';
import { t, tr } from './i18n.js';
import { view } from './view.js';
import { glow, glowMat, glowSprite, bubbleMat } from './gfx.js';

const HERO_R = 0.6;
const TOWER_RANGE = 10;
const LEVEL_BONUS = 0.05; // +5% hp and damage per level
const SHIELD_R = 6; // radius of the paint zone that feeds a structure's shield
const v3 = new THREE.Vector3();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const xpNeed = (level) => 70 + level * 45;

function makeBar(w, color, h = 0.2) {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x120f26, depthTest: false, transparent: true, opacity: 0.85 }));
  bg.scale.set(w + 0.12, h + 0.12, 1);
  bg.renderOrder = 10;
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false }));
  fill.scale.set(w, h, 1);
  fill.renderOrder = 11;
  g.add(bg, fill);
  return { g, set(f) { f = Math.max(0.001, Math.min(1, f)); fill.scale.x = w * f; fill.center.x = 0.5 / f; } };
}

function makeLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(3.2, 0.8, 1);
  sprite.renderOrder = 12;
  return {
    sprite,
    draw(name, level, color) {
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, 256, 64);
      c.font = '700 30px Fredoka, system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 7; c.strokeStyle = '#17132f'; c.lineJoin = 'round';
      const text = name;
      const w = c.measureText(text).width;
      c.strokeText(text, 128 + 18, 34);
      c.fillStyle = '#fff';
      c.fillText(text, 128 + 18, 34);
      const bx = 128 + 18 - w / 2 - 26;
      c.fillStyle = '#17132f';
      c.beginPath(); c.arc(bx, 32, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(bx, 32, 16, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#17132f';
      c.font = '700 24px Fredoka, system-ui, sans-serif';
      c.fillText(String(level), bx, 34);
      tex.needsUpdate = true;
    },
  };
}

export class Match {
  constructor(app, heroId, opts = {}) {
    this.app = app;
    this.opts = opts;
    this.autoplay = !!opts.autoplay;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 240);
    this.paint = new Paint();
    this.arena = buildArena(this.scene, this.paint);
    this.fx = new Fx(this.scene);
    this.input = new Input(app.hudRoot);
    this.hud = new Hud(app.hudRoot, this.input.buttons);

    this.time = 0;
    this.left = MATCH_TIME;
    this.state = 'countdown';
    this.count = 3.6;
    this.lastCount = 4;
    this.heroes = []; this.minions = []; this.structures = []; this.projectiles = []; this.lobs = []; this.zones = []; this.timers = [];
    this.targets = [[], []];
    this.kills = [0, 0];
    this.waveT = 3;
    this.wave = 0;
    this.shareT = 0;
    this.hudT = 0;
    this.miniT = 0;
    this.result = null;
    this.endT = 0;
    this.annT = 0;
    this.lastMinuteSaid = false;

    this.projGeo = new THREE.SphereGeometry(0.24, 10, 8);
    this.projMat = TEAM_COLORS.map((c) => glowMat(c, 1.5));
    this.zoneGeo = new THREE.CircleGeometry(1, 40);
    this.ringGeo = new THREE.RingGeometry(0.93, 1, 48);

    this.buildStructures();
    this.buildWells();
    this.colliders = [...this.structures, ...this.wells]; // round things units walk around
    this.buildHeroes(heroById(heroId));
    this.buildAim();
    this.cam = { x: this.player.x, z: this.player.z };
    this.hud.tips([t('tip1'), t('tip4'), t('tip3')]);
    this.resize();
  }

  // ------------------------------------------------------------------ setup
  buildStructures() {
    this.towers = []; this.cores = [];
    for (let team = 0; team < 2; team++) {
      for (const kind of ['tower', 'core']) {
        const pos = kind === 'tower' ? TOWER_POS[team] : CORE_POS[team];
        const model = kind === 'tower' ? buildTower(team) : buildCore(team);
        model.root.position.set(pos.x, 0, pos.z);
        if (kind === 'tower') model.turret.rotation.y = team === 0 ? Math.PI / 2 : -Math.PI / 2;
        this.scene.add(model.root);
        const maxHp = kind === 'tower' ? 18000 : 20000;
        const s = { kind, team, x: pos.x, z: pos.z, radius: kind === 'tower' ? 1.75 : 2.2, hp: maxHp, maxHp, alive: true, fireT: 1, model, enemyShare: 0, flash: 0, aggro: null, aggroT: 0 };
        s.bar = makeBar(3.2, TEAM_COLORS[team], 0.26);
        s.bar.g.position.set(pos.x, model.height + 0.7, pos.z);
        this.scene.add(s.bar.g);
        // paint zone marker + shield bubble
        const zone = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: 0.3, depthWrite: false }));
        zone.rotation.x = -Math.PI / 2;
        zone.scale.setScalar(SHIELD_R);
        zone.position.set(pos.x, 0.05, pos.z);
        this.scene.add(zone);
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(s.radius + 1.3, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), bubbleMat(TEAM_COLORS[team], 0.8));
        bubble.scale.y = kind === 'tower' ? 2.2 : 1.6;
        bubble.position.set(pos.x, 0, pos.z);
        this.scene.add(bubble);
        s.zone = zone; s.bubble = bubble;
        this.paint.block(pos.x, pos.z, s.radius * 1.5, s.radius * 1.5);
        this.structures.push(s);
        (kind === 'tower' ? this.towers : this.cores)[team] = s;
      }
    }
  }

  // Paint wells: two neutral objectives. Paint most of the ring to own a well; an owned well
  // sprays your colour around, adds a blob to your waves and speeds up your team's ults.
  buildWells() {
    this.wells = [-12.5, 12.5].map((z) => {
      const model = buildWell();
      model.root.position.set(0, 0, z);
      this.scene.add(model.root);
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.scale.setScalar(3.6);
      ring.position.set(0, 0.05, z);
      this.scene.add(ring);
      this.paint.block(0, z, 1.6, 1.6);
      return { kind: 'well', alive: true, x: 0, z, r: 3.6, radius: 1.3, owner: -1, team: -1, share: [0, 0], spoutT: 2, model, ring };
    });
  }

  wellsOwned(team) { let n = 0; for (const w of this.wells) if (w.owner === team) n++; return n; }

  updateWells(dt, recalc) {
    for (const w of this.wells) {
      if (recalc && this.state === 'play') {
        for (let team = 0; team < 2; team++) {
          w.share[team] = this.paint.share(w.x, w.z, w.r, team);
          if (w.owner === team || w.share[team] < 0.6) continue;
          const lost = w.owner === this.player.team;
          w.owner = w.team = team;
          w.spoutT = 1;
          const col = glow(TEAM_COLORS[team], 1.3);
          w.model.liquid.material.color.copy(col);
          w.ring.material.color.set(TEAM_COLORS[team]);
          w.ring.material.opacity = 0.8;
          this.fx.ring(w.x, w.z, 6, TEAM_COLORS[team], 0.7);
          this.fx.splash(w.x, 1.2, w.z, TEAM_COLORS[team], 30, 9);
          if (team === this.player.team) { this.announce(t('wellWon'), '#6bff8a', t('wellBonus')); audio.levelUp(); }
          else if (lost) { this.announce(t('wellLost'), '#ff5d6c'); audio.death(); }
        }
      }
      w.model.liquid.position.y = 0.42 + Math.sin(this.time * 3 + w.z) * 0.04;
      w.model.jet.scale.y = w.owner >= 0 ? 1 + Math.sin(this.time * 6) * 0.15 : 0.35;
      if (w.owner < 0 || this.state !== 'play') continue;
      w.spoutT -= dt;
      if (w.spoutT <= 0) {
        w.spoutT = 5;
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * 6.28, r = 4 + Math.random() * 5;
          this.lob(w, w.x + Math.cos(a) * r, w.z + Math.sin(a) * r, { time: 0.9, dmg: 140, radius: 1.9, paintR: 2.2, size: 0.4 });
        }
      }
    }
  }

  buildHeroes(playerDef) {
    const allies = [playerDef, ...shuffle(HEROES.filter((h) => h !== playerDef)).slice(0, 2)];
    let enemies = shuffle(HEROES).slice(0, 3);
    if (this.opts.comp) { const d = heroById(this.opts.comp); allies.fill(d); enemies = [d, d, d]; }
    const names = shuffle(BOT_NAMES);
    const lanes = [[0, -12.5, 12.5], [0, -12.5, 12.5]]; // mid, top well, bottom well
    let n = 0;
    for (let team = 0; team < 2; team++) {
      for (let slot = 0; slot < 3; slot++) {
        const def = (team === 0 ? allies : enemies)[slot];
        const isPlayer = team === 0 && slot === 0;
        const h = {
          kind: 'hero', def, team, slot, isPlayer, name: isPlayer ? t('you') : names[n++],
          x: SPAWN[team].x, z: SPAWN[team].z + (slot - 1) * 2.2, radius: HERO_R,
          dir: team === 0 ? Math.PI / 2 : -Math.PI / 2, vx: 0, vz: 0,
          hp: def.hp, maxHp: def.hp, level: 1, xp: 0,
          ammo: def.ammo, reload: 0, cd: 0, ult: 0, fireLock: 0, aimHold: 0,
          alive: true, respawn: 0, shield: 0, slowT: 0, slowF: 1, kx: 0, kz: 0,
          dash: null, spin: null, spray: null, sinceHit: 9,
          mod: { dmg: 1, hp: 1, speed: 1, reload: 1, paint: 1, cdr: 1, vamp: 0, ult: 1 }, talents: [], offer: null,
          hasteT: 0, barrier: 0, guardCd: 0, auraT: 0, shots: 0, cdMax: def.ability.cd, turret: null, walk: 0, kick: 0, moving: 0,
          kills: 0, deaths: 0, painted: 0, dmgDone: 0, streak: 0, streakT: 0,
          cmd: { mx: 0, mz: 0 }, animT: Math.random() * 10,
        };
        h.model = buildHero(def, team);
        h.model.root.position.set(h.x, 0, h.z);
        this.scene.add(h.model.root);
        // team ring on the ground
        const ring = new THREE.Mesh(new THREE.RingGeometry(isPlayer ? 0.72 : 0.78, 0.98, 32), new THREE.MeshBasicMaterial({ color: isPlayer ? 0xffffff : TEAM_COLORS[team], transparent: true, opacity: 0.9, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.renderOrder = 2;
        this.scene.add(ring);
        h.ring = ring;
        if (isPlayer) {
          const inner = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 32), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: 0.9, depthWrite: false }));
          ring.add(inner);
        }
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), bubbleMat(0xffffff, 0.65));
        bubble.visible = false;
        this.scene.add(bubble);
        h.bubble = bubble;
        // overhead UI
        h.ui = new THREE.Group();
        h.bar = makeBar(1.9, isPlayer ? 0x6bff8a : TEAM_COLORS[team]);
        h.bar.g.position.y = 0;
        h.label = makeLabel();
        h.label.sprite.position.y = 0.55;
        h.ui.add(h.bar.g, h.label.sprite);
        if (isPlayer) {
          h.ammoBar = makeBar(1.9, 0xffb52e, 0.12);
          h.ammoBar.g.position.y = -0.3;
          h.ui.add(h.ammoBar.g);
        }
        this.scene.add(h.ui);
        h.label.draw(h.name, 1, TEAM_CSS[team]);
        initAI(h, lanes[team][slot]);
        if (isPlayer) this.player = h;
        this.heroes.push(h);
      }
    }
    // the web font may arrive after the first draw
    document.fonts?.ready.then(() => { for (const h of this.heroes) h.label.draw(h.name, h.level, TEAM_CSS[h.team]); });
  }

  buildAim() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const g = this.aimG = new THREE.Group();
    g.visible = false;
    g.position.y = 0.09;
    const lineGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);
    this.aimLine = new THREE.Mesh(lineGeo, mat);
    this.aimDisc = new THREE.Mesh(this.zoneGeo, mat);
    this.aimDisc.rotation.x = -Math.PI / 2;
    this.aimRing = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    this.aimRing.rotation.x = -Math.PI / 2;
    this.aimCones = {};
    g.add(this.aimLine, this.aimDisc, this.aimRing);
    for (const m of g.children) m.renderOrder = 4;
    this.aimMat = mat;
    this.scene.add(g);
  }

  cone(spread) {
    const key = spread.toFixed(2);
    if (!this.aimCones[key]) {
      const geo = new THREE.CircleGeometry(1, 20, Math.PI / 2 - spread, spread * 2).rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, this.aimMat);
      m.renderOrder = 4;
      this.aimG.add(m);
      this.aimCones[key] = m;
    }
    return this.aimCones[key];
  }

  resize() {
    this.camera.aspect = view.w / view.h;
    this.camera.updateProjectionMatrix();
    // pull the camera back on narrow screens so the lane stays readable
    this.camZoom = Math.max(1, Math.min(1.7, 1.75 / this.camera.aspect));
  }

  // ------------------------------------------------------------------ helpers used by heroes.js
  after(delay, fn) { this.timers.push({ t: delay, fn }); }
  dmgOf(h, base) { return h.kind === 'hero' ? base * (1 + LEVEL_BONUS * (h.level - 1)) * h.mod.dmg : base; }
  maxHpOf(h) { return Math.round(h.def.hp * (1 + LEVEL_BONUS * (h.level - 1)) * h.mod.hp); }
  addUlt(h, v) { h.ult = Math.min(1, h.ult + v * h.mod.ult * (1 + 0.2 * this.wellsOwned(h.team))); }
  // crowd control goes through these two so "unstoppable" heroes can ignore it
  slow(u, time, factor) { if (u.kind !== 'hero' || u.def.passive.unstoppable) return; u.slowT = Math.max(u.slowT, time); u.slowF = factor; }
  knock(u, kx, kz) { if (u.kind !== 'hero' || u.def.passive.unstoppable) return; u.kx += kx; u.kz += kz; }
  canDamage(s) { return s.kind !== 'core' || !this.towers[s.team].alive; }
  near(x, z, r = 20) { return Math.hypot(x - this.cam.x, z - this.cam.z) < r; }

  alliesNear(s, team, r) {
    let n = 0;
    for (const m of this.minions) if (m.alive && m.team === team && dist(m, s) < r) n++;
    return n;
  }

  paintBy(owner, x, z, r, team) {
    const hero = owner && owner.kind === 'hero';
    const gained = this.paint.paint(x, z, hero ? r * owner.mod.paint : r, team);
    if (gained && hero) { owner.painted += gained; this.addUlt(owner, gained * 0.0011); }
    return gained;
  }

  shoot(h, o) {
    if (!h.alive && !o.from) return;
    const side = o.side || 0, ox = o.from ? o.from.x : h.x, oz = o.from ? o.from.z : h.z;
    let px = ox + o.dx * 0.7 + o.dz * side, pz = oz + o.dz * 0.7 - o.dx * side;
    if (pointInBox(px, pz, 0.1)) { px = ox; pz = oz; }
    const mesh = new THREE.Mesh(this.projGeo, this.projMat[h.team]);
    const s = o.size || 1;
    mesh.scale.set(s, s, s * 1.6);
    mesh.rotation.y = Math.atan2(o.dx, o.dz);
    mesh.position.set(px, 1, pz);
    mesh.add(this.halo(h.team, 2.1));
    this.scene.add(mesh);
    if (h.kind === 'hero' && !o.from) this.fx.flash(px, 1.1, pz, TEAM_COLORS[h.team], 1.2);
    this.projectiles.push({
      owner: h, team: h.team, x: px, z: pz, dx: o.dx, dz: o.dz, speed: o.speed, range: o.range, dist: 0,
      dmg: this.dmgOf(h, o.dmg), dmgMinion: o.dmgMinion, hitR: o.hitR || 0.3, paintR: o.paintR, trailR: o.trailR || 0, trail: 0.3,
      slow: o.slow || null, ramp: o.ramp || 0, healAllies: o.healAllies || 0, healed: o.healAllies ? new Set([h]) : null,
      pierce: !!o.pierce, knock: o.knock || 0, hit: o.hitSet || (o.pierce ? new Set() : null), homing: o.homing || null, mesh,
    });
  }

  // additive glow sprite that follows a projectile
  halo(team, size) {
    const s = glowSprite(TEAM_COLORS[team], size, 0.3, 0.7);
    return s;
  }

  dash(h, dx, dz, distance, dur, o) {
    h.dash = { dx, dz, speed: distance / dur, t: dur, hit: new Set(), o, trail: 0 };
    h.dir = Math.atan2(dx, dz);
    h.aimHold = dur;
  }

  startSpin(h, dur) { h.spin = { t: dur, acc: 0, ang: Math.random() * 6 }; }

  // Tailwind: the caster and allies around them move and reload faster for a while.
  haste(h, radius, time) {
    for (const a of this.heroes) if (a.team === h.team && a.alive && dist(a, h) < radius) { a.hasteT = time; this.fx.ring(a.x, a.z, 1.8, 0xffffff, 0.4); }
    this.fx.ring(h.x, h.z, radius, 0xcdbcff, 0.5);
  }

  // Deployable turret. It lives in the blob list, so towers and blobs treat it like a blob.
  addTurret(h, x, z, o) {
    x = Math.max(-HALF_W + 1, Math.min(HALF_W - 1, x)); z = Math.max(-HALF_H + 1, Math.min(HALF_H - 1, z));
    if (pointInBox(x, z, 0.7)) { x = h.x; z = h.z; }
    if (h.turret && h.turret.alive) h.turret.alive = false;
    const model = buildTurret(h.team);
    const hp = Math.round(o.hp * (1 + LEVEL_BONUS * (h.level - 1)));
    const tu = { kind: 'minion', pet: true, owner: h, team: h.team, x, z, radius: 0.6, hp, maxHp: hp, alive: true, life: o.dur, fireT: 0.4, o, model, flash: 0, target: null };
    tu.bar = makeBar(1.1, TEAM_COLORS[h.team], 0.12);
    model.root.add(tu.bar.g);
    tu.bar.g.position.y = 1.9;
    model.root.position.set(x, 0, z);
    this.scene.add(model.root);
    this.minions.push(tu);
    h.turret = tu;
    this.paintBy(h, x, z, 1.6, h.team);
    this.fx.ring(x, z, 1.8, TEAM_COLORS[h.team], 0.4);
  }

  updateTurret(tu, dt) {
    tu.life -= dt;
    if (tu.life <= 0) { tu.alive = false; this.fx.splash(tu.x, 0.6, tu.z, TEAM_COLORS[tu.team], 10, 5); return; }
    let best = null, bd = tu.o.range;
    for (const u of this.targets[1 - tu.team]) {
      if (u.kind !== 'hero' && u.kind !== 'minion' && !this.canDamage(u)) continue;
      const d = dist(tu, u) - u.radius;
      if (d < bd && clearLine(tu.x, tu.z, u.x, u.z)) { bd = d; best = u; }
    }
    tu.fireT -= dt;
    if (best) {
      const dx = best.x - tu.x, dz = best.z - tu.z, d = Math.hypot(dx, dz) || 1;
      tu.model.head.rotation.y = Math.atan2(dx, dz);
      if (tu.fireT <= 0) {
        tu.fireT = tu.o.rate;
        this.shoot(tu.owner, { from: tu, dx: dx / d, dz: dz / d, speed: 20, range: tu.o.range + 1, dmg: tu.o.dmg, paintR: 0.95, trailR: 0.55, size: 0.8 });
      }
    } else tu.model.head.rotation.y += dt * 1.5;
    tu.bar.set(tu.hp / tu.maxHp);
  }

  // Sustained stream of shots inside a cone (the hero keeps facing that way and is tougher meanwhile).
  spray(h, dx, dz, dur, spread, o) { h.spray = { t: dur, acc: 0, base: Math.atan2(dx, dz), spread, o }; h.aimHold = dur; }

  burst(h, x, z, radius, dmg, o = {}) {
    const team = h.team;
    for (const u of this.targets[1 - team]) {
      const d = Math.hypot(u.x - x, u.z - z);
      if (d > radius + u.radius) continue;
      this.damage(u, this.dmgOf(h, dmg), h);
      if (u.kind === 'hero' && u.alive) {
        if (o.knock) { const k = o.knock / (d || 1); this.knock(u, (u.x - x) * k, (u.z - z) * k); }
        if (o.slow) this.slow(u, o.slow, o.slowF || 0.6);
      }
    }
    this.paintBy(h, x, z, o.paintR || radius, team);
    this.fx.ring(x, z, radius, TEAM_COLORS[team], 0.5);
    this.fx.splash(x, 0.5, z, TEAM_COLORS[team], 26, 8);
    if (this.near(x, z)) { this.fx.addShake(0.5); audio.boom(0.8); }
  }

  lob(h, tx, tz, o) {
    tx = Math.max(-HALF_W + 1, Math.min(HALF_W - 1, tx));
    tz = Math.max(-HALF_H + 1, Math.min(HALF_H - 1, tz));
    const mesh = new THREE.Mesh(this.projGeo, this.projMat[h.team]);
    mesh.scale.setScalar((o.size || 0.6) / 0.24);
    this.scene.add(mesh);
    const marker = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: TEAM_COLORS[h.team], transparent: true, opacity: 0.9, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(tx, 0.08, tz);
    marker.scale.setScalar(o.radius);
    this.scene.add(marker);
    this.lobs.push({ owner: h, sx: h.x, sz: h.z, tx, tz, t: 0, time: o.time, o, mesh, marker });
  }

  beam(h, dx, dz, range, width, dmg) {
    let len = range;
    for (const b of BOXES) { const tt = segBox(h.x, h.z, h.x + dx * range, h.z + dz * range, b, 0); if (tt >= 0) len = Math.min(len, tt * range); }
    const ex = Math.max(-HALF_W, Math.min(HALF_W, h.x + dx * len)), ez = Math.max(-HALF_H, Math.min(HALF_H, h.z + dz * len));
    len = Math.hypot(ex - h.x, ez - h.z);
    for (const u of this.targets[1 - h.team]) {
      const along = (u.x - h.x) * dx + (u.z - h.z) * dz;
      if (along < 0 || along > len + u.radius) continue;
      const perp = Math.abs((u.x - h.x) * dz - (u.z - h.z) * dx);
      if (perp < width / 2 + u.radius) this.damage(u, this.dmgOf(h, dmg), h);
    }
    for (let d = 1; d <= len; d += 0.9) this.paintBy(h, h.x + dx * d, h.z + dz * d, 0.95, h.team);
    this.fx.beam(h.x + dx * 0.6, h.z + dz * 0.6, ex, ez, width, TEAM_COLORS[h.team]);
    this.fx.splash(ex, 0.8, ez, TEAM_COLORS[h.team], 12, 6);
  }

  addZone(z) {
    z.x = Math.max(-HALF_W + 1, Math.min(HALF_W - 1, z.x));
    z.z = Math.max(-HALF_H + 1, Math.min(HALF_H - 1, z.z));
    z.team = z.owner.team; z.t = 0; z.acc = z.tick;
    const color = z.type === 'heal' || z.type === 'bloom' ? 0x7dffa8 : z.type === 'trap' ? 0xffb02e : TEAM_COLORS[z.team];
    z.mesh = new THREE.Mesh(this.zoneGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
    z.mesh.rotation.x = -Math.PI / 2;
    z.mesh.scale.setScalar(z.r);
    z.mesh.position.set(z.x, 0.1, z.z);
    z.mesh.renderOrder = 3;
    z.edge = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    z.edge.position.z = 0.01;
    z.mesh.add(z.edge);
    this.scene.add(z.mesh);
    if (z.type !== 'rain') this.paintBy(z.owner, z.x, z.z, z.r * 0.92, z.team);
    this.zones.push(z);
  }

  // ------------------------------------------------------------------ actions
  fire(h, aim) {
    if (!h.alive || h.ammo < 1 || h.fireLock > 0 || h.dash) return false;
    h.ammo--;
    h.fireLock = 0.22;
    h.dir = Math.atan2(aim.dx, aim.dz);
    h.aimHold = 0.4;
    h.kick = 1;
    h.def.attack(this, h, aim);
    if (h.isPlayer) audio.shoot(1); else if (this.near(h.x, h.z, 16)) audio.shoot(0.35);
    return true;
  }

  useAbility(h, aim) {
    if (!h.alive || h.cd > 0 || h.dash) return false;
    h.cd = h.cdMax = h.def.ability.cd * h.mod.cdr;
    if (h.def.ability.aim !== 'self') { h.dir = Math.atan2(aim.dx, aim.dz); h.aimHold = 0.4; }
    h.kick = 1;
    h.def.ability.use(this, h, aim);
    if (this.near(h.x, h.z, 16)) audio.ability();
    return true;
  }

  useUlt(h, aim) {
    if (!h.alive || h.ult < 1 || h.dash) return false;
    h.ult = 0;
    if (h.def.ult.aim !== 'self') { h.dir = Math.atan2(aim.dx, aim.dz); h.aimHold = 0.5; }
    h.kick = 1.5;
    this.fx.ring(h.x, h.z, 3, 0xffffff, 0.4);
    this.fx.splash(h.x, 1.2, h.z, 0xffffff, 14, 6);
    h.def.ult.use(this, h, aim);
    if (this.near(h.x, h.z, 20)) audio.ult();
    if (h.isPlayer) this.fx.addShake(0.35);
    return true;
  }

  // Pick a target for tap-to-fire: heroes first, then blobs, then structures.
  autoAim(h, range) {
    let best = null, bestScore = 1e9;
    for (const u of this.targets[1 - h.team]) {
      if (u.kind !== 'hero' && u.kind !== 'minion' && !this.canDamage(u)) continue;
      const d = dist(h, u) - u.radius;
      if (d > range + 0.6) continue;
      if (!clearLine(h.x, h.z, u.x, u.z)) continue;
      const score = d + (u.kind === 'hero' ? 0 : u.kind === 'minion' ? 4 : 7);
      if (score < bestScore) { bestScore = score; best = u; }
    }
    if (best) {
      let dx = best.x - h.x, dz = best.z - h.z;
      const d = Math.hypot(dx, dz) || 1;
      if (best.kind === 'hero') { const tt = d / h.def.projSpeed; dx += best.vx * tt * 0.7; dz += best.vz * tt * 0.7; }
      const l = Math.hypot(dx, dz) || 1;
      return { dx: dx / l, dz: dz / l, dist: Math.min(l, range) };
    }
    return { dx: Math.sin(h.dir), dz: Math.cos(h.dir), dist: range * 0.7 };
  }

  screenToGround(sx, sy) {
    v3.set((sx / view.w) * 2 - 1, -(sy / view.h) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position;
    const dy = v3.y - o.y;
    if (dy >= -1e-4) return null;
    const k = -o.y / dy;
    return { x: o.x + (v3.x - o.x) * k, z: o.z + (v3.z - o.z) * k };
  }

  rangeOf(h, type) { return type === 'fire' ? h.def.range : h.def[type].range; }

  playerCommands(h) {
    const inp = this.input;
    const actions = inp.poll();
    h.cmd.mx = inp.move.x; h.cmd.mz = inp.move.z;
    let mouseAim = null;
    if (inp.mouse.seen) {
      const p = this.screenToGround(inp.mouse.x, inp.mouse.y);
      if (p) { const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz) || 1; mouseAim = { dx: dx / d, dz: dz / d, dist: d }; }
    }
    for (const a of actions) {
      if (a.type === 'talent') { if (h.offer && a.i < h.offer.options.length) this.pickTalent(h, a.i); continue; }
      const range = this.rangeOf(h, a.type);
      let aim;
      if (a.aimed) aim = { dx: a.dx, dz: a.dz, dist: a.mag * range };
      else if (a.mouse && mouseAim) aim = { ...mouseAim, dist: Math.min(mouseAim.dist, range) };
      else aim = this.autoAim(h, range);
      if (a.type === 'fire') this.fire(h, aim); else if (a.type === 'ability') this.useAbility(h, aim); else this.useUlt(h, aim);
    }
    if (inp.mouse.down && mouseAim) this.fire(h, mouseAim);

    // aim preview
    const g = this.aimG;
    const aiming = inp.aiming;
    g.visible = false;
    if (h.alive && (aiming || (inp.mouse.seen && mouseAim))) {
      const type = aiming ? aiming.type : 'fire';
      const def = h.def;
      const spec = type === 'fire' ? { aim: def.aim.type, width: def.aim.width, spread: def.aim.spread, range: def.range } : { aim: def[type].aim, width: def[type].width, spread: def[type].spread, radius: def[type].radius, range: def[type].range };
      const dx = aiming ? aiming.dx : mouseAim.dx, dz = aiming ? aiming.dz : mouseAim.dz;
      const d = aiming ? aiming.mag * spec.range : Math.min(mouseAim.dist, spec.range);
      g.visible = true;
      g.position.x = h.x; g.position.z = h.z;
      this.aimMat.opacity = aiming ? 0.34 : 0.14;
      for (const c of g.children) c.visible = false;
      const ang = Math.atan2(dx, dz);
      if (spec.aim === 'line') {
        this.aimLine.visible = true;
        this.aimLine.rotation.y = ang;
        this.aimLine.scale.set(spec.width, 1, spec.range);
      } else if (spec.aim === 'cone') {
        const c = this.cone(spec.spread + 0.12);
        c.visible = true;
        c.rotation.y = ang;
        c.scale.setScalar(spec.range);
      } else if (spec.aim === 'area') {
        this.aimDisc.visible = this.aimRing.visible = true;
        this.aimDisc.position.set(dx * d, 0, dz * d);
        this.aimDisc.scale.setScalar(spec.radius);
        this.aimRing.position.set(0, 0, 0);
        this.aimRing.scale.setScalar(spec.range);
      } else {
        this.aimDisc.visible = true;
        this.aimDisc.position.set(0, 0, 0);
        this.aimDisc.scale.setScalar(spec.radius);
      }
    }
  }

  // ------------------------------------------------------------------ damage, kills, xp
  floatText(u, text, cls) {
    v3.set(u.x, u.kind === 'hero' ? 2.6 : 2, u.z).project(this.camera);
    if (v3.z > 1) return;
    this.hud.floater((v3.x * 0.5 + 0.5) * view.w, (-v3.y * 0.5 + 0.5) * view.h, text, cls);
  }

  damage(u, amount, src) {
    if (!u.alive || this.state === 'ended') return 0;
    const owner = src && src.kind === 'hero' ? src : null;
    if (u.kind === 'hero') {
      if (u.shield > 0) return 0;
      if (u.spin || u.spray) amount *= 0.6;
      const pv = u.def.passive;
      if (pv.thickSkin && u.hp < u.maxHp * 0.5) amount *= pv.thickSkin;
      if (u.barrier > 0) {
        const soaked = Math.min(u.barrier, amount);
        u.barrier -= soaked; amount -= soaked; u.sinceHit = 0;
        if (amount < 1) { u.model.flash.value = 0.5; return 0; }
      }
    } else if (u.kind !== 'minion') {
      if (!this.canDamage(u)) {
        if (owner && owner.isPlayer && this.annT <= 0) { this.floatText(u, t('immune'), 'info'); this.annT = 0.6; }
        return 0;
      }
      amount *= 0.25 + 0.75 * u.enemyShare;
      if (owner && u.kind === 'tower') { u.aggro = owner; u.aggroT = 1.6; }
    }
    amount = Math.round(amount);
    u.hp -= amount;
    u.sinceHit = 0;
    u.flash = 0.14;
    if (u.model && u.model.flash) u.model.flash.value = 1;
    if (owner) {
      owner.dmgDone += amount;
      this.addUlt(owner, amount / owner.def.ultCharge);
      if (owner.mod.vamp && owner.alive && (u.kind === 'hero' || u.kind === 'minion')) this.heal(owner, amount * owner.mod.vamp, true);
      if (owner.isPlayer) { this.floatText(u, amount, u.kind === 'hero' ? 'dmg' : 'dmg small'); audio.hit(0.7); }
    }
    if (u.isPlayer) { this.floatText(u, `-${amount}`, 'hurt'); this.fx.addShake(0.12); }
    if (u.hp <= 0) this.kill(u, owner, src);
    else if (u.kind === 'hero' && u.hp < u.maxHp * 0.3) this.guardian(u);
    return amount;
  }

  heal(u, amount, quiet) {
    if (!u.alive || u.hp >= u.maxHp) return;
    amount = Math.round(Math.min(amount, u.maxHp - u.hp));
    u.hp += amount;
    if (u.isPlayer && !quiet && amount > 20) this.floatText(u, `+${amount}`, 'heal');
  }

  // Nimbi's passive: an ally about to go down nearby gets a short shield.
  guardian(u) {
    for (const n of this.heroes) {
      const g = n.def.passive.guardian;
      if (!g || n.team !== u.team || !n.alive || n.guardCd > 0 || dist(n, u) > g.r) continue;
      n.guardCd = g.cd;
      u.shield = g.t;
      this.fx.ring(u.x, u.z, 2.2, 0xcdbcff, 0.5);
      if (u.isPlayer || n.isPlayer) this.floatText(u, t('shielded'), 'info');
      return;
    }
  }

  // Level 3/5/7: choose one of three talents. Bots choose at random; the player gets cards.
  offerTalent(h) {
    if (h.offer) this.pickTalent(h, 0);
    const options = shuffle(TALENTS.filter((x) => !h.talents.includes(x.id))).slice(0, 3);
    h.offer = { options, t: 12 };
    if (h.isPlayer && !this.autoplay) this.hud.talents(options, (i) => this.pickTalent(h, i));
    else this.pickTalent(h, (Math.random() * options.length) | 0);
  }

  pickTalent(h, i) {
    if (!h.offer) return;
    const tl = h.offer.options[i];
    h.offer = null;
    tl.apply(h);
    h.talents.push(tl.id);
    const old = h.maxHp;
    h.maxHp = this.maxHpOf(h);
    if (h.alive) h.hp += h.maxHp - old;
    if (h.isPlayer) { this.hud.talents(null); if (h.alive) this.floatText(h, tr(tl.name), 'lvl'); audio.levelUp(); }
  }

  addXp(h, n) {
    if (h.level >= MAX_LEVEL) return;
    h.xp += n;
    while (h.level < MAX_LEVEL && h.xp >= xpNeed(h.level)) {
      h.xp -= xpNeed(h.level);
      h.level++;
      const old = h.maxHp;
      h.maxHp = this.maxHpOf(h);
      if (h.alive) h.hp = Math.min(h.maxHp, h.hp + (h.maxHp - old) + h.maxHp * 0.15);
      h.label.draw(h.name, h.level, TEAM_CSS[h.team]);
      if (h.alive) { this.fx.ring(h.x, h.z, 2.2, 0xffe36b, 0.5); this.fx.splash(h.x, 1.5, h.z, 0xffe36b, 10, 5); }
      if (h.isPlayer) { this.floatText(h, t('levelUp'), 'lvl'); audio.levelUp(); }
      if (TALENT_LEVELS.includes(h.level)) this.offerTalent(h);
    }
  }

  kill(u, killer, src) {
    u.alive = false;
    u.hp = 0;
    const enemy = 1 - u.team;
    const col = TEAM_COLORS[enemy];
    if (u.kind === 'hero') {
      u.deaths++;
      u.respawn = 4 + u.level * 0.5;
      u.dash = null; u.spin = null; u.spray = null; u.kx = u.kz = 0; u.barrier = 0; u.hasteT = 0;
      for (const h of this.heroes) if (h.team === enemy && h.alive && h.def.passive.resetOnKill && (h === killer || dist(h, u) < 10)) h.cd = 0;
      u.model.root.visible = false; u.ui.visible = false; u.ring.visible = false; u.bubble.visible = false;
      this.kills[enemy]++;
      this.paintBy(killer, u.x, u.z, 2.9, enemy);
      this.fx.splash(u.x, 1, u.z, col, 36, 9);
      this.fx.ring(u.x, u.z, 3.2, col, 0.5);
      if (this.near(u.x, u.z)) { this.fx.addShake(0.45); audio.splat(1); }
      const who = killer ? killer.name : src && src.kind === 'tower' ? t('tower') : 'Blob';
      this.hud.feed(`<b style="color:${TEAM_CSS[enemy]}">${who}</b> ${t('splat')} <b style="color:${TEAM_CSS[u.team]}">${u.name}</b>`);
      if (killer) {
        killer.kills++;
        this.addXp(killer, 90);
        killer.streak = killer.streakT > 0 ? killer.streak + 1 : 1;
        killer.streakT = 7;
        if (killer.isPlayer) {
          audio.kill();
          if (killer.streak === 2) this.announce(t('doubleKill'), '#ffe36b');
          else if (killer.streak >= 3) this.announce(t('tripleKill'), '#ffe36b');
        }
      }
      for (const h of this.heroes) if (h.team === enemy && h !== killer && h.alive && dist(h, u) < 12) this.addXp(h, 60);
      if (u.isPlayer) audio.death();
    } else if (u.kind === 'minion') {
      this.paint.paint(u.x, u.z, 1.25, enemy);
      this.fx.splash(u.x, 0.5, u.z, col, 10, 5);
      for (const h of this.heroes) if (h.team === enemy && h.alive && dist(h, u) < 12) this.addXp(h, h === killer ? 34 : 24);
    } else if (u.kind === 'tower') {
      u.model.root.visible = false; u.bar.g.visible = false; u.zone.visible = false; u.bubble.visible = false;
      this.paint.paint(u.x, u.z, 7.5, enemy);
      this.fx.splash(u.x, 2, u.z, col, 60, 12);
      this.fx.ring(u.x, u.z, 8, col, 0.8);
      this.fx.addShake(1);
      audio.boom(1);
      const mine = u.team === this.player.team;
      this.announce(mine ? t('towerLost') : t('towerDown'), mine ? '#ff5d6c' : '#6bff8a', t('coreOpen'));
      for (const h of this.heroes) if (h.team === enemy) this.addXp(h, 180);
    } else if (u.kind === 'core') {
      u.model.root.visible = false; u.bar.g.visible = false; u.zone.visible = false; u.bubble.visible = false;
      this.paint.paint(u.x, u.z, 10, enemy);
      this.fx.splash(u.x, 2, u.z, col, 90, 14);
      this.fx.ring(u.x, u.z, 11, col, 1);
      this.fx.addShake(1.2);
      audio.boom(1);
      this.finish(enemy, 'core');
    }
  }

  announce(text, color, sub) {
    this.hud.announce(text, color, sub);
  }

  respawnHero(h) {
    h.alive = true;
    h.hp = h.maxHp;
    h.x = SPAWN[h.team].x; h.z = SPAWN[h.team].z + (h.slot - 1) * 2.2;
    h.shield = 2.5;
    h.ammo = h.def.ammo;
    h.sinceHit = 9;
    h.model.root.visible = true; h.ui.visible = true; h.ring.visible = true;
    h.ai.mode = 'push';
    this.fx.ring(h.x, h.z, 2.5, TEAM_COLORS[h.team], 0.5);
  }

  // ------------------------------------------------------------------ per-frame updates
  updateHero(h, dt) {
    const m = h.model;
    if (!h.alive) {
      h.respawn -= dt;
      if (h.respawn <= 0) this.respawnHero(h);
      if (h.isPlayer) { this.input.poll(); this.aimG.visible = false; }
      return;
    }
    if (h.isPlayer && !this.autoplay) this.playerCommands(h); else updateAI(this, h, dt);

    const own = this.paint.ownerAt(h.x, h.z);
    const onOwn = own === h.team, onEnemy = own === 1 - h.team;
    h.cd = Math.max(0, h.cd - dt);
    h.fireLock -= dt; h.aimHold -= dt; h.shield -= dt; h.sinceHit += dt; h.streakT -= dt; h.hasteT -= dt; h.guardCd -= dt;
    const pv = h.def.passive, haste = h.hasteT > 0;
    if (h.ammo < h.def.ammo) {
      h.reload += (dt * (onOwn ? 1.5 : 1) * h.mod.reload * (haste ? 1.4 : 1)) / h.def.reload;
      if (h.reload >= 1) { h.ammo++; h.reload = 0; }
    }
    // healing: fast at base, slow on own paint when out of combat; enemy paint stings
    const base = SPAWN[h.team];
    if (Math.hypot(h.x - base.x, h.z - base.z) < 5) this.heal(h, h.maxHp * 0.3 * dt);
    else if (onOwn && h.sinceHit > 3) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.045 * dt);
    if (onEnemy && h.shield <= 0) h.hp = Math.max(1, h.hp - 40 * dt);
    // passives that tick
    if (pv.barrier) { const max = pv.barrier * (1 + LEVEL_BONUS * (h.level - 1)); if (h.sinceHit > 4) h.barrier = Math.min(max, h.barrier + max * dt); }
    if (pv.aura && (h.auraT -= dt) <= 0) {
      h.auraT = 0.5;
      for (const a of this.heroes) if (a.team === h.team && a.alive && dist(a, h) < pv.aura.r) this.heal(a, pv.aura.heal * 0.5 * (1 + LEVEL_BONUS * (h.level - 1)), true);
    }
    if (h.offer && (h.offer.t -= dt) <= 0) this.pickTalent(h, 0);

    // movement
    const px = h.x, pz = h.z;
    let speed = h.def.speed * h.mod.speed * (onOwn ? (pv.ownSpeed || 1.18) : onEnemy && !pv.unstoppable ? 0.76 : 1) * (haste ? 1.3 : 1);
    if (h.slowT > 0) { h.slowT -= dt; speed *= h.slowF; }
    if (h.dash) {
      const d = h.dash;
      h.x += d.dx * d.speed * dt; h.z += d.dz * d.speed * dt;
      d.t -= dt;
      d.trail += d.speed * dt;
      if (d.trail > 0.7) { d.trail = 0; this.paintBy(h, h.x, h.z, d.o.paintR, h.team); this.fx.splash(h.x, 0.3, h.z, TEAM_COLORS[h.team], 3, 3); }
      for (const u of this.targets[1 - h.team]) {
        if (d.hit.has(u) || dist(h, u) > 1.4 + u.radius) continue;
        d.hit.add(u);
        this.damage(u, this.dmgOf(h, d.o.dmg), h);
      }
      if (d.t <= 0) {
        h.dash = null;
        if (pv.afterDash) h.hasteT = pv.afterDash;
        if (d.o.end) this.burst(h, h.x, h.z, d.o.end.radius, d.o.end.dmg, d.o.end);
        else this.paintBy(h, h.x, h.z, d.o.paintR + 0.4, h.team);
      }
    } else {
      if (h.spin) speed *= 1.25;
      h.x += h.cmd.mx * speed * dt + h.kx * dt;
      h.z += h.cmd.mz * speed * dt + h.kz * dt;
    }
    const decay = Math.exp(-6 * dt);
    h.kx *= decay; h.kz *= decay;
    resolveCollisions(h, this.colliders, !!(h.dash && h.dash.o.fly));
    h.vx = (h.x - px) / dt; h.vz = (h.z - pz) / dt;
    const moved = Math.hypot(h.x - px, h.z - pz);
    const cmdLen = Math.hypot(h.cmd.mx, h.cmd.mz);
    h.moving += ((cmdLen > 0.15 ? 1 : 0) - h.moving) * Math.min(1, dt * 10);
    h.walk += moved;
    if (h.walk > 0.55) { h.walk = 0; this.paintBy(h, h.x, h.z, 0.58, h.team); }

    if (h.spin) {
      const s = h.spin;
      s.t -= dt; s.acc += dt;
      while (s.acc > 0.06) {
        s.acc -= 0.06;
        s.ang += 0.78;
        this.shoot(h, { dx: Math.sin(s.ang), dz: Math.cos(s.ang), speed: 17, range: 6, dmg: 175, paintR: 1.3, trailR: 0.8 });
      }
      if (s.t <= 0) h.spin = null;
    }
    if (h.spray) {
      const s = h.spray;
      s.t -= dt; s.acc += dt;
      h.dir = s.base; h.aimHold = 0.1; h.kick = Math.max(h.kick, 0.5);
      while (s.acc > 0.055) {
        s.acc -= 0.055;
        const ang = s.base + (Math.random() - 0.5) * 2 * s.spread;
        this.shoot(h, { ...s.o, dx: Math.sin(ang), dz: Math.cos(ang) });
      }
      if (s.t <= 0) h.spray = null;
    }

    // facing
    let want = h.dir;
    if (h.aimHold <= 0 && cmdLen > 0.15) want = Math.atan2(h.cmd.mx, h.cmd.mz);
    if (h.aimHold <= 0) h.dir = want;

    h.kick = Math.max(0, h.kick - dt * 5);
    h.animT += dt * (onOwn ? 1.15 : 1);
    animateHero(m, h.animT, dt, { moving: h.moving, kick: Math.min(1, h.kick), dir: h.dir, vx: h.cmd.mx, spin: !!h.spin, clear: this.clearBehind(h), cheer: this.state === 'ended' && this.result && this.result.winner === h.team });
    m.root.position.set(h.x, h.dash ? (h.dash.o.fly ? 1.7 : 0.25) : 0, h.z);
    if (haste && Math.random() < dt * 14) this.fx.splash(h.x, 0.3, h.z, 0xffffff, 1, 2);
    h.ring.position.set(h.x, 0.06, h.z);
    h.ui.position.set(h.x, m.topY + 0.6, h.z + m.topZ);
    h.bar.set(h.hp / h.maxHp);
    if (h.ammoBar) h.ammoBar.set((h.ammo + (h.ammo < h.def.ammo ? h.reload : 0)) / h.def.ammo);
    h.bubble.visible = h.shield > 0 || h.barrier > 1;
    if (h.bubble.visible) { h.bubble.position.set(h.x, 1.3, h.z); h.bubble.material.uniforms.uOpacity.value = h.shield > 0 ? 0.65 : 0.3; }
  }

  // Free space right behind (north of) a hero: figures lean back, so they straighten up next to walls.
  clearBehind(h) {
    let clear = 3;
    for (let d = 0.6; d <= 1.8; d += 0.3) if (pointInBox(h.x, h.z - d, 0.1) || h.z - d < -HALF_H) { clear = d - 0.5; break; }
    for (const s of this.structures) {
      if (!s.alive || s.z > h.z || Math.abs(s.x - h.x) > s.radius + 0.4) continue;
      clear = Math.min(clear, h.z - s.z - s.radius - 0.2);
    }
    return Math.max(0, clear);
  }

  spawnWave() {
    this.wave++;
    for (let team = 0; team < 2; team++) {
      const sign = team === 0 ? 1 : -1;
      const count = 3 + this.wellsOwned(team);
      for (let i = 0; i < count; i++) {
        const model = buildMinion(team);
        const hp = 620 + this.wave * 70;
        const mn = { kind: 'minion', team, x: CORE_POS[team].x + sign * 3.2, z: (i - (count - 1) / 2) * 1.3, radius: 0.45, hp, maxHp: hp, alive: true, atkT: Math.random(), think: Math.random() * 0.3, target: null, walk: 0, t: Math.random() * 6, model, flash: 0 };
        mn.bar = makeBar(0.9, TEAM_COLORS[team], 0.11);
        model.root.add(mn.bar.g);
        mn.bar.g.position.y = 1.25;
        model.root.position.set(mn.x, 0, mn.z);
        this.scene.add(model.root);
        this.minions.push(mn);
      }
    }
  }

  updateMinion(mn, dt) {
    if (mn.pet) { this.updateTurret(mn, dt); return; }
    mn.think -= dt;
    if (mn.think <= 0) {
      mn.think = 0.3;
      let best = null, bd = 6.5;
      for (const u of this.targets[1 - mn.team]) {
        if (u.kind !== 'hero' && u.kind !== 'minion' && !this.canDamage(u)) continue;
        const d = dist(mn, u) - u.radius - (u.kind === 'minion' ? 1 : 0);
        if (d < bd) { bd = d; best = u; }
      }
      mn.target = best;
    }
    const tg = mn.target && mn.target.alive ? mn.target : null;
    const px = mn.x, pz = mn.z;
    const speed = 3.1 * (this.paint.ownerAt(mn.x, mn.z) === mn.team ? 1.15 : 1);
    let moving = false;
    if (tg && dist(mn, tg) - tg.radius < 3.4) {
      mn.atkT -= dt;
      const dx = tg.x - mn.x, dz = tg.z - mn.z, d = Math.hypot(dx, dz) || 1;
      mn.model.root.rotation.y = Math.atan2(dx, dz);
      if (mn.atkT <= 0) {
        mn.atkT = 1.05;
        this.shoot(mn, { dx: dx / d, dz: dz / d, speed: 13, range: d + 0.5, dmg: tg.kind === 'hero' ? 70 : tg.kind === 'minion' ? 95 : 150, paintR: 0.75, size: 0.7 });
      }
    } else {
      const goal = tg || this.cores[1 - mn.team];
      const s = steer(mn, goal.x, goal.z, this.colliders, goal);
      mn.x += s.x * speed * dt; mn.z += s.z * speed * dt;
      mn.model.root.rotation.y = Math.atan2(s.x, s.z);
      moving = true;
    }
    // keep blobs from stacking on each other
    for (const o of this.minions) {
      if (o === mn || !o.alive) continue;
      const dx = mn.x - o.x, dz = mn.z - o.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.81 && d2 > 1e-6) { const d = Math.sqrt(d2), push = (0.9 - d) * 0.5; mn.x += (dx / d) * push; mn.z += (dz / d) * push; }
    }
    resolveCollisions(mn, this.colliders);
    mn.walk += Math.hypot(mn.x - px, mn.z - pz);
    if (mn.walk > 0.7) { mn.walk = 0; this.paint.paint(mn.x, mn.z, 0.6, mn.team); }
    mn.t += dt;
    mn.model.root.position.set(mn.x, 0, mn.z);
    const hop = moving ? Math.abs(Math.sin(mn.t * 9)) : 0;
    mn.model.rig.position.y = hop * 0.18;
    mn.model.rig.scale.set(1 + (1 - hop) * 0.08, 1 - (1 - hop) * 0.08, 1 + (1 - hop) * 0.08);
    mn.bar.set(mn.hp / mn.maxHp);
    mn.bar.g.visible = mn.hp < mn.maxHp;
  }

  updateStructure(s, dt, recalc) {
    if (!s.alive) return;
    if (recalc) s.enemyShare = this.paint.share(s.x, s.z, SHIELD_R, 1 - s.team);
    const open = this.canDamage(s);
    s.bubble.material.uniforms.uOpacity.value = open ? 0.05 + 0.3 * (1 - s.enemyShare) : 0.42;
    s.bubble.rotation.y += dt * 0.4;
    s.bar.set(s.hp / s.maxHp);
    s.flash = Math.max(0, s.flash - dt);
    const pulse = 1 + s.flash * 0.5;
    s.model.root.scale.set(pulse, 1 - s.flash * 0.3, pulse);
    if (s.kind === 'core') {
      s.model.crystal.rotation.y += dt * 0.9;
      s.model.crystal.position.y = 2.7 + Math.sin(this.time * 2) * 0.18;
      s.model.ring.rotation.x = Math.PI / 2 + Math.sin(this.time * 1.3) * 0.5;
      s.model.ring.rotation.y += dt * 1.2;
      s.model.ring2.rotation.x += dt * 1.6;
      return;
    }
    // tower: shoot blobs first, heroes second (classic lane rule)
    let best = null, bd = 1e9;
    for (const u of this.targets[1 - s.team]) {
      if (u.kind !== 'hero' && u.kind !== 'minion') continue;
      if (u.kind === 'hero' && u.shield > 0) continue;
      const d = dist(s, u);
      if (d > TOWER_RANGE) continue;
      const score = d + (u.kind === 'hero' ? 100 : 0);
      if (score < bd) { bd = score; best = u; }
    }
    // no blob to shoot: fire back at a hero who is poking the tower from outside its range
    s.aggroT -= dt;
    if ((!best || best.kind === 'hero') && s.aggroT > 0 && s.aggro.alive && s.aggro.shield <= 0 && dist(s, s.aggro) < TOWER_RANGE + 6) best = s.aggro;
    s.fireT -= dt;
    if (best) {
      const dx = best.x - s.x, dz = best.z - s.z, d = Math.hypot(dx, dz) || 1;
      let diff = Math.atan2(dx, dz) - s.model.turret.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.model.turret.rotation.y += diff * Math.min(1, dt * 10);
      if (s.fireT <= 0) {
        s.fireT = 0.9;
        this.shoot(s, { dx: dx / d, dz: dz / d, speed: 17, range: 14, dmg: best.kind === 'hero' ? 500 : 380, paintR: 0.9, size: 1.2, homing: best });
        if (this.near(s.x, s.z, 14)) audio.shoot(0.3);
      }
    }
    s.model.liquid.scale.setScalar(1 + Math.sin(this.time * 3) * 0.02);
  }

  updateProjectiles(dt) {
    const arr = this.projectiles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      let dead = false;
      if (p.homing && p.homing.alive) {
        const dx = p.homing.x - p.x, dz = p.homing.z - p.z, d = Math.hypot(dx, dz) || 1;
        p.dx = dx / d; p.dz = dz / d;
      }
      const step = p.speed * dt;
      p.x += p.dx * step; p.z += p.dz * step;
      p.dist += step; p.trail += step;
      if (p.trailR && p.trail >= 0.8) { p.trail = 0; this.paintBy(p.owner, p.x, p.z, p.trailR, p.team); }
      if (p.healAllies) {
        for (const f of this.heroes) {
          if (f.team !== p.team || !f.alive || p.healed.has(f) || Math.hypot(f.x - p.x, f.z - p.z) > p.hitR + f.radius) continue;
          p.healed.add(f);
          this.heal(f, this.dmgOf(p.owner, p.healAllies));
          this.fx.ring(f.x, f.z, 1.6, 0x9dffc0, 0.35);
        }
      }
      if (Math.abs(p.x) > HALF_W || Math.abs(p.z) > HALF_H || (!p.homing && pointInBox(p.x, p.z, 0.05))) dead = true;
      else {
        for (const u of this.targets[1 - p.team]) {
          if (p.hit && p.hit.has(u)) continue;
          const dx = u.x - p.x, dz = u.z - p.z, rr = p.hitR + u.radius;
          if (dx * dx + dz * dz > rr * rr) continue;
          this.damage(u, p.ramp ? p.dmg * (p.ramp + (1 - p.ramp) * Math.min(1, p.dist / (p.range * 0.85))) : p.dmg, p.owner);
          if (u.kind === 'hero' && u.alive) {
            if (p.knock) this.knock(u, p.dx * p.knock, p.dz * p.knock);
            if (p.slow) this.slow(u, p.slow.t, p.slow.f);
          }
          if (p.pierce) p.hit.add(u); else { dead = true; break; }
        }
      }
      if (!dead && p.dist >= p.range) dead = true;
      if (dead) {
        this.paintBy(p.owner, Math.max(-HALF_W, Math.min(HALF_W, p.x)), Math.max(-HALF_H, Math.min(HALF_H, p.z)), p.paintR, p.team);
        this.fx.splash(p.x, 0.5, p.z, TEAM_COLORS[p.team], 5, 4);
        this.fx.flash(p.x, 0.6, p.z, TEAM_COLORS[p.team], 1.7);
        if (p.owner.isPlayer) audio.splat(0.5);
        this.scene.remove(p.mesh);
        arr.splice(i, 1);
      } else {
        const k = Math.max(0, (p.dist / p.range - 0.7) / 0.3);
        p.mesh.position.set(p.x, 1 - 0.65 * k * k, p.z);
        if (p.homing) p.mesh.rotation.y = Math.atan2(p.dx, p.dz);
      }
    }

    for (let i = this.lobs.length - 1; i >= 0; i--) {
      const l = this.lobs[i];
      l.t += dt / l.time;
      const k = Math.min(1, l.t);
      l.mesh.position.set(l.sx + (l.tx - l.sx) * k, 1.2 + 22 * k * (1 - k), l.sz + (l.tz - l.sz) * k);
      l.marker.material.opacity = 0.5 + 0.4 * Math.sin(this.time * 24);
      if (k >= 1) {
        this.burst(l.owner, l.tx, l.tz, l.o.radius, l.o.dmg, l.o);
        if (l.o.onLand) l.o.onLand(l.tx, l.tz);
        this.scene.remove(l.mesh, l.marker);
        l.marker.material.dispose();
        this.lobs.splice(i, 1);
      }
    }
  }

  updateZones(dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt; z.acc += dt;
      const col = TEAM_COLORS[z.team];
      if (z.acc >= z.tick) {
        z.acc = 0;
        if (z.heal) {
          for (const h of this.heroes) if (h.team === z.team && h.alive && Math.hypot(h.x - z.x, h.z - z.z) < z.r) this.heal(h, this.dmgOf(z.owner, z.heal));
          for (let k = 0; k < 4; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * z.r; this.fx.splash(z.x + Math.cos(a) * r, 0.3, z.z + Math.sin(a) * r, 0x9dffc0, 1, 4); }
        }
        for (let k = 0; k < (z.paintN || 0); k++) {
          const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * (z.r - 1);
          const x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r;
          this.paintBy(z.owner, x, zz, 1.5, z.team);
          this.fx.splash(x, 0.4, zz, col, 5, 5);
        }
        if (z.dmg) {
          for (const u of this.targets[1 - z.team]) {
            if (Math.hypot(u.x - z.x, u.z - z.z) > z.r + u.radius) continue;
            this.damage(u, this.dmgOf(z.owner, z.dmg), z.owner);
            if (z.slow) this.slow(u, 0.7, z.slow);
          }
        }
      }
      z.mesh.material.opacity = 0.16 + 0.08 * Math.sin(z.t * 8);
      if (z.t >= z.dur) {
        this.scene.remove(z.mesh);
        z.mesh.material.dispose(); z.edge.material.dispose();
        this.zones.splice(i, 1);
      }
    }
  }

  finish(winner, reason) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.endT = 2.6;
    const cov = [this.paint.coverage(0), this.paint.coverage(1)];
    const stats = this.heroes.map((h) => ({ name: h.name, hero: h.def.id, heroName: h.def.name, team: h.team, isPlayer: h.isPlayer, kills: h.kills, deaths: h.deaths, painted: h.painted, dmg: Math.round(h.dmgDone), level: h.level, score: h.kills * 300 + h.painted * 1.2 + h.dmgDone * 0.05 }));
    const mvp = stats.reduce((a, b) => (b.score > a.score ? b : a));
    this.result = { winner, reason, cov, stats, mvp, playerTeam: this.player.team };
    this.input.setEnabled(false);
    this.aimG.visible = false;
    const win = winner === this.player.team;
    this.hud.announce(winner === null ? t('draw') : win ? t('victory') : t('defeat'), winner === null ? '#fff' : win ? '#6bff8a' : '#ff5d6c', reason === 'core' ? t('coreDown') : t('byPaint'));
    audio.stopMusic();
    if (win) audio.win(); else audio.lose();
  }

  update(rawDt) {
    let dt = Math.min(rawDt, 0.05) * (this.opts.speed || 1);
    // big steps (fast-forward in tests) are split so collisions stay stable
    while (dt > 1e-6) {
      const step = Math.min(dt, 1 / 30);
      this.step(step);
      dt -= step;
    }
  }

  step(dt) {
    if (this.state === 'countdown') {
      this.count -= dt;
      const n = Math.ceil(this.count - 0.6);
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n > 0) { this.hud.count(n); audio.count(); }
        else { this.hud.count(t('go')); audio.go(); this.hud.tips([]); }
      }
      if (this.count <= 0) {
        this.state = 'play';
        this.input.setEnabled(true);
        this.hud.announce('');
        audio.startMusic();
      }
      for (const h of this.heroes) { h.animT += dt; animateHero(h.model, h.animT, dt, { moving: 0, kick: 0, dir: h.dir }); h.ring.position.set(h.x, 0.06, h.z); h.ui.position.set(h.x, h.model.topY + 0.6, h.z + h.model.topZ); h.bar.set(1); if (h.ammoBar) h.ammoBar.set(1); }
      for (const s of this.structures) this.updateStructure(s, 0, false);
      this.updateCamera(dt);
      this.arena.update(this.time, this.cam);
      this.updateHud(dt, true);
      return;
    }

    if (this.state === 'ended') {
      dt *= 0.35; // slow motion finish
      this.endT -= dt / 0.35;
      if (this.endT <= 0 && !this.reported) { this.reported = true; this.app.onMatchEnd(this.result); }
    }

    this.time += dt;
    if (this.state === 'play') {
      this.left -= dt;
      if (!this.lastMinuteSaid && this.left <= 60) { this.lastMinuteSaid = true; this.announce(t('lastMinute'), '#ffe36b'); audio.startMusic(true); this.annT = 2; }
      if (this.left <= 0) {
        this.left = 0;
        const c0 = this.paint.count[0], c1 = this.paint.count[1];
        this.finish(c0 === c1 ? null : c0 > c1 ? 0 : 1, 'paint');
      }
      this.waveT -= dt;
      if (this.waveT <= 0) { this.waveT = WAVE_INTERVAL; this.spawnWave(); }
    }
    if (this.annT > 0) { this.annT -= dt; }

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }

    // who can be hit this step
    for (let team = 0; team < 2; team++) {
      const list = this.targets[team];
      list.length = 0;
      for (const h of this.heroes) if (h.team === team && h.alive) list.push(h);
      for (const m of this.minions) if (m.team === team && m.alive) list.push(m);
      for (const s of this.structures) if (s.team === team && s.alive) list.push(s);
    }

    // alternate the update order every step so neither team always paints last
    this.tick = (this.tick || 0) + 1;
    for (let i = 0; i < this.heroes.length; i++) {
      const h = this.heroes[this.tick & 1 ? i : this.heroes.length - 1 - i];
      this.updateHero(h, dt);
      if (this.state === 'play' && h.alive) this.addXp(h, 3 * dt);
    }
    for (const mn of this.minions) if (mn.alive) this.updateMinion(mn, dt);
    this.shareT -= dt;
    const recalc = this.shareT <= 0;
    if (recalc) this.shareT = 0.4;
    for (const s of this.structures) this.updateStructure(s, dt, recalc);
    this.updateWells(dt, recalc);
    this.updateProjectiles(dt);
    this.updateZones(dt);

    if (this.minions.some((m) => !m.alive)) {
      this.minions = this.minions.filter((m) => { if (!m.alive) this.scene.remove(m.model.root); return m.alive; });
    }

    this.fx.update(dt);
    this.paint.update(dt);
    this.updateCamera(dt);
    this.arena.update(this.time, this.cam);
    this.updateHud(dt, false);
  }

  updateCamera(dt) {
    const p = this.player;
    let tx = p.x, tz = p.z;
    if (this.state === 'ended' && this.result.reason === 'core') { const c = this.cores[1 - this.result.winner]; tx = c.x; tz = c.z; }
    tx = Math.max(-HALF_W + 9, Math.min(HALF_W - 9, tx));
    tz = Math.max(-HALF_H + 3, Math.min(HALF_H - 2, tz));
    const k = Math.min(1, dt * 6);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.z += (tz - this.cam.z) * k;
    const intro = this.state === 'countdown' ? Math.max(0, (this.count - 0.6) / 3) : 0;
    const zoom = this.camZoom * (1 + intro * 0.9);
    const sh = this.fx.shake * this.fx.shake * 0.6;
    this.camera.position.set(this.cam.x + (Math.random() - 0.5) * sh, 17.6 * zoom, this.cam.z + 12 * zoom + (Math.random() - 0.5) * sh);
    this.camera.lookAt(this.cam.x, 0, this.cam.z - 0.6);
  }

  updateHud(dt, force) {
    const p = this.player;
    this.hud.setButtons(p);
    this.hud.respawn(p.alive ? 0 : p.respawn);
    this.hudT -= dt;
    if (this.hudT <= 0 || force) {
      this.hudT = 0.15;
      this.hud.setTop(this.paint.coverage(0), this.paint.coverage(1), this.left, this.kills, {
        t0: this.towers[0].hp / this.towers[0].maxHp, c0: this.cores[0].hp / this.cores[0].maxHp,
        t1: this.towers[1].hp / this.towers[1].maxHp, c1: this.cores[1].hp / this.cores[1].maxHp,
      }, this.wells.map((w) => w.owner));
      this.hud.setLevel(p.level, p.level >= MAX_LEVEL ? 1 : p.xp / xpNeed(p.level));
      this.hud.minimap(this.paint.canvas, [...this.structures, ...this.minions, ...this.heroes], p, this.wells);
    }
  }

  render(gfx) { gfx.render(this.scene, this.camera); }

  dispose() {
    audio.stopMusic();
    this.input.dispose();
    this.hud.dispose();
    this.paint.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) { if (m.map && m.map !== this.paint.texture) m.map.dispose(); m.dispose(); } }
    });
  }
}
