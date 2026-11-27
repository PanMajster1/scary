// =====================================================================
//  map.js — mapa 3D TK 25 (przyziemie / parter / piętro / zewnątrz)
//  Siatka 0.5 m, kolizje AABB-okrąg, A* po siatce z połączeniami pięter
// =====================================================================
'use strict';

const MAP = (() => {
  const H = 3.5, CELL = 0.5, X0 = -12, Z0 = -12, W = 232, D = 224, N = W * D;
  const LEVELS = [-1, 0, 1];
  const LI = L => L + 1;
  // base: 0 ściana/pustka, 1 podłoga, 2 schody, 3 zewnątrz
  const base = LEVELS.map(() => new Uint8Array(N));
  // block: 0 wolne, 1 mebel, 2 zamknięte drzwi, 3 krata, 4 barykada
  const block = LEVELS.map(() => new Uint8Array(N));
  const roomA = LEVELS.map(() => new Uint8Array(N));
  const foot = LEVELS.map(() => new Uint8Array(N));   // 1 szkoła, 2 Lewiatan
  const keep = LEVELS.map(() => new Uint8Array(N));   // strefa wolna przy drzwiach
  const nearWall = LEVELS.map(() => new Uint8Array(N));
  const rooms = [null];
  const doors = [];
  const stairs = [];
  const lamps = [];
  const hideSpots = [];
  const signs = [];
  const animated = [];   // {update(t,dt)}
  const groups = LEVELS.map(() => null);
  const poi = {};
  const spawnable = {};  // roomName -> lista punktów na przedmioty

  const ci = x => Math.floor((x - X0) / CELL + 1e-6);
  const cj = z => Math.floor((z - Z0) / CELL + 1e-6);
  const cxOf = i => X0 + (i + 0.5) * CELL;
  const czOf = j => Z0 + (j + 0.5) * CELL;
  const inB = (i, j) => i >= 0 && j >= 0 && i < W && j < D;
  const idx = (i, j) => j * W + i;

  function forRect(x0, z0, x1, z1, fn) {
    const i0 = Math.round((x0 - X0) / CELL), i1 = Math.round((x1 - X0) / CELL);
    const j0 = Math.round((z0 - Z0) / CELL), j1 = Math.round((z1 - Z0) / CELL);
    for (let j = Math.max(0, j0); j < Math.min(D, j1); j++)
      for (let i = Math.max(0, i0); i < Math.min(W, i1); i++) fn(i, j, idx(i, j));
  }
  function openRaw(L, x0, z0, x1, z1, rid, val = 1, onlyIfFoot0 = false) {
    const l = LI(L);
    forRect(x0, z0, x1, z1, (i, j, c) => {
      if (onlyIfFoot0 && foot[l][c]) return;
      base[l][c] = val; if (rid) roomA[l][c] = rid;
    });
  }
  function room(L, name, x0, z0, x1, z1, type, o = {}) {
    const id = rooms.length;
    const r = { id, L, name, x0, z0, x1, z1, type, sign: o.sign !== undefined ? o.sign : name,
      floor: o.floor || null, ix0: x0, iz0: z0, ix1: x1 - 0.5, iz1: z1 - 0.5, doors: [], zone: o.zone || null };
    rooms.push(r);
    if (type === 'outdoor') {
      openRaw(L, x0, z0, x1, z1, id, 3, true);
      r.ix1 = x1; r.iz1 = z1;
    } else {
      const l = LI(L), fid = o.foot || 1;
      forRect(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, (i, j, c) => { foot[l][c] = Math.max(foot[l][c], fid); });
      openRaw(L, x0, z0, x1 - 0.5, z1 - 0.5, id, 1);
    }
    return r;
  }
  function extend(r, x0, z0, x1, z1) {
    openRaw(r.L, x0, z0, x1, z1, r.id, 1);
    const l = LI(r.L);
    forRect(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, (i, j, c) => { foot[l][c] = Math.max(foot[l][c], 1); });
  }
  function roomByName(name, L) { return rooms.find(r => r && r.name === name && (L === undefined || r.L === L)); }

  // drzwi: axis 'V' = ściana wzdłuż osi z na granicy x=b; 'H' = ściana wzdłuż x na granicy z=b
  // side: po której stronie ściany jest korytarz (+1 = większe współrzędne)
  function door(L, axis, b, c, o = {}) {
    const w = o.w || 1.5;
    let rect;
    if (axis === 'V') rect = [b - 0.5, c - w / 2, b, c + w / 2];
    else rect = [c - w / 2, b - 0.5, c + w / 2, b];
    const l = LI(L);
    // id pokoju dla przejścia = sąsiad po stronie korytarza
    const side = o.side || 1;
    let nb;
    if (axis === 'V') nb = roomA[l][idx(ci(side > 0 ? b + 0.25 : b - 0.75), cj(c))];
    else nb = roomA[l][idx(ci(c), cj(side > 0 ? b + 0.25 : b - 0.75))];
    openRaw(L, rect[0], rect[1], rect[2], rect[3], nb, 1);
    forRect(rect[0] - 1.25, rect[1] - 1.25, rect[2] + 1.25, rect[3] + 1.25, (i, j, cc) => { keep[l][cc] = 1; });
    const d = { L, axis, b, c, w, side, sign: o.sign || null, lintel: o.lintel !== false, rect, frame: o.frame !== false };
    doors.push(d);
    // przypisz do pokoi po obu stronach
    const other = axis === 'V' ? roomA[l][idx(ci(side > 0 ? b - 0.75 : b + 0.25), cj(c))] : roomA[l][idx(ci(c), cj(side > 0 ? b - 0.75 : b + 0.25))];
    if (rooms[other]) rooms[other].doors.push(d);
    if (rooms[nb]) rooms[nb].doors.push(d);
    return d;
  }

  // ------------------------------------------------------------------ UKŁAD
  function buildLayout() {
    // ============================== PARTER (L=0) ==============================
    const L = 0;
    // lewe skrzydło — Strefa Zakazana
    room(L, 'A-7', 0, 0, 6.5, 6.5, 'office');
    room(L, 'A-6', 0, 6.5, 6.5, 13, 'office');
    room(L, 'A-5', 0, 13, 6.5, 19.5, 'office');
    room(L, 'Sekretariat', 0, 19.5, 6.5, 26, 'office', { sign: 'SEKRETARIAT' });
    room(L, 'Gabinet Dyrektora', 0, 26, 6.5, 32, 'office', { sign: 'DYREKTOR SZKOŁY' });
    room(L, 'Pokój Nauczycielski', 0, 32, 6.5, 44, 'teachers', { sign: 'POKÓJ NAUCZYCIELSKI' });
    room(L, 'Korytarz administracyjny', 6.5, 0, 10, 24.5, 'corridor', { sign: null, zone: 'zakazana' });
    room(L, 'A-8', 10, 0, 12.5, 6, 'storage');
    room(L, 'A-9', 12.5, 0, 17.5, 6, 'office');
    room(L, 'A-10', 10, 6, 17.5, 12, 'office');
    room(L, 'Księgowość', 10, 12, 17.5, 19.5, 'office', { sign: 'KSIĘGOWOŚĆ' });
    room(L, 'Archiwum', 10, 19.5, 17.5, 24, 'storage', { sign: 'ARCHIWUM' });
    room(L, 'Korytarz główny', 10, 24, 79.5, 27.5, 'corridor', { sign: null });
    const hall = room(L, 'Hol główny', 6.5, 24, 17.5, 37, 'hall', { sign: null, zone: 'zakazana' });
    extend(hall, 10, 24, 17, 43.5);
    room(L, 'A-1', 6.5, 37, 10, 44, 'storage');
    // północny rząd lewy
    room(L, 'Sala 13', 17.5, 16, 22, 24, 'class', { sign: '13' });
    room(L, 'Sala 14', 22, 16, 26.5, 24, 'class', { sign: '14' });
    room(L, 'WC przy sali 14', 26.5, 16, 30.5, 24, 'wc', { sign: 'WC' });
    room(L, 'WC damskie', 30.5, 16, 34.5, 24, 'wc', { sign: 'WC' });
    // warsztaty północ
    room(L, 'Zaplecze warsztatów', 34.5, 0, 50.5, 2, 'storage', { sign: null });
    room(L, 'Warsztat Mechaniczny', 34.5, 2, 42.5, 21, 'workshop', { sign: 'WARSZTAT MECHANICZNY' });
    room(L, 'Ślusarnia', 42.5, 2, 50.5, 21, 'netlab', { sign: 'ŚLUSARNIA — PRAC. SIECIOWA' });
    room(L, 'Przedsionek warsztatów', 34.5, 21, 50.5, 24.5, 'corridor', { sign: null });
    // północny rząd prawy
    room(L, 'Kierownik Warsztatów', 50.5, 16, 55, 24, 'office', { sign: 'KIEROWNIK WARSZTATÓW' });
    room(L, 'WC męskie', 55, 16, 60.5, 24, 'wc', { sign: 'WC' });
    room(L, 'WC przy W-22', 60.5, 16, 65, 24, 'wc', { sign: 'WC (przy W-22)' });
    room(L, 'W-22', 65, 16, 68.5, 24, 'class');
    room(L, 'W-23', 68.5, 16, 72, 24, 'class');
    // prawe skrzydło
    room(L, 'Pracownia Teletechniczna', 72, 0, 79.5, 12, 'itlab', { sign: 'PRACOWNIA TELETECHNICZNA' });
    const rc = room(L, 'Korytarz pracowni', 75.5, 12, 79.5, 31, 'corridor', { sign: null });
    extend(rc, 72, 27, 79, 30.5);
    room(L, 'Pracownia Elektryczna', 79.5, 0, 88, 21, 'lab', { sign: 'PRAC. ELEKTRYCZNA I ELEKTRONICZNA' });
    room(L, 'W-26', 79.5, 21, 88, 26, 'class');
    room(L, 'Pracownia Logistyki', 79.5, 26, 88.5, 44, 'class', { sign: 'PRACOWNIA LOGISTYKI' });
    room(L, 'Warsztat Obróbki Ręcznej', 72, 31, 79.5, 44, 'workshop', { sign: 'WARSZTAT OBRÓBKI RĘCZNEJ' });
    // południe
    room(L, 'Warsztat Mechaniczny II', 34.5, 27.5, 42.5, 45, 'workshop', { sign: 'WARSZTAT MECHANICZNY' });
    room(L, 'W-29', 42.5, 27.5, 50.5, 40, 'class');
    room(L, 'Narzędziownia', 42.5, 40, 50.5, 45, 'storage', { sign: 'NARZĘDZIOWNIA' });

    // drzwi parteru
    [['A-7', 3.25], ['A-6', 9.75], ['A-5', 16.25], ['SEKRETARIAT', 22.75], ['DYREKTOR SZKOŁY', 29], ['POKÓJ NAUCZYCIELSKI', 34.2]]
      .forEach(([s, c]) => door(L, 'V', 6.5, c, { side: 1, sign: s }));
    [['A-8', 3], ['A-10', 9], ['KSIĘGOWOŚĆ', 15.75], ['ARCHIWUM', 21.75]]
      .forEach(([s, c]) => door(L, 'V', 10, c, { side: -1, sign: s }));
    door(L, 'H', 6, 15, { side: 1 });            // A-10 -> A-9
    door(L, 'H', 26, 3, { side: 1 });            // Sekretariat -> Dyrektor
    door(L, 'H', 37, 8, { side: -1, sign: 'A-1' });
    [['13', 19.75], ['14', 24.25], ['WC 14', 28.5], ['WC', 32.5], ['KIEROWNIK', 52.75], ['WC', 57.75], ['WC W-22', 62.75], ['W-22', 66.75], ['W-23', 70.25]]
      .forEach(([s, c]) => door(L, 'H', 24, c, { side: 1, sign: s }));
    door(L, 'H', 21, 38.5, { side: 1, sign: 'WARSZTAT MECH.', w: 2 });
    door(L, 'H', 21, 46.5, { side: 1, sign: 'ŚLUSARNIA', w: 2 });
    door(L, 'H', 2, 38.5, { side: -1 });
    door(L, 'H', 2, 46.5, { side: -1 });
    door(L, 'H', 12, 77.5, { side: 1, sign: 'TELETECHNICZNA' });
    door(L, 'V', 79.5, 16, { side: -1, sign: 'ELEKTRYCZNA' });
    door(L, 'V', 79.5, 23.5, { side: -1, sign: 'W-26' });
    door(L, 'V', 79.5, 28.75, { side: -1, sign: 'LOGISTYKA' });
    door(L, 'H', 31, 76.5, { side: -1, sign: 'OBRÓBKA RĘCZNA', w: 2 });
    door(L, 'H', 27.5, 38.5, { side: -1, sign: 'WARSZTAT MECH.', w: 2 });
    door(L, 'H', 27.5, 46, { side: -1, sign: 'W-29' });
    door(L, 'V', 42.5, 34, { side: 1 });
    door(L, 'V', 42.5, 42.5, { side: 1 });
    door(L, 'H', 40, 46, { side: 1 });

    // ============================== PRZYZIEMIE (L=-1) ==============================
    const B = -1;
    room(B, 'Korytarz przyziemia', 75.5, 4, 79.5, 44, 'corridor', { sign: null });
    room(B, 'W-01', 79.5, 2, 90, 12, 'itlab');
    room(B, 'Makieta Kolejki Szynowej', 79.5, 12, 90, 20, 'makieta', { sign: 'MAKIETA KOLEJKI SZYNOWEJ' });
    room(B, 'W-02', 79.5, 20, 90, 33, 'itlab', { sign: 'W-02' });
    room(B, 'W-04', 79.5, 33, 90, 44, 'storage');
    room(B, 'W-03', 69, 33, 75.5, 44, 'class');
    const cut = room(B, 'Odcięty korytarz', 58, 24, 75.5, 27.5, 'corridor', { sign: null });
    openRaw(B, 75, 24, 75.5, 27, cut.id);
    door(B, 'V', 79.5, 8, { side: -1, sign: 'W-01' });
    door(B, 'V', 79.5, 16, { side: -1, sign: 'MAKIETA' });
    door(B, 'V', 79.5, 23.5, { side: -1, sign: 'W-02' });
    door(B, 'V', 79.5, 30.5, { side: -1 });
    door(B, 'V', 79.5, 38, { side: -1, sign: 'W-04' });
    door(B, 'V', 75.5, 38, { side: 1, sign: 'W-03' });

    // ============================== PIĘTRO (L=1) ==============================
    const P = 1;
    room(P, 'Aula', 0, 0, 10, 32, 'aula', { sign: 'AULA SZKOLNA GÓRNA 101' });
    room(P, 'Scena', 0, 32, 10, 44, 'aula', { sign: 'SCENA 100' });
    room(P, 'Biblioteka', 10, 0, 17.5, 14, 'library', { sign: 'BIBLIOTEKA 102' });
    room(P, 'Hol piętra', 10, 14, 17.5, 44, 'hall', { sign: null });
    room(P, 'Korytarz piętra', 10, 24, 79.5, 27.5, 'corridor', { sign: null });
    room(P, 'Bufet W-103', 17.5, 16, 24.5, 24, 'bufet', { sign: 'BUFET W-103' });
    room(P, 'WC piętro', 24.5, 16, 27.5, 24, 'wc', { sign: 'WC' });
    room(P, 'WC piętro II', 27.5, 16, 30.5, 24, 'wc', { sign: 'WC' });
    room(P, 'W-106', 30.5, 16, 34.5, 24, 'class');
    room(P, 'W-107', 34.5, 0, 42.5, 21, 'class');
    room(P, 'W-108', 42.5, 0, 50.5, 21, 'class');
    room(P, 'Przedsionek piętra', 34.5, 21, 50.5, 24.5, 'corridor', { sign: null });
    room(P, 'W-109', 50.5, 16, 55, 24, 'class');
    room(P, 'Serwerownia W-110', 55, 16, 59.5, 24, 'server', { sign: 'SERWER W-110' });
    room(P, 'W-111', 59.5, 16, 64, 24, 'office', { sign: 'POM. SOCJ. W-111' });
    room(P, 'W-112', 64, 16, 68, 24, 'class');
    room(P, 'W-113', 68, 16, 72, 24, 'storage', { sign: 'POM. GOSP. W-113' });
    const rcp = room(P, 'Korytarz piętra prawy', 75.5, 12, 79.5, 44, 'corridor', { sign: null });
    extend(rcp, 72, 27, 79, 30.5);
    room(P, 'W-114', 72, 0, 79.5, 12, 'class');
    room(P, 'W-115', 79.5, 2, 88, 26, 'class');
    room(P, 'W-116a', 79.5, 26, 88, 33, 'class');
    room(P, 'W-116b', 79.5, 33, 88, 44, 'class');
    room(P, 'W-117', 72, 31, 75.5, 44, 'class');
    room(P, 'W-119', 34.5, 27.5, 42.5, 45, 'class');
    room(P, 'W-118', 42.5, 27.5, 50.5, 45, 'class');
    door(P, 'H', 32, 5, { side: 1, w: 4, lintel: false, frame: false });
    door(P, 'V', 10, 19, { side: 1, sign: 'AULA 101' });
    door(P, 'V', 10, 29, { side: 1 });
    door(P, 'V', 10, 38, { side: 1, sign: 'SCENA 100' });
    door(P, 'H', 14, 13.75, { side: 1, sign: 'BIBLIOTEKA' });
    [['BUFET W-103', 21], ['WC', 26], ['WC', 29], ['W-106', 32.5], ['W-109', 52.75], ['SERWER W-110', 57.25], ['W-111', 61.75], ['W-112', 66], ['W-113', 70]]
      .forEach(([s, c]) => door(P, 'H', 24, c, { side: 1, sign: s }));
    door(P, 'H', 21, 38.5, { side: 1, sign: 'W-107', w: 2 });
    door(P, 'H', 21, 46.5, { side: 1, sign: 'W-108', w: 2 });
    door(P, 'H', 12, 77.5, { side: 1, sign: 'W-114' });
    door(P, 'V', 79.5, 18, { side: -1, sign: 'W-115' });
    door(P, 'V', 79.5, 29.5, { side: -1, sign: 'W-116a' });
    door(P, 'V', 79.5, 38, { side: -1, sign: 'W-116b' });
    door(P, 'V', 75.5, 37, { side: 1, sign: 'W-117' });
    door(P, 'H', 27.5, 38.5, { side: -1, sign: 'W-119' });
    door(P, 'H', 27.5, 46, { side: -1, sign: 'W-118' });
    door(P, 'V', 42.5, 40, { side: 1 });

    // ============================== SCHODY ==============================
    const rs = room(0, 'Klatka schodowa', 72, 12, 75.5, 24, 'stair', { sign: null });
    const ls = room(0, 'Schody główne', 14.5, 29.5, 17, 42.5, 'stair', { sign: null });
    stairs.push({ id: 0, room: rs, lo: -1, hi: 0, x0: 72, z0: 12, x1: 75, z1: 23.5, aLo: 15, aHi: 21.5,
      open: { 0: [[72.5, 23.5, 75, 24]], '-1': [[75, 12.5, 75.5, 15]] } });
    stairs.push({ id: 1, room: ls, lo: 0, hi: 1, x0: 14.5, z0: 29.5, x1: 17, z1: 42.5, aLo: 40, aHi: 32,
      open: { 0: [[14, 40, 14.5, 42.5]], 1: [[14.5, 29, 17, 29.5], [14, 29.5, 14.5, 32]] } });
    for (const s of stairs) {
      for (const Lv of [s.lo, s.hi]) {
        const l = LI(Lv);
        forRect(s.x0 - 0.5, s.z0 - 0.5, s.x1 + 0.5, s.z1 + 0.5, (i, j, c) => {
          const x = cxOf(i), z = czOf(j);
          const inside = x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1;
          base[l][c] = inside ? 2 : 0; roomA[l][c] = s.room.id;
          foot[l][c] = Math.max(foot[l][c], 1);
        });
        for (const o of s.open[Lv]) openRaw(Lv, o[0], o[1], o[2], o[3], s.room.id, 1);
      }
    }

    // ============================== ZEWNĄTRZ ==============================
    room(0, 'Dziedziniec', -6, -6, 100, 63, 'outdoor', { floor: 'pavement', sign: null });
    room(0, 'Brama', 20, 63, 26, 63.5, 'outdoor', { floor: 'asphalt', sign: null });
    room(0, 'Ulica', -6, 63.5, 100, 71.5, 'outdoor', { floor: 'asphalt', sign: null });
    room(0, 'Lewiatan', 14, 72, 36, 84, 'shop', { foot: 2, sign: null });
    openRaw(0, 23.5, 71.5, 26.5, 72, roomByName('Lewiatan').id, 1); // wejście do sklepu
    room(0, 'Zaułek', 36.5, 71, 40, 92, 'outdoor', { floor: 'asphalt', sign: null });
    room(0, 'Parking', 40, 71, 62, 92, 'outdoor', { floor: 'asphalt', sign: null });
    room(0, 'PALARNIA ZA LEWIATANEM', 12, 84.5, 36.5, 92, 'outdoor', { floor: 'gravel', sign: null });
    // główne wyjście (zablokowane do końca Aktu 2)
    openRaw(0, 11.5, 43.5, 15, 44.5, hall.id, 1);
    forRect(11.5, 43.5, 15, 44.5, (i, j, c) => { block[LI(0)][c] = 2; });
    poi.exit = { L: 0, x: 13.25, z: 44, inside: { x: 13.25, z: 42.2 }, outside: { x: 13.25, z: 46 } };
    // krata ZAKAZ WSTĘPU
    forRect(69.5, 24, 70, 27, (i, j, c) => { block[LI(-1)][c] = 3; });
    poi.grate = { L: -1, x: 69.75, z: 25.5 };
  }

  // ------------------------------------------------------------------ zapytania
  function baseAt(L, x, z) { const i = ci(x), j = cj(z); if (!inB(i, j) || L < -1 || L > 1) return 0; return base[LI(L)][idx(i, j)]; }
  function cellFree(l, i, j) { if (!inB(i, j)) return false; const c = idx(i, j); return base[l][c] > 0 && block[l][c] === 0; }
  // komórka dostępna dla kółka r≈0.3: nie może być 1-komórkową szczeliną (ściany po obu stronach)
  function trav(l, i, j) {
    if (!cellFree(l, i, j)) return false;
    if (!cellFree(l, i - 1, j) && !cellFree(l, i + 1, j)) return false;
    if (!cellFree(l, i, j - 1) && !cellFree(l, i, j + 1)) return false;
    return true;
  }
  function walkable(L, x, z) { return cellFree(LI(L), ci(x), cj(z)); }
  function roomAt(L, x, z) { const i = ci(x), j = cj(z); if (!inB(i, j) || L < -1 || L > 1) return null; return rooms[roomA[LI(L)][idx(i, j)]] || null; }
  function stairAt(L, x, z) {
    if (baseAt(L, x, z) !== 2) return null;
    for (const s of stairs) if (x >= s.x0 - 0.01 && x <= s.x1 + 0.01 && z >= s.z0 - 0.01 && z <= s.z1 + 0.01 && (L === s.lo || L === s.hi)) return s;
    return null;
  }
  function stairH(s, x, z) {
    let t = (z - s.aLo) / (s.aHi - s.aLo); t = Math.max(0, Math.min(1, t));
    return (s.lo + t * (s.hi - s.lo)) * H;
  }
  function levelOfY(y) { return Math.max(-1, Math.min(1, Math.round(y / H))); }
  // wysokość podłogi + poziom dla bytu o pozycji (x,z) i aktualnym y
  function ground(L, x, z) {
    const s = stairAt(L, x, z);
    if (s) { const y = stairH(s, x, z); return { y, L: levelOfY(y), stair: s }; }
    return { y: L * H, L, stair: null };
  }

  // kolizja okręgu z zablokowanymi komórkami — wypychanie (ślizg po ścianach)
  function collide(L, p, r) {
    const l = LI(L);
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const i0 = ci(p.x - r), i1 = ci(p.x + r), j0 = cj(p.z - r), j1 = cj(p.z + r);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (cellFree(l, i, j)) continue;
        const bx0 = X0 + i * CELL, bz0 = Z0 + j * CELL;
        const qx = Math.max(bx0, Math.min(p.x, bx0 + CELL)), qz = Math.max(bz0, Math.min(p.z, bz0 + CELL));
        let dx = p.x - qx, dz = p.z - qz; const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 1e-8) { // środek w komórce — wypchnij do najbliższej krawędzi
            const cxm = bx0 + CELL / 2, czm = bz0 + CELL / 2;
            dx = p.x - cxm; dz = p.z - czm;
            if (Math.abs(dx) > Math.abs(dz)) p.x = dx > 0 ? bx0 + CELL + r : bx0 - r; else p.z = dz > 0 ? bz0 + CELL + r : bz0 - r;
          } else {
            const d = Math.sqrt(d2), push = (r - d) + 1e-4;
            p.x += dx / d * push; p.z += dz / d * push;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  // linia wzroku po siatce (ściany i zamknięte drzwi blokują)
  function los(L, x0, z0, x1, z1) {
    const l = LI(L);
    const dx = x1 - x0, dz = z1 - z0, dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (CELL * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps; const i = ci(x0 + dx * t), j = cj(z0 + dz * t);
      if (!inB(i, j)) return false;
      const c = idx(i, j);
      if (base[l][c] === 0 || block[l][c] === 2) return false;
    }
    return true;
  }
  // czy da się przejść prosto (dla wygładzania ścieżek) z promieniem
  function clearLine(L, x0, z0, x1, z1) {
    const l = LI(L);
    const dx = x1 - x0, dz = z1 - z0, dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (CELL * 0.4));
    const nx = -dz / (dist || 1) * 0.3, nz = dx / (dist || 1) * 0.3;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps; const x = x0 + dx * t, z = z0 + dz * t;
      if (!cellFree(l, ci(x), cj(z)) || !cellFree(l, ci(x + nx), cj(z + nz)) || !cellFree(l, ci(x - nx), cj(z - nz))) return false;
      if (base[l][idx(ci(x), cj(z))] === 2) return false; // na schodach nie skracamy
    }
    return true;
  }

  // ------------------------------------------------------------------ A*
  const TOT = 3 * N;
  const gS = new Float32Array(TOT).fill(Infinity), fromA = new Int32Array(TOT).fill(-1), closed = new Uint8Array(TOT);
  const touched = [];
  const heap = { a: [], f: [] };
  function hPush(n, f) {
    const a = heap.a, fa = heap.f; a.push(n); fa.push(f); let k = a.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (fa[p] <= fa[k]) break; [a[p], a[k]] = [a[k], a[p]]; [fa[p], fa[k]] = [fa[k], fa[p]]; k = p; }
  }
  function hPop() {
    const a = heap.a, fa = heap.f; const top = a[0]; const la = a.pop(), lf = fa.pop();
    if (a.length) { a[0] = la; fa[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k;
      if (l < a.length && fa[l] < fa[m]) m = l; if (r < a.length && fa[r] < fa[m]) m = r; if (m === k) break;
      [a[m], a[k]] = [a[k], a[m]]; [fa[m], fa[k]] = [fa[k], fa[m]]; k = m; } }
    return top;
  }
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  function nearestFree(l, i, j) {
    if (trav(l, i, j)) return [i, j];
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      if (trav(l, i + di, j + dj)) return [i + di, j + dj];
    }
    return cellFree(l, i, j) ? [i, j] : null;
  }
  function snap(L, x, z) {
    const l = LI(L), i0 = ci(x), j0 = cj(z);
    if (cellFree(l, i0, j0) && base[l][idx(i0, j0)] !== 2) return { L, x, z };
    for (let r = 1; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj;
      if (cellFree(l, i, j) && base[l][idx(i, j)] === 1 && cellFree(l, i + 1, j) && cellFree(l, i - 1, j) && cellFree(l, i, j + 1) && cellFree(l, i, j - 1)) return { L, x: cxOf(i), z: czOf(j) };
    }
    return { L, x, z };
  }
  function findPath(L0, x0, z0, L1, x1, z1, maxIter = 60000) {
    const a = nearestFree(LI(L0), ci(x0), cj(z0)), b = nearestFree(LI(L1), ci(x1), cj(z1));
    if (!a || !b) return null;
    const s = LI(L0) * N + idx(a[0], a[1]), g = LI(L1) * N + idx(b[0], b[1]);
    for (const t of touched) { gS[t] = Infinity; fromA[t] = -1; closed[t] = 0; }
    touched.length = 0; heap.a.length = 0; heap.f.length = 0;
    const gi = b[0], gj = b[1];
    gS[s] = 0; touched.push(s); hPush(s, 0);
    let it = 0, found = false;
    while (heap.a.length && it++ < maxIter) {
      const n = hPop();
      if (n === g) { found = true; break; }
      if (closed[n]) continue; closed[n] = 1;
      const l = (n / N) | 0, c = n - l * N, i = c % W, j = (c / W) | 0;
      for (const [di, dj, cost] of DIRS) {
        const ni = i + di, nj = j + dj;
        if (!trav(l, ni, nj)) continue;
        if (di && dj && (!cellFree(l, i + di, j) || !cellFree(l, i, j + dj))) continue;
        const nc = idx(ni, nj), nn = l * N + nc;
        const ng = gS[n] + cost + nearWall[l][nc] * 0.6;
        if (ng < gS[nn]) {
          if (gS[nn] === Infinity) touched.push(nn);
          gS[nn] = ng; fromA[nn] = n;
          hPush(nn, ng + Math.hypot(ni - gi, nj - gj) * 1.05);
        }
      }
      // połączenie pionowe na schodach
      if (base[l][c] === 2) for (const dl of [-1, 1]) {
        const l2 = l + dl; if (l2 < 0 || l2 > 2) continue;
        if (base[l2][c] !== 2) continue;
        const nn = l2 * N + c, ng = gS[n] + 0.05;
        if (ng < gS[nn]) { if (gS[nn] === Infinity) touched.push(nn); gS[nn] = ng; fromA[nn] = n; hPush(nn, ng + Math.hypot(i - gi, j - gj)); }
      }
    }
    if (!found) return null;
    const out = [];
    let n = g;
    while (n !== -1) {
      const l = (n / N) | 0, c = n - l * N;
      out.push({ L: l - 1, x: cxOf(c % W), z: czOf((c / W) | 0) });
      if (n === s) break;
      n = fromA[n];
    }
    out.reverse();
    // usuń duplikaty pionowe (ten sam xz)
    const res = [];
    for (const p of out) { const q = res[res.length - 1]; if (q && q.x === p.x && q.z === p.z) { q.L = p.L; continue; } res.push(p); }
    return res;
  }

  function randomPointInRoom(r, margin = 0.6) {
    const l = LI(r.L);
    for (let k = 0; k < 60; k++) {
      const x = r.ix0 + margin + Math.random() * Math.max(0.1, r.ix1 - r.ix0 - 2 * margin);
      const z = r.iz0 + margin + Math.random() * Math.max(0.1, r.iz1 - r.iz0 - 2 * margin);
      const i = ci(x), j = cj(z);
      if (cellFree(l, i, j) && roomA[l][idx(i, j)] === r.id && base[l][idx(i, j)] !== 2 && cellFree(l, i + 1, j) && cellFree(l, i - 1, j) && cellFree(l, i, j + 1) && cellFree(l, i, j - 1))
        return { L: r.L, x: cxOf(i), z: czOf(j) };
    }
    return null;
  }

  function setBlock(L, x0, z0, x1, z1, val, onlyFree = false) {
    const l = LI(L); const changed = [];
    forRect(x0, z0, x1, z1, (i, j, c) => {
      if (onlyFree && (base[l][c] === 0 || block[l][c] !== 0)) return;
      if (val === 0 || block[l][c] === 0) { changed.push(c); block[l][c] = val; }
    });
    return changed;
  }
  function blockCells(L, cells, val) { const l = LI(L); for (const c of cells) block[l][c] = val; }

  function computeNearWall() {
    for (let l = 0; l < 3; l++) for (let j = 1; j < D - 1; j++) for (let i = 1; i < W - 1; i++) {
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!cellFree(l, i + di, j + dj)) n++;
      nearWall[l][idx(i, j)] = Math.min(3, n);
    }
  }

  // =====================================================================
  //  TEKSTURY PROCEDURALNE
  // =====================================================================
  const T = {};
  function cvs(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  function mkTex(c) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function speck(g, w, h, n, colors, rmin, rmax) {
    for (let k = 0; k < n; k++) { g.fillStyle = colors[(Math.random() * colors.length) | 0]; const r = rmin + Math.random() * (rmax - rmin);
      g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, r, r * (0.6 + Math.random() * 0.6), Math.random() * 3, 0, 7); g.fill(); }
  }
  function grain(g, w, h, a = 0.08, n = 4000) {
    for (let k = 0; k < n; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }
  function buildTextures() {
    T.terrazzo = mkTex(cvs(512, 512, (g, w, h) => {
      g.fillStyle = '#8f8b84'; g.fillRect(0, 0, w, h);
      speck(g, w, h, 4500, ['#d9d4cb', '#5d5a55', '#b08f7a', '#3d3b38', '#c9c3b5', '#7d6a5c'], 1, 4);
      grain(g, w, h, 0.06);
      g.strokeStyle = 'rgba(40,38,35,0.55)'; g.lineWidth = 3;
      for (let k = 0; k <= 2; k++) { g.beginPath(); g.moveTo(k * 256, 0); g.lineTo(k * 256, h); g.stroke(); g.beginPath(); g.moveTo(0, k * 256); g.lineTo(w, k * 256); g.stroke(); }
    }));
    const lino = (col, col2) => mkTex(cvs(256, 256, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h); speck(g, w, h, 600, [col2, 'rgba(0,0,0,0.15)'], 1, 3); grain(g, w, h, 0.05, 2000);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
      for (let k = 0; k < 10; k++) { g.strokeStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + Math.random() * 60 - 30, y + Math.random() * 60 - 30); g.stroke(); }
    }));
    T.lino = lino('#6b5a44', '#7d6a52'); T.linoGreen = lino('#4f5f50', '#5e705f'); T.linoBlue = lino('#4c5868', '#5a6678');
    T.tiles = mkTex(cvs(256, 256, (g, w, h) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 150 + Math.random() * 25; g.fillStyle = `rgb(${v - 10},${v},${v + 8})`; g.fillRect(x * 32, y * 32, 32, 32); }
      g.strokeStyle = '#555c60'; g.lineWidth = 2; for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, k * 32); g.lineTo(w, k * 32); g.stroke(); }
    }));
    T.ceiling = mkTex(cvs(256, 256, (g, w, h) => {
      g.fillStyle = '#c9c6bd'; g.fillRect(0, 0, w, h); speck(g, w, h, 900, ['#aaa79e', '#b9b6ad'], 0.5, 1.5);
      g.strokeStyle = '#8a877f'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2);
      g.fillStyle = 'rgba(120,100,60,0.12)'; g.beginPath(); g.ellipse(170, 80, 40, 25, 0.4, 0, 7); g.fill();
    }));
    T.pavement = mkTex(cvs(256, 256, (g, w, h) => {
      g.fillStyle = '#5d5c58'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.12, 3000);
      g.strokeStyle = '#3e3d3a'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, k * 64); g.lineTo(w, k * 64); g.stroke(); }
    }));
    T.asphalt = mkTex(cvs(256, 256, (g, w, h) => { g.fillStyle = '#2f3032'; g.fillRect(0, 0, w, h); speck(g, w, h, 2500, ['#3d3e41', '#232426', '#4a4b4e'], 0.5, 1.6); }));
    T.gravel = mkTex(cvs(256, 256, (g, w, h) => { g.fillStyle = '#5a554c'; g.fillRect(0, 0, w, h); speck(g, w, h, 3000, ['#7a7366', '#3e3a33', '#8d8676', '#494439'], 1, 3.5);
      for (let k = 0; k < 14; k++) { g.fillStyle = '#d8d0b0'; g.fillRect(Math.random() * w, Math.random() * h, 6, 2); g.fillStyle = '#c47a3a'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }));
    T.grass = mkTex(cvs(256, 256, (g, w, h) => { g.fillStyle = '#263a20'; g.fillRect(0, 0, w, h); speck(g, w, h, 3000, ['#2f4a27', '#1d2e19', '#3a5a2e'], 0.5, 2); }));

    // ściany: lamperia — dół farba olejna, góra emulsja
    const wallC = {
      corridor: ['#3b5a47', '#d6d0bd', '#24382b'], class: ['#4f6a80', '#d9d6c8', '#2f4252'], office: ['#7a6248', '#ddd5c2', '#4d3d2b'],
      workshop: ['#56606a', '#bdbab0', '#343b42'], wc: ['TILE', '#d2d4d0', '#777'], aula: ['#6b2b2b', '#d6cdb8', '#3d1818'],
      shop: ['#e8e8e2', '#f0efe8', '#2a8a3a'], stair: ['#3b5a47', '#d6d0bd', '#24382b'], hall: ['#3b5a47', '#d6d0bd', '#24382b'],
    };
    T.wall = {};
    for (const k in wallC) for (const win of [0, 1]) {
      const [lo, hi, line] = wallC[k];
      T.wall[k + win] = mkTex(cvs(512, 512, (g, w, h) => {
        g.fillStyle = hi; g.fillRect(0, 0, w, h); grain(g, w, h, 0.05, 3000);
        for (let s = 0; s < 6; s++) { g.fillStyle = 'rgba(110,95,60,0.06)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h * 0.5, 30 + Math.random() * 60, 20 + Math.random() * 40, 0, 0, 7); g.fill(); }
        const ly = h - h * (1.5 / 3.5);
        if (lo === 'TILE') {
          const ty = h - h * (2.0 / 3.5);
          for (let y = ty; y < h; y += 24) for (let x = 0; x < w; x += 24) { const v = 205 + Math.random() * 25; g.fillStyle = `rgb(${v},${v + 2},${v})`; g.fillRect(x, y, 23, 23); }
          g.fillStyle = '#8fa8b0'; g.fillRect(0, ty - 6, w, 6);
        } else {
          const grd = g.createLinearGradient(0, ly, 0, h); grd.addColorStop(0, lo); grd.addColorStop(1, shade(lo, -18));
          g.fillStyle = grd; g.fillRect(0, ly, w, h - ly);
          g.fillStyle = line; g.fillRect(0, ly - 5, w, 5);
          for (let s = 0; s < 40; s++) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(Math.random() * w, ly + Math.random() * (h - ly), 30 + Math.random() * 50, 2); }
          // obicia
          for (let s = 0; s < 8; s++) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(Math.random() * w, h - 60 + Math.random() * 50, 6 + Math.random() * 10, 3); }
        }
        // listwa przypodłogowa
        g.fillStyle = '#2a2622'; g.fillRect(0, h - 14, w, 14);
        if (win) {
          const wx = w * 0.18, wy = h * 0.2, ww = w * 0.64, wh = h * 0.42;
          g.fillStyle = '#eceae2'; g.fillRect(wx - 10, wy - 10, ww + 20, wh + 20);
          const gg = g.createLinearGradient(wx, wy, wx + ww, wy + wh); gg.addColorStop(0, '#0d1a2e'); gg.addColorStop(0.6, '#152742'); gg.addColorStop(1, '#0a1220');
          g.fillStyle = gg; g.fillRect(wx, wy, ww, wh);
          g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
          const sk = g.createLinearGradient(0, wy, 0, wy + wh); sk.addColorStop(0, '#0a1530'); sk.addColorStop(1, '#3a3050'); g.fillStyle = sk; g.fillRect(wx, wy, ww, wh);
          for (let s = 0; s < 14; s++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.7 + ')'; g.fillRect(wx + Math.random() * ww, wy + Math.random() * wh * 0.5, 1.5, 1.5); }
          let bx = wx - 10; while (bx < wx + ww) { const bw = 30 + Math.random() * 50, bh = wh * (0.25 + Math.random() * 0.4); g.fillStyle = '#080b12'; g.fillRect(bx, wy + wh - bh, bw, bh);
            for (let wy2 = wy + wh - bh + 8; wy2 < wy + wh - 6; wy2 += 12) for (let wx2 = bx + 5; wx2 < bx + bw - 6; wx2 += 10) if (Math.random() < 0.35) { g.fillStyle = Math.random() < 0.7 ? '#ffd890' : '#9fd0ff'; g.fillRect(wx2, wy2, 4, 6); } bx += bw + 3; }
          const lg = g.createRadialGradient(wx + ww * 0.78, wy + wh * 0.7, 2, wx + ww * 0.78, wy + wh * 0.7, 60); lg.addColorStop(0, 'rgba(255,200,120,.8)'); lg.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = lg; g.fillRect(wx, wy, ww, wh);
          g.restore();
          g.fillStyle = '#eceae2'; g.fillRect(wx + ww / 2 - 5, wy, 10, wh); g.fillRect(wx, wy + wh * 0.35, ww, 8);
          g.fillStyle = '#bfbdb5'; g.fillRect(wx - 16, wy + wh + 10, ww + 32, 12);
          g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(wx + 20, wy); g.lineTo(wx + 80, wy); g.lineTo(wx + 20, wy + 90); g.fill();
        }
      }));
    }
    T.exterior = mkTex(cvs(512, 512, (g, w, h) => {
      g.fillStyle = '#9a8f7c'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.1, 5000);
      for (let s = 0; s < 10; s++) { g.fillStyle = 'rgba(40,35,30,0.15)'; g.fillRect(Math.random() * w, 0, 4 + Math.random() * 8, h); }
      g.fillStyle = '#3a3a3a'; g.fillRect(0, h - 40, w, 40);
      const wx = w * 0.2, wy = h * 0.22, ww = w * 0.6, wh = h * 0.42;
      g.fillStyle = '#d8d4c8'; g.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
      g.fillStyle = '#101826'; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#d8d4c8'; g.fillRect(wx + ww / 2 - 4, wy, 8, wh); g.fillRect(wx, wy + wh * 0.35, ww, 6);
    }));
    T.exteriorE = mkTex(cvs(512, 512, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const wx = w * 0.2, wy = h * 0.22, ww = w * 0.6, wh = h * 0.42;
      g.fillStyle = '#4a4430'; g.fillRect(wx, wy, ww, wh);
    }));
    T.brick = mkTex(cvs(256, 256, (g, w, h) => {
      g.fillStyle = '#5a5550'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 16; y++) for (let x = -1; x < 8; x++) { const v = 120 + Math.random() * 40; g.fillStyle = `rgb(${v + 30},${v * 0.55},${v * 0.4})`; g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); }
    }));
    T.fence = mkTex(cvs(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.strokeStyle = '#4a5054'; g.lineWidth = 3;
      for (let k = -h; k < w + h; k += 18) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
      g.fillStyle = '#3a3f42'; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 10, h); g.fillRect(0, h - 10, w, 10);
    }));
    T.door = mkTex(cvs(128, 256, (g, w, h) => {
      g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 30; k++) { g.strokeStyle = 'rgba(30,15,5,0.25)'; g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 6, h / 3, x - 6, h * 2 / 3, x, h); g.stroke(); }
      const dg = g.createLinearGradient(w * 0.3, h * 0.12, w * 0.7, h * 0.34); dg.addColorStop(0, '#5c7a94'); dg.addColorStop(0.5, '#243646'); dg.addColorStop(1, '#41596e');
      g.fillStyle = '#d8d2c0'; g.fillRect(w * 0.28, h * 0.1, w * 0.44, h * 0.26); g.fillStyle = dg; g.fillRect(w * 0.3, h * 0.12, w * 0.4, h * 0.22);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.34, h * 0.33); g.lineTo(w * 0.5, h * 0.13); g.stroke(); g.beginPath(); g.moveTo(w * 0.46, h * 0.33); g.lineTo(w * 0.57, h * 0.19); g.stroke();
      g.fillStyle = '#c0c0b0'; g.fillRect(w * 0.78, h * 0.5, 16, 6);
    }));
    T.locker = mkTex(cvs(128, 256, (g, w, h) => {
      g.fillStyle = '#5a6b78'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.08, 800);
      g.strokeStyle = '#2c353c'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#2c353c'; for (let k = 0; k < 6; k++) g.fillRect(w * 0.25, 20 + k * 8, w * 0.5, 3);
      g.fillStyle = '#b8b8b0'; g.fillRect(w * 0.75, h * 0.5, 8, 22);
      g.fillStyle = '#ddd'; g.fillRect(w * 0.3, h * 0.3, w * 0.4, 14); g.fillStyle = '#333'; g.font = '10px monospace'; g.fillText(String(100 + ((Math.random() * 99) | 0)), w * 0.36, h * 0.3 + 11);
    }));
    T.wood = mkTex(cvs(128, 128, (g, w, h) => { g.fillStyle = '#8a6a44'; g.fillRect(0, 0, w, h); for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(50,30,10,${Math.random() * 0.3})`; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.lineTo(w, y + Math.random() * 6 - 3); g.stroke(); } }));
    T.desk = mkTex(cvs(128, 128, (g, w, h) => { g.fillStyle = '#b9a98c'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.06, 600); g.fillStyle = '#6b5a44'; g.fillRect(0, 0, w, 6); }));
    T.books = mkTex(cvs(256, 256, (g, w, h) => {
      g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, w, h);
      for (let s = 0; s < 4; s++) { let x = 4; while (x < w - 6) { const bw = 6 + Math.random() * 10; g.fillStyle = `hsl(${Math.random() * 360},${30 + Math.random() * 40}%,${20 + Math.random() * 30}%)`; g.fillRect(x, s * 64 + 8 + Math.random() * 8, bw - 1, 52); x += bw; } g.fillStyle = '#2a1c10'; g.fillRect(0, s * 64 + 58, w, 6); }
    }));
    T.shelfShop = mkTex(cvs(256, 256, (g, w, h) => {
      g.fillStyle = '#ddd'; g.fillRect(0, 0, w, h);
      for (let s = 0; s < 4; s++) { let x = 3; while (x < w - 5) { const bw = 10 + Math.random() * 14; g.fillStyle = `hsl(${Math.random() * 360},70%,${40 + Math.random() * 20}%)`; g.fillRect(x, s * 64 + 14, bw - 2, 44); x += bw; } g.fillStyle = '#aaa'; g.fillRect(0, s * 64 + 58, w, 6); }
    }));
    T.board = mkTex(cvs(512, 256, (g, w, h) => {
      g.fillStyle = '#1e3326'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.07, 3000);
      g.fillStyle = 'rgba(230,230,220,0.08)'; for (let k = 0; k < 8; k++) g.fillRect(Math.random() * w, Math.random() * h, 120, 30);
      g.strokeStyle = '#6b4a2e'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
    }));
    T.screen = mkTex(cvs(128, 96, (g, w, h) => {
      g.fillStyle = '#0a1a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1e4f9a'; g.fillRect(0, 0, w, 10);
      g.fillStyle = '#9fd0ff'; for (let k = 0; k < 7; k++) g.fillRect(8, 16 + k * 10, 20 + Math.random() * 80, 3);
    }));
    T.rack = mkTex(cvs(128, 256, (g, w, h) => {
      g.fillStyle = '#111316'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 14; k++) { g.fillStyle = '#23272c'; g.fillRect(8, 8 + k * 17, w - 16, 14);
        for (let p = 0; p < 12; p++) { g.fillStyle = Math.random() < 0.6 ? '#22ff66' : (Math.random() < 0.5 ? '#ffaa00' : '#3399ff'); g.fillRect(14 + p * 8, 12 + k * 17, 3, 3); } }
    }));
    T.signGreen = null;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, gg = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); gg = Math.max(0, Math.min(255, gg)); b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0');
  }
  function textTex(text, o = {}) {
    const w = o.w || 512, h = o.h || 128;
    return mkTex(cvs(w, h, (g) => {
      g.fillStyle = o.bg || '#e8e6dc'; g.fillRect(0, 0, w, h);
      if (o.border !== false) { g.strokeStyle = o.bc || '#222'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
      g.fillStyle = o.fg || '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = o.fs || 64; g.font = `bold ${fs}px Arial, sans-serif`;
      while (g.measureText(text).width > w - 30 && fs > 12) { fs -= 2; g.font = `bold ${fs}px Arial, sans-serif`; }
      g.fillText(text, w / 2, h / 2 + 3);
      if (o.sub) { g.font = `bold ${Math.round(fs * 0.4)}px Arial`; g.fillText(o.sub, w / 2, h * 0.82); }
    }));
  }

  // =====================================================================
  //  MATERIAŁY + budowanie geometrii
  // =====================================================================
  const M = {};
  function buildMaterials() {
    const std = (o, r = 0.9, m = 0) => new THREE.MeshStandardMaterial(Object.assign({ roughness: r, metalness: m, envMapIntensity: 0.55 }, o));
    const bump = (t, k) => ({ bumpMap: t, bumpScale: k });
    M.terrazzo = std({ map: T.terrazzo, ...bump(T.terrazzo, 0.8) }, 0.22, 0.02); M.lino = std({ map: T.lino, ...bump(T.lino, 0.4) }, 0.45); M.linoGreen = std({ map: T.linoGreen, ...bump(T.linoGreen, 0.4) }, 0.45); M.linoBlue = std({ map: T.linoBlue, ...bump(T.linoBlue, 0.4) }, 0.42);
    M.tiles = std({ map: T.tiles, ...bump(T.tiles, 0.6) }, 0.18); M.ceiling = std({ map: T.ceiling, ...bump(T.ceiling, 0.4) }, 0.95); M.pavement = std({ map: T.pavement, ...bump(T.pavement, 1.0) }, 0.55);
    M.asphalt = std({ map: T.asphalt, ...bump(T.asphalt, 1.0) }, 0.5, 0.05); M.gravel = std({ map: T.gravel, ...bump(T.gravel, 1.2) }, 0.95); M.grass = std({ map: T.grass }, 1);
    M.wall = {}; for (const k in T.wall) M.wall[k] = std({ map: T.wall[k], ...bump(T.wall[k], 0.25) }, 0.82);
    M.exterior = std({ map: T.exterior, ...bump(T.exterior, 0.8), emissive: 0xffffff, emissiveMap: T.exteriorE }, 0.9);
    M.brick = std({ map: T.brick, ...bump(T.brick, 1.2) }, 0.9);
    M.fence = std({ map: T.fence, alphaTest: 0.5, side: THREE.DoubleSide }, 0.5, 0.6);
    M.roof = std({ color: 0x2a2b2e }, 0.9);
    M.door = std({ map: T.door, ...bump(T.door, 0.3) }, 0.5); M.frame = std({ color: 0x4a3423 }, 0.55);
    M.frameW = std({ color: 0xe6e3da }, 0.5);
    M.locker = std({ map: T.locker, ...bump(T.locker, 0.2) }, 0.38, 0.55); M.lockerRed = std({ map: T.locker, color: 0xff9a8a }, 0.38, 0.55);
    M.wood = std({ map: T.wood, ...bump(T.wood, 0.4) }, 0.55); M.desk = std({ map: T.desk }, 0.4); M.metal = std({ color: 0x8a9096 }, 0.35, 0.85); M.darkMetal = std({ color: 0x3b4046 }, 0.4, 0.8);
    M.black = std({ color: 0x141518 }, 0.35, 0.2); M.white = std({ color: 0xe8e8e2 }, 0.55); M.ceramic = std({ color: 0xf2f2ee }, 0.12);
    M.screen = std({ map: T.screen, emissive: 0xffffff, emissiveMap: T.screen, emissiveIntensity: 0.75 }, 0.2);
    M.board = std({ map: T.board }, 0.8); M.books = std({ map: T.books }, 0.8); M.shelfShop = std({ map: T.shelfShop }, 0.5);
    M.chair = std({ color: 0x2f4a6a }, 0.5); M.chairRed = std({ color: 0x7a2a2a }, 0.5); M.plant = std({ color: 0x2e6b2e }, 0.8); M.pot = std({ color: 0x8a4a2a }, 0.7);
    M.green = std({ color: 0x1f8a3a }, 0.45); M.red = std({ color: 0xb02020 }, 0.4); M.yellow = std({ color: 0xd8b030 }, 0.45); M.blue = std({ color: 0x2050a0 }, 0.45);
    M.orange = std({ color: 0xd06a20 }, 0.45); M.partition = std({ color: 0x8a9aa0 }, 0.45, 0.2); M.curtain = std({ color: 0x5a1010 }, 0.95);
    M.rack = std({ map: T.rack, emissive: 0xffffff, emissiveMap: T.rack, emissiveIntensity: 0.9 }, 0.4);
    M.lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf4f6ff).multiplyScalar(3) });
    M.lampFlick = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf4f6ff).multiplyScalar(3) }));
    M.lampOff = new THREE.MeshBasicMaterial({ color: 0x444650 });
    M.street = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(3) });
    M.glass = new THREE.MeshPhysicalMaterial({ color: 0x9fbfd8, transparent: true, opacity: 0.2, roughness: 0.03, metalness: 0.0, envMapIntensity: 2.4, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02 });
    M.glassDark = new THREE.MeshPhysicalMaterial({ color: 0x223344, transparent: true, opacity: 0.45, roughness: 0.05, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
    M.track = std({ color: 0x555555 }, 0.4, 0.8); M.trainRed = std({ color: 0xb02a2a }, 0.3); M.grassTable = std({ color: 0x3c6b2c }, 0.95);
    M.cardboard = std({ color: 0x9a7a4a }, 0.9); M.fridge = std({ color: 0xdde8ee, emissive: 0x223344 }, 0.25, 0.3);
    M.cork = std({ color: 0xb68a52 }, 0.9); M.extinguisher = std({ color: 0xc41818 }, 0.3, 0.4); M.hydrant = std({ color: 0xb41818 }, 0.4, 0.2); M.rubber = std({ color: 0x1a1b1e }, 0.8);
  }

  class GeoB {
    constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
    quad(a, b, c, d, n, uv) { // a b c d w kolejności CCW patrząc od strony normalnej
      const k = this.p.length / 3;
      this.p.push(...a, ...b, ...c, ...d);
      for (let q = 0; q < 4; q++) this.n.push(...n);
      this.u.push(...uv);
      this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
    box(x0, y0, z0, x1, y1, z1, s = 1) {
      const U = (a, b) => [a / s, b / s];
      // +x
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [...U(z1, y0), ...U(z0, y0), ...U(z0, y1), ...U(z1, y1)].map((v, k) => k % 2 ? v : -v));
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [...U(z0, y0), ...U(z1, y0), ...U(z1, y1), ...U(z0, y1)]);
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [...U(x0, z1), ...U(x1, z1), ...U(x1, z0), ...U(x0, z0)]);
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [...U(x0, z0), ...U(x1, z0), ...U(x1, z1), ...U(x0, z1)]);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [...U(x0, y0), ...U(x1, y0), ...U(x1, y1), ...U(x0, y1)]);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [...U(-x1, y0), ...U(-x0, y0), ...U(-x0, y1), ...U(-x1, y1)]);
    }
    mesh(mat) {
      if (!this.i.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.setIndex(this.i);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; return m;
    }
  }
  const builders = LEVELS.map(() => ({}));
  function GB(L, key) { const b = builders[LI(L)]; return b[key] || (b[key] = new GeoB()); }
  function matOf(key) {
    if (key.startsWith('wall:')) return M.wall[key.slice(5)];
    return M[key];
  }

  // box mebla: współrzędne absolutne x/z, y względem podłogi poziomu
  function pbox(L, mat, x0, y0, z0, x1, y1, z1, blk = false, s = 1) {
    const yb = L * H;
    GB(L, mat).box(Math.min(x0, x1), yb + y0, Math.min(z0, z1), Math.max(x0, x1), yb + y1, Math.max(z0, z1), s);
    if (blk) setBlock(L, Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 1);
  }
  function rectFree(L, x0, z0, x1, z1) {
    const l = LI(L); let ok = true;
    forRect(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), (i, j, c) => { if (base[l][c] !== 1 || block[l][c] || keep[l][c]) ok = false; });
    return ok;
  }

  // ------------------------------------------------------------------ ściany / podłogi / sufity
  function wallKey(r, win) {
    if (!r) return 'wall:corridor' + win;
    let t = r.type;
    if (t === 'teachers') t = 'office'; if (t === 'itlab' || t === 'lab' || t === 'netlab' || t === 'makieta' || t === 'library' || t === 'bufet' || t === 'server' || t === 'storage') t = 'class';
    if (!(t + '0' in M.wall)) t = 'corridor';
    return 'wall:' + t + win;
  }
  function floorKey(r) {
    if (!r) return 'terrazzo';
    if (r.floor) return r.floor;
    switch (r.type) {
      case 'corridor': case 'hall': case 'stair': return 'terrazzo';
      case 'wc': return 'tiles';
      case 'workshop': case 'storage': return 'linoGreen';
      case 'office': case 'teachers': case 'library': return 'lino';
      case 'shop': return 'tiles';
      default: return 'linoBlue';
    }
  }

  function buildStructure() {
    for (const L of LEVELS) {
      const l = LI(L), y0 = L * H;
      const isSolid = (i, j) => !inB(i, j) || base[l][idx(i, j)] === 0;
      // ŚCIANY: dla każdego kierunku runy komórek otwartych przy solidnym sąsiedzie
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [di, dj] of dirs) {
        const alongX = dj !== 0; // ściana biegnie wzdłuż x
        const outer = alongX ? D : W, inner = alongX ? W : D;
        for (let a = 0; a < outer; a++) {
          let runStart = -1, runKey = null, runH = 0;
          const flush = (bEnd) => {
            if (runStart < 0) return;
            emitWall(L, di, dj, a, runStart, bEnd, runKey, runH);
            runStart = -1;
          };
          for (let b = 0; b <= inner; b++) {
            let key = null, hgt = H;
            if (b < inner) {
              const i = alongX ? b : a, j = alongX ? a : b;
              const c = idx(i, j);
              if (base[l][c] !== 0 && isSolid(i + di, j + dj)) {
                const r = rooms[roomA[l][c]];
                if (base[l][c] === 3) {
                  const ni = i + di, nj = j + dj;
                  const f = inB(ni, nj) ? foot[l][idx(ni, nj)] : 0;
                  if (f === 1) { key = 'exterior'; hgt = 2 * H + 0.4; }
                  else if (f === 2) { key = 'brick'; hgt = 4.2; }
                  else { key = 'fence'; hgt = 2.4; }
                } else {
                  // okno? sprawdź co jest za ścianą
                  let win = 0;
                  for (let k = 2; k <= 3; k++) {
                    const ii = i + di * k, jj = j + dj * k;
                    if (!inB(ii, jj)) { win = 1; break; }
                    const cc = idx(ii, jj);
                    if (base[l][cc] === 3 || (L !== 0 && foot[l][cc] === 0 && base[l][cc] === 0)) { win = 1; break; }
                    if (base[l][cc] !== 0) break;
                  }
                  if (L === -1) win = 0;
                  if (r && (r.type === 'stair' || r.type === 'wc' || r.type === 'shop')) win = r.type === 'shop' ? 0 : win;
                  key = wallKey(r, win);
                  if (r && r.type === 'shop') key = 'wall:shop0';
                }
              }
            }
            if (key !== runKey || hgt !== runH) { flush(b); if (key) { runStart = b; runKey = key; runH = hgt; } }
          }
        }
      }
      function emitWall(L, di, dj, a, b0, b1, key, hgt) {
        if (key === 'exterior' || key.endsWith('1')) addWindows(L, di, dj, a, b0, b1, key, y0);
        const g = GB(L, key);
        const top = y0 + hgt;
        const sU = key === 'exterior' ? 3.5 : key === 'brick' ? 2 : key === 'fence' ? 2.4 : 3.5;
        const sV = key === 'exterior' ? H : key === 'brick' ? 2 : key === 'fence' ? 2.4 : H;
        if (dj !== 0) { // ściana wzdłuż x, na krawędzi z
          const j = a; const z = Z0 + (dj > 0 ? (j + 1) : j) * CELL;
          const xa = X0 + b0 * CELL, xb = X0 + b1 * CELL;
          const ua = xa / sU, ub = xb / sU, va = 0, vb = hgt / sV;
          if (dj > 0) g.quad([xb, y0, z], [xa, y0, z], [xa, top, z], [xb, top, z], [0, 0, -1], [-ub, va, -ua, va, -ua, vb, -ub, vb]);
          else g.quad([xa, y0, z], [xb, y0, z], [xb, top, z], [xa, top, z], [0, 0, 1], [ua, va, ub, va, ub, vb, ua, vb]);
        } else {
          const i = a; const x = X0 + (di > 0 ? (i + 1) : i) * CELL;
          const za = Z0 + b0 * CELL, zb = Z0 + b1 * CELL;
          const ua = za / sU, ub = zb / sU, va = 0, vb = hgt / sV;
          if (di > 0) g.quad([x, y0, za], [x, y0, zb], [x, top, zb], [x, top, za], [-1, 0, 0], [ua, va, ub, va, ub, vb, ua, vb]);
          else g.quad([x, y0, zb], [x, y0, za], [x, top, za], [x, top, zb], [1, 0, 0], [-ub, va, -ua, va, -ua, vb, -ub, vb]);
        }
      }
      // PODŁOGI + SUFITY (runy wzdłuż x)
      for (let j = 0; j < D; j++) {
        let fs = -1, fk = null, cs = -1, ck = null, rs = -1, rk = null;
        for (let i = 0; i <= W; i++) {
          let fkey = null, ckey = null, rkey = null;
          if (i < W) {
            const c = idx(i, j), bv = base[l][c], r = rooms[roomA[l][c]];
            if (bv === 1 || bv === 3) fkey = floorKey(r);
            if (bv === 1) ckey = 'ceiling';
            if (bv === 2) { const s = stairs.find(s => s.room.id === roomA[l][c]); if (s && s.hi === L) ckey = 'ceiling'; }
            if (L === 0 && bv !== 3 && foot[l][c]) rkey = foot[l][c] === 2 ? 'r2' : 'r1';
          }
          const z0 = Z0 + j * CELL, z1 = z0 + CELL;
          if (fkey !== fk) { if (fk) { const xa = X0 + fs * CELL, xb = X0 + i * CELL; const s = fk === 'terrazzo' ? 2 : 2;
              GB(L, fk).quad([xa, y0, z1], [xb, y0, z1], [xb, y0, z0], [xa, y0, z0], [0, 1, 0], [xa / s, -z1 / s, xb / s, -z1 / s, xb / s, -z0 / s, xa / s, -z0 / s]); }
            fk = fkey; fs = i; }
          if (ckey !== ck) { if (ck) { const xa = X0 + cs * CELL, xb = X0 + i * CELL, yc = y0 + H;
              GB(L, 'ceiling').quad([xa, yc, z0], [xb, yc, z0], [xb, yc, z1], [xa, yc, z1], [0, -1, 0], [xa / 1.2, z0 / 1.2, xb / 1.2, z0 / 1.2, xb / 1.2, z1 / 1.2, xa / 1.2, z1 / 1.2]); }
            ck = ckey; cs = i; }
          if (rkey !== rk) { if (rk) { const xa = X0 + rs * CELL, xb = X0 + i * CELL, yr = rk === 'r2' ? 4.2 : 2 * H + 0.4;
              GB(0, 'roof').quad([xa, yr, z1], [xb, yr, z1], [xb, yr, z0], [xa, yr, z0], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1]); }
            rk = rkey; rs = i; }
        }
      }
    }
    // schody — stopnie + podesty
    for (const s of stairs) {
      const rise = (s.hi - s.lo) * H, n = 20, dir = Math.sign(s.aHi - s.aLo), len = Math.abs(s.aHi - s.aLo);
      for (let k = 0; k < n; k++) {
        const za = s.aLo + dir * len * k / n, zb = s.aLo + dir * len * (k + 1) / n;
        const yTop = s.lo * H + rise * (k + 1) / n;
        GB(s.lo, 'terrazzo').box(s.x0, s.lo * H, Math.min(za, zb), s.x1, yTop, Math.max(za, zb), 1.2);
      }
      // podest dolny i górny
      const zl0 = dir > 0 ? s.z0 : s.aLo, zl1 = dir > 0 ? s.aLo : s.z1;
      GB(s.lo, 'terrazzo').quad([s.x0, s.lo * H + 0.01, zl1], [s.x1, s.lo * H + 0.01, zl1], [s.x1, s.lo * H + 0.01, zl0], [s.x0, s.lo * H + 0.01, zl0], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1]);
      const zh0 = dir > 0 ? s.aHi : s.z0, zh1 = dir > 0 ? s.z1 : s.aHi;
      GB(s.hi, 'terrazzo').box(s.x0, s.lo * H, zh0, s.x1, s.hi * H, zh1, 1.2);
      // poręcz: cienka rura po skosie + balustrady
      const yb = s.lo * H;
      for (const xr of [s.x0 + 0.07, s.x1 - 0.07]) {
        const p0 = new THREE.Vector3(xr, yb + 0.95, s.aLo), p1 = new THREE.Vector3(xr, yb + rise + 0.95, s.aHi);
        const len3 = p0.distanceTo(p1);
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len3, 8), M.metal);
        rail.position.copy(p0).add(p1).multiplyScalar(0.5);
        rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
        groups[LI(s.lo)].add(rail);
        const nb = Math.round(len / 0.32);
        for (let k = 0; k <= nb; k++) {
          const t = k / nb, zz = s.aLo + dir * len * t, yy = yb + rise * t;
          GB(s.lo, 'darkMetal').box(xr - 0.012, yy, zz - 0.012, xr + 0.012, yy + 0.95, zz + 0.012);
        }
      }
    }
  }

  // ------------------------------------------------------------------ okna z prawdziwymi szybami
  function addWindows(L, di, dj, a, b0, b1, key, y0) {
    const ext = key === 'exterior', alongX = dj !== 0;
    const base0 = alongX ? X0 : Z0;
    const lo = base0 + b0 * CELL, hi = base0 + b1 * CELL;
    const plane = alongX ? Z0 + (dj > 0 ? a + 1 : a) * CELL : X0 + (di > 0 ? a + 1 : a) * CELL;
    const nrm = alongX ? -dj : -di;
    const wx0 = ext ? 0.2 : 0.18, wx1 = ext ? 0.8 : 0.82;
    const rows = ext ? 2 : 1;
    for (let m = Math.floor(lo / 3.5) - 1; m <= Math.ceil(hi / 3.5); m++) {
      const c0 = Math.max(lo, 3.5 * (m + wx0)), c1 = Math.min(hi, 3.5 * (m + wx1));
      if (c1 - c0 < 0.3) continue;
      const full = Math.abs((c1 - c0) - 3.5 * (wx1 - wx0)) < 0.01;
      for (let r = 0; r < rows; r++) {
        const yb = y0 + (ext ? H * r + 1.26 : 1.33), yt = y0 + (ext ? H * r + 2.73 : 2.8);
        const o = 0.025 * nrm;
        const gG = GB(L, 'glass'), gF = GB(L, 'frameW');
        const pz = plane + o;
        const nx = alongX ? 0 : nrm, nz = alongX ? nrm : 0;
        if (alongX) gG.quad([c0, yb, pz], [c1, yb, pz], [c1, yt, pz], [c0, yt, pz], [0, 0, 1], [0, 0, 1, 0, 1, 1, 0, 1]);
        else gG.quad([pz, yb, c0], [pz, yb, c1], [pz, yt, c1], [pz, yt, c0], [1, 0, 0], [0, 0, 1, 0, 1, 1, 0, 1]);
        // normalne szyby w stronę pomieszczenia
        const gp = gG.n; for (let q = gp.length - 12; q < gp.length; q += 3) { gp[q] = nx; gp[q + 1] = 0; gp[q + 2] = nz; }
        // rama (grubość 0.06, głębokość 0.07 w głąb pomieszczenia)
        const fb = (u0, y0b, u1, y1b, d0 = 0, d1 = 0.07) => {
          const p0 = plane + nrm * d0, p1 = plane + nrm * d1;
          if (alongX) gF.box(u0, y0b, Math.min(p0, p1), u1, y1b, Math.max(p0, p1)); else gF.box(Math.min(p0, p1), y0b, u0, Math.max(p0, p1), y1b, u1);
        };
        const t = 0.06;
        fb(c0, yb - t, c1, yb); fb(c0, yt, c1, yt + t); fb(c0, yb, c0 + t, yt); fb(c1 - t, yb, c1, yt);
        const cm = (c0 + c1) / 2; fb(cm - 0.025, yb, cm + 0.025, yt, 0, 0.05); fb(c0, (yb + yt) / 2 - 0.02, c1, (yb + yt) / 2 + 0.02, 0, 0.05);
        if (!ext) {
          fb(c0 - 0.05, yb - 0.1, c1 + 0.05, yb - 0.05, 0, 0.16); // parapet
          if (full) { // grzejnik pod oknem
            const gW = GB(L, 'white'), cx0 = cm - 0.7, cx1 = cm + 0.7;
            const r0 = plane + nrm * 0.02, r1 = plane + nrm * 0.14;
            for (let f = 0; f < 12; f++) { const u = cx0 + 1.4 * f / 12; if (alongX) gW.box(u, y0 + 0.28, Math.min(r0, r1), u + 0.09, y0 + 0.96, Math.max(r0, r1)); else gW.box(Math.min(r0, r1), y0 + 0.28, u, Math.max(r0, r1), y0 + 0.96, u + 0.09); }
            if (alongX) GB(L, 'metal').box(cx0 - 0.02, y0 + 0.9, Math.min(r0, r1), cx1 + 0.02, y0 + 0.96, Math.max(r0, r1)); else GB(L, 'metal').box(Math.min(r0, r1), y0 + 0.9, cx0 - 0.02, Math.max(r0, r1), y0 + 0.96, cx1 + 0.02);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ drzwi, szyldy, lampy
  function buildDoorsAndSigns(scene) {
    for (const d of doors) {
      const L = d.L, yb = L * H;
      const [x0, z0, x1, z1] = d.rect;
      if (d.lintel) GB(L, 'wall:corridor0').box(x0, yb + 2.25, z0, x1, yb + H, z1, 3.5);
      if (d.frame) {
        if (d.axis === 'V') {
          GB(L, 'frame').box(x0 - 0.02, yb, z0 - 0.08, x1 + 0.02, yb + 2.3, z0);
          GB(L, 'frame').box(x0 - 0.02, yb, z1, x1 + 0.02, yb + 2.3, z1 + 0.08);
          GB(L, 'frame').box(x0 - 0.02, yb + 2.22, z0, x1 + 0.02, yb + 2.3, z1);
          // skrzydło otwarte do środka pokoju (przy ścianie)
          const xin = d.side > 0 ? x0 - 0.04 : x1 + 0.04, xo = d.side > 0 ? x0 - 0.04 - (d.w - 0.1) : x1 + 0.04 + (d.w - 0.1);
          const zz = z1 - 0.05;
          GB(L, 'door').box(Math.min(xin, xo), yb + 0.02, zz - 0.05, Math.max(xin, xo), yb + 2.15, zz, 1.0);
        } else {
          GB(L, 'frame').box(x0 - 0.08, yb, z0 - 0.02, x0, yb + 2.3, z1 + 0.02);
          GB(L, 'frame').box(x1, yb, z0 - 0.02, x1 + 0.08, yb + 2.3, z1 + 0.02);
          GB(L, 'frame').box(x0, yb + 2.22, z0 - 0.02, x1, yb + 2.3, z1 + 0.02);
          const zin = d.side > 0 ? z0 - 0.04 : z1 + 0.04, zo = d.side > 0 ? z0 - 0.04 - (d.w - 0.1) : z1 + 0.04 + (d.w - 0.1);
          const xx = x1 - 0.05;
          GB(L, 'door').box(xx - 0.05, yb + 0.02, Math.min(zin, zo), xx, yb + 2.15, Math.max(zin, zo), 1.0);
        }
      }
      if (d.sign) addSign(scene, L, d, d.sign);
    }
  }
  const signGeo = () => new THREE.PlaneGeometry(1, 1);
  function addSign(scene, L, d, text, o = {}) {
    const t = textTex(text, { bg: o.bg || '#f0eee4', fg: o.fg || '#101010', bc: o.bc || '#1a3a6a' });
    const m = new THREE.Mesh(signGeo(), new THREE.MeshLambertMaterial({ map: t, emissive: 0x333333, emissiveMap: t }));
    const len = text.length > 14 ? 2.0 : text.length > 6 ? 1.5 : 1.0;
    m.scale.set(len, len / 4, 1);
    const yb = L * H + 2.65;
    if (d.axis === 'V') {
      const x = d.side > 0 ? d.b + 0.02 : d.b - 0.5 - 0.02;
      m.position.set(x, yb, d.c); m.rotation.y = d.side > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const z = d.side > 0 ? d.b + 0.02 : d.b - 0.5 - 0.02;
      m.position.set(d.c, yb, z); m.rotation.y = d.side > 0 ? 0 : Math.PI;
    }
    groups[LI(L)].add(m);
    // wystający szyld 3D (prostopadły) dla większej czytelności na korytarzu
    if (!o.flatOnly) {
      const t2 = textTex(text, { bg: '#1a3a6a', fg: '#ffffff', bc: '#e0e0e0' });
      const pm = new THREE.MeshLambertMaterial({ map: t2, emissive: 0x556688, emissiveMap: t2 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 1.25), [M.white, M.white, M.white, M.white, M.white, M.white]);
      const p1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), pm), p2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), pm);
      const grp = new THREE.Group(); grp.add(box);
      p1.position.x = 0.025; p1.rotation.y = Math.PI / 2; p2.position.x = -0.025; p2.rotation.y = -Math.PI / 2; grp.add(p1, p2);
      if (d.axis === 'V') {
        const x = d.side > 0 ? d.b + 0.65 : d.b - 0.5 - 0.65;
        grp.position.set(x, L * H + 3.05, d.c + d.w / 2 + 0.4); grp.rotation.y = Math.PI / 2;
      } else {
        const z = d.side > 0 ? d.b + 0.65 : d.b - 0.5 - 0.65;
        grp.position.set(d.c + d.w / 2 + 0.4, L * H + 3.05, z);
      }
      groups[LI(L)].add(grp);
    }
  }
  function worldSign(L, text, x, y, z, rotY, w, h, o = {}) {
    const t = textTex(text, o);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t, emissive: o.em || 0x444444, emissiveMap: t, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, L * H + y, z); m.rotation.y = rotY;
    groups[LI(L)].add(m); return m;
  }

  function buildLamps() {
    const lampGeo = new THREE.BoxGeometry(1.2, 0.06, 0.3);
    for (const r of rooms) {
      if (!r || r.type === 'outdoor') continue;
      const L = r.L, w = r.ix1 - r.ix0, d = r.iz1 - r.iz0;
      const pts = [];
      if (r.type === 'corridor' || r.type === 'hall') {
        if (w >= d) { for (let x = r.ix0 + 2.5; x < r.ix1 - 1; x += 5.5) pts.push([x, (r.iz0 + Math.min(r.iz1, r.iz0 + 3)) / 2]); }
        else for (let z = r.iz0 + 2.5; z < r.iz1 - 1; z += 5.5) pts.push([(r.ix0 + Math.min(r.ix1, r.ix0 + 3.5)) / 2, z]);
      } else if (r.type === 'stair') {
        pts.push([(r.ix0 + r.ix1) / 2, (r.iz0 + r.iz1) / 2]);
      } else {
        const nx = Math.max(1, Math.round(w / 4)), nz = Math.max(1, Math.round(d / 4.5));
        for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) pts.push([r.ix0 + w * (a + 0.5) / nx, r.iz0 + d * (b + 0.5) / nz]);
      }
      for (const [x, z] of pts) {
        const stair = stairs.find(s => s.room === r);
        const LL = stair ? stair.hi : L;
        if (baseAt(LL, x, z) === 0) continue;
        const flick = Math.random() < 0.16 ? (1 + (Math.random() * 3) | 0) : 0;
        const dead = !flick && Math.random() < 0.05;
        const mat = dead ? M.lampOff : flick ? M.lampFlick[flick - 1] : M.lamp;
        const m = new THREE.Mesh(lampGeo, mat);
        m.position.set(x, LL * H + H - 0.04, z);
        if (w < d && r.type !== 'class') m.rotation.y = Math.PI / 2;
        groups[LI(LL)].add(m);
        if (!dead) lamps.push({ L: LL, x, y: LL * H + H - 0.25, z, flick, outdoor: false, room: r });
      }
    }
  }

  // =====================================================================
  //  MEBLE I REKWIZYTY
  // =====================================================================
  function roomDoorSide(r) {
    // zwraca bok ściany z drzwiami: 'N','S','W','E'
    for (const d of r.doors) {
      if (d.axis === 'H') { if (Math.abs(d.b - r.z1) < 0.01) return 'S'; if (Math.abs(d.b - r.z0) < 0.01) return 'N'; }
      else { if (Math.abs(d.b - r.x1) < 0.01) return 'E'; if (Math.abs(d.b - r.x0) < 0.01) return 'W'; }
    }
    return 'S';
  }
  // układ lokalny: u wzdłuż ściany tablicy, v w głąb sali od tablicy
  function frame(r) {
    const ds = roomDoorSide(r);
    const bw = { S: 'N', N: 'S', E: 'W', W: 'E' }[ds];
    const x0 = r.ix0, x1 = r.ix1, z0 = r.iz0, z1 = r.iz1;
    let len, dep, map;
    if (bw === 'N') { len = x1 - x0; dep = z1 - z0; map = (u, v) => [x0 + u, z0 + v]; }
    else if (bw === 'S') { len = x1 - x0; dep = z1 - z0; map = (u, v) => [x1 - u, z1 - v]; }
    else if (bw === 'W') { len = z1 - z0; dep = x1 - x0; map = (u, v) => [x0 + v, z1 - u]; }
    else { len = z1 - z0; dep = x1 - x0; map = (u, v) => [x1 - v, z0 + u]; }
    return { len, dep, map, bw };
  }
  function fbox(r, f, mat, u0, v0, u1, v1, y0, y1, blk) {
    const [ax, az] = f.map(u0, v0), [bx, bz] = f.map(u1, v1);
    pbox(r.L, mat, ax, y0, az, bx, y1, bz, blk);
  }
  function fboxIfFree(r, f, mat, u0, v0, u1, v1, y0, y1) {
    const [ax, az] = f.map(u0, v0), [bx, bz] = f.map(u1, v1);
    if (!rectFree(r.L, ax, az, bx, bz)) return false;
    pbox(r.L, mat, ax, y0, az, bx, y1, bz, true); return true;
  }
  function addSpawn(r, x, y, z) { (spawnable[r.name] = spawnable[r.name] || []).push({ L: r.L, x, y, z, room: r.name }); }

  function desk(r, f, u, v, it) {
    const ok = fboxIfFree(r, f, 'desk', u, v, u + 1.3, v + 0.6, 0.72, 0.76);
    if (!ok) return false;
    fbox(r, f, 'metal', u + 0.05, v + 0.05, u + 0.1, v + 0.55, 0, 0.72);
    fbox(r, f, 'metal', u + 1.2, v + 0.05, u + 1.25, v + 0.55, 0, 0.72);
    fbox(r, f, 'chair', u + 0.15, v + 0.75, u + 0.55, v + 1.1, 0.42, 0.47);
    fbox(r, f, 'chair', u + 0.75, v + 0.75, u + 1.15, v + 1.1, 0.42, 0.47);
    fbox(r, f, 'chair', u + 0.15, v + 1.08, u + 0.55, v + 1.12, 0.47, 0.85);
    fbox(r, f, 'chair', u + 0.75, v + 1.08, u + 1.15, v + 1.12, 0.47, 0.85);
    if (it) {
      fbox(r, f, 'black', u + 0.15, v + 0.12, u + 0.55, v + 0.16, 0.8, 1.1);
      fbox(r, f, 'screen', u + 0.17, v + 0.165, u + 0.53, v + 0.17, 0.83, 1.08);
      fbox(r, f, 'black', u + 0.75, v + 0.12, u + 1.15, v + 0.16, 0.8, 1.1);
      fbox(r, f, 'screen', u + 0.77, v + 0.165, u + 1.13, v + 0.17, 0.83, 1.08);
      fbox(r, f, 'darkMetal', u + 0.3, v + 0.3, u + 0.4, v + 0.4, 0.76, 0.8);
      fbox(r, f, 'darkMetal', u + 0.9, v + 0.3, u + 1.0, v + 0.4, 0.76, 0.8);
    }
    const [sx, sz] = f.map(u + 0.65, v + 0.3); addSpawn(r, sx, 0.95, sz);
    return true;
  }
  function blackboard(r, f, text) {
    const bwid = Math.min(4, f.len - 2), u0 = (f.len - bwid) / 2;
    const [ax, az] = f.map(u0, 0.0), [bx, bz] = f.map(u0 + bwid, 0.06);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const t = textTex(text || '', { bg: '#1e3326', fg: '#e8e8dc', border: true, bc: '#6b4a2e', fs: 40, w: 512, h: 160 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bwid, 1.2), new THREE.MeshLambertMaterial({ map: t }));
    m.position.set(cx, r.L * H + 1.5, cz);
    const rot = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[f.bw];
    m.rotation.y = rot;
    // przesunięcie od ściany
    const off = 0.03; m.position.x += Math.sin(rot) * off; m.position.z += Math.cos(rot) * off;
    groups[LI(r.L)].add(m);
  }
  const boardTexts = {
    'W-02': 'REDO RESCUE — backup systemu', 'W-01': 'int main() { // Code::Blocks }', 'Sala 13': 'Funkcja liniowa: y = ax + b',
    'Sala 14': 'Lalka — B. Prus', 'W-22': 'Prawo Ohma: U = R · I', 'W-23': 'Kartkówka jutro!!!', 'W-26': 'Packet Tracer — VLAN',
    'W-29': 'BHP na warsztatach', 'W-03': 'Kto rzucił mandarynką?', 'Pracownia Logistyki': 'Łańcuch dostaw',
    'W-107': 'Trójkąt: suma kątów = 180°', 'W-108': 'Albo wiecie, albo jeden!', 'W-119': 'Romantyzm — Mickiewicz', 'W-118': 'Sieci: model OSI',
    'W-106': 'Matura próbna', 'W-109': 'IPv4 /24', 'W-112': 'Oddaj telefon!', 'W-114': 'Cisco 2960', 'W-115': 'Ventoy 1.0.99',
    'W-116a': 'Pirate token', 'W-116b': 'Kawasaki ≠ szkoła', 'W-117': 'Prezydent musi mieć 5!', 'Pracownia Teletechniczna': 'Kable krosowane vs proste',
    'Pracownia Elektryczna': 'Nie dotykać 230V!',
  };
  function furnishClass(r, it) {
    const f = frame(r);
    blackboard(r, f, boardTexts[r.name] || r.name);
    // biurko nauczyciela
    fboxIfFree(r, f, 'wood', 0.8, 0.9, 2.4, 1.6, 0.74, 0.78);
    fbox(r, f, 'wood', 0.85, 0.95, 2.35, 1.0, 0, 0.74);
    fbox(r, f, 'chairRed', 1.3, 0.35, 1.8, 0.75, 0.45, 0.5);
    if (it) { fbox(r, f, 'black', 1.2, 1.2, 1.7, 1.25, 0.78, 1.12); fbox(r, f, 'screen', 1.22, 1.19, 1.68, 1.2, 0.81, 1.1); }
    const [tx, tz] = f.map(1.6, 1.25); addSpawn(r, tx, 0.98, tz);
    // ławki
    for (let v = 2.7; v + 1.3 < f.dep - 0.4; v += 2.1)
      for (let u = 0.6; u + 1.3 < f.len - 0.5; u += 2.9) desk(r, f, u, v, it);
    // szafka z tyłu
    fboxIfFree(r, f, 'wood', f.len - 1.6, f.dep - 0.5, f.len - 0.4, f.dep, 0, 1.8);
  }
  function furnishOffice(r) {
    const f = frame(r);
    fboxIfFree(r, f, 'wood', 0.6, 1.0, 2.2, 1.8, 0.74, 0.78) && fbox(r, f, 'wood', 0.65, 1.05, 0.7, 1.75, 0, 0.74);
    fbox(r, f, 'chairRed', 1.2, 0.4, 1.6, 0.8, 0.45, 0.5);
    fbox(r, f, 'black', 1.1, 1.3, 1.6, 1.34, 0.78, 1.1); fbox(r, f, 'screen', 1.12, 1.29, 1.58, 1.3, 0.8, 1.08);
    const [tx, tz] = f.map(1.9, 1.4); addSpawn(r, tx, 0.98, tz);
    for (let u = 0.2; u + 0.9 < f.len - 0.2; u += 1.0) fboxIfFree(r, f, 'wood', u, f.dep - 0.45, u + 0.9, f.dep, 0, 2.0);
    if (fboxIfFree(r, f, 'pot', f.len - 0.6, 0.2, f.len - 0.2, 0.6, 0, 0.4)) fbox(r, f, 'plant', f.len - 0.7, 0.1, f.len - 0.1, 0.7, 0.4, 1.1);
    if (f.dep > 4) for (let u = 0.6; u + 1.3 < f.len - 0.5; u += 3.0) fboxIfFree(r, f, 'desk', u, 3.0, u + 1.3, 3.7, 0.72, 0.76) && addSpawn(r, ...(() => { const [a, b] = f.map(u + 0.6, 3.3); return [a, 0.95, b]; })());
  }
  function furnishTeachers(r) {
    const cx = (r.ix0 + r.ix1) / 2, cz = (r.iz0 + r.iz1) / 2;
    pbox(r.L, 'wood', cx - 1.0, 0.74, cz - 3.5, cx + 1.0, 0.8, cz + 3.5, true);
    pbox(r.L, 'wood', cx - 0.9, 0, cz - 3.4, cx - 0.8, 0.74, cz + 3.4);
    pbox(r.L, 'wood', cx + 0.8, 0, cz - 3.4, cx + 0.9, 0.74, cz + 3.4);
    for (let z = cz - 3; z <= cz + 3; z += 1.2) { pbox(r.L, 'chairRed', cx - 1.6, 0.45, z - 0.2, cx - 1.2, 0.5, z + 0.2); pbox(r.L, 'chairRed', cx + 1.2, 0.45, z - 0.2, cx + 1.6, 0.5, z + 0.2); }
    // kubki, papiery
    for (let k = 0; k < 6; k++) pbox(r.L, k % 2 ? 'white' : 'red', cx - 0.7 + Math.random() * 1.3, 0.8, cz - 3 + Math.random() * 6, cx - 0.6 + Math.random() * 1.3, 0.9, cz - 2.9 + Math.random() * 6);
    for (let z = r.iz0 + 0.3; z < r.iz1 - 1; z += 1.0) if (rectFree(r.L, r.ix0, z, r.ix0 + 0.5, z + 0.9)) pbox(r.L, 'locker', r.ix0, 0, z, r.ix0 + 0.5, 2.0, z + 0.9, true);
    poi.keySpot = { L: r.L, x: cx, y: 0.95, z: cz + 2.2 };
    poi.teachersRoom = r;
  }
  function furnishWC(r, cabinsList) {
    const ds = roomDoorSide(r);
    // kabiny przy ścianie przeciwległej do drzwi
    const horiz = ds === 'S' || ds === 'N';
    const L = r.L;
    if (horiz) {
      const zBack = ds === 'S' ? r.iz0 : r.iz1; const dir = ds === 'S' ? 1 : -1;
      const n = Math.min(3, Math.floor((r.ix1 - r.ix0 - 0.2) / 1.25));
      const startX = r.ix0 + 0.1;
      for (let k = 0; k < n; k++) {
        const xa = startX + k * 1.25, xb = xa + 1.25;
        const za = zBack, zb = zBack + dir * 1.5;
        // przegrody
        pbox(L, 'partition', xa, 0.1, Math.min(za, zb), xa + 0.05, 2.1, Math.max(za, zb));
        if (k === n - 1) pbox(L, 'partition', xb - 0.05, 0.1, Math.min(za, zb), xb, 2.1, Math.max(za, zb));
        pbox(L, 'partition', xa + 0.05, 0.1, zb - dir * 0.05, xb - 0.05, 2.1, zb, false);
        pbox(L, 'ceramic', xa + 0.4, 0, za + dir * 0.1, xa + 0.85, 0.45, za + dir * 0.75);
        setBlock(L, Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb), 1);
        const hx = (xa + xb) / 2, hz = za + dir * 0.75;
        hideSpots.push({ L, x: hx, z: hz, ex: hx, ez: zb + dir * 0.55, kind: 'kabina', yaw: dir > 0 ? Math.PI : 0, room: r.name });
        if (cabinsList) cabinsList.push(hideSpots[hideSpots.length - 1]);
      }
      // umywalki przy bocznej ścianie
      const sx = r.ix1 - 0.5;
      const zz = ds === 'S' ? r.iz1 - 2.6 : r.iz0 + 2.1;
      if (rectFree(L, sx, zz, r.ix1, zz + 0.6)) { pbox(L, 'ceramic', sx, 0.75, zz, r.ix1, 0.9, zz + 0.6, true); pbox(L, 'glass', r.ix1 - 0.02, 1.2, zz, r.ix1, 1.9, zz + 0.6); }
    }
  }
  function furnishWorkshop(r) {
    const f = frame(r);
    for (let v = 1.5; v + 1.0 < f.dep - 0.6; v += 3.0)
      for (let u = 0.8; u + 2.2 < f.len - 0.6; u += 3.9) {
        if (fboxIfFree(r, f, 'wood', u, v, u + 2.2, v + 0.9, 0.85, 0.92)) {
          fbox(r, f, 'darkMetal', u + 0.05, v + 0.05, u + 2.15, v + 0.85, 0, 0.85);
          fbox(r, f, 'metal', u + 0.3, v + 0.2, u + 0.55, v + 0.45, 0.92, 1.1);
          fbox(r, f, 'metal', u + 1.6, v + 0.2, u + 1.85, v + 0.45, 0.92, 1.1);
          const [sx, sz] = f.map(u + 1.1, v + 0.45); addSpawn(r, sx, 1.05, sz);
        }
      }
    // ściana narzędzi
    const [ax, az] = f.map(0.5, 0.0), [bx, bz] = f.map(Math.min(f.len - 0.5, 4.5), 0.05);
    pbox(r.L, 'wood', ax, 1.0, az, bx, 2.0, bz);
    // tokarka
    fboxIfFree(r, f, 'green', f.len - 2.2, f.dep - 1.2, f.len - 0.4, f.dep - 0.3, 0, 1.2);
  }
  function furnishNetlab(r) {
    // Ślusarnia = pracownia sieciowa Florczykiewicza: szafa rack 19"
    const L = r.L;
    const rx = r.ix1 - 1.0, rz = r.iz0 + 3.0;
    setBlock(L, rx - 0.1, rz - 0.4, rx + 0.8, rz + 0.5, 1);
    GB(L, 'darkMetal').box(rx - 0.05, L * H, rz - 0.35, rx + 0.75, L * H + 2.1, rz + 0.45);
    const rackFace = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.9), M.rack);
    rackFace.position.set(rx - 0.06, L * H + 1.05, rz + 0.05); rackFace.rotation.y = -Math.PI / 2;
    groups[LI(L)].add(rackFace);
    const glow = new THREE.PointLight(0x33ff88, 8, 6, 2); glow.position.set(rx - 0.6, L * H + 1.2, rz); groups[LI(L)].add(glow);
    animated.push({ update: (t) => { M.rack.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 7) * Math.sin(t * 2.3); T.rack.offset.y = Math.floor(t * 3) % 2 ? 0.003 : 0; glow.intensity = 6 + 3 * Math.sin(t * 5); } });
    poi.rack = { L, x: rx - 0.9, z: rz, y: 1.2 };
    worldSign(L, 'SZAFA RACK 19"', rx - 0.07, 2.35, rz + 0.05, -Math.PI / 2, 0.8, 0.2, { bg: '#111', fg: '#3f8', bc: '#3f8', fs: 50 });
    // stoły z PC
    const f = frame(r);
    for (let v = 2.5; v + 1.3 < f.dep - 0.5; v += 2.3) for (let u = 0.5; u + 1.3 < f.len - 1.9; u += 2.9) desk(r, f, u, v, true);
    fboxIfFree(r, f, 'wood', 0.8, 0.9, 2.4, 1.6, 0.74, 0.78);
    blackboard(r, f, 'Odpalamy cipsko Packet Tracer!');
  }
  function furnishMakieta(r) {
    const L = r.L, cx = (r.ix0 + r.ix1) / 2 + 0.5, cz = (r.iz0 + r.iz1) / 2;
    pbox(L, 'wood', cx - 2.8, 0, cz - 1.6, cx + 2.8, 0.9, cz + 1.6, true);
    pbox(L, 'grassTable', cx - 2.75, 0.9, cz - 1.55, cx + 2.75, 0.93, cz + 1.55);
    // tor (owal z segmentów)
    const seg = 40, rx = 2.2, rz = 1.1;
    for (let k = 0; k < seg; k++) {
      const a = k / seg * Math.PI * 2;
      const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz;
      pbox(L, 'track', x - 0.06, 0.93, z - 0.06, x + 0.06, 0.96, z + 0.06);
    }
    // budyneczki
    pbox(L, 'red', cx - 0.5, 0.93, cz - 0.3, cx - 0.1, 1.15, cz + 0.1); pbox(L, 'yellow', cx + 0.3, 0.93, cz - 0.2, cx + 0.7, 1.1, cz + 0.2);
    pbox(L, 'white', cx - 1.2, 0.93, cz + 0.2, cx - 0.8, 1.25, cz + 0.5);
    // pociąg animowany
    const train = new THREE.Group();
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.1), k ? M.yellow : M.trainRed); c.userData.k = k; train.add(c); }
    groups[LI(L)].add(train);
    animated.push({ update: (t) => { train.children.forEach((c) => { const a = t * 0.6 - c.userData.k * 0.12; c.position.set(cx + Math.cos(a) * rx, L * H + 1.02, cz + Math.sin(a) * rz); c.rotation.y = -a; }); } });
    worldSign(L, 'PKP TK25 — EXPRESS', cx, 1.3, cz - 1.62, Math.PI, 1.6, 0.25, { bg: '#0b2a5a', fg: '#fff', fs: 46 });
    addSpawn(r, cx + 2.4, 1.0, cz + 1.3); addSpawn(r, cx - 2.4, 1.0, cz - 1.3);
  }
  function furnishLibrary(r) {
    const L = r.L;
    for (let z = r.iz0 + 1.2; z < r.iz1 - 2.5; z += 2.2)
      if (rectFree(L, r.ix0 + 0.5, z, r.ix1 - 1.8, z + 0.5)) { pbox(L, 'books', r.ix0 + 0.5, 0, z, r.ix1 - 1.8, 2.1, z + 0.5, true, 2); addSpawn(r, r.ix1 - 1.5, 0.3, z + 0.25); }
    const f = frame(r); desk(r, f, f.len - 2, f.dep - 2.0, true);
  }
  function furnishAula(r) {
    const L = r.L;
    if (r.name === 'Scena') {
      pbox(L, 'wood', r.ix0 + 0.5, 0, r.iz0 + 5, r.ix1 - 0.5, 0.6, r.iz1 - 0.3, true);
      pbox(L, 'curtain', r.ix0 + 0.3, 0.6, r.iz0 + 4.8, r.ix0 + 1.5, 3.4, r.iz0 + 5.0);
      pbox(L, 'curtain', r.ix1 - 1.5, 0.6, r.iz0 + 4.8, r.ix1 - 0.3, 3.4, r.iz0 + 5.0);
      pbox(L, 'black', r.ix0 + 1.0, 0, r.iz0 + 1.5, r.ix0 + 2.5, 1.0, r.iz0 + 2.2, true);
      addSpawn(r, r.ix0 + 1.7, 1.1, r.iz0 + 1.8); addSpawn(r, r.ix1 - 1.2, 0.3, r.iz0 + 2.5);
      return;
    }
    for (let z = r.iz0 + 3; z < r.iz1 - 2; z += 1.4)
      for (const [xa, xb] of [[r.ix0 + 0.8, r.ix0 + 4.2], [r.ix0 + 5.4, r.ix1 - 0.8]])
        if (rectFree(L, xa, z, xb, z + 0.5)) { pbox(L, 'chairRed', xa, 0.42, z, xb, 0.48, z + 0.5, true); pbox(L, 'chairRed', xa, 0.48, z + 0.42, xb, 0.9, z + 0.5); }
    worldSign(L, 'AULA SZKOLNA', (r.ix0 + r.ix1) / 2, 2.6, r.iz0 + 0.02, 0, 3, 0.6, { bg: '#5a1010', fg: '#f0d080' });
    addSpawn(r, r.ix0 + 1, 0.6, r.iz1 - 1.5);
  }
  function furnishBufet(r) {
    const L = r.L, f = frame(r);
    fboxIfFree(r, f, 'wood', 0.3, 0.6, f.len - 1.0, 1.3, 0, 1.05);
    fbox(r, f, 'white', 0.3, 0.6, f.len - 1.0, 1.3, 1.05, 1.1);
    // automat z kawą
    const [ax, az] = f.map(f.len - 0.9, 0.05), [bx, bz] = f.map(f.len - 0.1, 0.85);
    if (rectFree(L, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz))) {
      pbox(L, 'red', ax, 0, az, bx, 1.9, bz, true);
      poi.coffee = { L, x: (ax + bx) / 2, z: (az + bz) / 2 + 0.9, y: 1.2 };
    }
    for (let v = 3; v + 0.8 < f.dep - 0.5; v += 2.4) for (let u = 0.8; u + 0.8 < f.len - 0.5; u += 2.6) {
      if (fboxIfFree(r, f, 'desk', u, v, u + 0.8, v + 0.8, 0.72, 0.76)) { fbox(r, f, 'metal', u + 0.35, v + 0.35, u + 0.45, v + 0.45, 0, 0.72); const [sx, sz] = f.map(u + 0.4, v + 0.4); addSpawn(r, sx, 0.95, sz); }
    }
    const [sx, sz] = f.map(2, 0.95); addSpawn(r, sx, 1.2, sz);
  }
  function furnishServer(r) {
    const L = r.L;
    for (let x = r.ix0 + 0.6; x < r.ix1 - 0.8; x += 1.3)
      if (rectFree(L, x, r.iz0 + 0.5, x + 0.7, r.iz0 + 3.5)) { pbox(L, 'darkMetal', x, 0, r.iz0 + 0.5, x + 0.7, 2.0, r.iz0 + 3.5, true);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.9), M.rack); face.position.set(x + 0.71, L * H + 1.0, r.iz0 + 2.0); face.rotation.y = Math.PI / 2; groups[LI(L)].add(face); }
    addSpawn(r, r.ix1 - 0.8, 0.95, r.iz1 - 1.5);
    pbox(L, 'desk', r.ix1 - 1.4, 0.72, r.iz1 - 2.0, r.ix1 - 0.2, 0.76, r.iz1 - 1.0, true);
  }
  function furnishStorage(r) {
    const L = r.L;
    for (let x = r.ix0 + 0.2; x < r.ix1 - 0.9; x += 1.1) if (rectFree(L, x, r.iz0, x + 0.9, r.iz0 + 0.5)) pbox(L, 'metal', x, 0, r.iz0, x + 0.9, 2.0, r.iz0 + 0.5, true);
    for (let k = 0; k < 4; k++) { const p = randomPointInRoom(r, 1.0); if (p && rectFree(L, p.x - 0.3, p.z - 0.3, p.x + 0.3, p.z + 0.3)) { pbox(L, 'cardboard', p.x - 0.3, 0, p.z - 0.3, p.x + 0.3, 0.5 + Math.random() * 0.4, p.z + 0.3, true); addSpawn(r, p.x, 1.1, p.z); } }
    const p = randomPointInRoom(r, 1.0); if (p) addSpawn(r, p.x, 0.4, p.z);
  }
  function furnishShop(r) {
    const L = r.L;
    for (let x = r.ix0 + 2; x < r.ix1 - 6; x += 2.6) if (rectFree(L, x, r.iz0 + 3, x + 0.8, r.iz1 - 2)) pbox(L, 'shelfShop', x, 0, r.iz0 + 3, x + 0.8, 1.8, r.iz1 - 2, true, 2);
    // lodówki
    for (let z = r.iz0 + 2; z < r.iz1 - 1; z += 1.2) if (rectFree(L, r.ix1 - 0.8, z, r.ix1, z + 1.1)) pbox(L, 'fridge', r.ix1 - 0.8, 0, z, r.ix1, 2.0, z + 1.1, true);
    // lada
    pbox(L, 'wood', r.ix0 + 12, 0, r.iz0 + 0.8, r.ix0 + 16, 1.0, r.iz0 + 1.6, true);
    pbox(L, 'black', r.ix0 + 12.3, 1.0, r.iz0 + 1.0, r.ix0 + 12.8, 1.3, r.iz0 + 1.4);
    pbox(L, 'shelfShop', r.ix0 + 12, 0, r.iz0 + 2.8, r.ix0 + 16, 2.2, r.iz0 + 3.0, true, 2);
    poi.counter = { L, x: r.ix0 + 14, z: r.iz0 + 2.2, y: 1.1 };
    poi.cashier = { L, x: r.ix0 + 14, z: r.iz0 + 0.4 };
  }

  // szafki korytarzowe (część to kryjówki) + szafka z szyfrem
  function lockerRow(L, x0, x1, zWall, dir, hideEvery = 0, opts = {}) {
    // zWall: z linii ściany; dir: +1 szafki od ściany w stronę +z
    const za = zWall, zb = zWall + dir * 0.5;
    let k = 0;
    for (let x = x0; x + 0.5 <= x1 + 0.001; x += 0.5, k++) {
      if (!rectFree(L, x, Math.min(za, zb), x + 0.5, Math.max(za, zb))) continue;
      const special = opts.special && Math.abs(x - opts.special) < 0.01;
      pbox(L, special ? 'lockerRed' : 'locker', x + 0.02, 0, Math.min(za, zb), x + 0.48, 1.9, Math.max(za, zb), true, 1);
      if (special) {
        poi.cipherLocker = { L, x: x + 0.25, z: zb + dir * 0.6, lx: x + 0.25, lz: (za + zb) / 2 };
        worldSign(L, 'NIE RUSZAĆ — ZIĘBIŃSKI', x + 0.25, 2.05, zb + dir * 0.01, dir > 0 ? 0 : Math.PI, 0.9, 0.18, { bg: '#ffeb3b', fg: '#111', fs: 40, bc: '#111' });
      } else if (hideEvery && k % hideEvery === 1) {
        hideSpots.push({ L, x: x + 0.25, z: (za + zb) / 2, ex: x + 0.25, ez: zb + dir * 0.55, kind: 'szafka', yaw: dir > 0 ? 0 : Math.PI, room: 'korytarz' });
        worldSign(L, '▣', x + 0.25, 1.95, zb + dir * 0.005, dir > 0 ? 0 : Math.PI, 0.18, 0.12, { bg: '#2a2', fg: '#fff', fs: 60, border: false });
      }
    }
  }
  function lockerCol(L, z0, z1, xWall, dir, hideEvery = 0) {
    const xa = xWall, xb = xWall + dir * 0.5; let k = 0;
    for (let z = z0; z + 0.5 <= z1 + 0.001; z += 0.5, k++) {
      if (!rectFree(L, Math.min(xa, xb), z, Math.max(xa, xb), z + 0.5)) continue;
      pbox(L, 'locker', Math.min(xa, xb), 0, z + 0.02, Math.max(xa, xb), 1.9, z + 0.48, true, 1);
      if (hideEvery && k % hideEvery === 1) {
        hideSpots.push({ L, x: (xa + xb) / 2, z: z + 0.25, ex: xb + dir * 0.55, ez: z + 0.25, kind: 'szafka', yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2, room: 'korytarz' });
        worldSign(L, '▣', xb + dir * 0.005, 1.95, z + 0.25, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0.18, 0.12, { bg: '#2a2', fg: '#fff', fs: 60, border: false });
      }
    }
  }

  function buildOutdoor(scene) {
    const L = 0, g = groups[1];
    // drzewa
    const trunkM = new THREE.MeshLambertMaterial({ color: 0x3a2a1a }), leafM = new THREE.MeshLambertMaterial({ color: 0x1c3318 });
    const trees = [[-3, 50], [3, 56], [30, 52], [40, 58], [55, 50], [65, 57], [80, 52], [92, 58], [-3, 10], [-3, 30], [95, 10], [95, 30], [60, 32], [25, 35], [20, -4], [60, -4]];
    for (const [x, z] of trees) {
      if (baseAt(0, x, z) !== 3) continue;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 3, 6), trunkM); t.position.set(x, 1.5, z); g.add(t);
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), leafM); c.position.set(x, 3.8, z); c.scale.y = 1.3; g.add(c);
      setBlock(0, x - 0.3, z - 0.3, x + 0.3, z + 0.3, 1);
    }
    // latarnie uliczne
    const poles = [[8, 50], [30, 46], [50, 52], [75, 48], [23, 62], [10, 68], [40, 68], [60, 68], [85, 68], [38, 80], [25, 90], [52, 80]];
    for (const [x, z] of poles) {
      if (baseAt(0, x, z) !== 3) continue;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5, 6), M.darkMetal); p.position.set(x, 2.5, z); g.add(p);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.25), M.street); h.position.set(x, 5, z); g.add(h);
      lamps.push({ L: 0, x, y: 4.8, z, flick: Math.random() < 0.2 ? 1 : 0, outdoor: true });
      setBlock(0, x - 0.2, z - 0.2, x + 0.2, z + 0.2, 1);
    }
    // ławki na dziedzińcu
    for (const [x, z] of [[20, 50], [45, 48], [70, 50]]) { pbox(L, 'wood', x - 1, 0.4, z - 0.25, x + 1, 0.48, z + 0.25, true); pbox(L, 'darkMetal', x - 0.9, 0, z - 0.2, x - 0.8, 0.4, z + 0.2); pbox(L, 'darkMetal', x + 0.8, 0, z - 0.2, x + 0.9, 0.4, z + 0.2); }
    // szyld szkoły nad wejściem (od zewnątrz)
    worldSign(L, 'ZESPÓŁ SZKÓŁ — TK 25', 13.25, 3.0, 44.55, 0, 4.2, 0.7, { bg: '#e8e2cc', fg: '#1a3a6a', fs: 70 });
    // Lewiatan — zielony szyld
    const lw = worldSign(L, 'LEWIATAN', 25, 3.3, 71.48, Math.PI, 7, 1.2, { bg: '#1f8a3a', fg: '#ffffff', bc: '#e6f5e8', fs: 110, em: 0x88ff99 });
    const lwl = new THREE.PointLight(0x55ff77, 40, 16, 2); lwl.position.set(25, 3.5, 69.5); g.add(lwl);
    worldSign(L, 'Otwarte 6–23', 25, 2.45, 71.47, Math.PI, 1.4, 0.3, { bg: '#fff', fg: '#1f8a3a', fs: 50 });
    // palarnia
    worldSign(L, 'PALARNIA ZA LEWIATANEM', 24, 2.0, 84.55, 0, 3.2, 0.5, { bg: '#222', fg: '#ffcc00', bc: '#ffcc00', fs: 56, em: 0x664400 });
    pbox(L, 'wood', 20, 0.4, 88, 24, 0.48, 88.5, true); pbox(L, 'darkMetal', 26, 0, 88, 26.5, 0.9, 88.5, true);
    poi.palarnia = { L, x: 24, z: 88, r: 5 };
    // pojazdy (sekretne zakończenia)
    poi.vehicles = [];
    const addVeh = (id, name, x, z, build, who) => { const grp = new THREE.Group(); build(grp); grp.position.set(x, 0, z); g.add(grp); poi.vehicles.push({ id, name, L: 0, x, z, who, grp }); };
    const bodyM = (c) => new THREE.MeshLambertMaterial({ color: c });
    const box = (grp, m, x, y, z, sx, sy, sz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); grp.add(b); return b; };
    const wheel = (grp, x, y, z, r, w, rotZ = true) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), M.black); c.position.set(x, y, z); if (rotZ) c.rotation.z = Math.PI / 2; else c.rotation.x = Math.PI / 2; grp.add(c); };
    addVeh('S1000RR', 'BMW S1000RR', 33, 89, (grp) => {
      box(grp, bodyM(0xe8e8e8), 0, 0.75, 0, 0.35, 0.4, 1.4); box(grp, bodyM(0x1a4fd0), 0, 0.95, 0.3, 0.37, 0.25, 0.6); box(grp, bodyM(0xd02020), 0, 0.9, -0.4, 0.36, 0.2, 0.4);
      wheel(grp, 0, 0.33, 0.75, 0.32, 0.15, false); wheel(grp, 0, 0.33, -0.75, 0.32, 0.18, false);
      wheel(grp, 0, 0.33, 0.75, 0.32, 0.15); grp.children[grp.children.length - 1].rotation.set(0, 0, Math.PI / 2);
    }, 'wiktor');
    addVeh('HELI', 'Helikopter', 52, 85, (grp) => {
      box(grp, bodyM(0x202830), 0, 1.4, 0, 2.0, 1.6, 3.6); box(grp, M.glass, 0, 1.6, 1.6, 1.8, 1.0, 0.6); box(grp, bodyM(0x202830), 0, 1.6, -3.2, 0.3, 0.4, 3.2);
      box(grp, M.darkMetal, 0.9, 0.2, 0, 0.1, 0.1, 3.4); box(grp, M.darkMetal, -0.9, 0.2, 0, 0.1, 0.1, 3.4);
      const rotor = box(grp, M.black, 0, 2.35, 0, 8, 0.05, 0.25); const r2 = box(grp, M.black, 0, 2.35, 0, 0.25, 0.05, 8);
      animated.push({ update: (t, dt) => { const sp = grp.userData.spin || 0.3; rotor.rotation.y += dt * sp; r2.rotation.y += dt * sp; } });
      const pad = new THREE.Mesh(new THREE.CircleGeometry(4.5, 24), new THREE.MeshLambertMaterial({ color: 0x404448 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; grp.add(pad);
      const hm = worldSign(0, 'H', 0, 0.03, 0, 0, 3, 3, { bg: '#404448', fg: '#ffeb3b', fs: 120, border: false }); hm.rotation.set(-Math.PI / 2, 0, 0); hm.position.set(0, 0.03, 0); g.remove(hm); grp.add(hm);
    }, 'wiktor');
    addVeh('KEEWAY', 'Keeway (Stage 1)', 33, 86, (grp) => {
      box(grp, bodyM(0x111111), 0, 0.6, 0, 0.4, 0.35, 1.3); box(grp, bodyM(0xff6a00), 0, 0.85, 0.35, 0.42, 0.25, 0.45);
      wheel(grp, 0, 0.28, 0.6, 0.27, 0.14, true); grp.children[grp.children.length - 1].rotation.set(0, 0, Math.PI / 2);
      wheel(grp, 0, 0.28, -0.6, 0.27, 0.16, true); grp.children[grp.children.length - 1].rotation.set(0, 0, Math.PI / 2);
      grp.children.slice(-2).forEach(w => { w.rotation.set(0, Math.PI / 2, Math.PI / 2); });
    }, 'szymon');
    addVeh('BMW', 'BMW Stage 1', 46, 75, (grp) => {
      box(grp, bodyM(0x1a1a1f), 0, 0.65, 0, 1.8, 0.6, 4.4); box(grp, bodyM(0x1a1a1f), 0, 1.15, -0.2, 1.6, 0.5, 2.2); box(grp, M.glass, 0, 1.16, -0.2, 1.62, 0.42, 2.0);
      for (const [x, z] of [[0.9, 1.4], [-0.9, 1.4], [0.9, -1.4], [-0.9, -1.4]]) wheel(grp, x, 0.33, z, 0.33, 0.25);
      box(grp, new THREE.MeshBasicMaterial({ color: 0xbfe0ff }), 0.6, 0.7, 2.21, 0.35, 0.12, 0.02); box(grp, new THREE.MeshBasicMaterial({ color: 0xbfe0ff }), -0.6, 0.7, 2.21, 0.35, 0.12, 0.02);
      box(grp, new THREE.MeshBasicMaterial({ color: 0xff2020 }), 0.65, 0.75, -2.21, 0.3, 0.1, 0.02); box(grp, new THREE.MeshBasicMaterial({ color: 0xff2020 }), -0.65, 0.75, -2.21, 0.3, 0.1, 0.02);
    }, 'szymon');
    for (const v of poi.vehicles) {
      const s = v.id === 'HELI' ? 2.0 : v.id === 'BMW' ? 1.1 : 0.4;
      setBlock(0, v.x - s, v.z - (v.id === 'BMW' ? 2.3 : v.id === 'HELI' ? 2 : 0.8), v.x + s, v.z + (v.id === 'BMW' ? 2.3 : v.id === 'HELI' ? 2 : 0.8), 1);
    }
    // samochody zaparkowane na ulicy (dekoracja)
    const carCols = [0x6a1a1a, 0x1a3a6a, 0x777777, 0x2a4a2a];
    [[4, 69.5], [48, 69.5], [66, 69.5], [80, 69.5]].forEach(([x, z], k) => {
      const grp = new THREE.Group(); box(grp, bodyM(carCols[k]), 0, 0.6, 0, 4.2, 0.6, 1.7); box(grp, bodyM(carCols[k]), -0.2, 1.1, 0, 2.2, 0.5, 1.5);
      grp.position.set(x, 0, z); g.add(grp); setBlock(0, x - 2.1, z - 0.85, x + 2.1, z + 0.85, 1);
    });
    // bloki w tle (poza ogrodzeniem)
    const bm = new THREE.MeshLambertMaterial({ color: 0x1a1c22 });
    const winM = new THREE.MeshBasicMaterial({ color: 0xffd890 });
    [[-30, 20, 12, 18, 40], [120, 30, 14, 24, 30], [30, -30, 40, 12, 10], [70, 110, 30, 15, 12], [-25, 85, 12, 20, 20], [110, 90, 16, 18, 18]].forEach(([x, z, sx, sy, sz]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), bm); b.position.set(x, sy / 2, z); g.add(b);
      for (let k = 0; k < 12; k++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1), winM); w.position.set(x + (Math.random() - 0.5) * sx * 0.8, 2 + Math.random() * (sy - 3), z + sz / 2 + 0.05); g.add(w); }
    });
    // ziemia poza mapą
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.grass); gr.rotation.x = -Math.PI / 2; gr.position.set(45, -0.05, 45);
    M.grass.map.repeat.set(1, 1); g.add(gr);
  }


  // =====================================================================
  //  DETALE: gaśnice, hydranty, tablice ogłoszeń, zegary, ławki, kosze, rośliny, rury pod sufitem
  // =====================================================================
  function canvasPlane(w, h, cw, ch, draw, x, y, z, rotY, L, extra = {}) {
    const t = mkTex(cvs(cw, ch, draw));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: extra.rough || 0.7, metalness: 0, transparent: !!extra.alpha, emissive: extra.em || 0x000000, emissiveMap: extra.em ? t : null, envMapIntensity: 0.4 }));
    m.position.set(x, L * H + y, z); m.rotation.y = rotY; groups[LI(L)].add(m); return m;
  }
  function paperBoard(g, w, h) {
    g.fillStyle = '#b68a52'; g.fillRect(0, 0, w, h); grain(g, w, h, 0.18, 2500);
    g.strokeStyle = '#6b4a2e'; g.lineWidth = 12; g.strokeRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { const pw = 50 + Math.random() * 50, ph = 60 + Math.random() * 40, px = 16 + Math.random() * (w - pw - 32), py = 16 + Math.random() * (h - ph - 32);
      g.save(); g.translate(px + pw / 2, py + ph / 2); g.rotate((Math.random() - 0.5) * 0.15); g.fillStyle = ['#f4f1e6', '#f7e58a', '#bfe0f5', '#f3b7b7'][k % 4]; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.fillStyle = '#333'; for (let q = 0; q < 6; q++) g.fillRect(-pw / 2 + 5, -ph / 2 + 10 + q * 8, (pw - 10) * (0.4 + Math.random() * 0.6), 2);
      g.fillStyle = '#c22'; g.beginPath(); g.arc(0, -ph / 2 + 4, 3, 0, 7); g.fill(); g.restore(); }
    g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.fillText('OGŁOSZENIA', 18, 34);
  }
  function clockFace(g, w) {
    const c = w / 2; g.fillStyle = '#f4f2ea'; g.beginPath(); g.arc(c, c, c - 4, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#222'; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.fillRect(c + Math.sin(a) * (c - 22) - 2, c - Math.cos(a) * (c - 22) - 6, 4, 12); }
    g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.moveTo(c, c); g.lineTo(c + 30, c - 18); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(c, c); g.lineTo(c - 8, c - 52); g.stroke();
    g.strokeStyle = '#c22'; g.lineWidth = 2; g.beginPath(); g.moveTo(c, c); g.lineTo(c + 44, c + 22); g.stroke();
  }
  function buildDecor() {
    let seed = 7; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const r of rooms) {
      if (!r || (r.type !== 'corridor' && r.type !== 'hall')) continue;
      const L = r.L, l = LI(L), horiz = (r.ix1 - r.ix0) >= (r.iz1 - r.iz0);
      const slots = [];
      const long = horiz ? r.ix1 - r.ix0 : r.iz1 - r.iz0;
      if (long < 8) continue;
      for (let c = (horiz ? r.ix0 : r.iz0) + 3.5; c < (horiz ? r.ix1 : r.iz1) - 2; c += 4.5) {
        for (const side of [-1, 1]) {
          // płaszczyzna ściany: -1 = „początek” osi poprzecznej (normalna +), +1 = koniec (normalna −)
          const plane = horiz ? (side < 0 ? r.iz0 : r.iz1) : (side < 0 ? r.ix0 : r.ix1);
          const n = -side;
          const x0 = horiz ? c - 0.35 : (side < 0 ? plane : plane - 0.5), x1 = horiz ? c + 0.35 : (side < 0 ? plane + 0.5 : plane);
          const z0 = horiz ? (side < 0 ? plane : plane - 0.5) : c - 0.35, z1 = horiz ? (side < 0 ? plane + 0.5 : plane) : c + 0.35;
          const bx = horiz ? c : plane - n * 0.25, bz = horiz ? plane - n * 0.25 : c;
          if (baseAt(L, bx, bz) !== 0) continue;
          if (!rectFree(L, x0, z0, x1, z1)) continue;
          slots.push({ c, side, plane, n, x0, z0, x1, z1 });
        }
      }
      let k = 0;
      for (const sl of slots) {
        const kind = ['ext', 'board', 'clock', 'hyd', 'board', 'exit'][k++ % 6];
        const px = horiz ? sl.c : sl.plane + sl.n * 0.02, pz = horiz ? sl.plane + sl.n * 0.02 : sl.c;
        const rot = horiz ? (sl.n > 0 ? 0 : Math.PI) : (sl.n > 0 ? Math.PI / 2 : -Math.PI / 2);
        if (kind === 'board') canvasPlane(1.3, 0.85, 512, 340, paperBoard, px, 1.55, pz, rot, L);
        else if (kind === 'clock' && L >= 0) canvasPlane(0.4, 0.4, 128, 128, (g) => clockFace(g, 128), px, 2.65, pz, rot, L, { alpha: true });
        else if (kind === 'ext') {
          const cx = horiz ? sl.c : sl.plane + sl.n * 0.1, cz = horiz ? sl.plane + sl.n * 0.1 : sl.c;
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.45, 12), M.extinguisher); body.position.set(cx, L * H + 0.95, cz);
          const top = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.1, 10), M.darkMetal); top.position.set(cx, L * H + 1.22, cz);
          const hose = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, 4.2), M.rubber); hose.position.set(cx, L * H + 1.05, cz); hose.rotation.y = rot; hose.position.x += horiz ? 0.09 : 0; hose.position.z += horiz ? 0 : 0.09;
          groups[LI(L)].add(body, top, hose);
          canvasPlane(0.34, 0.34, 128, 128, (g) => { g.fillStyle = '#c41818'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = 'bold 20px Arial'; g.textAlign = 'center'; g.fillText('GAŚNICA', 64, 24); g.fillStyle = '#fff'; g.fillRect(52, 40, 24, 62); g.fillRect(44, 36, 40, 10); }, px, 1.65, pz, rot, L);
        } else if (kind === 'hyd') {
          const gW = GB(L, 'hydrant'); const cw = 0.3, dd = 0.22;
          if (horiz) gW.box(sl.c - cw, L * H + 0.9, Math.min(sl.plane, sl.plane + sl.n * dd), sl.c + cw, L * H + 1.6, Math.max(sl.plane, sl.plane + sl.n * dd));
          else gW.box(Math.min(sl.plane, sl.plane + sl.n * dd), L * H + 0.9, sl.c - cw, Math.max(sl.plane, sl.plane + sl.n * dd), L * H + 1.6, sl.c + cw);
          const fx = horiz ? sl.c : sl.plane + sl.n * (dd + 0.005), fz = horiz ? sl.plane + sl.n * (dd + 0.005) : sl.c;
          canvasPlane(0.5, 0.6, 128, 150, (g) => { g.fillStyle = '#a81616'; g.fillRect(0, 0, 128, 150); g.fillStyle = '#fff'; g.font = 'bold 20px Arial'; g.textAlign = 'center'; g.fillText('HYDRANT', 64, 28); g.fillText('HW', 64, 52); g.strokeStyle = '#ddd'; g.lineWidth = 8; for (let q = 0; q < 3; q++) { g.beginPath(); g.arc(64, 104, 18 + q * 6, 0, 7); g.stroke(); } }, fx, 1.25, fz, rot, L);
        } else if (kind === 'exit' && L >= 0) {
          canvasPlane(0.6, 0.22, 256, 96, (g) => { g.fillStyle = '#0a8a3a'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#fff'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.fillText('WYJŚCIE ➜', 128, 62); }, px, 2.9, pz, rot, L, { em: 0x22aa55 });
        }
      }
      // rury / kanały pod sufitem wzdłuż jednej ściany
      if (long > 12) {
        const yb = L * H + 3.05;
        if (horiz) { GB(L, 'metal').box(r.ix0 + 0.5, yb, r.iz0 + 0.05, r.ix1 - 0.5, yb + 0.09, r.iz0 + 0.14); GB(L, 'darkMetal').box(r.ix0 + 0.5, yb - 0.12, r.iz0 + 0.07, r.ix1 - 0.5, yb - 0.04, r.iz0 + 0.15); GB(L, 'white').box(r.ix0 + 1, yb - 0.02, r.iz1 - 0.6, r.ix1 - 1, yb + 0.28, r.iz1 - 0.1); }
        else { GB(L, 'metal').box(r.ix0 + 0.05, yb, r.iz0 + 0.5, r.ix0 + 0.14, yb + 0.09, r.iz1 - 0.5); }
      }
    }
    // ławki i kosze w holach, rośliny w rogach
    for (const r of rooms) {
      if (!r || r.type !== 'hall') continue;
      const L = r.L;
      for (let t = 0; t < 14; t++) {
        const x = r.ix0 + 0.8 + rr() * (r.ix1 - r.ix0 - 1.6), z = r.iz0 + 0.8 + rr() * (r.iz1 - r.iz0 - 1.6);
        const kind = t % 3;
        if (kind === 0 && rectFree(L, x - 0.9, z - 0.3, x + 0.9, z + 0.3)) { pbox(L, 'wood', x - 0.9, 0.42, z - 0.25, x + 0.9, 0.48, z + 0.25, true); pbox(L, 'darkMetal', x - 0.85, 0, z - 0.2, x - 0.75, 0.42, z + 0.2); pbox(L, 'darkMetal', x + 0.75, 0, z - 0.2, x + 0.85, 0.42, z + 0.2); }
        else if (kind === 1 && rectFree(L, x - 0.3, z - 0.3, x + 0.3, z + 0.3)) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.6, 12), M.darkMetal); c.position.set(x, L * H + 0.3, z); groups[LI(L)].add(c); setBlock(L, x - 0.25, z - 0.25, x + 0.25, z + 0.25, 1); }
        else if (kind === 2 && rectFree(L, x - 0.4, z - 0.4, x + 0.4, z + 0.4)) { pbox(L, 'pot', x - 0.25, 0, z - 0.25, x + 0.25, 0.4, z + 0.25, true); const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), M.plant); pl.position.set(x, L * H + 1.0, z); pl.scale.set(1, 1.3, 1); groups[LI(L)].add(pl); }
      }
    }
  }

  function furnishAll() {
    const cabinsParter = [];
    for (const r of rooms) {
      if (!r) continue;
      switch (r.type) {
        case 'class': furnishClass(r, false); break;
        case 'itlab': furnishClass(r, true); break;
        case 'lab': furnishClass(r, false); break;
        case 'office': furnishOffice(r); break;
        case 'teachers': furnishTeachers(r); break;
        case 'wc': furnishWC(r, cabinsParter); break;
        case 'workshop': furnishWorkshop(r); break;
        case 'netlab': furnishNetlab(r); break;
        case 'makieta': furnishMakieta(r); break;
        case 'library': furnishLibrary(r); break;
        case 'aula': furnishAula(r); break;
        case 'bufet': furnishBufet(r); break;
        case 'server': furnishServer(r); break;
        case 'storage': furnishStorage(r); break;
        case 'shop': furnishShop(r); break;
      }
    }
    // szafki — parter, korytarz główny (ściana południowa z=27)
    lockerRow(0, 18, 24, 27, -1, 5);
    lockerRow(0, 25, 33, 27, -1, 5, { special: 30.5 });
    lockerRow(0, 51, 58, 27, -1, 5);
    lockerRow(0, 60, 70, 27, -1, 5);
    lockerCol(0, 13, 22, 79, -1, 5);
    // piętro
    lockerRow(1, 18, 32, 27, -1, 5);
    lockerRow(1, 52, 70, 27, -1, 6);
    lockerCol(1, 32, 42, 79, -1, 5);
    // przyziemie
    lockerCol(-1, 26, 33, 79, -1, 4);
    lockerCol(-1, 5, 11, 75.5, 1, 4);
    // zablokowany korytarz: krata
    const gL = -1, gx = 69.75;
    const grate = new THREE.Group();
    for (let z = 24.1; z < 27; z += 0.2) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, 0.05), z % 0.4 < 0.2 ? M.red : M.black); b.position.set(gx, gL * H + H / 2, z); grate.add(b); }
    for (let y = 0.3; y < H; y += 0.6) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3), M.red); b.position.set(gx, gL * H + y, 25.5); grate.add(b); }
    groups[0].add(grate);
    worldSign(gL, 'ZAKAZ WSTĘPU', gx + 0.06, 1.6, 25.5, Math.PI / 2, 1.8, 0.45, { bg: '#c01010', fg: '#fff', bc: '#000', fs: 70 });
    worldSign(gL, '⚠ strefa odcięta ⚠', gx + 0.06, 1.05, 25.5, Math.PI / 2, 1.4, 0.25, { bg: '#000', fg: '#ffeb3b', fs: 50, border: false });
    // szyld schodów
    worldSign(0, 'PRZYZIEMIE ↓ (W-01, W-02, MAKIETA)', 73.75, 2.7, 24.02, 0, 2.4, 0.3, { bg: '#1a6a3a', fg: '#fff', fs: 40 });
    worldSign(-1, 'PARTER ↑', 75.52, 2.6, 13.75, Math.PI / 2, 1.2, 0.3, { bg: '#1a6a3a', fg: '#fff', fs: 54 });
    worldSign(0, 'PIĘTRO ↑ (AULA, BIBLIOTEKA, BUFET)', 14.02, 2.7, 41.2, -Math.PI / 2, 2.4, 0.3, { bg: '#1a6a3a', fg: '#fff', fs: 40 });
    worldSign(1, 'PARTER ↓', 15.75, 2.6, 29.0, Math.PI, 1.2, 0.3, { bg: '#1a6a3a', fg: '#fff', fs: 54 });
    worldSign(0, 'WYJŚCIE GŁÓWNE', 13.25, 2.85, 43.47, Math.PI, 2.2, 0.35, { bg: '#118833', fg: '#fff', fs: 56, em: 0x22aa44 });
    // tablica ogłoszeń / plan ewakuacyjny w korytarzu
    worldSign(0, 'PLAN EWAKUACJI — PARTER', 45, 1.6, 24.02, 0, 1.4, 0.9, { bg: '#fff', fg: '#060', fs: 34 });
    worldSign(0, 'Strefa Zakazana — tylko nauczyciele', 9.98, 2.4, 12, -Math.PI / 2, 2.2, 0.3, { bg: '#a01818', fg: '#fff', fs: 34 });
  }

  // =====================================================================
  //  BUDOWA CAŁOŚCI
  // =====================================================================
  function build(scene) {
    buildLayout();
    for (const l of [0, 1, 2]) { groups[l] = new THREE.Group(); groups[l].name = 'level' + (l - 1); scene.add(groups[l]); }
    buildTextures(); buildMaterials();
    furnishAll();
    buildDecor();
    buildOutdoor(scene);
    buildDoorsAndSigns(scene);
    buildStructure();
    buildLamps();
    for (const L of LEVELS) {
      const b = builders[LI(L)];
      for (const k in b) { const m = b[k].mesh(matOf(k)); if (m) { m.updateMatrix(); groups[LI(L)].add(m); } }
    }
    computeNearWall();
    loadAssetTextures();
    // punkty startowe i POI
    const w02 = roomByName('W-02', -1);
    poi.playerStart = { L: -1, x: 84.5, z: 29.5, yaw: Math.PI * 0.5 };
    poi.topinekDesk = { L: -1, x: 81.2, z: 27.5 };
    poi.w02 = w02;
    poi.pendrive = { L: -1, x: 80.9, y: 0.95, z: 26.3 };
    poi.zieb = { L: 0, x: 63.5, z: 21.5 };
    poi.flor = { L: 0, x: 48.0, z: 6.5 };
    poi.mariusz = { L: 0, x: 37, z: 39 };
    poi.meetWC = roomByName('WC przy W-22', 0);
    return { groups };
  }

  // opcjonalne tekstury zewnętrzne (assets/tex/*.jpg) — jeśli plik istnieje, podmienia proceduralną teksturę
  function loadAssetTextures() {
    // opcjonalny plik assets/tex/manifest.json: ["floor", "wall", ...] — tylko wymienione pliki są ładowane (brak 404 w konsoli)
    const map = { floor: ['terrazzo'], ceiling: ['ceiling'], lino: ['lino', 'linoGreen', 'linoBlue'], tiles: ['tiles'], pavement: ['pavement'], asphalt: ['asphalt'], wood: ['wood'] };
    if (typeof fetch !== 'function') return;
    fetch('assets/tex/manifest.json').then(r => r.ok ? r.json() : []).then((list) => {
      const loader = new THREE.TextureLoader();
      for (const k of list) {
        if (!map[k]) continue;
        loader.load('assets/tex/' + k + '.jpg', (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
          for (const n of map[k]) if (M[n]) { M[n].map = tex; if (M[n].bumpMap) M[n].bumpMap = tex; M[n].needsUpdate = true; }
        });
      }
    }).catch(() => {});
  }

  // podgląd planu (minimapa)
  const mapCanvas = {};
  function minimapCanvas(L) {
    if (mapCanvas[L]) return mapCanvas[L];
    const s = 2, c = document.createElement('canvas'); c.width = W * s; c.height = D * s;
    const g = c.getContext('2d'); const l = LI(L);
    g.fillStyle = '#05070a'; g.fillRect(0, 0, c.width, c.height);
    const col = { corridor: '#3d4a52', hall: '#455560', stair: '#4f8a5a', wc: '#3a5a6a', outdoor: '#1c2a1c', shop: '#1f5a2a', office: '#5a4a3a', teachers: '#6a3a3a' };
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
      const cc = idx(i, j), bv = base[l][cc];
      if (!bv) continue;
      const r = rooms[roomA[l][cc]];
      g.fillStyle = bv === 2 ? col.stair : bv === 3 ? (r && r.floor === 'gravel' ? '#3a3420' : r && r.floor === 'asphalt' ? '#222428' : '#283028') : (r ? (col[r.type] || '#34404a') : '#333');
      if (r && r.zone === 'zakazana') g.fillStyle = '#5a2a2a';
      if (block[l][cc] === 1) g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(i * s, j * s, s, s);
    }
    // etykiety
    g.fillStyle = '#e8e8e8'; g.font = 'bold 8px Arial'; g.textAlign = 'center';
    for (const r of rooms) {
      if (!r || r.L !== L || r.type === 'corridor' || r.type === 'stair' || r.type === 'wc' || (r.type === 'outdoor' && !/PALARNIA|Parking/.test(r.name)) || (r.x1 - r.x0) * (r.z1 - r.z0) < 22) continue;
      const x = (ci((r.ix0 + r.ix1) / 2)) * s, y = (cj((r.iz0 + r.iz1) / 2)) * s;
      const words = (r.sign || r.name).split(' ');
      if (words.length > 2) { g.fillText(words.slice(0, 2).join(' '), x, y - 4); g.fillText(words.slice(2).join(' '), x, y + 6); } else g.fillText(r.name.length < 14 ? r.name : (r.sign || r.name), x, y);
    }
    mapCanvas[L] = c; return c;
  }

  return {
    H, CELL, X0, Z0, W, D, LEVELS, LI, rooms, doors, stairs, lamps, hideSpots, poi, spawnable, animated, groups, M, T,
    build, snap, baseAt, walkable, roomAt, stairAt, stairH, levelOfY, ground, collide, los, clearLine, findPath, randomPointInRoom,
    setBlock, blockCells, roomByName, minimapCanvas, ci, cj, cxOf, czOf, worldSign, textTex,
    isBlocked: (L, x, z) => !walkable(L, x, z),
    blockAt: (L, x, z) => { const i = ci(x), j = cj(z); return inB(i, j) ? block[LI(L)][idx(i, j)] : 0; },
  };
})();
