// Hero roster. Every hero has a clear job and a kit nobody else has:
//   attack  – costs ammo            ability – on a cooldown
//   ult     – charges with damage and paint
//   passive – always on (flags under `passive` are read by game.js)
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

export const HEROES = [
  {
    id: 'jaro', name: 'JARO', art: jaroArt, aspect: 0.638, size: 1.0, color: '#3fd18f',
    role: T('Assassine', 'Assassin'), tagline: T('Rein, klatschen, raus. Schneller als sein Schatten.', 'In, splat, out. Faster than his shadow.'),
    hp: 3300, speed: 6.9, reload: 1.0, ammo: 3, range: 8.5, projSpeed: 22, prefDist: 5.5, ultCharge: 4200,
    aim: { type: 'line', width: 0.8 }, stats: { atk: 4, def: 2, spd: 5, paint: 2 },
    passive: { ownSpeed: 1.32, resetOnKill: true },
    desc: {
      passive: skill('Im Fluss', 'In the Flow', 'Auf eigener Farbe extra schnell. Jeder K.O. macht den Sprint sofort wieder bereit.', 'Extra fast on own paint. Every K.O. readies the dash again.'),
      attack: skill('Doppel-Spray', 'Double Spray', 'Zwei schnelle Farbschüsse.', 'Two quick paint shots.'),
      ability: skill('Schattensprint', 'Shadow Dash', 'Saust nach vorn, zieht eine Farbspur und rammt Gegner.', 'Dashes forward, leaves a paint trail and rams enemies.'),
      ult: skill('Farb-Tornado', 'Paint Tornado', 'Wirbelt herum und sprüht Farbe in alle Richtungen.', 'Spins and sprays paint in every direction.'),
    },
    attack(m, h, a) { for (let i = 0; i < 2; i++) m.after(i * 0.11, () => m.shoot(h, { dx: a.dx, dz: a.dz, side: i ? 0.2 : -0.2, speed: 22, range: 8.5, dmg: 385, paintR: 1.1, trailR: 0.55 })); },
    ability: { cd: 6, range: 6.5, aim: 'line', width: 1.2, ai: { type: 'dash', min: 3, max: 7.5 }, use(m, h, a) { m.dash(h, a.dx, a.dz, 6.5, 0.26, { dmg: 380, paintR: 1.25 }); } },
    ult: { range: 6, aim: 'self', radius: 6, ai: { type: 'near', range: 5 }, use(m, h) { m.startSpin(h, 2.6); } },
  },
  {
    id: 'pippa', name: 'PIPPA', art: pippaArt, aspect: 0.700, size: 0.96, color: '#ff8a4a',
    role: T('Heilerin', 'Healer'), tagline: T('Wo sie hintritt, wächst Farbe – und das Team bleibt stehen.', 'Wherever she steps, colour grows – and the team stays up.'),
    hp: 3500, speed: 5.9, reload: 1.3, ammo: 3, range: 8, projSpeed: 14, prefDist: 5.5, ultCharge: 4000,
    aim: { type: 'cone', spread: 0.24 }, stats: { atk: 2, def: 3, spd: 3, paint: 4 },
    passive: { aura: { r: 5, heal: 55 } },
    desc: {
      passive: skill('Grüner Daumen', 'Green Thumb', 'Verbündete in ihrer Nähe heilen ständig ein wenig.', 'Allies near her keep healing a little.'),
      attack: skill('Samen-Salve', 'Seed Volley', 'Drei dicke Farbsamen im Fächer.', 'Three fat paint seeds in a fan.'),
      ability: skill('Heil-Pfütze', 'Healing Puddle', 'Pfütze, die dich und Verbündete kräftig heilt.', 'A puddle that heals you and your allies strongly.'),
      ult: skill('Blütenmeer', 'Bloom Field', 'Großes Feld: heilt Freunde, schadet Gegnern, färbt alles.', 'Big field: heals friends, hurts enemies, paints everything.'),
    },
    attack(m, h, a) { for (const d of fan(a, 3, 0.2)) m.shoot(h, { dx: d.dx, dz: d.dz, speed: 14, range: 8, dmg: 230, paintR: 1.3, trailR: 0.7, size: 1.3, hitR: 0.42 }); },
    ability: { cd: 9, range: 3.8, aim: 'self', radius: 3.8, ai: { type: 'heal', range: 3.8 }, use(m, h) { m.addZone({ type: 'heal', owner: h, x: h.x, z: h.z, r: 3.8, dur: 4, tick: 0.5, heal: 270 }); } },
    ult: { range: 8, aim: 'area', radius: 5.5, ai: { type: 'area', range: 8 }, use(m, h, a) { m.addZone({ type: 'bloom', owner: h, x: h.x + a.dx * a.dist, z: h.z + a.dz * a.dist, r: 5.5, dur: 5, tick: 0.5, heal: 190, dmg: 90, paintN: 4 }); } },
  },
  {
    id: 'zyro', name: 'ZYRO', art: zyroArt, aspect: 0.765, size: 1.06, color: '#4fd6b0',
    role: T('Kämpfer', 'Fighter'), tagline: T('Springt mitten rein und steht danach noch.', 'Jumps right in and is still standing afterwards.'),
    hp: 4300, speed: 5.8, reload: 1.25, ammo: 3, range: 7, projSpeed: 20, prefDist: 4.2, ultCharge: 4400,
    aim: { type: 'cone', spread: 0.16 }, stats: { atk: 4, def: 4, spd: 3, paint: 3 },
    passive: { barrier: 600 },
    desc: {
      passive: skill('Kristallhaut', 'Crystal Skin', 'Ohne Treffer wächst nach 4 Sekunden ein Schild, der Schaden schluckt.', 'After 4 seconds without being hit a shield grows that soaks damage.'),
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
    id: 'byte', name: 'BYTE', art: byteArt, face: [220, -8], aspect: 0.730, size: 0.9, color: '#ffb21f',
    role: T('Tüftler', 'Tinkerer'), tagline: T('Klein, frech – und nie allein: sein Geschütz schießt mit.', 'Small, cheeky – and never alone: his turret shoots too.'),
    hp: 3200, speed: 6.2, reload: 0.58, ammo: 4, range: 9.5, projSpeed: 26, prefDist: 7, ultCharge: 4000,
    aim: { type: 'line', width: 0.6 }, stats: { atk: 4, def: 1, spd: 4, paint: 3 },
    passive: { overclock: 4 },
    desc: {
      passive: skill('Übertaktet', 'Overclocked', 'Jeder vierte Schuss ist aufgeladen: doppelter Schaden, fliegt durch Gegner.', 'Every fourth shot is charged: double damage, flies through enemies.'),
      attack: skill('Schnellfeuer', 'Rapid Fire', 'Einzelschüsse, die extrem schnell nachladen.', 'Single shots that reload extremely fast.'),
      ability: skill('Geschützturm', 'Turret', 'Stellt ein Geschütz auf, das Gegner beschießt und Farbe verteilt.', 'Sets up a turret that shoots enemies and spreads paint.'),
      ult: skill('Laser-Gitter', 'Laser Grid', 'Drei Strahlen im Fächer, die alles durchschlagen.', 'Three beams in a fan that pierce everything.'),
    },
    attack(m, h, a) {
      h.shots = (h.shots || 0) + 1;
      const charged = h.shots % 4 === 0;
      m.shoot(h, { dx: a.dx, dz: a.dz, speed: 26, range: 9.5, dmg: charged ? 680 : 340, paintR: charged ? 1.5 : 1.0, trailR: charged ? 0.8 : 0.55, size: charged ? 1.6 : 1, pierce: charged });
    },
    ability: { cd: 11, range: 5, aim: 'area', radius: 1.2, ai: { type: 'summon', range: 9 }, use(m, h, a) { m.addTurret(h, h.x + a.dx * a.dist, h.z + a.dz * a.dist, { hp: 1500, dur: 14, range: 7.5, dmg: 185, rate: 0.55 }); } },
    ult: { range: 12, aim: 'cone', spread: 0.34, ai: { type: 'skillshot', range: 11 }, use(m, h, a) { fan(a, 3, 0.24).forEach((d, i) => m.after(i * 0.08, () => m.beam(h, d.dx, d.dz, 12, 0.85, 520))); } },
  },
  {
    id: 'melli', name: 'MELLI', art: melliArt, aspect: 0.723, size: 1.0, color: '#f2b22e',
    role: T('Kontrolle', 'Controller'), tagline: T('Wer in ihrem Honig klebt, kommt nicht mehr weg.', 'Whoever sticks in her honey is not getting away.'),
    hp: 4600, speed: 5.5, reload: 1.4, ammo: 3, range: 6.2, projSpeed: 18, prefDist: 4, ultCharge: 4600,
    aim: { type: 'cone', spread: 0.3 }, stats: { atk: 3, def: 4, spd: 2, paint: 4 },
    passive: { sticky: { t: 1.2, f: 0.78 } },
    desc: {
      passive: skill('Klebrig', 'Sticky', 'Jeder ihrer Treffer macht Gegner kurz langsamer.', 'Every one of her hits slows enemies for a moment.'),
      attack: skill('Honig-Schrot', 'Honey Scatter', 'Vier klebrige Kleckse – nah am Gegner stark.', 'Four sticky blobs – strong up close.'),
      ability: skill('Klebefalle', 'Sticky Trap', 'Honigfeld, das Gegner stark verlangsamt.', 'A honey field that slows enemies a lot.'),
      ult: skill('Waben-Bombe', 'Comb Bomb', 'Riesige Bombe, die ein Honigfeld zurücklässt.', 'Giant bomb that leaves a honey field behind.'),
    },
    attack(m, h, a) { for (const d of fan(a, 4, 0.16)) m.shoot(h, { dx: d.dx, dz: d.dz, speed: 18, range: 6.2, dmg: 195, paintR: 1.0, trailR: 0.5, size: 1.1, slow: h.def.passive.sticky }); },
    ability: { cd: 8, range: 7, aim: 'area', radius: 3.6, ai: { type: 'area', range: 7 }, use(m, h, a) { m.addZone({ type: 'trap', owner: h, x: h.x + a.dx * a.dist, z: h.z + a.dz * a.dist, r: 3.6, dur: 5, tick: 0.5, dmg: 70, slow: 0.45, paintN: 2 }); } },
    ult: {
      range: 9.5, aim: 'area', radius: 5, ai: { type: 'area', range: 9.5 },
      use(m, h, a) { m.lob(h, h.x + a.dx * a.dist, h.z + a.dz * a.dist, { time: 0.85, dmg: 1150, radius: 5, paintR: 5.4, knock: 5, size: 0.9, onLand: (x, z) => m.addZone({ type: 'trap', owner: h, x, z, r: 4.4, dur: 4, tick: 0.5, dmg: 60, slow: 0.5, paintN: 2 }) }); },
    },
  },
  {
    id: 'nimbi', name: 'NIMBI', art: nimbiArt, aspect: 0.648, size: 0.96, color: '#b49ae6',
    role: T('Unterstützerin', 'Enchanter'), tagline: T('Macht ihr Team schneller und rettet es im letzten Moment.', 'Makes her team faster and saves it at the last moment.'),
    hp: 3500, speed: 6.1, reload: 1.15, ammo: 3, range: 9, projSpeed: 13, prefDist: 6, ultCharge: 4000,
    aim: { type: 'line', width: 1.3 }, stats: { atk: 2, def: 2, spd: 4, paint: 4 },
    passive: { guardian: { r: 7, cd: 12, t: 1.6 } },
    desc: {
      passive: skill('Schutzwolke', 'Guardian Cloud', 'Fällt ein Verbündeter in ihrer Nähe fast um, bekommt er automatisch einen Schild.', 'When a nearby ally is about to go down, they get a shield automatically.'),
      attack: skill('Wolkenball', 'Cloud Ball', 'Große Blase: fliegt durch alle hindurch, schadet Gegnern und heilt Verbündete.', 'Big bubble: flies through everyone, hurts enemies and heals allies.'),
      ability: skill('Rückenwind', 'Tailwind', 'Du und Verbündete in der Nähe laufen und laden 4 Sekunden schneller.', 'You and nearby allies move and reload faster for 4 seconds.'),
      ult: skill('Wolkenbruch', 'Cloudburst', 'Riesige Farbwelle, die Gegner wegschiebt.', 'Huge paint wave that shoves enemies back.'),
    },
    attack(m, h, a) { m.shoot(h, { dx: a.dx, dz: a.dz, speed: 13, range: 9, dmg: 330, paintR: 1.5, trailR: 0.9, size: 1.9, hitR: 0.65, pierce: true, healAllies: 300 }); },
    ability: { cd: 10, range: 5.5, aim: 'self', radius: 5.5, ai: { type: 'buff', range: 9 }, use(m, h) { m.haste(h, 5.5, 4); } },
    ult: {
      range: 12, aim: 'line', width: 6.4, ai: { type: 'skillshot', range: 9 },
      use(m, h, a) {
        const hitSet = new Set(); // the whole wave hits each enemy only once
        for (let i = -3; i <= 3; i++) m.shoot(h, { dx: a.dx, dz: a.dz, side: i, speed: 15, range: 12, dmg: 700, paintR: 1.6, trailR: 1.25, size: 1.7, hitR: 0.6, pierce: true, knock: 7, hitSet });
      },
    },
  },
  {
    id: 'luma', name: 'LUMA', art: lumaArt, face: [190, -8], aspect: 0.689, size: 1.0, color: '#ff7ab8',
    role: T('Scharfschützin', 'Sniper'), tagline: T('Je weiter weg, desto gefährlicher.', 'The farther away, the more dangerous.'),
    hp: 2700, speed: 5.9, reload: 1.55, ammo: 3, range: 11.5, projSpeed: 30, prefDist: 9, ultCharge: 4000,
    aim: { type: 'line', width: 0.6 }, stats: { atk: 5, def: 1, spd: 3, paint: 3 },
    passive: { ramp: true },
    desc: {
      passive: skill('Fernblick', 'Long Sight', 'Ihre Schüsse werden stärker, je weiter sie fliegen – aus der Nähe sind sie schwach.', 'Her shots grow stronger the farther they fly – up close they are weak.'),
      attack: skill('Mond-Tropfen', 'Moon Drop', 'Schneller Schuss mit riesiger Reichweite.', 'Fast shot with huge range.'),
      ability: skill('Mondstrahl', 'Moonbeam', 'Strahl, der alle Gegner in einer Linie trifft.', 'Beam that hits every enemy in a line.'),
      ult: skill('Farbregen', 'Paint Rain', 'Lässt es in einem großen Gebiet Farbe regnen.', 'Makes it rain paint over a large area.'),
    },
    attack(m, h, a) { m.shoot(h, { dx: a.dx, dz: a.dz, speed: 30, range: 11.5, dmg: 590, ramp: 0.5, paintR: 1.3, trailR: 0.7, size: 1.15 }); },
    ability: { cd: 7, range: 13, aim: 'line', width: 1.0, ai: { type: 'skillshot', range: 12 }, use(m, h, a) { m.beam(h, a.dx, a.dz, 13, 0.85, 560); } },
    ult: { range: 11, aim: 'area', radius: 5, ai: { type: 'area', range: 11 }, use(m, h, a) { m.addZone({ type: 'rain', owner: h, x: h.x + a.dx * a.dist, z: h.z + a.dz * a.dist, r: 5, dur: 4.2, tick: 0.4, dmg: 200, slow: 0.75, paintN: 4 }); } },
  },
  {
    id: 'bruno', name: 'BRUNO', art: brunoArt, aspect: 0.802, size: 1.1, color: '#f0a92a',
    role: T('Tank', 'Tank'), tagline: T('Steht vorne. Bleibt vorne.', 'Stands in front. Stays in front.'),
    hp: 5400, speed: 5.2, reload: 1.45, ammo: 3, range: 6.2, projSpeed: 19, prefDist: 3.6, ultCharge: 4800,
    aim: { type: 'cone', spread: 0.36 }, stats: { atk: 3, def: 5, spd: 2, paint: 4 },
    passive: { thickSkin: 0.7 },
    desc: {
      passive: skill('Dickes Fell', 'Thick Skin', 'Unter halbem Leben nimmt er 30 % weniger Schaden.', 'Below half health he takes 30% less damage.'),
      attack: skill('Klecks-Kanone', 'Splodge Cannon', 'Fächer aus fünf Farbklecksen – nah am Gegner brutal.', 'Fan of five paint blobs – brutal up close.'),
      ability: skill('Bodenstampfer', 'Ground Stomp', 'Stampft auf: Schaden, Rückstoß und Farbe rundherum.', 'Stomp: damage, knockback and paint all around.'),
      ult: skill('Hochdruck', 'High Pressure', 'Dauerfeuer aus beiden Tanks. Hält dabei mehr aus.', 'Sustained fire from both tanks. Takes less damage meanwhile.'),
    },
    attack(m, h, a) { for (const d of fan(a, 5, 0.17)) m.shoot(h, { dx: d.dx, dz: d.dz, speed: 19, range: 6.2 - Math.abs(d.i) * 0.3, dmg: 180, paintR: 0.95, trailR: 0.5 }); },
    ability: { cd: 8, range: 4.2, aim: 'self', radius: 4.2, ai: { type: 'near', range: 3.4 }, use(m, h) { m.burst(h, h.x, h.z, 4.2, 480, { paintR: 4.0, knock: 9, slow: 1.2 }); h.kick = 1.6; } },
    ult: { range: 8.5, aim: 'cone', spread: 0.34, ai: { type: 'skillshot', range: 6.5 }, use(m, h, a) { m.spray(h, a.dx, a.dz, 2.6, 0.3, { speed: 20, range: 8.5, dmg: 150, paintR: 1.25, trailR: 0.8, size: 1.15 }); } },
  },
  {
    id: 'skye', name: 'SKYE', art: skyeArt, aspect: 0.594, size: 1.0, color: '#2ee0d0',
    role: T('Fliegerin', 'Flyer'), tagline: T('Wände? Fliegt sie einfach drüber.', 'Walls? She just flies over them.'),
    hp: 3300, speed: 6.5, reload: 1.1, ammo: 3, range: 9.5, projSpeed: 24, prefDist: 6.5, ultCharge: 4200,
    aim: { type: 'line', width: 0.7 }, stats: { atk: 3, def: 2, spd: 5, paint: 3 },
    passive: { afterDash: 2.5 },
    desc: {
      passive: skill('Aufwind', 'Updraft', 'Nach dem Sturzflug lädt und läuft sie kurz deutlich schneller.', 'After a dive she reloads and runs much faster for a moment.'),
      attack: skill('Feder-Salve', 'Feather Burst', 'Drei Schüsse in schneller Folge.', 'Three shots in quick succession.'),
      ability: skill('Sturzflug', 'Dive', 'Fliegt weit nach vorn – auch über Deckung hinweg.', 'Flies far forward – even over cover.'),
      ult: skill('Luftschlag', 'Air Strike', 'Vier Bomben schlagen in einer Linie ein.', 'Four bombs hit along a line.'),
    },
    attack(m, h, a) { for (let i = 0; i < 3; i++) m.after(i * 0.08, () => m.shoot(h, { dx: a.dx, dz: a.dz, side: (i - 1) * 0.14, speed: 24, range: 9.5, dmg: 255, paintR: 0.95, trailR: 0.55 })); },
    ability: { cd: 7, range: 8, aim: 'line', width: 1.2, ai: { type: 'dash', min: 3.5, max: 8.5 }, use(m, h, a) { m.dash(h, a.dx, a.dz, 8, 0.32, { dmg: 400, paintR: 1.2, fly: true }); } },
    ult: { range: 12.5, aim: 'line', width: 5, ai: { type: 'skillshot', range: 10 }, use(m, h, a) { for (let i = 0; i < 4; i++) m.after(i * 0.14, () => m.lob(h, h.x + a.dx * (3.2 + i * 3.1), h.z + a.dz * (3.2 + i * 3.1), { time: 0.55, dmg: 600, radius: 2.8, paintR: 3.0, knock: 4, size: 0.5 })); } },
  },
  {
    id: 'grom', name: 'GROM', art: gromArt, face: [330, -44], aspect: 0.964, size: 1.22, color: '#f07a2a',
    role: T('Koloss', 'Juggernaut'), tagline: T('Langsam. Aber versuch mal, ihn aufzuhalten.', 'Slow. But try stopping him.'),
    hp: 6200, speed: 4.9, reload: 1.6, ammo: 3, range: 7, projSpeed: 16, prefDist: 3.8, ultCharge: 5000,
    aim: { type: 'line', width: 1.2 }, stats: { atk: 3, def: 5, spd: 1, paint: 5 },
    passive: { unstoppable: true },
    desc: {
      passive: skill('Unaufhaltsam', 'Unstoppable', 'Kann nicht verlangsamt oder weggestoßen werden. Gegnerfarbe bremst ihn nicht.', 'Cannot be slowed or shoved. Enemy paint does not slow him.'),
      attack: skill('Wasserkugel', 'Water Ball', 'Ein dicker Brocken mit riesigem Farbklecks.', 'One heavy ball with a huge paint splat.'),
      ability: skill('Wasserschild', 'Water Shield', 'Kurz unverwundbar und stößt Gegner weg.', 'Briefly invulnerable and shoves enemies away.'),
      ult: skill('Erdbeben', 'Earthquake', 'Gewaltiger Schlag rundherum: Schaden, Farbe und Gegner kleben am Boden.', 'Massive slam all around: damage, paint, and enemies are rooted.'),
    },
    attack(m, h, a) { m.shoot(h, { dx: a.dx, dz: a.dz, speed: 16, range: 7, dmg: 560, paintR: 1.9, trailR: 1.0, size: 1.9, hitR: 0.5, knock: 2 }); },
    ability: { cd: 10, range: 3.2, aim: 'self', radius: 3.2, ai: { type: 'near', range: 3.2 }, use(m, h) { h.shield = 2.5; m.burst(h, h.x, h.z, 3.2, 260, { paintR: 3.2, knock: 9 }); } },
    ult: { range: 6.5, aim: 'self', radius: 6.5, ai: { type: 'near', range: 5 }, use(m, h) { m.burst(h, h.x, h.z, 6.5, 900, { paintR: 6.5, slow: 1.5, slowF: 0.12 }); h.kick = 2; } },
  },
];

export const heroById = (id) => HEROES.find((h) => h.id === id) || HEROES[0];

// Talents: at level 3, 5 and 7 every hero picks one of three. This is where a match gets its build.
export const TALENTS = [
  { id: 'dmg', name: T('Wucht', 'Power'), text: T('+15 % Schaden', '+15% damage'), apply: (h) => { h.mod.dmg *= 1.15; } },
  { id: 'hp', name: T('Panzerung', 'Armour'), text: T('+20 % Leben', '+20% health'), apply: (h) => { h.mod.hp *= 1.2; } },
  { id: 'speed', name: T('Turbo', 'Turbo'), text: T('+10 % Tempo', '+10% speed'), apply: (h) => { h.mod.speed *= 1.1; } },
  { id: 'reload', name: T('Schnelllader', 'Quick Loader'), text: T('+25 % Nachladen', '+25% reload'), apply: (h) => { h.mod.reload *= 1.25; } },
  { id: 'paint', name: T('Farbflut', 'Paint Flood'), text: T('+25 % Farbradius', '+25% paint radius'), apply: (h) => { h.mod.paint *= 1.25; } },
  { id: 'cdr', name: T('Fokus', 'Focus'), text: T('Fähigkeit 25 % öfter', 'Ability 25% more often'), apply: (h) => { h.mod.cdr *= 0.75; } },
  { id: 'vamp', name: T('Vampir', 'Vampire'), text: T('Heilt 12 % deines Schadens', 'Heals 12% of your damage'), apply: (h) => { h.mod.vamp += 0.12; } },
  { id: 'ult', name: T('Ulti-Lader', 'Ult Charger'), text: T('Ulti lädt 30 % schneller', 'Ult charges 30% faster'), apply: (h) => { h.mod.ult *= 1.3; } },
];
export const TALENT_LEVELS = [3, 5, 7];
