# DRIP CLASH (Arbeitstitel)

3-gegen-3 Farb-Brawler in 3D, Querformat, mobile-first. Erste spielbare Version.

Die Idee kombiniert drei Genres zu einem eigenen Spiel:

| Zutat | Was davon im Spiel steckt |
| --- | --- |
| Top-down Hero-Shooter | Kurze 3-Minuten-Matches, Twin-Stick-Steuerung, Munition + Ulti, die sich durch Treffer auflädt |
| Farb-Shooter | Jeder Schuss färbt den Boden. Eigene Farbe = schneller laufen, schneller nachladen, heilen. Gegnerfarbe bremst und schadet |
| MOBA | Lane mit Blob-Wellen, Turm und Kern pro Team, Fähigkeiten mit Cooldown, Level-ups im Match |

**Der Twist, der alles verbindet:** Türme und Kern haben ein *Farb-Schild*. Solange der Boden um sie herum nicht in
deiner Farbe ist, prallt der meiste Schaden ab. Wer den Kern zerstört, gewinnt sofort – sonst gewinnt nach 3 Minuten
das Team mit mehr Farbe auf dem Feld.

![Match](docs/screenshots/match-1.png)
![Menü](docs/screenshots/menu-mochi.png)

## Helden

| Held | Rolle | Angriff | Fähigkeit | Ulti |
| --- | --- | --- | --- | --- |
| **Riko** | Flitzer | Doppel-Spray | Kickflip-Dash | Farb-Tornado |
| **Bombo** | Tank | Klecks-Kanone (Fächer) | Bodenstampfer | Mega-Bombe |
| **Kira** | Scharfschützin | Fern-Tropfen | Farbstrahl | Farbregen |
| **Mochi** | Supporterin | Blubber-Blasen | Heil-Pfütze | Tsunami |

Alle Figuren, Namen und Modelle sind eigene Entwürfe (prozedural aus 3D-Grundformen gebaut, keine externen Assets).

## Starten

```bash
npm install
npm run dev        # Entwicklungsserver, im Handy-Browser im selben WLAN öffnen
npm run build      # Produktions-Build nach dist/
npm run build:single   # eine einzelne, eigenständige index.html nach dist-single/
```

**Steuerung Handy:** linker Daumen = Lauf-Stick. Rechts: Angriff, Fähigkeit, Ulti. Antippen = Auto-Zielen,
Ziehen = selbst zielen, Loslassen = Schuss.

**Steuerung PC:** WASD laufen, Maus zielen + schießen, Leertaste/Rechtsklick Fähigkeit, E Ulti.

Test-Parameter in der URL: `?start=1&hero=kira` (Menü überspringen), `&autoplay=1` (Bot spielt für dich),
`&lang=en` / `&lang=de`.

## Aufbau

```
src/
  main.js     App-Start, Render-Loop, Wechsel Menü <-> Match, automatische Qualitätsanpassung
  game.js     Match-Simulation: Helden, Blobs, Türme, Kern, Projektile, Zonen, Kamera
  heroes.js   Helden-Daten und ihre Angriffe/Fähigkeiten (hier neue Helden hinzufügen)
  models.js   3D-Modelle der Figuren und Gebäude + Animation
  ai.js       Bot-KI (Rückzug, Kampf, Farmen, Pushen, Malen)
  paint.js    Farb-System: Logik-Raster + Canvas-Textur auf dem Boden
  world.js    Arena, Kollision, Wegfindung um Hindernisse
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
- Handgemachte 3D-Modelle/Animationen, Musik und Sounddesign
- Tests auf echten Geräten (bisher nur im Desktop-Browser und in der Handy-Emulation geprüft)
