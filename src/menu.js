import * as THREE from 'three';
import { HEROES, heroById } from './heroes.js';
import { TEAM_COLORS, TEAM_CSS } from './config.js';
import { buildSky } from './world.js';
import { glow } from './gfx.js';
import { t, tr } from './i18n.js';
import { audio } from './audio.js';
import { view } from './view.js';

const store = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage may be unavailable */ } },
};
export const getTrophies = () => parseInt(store.get('dc_trophies', '0'), 10) || 0;
export const addTrophies = (n) => { const v = Math.max(0, getTrophies() + n); store.set('dc_trophies', String(v)); return v; };

// Head crop of the hero artwork, used on cards and in the score table.
const faceImg = (h) => `<img src="${h.art}" alt="${h.name}" draggable="false" style="width:${h.face?.[0] ?? 250}%;top:${h.face?.[1] ?? -6}%" />`;

// Backdrop behind the menu: dusk sky, skyline and drifting paint drops.
export class MenuScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0a24);
    buildSky(this.scene);
    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 400);
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
    this.o = new THREE.Object3D();
    this.t = 0;
    this.resize();
  }

  resize() {
    this.camera.aspect = view.w / view.h;
    this.camera.updateProjectionMatrix();
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
  }

  render(gfx) { gfx.render(this.scene, this.camera); }
}

const SKILL_ICON = { passive: '◆', attack: '●', ability: '⚡', ult: '★' };

// DOM for the hero select screen.
export class MenuUI {
  constructor(root, onPlay) {
    this.selected = heroById(store.get('dc_hero', 'jaro')).id;
    this.el = document.createElement('div');
    this.el.className = 'menu';
    this.el.innerHTML = `
      <div class="m-stage">
        <div class="m-head">
          <div class="logo"><span class="l1">DRIP</span><span class="l2">CLASH</span></div>
          <div class="chips"><div class="trophies"><i></i><b>${getTrophies()}</b> ${t('trophies')}</div><button class="sound" aria-label="${t('sound')}"></button><button class="figbtn"></button></div>
          <div class="rot-hint">${t('rotate')}</div>
        </div>
        <div class="m-art"><div class="art-glow"></div><div class="art-floor"></div><img class="art" alt="" draggable="false" /></div>
      </div>
      <div class="m-info"></div>
      <div class="m-cards">${HEROES.map((h) => `<button class="card" data-id="${h.id}" style="--hc:${h.color}" aria-label="${h.name}">${faceImg(h)}</button>`).join('')}</div>
      <button class="play">${t('play')}<small>3 vs 3 · 3:00</small></button>`;
    root.appendChild(this.el);
    this.info = this.el.querySelector('.m-info');
    this.art = this.el.querySelector('.art');
    this.el.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { audio.unlock(); audio.click(); this.select(c.dataset.id); }));
    this.el.querySelector('.play').addEventListener('click', () => { audio.unlock(); audio.go(); onPlay(this.selected); });
    const snd = this.el.querySelector('.sound');
    const paintSnd = () => snd.classList.toggle('off', !audio.enabled);
    snd.addEventListener('click', () => { audio.unlock(); audio.setEnabled(!audio.enabled); paintSnd(); audio.click(); });
    paintSnd();
    // which figures run around in the match: rigged 3D models or the artwork cut-outs
    const fig = this.el.querySelector('.figbtn');
    const paintFig = () => { fig.textContent = store.get('dc_fig', '3d') === '3d' ? t('fig3d') : t('figArt'); };
    fig.addEventListener('click', () => { audio.unlock(); audio.click(); store.set('dc_fig', store.get('dc_fig', '3d') === '3d' ? 'art' : '3d'); paintFig(); });
    paintFig();
    this.select(this.selected);
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
    const stat = (key, label) => `<div class="stat"><span>${label}</span><div class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= h.stats[key] ? 'on' : ''}"></i>`).join('')}</div></div>`;
    const skill = (key) => `<div class="skill"><i class="sk-${key}">${SKILL_ICON[key]}</i><div><b>${tr(h.desc[key].name)}</b><small>${t(key)}</small><p>${tr(h.desc[key].text)}</p></div></div>`;
    this.info.innerHTML = `
      <div class="role">${tr(h.role)}</div>
      <div class="hname">${h.name}</div>
      <div class="htag">${tr(h.tagline)}</div>
      <div class="stats">${stat('atk', t('statAtk'))}${stat('def', t('statDef'))}${stat('spd', t('statSpd'))}${stat('paint', t('statPaint'))}</div>
      <div class="skills">${skill('passive')}${skill('attack')}${skill('ability')}${skill('ult')}</div>`;
  }

  dispose() { this.el.remove(); }
}

// Result screen shown on top of the frozen match.
export class ResultUI {
  constructor(root, result, trophyDelta, onAgain, onMenu) {
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
