import * as THREE from 'three';
import { HEROES, heroById, WEAPON_SKINS, skinById } from './heroes.js';
import { TEAM_COLORS, TEAM_CSS } from './config.js';
import { buildSky } from './world.js';
import { buildHero, animateHero, hasModel } from './models.js';
import { glow } from './gfx.js';
import { t, tr } from './i18n.js';
import { audio } from './audio.js';
import { view } from './view.js';
import { store, getCoins, addCoins, ownedSkins, ownSkin, equippedSkin, equipSkin } from './store.js';

export const getTrophies = () => parseInt(store.get('dc_trophies', '0'), 10) || 0;
export const addTrophies = (n) => { const v = Math.max(0, getTrophies() + n); store.set('dc_trophies', String(v)); return v; };

// Head crop of the hero artwork, used on cards and in the score table.
const faceImg = (h) => `<img src="${h.art}" alt="${h.name}" draggable="false" style="width:${h.face?.[0] ?? 250}%;top:${h.face?.[1] ?? -6}%" />`;

// Backdrop behind the menu (dusk sky, skyline, drifting paint drops) plus the 3D hero viewer.
export class MenuScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0a24);
    buildSky(this.scene);
    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 400);
    this.scene.add(this.camera, new THREE.HemisphereLight(0xe6ecff, 0x8a6aa8, 1.4));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.1);
    sun.position.set(-4, 8, 14);
    this.scene.add(sun);
    const N = 34;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
    this.seed = [];
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.seed.push({ x: (Math.random() - 0.5) * 70, y: Math.random() * 30 - 6, z: -14 - Math.random() * 40, s: 0.15 + Math.random() * 0.55, v: 0.4 + Math.random() * 1.2, p: Math.random() * 6 });
      this.drops.setColorAt(i, col.copy(glow(TEAM_COLORS[i % 2], 1.0)));
    }
    this.drops.frustumCulled = false;
    this.scene.add(this.drops);
    // viewer: the hero's 3D model on a small podium, fixed in front of the camera
    this.holder = new THREE.Group();
    this.holder.visible = false;
    this.camera.add(this.holder);
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0x3b3690, roughness: 0.6 }));
    podium.position.y = -0.1;
    this.holder.add(podium);
    this.model = null;
    this.spin = 0.5;
    this.o = new THREE.Object3D();
    this.t = 0;
    this.resize();
  }

  // Show (or hide) the 3D model of a hero in the viewer.
  showHero(def, on) {
    if (this.model) this.holder.remove(this.model.root);
    this.model = null;
    this.holder.visible = !!on && hasModel(def);
    if (!this.holder.visible) return;
    this.model = buildHero(def, 0, '3d');
    this.holder.add(this.model.root);
  }

  rotate(d) { this.spin += d; }
  attack() { this.model?.trigger('Attack'); }

  resize() {
    this.camera.aspect = view.w / view.h;
    this.camera.updateProjectionMatrix();
    const depth = 9, halfH = Math.tan((24 * Math.PI) / 180) * depth, halfW = halfH * this.camera.aspect;
    this.holder.position.set(-0.24 * halfW, -halfH * 0.66, -depth);
    this.holder.scale.setScalar(halfH * 0.5);
  }

  update(dt) {
    this.t += dt;
    this.camera.position.set(Math.sin(this.t * 0.07) * 3, 3, 12);
    this.camera.lookAt(Math.sin(this.t * 0.05) * 6, 9, -40);
    for (let i = 0; i < this.seed.length; i++) {
      const d = this.seed[i];
      d.y -= d.v * dt;
      if (d.y < -8) d.y = 26;
      this.o.position.set(d.x + Math.sin(this.t * 0.6 + d.p) * 0.6, d.y, d.z);
      this.o.scale.set(d.s, d.s * 1.35, d.s);
      this.o.updateMatrix();
      this.drops.setMatrixAt(i, this.o.matrix);
    }
    this.drops.instanceMatrix.needsUpdate = true;
    if (this.model) animateHero(this.model, this.t, dt, { moving: 0, dir: this.spin });
  }

  render(gfx) { gfx.render(this.scene, this.camera); }
}

const SKILL_ICON = { passive: '◆', attack: '●', ability: '⚡', ult: '★' };

// DOM for the hero select screen, the weapon shop and the "how to play" card.
export class MenuUI {
  constructor(root, scene, onPlay) {
    this.scene = scene;
    this.viewer = false;
    this.selected = heroById(store.get('dc_hero', 'kio')).id;
    this.el = document.createElement('div');
    this.el.className = 'menu';
    this.el.innerHTML = `
      <div class="m-stage">
        <div class="m-head">
          <div class="logo"><span class="l1">DRIP</span><span class="l2">CLASH</span></div>
          <div class="chips"><div class="trophies"><i></i><b>${getTrophies()}</b></div><div class="trophies coins"><i></i><b class="coin-n">${getCoins()}</b></div><button class="sound" aria-label="${t('sound')}"></button></div>
          <div class="chips"><button class="mbtn shopbtn">${t('weapons')}</button><button class="mbtn viewbtn">${t('view3d')}</button><button class="mbtn helpbtn">?</button></div>
          <div class="chips"><button class="figbtn"></button></div>
          <div class="rot-hint">${t('rotate')}</div>
        </div>
        <div class="m-art"><div class="art-glow"></div><div class="art-floor"></div><img class="art" alt="" draggable="false" /><div class="view-hint">${t('viewHint')}</div></div>
      </div>
      <div class="m-info"></div>
      <div class="m-cards">${HEROES.map((h) => `<button class="card" data-id="${h.id}" style="--hc:${h.color}" aria-label="${h.name}">${faceImg(h)}</button>`).join('')}</div>
      <button class="play">${t('play')}<small>3 vs 3 · 3:00</small></button>
      <div class="overlay"></div>`;
    root.appendChild(this.el);
    const q = (sel) => this.el.querySelector(sel);
    this.info = q('.m-info');
    this.art = q('.art');
    this.overlay = q('.overlay');
    this.el.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { audio.unlock(); audio.click(); this.select(c.dataset.id); }));
    q('.play').addEventListener('click', () => { audio.unlock(); audio.go(); onPlay(this.selected); });
    const snd = q('.sound');
    const paintSnd = () => snd.classList.toggle('off', !audio.enabled);
    snd.addEventListener('click', () => { audio.unlock(); audio.setEnabled(!audio.enabled); paintSnd(); audio.click(); });
    paintSnd();
    // which figures run around in the match: the artwork cut-outs or the rigged 3D models
    const fig = q('.figbtn');
    const paintFig = () => { fig.textContent = `${t('inMatch')}: ${store.get('dc_fig', 'art') === '3d' ? t('fig3d') : t('figArt')}`; };
    fig.addEventListener('click', () => { audio.unlock(); audio.click(); store.set('dc_fig', store.get('dc_fig', 'art') === '3d' ? 'art' : '3d'); paintFig(); });
    paintFig();
    q('.shopbtn').addEventListener('click', () => { audio.unlock(); audio.click(); this.openShop(); });
    q('.helpbtn').addEventListener('click', () => { audio.unlock(); audio.click(); this.openHelp(); });
    q('.viewbtn').addEventListener('click', () => { audio.unlock(); audio.click(); this.setViewer(!this.viewer); });
    // drag to turn the 3D model, tap to make it attack
    const stage = q('.m-art');
    let drag = null;
    stage.addEventListener('pointerdown', (e) => { if (!this.viewer) return; drag = { x: e.clientX, y: e.clientY, moved: 0 }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const d = view.rot ? e.clientY - drag.y : e.clientX - drag.x;
      drag.moved += Math.abs(d); drag.x = e.clientX; drag.y = e.clientY;
      this.scene.rotate(d * 0.012);
    });
    const end = () => { if (drag && drag.moved < 6) this.scene.attack(); drag = null; };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', () => { drag = null; });
    this.select(this.selected);
    if (store.get('dc_help', '0') !== '1') { store.set('dc_help', '1'); this.openHelp(); }
  }

  setViewer(on) {
    this.viewer = on;
    this.el.classList.toggle('viewing', on);
    this.el.querySelector('.viewbtn').textContent = on ? t('viewArt') : t('view3d');
    this.scene.showHero(heroById(this.selected), on);
  }

  select(id) {
    this.selected = id;
    store.set('dc_hero', id);
    const h = heroById(id);
    this.el.style.setProperty('--hc', h.color);
    this.el.querySelectorAll('.card').forEach((c) => c.classList.toggle('on', c.dataset.id === id));
    this.art.src = h.art;
    this.art.classList.remove('pop');
    void this.art.offsetWidth; // restart the pop animation
    this.art.classList.add('pop');
    if (this.viewer) this.scene.showHero(h, true);
    const stat = (key, label) => `<div class="stat"><span>${label}</span><div class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= h.stats[key] ? 'on' : ''}"></i>`).join('')}</div></div>`;
    const skill = (key) => `<div class="skill"><i class="sk-${key}">${SKILL_ICON[key]}</i><div><b>${tr(h.desc[key].name)}</b><small>${t(key)}</small><p>${tr(h.desc[key].text)}</p></div></div>`;
    const skin = skinById(equippedSkin(id));
    this.info.innerHTML = `
      <div class="role">${tr(h.role)}</div>
      <div class="hname">${h.name}</div>
      <div class="htag">${tr(h.tagline)}</div>
      <div class="wline"><b>${tr(h.weapon)}</b><span>${skin.id === 'std' ? '' : tr(skin.name)}</span></div>
      <div class="stats">${stat('atk', t('statAtk'))}${stat('def', t('statDef'))}${stat('spd', t('statSpd'))}${stat('paint', t('statPaint'))}</div>
      <div class="skills">${skill('passive')}${skill('attack')}${skill('ability')}${skill('ult')}</div>`;
  }

  closeOverlay() { this.overlay.classList.remove('show'); this.overlay.innerHTML = ''; }

  // Weapon skins for the selected hero: buy with coins, then equip.
  openShop() {
    const h = heroById(this.selected);
    const draw = () => {
      const owned = ownedSkins(), eq = equippedSkin(h.id), coins = getCoins();
      this.el.querySelector('.coin-n').textContent = coins;
      this.overlay.innerHTML = `
        <div class="ov-card">
          <div class="ov-head"><b>${t('weapons')} · ${h.name}</b><div class="trophies coins"><i></i><b>${coins}</b></div><button class="ov-x" aria-label="close">✕</button></div>
          <p class="ov-sub"><b>${tr(h.weapon)}</b> – ${t('skinNote')}</p>
          <div class="skins">${WEAPON_SKINS.map((s) => {
            const has = owned.includes(s.id), on = eq === s.id;
            const btn = on ? `<span class="sk-on">${t('equipped')}</span>` : has ? `<button class="sk-btn" data-eq="${s.id}">${t('equip')}</button>` : `<button class="sk-btn buy" data-buy="${s.id}" ${coins < s.price ? 'disabled' : ''}><i></i>${s.price}</button>`;
            return `<div class="skin ${on ? 'on' : ''}"><div class="sw sw-${s.style || h.shot}" style="--sc:#${(s.color ?? 0x18d6ff).toString(16).padStart(6, '0')}"></div><b>${tr(s.name)}</b>${btn}</div>`;
          }).join('')}</div>
        </div>`;
      this.overlay.querySelector('.ov-x').addEventListener('click', () => { audio.click(); this.closeOverlay(); this.select(h.id); });
      this.overlay.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
        const s = skinById(b.dataset.buy);
        if (getCoins() < s.price) return;
        addCoins(-s.price); ownSkin(s.id); equipSkin(h.id, s.id); audio.levelUp(); draw();
      }));
      this.overlay.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => { equipSkin(h.id, b.dataset.eq); audio.click(); draw(); }));
    };
    this.overlay.classList.add('show');
    draw();
  }

  openHelp() {
    const rows = ['help1', 'help2', 'help3', 'help4', 'help5'].map((k, i) => `<div class="help-row"><i>${i + 1}</i><p>${t(k)}</p></div>`).join('');
    this.overlay.innerHTML = `<div class="ov-card"><div class="ov-head"><b>${t('helpTitle')}</b><button class="ov-x" aria-label="close">✕</button></div>${rows}<button class="play ov-ok">${t('gotIt')}</button></div>`;
    this.overlay.classList.add('show');
    const close = () => { audio.click(); this.closeOverlay(); };
    this.overlay.querySelector('.ov-x').addEventListener('click', close);
    this.overlay.querySelector('.ov-ok').addEventListener('click', close);
  }

  dispose() { this.scene.showHero(null, false); this.el.remove(); }
}

// Result screen shown on top of the frozen match.
export class ResultUI {
  constructor(root, result, trophyDelta, coins, onAgain, onMenu) {
    const win = result.winner === result.playerTeam, draw = result.winner === null;
    const p = result.playerTeam;
    const c0 = (result.cov[p] * 100).toFixed(1), c1 = (result.cov[1 - p] * 100).toFixed(1);
    const sum = result.cov[0] + result.cov[1] || 1;
    const rows = (team) => result.stats.filter((s) => s.team === team).sort((a, b) => b.score - a.score).map((s) => `
      <div class="row ${s.isPlayer ? 'me' : ''}">
        <span class="face" style="--hc:${heroById(s.hero).color}">${faceImg(heroById(s.hero))}</span><span class="nm">${s.name}${s === result.mvp ? ` <em>${t('mvp')}</em>` : ''}</span>
        <span>${s.kills}</span><span>${s.deaths}</span><span>${s.painted}</span><span>${s.dmg}</span>
      </div>`).join('');
    const head = `<div class="row head"><span></span><span class="nm"></span><span>${t('kills')}</span><span>${t('deaths')}</span><span>${t('painted')}</span><span>${t('damage')}</span></div>`;
    const me = result.stats.find((s) => s.isPlayer);
    this.el = document.createElement('div');
    this.el.className = `result ${draw ? 'draw' : win ? 'win' : 'lose'}`;
    this.el.innerHTML = `
      <img class="res-art" src="${heroById(me.hero).art}" alt="" draggable="false" />
      <div class="res-card">
        <div class="res-title">${draw ? t('draw') : win ? t('victory') : t('defeat')}</div>
        <div class="res-sub">${result.reason === 'core' ? t('coreDown') : t('byPaint')}</div>
        <div class="res-bar"><div style="width:${(result.cov[p] / sum) * 100}%;background:${TEAM_CSS[p]}"><b>${c0}%</b></div><div style="background:${TEAM_CSS[1 - p]}"><b>${c1}%</b></div></div>
        <div class="tables">
          <div class="table" style="--tc:${TEAM_CSS[p]}">${head}${rows(p)}</div>
          <div class="table" style="--tc:${TEAM_CSS[1 - p]}">${head}${rows(1 - p)}</div>
        </div>
        <div class="res-foot">
          <div class="trophies"><i></i><b>${trophyDelta >= 0 ? '+' : ''}${trophyDelta}</b> ${t('trophies')}</div><div class="trophies coins"><i></i><b>+${coins}</b> ${t('coins')}</div>
          <button class="btn2 menu-btn">${t('menu')}</button>
          <button class="play again">${t('again')}</button>
        </div>
      </div>`;
    root.appendChild(this.el);
    this.el.querySelector('.again').addEventListener('click', () => { audio.go(); onAgain(); });
    this.el.querySelector('.menu-btn').addEventListener('click', () => { audio.click(); onMenu(); });
  }

  dispose() { this.el.remove(); }
}
