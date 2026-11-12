// Hero roster. Every hero has: a basic attack that costs ammo, an ability on a cooldown
// and an ult that charges by dealing damage and spreading paint.
// `a` (aim) = { dx, dz, dist }: unit direction plus distance for ground-targeted skills.
import jaroArt from './assets/heroes/jaro.webp';
import pippaArt from './assets/heroes/pippa.webp';
import zyroArt from './assets/heroes/zyro.webp';
import byteArt from './assets/heroes/byte.webp';
import melliArt from './assets/heroes/melli.webp';
import nimbiArt from './assets/heroes/nimbi.webp';
import lumaArt from './assets/heroes/luma.webp';
import brunoArt from './assets/heroes/bruno.webp';
import skyeArt from './assets/heroes/skye.webp';
import gromArt from './assets/heroes/grom.webp';

const T = (de, en) => ({ de, en });
const skill = (nameDe, nameEn, textDe, textEn) => ({ name: T(nameDe, nameEn), text: T(textDe, textEn) });
const fan = (a, n, step) => { const base = Math.atan2(a.dx, a.dz), out = []; for (let i = 0; i < n; i++) { const ang = base + (i - (n - 1) / 2) * step; out.push({ dx: Math.sin(ang), dz: Math.cos(ang), i: i - (n - 1) / 2 }); } return out; };

// ---- reusable skill pieces ----
const healPuddle = { cd: 9, range: 3.8, aim: 'self', radius: 3.8, ai: { type: 'heal', range: 3.8 }, use(m, h) { m.addZone({ type: 'heal', owner: h, x: h.x, z: h.z, r: 3.8, dur: 4, tick: 0.5, heal: 270 }); } };
const stomp = { cd: 8, range: 4.2, aim: 'self', radius: 4.2, ai: { type: 'near', range: 3.4 }, use(m, h) { m.burst(h, h.x, h.z, 4.2, 480, { paintR: 4.0, knock: 9, slow: 1.2 }); h.kick = 1.6; } };
const megaBomb = { range: 9.5, aim: 'area', radius: 5, ai: { type: 'area', range: 9.5 }, use(m, h, a) { m.lob(h, h.x + a.dx * a.dist, h.z + a.dz * a.dist, { time: 0.85, dmg: 1250, radius: 5, paintR: 5.4, knock: 7, size: 0.9 }); } };
const tsunami = {
  range: 12, aim: 'line', width: 6.4, ai: { type: 'skillshot', range: 9 },
  use(m, h, a) {
    const hitSet = new Set(); // the whole wave hits each enemy only once
    for (let i = -3; i <= 3; i++) m.shoot(h, { dx: a.dx, dz: a.dz, side: i, speed: 15, range: 12, dmg: 700, paintR: 1.6, trailR: 1.25, size: 1.7, hitR: 0.6, pierce: true, knock: 7, hitSet });
  },
};
const bubbles = (m, h, a) => { for (const d of fan(a, 3, 0.2)) m.shoot(h, { dx: d.dx, dz: d.dz, speed: 14, range: 8, dmg: 265, paintR: 1.3, trailR: 0.7, size: 1.35, hitR: 0.42 }); };
const shotgun = (m, h, a) => { for (const d of fan(a, 5, 0.17)) m.shoot(h, { dx: d.dx, dz: d.dz, speed: 19, range: 6.2 - Math.abs(d.i) * 0.3, dmg: 180, paintR: 0.95, trailR: 0.5 }); };

export const HEROES = [
  {
    id: 'jaro', name: 'JARO', art: jaroArt, color: '#3fd18f',
    role: T('Flitzer', 'Speedster'), tagline: T('Schneller als sein eigener Schatten.', 'Faster than his own shadow.'),
    hp: 3400, speed: 6.7, reload: 1.0, ammo: 3, range: 8.5, projSpeed: 22, prefDist: 5.5, ultCharge: 4200,
    aim: { type: 'line', width: 0.8 }, stats: { atk: 3, def: 2, spd: 5, paint: 3 },
    desc: {
      attack: skill('Doppel-Spray', 'Double Spray', 'Zwei schnelle Farbschüsse.', 'Two quick paint shots.'),
      ability: skill('Schattensprint', 'Shadow Dash', 'Saust nach vorn, zieht eine Farbspur und rammt Gegner.', 'Dashes forward, leaves a paint trail and rams enemies.'),
      ult: skill('Farb-Tornado', 'Paint Tornado', 'Wirbelt herum und sprüht Farbe in alle Richtungen.', 'Spins and sprays paint in every direction.'),
    },
    attack(m, h, a) { for (let i = 0; i < 2; i++) m.after(i * 0.11, () => m.shoot(h, { dx: a.dx, dz: a.dz, side: i ? 0.2 : -0.2, speed: 22, range: 8.5, dmg: 360, paintR: 1.15, trailR: 0.6 })); },
    ability: { cd: 6, range: 6.5, aim: 'line', width: 1.2, ai: { type: 'dash', min: 3, max: 7.5 }, use(m, h, a) { m.dash(h, a.dx, a.dz, 6.5, 0.26, { dmg: 380, paintR: 1.25 }); } },
    ult: { range: 6, aim: 'self', radius: 6, ai: { type: 'near', range: 5 }, use(m, h) { m.startSpin(h, 2.6); } },
  },
  {
    id: 'pippa', name: 'PIPPA', art: pippaArt, color: '#ff8a4a',
    role: T('Gärtnerin', 'Gardener'), tagline: T('Wo sie hintritt, wächst Farbe.', 'Wherever she steps, colour grows.'),
    hp: 3500, speed: 5.9, reload: 1.3, ammo: 3, range: 8, projSpeed: 14, prefDist: 5.5, ultCharge: 4000,
    aim: { type: 'cone', spread: 0.24 }, stats: { atk: 2, def: 3, spd: 3, paint: 5 },
    desc: {
      attack: skill('Samen-Salve', 'Seed Volley', 'Drei dicke Farbsamen im Fächer.', 'Three fat paint seeds in a fan.'),
      ability: skill('Heil-Pfütze', 'Healing Puddle', 'Pfütze, die dich und Verbündete heilt.', 'A puddle that heals you and your allies.'),
      ult: skill('Blütenmeer', 'Bloom Field', 'Großes Feld: heilt Freunde, schadet Gegnern, färbt alles.', 'Big field: heals friends, hurts enemies, paints everything.'),
    },
    attack: bubbles,
    ability: healPuddle,
    ult: { range: 8, aim: 'area', radius: 5.5, ai: { type: 'area', range: 8 }, use(m, h, a) { m.addZone({ type: 'bloom', owner: h, x: h.x + a.dx * a.dist, z: h.z + a.dz * a.dist, r: 5.5, dur: 5, tick: 0.5, heal: 190, dmg: 120, paintN: 4 }); } },
  },
  {
    id: 'zyro', name: 'ZYRO', art: zyroArt, color: '#4fd6b0',
    role: T('Kämpfer', 'Fighter'), tagline: T('Kristalldrache mit kurzer Zündschnur.', 'Crystal dragon with a short fuse.'),
    hp: 4300, speed: 5.8, reload: 1.25, ammo: 3, range: 7, projSpeed: 20, prefDist: 4.2, ultCharge: 4400,
    aim: { type: 'cone', spread: 0.16 }, stats: { atk: 4, def: 4, spd: 3, paint: 3 },
    desc: {
      attack: skill('Splitter-Fächer', 'Shard Fan', 'Drei Kristallsplitter, eng gefächert.', 'Three crystal shards in a tight fan.'),
      ability: skill('Kristallsturz', 'Crystal Dive', 'Springt vor und schlägt mit einer Farbexplosion ein.', 'Leaps forward and lands with a paint blast.'),
      ult: skill('Kristallhagel', 'Crystal Hail', 'Fünf Kristallbomben regnen ins Zielgebiet.', 'Five crystal bombs rain onto the target area.'),
    },
    attack(m, h, a) { for (const d of fan(a, 3, 0.12)) m.shoot(h, { dx: d.dx, dz: d.dz, speed: 20, range: 7, dmg: 255, paintR: 1.05, trailR: 0.55 }); },
    ability: { cd: 7.5, range: 5.5, aim: 'line', width: 1.4, ai: { type: 'dash', min: 2.5, max: 6.5 }, use(m, h, a) { m.dash(h, a.dx, a.dz, 5.5, 0.3, { dmg: 200, paintR: 1.1, end: { radius: 3, dmg: 420, paintR: 3, knock: 6 } }); } },
    ult: {
      range: 9, aim: 'area', radius: 4.6, ai: { type: 'area', range: 9 },
      use(m, h, a) {
        const cx = h.x + a.dx * a.dist, cz = h.z + a.dz * a.dist;
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2, r = i === 0 ? 0 : 2.6;
          m.after(i * 0.16, () => m.lob(h, cx + Math.cos(ang) * r, cz + Math.sin(ang) * r, { time: 0.7, dmg: 520, radius: 2.6, paintR: 2.8, knock: 3, size: 0.55 }));
        }
      },
    },
  },
  {
    id: 'byte', name: 'BYTE', art: byteArt, face: [220, -8], color: '#ffb21f',
    role: T('Tüftler', 'Tinkerer'), tagline: T('Klein, frech, voll aufgeladen.', 'Small, cheeky, fully charged.'),
    hp: 3200, speed: 6.2, reload: 0.58, ammo: 4, range: 9.5, projSpeed: 26, prefDist: 7, ultCharge: 4000,
    aim: { type: 'line', width: 0.6 }, stats: { atk: 4, def: 2, spd: 4, paint: 3 },
    desc: {
      attack: skill('Schnellfeuer', 'Rapid Fire', 'Einzelschüsse, die extrem schnell nachladen.', 'Single shots that reload extremely fast.'),
      ability: skill('Farbmine', 'Paint Mine', 'Wirft eine kleine Bombe auf kurze Distanz.', 'Lobs a small bomb at short range.'),
      ult: skill('Laser-Gitter', 'Laser Grid', 'Drei Strahlen im Fächer, die alles durchschlagen.', 'Three beams in a fan that pierce everything.'),
    },
    attack(m, h, a) { m.shoot(h, { dx: a.dx, dz: a.dz, speed: 26, range: 9.5, dmg: 340, paintR: 1.0, trailR: 0.55 }); },
    ability: { cd: 5.5, range: 7.5, aim: 'area', radius: 3, ai: { type: 'area', range: 7.5 }, use(m, h, a) { m.lob(h, h.x + a.dx * a.dist, h.z + a.dz * a.dist, { time: 0.6, dmg: 520, radius: 3, paintR: 3.2, knock: 4, size: 0.5 }); } },
    ult: { range: 12, aim: 'cone', spread: 0.34, ai: { type: 'skillshot', range: 11 }, use(m, h, a) { fan(a, 3, 0.24).forEach((d, i) => m.after(i * 0.08, () => m.beam(h, d.dx, d.dz, 12, 0.85, 520))); } },
  },
  {
    id: 'melli', name: 'MELLI', art: melliArt, color: '#f2b22e',
    role: T('Ingenieurin', 'Engineer'), tagline: T('Ihr Honig klebt. Ihre Bombe knallt.', 'Her honey sticks. Her bomb bangs.'),
    hp: 4600, speed: 5.5, reload: 1.4, ammo: 3, range: 6.2, projSpeed: 18, prefDist: 4, ultCharge: 4600,
    aim: { type: 'cone', spread: 0.3 }, stats: { atk: 4, def: 4, spd: 2, paint: 4 },
    desc: {
      attack: skill('Honig-Schrot', 'Honey Scatter', 'Vier klebrige Kleckse – nah am Gegner stark.', 'Four sticky blobs – strong up close.'),
      ability: skill('Klebefalle', 'Sticky Trap', 'Honigfeld, das Gegner stark verlangsamt.', 'A honey field that slows enemies a lot.'),
      ult: skill('Waben-Bombe', 'Comb Bomb', 'Wirft eine riesige Bombe mit gewaltigem Radius.', 'Lobs a giant bomb with a huge radius.'),
    },
    attack(m, h, a) { for (const d of fan(a, 4, 0.16)) m.shoot(h, { dx: d.dx, dz: d.dz, speed: 18, range: 6.2, dmg: 195, paintR: 1.0, trailR: 0.5, size: 1.1 }); },
    ability: { cd: 8, range: 7, aim: 'area', radius: 3.6, ai: { type: 'area', range: 7 }, use(m, h, a) { m.addZone({ type: 'trap', owner: h, x: h.x + a.dx * a.dist, z: h.z + a.dz * a.dist, r: 3.6, dur: 5, tick: 0.5, dmg: 70, slow: 0.45, paintN: 2 }); } },
    ult: megaBomb,
  },
  {
    id: 'nimbi', name: 'NIMBI', art: nimbiArt, color: '#b49ae6',
    role: T('Supporterin', 'Support'), tagline: T('Kopf in den Wolken, Team im Blick.', 'Head in the clouds, eyes on the team.'),
    hp: 3600, speed: 6.1, reload: 1.25, ammo: 3, range: 8, projSpeed: 14, prefDist: 5.5, ultCharge: 4000,
    aim: { type: 'cone', spread: 0.24 }, stats: { atk: 2, def: 2, spd: 4, paint: 5 },
    desc: {
      attack: skill('Wolken-Blasen', 'Cloud Bubbles', 'Drei dicke Farbblasen im Fächer.', 'Three fat paint bubbles in a fan.'),
      ability: skill('Regenpfütze', 'Rain Puddle', 'Pfütze, die dich und Verbündete heilt.', 'A puddle that heals you and your allies.'),
      ult: skill('Wolkenbruch', 'Cloudburst', 'Riesige Farbwelle, die Gegner wegschiebt.', 'Huge paint wave that shoves enemies back.'),
    },
    attack: bubbles, ability: healPuddle, ult: tsunami,
  },
  {
    id: 'luma', name: 'LUMA', art: lumaArt, face: [190, -8], color: '#ff7ab8',
    role: T('Scharfschützin', 'Sharpshooter'), tagline: T('Mondmagierin. Trifft von ganz weit weg.', 'Moon mage. Hits from very far away.'),
    hp: 2700, speed: 5.9, reload: 1.55, ammo: 3, range: 11.5, projSpeed: 30, prefDist: 8.5, ultCharge: 4000,
    aim: { type: 'line', width: 0.6 }, stats: { atk: 5, def: 1, spd: 3, paint: 4 },
    desc: {
      attack: skill('Mond-Tropfen', 'Moon Drop', 'Schneller Schuss mit riesiger Reichweite.', 'Fast shot with huge range.'),
      ability: skill('Mondstrahl', 'Moonbeam', 'Strahl, der alle Gegner in einer Linie trifft.', 'Beam that hits every enemy in a line.'),
      ult: skill('Farbregen', 'Paint Rain', 'Lässt es in einem großen Gebiet Farbe regnen.', 'Makes it rain paint over a large area.'),
    },
    attack(m, h, a) { m.shoot(h, { dx: a.dx, dz: a.dz, speed: 30, range: 11.5, dmg: 470, paintR: 1.3, trailR: 0.7, size: 1.15 }); },
    ability: { cd: 7, range: 13, aim: 'line', width: 1.0, ai: { type: 'skillshot', range: 12 }, use(m, h, a) { m.beam(h, a.dx, a.dz, 13, 0.85, 560); } },
    ult: { range: 11, aim: 'area', radius: 5, ai: { type: 'area', range: 11 }, use(m, h, a) { m.addZone({ type: 'rain', owner: h, x: h.x + a.dx * a.dist, z: h.z + a.dz * a.dist, r: 5, dur: 4.2, tick: 0.4, dmg: 200, slow: 0.75, paintN: 4 }); } },
  },
  {
    id: 'bruno', name: 'BRUNO', art: brunoArt, color: '#f0a92a',
    role: T('Tank', 'Tank'), tagline: T('Zwei Tanks auf dem Rücken, einer im Namen.', 'Two tanks on his back, one in his job title.'),
    hp: 5400, speed: 5.2, reload: 1.45, ammo: 3, range: 6.2, projSpeed: 19, prefDist: 3.6, ultCharge: 4800,
    aim: { type: 'cone', spread: 0.36 }, stats: { atk: 4, def: 5, spd: 2, paint: 4 },
    desc: {
      attack: skill('Klecks-Kanone', 'Splodge Cannon', 'Fächer aus fünf Farbklecksen – nah am Gegner brutal.', 'Fan of five paint blobs – brutal up close.'),
      ability: skill('Bodenstampfer', 'Ground Stomp', 'Stampft auf: Schaden, Rückstoß und Farbe rundherum.', 'Stomp: damage, knockback and paint all around.'),
      ult: skill('Hochdruck', 'High Pressure', 'Dauerfeuer aus beiden Tanks. Hält dabei mehr aus.', 'Sustained fire from both tanks. Takes less damage meanwhile.'),
    },
    attack: shotgun, ability: stomp,
    ult: { range: 8.5, aim: 'cone', spread: 0.34, ai: { type: 'skillshot', range: 6.5 }, use(m, h, a) { m.spray(h, a.dx, a.dz, 2.6, 0.3, { speed: 20, range: 8.5, dmg: 150, paintR: 1.25, trailR: 0.8, size: 1.15 }); } },
  },
  {
    id: 'skye', name: 'SKYE', art: skyeArt, color: '#2ee0d0',
    role: T('Fliegerin', 'Flyer'), tagline: T('Kommt von oben. Ist schon wieder weg.', 'Comes from above. Already gone again.'),
    hp: 3300, speed: 6.5, reload: 1.1, ammo: 3, range: 9.5, projSpeed: 24, prefDist: 6.5, ultCharge: 4200,
    aim: { type: 'line', width: 0.7 }, stats: { atk: 3, def: 2, spd: 5, paint: 3 },
    desc: {
      attack: skill('Feder-Salve', 'Feather Burst', 'Drei Schüsse in schneller Folge.', 'Three shots in quick succession.'),
      ability: skill('Sturzflug', 'Dive', 'Sehr weiter Sprint durch Gegner hindurch.', 'A very long dash straight through enemies.'),
      ult: skill('Luftschlag', 'Air Strike', 'Vier Bomben schlagen in einer Linie ein.', 'Four bombs hit along a line.'),
    },
    attack(m, h, a) { for (let i = 0; i < 3; i++) m.after(i * 0.08, () => m.shoot(h, { dx: a.dx, dz: a.dz, side: (i - 1) * 0.14, speed: 24, range: 9.5, dmg: 235, paintR: 0.95, trailR: 0.55 })); },
    ability: { cd: 7, range: 8, aim: 'line', width: 1.2, ai: { type: 'dash', min: 3.5, max: 8.5 }, use(m, h, a) { m.dash(h, a.dx, a.dz, 8, 0.3, { dmg: 320, paintR: 1.2 }); } },
    ult: { range: 12.5, aim: 'line', width: 5, ai: { type: 'skillshot', range: 10 }, use(m, h, a) { for (let i = 0; i < 4; i++) m.after(i * 0.14, () => m.lob(h, h.x + a.dx * (3.2 + i * 3.1), h.z + a.dz * (3.2 + i * 3.1), { time: 0.55, dmg: 600, radius: 2.8, paintR: 3.0, knock: 4, size: 0.5 })); } },
  },
  {
    id: 'grom', name: 'GROM', art: gromArt, face: [330, -44], color: '#f07a2a',
    role: T('Koloss', 'Juggernaut'), tagline: T('Langsam. Aber versuch mal, ihn aufzuhalten.', 'Slow. But try stopping him.'),
    hp: 6200, speed: 4.9, reload: 1.6, ammo: 3, range: 7, projSpeed: 16, prefDist: 3.8, ultCharge: 5000,
    aim: { type: 'line', width: 1.2 }, stats: { atk: 3, def: 5, spd: 1, paint: 5 },
    desc: {
      attack: skill('Wasserkugel', 'Water Ball', 'Ein dicker Brocken mit riesigem Farbklecks.', 'One heavy ball with a huge paint splat.'),
      ability: skill('Wasserschild', 'Water Shield', 'Kurz unverwundbar und stößt Gegner weg.', 'Briefly invulnerable and shoves enemies away.'),
      ult: skill('Flutwelle', 'Tidal Wave', 'Riesige Farbwelle, die Gegner wegschiebt.', 'Huge paint wave that shoves enemies back.'),
    },
    attack(m, h, a) { m.shoot(h, { dx: a.dx, dz: a.dz, speed: 16, range: 7, dmg: 560, paintR: 1.9, trailR: 1.0, size: 1.9, hitR: 0.5, knock: 2 }); },
    ability: { cd: 10, range: 3.2, aim: 'self', radius: 3.2, ai: { type: 'near', range: 3.2 }, use(m, h) { h.shield = 2.5; m.burst(h, h.x, h.z, 3.2, 260, { paintR: 3.2, knock: 9 }); } },
    ult: tsunami,
  },
];

export const heroById = (id) => HEROES.find((h) => h.id === id) || HEROES[0];
