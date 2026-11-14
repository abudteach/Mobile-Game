import * as THREE from 'three';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import { Match } from './game.js';
import { MenuScene, MenuUI, ResultUI, addTrophies } from './menu.js';
import { addCoins, equippedSkin } from './store.js';
import { audio } from './audio.js';
import { Gfx, perf } from './gfx.js';
import { view, updateView } from './view.js';
import { HEROES, skinById } from './heroes.js';
import { preloadHeroModels, renderPortrait, hasModel } from './models.js';
import { t } from './i18n.js';

const params = new URLSearchParams(location.search);

class App {
  constructor() {
    updateView();
    this.canvas = document.getElementById('game');
    this.hudRoot = document.getElementById('ui');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x0d0a24, 1);
    this.gfx = new Gfx(this.renderer);
    this.match = null;
    this.menuScene = new MenuScene();
    this.menuUI = null;
    this.resultUI = null;
    this.heroId = 'kio';
    this.last = performance.now();
    this.quality = { ratio: Math.min(window.devicePixelRatio || 1, perf.mobile ? 1.5 : 2), slow: 0, shadows: true };

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    // first touch unlocks audio (browser autoplay rules)
    window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    this.resize();

    this.renderer.setAnimationLoop(() => this.frame());
    this.boot();
  }

  // Load the 3D hero models, then open the menu (or whatever the URL asks for).
  async boot() {
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.innerHTML = `<div class="logo"><span class="l1">DRIP</span><span class="l2">CLASH</span></div><p>${t('loading')}</p>`;
    this.hudRoot.appendChild(loading);
    try { await preloadHeroModels(HEROES); } catch (err) { console.warn('3D models could not be loaded, using artwork figures', err); }
    // heroes without artwork get a portrait rendered from their 3D model
    for (const h of HEROES) if (!h.art && hasModel(h)) h.art = renderPortrait(this.renderer, h);
    this.resize();
    loading.remove();
    if (params.get('models')) this.showModels();
    else if (params.get('start')) this.startMatch(params.get('hero') || 'kio');
    else this.showMenu();
  }

  // 3D models or artwork figures in the match (menu switch, or ?fig=art / ?fig=3d)
  get figures() {
    const forced = params.get('fig');
    if (forced) return forced;
    try { return localStorage.getItem('dc_fig') || 'art'; } catch { return 'art'; }
  }

  resize() {
    updateView();
    this.gfx.setSize(view.w, view.h, this.quality.ratio);
    this.menuScene?.resize();
    this.match?.resize();
  }

  // Debug view (?models=1): all hero models side by side.
  async showModels() {
    const { buildHero, animateHero } = await import('./models.js');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2650);
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x6a3f8a, 1.15));
    const sun = new THREE.DirectionalLight(0xffe9cc, 2.3); sun.position.set(-10, 26, 9); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7fb0ff, 0.9); rim.position.set(8, 10, -14); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(30, view.w / view.h, 0.1, 100);
    const top = params.get('models') === 'top';
    cam.position.set(0, top ? 17.6 : 9, top ? 12 : 27); cam.lookAt(0, top ? 0 : 0.6, top ? -0.6 : 0);
    const list = HEROES.map((h, i) => { const m = buildHero(h, i % 2, this.figures); m.root.position.set((i % 6 - 2.5) * 3.6 + (i < 6 ? 0 : 1.8), 0, i < 6 ? -3.4 : 3.2); scene.add(m.root); return m; });
    const clip = params.get('clip');
    let t = 0;
    this.menuScene = { resize() {}, update: (dt) => { t += dt; for (const m of list) { if (clip && Math.floor(t / 1.2) !== Math.floor((t - dt) / 1.2)) m.trigger?.(clip); animateHero(m, t, dt, { moving: params.get('walk') ? 1 : 0, kick: 0, dir: params.get('walk') ? 0.6 : 0.5, moveAng: 0.6, vx: Math.sin(t * 0.8) }); } }, render: (gfx) => gfx.render(scene, cam) };
  }

  showMenu() {
    this.clear();
    document.body.classList.add('in-menu');
    this.menuUI = new MenuUI(this.hudRoot, this.menuScene, (id) => { this.goFullscreen(); this.startMatch(id); });
  }

  startMatch(heroId) {
    this.clear();
    document.body.classList.remove('in-menu');
    this.heroId = heroId;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.match = new Match(this, heroId, { autoplay: params.get('autoplay') === '1', speed: parseFloat(params.get('speed')) || 1, comp: params.get('comp'), figures: this.figures, skin: skinById(equippedSkin(heroId)) });
    window.__match = this.match; // handy for debugging in the console
  }

  onMatchEnd(result) {
    const win = result.winner === result.playerTeam;
    const delta = result.winner === null ? 0 : win ? 8 + (result.mvp.isPlayer ? 2 : 0) : -3;
    addTrophies(delta);
    const me = result.stats.find((s) => s.isPlayer);
    const coins = (result.winner === null ? 30 : win ? 50 : 20) + me.kills * 5 + Math.floor(me.painted / 800);
    addCoins(coins);
    this.match.hud.el.classList.add('faded');
    this.resultUI = new ResultUI(this.hudRoot, result, delta, coins, () => this.startMatch(this.heroId), () => this.showMenu());
  }

  clear() {
    this.menuUI?.dispose(); this.menuUI = null;
    this.resultUI?.dispose(); this.resultUI = null;
    this.match?.dispose(); this.match = null;
  }

  // Phones: go fullscreen + lock landscape where the platform allows it.
  goFullscreen() {
    if (!matchMedia('(pointer: coarse)').matches) return;
    try {
      const p = document.documentElement.requestFullscreen?.();
      const lock = () => screen.orientation?.lock?.('landscape')?.catch?.(() => {});
      if (p?.then) p.then(lock).catch(() => {}); else lock();
    } catch { /* not supported – view.js turns the stage instead */ }
  }

  // Keep the frame rate up on weaker phones: first lower the resolution, then drop shadows.
  adaptQuality(dt) {
    const q = this.quality;
    if (!this.match || document.hidden) { q.slow = 0; return; }
    q.slow = dt > 1 / 45 ? q.slow + 1 : Math.max(0, q.slow - 1);
    if (q.slow < 40) return;
    q.slow = 0;
    if (!perf.lite) perf.lite = true;
    else if (q.ratio > 1.25) { q.ratio = 1.25; this.resize(); }
    else if (this.gfx.post) { this.gfx.post = false; }
    else if (q.ratio > 1) { q.ratio = 1; this.resize(); }
    else if (q.shadows) { q.shadows = false; this.renderer.shadowMap.enabled = false; this.match.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.adaptQuality(dt);
    if (this.match) {
      this.match.update(dt);
      this.match.render(this.gfx);
    } else {
      this.menuScene.update(dt);
      this.menuScene.render(this.gfx);
    }
  }
}

window.__app = new App();
