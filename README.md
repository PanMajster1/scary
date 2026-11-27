# Ucieczka z TK 25: Szlugen Machen

3D First-Person Horror-Comedy / Stealth-Action w przeglądarce (HTML5 + Three.js + Pointer Lock + Web Audio).
Układ szkoły odwzorowany z planów ewakuacyjnych (przyziemie, parter, piętro lewe).

## Uruchomienie

Wystarczy otworzyć `index.html` w Chrome / Edge / Firefox (zalecany Chrome). Three.js ładuje się z CDN
(jsDelivr), a w razie braku internetu z lokalnej kopii `lib/three.min.js`.

```bash
# opcjonalnie, jeśli wolisz serwer lokalny
python3 -m http.server 8000   # i wejdź na http://localhost:8000
```

## Pliki

| plik | zawartość |
|---|---|
| `index.html` | menu, HUD w stylu GTA, modale (quiz, Packet Tracer, pauza, ekran końcowy) |
| `map.js` | siatka 0,5 m trzech pięter + dziedzińca, geometria, proceduralne tekstury, szyldy, meble, kryjówki, kolizje, A* między piętrami |
| `ai.js` | nauczyciele: modele, etykiety, maszyny stanów, wzrok (raycast po siatce), słuch, pościg po schodach |
| `game.js` | gracz, kampania (4 akty), gwiazdki, dzwonki, przedmioty, minigry, rekordy w `localStorage` |
| `audio.js` | cały dźwięk generowany w Web Audio (serce, dzwonek, SMS, syrena, kroki, pickupy…) |

## Sterowanie

`WASD` ruch • `Mysz` obrót • `Shift` sprint (hałas) • `Ctrl`/`C` kucanie • `E` interakcja / kryjówka •
`F` latarka • `Q` skill postaci • `G`/`LPM` użyj przedmiotu • `1-9` wybór przedmiotu • `R` Strzał ojcowski •
`M`/`Tab` plan szkoły • `Esc` pauza + ustawienia (czułość, głośność).

## Kampania

1. **Akt 1** – lekcja w W-02. Po 2 s SMS od Ziębińskiego. `E` na Topinku = 30 s bez przypału, uciekasz schodami na parter pod WC przy W-22.
2. **Akt 2** – zdejmij 3 zabezpieczenia Głównego Wyjścia (kolejność dowolna):
   Ventoy z W-02 + minigra Packet Tracer w Ślusarni (Elektrozamek), klucz z Pokoju Nauczycielskiego (Kłódka),
   3 kartki z zagadkami → kod do szafki „NIE RUSZAĆ — ZIĘBIŃSKI” → Fajka na trytytce (Trytytka).
   Dodatkowo: E-pet Duszkiewicza dla Mariusza → Strzał ojcowski (`R`).
3. **Akt 3** – 5 przysług u neutralnych nauczycieli (każda odejmuje 45 s od czasu do rangi).
4. **Akt 4** – wyjście na dziedziniec, obowiązkowy zakup w Lewiatanie (100 zł → 3★ i Demkow), bieg z Ziębińskim na Palarnię.
   Wiktor i Szymon mają dodatkowo sekretne zakończenia pojazdami.

Rangi (czas po odjęciu przysług): S ≤ 15:00, A ≤ 25:00, B ≤ 35:00, C – reszta. Jedna próba na run.

## Postacie

Arek Ławik, Wiktor Błaut, Mateusz Lipiarz, Filip Skomielski, Szymon Jastrzębski – pasywy i skille opisane w menu.
