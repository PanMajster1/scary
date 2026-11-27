# Własne tekstury (opcjonalnie)

Gra jest w całości proceduralna i działa bez tego folderu. Jeśli chcesz podmienić tekstury na realistyczne zdjęcia
(np. darmowe, CC0 z ambientCG / Poly Haven), wrzuć pliki `.jpg` do `assets/tex/` pod tymi nazwami:

| plik | użycie |
|---|---|
| `floor.jpg` | posadzka korytarzy (lastryko) |
| `wall.jpg` | tynk ścian |
| `ceiling.jpg` | sufit podwieszany |
| `lino.jpg` | wykładzina / linoleum klas |
| `tiles.jpg` | płytki w WC |
| `pavement.jpg` | płyty na dziedzińcu |
| `asphalt.jpg` | asfalt |
| `wood.jpg` | drewno (biurka, drzwi) |

Dodatkowo utwórz `assets/tex/manifest.json` z listą użytych nazw, np. `["floor", "wall"]`. Tekstury ładują się przy starcie (w wersji `.exe` działają od razu; w przeglądarce wymagają
uruchomienia przez lokalny serwer, np. `python3 -m http.server`).

## Własne modele postaci (.glb)

Każdą postać możesz podmienić modelem 3D ze szkieletem (np. z Mixamo, Sketchfab, Quaternius). Wrzuć `.glb` do
`assets/models/` i dopisz go w `assets/models/manifest.json`, np.:

```json
{ "demkow": { "file": "soldier.glb", "scale": 1.0 }, "topinek": "topinek.glb", "pawlyszcze": "pawlyszcze.glb" }
```

Nazwy postaci: `topinek`, `demkow`, `pawlyszcze`, `orlowska`, `iduszkiewicz`, `kowalczyk`, `ziebinski`, `florczykiewicz`,
`mariusz`, `grymek`, `jelonek`, `porada`, `kaczmarczyk`, `rajca`, `student`. Model powinien mieć ok. 1,8 m wysokości
(w razie potrzeby podaj `scale`), twarzą do +Z, oraz animacje o nazwach zawierających `idle`, `walk` i `run`.
Modele ładują się przez `fetch`, więc w przeglądarce potrzebny jest serwer lokalny; wersja `.exe` działa od razu.
Dołączony `soldier.glb` (Vanguard, z przykładów three.js) to Mega Boss Demkow.
