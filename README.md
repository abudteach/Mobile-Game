# DRIP CLASH (Arbeitstitel)

3-gegen-3 Farb-Brawler in 3D, Querformat, mobile-first. Erste spielbare Version.

Die Idee kombiniert drei Genres zu einem eigenen Spiel:

| Zutat | Was davon im Spiel steckt |
| --- | --- |
| Top-down Hero-Shooter | Kurze 3-Minuten-Matches, Twin-Stick-Steuerung, Munition + Ulti, die sich durch Treffer auflädt |
| Farb-Shooter | Jeder Schuss färbt den Boden. Eigene Farbe = schneller laufen, schneller nachladen, heilen. Gegnerfarbe bremst und schadet |
| MOBA | Lane mit Blob-Wellen, Turm und Kern pro Team, neutrale Ziele, Fähigkeiten mit Cooldown, Level-ups und Talente im Match |

**Der Twist, der alles verbindet:** Türme und Kern haben ein *Farb-Schild*. Solange der Boden um sie herum nicht in
deiner Farbe ist, prallt der meiste Schaden ab. Wer den Kern zerstört, gewinnt sofort – sonst gewinnt nach 3 Minuten
das Team mit mehr Farbe auf dem Feld.

![Match](docs/screenshots/match-1.png)
![Menü](docs/screenshots/menu.png)

## Helden

Elf Helden nach eigenen Charakter-Designs. Jeder hat eine klare Rolle, eine passive Stärke und drei Fähigkeiten,
die kein anderer hat (`src/heroes.js`).

| Held | Rolle | Passiv | Angriff | Fähigkeit | Ulti |
| --- | --- | --- | --- | --- | --- |
| **Kio** | Assassine | Auf eigener Farbe extra schnell, K.O. setzt Sprint zurück | Doppel-Spray | Schattensprint | Farb-Tornado |
| **Pippa** | Heilerin | Heilt Verbündete in ihrer Nähe | Samen-Salve | Heil-Pfütze | Blütenmeer |
| **Prismo** | Kämpfer | Schild wächst nach, wenn er nicht getroffen wird | Splitter-Fächer | Kristallsturz | Kristallhagel |
| **Funk** | Tüftler | Jeder 4. Schuss ist aufgeladen | Schnellfeuer | Geschützturm | Laser-Gitter |
| **Sumsi** | Kontrolle | Treffer verlangsamen | Honig-Schrot | Klebefalle | Waben-Bombe |
| **Wuschel** | Unterstützerin | Rettet Verbündete mit einem Schild | Wolkenball (heilt Freunde) | Rückenwind | Wolkenbruch |
| **Luma** | Scharfschützin | Schüsse werden mit der Distanz stärker | Mond-Tropfen | Mondstrahl | Farbregen |
| **Klecks** | Tank | Unter halbem Leben 30 % weniger Schaden | Klecks-Kanone | Bodenstampfer | Hochdruck |
| **Manta** | Fliegerin | Nach dem Sturzflug kurz viel schneller | Feder-Salve | Sturzflug (über Deckung) | Luftschlag |
| **Taps** | Koloss | Kann nicht verlangsamt oder weggestoßen werden | Wasserkugel | Wasserschild | Erdbeben |
| **Flitz** | Trickser | Schüsse prallen von Wänden ab | Querschläger | Hakenschlag | Fuchsfeuer |

## Strategie

- **Drei Wege:** Mitte (Lane mit Blob-Wellen, Turm, Kern) und oben/unten je eine **Farbquelle**.
- **Farbquellen:** Wer den Ring um eine Quelle zu 60 % färbt, besitzt sie. Eine eigene Quelle spritzt regelmäßig
  Farbe in die Umgebung, schickt einen zusätzlichen Blob pro Welle und lässt die Ultis des Teams 20 % schneller laden.
- **Talente:** Auf Level 3, 5 und 7 wählt jeder Held eines von drei Talenten (Schaden, Leben, Tempo, Nachladen,
  Farbradius, Cooldown, Lebensraub, Ulti-Ladung). So entsteht in jedem Match ein eigener Build.
- **Farb-Schild:** Türme und Kern nehmen nur dann vollen Schaden, wenn der Boden um sie herum in deiner Farbe ist.
- **Turm-Regel:** Türme schießen zuerst auf Blobs. Ohne Blobs (oder Funks Geschütz) als Deckung trifft es dich.

## Waffen, Skins und Münzen

Jeder Held hat eine eigene Waffe (Name im Menü). Im Menü unter „Waffen" lassen sich Waffen-Skins mit Münzen kaufen
und pro Held ausrüsten. Ein Skin ändert Form und Funkenfarbe der Schüsse, nie die Stärke. Münzen gibt es nach jedem
Match (Sieg 50, Niederlage 20, plus K.O.s und gemalte Fläche). Gespeichert wird lokal auf dem Gerät (`src/store.js`).

Über „3D ansehen" zeigt das Menü das 3D-Modell des Helden mit Waffe: ziehen dreht es, antippen spielt den Angriff.

## Figuren im Match

Standard im Match sind die Artwork-Figuren; über den Schalter „Im Match" im Menü laufen stattdessen geriggte 3D-Modelle (`src/assets/models/*.glb`) mit Skelett und elf Animationen (Stehen, Laufen,
Rückwärts, Seitwärts, Angriff, Spezial, Treffer, K.O., Respawn). Die Beine folgen der Laufrichtung, der Oberkörper
spielt Angriff und Spezial darüber. Die Waffe leuchtet in der Teamfarbe.

Neue oder überarbeitete Modelle einspielen:

```bash
node tools/prepare-models.mjs <Ordner mit den .glb-Dateien>
```

Das Skript backt die Materialfarben in Vertex-Farben, vereinfacht und komprimiert die Modelle (ca. 1,7 MB → 0,3 MB
pro Figur) und legt sie nach `src/assets/models/`. Erwartet werden die Clip-Namen oben und die Dateinamen aus der
Tabelle im Skript.

Im Menü lässt sich auf „Artwork-Figuren" umschalten: dann laufen statt der 3D-Modelle die ausgeschnittenen
Charakterbilder (`src/assets/heroes/`) als animierte, immer zur Kamera gedrehte Figuren. Flitz hat noch kein
Artwork; sein Bild im Menü wird aus dem 3D-Modell gerendert.

## Starten

```bash
npm install
npm run dev        # Entwicklungsserver, im Handy-Browser im selben WLAN öffnen
npm run build      # Produktions-Build nach dist/
npm run build:single   # eine einzelne, eigenständige index.html nach dist-single/
```

**Steuerung Handy:** linker Daumen = Lauf-Stick. Rechts: Angriff, Fähigkeit, Ulti. Antippen = Auto-Zielen,
Ziehen = selbst zielen, Loslassen = Schuss.

**Steuerung PC:** WASD laufen, Maus zielen + schießen, Leertaste/Rechtsklick Fähigkeit, E Ulti, 1–3 Talent wählen.

Test-Parameter in der URL: `?start=1&hero=luma` (Menü überspringen), `&autoplay=1` (Bot spielt für dich),
`&lang=en` / `&lang=de`, `?models=1` (alle Figuren nebeneinander).

## Aufbau

```
src/
  main.js     App-Start, Render-Loop, Wechsel Menü <-> Match, automatische Qualitätsanpassung
  game.js     Match-Simulation: Helden, Blobs, Türme, Kern, Projektile, Zonen, Kamera
  heroes.js   Helden-Daten und ihre Angriffe/Fähigkeiten (hier neue Helden hinzufügen)
  models.js   Helden (3D-Modelle mit Animationen, alternativ Artwork-Figuren), Blobs, Türme, Kern, Geschütz, Farbquelle
  gfx.js      Render-Pipeline (Bloom, Tone-Mapping), Glow- und Rim-Light-Helfer
  view.js     Querformat-Bühne (dreht das Spiel, wenn das Handy hochkant gehalten wird)
  ai.js       Bot-KI (Rückzug, Kampf, Farmen, Pushen, Malen)
  paint.js    Farb-System: Logik-Raster + Canvas-Textur auf dem Boden
  world.js    Arena (Boden-Shader, Deckung, Tribüne, Deko), Kollision, Wegfindung um Hindernisse
  input.js    Touch-Sticks + Tastatur/Maus
  hud.js      Anzeige im Match (Farb-Balken, Minimap, Killfeed ...)
  menu.js     Heldenauswahl und Ergebnis-Screen
  fx.js       Partikel, Ringe, Strahlen, Screen-Shake
  audio.js    Sound komplett synthetisch (keine Audiodateien)
  i18n.js     Texte Deutsch/Englisch
```

Technik: [Three.js](https://threejs.org) + [Vite](https://vite.dev). Die App ist eine Web-App, die mit
[Capacitor](https://capacitorjs.com) als native Android-/iOS-App verpackt wird.

## In die Stores bringen (Play Store / App Store)

`capacitor.config.json` ist vorbereitet (`appId` vor dem ersten Release auf eure eigene Domain ändern –
sie lässt sich später nicht mehr wechseln).

```bash
npm install @capacitor/android @capacitor/ios
npm run build
npx cap add android
npx cap add ios          # nur auf einem Mac
npx cap sync
npx cap open android     # öffnet Android Studio
npx cap open ios         # öffnet Xcode
```

Querformat erzwingen:

- **Android:** in `android/app/src/main/AndroidManifest.xml` bei der `<activity>` `android:screenOrientation="sensorLandscape"` setzen.
- **iOS:** in Xcode unter *Deployment Info* nur *Landscape Left/Right* anhaken.

Was ihr für den Upload braucht:

- Google Play Developer-Konto (einmalig 25 $), signiertes `.aab` aus Android Studio.
- Apple Developer Program (99 $/Jahr), ein Mac mit Xcode, Upload über App Store Connect.
- App-Icons und Splash-Screens (z. B. mit `@capacitor/assets` aus einer 1024×1024-Grafik erzeugen), Store-Screenshots,
  Datenschutzerklärung, Altersfreigabe (IARC-Fragebogen).
- Zielgruppe Kinder/Jugendliche: Google-„Familien"-Richtlinien und Apples Kids-Regeln beachten, in der EU DSGVO
  (keine Tracking-SDKs/Werbe-IDs ohne Einwilligung der Eltern). Die aktuelle Version sammelt keine Daten und braucht
  kein Internet.
- Den Namen „Drip Clash" vor Veröffentlichung auf Marken- und Store-Kollisionen prüfen.

## Was in dieser ersten Version noch fehlt

- Echter Online-Multiplayer (aktuell spielt man mit und gegen Bots)
- Fortschritt: freischaltbare Helden, Skins, Trophäen-Liga, tägliche Aufgaben
- Mehr Karten und Spielmodi, mehr Helden
- Echte 3D-Modelle der Helden (siehe oben), Musik und Sounddesign
- Tests auf echten Geräten (bisher nur im Desktop-Browser und in der Handy-Emulation geprüft)
