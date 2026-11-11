// Hero roster. Every hero has: a basic attack that costs ammo, an ability on a cooldown
// and an ult that charges by dealing damage and spreading paint.
// `a` (aim) = { dx, dz, dist }: unit direction plus distance for ground-targeted skills.

export const HEROES = [
  {
    id: 'riko',
    name: 'RIKO',
    role: { de: 'Flitzer', en: 'Speedster' },
    tagline: { de: 'Skater mit zwei Spraydosen und null Geduld.', en: 'Skater kid with two spray cans and zero patience.' },
    color: '#ffc928',
    hp: 3400, speed: 6.7, reload: 1.0, ammo: 3, range: 8.5, projSpeed: 22, prefDist: 5.5, ultCharge: 4200,
    aim: { type: 'line', width: 0.8 },
    stats: { atk: 3, def: 2, spd: 5, paint: 3 },
    desc: {
      attack: { name: { de: 'Doppel-Spray', en: 'Double Spray' }, text: { de: 'Zwei schnelle Farbschüsse.', en: 'Two quick paint shots.' } },
      ability: { name: { de: 'Kickflip-Dash', en: 'Kickflip Dash' }, text: { de: 'Saust nach vorn, zieht eine Farbspur und rammt Gegner.', en: 'Dashes forward, leaves a paint trail and rams enemies.' } },
      ult: { name: { de: 'Farb-Tornado', en: 'Paint Tornado' }, text: { de: 'Wirbelt herum und sprüht Farbe in alle Richtungen.', en: 'Spins and sprays paint in every direction.' } },
    },
    attack(m, h, a) {
      for (let i = 0; i < 2; i++) {
        m.after(i * 0.11, () => m.shoot(h, { dx: a.dx, dz: a.dz, side: i ? 0.2 : -0.2, speed: 22, range: 8.5, dmg: 345, paintR: 1.15, trailR: 0.6 }));
      }
    },
    ability: {
      cd: 6, range: 6.5, aim: 'line', width: 1.2,
      ai: { type: 'dash', min: 3, max: 7.5 },
      use(m, h, a) { m.dash(h, a.dx, a.dz, 6.5, 0.26, { dmg: 380, paintR: 1.25 }); },
    },
    ult: {
      range: 6, aim: 'self', radius: 6,
      ai: { type: 'near', range: 5 },
      use(m, h) { m.startSpin(h, 2.6); },
    },
  },
  {
    id: 'bombo',
    name: 'BOMBO',
    role: { de: 'Tank', en: 'Tank' },
    tagline: { de: 'Großer Roboter, noch größere Kanone.', en: 'Big robot, even bigger cannon.' },
    color: '#ff8a3d',
    hp: 5400, speed: 5.3, reload: 1.45, ammo: 3, range: 6.2, projSpeed: 19, prefDist: 3.6, ultCharge: 4800,
    aim: { type: 'cone', spread: 0.36 },
    stats: { atk: 4, def: 5, spd: 2, paint: 4 },
    desc: {
      attack: { name: { de: 'Klecks-Kanone', en: 'Splodge Cannon' }, text: { de: 'Fächer aus fünf Farbklecksen – nah am Gegner brutal.', en: 'Fan of five paint blobs – brutal up close.' } },
      ability: { name: { de: 'Bodenstampfer', en: 'Ground Stomp' }, text: { de: 'Stampft auf: Schaden, Rückstoß und Farbe rundherum.', en: 'Stomp: damage, knockback and paint all around.' } },
      ult: { name: { de: 'Mega-Bombe', en: 'Mega Bomb' }, text: { de: 'Wirft eine riesige Farbbombe mit gewaltigem Radius.', en: 'Lobs a giant paint bomb with a huge radius.' } },
    },
    attack(m, h, a) {
      const base = Math.atan2(a.dx, a.dz);
      for (let i = -2; i <= 2; i++) {
        const ang = base + i * 0.17;
        m.shoot(h, { dx: Math.sin(ang), dz: Math.cos(ang), speed: 19, range: 6.2 - Math.abs(i) * 0.3, dmg: 180, paintR: 0.95, trailR: 0.5 });
      }
    },
    ability: {
      cd: 8, range: 4.2, aim: 'self', radius: 4.2,
      ai: { type: 'near', range: 3.4 },
      use(m, h) { m.burst(h, h.x, h.z, 4.2, 480, { paintR: 4.0, knock: 9, slow: 1.2 }); h.kick = 1.6; },
    },
    ult: {
      range: 9.5, aim: 'area', radius: 5,
      ai: { type: 'area', range: 9.5 },
      use(m, h, a) { m.lob(h, h.x + a.dx * a.dist, h.z + a.dz * a.dist, { time: 0.85, dmg: 1250, radius: 5, paintR: 5.4, knock: 7, size: 0.9 }); },
    },
  },
  {
    id: 'kira',
    name: 'KIRA',
    role: { de: 'Scharfschützin', en: 'Sharpshooter' },
    tagline: { de: 'Fuchs-Magierin. Trifft von ganz weit weg.', en: 'Fox mage. Hits from very far away.' },
    color: '#b48cff',
    hp: 2700, speed: 5.9, reload: 1.55, ammo: 3, range: 11.5, projSpeed: 30, prefDist: 8.5, ultCharge: 4000,
    aim: { type: 'line', width: 0.6 },
    stats: { atk: 5, def: 1, spd: 3, paint: 4 },
    desc: {
      attack: { name: { de: 'Fern-Tropfen', en: 'Long Drop' }, text: { de: 'Schneller Schuss mit riesiger Reichweite und langer Farbspur.', en: 'Fast shot with huge range and a long paint line.' } },
      ability: { name: { de: 'Farbstrahl', en: 'Paint Beam' }, text: { de: 'Strahl, der alle Gegner in einer Linie trifft.', en: 'Beam that hits every enemy in a line.' } },
      ult: { name: { de: 'Farbregen', en: 'Paint Rain' }, text: { de: 'Lässt es in einem großen Gebiet Farbe regnen.', en: 'Makes it rain paint over a large area.' } },
    },
    attack(m, h, a) { m.shoot(h, { dx: a.dx, dz: a.dz, speed: 30, range: 11.5, dmg: 540, paintR: 1.3, trailR: 0.7, size: 1.15 }); },
    ability: {
      cd: 7, range: 13, aim: 'line', width: 1.0,
      ai: { type: 'skillshot', range: 12 },
      use(m, h, a) { m.beam(h, a.dx, a.dz, 13, 0.85, 640); },
    },
    ult: {
      range: 11, aim: 'area', radius: 5,
      ai: { type: 'area', range: 11 },
      use(m, h, a) {
        m.addZone({ type: 'rain', owner: h, x: h.x + a.dx * a.dist, z: h.z + a.dz * a.dist, r: 5, dur: 4.2, tick: 0.4, dmg: 240 });
      },
    },
  },
  {
    id: 'mochi',
    name: 'MOCHI',
    role: { de: 'Supporterin', en: 'Support' },
    tagline: { de: 'Blob-Katze. Heilt Freunde, spült Feinde weg.', en: 'Blob cat. Heals friends, washes enemies away.' },
    color: '#ffa9c9',
    hp: 3600, speed: 5.9, reload: 1.3, ammo: 3, range: 8, projSpeed: 14, prefDist: 5.5, ultCharge: 4000,
    aim: { type: 'cone', spread: 0.24 },
    stats: { atk: 2, def: 3, spd: 3, paint: 5 },
    desc: {
      attack: { name: { de: 'Blubber-Blasen', en: 'Bubble Burst' }, text: { de: 'Drei dicke Farbblasen im Fächer.', en: 'Three fat paint bubbles in a fan.' } },
      ability: { name: { de: 'Heil-Pfütze', en: 'Healing Puddle' }, text: { de: 'Pfütze, die dich und Verbündete heilt.', en: 'A puddle that heals you and your allies.' } },
      ult: { name: { de: 'Tsunami', en: 'Tsunami' }, text: { de: 'Riesige Farbwelle, die Gegner wegschiebt.', en: 'Huge paint wave that shoves enemies back.' } },
    },
    attack(m, h, a) {
      const base = Math.atan2(a.dx, a.dz);
      for (let i = -1; i <= 1; i++) {
        const ang = base + i * 0.2;
        m.shoot(h, { dx: Math.sin(ang), dz: Math.cos(ang), speed: 14, range: 8, dmg: 240, paintR: 1.3, trailR: 0.7, size: 1.35, hitR: 0.42 });
      }
    },
    ability: {
      cd: 9, range: 3.8, aim: 'self', radius: 3.8,
      ai: { type: 'heal', range: 3.8 },
      use(m, h) { m.addZone({ type: 'heal', owner: h, x: h.x, z: h.z, r: 3.8, dur: 4, tick: 0.5, heal: 270 }); },
    },
    ult: {
      range: 12, aim: 'line', width: 6.4,
      ai: { type: 'skillshot', range: 9 },
      use(m, h, a) {
        const hitSet = new Set(); // the whole wave hits each enemy only once
        for (let i = -3; i <= 3; i++) {
          m.shoot(h, { dx: a.dx, dz: a.dz, side: i * 1.0, speed: 15, range: 12, dmg: 700, paintR: 1.6, trailR: 1.25, size: 1.7, hitR: 0.6, pierce: true, knock: 7, hitSet });
        }
      },
    },
  },
];

export const heroById = (id) => HEROES.find((h) => h.id === id) || HEROES[0];
