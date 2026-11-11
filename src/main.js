import * as THREE from 'three';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import { Match } from './game.js';
import { MenuScene, MenuUI, ResultUI, makeThumbs, addTrophies } from './menu.js';
import { audio } from './audio.js';
import { t } from './i18n.js';

const params = new URLSearchParams(location.search);

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.hudRoot = document.getElementById('ui');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.thumbs = makeThumbs(this.renderer);
    this.renderer.setClearColor(0x000000, 0);
    this.match = null;
    this.menuScene = new MenuScene();
    this.menuUI = null;
    this.resultUI = null;
    this.heroId = 'riko';
    this.last = performance.now();
    this.quality = { ratio: Math.min(window.devicePixelRatio || 1, 2), slow: 0, shadows: true };
    this.portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
    document.querySelector('#rotate p').textContent = t('rotate');

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    // first touch unlocks audio (browser autoplay rules)
    window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    this.resize();

    if (params.get('start')) this.startMatch(params.get('hero') || 'riko');
    else this.showMenu();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.quality.ratio);
    this.renderer.setSize(w, h, false);
    this.menuScene?.resize();
    this.match?.resize();
  }

  showMenu() {
    this.clear();
    document.body.classList.add('in-menu');
    this.menuUI = new MenuUI(this.hudRoot, this.thumbs, (id) => { this.goFullscreen(); this.startMatch(id); }, (id) => this.menuScene.setHero(id));
  }

  startMatch(heroId) {
    this.clear();
    document.body.classList.remove('in-menu');
    this.heroId = heroId;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.match = new Match(this, heroId, { autoplay: params.get('autoplay') === '1', speed: parseFloat(params.get('speed')) || 1 });
    window.__match = this.match; // handy for debugging in the console
  }

  onMatchEnd(result) {
    const win = result.winner === result.playerTeam;
    const delta = result.winner === null ? 0 : win ? 8 + (result.mvp.isPlayer ? 2 : 0) : -3;
    addTrophies(delta);
    this.match.hud.el.classList.add('faded');
    this.resultUI = new ResultUI(this.hudRoot, result, this.thumbs, delta, () => this.startMatch(this.heroId), () => this.showMenu());
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
    } catch { /* not supported – the CSS rotate hint covers it */ }
  }

  // Keep the frame rate up on weaker phones: first lower the resolution, then drop shadows.
  adaptQuality(dt) {
    const q = this.quality;
    if (!this.match || document.hidden) { q.slow = 0; return; }
    q.slow = dt > 1 / 38 ? q.slow + 1 : Math.max(0, q.slow - 2);
    if (q.slow < 90) return;
    q.slow = 0;
    if (q.ratio > 1) { q.ratio = Math.max(1, q.ratio - 0.5); this.resize(); }
    else if (q.shadows) { q.shadows = false; this.renderer.shadowMap.enabled = false; this.match.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.portrait.matches) return; // paused behind the "rotate your phone" overlay
    this.adaptQuality(dt);
    if (this.match) {
      this.match.update(dt);
      this.match.render(this.renderer);
    } else {
      this.menuScene.update(dt);
      this.menuScene.render(this.renderer);
    }
  }
}

window.__app = new App();
