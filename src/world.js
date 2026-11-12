import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAP_W, MAP_H, HALF_W, HALF_H, OBSTACLES, SPAWN, TEAM_COLORS, TEAM_CSS } from './config.js';
import { toon } from './models.js';
import { glow, glowMat, glowSprite, addRim, canvasTexture } from './gfx.js';

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x120d2b, side: THREE.BackSide });
const PX = 44; // texture pixels per world unit for cover blocks

// ---------- procedural textures for the cover blocks ----------
function speckle(c, w, h, n, dark = 0.1, light = 0.06) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${dark * Math.random()})` : `rgba(255,255,255,${light * Math.random()})`;
    c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
}

function containerSide(wu, hu, color, label) {
  return canvasTexture(Math.round(wu * PX), Math.round(hu * PX), (c, w, h) => {
    c.fillStyle = color; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 14) {
      c.fillStyle = 'rgba(0,0,0,0.13)'; c.fillRect(x, 0, 7, h);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 7, 0, 2, h);
    }
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 0, w, 7); c.fillRect(0, h - 9, w, 9); c.fillRect(0, 0, 8, h); c.fillRect(w - 8, 0, 8, h);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = `700 ${Math.round(h * 0.42)}px Fredoka, system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, w / 2, h * 0.52);
    speckle(c, w, h, 160);
  });
}

function containerTop(wu, du, color, label) {
  return canvasTexture(Math.round(wu * PX), Math.round(du * PX), (c, w, h) => {
    c.fillStyle = color; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(0, 0, w, h);
    const long = w >= h;
    for (let p = 10; p < (long ? w : h) - 6; p += 16) {
      c.fillStyle = 'rgba(0,0,0,0.12)';
      if (long) c.fillRect(p, 8, 7, h - 16); else c.fillRect(8, p, w - 16, 7);
      c.fillStyle = 'rgba(255,255,255,0.14)';
      if (long) c.fillRect(p + 7, 8, 2, h - 16); else c.fillRect(8, p + 7, w - 16, 2);
    }
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.save();
    c.translate(w / 2, h / 2);
    if (!long) c.rotate(-Math.PI / 2);
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.font = `700 ${Math.round(Math.min(w, h) * 0.5)}px Fredoka, system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, 0, 2);
    c.restore();
    speckle(c, w, h, 200);
  });
}

function crateTex(wu, hu, top) {
  return canvasTexture(Math.round(wu * PX), Math.round(hu * PX), (c, w, h) => {
    c.fillStyle = top ? '#d19a5b' : '#c2854a'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 20) {
      c.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; c.fillRect(0, y, w, 20);
      c.fillStyle = 'rgba(60,30,10,0.5)'; c.fillRect(0, y, w, 2);
    }
    c.strokeStyle = '#8a5527'; c.lineWidth = 16; c.strokeRect(8, 8, w - 16, h - 16);
    c.lineWidth = 12;
    c.beginPath(); c.moveTo(12, 12); c.lineTo(w - 12, h - 12); c.stroke();
    if (top) { c.beginPath(); c.moveTo(w - 12, 12); c.lineTo(12, h - 12); c.stroke(); }
    c.fillStyle = '#5a3415';
    for (const [x, y] of [[9, 9], [w - 9, 9], [9, h - 9], [w - 9, h - 9]]) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
    speckle(c, w, h, 120);
  });
}

function concreteTex(wu, hu, top) {
  return canvasTexture(Math.round(wu * PX), Math.round(hu * PX), (c, w, h) => {
    c.fillStyle = top ? '#aab0c8' : '#9197b0'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 500, 0.16, 0.12);
    if (top) {
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = 'rgba(24,214,255,0.75)'; c.beginPath(); c.arc(w * 0.3, h * 0.5, h * 0.26, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,47,142,0.75)'; c.beginPath(); c.arc(w * 0.7, h * 0.5, h * 0.26, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = `700 ${Math.round(h * 0.4)}px Fredoka, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('VS', w / 2, h / 2 + 2);
    } else {
      const bh = Math.round(h * 0.26);
      c.save(); c.beginPath(); c.rect(0, h - bh, w, bh); c.clip();
      c.fillStyle = '#ffcc33'; c.fillRect(0, h - bh, w, bh);
      c.fillStyle = '#1b1830';
      for (let x = -bh; x < w + bh; x += 30) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 15, h); c.lineTo(x + 15 + bh, h - bh); c.lineTo(x + bh, h - bh); c.fill(); }
      c.restore();
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 0, w, 6);
    }
  });
}

const CONTAINER_COLORS = ['#1fb5ad', '#ff7d3b', '#f7c531', '#7d63f5'];
const LABELS = ['DRIP', 'CLASH', '07', 'GO!'];

function buildCover(scene, o, index) {
  const style = o.x === 0 ? 'concrete' : (o.w >= 5 || o.d >= 5) ? 'container' : 'crate';
  let sideX, sideZ, top;
  if (style === 'container') {
    const k = (o.x < 0 ? 0 : 1) + (o.z < 0 ? 0 : 2);
    const col = CONTAINER_COLORS[(k + (o.w > o.d ? 0 : 1)) % 4], label = LABELS[(k + index) % 4];
    sideX = containerSide(o.d, o.h, col, o.d > o.w ? label : '');
    sideZ = containerSide(o.w, o.h, col, o.w >= o.d ? label : '');
    top = containerTop(o.w, o.d, col, label);
  } else if (style === 'crate') {
    sideX = crateTex(o.d, o.h, false); sideZ = crateTex(o.w, o.h, false); top = crateTex(o.w, o.d, true);
  } else {
    sideX = concreteTex(o.d, o.h, false); sideZ = concreteTex(o.w, o.h, false); top = concreteTex(o.w, o.d, true);
  }
  const mk = (map) => addRim(toon(0xffffff, { map }), undefined, 0.6);
  const mx = mk(sideX), mz = mk(sideZ), mt = mk(top);
  const geo = new RoundedBoxGeometry(o.w, o.h, o.d, 3, 0.2);
  const m = new THREE.Mesh(geo, [mx, mx, mt, mt, mz, mz]);
  m.position.set(o.x, o.h / 2, o.z);
  m.castShadow = true; m.receiveShadow = true;
  const hull = new THREE.Mesh(geo, OUTLINE);
  hull.scale.set(1 + 0.14 / o.w, 1 + 0.14 / o.h, 1 + 0.14 / o.d);
  m.add(hull);
  scene.add(m);
}

// ---------- backdrop used by the menu (sky, skyline) ----------
export function buildSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 14), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec3 d = normalize(vP);
        vec3 c = mix(vec3(1.05, 0.36, 0.30), vec3(0.42, 0.10, 0.52), smoothstep(-0.05, 0.16, d.y));
        c = mix(c, vec3(0.045, 0.03, 0.17), smoothstep(0.10, 0.62, d.y));
        vec2 g = floor(d.xz / max(d.y, 0.05) * 26.0);
        c += vec3(0.9) * step(0.985, h21(g)) * smoothstep(0.25, 0.6, d.y);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(sky);
  // skyline ring
  const tex = canvasTexture(128, 256, (c, w, h) => {
    c.fillStyle = '#140f33'; c.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 6; y += 14) for (let x = 8; x < w - 8; x += 16) {
      const r = Math.random();
      if (r < 0.45) continue;
      c.fillStyle = r < 0.7 ? '#ffd76a' : r < 0.85 ? '#18d6ff' : '#ff6aae';
      c.fillRect(x, y, 9, 7);
    }
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5) });
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, 46);
  const o = new THREE.Object3D();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + Math.random() * 0.1, r = 70 + Math.random() * 45;
    const hh = 14 + Math.random() * 46, w = 8 + Math.random() * 10;
    o.position.set(Math.cos(a) * r, hh / 2 - 22, Math.sin(a) * r);
    o.rotation.y = -a + Math.PI / 2;
    o.scale.set(w, hh, w);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
  }
  scene.add(inst);
  return sky;
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x6a3f8a, 1.15));
  const sun = new THREE.DirectionalLight(0xffe9cc, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 20; sc.bottom = -22; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x7fb0ff, 0.9);
  rim.position.set(8, 10, -14);
  scene.add(rim);
  return sun;
}

// Builds the static arena: painted floor, cover blocks, walls, stands with a crowd, props and lights.
export function buildArena(scene, paint) {
  scene.background = new THREE.Color(0x0d0a24);
  scene.fog = new THREE.Fog(0x0d0a24, 60, 150);
  const sun = addLights(scene);
  const time = { value: 0 };

  // ---- arena floor: asphalt + paint canvas, with a bevel/gloss effect on paint edges ----
  const floorMat = new THREE.MeshStandardMaterial({ map: paint.texture, color: 0xa4a4b6, roughness: 0.82, metalness: 0 });
  floorMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTexel = { value: new THREE.Vector2(1 / paint.canvas.width, 1 / paint.canvas.height) };
    sh.uniforms.uTime = time;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
        uniform vec2 uTexel; uniform float uTime;
        float paintMask(vec2 uv){ vec3 c = texture2D(map, uv).rgb; float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); return smoothstep(0.30, 0.55, s); }
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 pe = uTexel * 1.7;
        float pm = paintMask(vMapUv);
        vec2 pg = vec2(paintMask(vMapUv + vec2(pe.x, 0.0)) - paintMask(vMapUv - vec2(pe.x, 0.0)), paintMask(vMapUv + vec2(0.0, pe.y)) - paintMask(vMapUv - vec2(0.0, pe.y)));
        float bevel = dot(pg, vec2(0.6, -0.8));
        vec3 paintCol = diffuseColor.rgb;
        diffuseColor.rgb *= 1.0 - 0.5 * clamp(-bevel, 0.0, 1.0);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 cell = floor(vMapUv / uTexel / 1.5);
        float spark = step(0.993, h21(cell)) * (0.5 + 0.5 * sin(uTime * 3.0 + h21(cell + 7.0) * 40.0));
        totalEmissiveRadiance += paintCol * pm * 0.1 + vec3(1.0) * (clamp(bevel, 0.0, 1.0) * 0.6 + spark * pm * 0.5);`);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- rooftop platform around the arena ----
  const deckTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#211c45'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 900, 0.2, 0.05);
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 4; c.strokeRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 2; c.strokeRect(4, 4, w - 8, h - 8);
  }, [(MAP_W + 26) / 4, (MAP_H + 30) / 4]);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 26, 2, MAP_H + 30), [null, null, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9 }), null, null, null].map((m) => m || toon(0x191536)));
  deck.position.set(0, -1.03, -3);
  deck.receiveShadow = true;
  scene.add(deck);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 26.3, 0.18, MAP_H + 30.3), glowMat(0xb48cff, 1.2));
  edge.position.set(0, -0.2, -3);
  scene.add(edge);

  // city lights far below the rooftop
  const cityTex = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#090720'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const p = 20 + i * 58 + Math.random() * 14;
      for (let q = 0; q < w; q += 9) {
        c.fillStyle = Math.random() < 0.5 ? 'rgba(255,190,90,0.9)' : 'rgba(120,200,255,0.8)';
        if (Math.random() < 0.7) c.fillRect(q, p, 3, 3);
        if (Math.random() < 0.7) c.fillRect(p, q, 3, 3);
      }
    }
    for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(255,${150 + Math.random() * 100},${120 + Math.random() * 135},${Math.random() * 0.7})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [3, 3]);
  const city = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshBasicMaterial({ map: cityTex, color: new THREE.Color(1.3, 1.3, 1.3), fog: false }));
  city.rotation.x = -Math.PI / 2;
  city.position.y = -46;
  scene.add(city);

  // ---- low wall with a neon tube ----
  const wallMat = addRim(toon(0x3b3180), undefined, 0.5);
  const tubeMat = glowMat(0xc9a6ff, 1.5);
  const wall = (x, z, w, d) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, 1.1, d, 2, 0.12), wallMat);
    m.position.set(x, 0.55, z);
    m.receiveShadow = true; m.castShadow = true;
    scene.add(m);
    const n = new THREE.Mesh(new THREE.BoxGeometry(w > d ? w - 0.6 : 0.16, 0.14, w > d ? 0.16 : d - 0.6), tubeMat);
    n.position.set(x, 1.16, z);
    scene.add(n);
  };
  wall(0, -HALF_H - 0.5, MAP_W + 2, 1);
  wall(0, HALF_H + 0.5, MAP_W + 2, 1);
  wall(-HALF_W - 0.5, 0, 1, MAP_H);
  wall(HALF_W + 0.5, 0, 1, MAP_H);

  // ---- cover blocks ----
  OBSTACLES.forEach((o, i) => { buildCover(scene, o, i); paint.block(o.x, o.z, o.w, o.d); });

  // ---- spawn pads + team gates ----
  const beams = [];
  for (let team = 0; team < 2; team++) {
    const col = TEAM_COLORS[team], sx = SPAWN[team].x, sign = team === 0 ? -1 : 1;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.3, 0.16, 6), addRim(toon(0x2c2768)));
    pad.position.set(sx, 0.08, 0);
    pad.rotation.y = Math.PI / 6;
    pad.receiveShadow = true;
    scene.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.09, 8, 6), glowMat(col, 1.5));
    ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6;
    ring.position.set(sx, 0.2, 0);
    scene.add(ring);
    const beamTex = canvasTexture(8, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 5, 24, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: glow(col, 0.9), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(sx, 2.6, 0);
    scene.add(beam);
    beams.push(beam);
    // gate behind the pad
    const gx = sign * (HALF_W + 2.6);
    const pillarMat = addRim(toon(0x443a8f));
    for (const z of [-4.2, 4.2]) {
      const p = new THREE.Mesh(new RoundedBoxGeometry(1.4, 5.2, 1.4, 2, 0.2), pillarMat);
      p.position.set(gx, 2.6, z); p.castShadow = true;
      scene.add(p);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.4, 1.5), glowMat(col, 1.4));
      strip.position.set(gx - sign * 0.7, 2.6, z);
      scene.add(strip);
    }
    const top = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.3, 10.6, 2, 0.25), addRim(toon(col)));
    top.position.set(gx, 5.6, 0); top.castShadow = true;
    scene.add(top);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), glowMat(col, 1.6));
    gem.position.set(gx, 7.3, 0);
    gem.userData.y0 = 7.3;
    scene.add(gem);
    beams.push(gem);
  }

  // ---- grandstand with a bouncing crowd on the far (north) side ----
  const standMat = addRim(toon(0x2a2464), undefined, 0.4);
  const z0 = -HALF_H - 3.4;
  for (let i = 0; i < 3; i++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(MAP_W - 6, 1.0 + i * 0.9, 1.7), standMat);
    tier.position.set(0, (1.0 + i * 0.9) / 2, z0 - i * 1.7);
    tier.receiveShadow = true;
    scene.add(tier);
  }
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(MAP_W - 6, 6.5, 0.6), standMat);
  backWall.position.set(0, 3.25, z0 - 5.3);
  scene.add(backWall);
  const signTex = canvasTexture(2048, 128, (c, w, h) => {
    c.fillStyle = '#0d0a24'; c.fillRect(0, 0, w, h);
    c.font = '700 92px Fredoka, system-ui, sans-serif'; c.textBaseline = 'middle';
    let x = 30;
    for (let i = 0; i < 4; i++) {
      c.fillStyle = TEAM_CSS[0]; c.fillText('DRIP', x, h / 2 + 4); x += 250;
      c.fillStyle = TEAM_CSS[1]; c.fillText('CLASH', x, h / 2 + 4); x += 330;
      c.fillStyle = '#ffe36b'; c.fillText('▸▸▸', x, h / 2 + 4); x += 250;
    }
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W - 8, 2.2), new THREE.MeshBasicMaterial({ map: signTex, color: new THREE.Color(1.7, 1.7, 1.7) }));
  sign.position.set(0, 5.0, z0 - 4.95);
  scene.add(sign);

  // crowd: one instanced blob with eyes, bounce is done in the vertex shader
  const body = new THREE.SphereGeometry(0.46, 12, 9);
  body.scale(1, 0.9, 1);
  const eyeL = new THREE.SphereGeometry(0.09, 6, 5); eyeL.translate(-0.16, 0.08, 0.4);
  const eyeR = new THREE.SphereGeometry(0.09, 6, 5); eyeR.translate(0.16, 0.08, 0.4);
  const tint = (g, v) => g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(v), 3));
  tint(body, 1); tint(eyeL, 0.03); tint(eyeR, 0.03);
  const crowdGeo = mergeGeometries([body, eyeL, eyeR]);
  const crowdMat = toon(0xffffff, { vertexColors: true });
  crowdMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 1.37 + instanceMatrix[3].z * 2.1;
        transformed.y += abs(sin(uTime * 5.0 + ph)) * 0.42;`);
  };
  const N = 96;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, N);
  crowd.frustumCulled = false;
  const obj = new THREE.Object3D(), cc = new THREE.Color();
  const fans = [TEAM_COLORS[0], TEAM_COLORS[1], 0xffe36b, 0xffffff, 0xb48cff, 0x6bff8a];
  for (let i = 0; i < N; i++) {
    const row = i % 3, k = Math.floor(i / 3);
    obj.position.set(-HALF_W + 5.5 + k * ((MAP_W - 11) / (N / 3 - 1)) + (Math.random() - 0.5) * 0.5, 1.4 + row * 0.9, z0 - row * 1.7 + 0.1);
    obj.scale.setScalar(0.85 + Math.random() * 0.4);
    obj.updateMatrix();
    crowd.setMatrixAt(i, obj.matrix);
    const x = obj.position.x;
    crowd.setColorAt(i, cc.set(Math.random() < 0.7 ? (x < 0 ? fans[0] : fans[1]) : fans[2 + ((Math.random() * 4) | 0)]));
  }
  scene.add(crowd);

  // ---- floodlights in the far corners ----
  const poleMat = toon(0x2a2464);
  for (const sx of [-1, 1]) {
    const x = sx * (HALF_W + 1.6), z = -HALF_H - 1.6;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 9, 8), poleMat);
    pole.position.set(x, 4.5, z);
    scene.add(pole);
    const head = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.9, 0.7, 2, 0.15), poleMat);
    head.position.set(x, 9.2, z); head.rotation.y = -sx * 0.6; head.rotation.x = 0.5;
    scene.add(head);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), glowMat(0xfff3c4, 2.2));
    lamp.position.set(x - sx * 0.2, 9.1, z + 0.36); lamp.rotation.y = -sx * 0.6; lamp.rotation.x = 0.5;
    scene.add(lamp);
    const halo = glowSprite(0xfff3c4, 7, 0.55, 0.9);
    halo.position.set(x, 9.2, z + 0.5);
    scene.add(halo);
  }

  // ---- small props on the walkways ----
  const metal = addRim(toon(0xc9d0ee)), dark = toon(0x221d4a), leaf = addRim(toon(0x3fd17a)), pot = addRim(toon(0xff7d3b));
  const bucket = (x, z, team) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 14), metal); b.position.y = 0.45; b.castShadow = true;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14), glowMat(TEAM_COLORS[team], 0.95)); p.position.y = 0.9;
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team] })); s.rotation.x = -Math.PI / 2; s.position.set(0.7, 0.02, 0.3); s.scale.set(1, 0.7, 1);
    g.add(b, p, s); g.position.set(x, 0, z); scene.add(g);
  };
  const cone = (x, z) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 12), pot); c.position.set(x, 0.55, z); c.castShadow = true; scene.add(c);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.9), pot); base.position.set(x, 0.05, z); scene.add(base);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.31, 0.2, 12), toon(0xffffff)); band.position.set(x, 0.55, z); scene.add(band);
  };
  const plant = (x, z) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.8, 10), dark); p.position.set(x, 0.4, z); p.castShadow = true; scene.add(p);
    for (const [dx, dy, dz, r] of [[0, 1.2, 0, 0.75], [0.45, 0.95, 0.2, 0.5], [-0.4, 1.0, -0.2, 0.55]]) {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf); l.position.set(x + dx, dy, z + dz); l.castShadow = true; scene.add(l);
    }
  };
  const zs = HALF_H + 2.2, zn = -HALF_H - 1.9;
  bucket(-20, zs, 0); bucket(18, zs, 1); bucket(-4, zs + 0.6, 1); bucket(7, zs, 0);
  cone(-12, zs); cone(-10.6, zs + 0.5); cone(13, zs + 0.3); cone(26, zs);
  plant(-28, zs + 0.4); plant(0, zs + 1); plant(29, zs + 0.5);
  plant(-30, zn); plant(30, zn); bucket(-15, zn, 0); bucket(15, zn, 1);

  return {
    sun,
    setShadowQuality(high) { sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; },
    update(t, focus) {
      time.value = t;
      sun.position.set(focus.x - 10, 26, focus.z + 9);
      sun.target.position.set(focus.x, 0, focus.z);
      for (const b of beams) {
        if (b.userData.y0) { b.rotation.y = t * 1.2; b.position.y = b.userData.y0 + Math.sin(t * 1.6) * 0.3; }
        else b.material.opacity = 0.24 + Math.sin(t * 2.2) * 0.08;
      }
    },
  };
}

// ---------- collision helpers (XZ plane) ----------
const BOXES = OBSTACLES.map((o) => ({ x0: o.x - o.w / 2, x1: o.x + o.w / 2, z0: o.z - o.d / 2, z1: o.z + o.d / 2 }));
export { BOXES };

// Push a circle out of walls, cover blocks and (optionally) round structures.
export function resolveCollisions(u, structures) {
  const r = u.radius;
  for (const b of BOXES) {
    const nx = Math.max(b.x0, Math.min(u.x, b.x1));
    const nz = Math.max(b.z0, Math.min(u.z, b.z1));
    let dx = u.x - nx, dz = u.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      u.x = nx + (dx / d) * r;
      u.z = nz + (dz / d) * r;
    } else {
      // centre is inside the box: leave through the nearest face
      const l = u.x - b.x0, rr = b.x1 - u.x, t = u.z - b.z0, bt = b.z1 - u.z;
      const m = Math.min(l, rr, t, bt);
      if (m === l) u.x = b.x0 - r; else if (m === rr) u.x = b.x1 + r; else if (m === t) u.z = b.z0 - r; else u.z = b.z1 + r;
    }
  }
  if (structures) {
    for (const s of structures) {
      if (!s.alive || s === u) continue;
      const dx = u.x - s.x, dz = u.z - s.z, min = r + s.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001;
        u.x = s.x + (dx / d) * min;
        u.z = s.z + (dz / d) * min;
      }
    }
  }
  u.x = Math.max(-HALF_W + r, Math.min(HALF_W - r, u.x));
  u.z = Math.max(-HALF_H + r, Math.min(HALF_H - r, u.z));
}

// Entry parameter (0..1) of segment a->b into a box grown by `grow`, or -1 if it misses.
export function segBox(ax, az, bx, bz, b, grow) {
  const x0 = b.x0 - grow, x1 = b.x1 + grow, z0 = b.z0 - grow, z1 = b.z1 + grow;
  const dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) { if (ax < x0 || ax > x1) return -1; } else {
    let ta = (x0 - ax) / dx, tb = (x1 - ax) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  if (Math.abs(dz) < 1e-9) { if (az < z0 || az > z1) return -1; } else {
    let ta = (z0 - az) / dz, tb = (z1 - az) / dz;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return t0;
}

export function pointInBox(x, z, grow = 0) {
  for (const b of BOXES) if (x > b.x0 - grow && x < b.x1 + grow && z > b.z0 - grow && z < b.z1 + grow) return true;
  return false;
}

// True if nothing solid is between the two points (used for line-of-fire checks).
export function clearLine(ax, az, bx, bz, grow = 0.1) {
  for (const b of BOXES) if (segBox(ax, az, bx, bz, b, grow) >= 0) return false;
  return true;
}

const out = { x: 0, z: 0 };
// Local path planner: returns a unit direction from the unit toward (tx,tz) that walks
// around cover blocks (via their corners) and around round structures.
export function steer(u, tx, tz, structures, ignore) {
  const r = u.radius;
  let hit = null, hitT = 2;
  for (const b of BOXES) {
    const t = segBox(u.x, u.z, tx, tz, b, r + 0.05);
    if (t >= 0 && t < hitT) { hitT = t; hit = b; }
  }
  let gx = tx, gz = tz;
  if (hit) {
    const g = r + 0.55;
    const corners = [[hit.x0 - g, hit.z0 - g], [hit.x1 + g, hit.z0 - g], [hit.x0 - g, hit.z1 + g], [hit.x1 + g, hit.z1 + g]];
    let best = Infinity;
    for (const [cx, cz] of corners) {
      if (Math.abs(cx) > HALF_W - r || Math.abs(cz) > HALF_H - r) continue;
      if (segBox(u.x, u.z, cx, cz, hit, r - 0.02) >= 0) continue;
      const d = Math.hypot(cx - u.x, cz - u.z) + Math.hypot(tx - cx, tz - cz);
      if (d < best) { best = d; gx = cx; gz = cz; }
    }
  } else if (structures) {
    for (const s of structures) {
      if (!s.alive || s === ignore) continue;
      const dx = tx - u.x, dz = tz - u.z;
      const len2 = dx * dx + dz * dz;
      if (len2 < 0.01) continue;
      const t = ((s.x - u.x) * dx + (s.z - u.z) * dz) / len2;
      if (t <= 0 || t >= 1) continue;
      const px = u.x + dx * t, pz = u.z + dz * t;
      const clear = s.radius + r + 0.3;
      let ox = px - s.x, oz = pz - s.z;
      const od = Math.hypot(ox, oz);
      if (od >= clear) continue;
      if (od < 0.05) { const len = Math.sqrt(len2); ox = -dz / len; oz = dx / len; } else { ox /= od; oz /= od; }
      gx = s.x + ox * (clear + 0.6);
      gz = s.z + oz * (clear + 0.6);
      break;
    }
  }
  const dx = gx - u.x, dz = gz - u.z;
  const d = Math.hypot(dx, dz) || 1;
  out.x = dx / d; out.z = dz / d;
  return out;
}
