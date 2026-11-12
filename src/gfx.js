import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Render pipeline: HDR target -> bloom -> tone mapping. Only colours brighter than 1.0
// bloom, so "glow" materials are simply given colours above 1 (see `glow()`).
export class Gfx {
  constructor(renderer) {
    this.renderer = renderer;
    this.post = true;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.08;
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 0.92);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setSize(w, h, ratio) {
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
  }

  render(scene, camera) {
    if (this.post) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }
}

// A colour scaled until its luminance reaches `target` (>1 means it will bloom).
export function glow(hex, target = 1.25) {
  const c = new THREE.Color(hex);
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  return c.multiplyScalar(Math.max(1, target / Math.max(l, 0.04)));
}

export const glowMat = (hex, target) => new THREE.MeshBasicMaterial({ color: glow(hex, target) });

// Soft radial sprite used for halos, muzzle flashes and lamp glows.
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glowSprite(hex, size, opacity = 0.9, target = 1.1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: glow(hex, target), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

const NO_FLASH = { value: 0 };
// Adds a soft rim light and a white "hit flash" to a lit material.
export function addRim(mat, flash = NO_FLASH, strength = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = flash;
    sh.uniforms.uRim = { value: strength };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash;\nuniform float uRim;')
      .replace('#include <opaque_fragment>', `
        float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 2.4) * uRim;
        outgoingLight += diffuseColor.rgb * rimF * 0.5 + vec3(0.30, 0.42, 0.85) * rimF * 0.22;
        outgoingLight = mix(outgoingLight, vec3(1.7, 1.7, 1.6), uFlash);
        #include <opaque_fragment>`);
  };
  return mat;
}

// Canvas helper for procedural textures.
export function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}
