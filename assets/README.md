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
