// Prepares hero models for the game:  node tools/prepare-models.mjs <folder with source .glb files>
// - bakes each material's colour into vertex colours (one material, no texture needed)
// - simplifies, quantises and meshopt-compresses the geometry
// Output goes to src/assets/models/<id>.glb. FILES maps source file names to hero ids.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, quantize, meshopt, prune, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FILES = { Kio: 'kio', Pippa: 'pippa', Prismo: 'prismo', Funk: 'funk', Sumsi: 'sumsi', Wuschel: 'wuschel', Luma: 'luma', Klecks: 'klecks', Manta: 'manta', Taps: 'taps', Flitz: 'flitz' };
const src = process.argv[2];
if (!src) { console.error('usage: node tools/prepare-models.mjs <folder with .glb files>'); process.exit(1); }
const out = new URL('../src/assets/models/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const [name, id] of Object.entries(FILES)) {
  const file = join(src, `${name}.glb`);
  if (!existsSync(file)) { console.warn(`skip ${name}: not found`); continue; }
  const doc = await io.read(file);
  const shared = doc.createMaterial('Figure').setRoughnessFactor(0.7).setMetallicFactor(0);
  let glow = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const c = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
      const e = mat ? mat.getEmissiveFactor() : [0, 0, 0];
      if (e[0] + e[1] + e[2] > 0.01) glow++;
      const n = prim.getAttribute('POSITION').getCount();
      const arr = new Uint16Array(n * 3);
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) arr[i * 3 + k] = Math.round(Math.min(1, c[k] + e[k] * 0.5) * 65535);
      prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(arr).setNormalized(true));
      prim.setAttribute('TEXCOORD_0', null);
      prim.setMaterial(shared);
    }
  }
  await doc.transform(prune(), dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.6, error: 0.0008 }), resample(), quantize(), meshopt({ encoder: MeshoptEncoder }));
  const target = join(out, `${id}.glb`);
  await io.write(target, doc);
  console.log(`${name} -> ${id}.glb  ${(statSync(file).size / 1024).toFixed(0)} kB -> ${(statSync(target).size / 1024).toFixed(0)} kB  (glowing materials: ${glow})`);
}
