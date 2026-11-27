// =====================================================================
//  ai.js — nauczyciele: modele 3D, etykiety, maszyny stanów, wzrok/słuch
// =====================================================================
'use strict';

const AI = (() => {
  const actors = [];
  let ctx = null; // ustawiane przez game.js
  const rnd = (a) => a[(Math.random() * a.length) | 0];

  // --------------------------------------------------------------- definicje
  const DEFS = {
    topinek: { name: 'Rafał Topinek', tag: 'Topinek • łowca', kind: 'hunter', glasses: true, skin: 0, color: 0x2c3a52, pants: 0x1c1c24, hair: 0x2a2018, hostile: true, scale: 1.0,
      patrol: 1.7, chase: [4.0, 4.0, 5.0, 5.3], vision: 17, fov: 130,
      lines: { spot: ['Panie Nawrocki!', 'Czarna lista!', 'Stój pan!'], chase: ['Redo się zjebało!', 'Odpalamy Ventoya!', 'Panie Nawrocki!!!'], search: ['Gdzie on polazł...', 'Redo się zjebało!'], caught: ['Czarna lista, panie Nawrocki!'] } },
    demkow: { name: 'Gabriel Demkow', tag: 'MEGA BOSS • Demkow', kind: 'hunter', color: 0x161616, pants: 0x101010, hair: 0x111111, hostile: true, scale: 1.28, boss: true,
      patrol: 2.4, chase: [5.2, 5.2, 5.2, 5.3], vision: 22, fov: 150, hearing: 1.6,
      lines: { spot: ['STÓJ!', 'Nie ma ucieczki!'], chase: ['IDĘ PO CIEBIE!', 'Dawaj tu!'], search: ['Gdzie jesteś?!'], caught: ['Mam cię.'] } },
    pawlyszcze: { name: 'Jolanta Pawłyszcze', tag: 'Pawłyszcze • zwiadowca', kind: 'scout', color: 0x7a2f55, pants: 0x2a2a30, hair: 0x6a4a2a, hostile: true, female: true,
      patrol: 1.6, chase: 3.4, vision: 14, fov: 120,
      lines: { spot: ['Znowu ten telefon!', 'Kto rzucił tą mandarynką?!'], chase: ['Włączamy Code::Blocks!', 'Znowu ten telefon!'], search: ['Kto rzucił tą mandarynką?!'], caught: ['Wpis do dziennika!'] } },
    orlowska: { name: 'Karolina Orłowska', tag: 'Orłowska • polski', kind: 'quiz', quiz: 'pl', color: 0x2f6a5a, pants: 0x222a2a, hair: 0x2a1a10, hostile: true, female: true,
      patrol: 1.5, chase: 3.0, vision: 12, fov: 110,
      lines: { spot: ['Moi drodzy...', 'Albo wiecie, albo jeden!'], chase: ['Cała klasa jedynki!', 'Moi drodzy...'], search: ['Moi drodzy...'], caught: ['Albo wiecie, albo jeden!'] } },
    iduszkiewicz: { name: 'Iwona Duszkiewicz', tag: 'I. Duszkiewicz • matma', glasses: true, kind: 'quiz', quiz: 'math', color: 0x6a5a2f, pants: 0x2a2822, hair: 0x888078, hostile: true, female: true,
      patrol: 1.5, chase: 3.0, vision: 12, fov: 110,
      lines: { spot: ['Funkcja liniowa!', 'Trójkąt!'], chase: ['Oddaj telefon!', 'Funkcja liniowa!'], search: ['Trójkąt!'], caught: ['Oddaj telefon!'] } },
    kowalczyk: { name: 'Maciej Kowalczyk', tag: 'Kowalczyk • dyżurny', kind: 'situational', color: 0x4a4a2a, pants: 0x222222, hair: 0x3a2a1a, hostile: true,
      patrol: 1.8, chase: 4.2, vision: 15, fov: 120,
      lines: { spot: ['Nawrocki, od razu jeden!', 'Gówniarze na Kawasaki!'], chase: ['Gówniarze na Kawasaki!', 'Nawrocki, od razu jeden!'], search: ['Gówniarze na Kawasaki!'], caught: ['Nawrocki, od razu jeden!'] } },
    ziebinski: { name: 'Ziębiński', tag: 'Ziębiński • sojusznik', kind: 'ally', color: 0x3a3a3a, pants: 0x20242c, hair: 0x4a3a2a, ally: true, patrol: 0, speed: 5.4,
      lines: { idle: ['Kurwa panowie...', 'Jak mnie Topin dopadnie...', 'Która tam na ośce?', 'Szlugen machen!'] } },
    florczykiewicz: { name: 'Zbigniew Florczykiewicz', tag: 'Siwy • Ślusarnia', glasses: true, jacket: false, kind: 'static', color: 0x5a5a60, pants: 0x2a2a30, hair: 0xb8b8b8, ally: true,
      lines: { idle: ['Odpalamy cipsko Packet Tracer!', 'Prezydent musi mieć 5!'] } },
    mariusz: { name: 'Mariusz Duszkiewicz', tag: 'M. Duszkiewicz • ojciec', kind: 'static', color: 0x3a5a3a, pants: 0x2a2a2a, hair: 0x2a2a2a, ally: true, scale: 1.05,
      lines: { idle: ['Ojciec wie najlepiej.', 'Młody, nie szukasz mojego e-peta?'] } },
    student: { name: 'Uczeń', tag: '', kind: 'student', color: 0x4a6a9a, pants: 0x222a3a, hair: 0x2a2a2a, neutral: true },
    grymek: { name: 'Zenon Grymek', tag: 'Grymek • neutralny', kind: 'static', neutral: true, color: 0x6a4a3a, pants: 0x2a2a2a, hair: 0x555555, lines: { idle: ['Panie kolego, mam sprawę.'] } },
    jelonek: { name: 'Beata Jelonek', tag: 'Jelonek • neutralna', kind: 'static', neutral: true, female: true, color: 0x3a6a8a, pants: 0x2a2a34, hair: 0x8a5a2a, lines: { idle: ['Wyglądasz na zmęczonego...'] } },
    porada: { name: 'Paulina Porada', tag: 'Porada • neutralna', kind: 'static', neutral: true, female: true, color: 0x8a3a3a, pants: 0x2a2a2a, hair: 0x1a1a1a, lines: { idle: ['Może Ci pomogę?'] } },
    kaczmarczyk: { name: 'Agnieszka Kaczmarczyk', tag: 'Kaczmarczyk • neutralna', kind: 'static', neutral: true, female: true, color: 0x5a3a7a, pants: 0x222222, hair: 0xc8a050, lines: { idle: ['Cichutko, cichutko...'] } },
    rajca: { name: 'Anna Rajca', tag: 'Rajca • neutralna', kind: 'static', neutral: true, female: true, color: 0x3a7a5a, pants: 0x2a3a2a, hair: 0x6a2a1a, lines: { idle: ['Biegasz? Mam tipa.'] } },
  };

  // --------------------------------------------------------------- quizy
  const QUIZ = {
    pl: [
      ['Kto napisał „Lalkę”?', ['Bolesław Prus', 'Henryk Sienkiewicz', 'Adam Mickiewicz']],
      ['Epopeja narodowa Polaków to…', ['„Pan Tadeusz”', '„Quo vadis”', '„Wesele”']],
      ['Ile jest przypadków w polskiej deklinacji?', ['7', '5', '9']],
      ['„Ó” pisze się po…', ['w wyrazach, gdzie wymienia się na o, e', 'zawsze na początku', 'tylko w nazwach własnych']],
      ['Autor „Dziadów”?', ['Adam Mickiewicz', 'Juliusz Słowacki', 'Zygmunt Krasiński']],
      ['Który wyraz jest poprawny?', ['wziąć', 'wziońć', 'wziąść']],
      ['Rzeczownik „kot” w dopełniaczu to…', ['kota', 'kotu', 'kotem']],
      ['Środek stylistyczny: „szaleje burza” to…', ['personifikacja', 'onomatopeja', 'hiperbola']],
      ['Kto jest autorem „Wesela”?', ['Stanisław Wyspiański', 'Bolesław Prus', 'Witold Gombrowicz']],
      ['Ile sylab ma wyraz „tramwaj”?', ['2', '3', '1']],
      ['„Rz” w wyrazie „rzeka” to…', ['dwuznak', 'trójznak', 'litera']],
      ['Synonim słowa „szybki”:', ['rączy', 'powolny', 'ociężały']],
    ],
    math: [
      ['f(x) = 2x + 3. Ile wynosi f(4)?', ['11', '8', '14']],
      ['Miejsce zerowe funkcji y = 2x − 6?', ['x = 3', 'x = −3', 'x = 6']],
      ['Pole trójkąta: podstawa 10, wysokość 6?', ['30', '60', '16']],
      ['Suma kątów w trójkącie to…', ['180°', '360°', '90°']],
      ['Funkcja y = −x + 5 jest…', ['malejąca', 'rosnąca', 'stała']],
      ['Wykres y = 3x + 1 przecina oś Y w punkcie…', ['(0, 1)', '(1, 0)', '(0, 3)']],
      ['Trójkąt prostokątny 3-4-?. Przeciwprostokątna to…', ['5', '6', '7']],
      ['Współczynnik kierunkowy y = 4x − 2 to…', ['4', '−2', '2']],
      ['Obwód trójkąta o bokach 5, 6, 7?', ['18', '16', '210']],
      ['f(x) = x − 4. Dla jakiego x f(x) = 0?', ['4', '−4', '0']],
    ],
  };
  function pickQuiz(kind, n) {
    const bank = QUIZ[kind].slice().sort(() => Math.random() - 0.5).slice(0, n);
    return bank.map(([q, ans]) => { const correct = ans[0]; const opts = ans.slice().sort(() => Math.random() - 0.5); return { q, opts, correct: opts.indexOf(correct) }; });
  }

  // --------------------------------------------------------------- model
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const std = (c, r = 0.65, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMapIntensity: 0.5 });
  const GEO = { cyl: new THREE.CylinderGeometry(1, 1, 1, 14), sph: new THREE.SphereGeometry(1, 16, 12), cone: new THREE.CylinderGeometry(0.75, 1, 1, 16), cap: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58) };
  function mesh(geo, mat, sx, sy, sz, x, y, z) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; }
  function limbG(r, len, mat, y, tipMat, tipR) { const p = new THREE.Group(); const m = mesh(GEO.cyl, mat, r, len, r, 0, -len / 2, 0); p.add(m); if (tipMat) p.add(mesh(GEO.sph, tipMat, tipR, tipR, tipR, 0, -len - tipR * 0.4, 0)); p.position.y = y; return p; }
  function labelSprite(text, sub, color) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 20, 512, 92);
    g.textAlign = 'center'; g.fillStyle = color; g.font = 'bold 44px Arial'; g.fillText(text, 256, 66);
    g.fillStyle = '#ddd'; g.font = '26px Arial'; g.fillText(sub, 256, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    s.scale.set(1.8, 0.45, 1); return s;
  }
  function bangSprite() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#ff2020'; g.font = 'bold 60px Arial'; g.textAlign = 'center'; g.fillText('!', 32, 54); g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeText('!', 32, 54);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, toneMapped: false })); s.scale.set(0.5, 0.5, 1); return s;
  }
  const faceCache = {};
  function faceTex(def) {
    const key = (def.skin || 0) + ':' + (def.female ? 1 : 0) + ':' + (def.boss ? 1 : 0) + ':' + (def.glasses ? 1 : 0) + ':' + (def.mood || 0);
    if (faceCache[key]) return faceCache[key];
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    // oczy
    for (const x of [44, 84]) { g.fillStyle = '#f4f1ec'; g.beginPath(); g.ellipse(x, 62, 11, 7.5, 0, 0, 7); g.fill(); g.fillStyle = def.female ? '#3a5a7a' : '#3a2a1a'; g.beginPath(); g.arc(x + 1, 62, 5, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(x + 1, 62, 2.4, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(x - 1, 59, 2, 2); }
    // brwi (zmarszczone przy wrogach)
    g.strokeStyle = def.hair ? '#' + def.hair.toString(16).padStart(6, '0') : '#222'; g.lineWidth = 5; g.lineCap = 'round';
    const ang = def.hostile ? 6 : 0; g.beginPath(); g.moveTo(32, 46 + ang); g.lineTo(56, 44 - ang); g.stroke(); g.beginPath(); g.moveTo(72, 44 - ang); g.lineTo(96, 46 + ang); g.stroke();
    // nos i usta
    g.strokeStyle = 'rgba(120,70,50,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 66); g.lineTo(60, 84); g.lineTo(68, 85); g.stroke();
    g.strokeStyle = def.female ? '#a8343c' : '#7a3a34'; g.lineWidth = def.female ? 5 : 3.5; g.beginPath();
    if (def.hostile) { g.moveTo(48, 100); g.quadraticCurveTo(64, 94, 80, 100); } else { g.moveTo(48, 98); g.quadraticCurveTo(64, 108, 80, 98); } g.stroke();
    if (def.glasses) { g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(28, 50, 32, 24); g.strokeRect(68, 50, 32, 24); g.beginPath(); g.moveTo(60, 60); g.lineTo(68, 60); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return faceCache[key] = t;
  }
  // ---------------------------------------------------------- prawdziwe modele GLB (szkielet Mixamo + animacje)
  // assets/models/manifest.json: { "demkow": { "file": "soldier.glb", "scale": 1 }, "topinek": "topinek.glb", ... }
  // Animacje w pliku rozpoznawane po nazwach: idle / walk / run (np. z Mixamo). Brak wpisu = model proceduralny.
  const MODELS = { ready: false, byId: {} };
  function stripRoot(clip) { const c = clip.clone(); c.tracks = c.tracks.filter(t => !/\.(position|scale)$/.test(t.name)); return c; }
  async function loadModels() {
    if (!window.GLTFLoader || !window.SkeletonUtils || typeof fetch !== 'function') return false;
    try {
      const mr = await fetch('assets/models/manifest.json'); if (!mr.ok) return false;
      const man = await mr.json(), ld = new window.GLTFLoader(), cache = {};
      for (const id in man) {
        const e = typeof man[id] === 'string' ? { file: man[id] } : man[id];
        if (!cache[e.file]) {
          const r = await fetch('assets/models/' + e.file); if (!r.ok) { console.warn('Brak modelu', e.file); continue; }
          const buf = await r.arrayBuffer();
          cache[e.file] = await new Promise((res, rej) => ld.parse(buf, '', res, rej));
        }
        const gltf = cache[e.file], find = (re) => gltf.animations.find(c => re.test(c.name)) || gltf.animations[0];
        if (!gltf.animations.length) { console.warn('Model bez animacji', e.file); continue; }
        MODELS.byId[id] = { gltf, scale: e.scale || 1, tint: e.tint === undefined ? 0.6 : e.tint, clips: { idle: stripRoot(find(/idle/i)), walk: stripRoot(find(/walk/i)), run: stripRoot(find(/run/i)) } };
      }
      MODELS.ready = Object.keys(MODELS.byId).length > 0;
    } catch (e) { console.warn('Modele GLB niedostępne — tryb proceduralny:', e.message); MODELS.ready = false; }
    return MODELS.ready;
  }
  function buildGLB(def, id) {
    const m = MODELS.byId[id]; const root = window.SkeletonUtils.clone(m.gltf.scene); root.scale.multiplyScalar(m.scale);
    const g = new THREE.Group(); g.add(root); g.scale.setScalar(def.scale || 1);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone(); o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; o.material.envMapIntensity = 0.8;
      if (m.tint !== 1) o.material.color.multiplyScalar(m.tint);
    });
    const mixer = new THREE.AnimationMixer(root), act = {};
    for (const n of ['idle', 'walk', 'run']) { act[n] = mixer.clipAction(m.clips[n]); act[n].play(); act[n].setEffectiveWeight(n === 'idle' ? 1 : 0); }
    const label = labelSprite(def.name, def.tag, def.hostile ? '#ff5a4a' : def.ally ? '#6aff8a' : '#cccccc'); label.position.y = 2.3 * (def.scale || 1); g.add(label);
    const bang = bangSprite(); bang.position.y = 2.75 * (def.scale || 1); bang.visible = false; g.add(bang);
    const d = () => new THREE.Group();
    return { g, legL: d(), legR: d(), armL: d(), armR: d(), label, bang, body: root, mixer, act, w: { idle: 1, walk: 0, run: 0 } };
  }
  function animGLB(m, a, dt) {
    const sp = a.speedNow, tgt = sp < 0.25 ? 'idle' : sp < 3.4 ? 'walk' : 'run';
    for (const n of ['idle', 'walk', 'run']) { m.w[n] += ((n === tgt ? 1 : 0) - m.w[n]) * Math.min(1, dt * 9); m.act[n].setEffectiveWeight(m.w[n]); }
    m.act.walk.timeScale = Math.max(0.5, Math.min(1.8, sp / 1.45)); m.act.run.timeScale = Math.max(0.8, Math.min(1.6, sp / 5.2));
    m.mixer.update(dt);
  }
  const SKINS = [0xe0b394, 0xd9a883, 0xc99a78, 0xeac4a8];
  function buildMesh(def, id) {
    if (MODELS.ready && MODELS.byId[id]) { try { return buildGLB(def, id); } catch (e) { console.warn('GLB nieudany, fallback', e); } }
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const sk = def.skin !== undefined ? def.skin : (def.name ? def.name.length % 4 : 0);
    const skin = std(SKINS[sk % 4], 0.55), shirt = std(def.color, 0.8), pants = std(def.pants || 0x2a2a3a, 0.8), hairM = std(def.hair || 0x222222, 0.7), shoe = std(0x141414, 0.4, 0.1);
    const suit = !def.female && !def.neutral || def.suit;
    // nogi + buty
    const legL = limbG(0.085, 0.86, pants, 0.9), legR = limbG(0.085, 0.86, pants, 0.9); legL.position.x = -0.11; legR.position.x = 0.11;
    for (const l of [legL, legR]) l.add(mesh(boxGeo, shoe, 0.11, 0.07, 0.28, 0, -0.9, 0.05));
    body.add(legL, legR);
    // spódnica dla nauczycielek
    if (def.female) body.add(mesh(GEO.cone, std(def.pants || 0x2a2a30, 0.85), 0.3, 0.5, 0.26, 0, 0.84, 0));
    // tułów
    const torsoCol = suit && def.jacket !== false ? std(def.color, 0.75) : shirt;
    body.add(mesh(GEO.cyl, torsoCol, 0.22, 0.62, 0.15, 0, 1.2, 0));
    body.add(mesh(GEO.sph, torsoCol, 0.235, 0.12, 0.16, 0, 1.5, 0));            // barki
    body.add(mesh(GEO.cyl, skin, 0.05, 0.1, 0.05, 0, 1.58, 0));                  // szyja
    if (suit) { body.add(mesh(boxGeo, std(0xeeeeee, 0.7), 0.1, 0.26, 0.02, 0, 1.38, 0.15)); body.add(mesh(boxGeo, std(def.boss ? 0x7a0a0a : 0x222a6a, 0.5), 0.045, 0.22, 0.02, 0, 1.35, 0.162)); }
    // ręce
    const armL = limbG(0.055, 0.62, torsoCol, 1.5, skin, 0.055), armR = limbG(0.055, 0.62, torsoCol, 1.5, skin, 0.055); armL.position.x = -0.3; armR.position.x = 0.3; body.add(armL, armR);
    // głowa
    const head = mesh(GEO.sph, skin, 0.125, 0.15, 0.13, 0, 1.73, 0); body.add(head);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.235, 0.235), new THREE.MeshStandardMaterial({ map: faceTex(def), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    face.position.set(0, 1.725, 0.128); body.add(face);
    body.add(mesh(GEO.sph, skin, 0.022, 0.03, 0.02, -0.125, 1.72, 0), mesh(GEO.sph, skin, 0.022, 0.03, 0.02, 0.125, 1.72, 0)); // uszy
    // włosy
    if (def.hair !== 0xb8b8b8 || true) {
      const hc = mesh(GEO.cap, hairM, 0.135, 0.16, 0.14, 0, 1.745, -0.005); hc.rotation.x = -0.12; body.add(hc);
      if (def.female) { body.add(mesh(GEO.cyl, hairM, 0.13, 0.32, 0.07, 0, 1.6, -0.1)); body.add(mesh(GEO.sph, hairM, 0.07, 0.07, 0.07, 0, 1.87, -0.09)); }
      else body.add(mesh(GEO.cyl, hairM, 0.125, 0.08, 0.11, 0, 1.72, -0.06));
    }
    if (def.glasses) for (const x of [-0.045, 0.045]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.004, 6, 14), std(0x111111, 0.3, 0.5)); r.position.set(x, 1.74, 0.138); body.add(r); }
    if (def.boss) { body.add(mesh(boxGeo, std(0x050505, 0.2, 0.3), 0.27, 0.05, 0.03, 0, 1.745, 0.14)); }
    g.scale.setScalar(def.scale || 1);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    const col = def.hostile ? '#ff5a4a' : def.ally ? '#6aff8a' : '#cccccc';
    const label = labelSprite(def.name, def.tag, col); label.position.y = 2.3 * (def.scale || 1); g.add(label);
    const bang = bangSprite(); bang.position.y = 2.75 * (def.scale || 1); bang.visible = false; g.add(bang);
    return { g, legL, legR, armL, armR, label, bang, body };
  }

  // --------------------------------------------------------------- aktor
  const R = 0.26;
  function create(id, L, x, z, opts = {}) {
    const def = opts.def || DEFS[id];
    const a = { id, def, L, x, z, y: L * MAP.H, yaw: Math.random() * 6.28, state: def.kind === 'hunter' ? 'patrol' : 'idle', path: null, pi: 0, stun: 0, wait: 0.5,
      anim: 0, speedNow: 0, seenT: 0, lostT: 0, lastSeen: null, target: null, repathT: 0, stuckT: 0, lastX: x, lastZ: z, cool: 0, hintT: 8, sawHide: null,
      lineT: 5 + Math.random() * 6, sees: false, active: true, home: { L, x, z }, mode: null, freezeT: 0, seeAcc: 0, ...opts };
    a.mesh = buildMesh(def, id);
    a.mesh.g.position.set(x, a.y, z);
    ctx.scene.add(a.mesh.g);
    actors.push(a); return a;
  }
  function remove(a) { ctx.scene.remove(a.mesh.g); const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); }
  const get = (id) => actors.find(a => a.id === id);

  function onStairs(a) { return MAP.baseAt(a.L, a.x, a.z) === 2; }
  function goTo(a, L, x, z) {
    const p = MAP.findPath(a.L, a.x, a.z, L, x, z);
    a.path = p; a.pi = p ? Math.min(1, p.length - 1) : 0; a.stuckT = 0; a.repathT = 0;
    return !!p;
  }
  function follow(a, dt, speed) {
    if (!a.path || a.pi >= a.path.length) { a.speedNow = 0; return true; }
    let best = a.pi;
    if (!onStairs(a)) for (let k = Math.min(a.path.length - 1, a.pi + 7); k > a.pi; k--) { const n = a.path[k]; if (n.L === a.L && MAP.clearLine(a.L, a.x, a.z, n.x, n.z)) { best = k; break; } }
    a.pi = best;
    const n = a.path[a.pi];
    let dx = n.x - a.x, dz = n.z - a.z; const d = Math.hypot(dx, dz);
    if (d < 0.3) { a.pi++; return a.pi >= a.path.length; }
    dx /= d; dz /= d;
    const step = Math.min(d, speed * dt);
    const p = { x: a.x + dx * step, z: a.z + dz * step };
    MAP.collide(a.L, p, R);
    const moved = Math.hypot(p.x - a.x, p.z - a.z);
    a.x = p.x; a.z = p.z; a.speedNow = moved / Math.max(dt, 1e-4);
    const ty = Math.atan2(dx, dz); let dy = ty - a.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; a.yaw += dy * Math.min(1, dt * 10);
    // zacięcie
    if (moved < speed * dt * 0.25) { a.stuckT += dt; if (a.stuckT > 1.0) { a.stuckT = 0; a.needRepath = true; } } else a.stuckT = 0;
    return false;
  }
  function lookAt(a, tx, tz, dt, rate = 8) {
    const ty = Math.atan2(tx - a.x, tz - a.z); let dy = ty - a.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; a.yaw += dy * Math.min(1, dt * rate);
  }
  function groundSync(a) {
    const g = MAP.ground(a.L, a.x, a.z); a.y = g.y; a.L = g.L;
  }

  // wzrok
  function canSee(a, P, rangeMul = 1) {
    if (P.hidden && !a.sawHide) return false;
    if (a.def.hostile === undefined || ctx.G.noSight) return false;
    const dy = Math.abs(P.y - a.y); if (dy > 2.4) return false;
    const dx = P.x - a.x, dz = P.z - a.z, d = Math.hypot(dx, dz);
    let range = (a.def.vision || 12) * rangeMul;
    if (P.crouch) range *= 0.75;
    if (ctx.G.smokeT > 0 && Math.hypot(P.x - ctx.G.smokePos.x, P.z - ctx.G.smokePos.z) < 4) range *= 0.25;
    if (d > range) return false;
    if (d > 2.2) {
      const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
      const dot = (dx * fx + dz * fz) / d;
      if (dot < Math.cos((a.def.fov || 110) * Math.PI / 360)) return false;
    }
    const L = P.L === a.L ? a.L : (onStairs(a) ? a.L : P.L);
    return MAP.los(L, a.x, a.z, P.x, P.z);
  }
  function chooseRoomPoint(names, level) {
    for (let k = 0; k < 8; k++) {
      const r = MAP.roomByName(rnd(names), level);
      if (!r) continue;
      const p = MAP.randomPointInRoom(r, 0.8); if (p) return p;
    }
    return null;
  }

  // --------------------------------------------------------------- patrole
  const PATROL = {
    topinek: { lesson: [['Korytarz główny', 0], ['Hol główny', 0], ['Przedsionek warsztatów', 0], ['Korytarz przyziemia', -1], ['Korytarz pracowni', 0]],
               break: [['Korytarz główny', 0], ['Hol główny', 0], ['Korytarz piętra', 1], ['Korytarz przyziemia', -1], ['Korytarz pracowni', 0], ['WC przy W-22', 0], ['Przedsionek warsztatów', 0], ['Hol piętra', 1]] },
    pawlyszcze: { lesson: [['Pokój Nauczycielski', 0], ['Korytarz administracyjny', 0], ['Hol główny', 0], ['Sekretariat', 0]],
                  break: [['Korytarz administracyjny', 0], ['Hol główny', 0], ['Korytarz główny', 0], ['Pokój Nauczycielski', 0], ['Przedsionek warsztatów', 0]] },
    orlowska: { lesson: [['Sekretariat', 0], ['Korytarz administracyjny', 0], ['Pokój Nauczycielski', 0], ['A-5', 0]],
                break: [['Korytarz administracyjny', 0], ['Hol główny', 0], ['Pokój Nauczycielski', 0], ['Korytarz główny', 0]] },
    iduszkiewicz: { lesson: [['Księgowość', 0], ['Korytarz administracyjny', 0], ['Gabinet Dyrektora', 0], ['Pokój Nauczycielski', 0]],
                    break: [['Hol główny', 0], ['Korytarz administracyjny', 0], ['Korytarz główny', 0], ['Pokój Nauczycielski', 0]] },
    kowalczyk: { lesson: [['Korytarz piętra', 1], ['Hol piętra', 1]], break: [['Korytarz główny', 0], ['Korytarz pracowni', 0], ['Korytarz piętra', 1], ['WC przy sali 14', 0], ['Hol główny', 0]] },
    demkow: { lesson: [['Korytarz główny', 0], ['Hol główny', 0], ['Korytarz pracowni', 0], ['Przedsionek warsztatów', 0]], break: [['Korytarz główny', 0], ['Hol główny', 0], ['Korytarz pracowni', 0], ['Przedsionek warsztatów', 0]] },
  };
  function nextPatrol(a) {
    const tbl = PATROL[a.id]; if (!tbl) return false;
    if (a.L > -1 && ctx.P.L === -1 && ctx.G.outside) return false;
    const list = tbl[ctx.G.phase === 'break' ? 'break' : 'lesson'];
    for (let k = 0; k < 6; k++) {
      const [name, lv] = rnd(list); const r = MAP.roomByName(name, lv); if (!r) continue;
      const p = MAP.randomPointInRoom(r, 0.8); if (!p) continue;
      if (goTo(a, p.L, p.x, p.z)) return true;
    }
    return false;
  }
  function say(a, kind) {
    const arr = a.def.lines[kind]; if (!arr) return;
    ctx.say(a, rnd(arr));
  }

  // --------------------------------------------------------------- aktualizacje typów
  function updateHunter(a, dt) {
    const P = ctx.P, G = ctx.G, def = a.def;
    if (a.stun > 0) { a.stun -= dt; a.state = 'stunned'; a.speedNow = 0; a.mesh.bang.visible = false; if (a.stun <= 0) a.state = 'search'; return; }
    if (a.mode === 'desk') { a.speedNow = 0; lookAt(a, P.x, P.z, dt, 3); return; }
    if (a.lured > 0 && a.id === 'topinek') {
      a.lured -= dt;
      if (!a.sees || !ctx.G.stars) { // odciągnięty przez Grymka
        const t = a.lureTarget; if (!a.path || a.needRepath) { goTo(a, t.L, t.x, t.z); a.needRepath = false; }
        follow(a, dt, 2.4); if (a.sawLure !== true) { a.sawLure = true; } return;
      }
    }
    a.cool -= dt;
    // wzrok (co ~0.1 s)
    a.seeT = (a.seeT || 0) - dt;
    if (a.seeT <= 0) { a.seeT = 0.1; a.sees = canSee(a, P, def.boss ? 1 : 1 + (G.stars >= 2 ? 0.2 : 0)); }
    const speedChase = def.chase[Math.min(3, G.stars)];
    if (a.sees) {
      a.lostT = 0; a.lastSeen = { L: P.L, x: P.x, z: P.z };
      if (a.state !== 'chase') {
        a.state = 'chase'; a.path = null; a.repathT = 0; say(a, 'spot'); ctx.onSpotted(a);
        if (a.id === 'topinek' || def.boss) ctx.shareLast(a.lastSeen, a);
      }
    }
    a.mesh.bang.visible = a.state === 'chase';
    a.lineT -= dt;
    switch (a.state) {
      case 'patrol': {
        // podpowiedzi przy gwiazdkach
        if (G.stars >= 1 && !P.hidden && a.id !== 'demkow') {
          a.hintT -= dt;
          if (a.hintT <= 0) {
            a.hintT = [0, 14, 9, 6][G.stars];
            const rad = [0, 16, 9, 4][G.stars];
            const ang = Math.random() * 6.28, rr = Math.random() * rad;
            const t = MAP.snap(P.L, P.x + Math.cos(ang) * rr, P.z + Math.sin(ang) * rr);
            if (goTo(a, t.L, t.x, t.z)) { a.state = 'investigate'; a.target = t; }
          }
        }
        if (a.wait > 0) { a.wait -= dt; a.speedNow = 0; break; }
        if (!a.path || a.needRepath) { a.needRepath = false; if (!nextPatrol(a)) { a.wait = 1; break; } }
        if (follow(a, dt, def.patrol)) { a.wait = 1.2 + Math.random() * 2.5; a.path = null; }
        break;
      }
      case 'investigate': {
        if (a.needRepath && a.target) { a.needRepath = false; goTo(a, a.target.L, a.target.x, a.target.z); }
        if (follow(a, dt, def.patrol + (G.stars >= 2 ? 1.6 : 0.9)) || !a.path) { a.state = 'search'; a.searchT = 4; a.path = null; }
        break;
      }
      case 'chase': {
        const tgt = a.sawHide || (a.sees ? { L: P.L, x: P.x, z: P.z } : a.lastSeen);
        if (!a.sees) {
          a.lostT += dt;
          if (a.lostT > 2.6 && !a.sawHide) { a.state = 'search'; a.searchT = 5; a.path = null; say(a, 'search'); break; }
        }
        a.repathT -= dt;
        if (tgt && (a.repathT <= 0 || a.needRepath || !a.path)) { a.repathT = 0.35; a.needRepath = false; if (!goTo(a, tgt.L, tgt.x, tgt.z)) { a.path = null; a.repathT = 1.2; } }
        follow(a, dt, speedChase);
        if (a.lineT <= 0) { a.lineT = 5 + Math.random() * 4; say(a, 'chase'); }
        const dx = P.x - a.x, dz = P.z - a.z, d = Math.hypot(dx, dz);
        const caughtD = a.sawHide ? Math.hypot(a.sawHide.x - a.x, a.sawHide.z - a.z) : d;
        if (caughtD < (a.sawHide ? 1.5 : 1.05) && Math.abs(P.y - a.y) < 1.8 && (a.sees || a.sawHide)) { say(a, 'caught'); ctx.caught(a); }
        break;
      }
      case 'search': {
        if (a.lastSeen && a.path === null && !a.reached) {
          if (!goTo(a, a.lastSeen.L, a.lastSeen.x, a.lastSeen.z)) { a.reached = true; }
        }
        if (a.path && !a.reached) { if (follow(a, dt, def.patrol + 1.2)) { a.reached = true; a.path = null; } break; }
        // rozglądanie
        a.searchT -= dt; a.yaw += dt * 2.2; a.speedNow = 0;
        // sprawdź kryjówki w pobliżu
        if (P.hidden && Math.hypot(P.x - a.x, P.z - a.z) < 2.6 && Math.random() < dt * 0.35 && a.id !== 'xx') { say(a, 'caught'); ctx.caught(a, true); }
        if (a.searchT <= 0) { a.state = 'patrol'; a.reached = false; a.path = null; a.wait = 0.3; a.sawHide = null; }
        break;
      }
    }
    if (def.boss && a.state === 'patrol') { // Demkow zawsze wie gdzie jesteś na 3★ (mniej gdy się chowasz)
      if (!P.hidden && G.stars >= 3) { a.state = 'investigate'; a.target = { L: P.L, x: P.x, z: P.z }; goTo(a, P.L, P.x, P.z); }
    }
  }
  function hearNoise(n) { // n: {L,x,z,r}
    for (const a of actors) {
      if (!a.active || a.stun > 0) continue;
      const k = a.def.kind; if (k !== 'hunter' && k !== 'scout' && k !== 'situational') continue;
      if (a.state === 'chase') continue;
      if (a.mode === 'desk') continue;
      const lv = Math.abs(a.y - n.y);
      const d = Math.hypot(a.x - n.x, a.z - n.z) + lv * 2.5;
      const r = n.r * (a.def.hearing || 1) * (k === 'hunter' ? 1 : 0.7);
      if (d < r) {
        const t = MAP.snap(n.L, n.x, n.z);
        if (goTo(a, t.L, t.x, t.z)) { a.state = 'investigate'; a.target = t; a.lastSeen = t; a.reached = false; a.wait = 0; }
      }
    }
  }
  function updateScout(a, dt) { // Pawłyszcze
    const P = ctx.P, G = ctx.G, def = a.def;
    if (a.stun > 0) { a.stun -= dt; a.speedNow = 0; return; }
    if (a.freezeT > 0) { a.freezeT -= dt; a.speedNow = 0; return; }
    a.cool -= dt;
    const arek = G.char.id === 'arek';
    a.seeT = (a.seeT || 0) - dt;
    if (a.seeT <= 0) { a.seeT = 0.1; a.sees = canSee(a, P); }
    const ignore = arek && G.stars === 0;
    const sees = a.sees && !ignore;
    if (sees) {
      a.lostT = 0; a.lastSeen = { L: P.L, x: P.x, z: P.z };
      if (a.state !== 'chase') { a.state = 'chase'; say(a, 'spot'); ctx.onSpotted(a); a.seeAcc = 0; a.path = null; }
      a.seeAcc += dt;
      const need = arek ? 8 : 4;
      if (a.seeAcc >= need) { a.seeAcc = 0; ctx.addStars(1, a); }
      ctx.report(a.lastSeen, a); // melduje Topinkowi
    } else if (a.state === 'chase') { a.lostT += dt; if (a.lostT > 2.5) { a.state = 'patrol'; a.path = null; a.wait = 1; } }
    a.mesh.bang.visible = a.state === 'chase';
    if (a.state === 'chase') {
      a.repathT -= dt;
      if (a.repathT <= 0 || !a.path) { a.repathT = 0.4; const t = a.lastSeen; if (t) goTo(a, t.L, t.x, t.z); }
      follow(a, dt, def.chase + (G.stars >= 2 ? 0.5 : 0));
      a.lineT -= dt; if (a.lineT <= 0) { a.lineT = 6; say(a, 'chase'); }
      const d = Math.hypot(P.x - a.x, P.z - a.z);
      if (d < 1.3 && a.cool <= 0 && !ignore && Math.abs(P.y - a.y) < 1.8) { a.cool = 10; ctx.freeze(1.6, a); ctx.addStars(1, a); ctx.say(a, 'Wpis do dziennika!'); }
    } else {
      if (a.wait > 0) { a.wait -= dt; a.speedNow = 0; return; }
      if (!a.path || a.needRepath) { a.needRepath = false; if (!nextPatrol(a)) { a.wait = 1; return; } }
      if (follow(a, dt, def.patrol)) { a.wait = 1.5 + Math.random() * 2.5; a.path = null; }
    }
  }
  function updateQuiz(a, dt) { // Orłowska / I. Duszkiewicz
    const P = ctx.P, G = ctx.G, def = a.def;
    if (a.stun > 0) { a.stun -= dt; a.speedNow = 0; return; }
    a.cool -= dt;
    a.seeT = (a.seeT || 0) - dt;
    if (a.seeT <= 0) { a.seeT = 0.1; a.sees = canSee(a, P); }
    if (a.ignoreT > 0) { a.ignoreT -= dt; a.sees = false; }
    if (a.sees && a.cool <= 0) {
      a.lastSeen = { L: P.L, x: P.x, z: P.z };
      if (a.state !== 'chase') { a.state = 'chase'; say(a, 'spot'); ctx.onSpotted(a); a.path = null; }
    } else if (a.state === 'chase' && !a.sees) { a.lostT += dt; if (a.lostT > 2.5) { a.state = 'patrol'; a.path = null; a.lostT = 0; } }
    if (a.sees) a.lostT = 0;
    a.mesh.bang.visible = a.state === 'chase';
    if (a.state === 'chase') {
      a.repathT -= dt;
      if (a.repathT <= 0 || !a.path) { a.repathT = 0.4; const t = a.lastSeen; if (t) goTo(a, t.L, t.x, t.z); }
      follow(a, dt, def.chase);
      const d = Math.hypot(P.x - a.x, P.z - a.z);
      if (d < 2.4 && Math.abs(P.y - a.y) < 1.8 && a.sees) {
        a.cool = 45; a.state = 'patrol'; a.path = null; a.wait = 1;
        if (def.quiz === 'pl') ctx.quiz(a, pickQuiz('pl', 3), (ok) => { if (ok) a.ignoreT = 30; });
        else if (Math.random() < 0.6) ctx.quiz(a, pickQuiz('math', 1), (ok) => { if (ok) a.ignoreT = 30; });
        else { ctx.blackout(9, a); ctx.say(a, 'Oddaj telefon!'); a.ignoreT = 12; }
      }
    } else {
      if (a.wait > 0) { a.wait -= dt; a.speedNow = 0; return; }
      if (!a.path || a.needRepath) { a.needRepath = false; if (!nextPatrol(a)) { a.wait = 1; return; } }
      if (follow(a, dt, def.patrol)) { a.wait = 1.5 + Math.random() * 2.5; a.path = null; }
    }
  }
  function updateSituational(a, dt) { // Kowalczyk: pojawia się na przerwach
    const P = ctx.P, G = ctx.G, def = a.def;
    const should = G.phase === 'break' && G.t > 120;
    a.mesh.g.visible = a.active;
    if (!a.active) { if (should) { a.active = true; const r = MAP.roomByName('Korytarz główny', 0); const p = MAP.randomPointInRoom(r, 0.8); a.x = p.x; a.z = p.z; a.L = 0; a.path = null; a.state = 'patrol'; a.mesh.g.visible = true; ctx.say(a, 'Dyżur! Wszyscy do klas!'); } return; }
    if (!should && a.state !== 'chase') { if (!a.leaving) { a.leaving = true; goTo(a, 0, 4, 18); } follow(a, dt, def.patrol + 1); if (!a.path || a.pi >= a.path.length) { a.active = false; a.leaving = false; a.mesh.g.visible = false; } return; }
    a.leaving = false; a.cool -= dt; a.cool2 = (a.cool2 || 0) - dt;
    if (a.stun > 0) { a.stun -= dt; a.speedNow = 0; return; }
    a.seeT = (a.seeT || 0) - dt;
    if (a.seeT <= 0) { a.seeT = 0.1; a.sees = canSee(a, P); }
    if (a.sees) { a.lostT = 0; a.lastSeen = { L: P.L, x: P.x, z: P.z }; if (a.state !== 'chase') { a.state = 'chase'; say(a, 'spot'); ctx.onSpotted(a); a.path = null; if (a.cool <= 0) { ctx.addStars(1, a); a.cool = 20; } } }
    else if (a.state === 'chase') { a.lostT += dt; if (a.lostT > 3) { a.state = 'patrol'; a.path = null; } }
    a.mesh.bang.visible = a.state === 'chase';
    if (a.state === 'chase') {
      a.repathT -= dt; if (a.repathT <= 0 || !a.path) { a.repathT = 0.4; const t = a.lastSeen; if (t) goTo(a, t.L, t.x, t.z); }
      follow(a, dt, def.chase);
      const d = Math.hypot(P.x - a.x, P.z - a.z);
      if (d < 1.4 && a.sees && a.cool2 <= 0 && Math.abs(P.y - a.y) < 1.8) { a.cool2 = 20; say(a, 'caught'); ctx.freeze(1.2, a); a.state = 'patrol'; a.path = null; a.wait = 2; }
    } else {
      if (a.wait > 0) { a.wait -= dt; a.speedNow = 0; return; }
      if (!a.path || a.needRepath) { a.needRepath = false; if (!nextPatrol(a)) { a.wait = 1; return; } }
      if (follow(a, dt, def.patrol)) { a.wait = 1 + Math.random() * 2; a.path = null; }
    }
  }
  function updateAlly(a, dt) { // Ziębiński
    const P = ctx.P, G = ctx.G;
    a.lineT -= dt;
    if (a.lineT <= 0) { a.lineT = 11 + Math.random() * 8; if (Math.hypot(P.x - a.x, P.z - a.z) < 14 && ctx.G.started) ctx.say(a, rnd(a.def.lines.idle)); }
    if (a.mode === 'follow') {
      const d = Math.hypot(P.x - a.x, P.z - a.z);
      a.repathT -= dt;
      const dl = Math.abs(P.y - a.y);
      if (d > 2.8 || dl > 1.2) {
        if (a.repathT <= 0 || !a.path || a.needRepath) { a.repathT = 0.5; a.needRepath = false; goTo(a, P.L, P.x, P.z); }
        follow(a, dt, Math.min(6.0, ctx.P.speed * 1.12 + 0.6));
      } else { a.speedNow = 0; lookAt(a, P.x, P.z, dt); }
    } else {
      a.speedNow = 0;
      if (a.mode === 'wait') lookAt(a, P.x, P.z, dt, 3);
    }
  }
  function updateStatic(a, dt) {
    const P = ctx.P; a.speedNow = 0;
    const d = Math.hypot(P.x - a.x, P.z - a.z);
    if (d < 6 && Math.abs(P.y - a.y) < 2) lookAt(a, P.x, P.z, dt, 3);
    a.lineT -= dt;
    if (a.lineT <= 0) { a.lineT = 14 + Math.random() * 10; if (d < 7 && Math.abs(P.y - a.y) < 2 && a.def.lines && a.def.lines.idle) ctx.say(a, rnd(a.def.lines.idle)); }
  }

  function updateStudent(a, dt) {
    if (a.wait > 0) { a.wait -= dt; a.speedNow = 0; return; }
    if (!a.path || a.needRepath) {
      a.needRepath = false;
      const r = MAP.roomByName(rnd(['Korytarz główny', 'Hol główny', 'Korytarz pracowni', 'Przedsionek warsztatów', 'Korytarz piętra', 'Hol piętra']), a.L === 1 ? 1 : 0) || MAP.roomByName('Korytarz główny', 0);
      const p = MAP.randomPointInRoom(r, 0.6); if (!p || !goTo(a, p.L, p.x, p.z)) { a.wait = 1; return; }
    }
    if (follow(a, dt, 1.5 + (a.pace || 0))) { a.wait = 1 + Math.random() * 3; a.path = null; }
  }
  function update(dt) {
    for (const a of actors) {
      if (!a.active && a.def.kind !== 'situational') continue;
      a.needRepath = a.needRepath || false;
      switch (a.def.kind) {
        case 'hunter': updateHunter(a, dt); break;
        case 'scout': updateScout(a, dt); break;
        case 'quiz': updateQuiz(a, dt); break;
        case 'situational': updateSituational(a, dt); break;
        case 'ally': updateAlly(a, dt); break;
        case 'student': updateStudent(a, dt); break;
        default: updateStatic(a, dt);
      }
      if (a.def.kind === 'situational' && !a.active) continue;
      groundSync(a);
      // animacja
      const m = a.mesh;
      if (m.mixer) { if (a.stun > 0) a.speedNow = 0; animGLB(m, a, dt); } else {
      a.anim += a.speedNow * dt * 2.6;
      const sw = Math.min(1, a.speedNow / 2) * 0.7;
      m.legL.rotation.x = Math.sin(a.anim) * sw; m.legR.rotation.x = -Math.sin(a.anim) * sw;
      m.armL.rotation.x = -Math.sin(a.anim) * sw * 0.8; m.armR.rotation.x = Math.sin(a.anim) * sw * 0.8;
      if (a.state === 'chase') { m.armL.rotation.x = -1.3; m.armR.rotation.x = -1.3; }
      }
      if (a.stun > 0) { m.body.rotation.z = Math.sin(performance.now() / 120) * 0.15; } else m.body.rotation.z = 0;
      m.g.position.set(a.x, a.y, a.z); m.g.rotation.y = a.yaw;
      const dP = Math.hypot(ctx.P.x - a.x, ctx.P.z - a.z) + Math.abs(ctx.P.y - a.y) * 3;
      m.label.visible = dP < 24 && a.def.kind !== 'student' && (a.def.kind !== 'situational' || a.active);
      m.g.visible = (a.def.kind !== 'situational' || a.active) && Math.abs(ctx.P.y - a.y) < 8;
    }
  }
  function stunArea(L, x, z, r, secs) {
    for (const a of actors) { if (!a.def.hostile) continue; if (Math.abs(a.y - L * MAP.H) > 5) continue; if (Math.hypot(a.x - x, a.z - z) < r) { a.stun = Math.max(a.stun, secs); a.path = null; } }
  }
  function nearestHostileDist(P) {
    let best = 1e9;
    for (const a of actors) { if (!a.def.hostile || !a.active || a.id === 'pawlyszcze' && false) continue; if (a.def.kind === 'situational' && !a.active) continue; const d = Math.hypot(P.x - a.x, P.z - a.z) + Math.abs(P.y - a.y) * 3; if (a.def.boss || a.id === 'topinek') best = Math.min(best, d); }
    return best;
  }
  function init(c) { ctx = c; }
  function clear() { for (const a of actors.slice()) remove(a); }

  return { loadModels, MODELS, DEFS, actors, init, create, remove, get, update, hearNoise, stunArea, nearestHostileDist, goTo, clear, pickQuiz, canSee };
})();
