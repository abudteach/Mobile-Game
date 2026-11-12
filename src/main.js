import * as THREE from 'three';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import { Match } from './game.js';
import { MenuScene, MenuUI, ResultUI, addTrophies } from './menu.js';
import { audio } from './audio.js';
import { Gfx } from './gfx.js';
import { view, updateView } from './view.js';

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
    this.heroId = 'jaro';
    this.last = performance.now();
    this.quality = { ratio: Math.min(window.devicePixelRatio || 1, 2), slow: 0, shadows: true };

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    // first touch unlocks audio (browser autoplay rules)
    window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    this.resize();

    if (params.get('models')) this.showModels();
    else if (params.get('start')) this.startMatch(params.get('hero') || 'jaro');
    else this.showMenu();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    updateView();
    this.gfx.setSize(view.w, view.h, this.quality.ratio);
    this.menuScene?.resize();
    this.match?.resize();
  }

  // Debug view (?models=1): all hero models side by side.
  async showModels() {
    const [{ buildHero, animateHero }, { HEROES }] = await Promise.all([import('./models.js'), import('./heroes.js')]);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2650);
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x6a3f8a, 1.15));
    const sun = new THREE.DirectionalLight(0xffe9cc, 2.3); sun.position.set(-6, 14, 8); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, view.w / view.h, 0.1, 100);
    const top = params.get('models') === 'top';
    cam.position.set(0, top ? 17.6 : 7, top ? 12 : 22); cam.lookAt(0, top ? 0 : 1.2, top ? -0.6 : 0);
    const list = HEROES.map((h, i) => { const m = buildHero(h, i % 2); m.root.position.set((i % 5 - 2) * 3.6 + (i < 5 ? 0.9 : -0.9), 0, i < 5 ? -3 : 2.4); scene.add(m.root); return m; });
    let t = 0;
    this.menuScene = { resize() {}, update: (dt) => { t += dt; for (const m of list) animateHero(m, t, dt, { moving: params.get('walk') ? 1 : 0, kick: 0, dir: params.get('walk') ? t * 0.8 : 0.9, vx: Math.sin(t * 0.8) }); }, render: (gfx) => gfx.render(scene, cam) };
  }

  showMenu() {
    this.clear();
    document.body.classList.add('in-menu');
    this.menuUI = new MenuUI(this.hudRoot, (id) => { this.goFullscreen(); this.startMatch(id); });
  }

  startMatch(heroId) {
    this.clear();
    document.body.classList.remove('in-menu');
    this.heroId = heroId;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.match = new Match(this, heroId, { autoplay: params.get('autoplay') === '1', speed: parseFloat(params.get('speed')) || 1, comp: params.get('comp') });
    window.__match = this.match; // handy for debugging in the console
  }

  onMatchEnd(result) {
    const win = result.winner === result.playerTeam;
    const delta = result.winner === null ? 0 : win ? 8 + (result.mvp.isPlayer ? 2 : 0) : -3;
    addTrophies(delta);
    this.match.hud.el.classList.add('faded');
    this.resultUI = new ResultUI(this.hudRoot, result, delta, () => this.startMatch(this.heroId), () => this.showMenu());
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
    q.slow = dt > 1 / 38 ? q.slow + 1 : Math.max(0, q.slow - 2);
    if (q.slow < 90) return;
    q.slow = 0;
    if (q.ratio > 1.5) { q.ratio = 1.5; this.resize(); }
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
