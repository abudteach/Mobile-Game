import * as THREE from 'three';
import { HEROES, heroById } from './heroes.js';
import { buildHero, prepHero, animateHero, toon } from './models.js';
import { TEAM_COLORS, TEAM_CSS } from './config.js';
import { t, tr } from './i18n.js';
import { audio } from './audio.js';

const store = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage may be unavailable */ } },
};
export const getTrophies = () => parseInt(store.get('dc_trophies', '0'), 10) || 0;
export const addTrophies = (n) => { const v = Math.max(0, getTrophies() + n); store.set('dc_trophies', String(v)); return v; };

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xe6ecff, 0x55407a, 1.35));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
  sun.position.set(-4, 8, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const c = sun.shadow.camera;
  c.left = -4; c.right = 4; c.top = 5; c.bottom = -3; c.near = 1; c.far = 25;
  sun.shadow.bias = -0.002;
  scene.add(sun);
}

// Renders a small portrait of every hero once, for the selection cards.
export function makeThumbs(renderer) {
  const out = {};
  const scene = new THREE.Scene();
  lights(scene);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const prevRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(192, 192, false);
  renderer.setClearColor(0x000000, 0);
  for (const def of HEROES) {
    const m = prepHero(buildHero(def.id, 0));
    animateHero(m, 0.3, 0.016, { moving: 0, kick: 0 });
    m.root.rotation.y = 0.45;
    scene.add(m.root);
    const box = new THREE.Box3().setFromObject(m.root);
    const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const top = box.max.y;
    cam.position.set(mid.x + 0.6, top - size.y * 0.25, mid.z + size.y * 2.1);
    cam.lookAt(mid.x, top - size.y * 0.36, mid.z);
    renderer.render(scene, cam);
    out[def.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(m.root);
  }
  renderer.setPixelRatio(prevRatio);
  return out;
}

// The 3D part of the main menu: the selected hero on a paint-splattered podium.
export class MenuScene {
  constructor() {
    this.scene = new THREE.Scene();
    lights(this.scene);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60);
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.15, 0.36, 40), toon(0x2f2a6e));
    podium.position.y = -0.18;
    podium.receiveShadow = true;
    this.scene.add(podium);
    const top = new THREE.Mesh(new THREE.CircleGeometry(1.86, 40), toon(0x3b3690));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.005;
    top.receiveShadow = true;
    this.scene.add(top);
    const splats = [[-0.7, 0.5, 0.75, 0], [0.8, -0.3, 0.6, 1], [0.2, 0.9, 0.42, 1], [-0.3, -0.9, 0.5, 0], [1.1, 0.7, 0.3, 0]];
    for (const [x, z, r, team] of splats) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team] }));
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.012 + team * 0.002, z);
      this.scene.add(s);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.02, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffe36b }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.model = null;
    this.t = 0;
    this.pop = 0;
    this.spin = 0;
    this.resize();
  }

  setHero(id) {
    if (this.model) this.pivot.remove(this.model.root);
    this.model = prepHero(buildHero(id, 0));
    this.model.root.scale.multiplyScalar(1.08);
    this.pivot.add(this.model.root);
    this.pop = 1;
  }

  resize() {
    const a = window.innerWidth / window.innerHeight;
    this.camera.aspect = a;
    this.camera.position.set(0, 2.5, a < 1.4 ? 13 : 10.5);
    this.camera.lookAt(0, 1.25, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    this.pop = Math.max(0, this.pop - dt * 3);
    this.pivot.rotation.y = Math.sin(this.t * 0.7) * 0.55 + 0.15;
    if (this.model) {
      animateHero(this.model, this.t, dt, { moving: 0, kick: this.pop });
      const s = 1 + Math.sin(this.pop * Math.PI) * 0.12;
      this.pivot.scale.set(s, s, s);
    }
  }

  render(renderer) { renderer.render(this.scene, this.camera); }
}

const SKILL_ICON = { attack: '●', ability: '⚡', ult: '★' };

// DOM for the hero select screen.
export class MenuUI {
  constructor(root, thumbs, onPlay, onSelect) {
    this.selected = heroById(store.get('dc_hero', 'riko')).id;
    this.onSelect = onSelect;
    this.el = document.createElement('div');
    this.el.className = 'menu';
    this.el.innerHTML = `
      <div class="menu-left">
        <div class="logo"><span class="l1">DRIP</span><span class="l2">CLASH</span></div>
        <div class="tagline">${t('tagline')}</div>
        <div class="chips"><div class="trophies"><i></i><b>${getTrophies()}</b> ${t('trophies')}</div><button class="sound" aria-label="${t('sound')}"></button></div>
        <div class="howto"><div>${t('tip1')}</div><div>${t('tip2')}</div><div>${t('tip3')}</div></div>
      </div>
      <div class="menu-right"></div>
      <div class="menu-bottom">
        <div class="cards">${HEROES.map((h) => `
          <button class="card" data-id="${h.id}" style="--hc:${h.color}">
            <img src="${thumbs[h.id]}" alt="${h.name}" draggable="false" />
            <span>${h.name}</span>
          </button>`).join('')}
        </div>
        <button class="play">${t('play')}</button>
      </div>`;
    root.appendChild(this.el);
    this.info = this.el.querySelector('.menu-right');
    this.el.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { audio.unlock(); audio.click(); this.select(c.dataset.id); }));
    this.el.querySelector('.play').addEventListener('click', () => { audio.unlock(); audio.go(); onPlay(this.selected); });
    const snd = this.el.querySelector('.sound');
    const paintSnd = () => snd.classList.toggle('off', !audio.enabled);
    snd.addEventListener('click', () => { audio.unlock(); audio.setEnabled(!audio.enabled); paintSnd(); audio.click(); });
    paintSnd();
    this.select(this.selected);
  }

  select(id) {
    this.selected = id;
    store.set('dc_hero', id);
    const h = heroById(id);
    this.el.querySelectorAll('.card').forEach((c) => c.classList.toggle('on', c.dataset.id === id));
    const stat = (key, label) => `<div class="stat"><span>${label}</span><div class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= h.stats[key] ? 'on' : ''}"></i>`).join('')}</div></div>`;
    const skill = (key) => `<div class="skill"><i class="sk-${key}">${SKILL_ICON[key]}</i><div><b>${tr(h.desc[key].name)}</b><small>${t(key)}</small><p>${tr(h.desc[key].text)}</p></div></div>`;
    this.info.style.setProperty('--hc', h.color);
    this.info.innerHTML = `
      <div class="role">${tr(h.role)}</div>
      <div class="hname">${h.name}</div>
      <div class="htag">${tr(h.tagline)}</div>
      <div class="stats">${stat('atk', t('statAtk'))}${stat('def', t('statDef'))}${stat('spd', t('statSpd'))}${stat('paint', t('statPaint'))}</div>
      <div class="skills">${skill('attack')}${skill('ability')}${skill('ult')}</div>`;
    this.onSelect(id);
  }

  dispose() { this.el.remove(); }
}

// Result screen shown on top of the frozen match.
export class ResultUI {
  constructor(root, result, thumbs, trophyDelta, onAgain, onMenu) {
    const win = result.winner === result.playerTeam, draw = result.winner === null;
    const p = result.playerTeam;
    const c0 = (result.cov[p] * 100).toFixed(1), c1 = (result.cov[1 - p] * 100).toFixed(1);
    const sum = result.cov[0] + result.cov[1] || 1;
    const rows = (team) => result.stats.filter((s) => s.team === team).sort((a, b) => b.score - a.score).map((s) => `
      <div class="row ${s.isPlayer ? 'me' : ''}">
        <img src="${thumbs[s.hero]}" alt="" /><span class="nm">${s.name}${s === result.mvp ? ` <em>${t('mvp')}</em>` : ''}</span>
        <span>${s.kills}</span><span>${s.deaths}</span><span>${s.painted}</span><span>${s.dmg}</span>
      </div>`).join('');
    const head = `<div class="row head"><span></span><span class="nm"></span><span>${t('kills')}</span><span>${t('deaths')}</span><span>${t('painted')}</span><span>${t('damage')}</span></div>`;
    this.el = document.createElement('div');
    this.el.className = `result ${draw ? 'draw' : win ? 'win' : 'lose'}`;
    this.el.innerHTML = `
      <div class="res-card">
        <div class="res-title">${draw ? t('draw') : win ? t('victory') : t('defeat')}</div>
        <div class="res-sub">${result.reason === 'core' ? t('coreDown') : t('byPaint')}</div>
        <div class="res-bar"><div style="width:${(result.cov[p] / sum) * 100}%;background:${TEAM_CSS[p]}"><b>${c0}%</b></div><div style="background:${TEAM_CSS[1 - p]}"><b>${c1}%</b></div></div>
        <div class="tables">
          <div class="table" style="--tc:${TEAM_CSS[p]}">${head}${rows(p)}</div>
          <div class="table" style="--tc:${TEAM_CSS[1 - p]}">${head}${rows(1 - p)}</div>
        </div>
        <div class="res-foot">
          <div class="trophies"><i></i><b>${trophyDelta >= 0 ? '+' : ''}${trophyDelta}</b> ${t('trophies')}</div>
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
