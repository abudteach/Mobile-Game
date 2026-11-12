import { SPAWN } from './config.js';
import { steer, clearLine } from './world.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function initAI(h, laneZ) {
  h.ai = {
    think: Math.random() * 0.3, mode: 'push', target: null,
    goalX: h.x, goalZ: h.z, strafe: 1, strafeT: 0, strafeAmt: 0,
    fireT: 0.5, paintT: 1 + Math.random(), laneZ, skill: 0.75 + Math.random() * 0.35,
  };
}

// Decide what to do a few times per second: retreat, fight a hero, farm blobs or push.
function decide(m, h) {
  const a = h.ai, def = h.def, enemy = 1 - h.team;
  const hpF = h.hp / h.maxHp;
  if (a.mode === 'retreat') { if (hpF > 0.85) a.mode = 'push'; } else if (hpF < 0.28) a.mode = 'retreat';

  let foe = null, foeD = 1e9;
  for (const e of m.heroes) {
    if (e.team === h.team || !e.alive) continue;
    const d = dist(h, e) - (1 - e.hp / e.maxHp) * 2; // prefer wounded targets a little
    if (d < foeD) { foeD = d; foe = e; }
  }
  if (foe) foeD = dist(h, foe);
  let blob = null, blobD = 1e9;
  for (const e of m.minions) {
    if (e.team === h.team || !e.alive) continue;
    const d = dist(h, e);
    if (d < blobD) { blobD = d; blob = e; }
  }

  const tower = m.towers[enemy], core = m.cores[enemy];
  const obj = tower.alive ? tower : core;
  const objD = dist(h, obj);
  a.target = null;
  a.strafeAmt = 0;
  a.atWell = false;
  a.goalX = h.x; a.goalZ = h.z;

  if (a.mode === 'retreat') {
    a.goalX = SPAWN[h.team].x;
    a.goalZ = SPAWN[h.team].z + (h.slot - 1) * 1.6;
    if (foe && foeD < def.range) a.target = foe;
    return;
  }

  // is it safe to walk into the enemy tower's range?
  const covered = !tower.alive || m.alliesNear(tower, h.team, 9) > 0 || tower.hp < tower.maxHp * 0.25;

  if (foe && foeD < def.range + 4) {
    a.target = foe;
    a.strafeAmt = 0.8;
    const pref = def.prefDist;
    if (foeD > pref + 0.8) { a.goalX = foe.x; a.goalZ = foe.z; }
    else if (foeD < pref * 0.65) { a.goalX = h.x + ((h.x - foe.x) / foeD) * 4; a.goalZ = h.z + ((h.z - foe.z) / foeD) * 4; }
    if (!covered && Math.hypot(a.goalX - tower.x, a.goalZ - tower.z) < 10.6 && hpF < 0.75) { a.goalX = h.x; a.goalZ = h.z; }
    return;
  }

  if (blob && blobD < def.range + 1) {
    a.target = blob;
    a.strafeAmt = 0.35;
    if (blobD < 2.6) { a.goalX = h.x + (h.x - blob.x); a.goalZ = h.z + (h.z - blob.z); }
    return;
  }

  // side lanes: take the paint well first, and take it back when it is lost
  const well = Math.abs(a.laneZ) > 5 ? m.wells[a.laneZ < 0 ? 0 : 1] : null;
  if (well && well.owner !== h.team && Math.abs(h.x - well.x) < 17) {
    a.atWell = true;
    const ang = (a.wellJ ?? (a.wellJ = Math.random() * 6.28)) + m.time * 0.9;
    a.goalX = well.x + Math.cos(ang) * 2.6;
    a.goalZ = well.z + Math.sin(ang) * 2.6;
    return;
  }

  const safe = covered || obj !== tower;
  if (safe && objD < def.range + obj.radius && m.canDamage(obj)) a.target = obj;
  const sign = h.team === 0 ? 1 : -1;
  if (Math.abs(obj.x - h.x) > 13) {
    a.goalX = h.x + sign * 7;
    a.goalZ = a.laneZ;
  } else {
    const hold = safe ? Math.max(2.5, Math.min(def.range - 0.6, def.prefDist + 1.5)) + obj.radius : 12;
    const ux = (h.x - obj.x) / (objD || 1), uz = (h.z - obj.z) / (objD || 1);
    a.goalX = obj.x + ux * hold;
    a.goalZ = obj.z + uz * hold;
  }
}

export function updateAI(m, h, dt) {
  const a = h.ai, def = h.def;
  a.think -= dt; a.fireT -= dt; a.strafeT -= dt; a.paintT -= dt;
  if (a.strafeT <= 0) { a.strafe = Math.random() < 0.5 ? -1 : 1; a.strafeT = 0.6 + Math.random() * 1.2; }
  if (a.think <= 0) { a.think = 0.18 + Math.random() * 0.12; decide(m, h); }

  const tv = a.target && a.target.alive ? a.target : null;
  const isStruct = tv && tv.kind !== 'hero' && tv.kind !== 'minion';

  // ----- movement -----
  let mx = 0, mz = 0;
  const dg = Math.hypot(a.goalX - h.x, a.goalZ - h.z);
  if (dg > 0.5) {
    const s = steer(h, a.goalX, a.goalZ, m.colliders, isStruct ? tv : null);
    mx = s.x; mz = s.z;
  }
  if (tv && a.strafeAmt) {
    const dx = tv.x - h.x, dz = tv.z - h.z, d = Math.hypot(dx, dz) || 1;
    mx += (-dz / d) * a.strafe * a.strafeAmt;
    mz += (dx / d) * a.strafe * a.strafeAmt;
  }
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  h.cmd.mx = mx; h.cmd.mz = mz;

  // ----- heal ability (support) -----
  const ab = def.ability;
  if (ab.ai.type === 'heal' && h.cd <= 0) {
    for (const f of m.heroes) {
      if (f.team === h.team && f.alive && f.hp < f.maxHp * 0.6 && dist(h, f) < ab.ai.range) { m.useAbility(h, { dx: 0, dz: 1, dist: 0 }); break; }
    }
  }
  // escape dash when running home
  if (a.mode === 'retreat' && ab.ai.type === 'buff' && h.cd <= 0 && dg > 6) m.useAbility(h, { dx: 0, dz: 1, dist: 0 });
  if (a.mode === 'retreat' && ab.ai.type === 'dash' && h.cd <= 0 && dg > 6) {
    m.useAbility(h, { dx: mx || 0, dz: mz || 1, dist: ab.range });
  }

  if (!tv) {
    // nothing to shoot: spend spare ammo on painting the way forward
    if (a.paintT <= 0 && h.ammo >= (a.atWell ? 1 : def.ammo) && a.mode !== 'retreat') {
      a.paintT = a.atWell ? 0.25 + Math.random() * 0.3 : 0.5 + Math.random() * 0.8;
      const base = ml > 0.1 ? Math.atan2(mx, mz) : (h.team === 0 ? Math.PI / 2 : -Math.PI / 2);
      const ang = a.atWell ? Math.random() * 6.28 : base + (Math.random() - 0.5) * 1.3;
      m.fire(h, { dx: Math.sin(ang), dz: Math.cos(ang), dist: def.range });
    }
    return;
  }

  // ----- combat -----
  const dx = tv.x - h.x, dz = tv.z - h.z, d = Math.hypot(dx, dz);
  const isHero = tv.kind === 'hero';
  let ax = dx, az = dz;
  if (isHero) { const tt = d / def.projSpeed; ax += tv.vx * tt * 0.8; az += tv.vz * tt * 0.8; }
  const ang = Math.atan2(ax, az) + ((Math.random() - 0.5) * 0.24) / a.skill;
  const aim = { dx: Math.sin(ang), dz: Math.cos(ang), dist: Math.hypot(ax, az) };
  const los = clearLine(h.x, h.z, tv.x, tv.z);
  const reach = d - tv.radius;

  if (h.ult >= 1 && (isHero || isStruct)) {
    const u = def.ult;
    const ok = u.ai.type === 'near' ? reach < u.ai.range : u.ai.type === 'area' ? d < u.ai.range + 2 : reach < u.ai.range && los;
    if (ok) { m.useUlt(h, { ...aim, dist: Math.min(aim.dist, u.range) }); return; }
  }
  if (h.cd <= 0 && isHero) {
    const t = ab.ai.type;
    if (t === 'dash' && d > ab.ai.min && d < ab.ai.max && los && h.hp > h.maxHp * 0.45) m.useAbility(h, aim);
    else if (t === 'near' && reach < ab.ai.range) m.useAbility(h, aim);
    else if (t === 'skillshot' && d < ab.ai.range && los) m.useAbility(h, aim);
    else if (t === 'area' && d < ab.ai.range + 1.5) m.useAbility(h, { ...aim, dist: Math.min(aim.dist, ab.range) });
    else if (t === 'summon' && d < ab.ai.range) m.useAbility(h, { ...aim, dist: 2.5 });
    else if (t === 'buff' && d < ab.ai.range) m.useAbility(h, aim);
  }
  if (a.fireT <= 0 && h.ammo >= 1 && reach < def.range && los) {
    if (m.fire(h, aim)) a.fireT = 0.28 + Math.random() * 0.4;
  }
}
