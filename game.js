// =====================================================================
//  game.js — silnik gry: gracz, kampania (4 akty), gwiazdki, HUD, minigry
// =====================================================================
'use strict';

const $ = (id) => document.getElementById(id);
const rnd = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

// ------------------------------------------------------------------ postacie
const CHARS = [
  { id: 'arek', name: 'Arek Ławik', nick: '„Arek łowca szparek”', icon: '🕵️', bg: '#6a4a1a', quote: 'Znowu ten jebany Code::Blocks, nah',
    desc: 'PASYW: Pawłyszcze nabija Ci gwiazdki 2× wolniej i ignoruje Cię na 0★. Zadania przy PC 2× szybsze.', skill: null, stats: [3, 3, 5, 5], secret: null },
  { id: 'wiktor', name: 'Wiktor Błaut', nick: 'Motocyklista', icon: '🏍️', bg: '#1a4a6a', quote: 'Co jest tej / Idiotko / Bez szans',
    desc: 'PASYW: +25% prędkość sprintu, +35% staminy. SEKRET: zakończenie S1000RR albo helikopterem.', skill: null, stats: [5, 5, 2, 2], secret: 'S1000RR / Helikopter', lines: ['Co jest tej', 'Idiotko', 'Bez szans'] },
  { id: 'lipiarz', name: 'Mateusz Lipiarz', nick: 'Pirate token', icon: '🪑', bg: '#4a1a6a', quote: 'Pirate token',
    desc: 'SKILL [Q]: stawia przed sobą barykadę z ławki blokującą pościg (cooldown 20 s).', skill: 'barykada', stats: [3, 3, 3, 3], secret: null },
  { id: 'filip', name: 'Filip Skomielski', nick: 'Sieciowiec', icon: '🖧', bg: '#1a6a4a', quote: 'Cipsko Packet Tracer',
    desc: 'PASYW: błyskawiczna minigra sieciowa u Florczykiewicza — 2 s zamiast 15 s.', skill: null, stats: [3, 3, 3, 5], secret: null },
  { id: 'szymon', name: 'Szymon Jastrzębski', nick: '„Szixi / Loniak”', icon: '🏁', bg: '#6a1a2a', quote: 'Stage 1 wchodzi, panowie!',
    desc: 'SKILL [Q] „Stage 1”: zryw prędkości na 4 s, ale ogromny hałas wabi Topinka. SEKRET: Keeway / BMW Stage 1.', skill: 'stage1', stats: [4, 3, 1, 2], secret: 'Keeway / BMW Stage 1' },
];
const ITEMS = {
  epet: { name: 'E-pet Dream 45k', icon: '💨', usable: true, desc: 'chmura dymu (ogłusza 6 s)' },
  polLitra: { name: 'Pół litra', icon: '🍾', usable: true, desc: '10 s nieskończonej staminy… i bujanie' },
  ventoy: { name: 'Pendrive z Ventoyem', icon: '💾' }, key: { name: 'Klucz do kłódki', icon: '🔑' },
  page: { name: 'Kartka z szyfrem', icon: '📄' }, fajka: { name: 'Fajka na trytytce', icon: '🚬' },
  epetD: { name: 'E-pet Duszkiewicza', icon: '🔋' }, cash: { name: '100 zł', icon: '💵' },
  zakup: { name: 'Zakupy z Lewiatana', icon: '🛍️' },
};
const RIDDLES = [['Prezydent musi mieć…', 5], ['Liczba kątów w trójkącie', 3], ['Kółka w motocyklu', 2], ['Dni nauki w tygodniu', 5],
  ['Sylab w „Szlu-gen Ma-chen”', 4], ['Gwiazdek w pełnym alarmie', 3], ['Pół litra to tyle setek ml', 5], ['Motocykli Wiktora (S1000RR)', 1], ['Liczba gwiazdek w GTA (max)', 5], ['Piętra szkoły (z przyziemiem)', 3]];
const FAVORS = {
  grymek: { q: 'Zenon Grymek: „Panie kolego, ile to 7 × 8? Rozliczam kartkówki.”', opts: ['56', '54', '49'], ok: 0, perk: 'Odciągnął Topinka na 40 s.' },
  jelonek: { q: 'Beata Jelonek: „Który z tych NIE jest owocem?”', opts: ['mandarynka', 'jabłko', 'ławka'], ok: 2, perk: 'Dostajesz +50% staminy.' },
  porada: { q: 'Paulina Porada: „Jaki kolor zapala się na lampce Lockdownu, gdy wyjście się otworzy?”', opts: ['zielony', 'czerwony', 'fioletowy'], ok: 0, perk: 'Zbiła Ci 1★.' },
  kaczmarczyk: { q: 'Agnieszka Kaczmarczyk: „Ile to 2 do potęgi 5?”', opts: ['32', '25', '16'], ok: 0, perk: 'Twoje kroki są o połowę cichsze.' },
  rajca: { q: 'Anna Rajca: „Ile bitów ma bajt?”', opts: ['8', '4', '16'], ok: 0, perk: 'Biegasz szybciej (+12%).' },
};

// ------------------------------------------------------------------ stan
const G = { state: 'boot', mode: 'limit', char: CHARS[0], t: 0, phase: 'lesson', phaseT: 150, stars: 0, graceT: 0, noSight: false, started: false, outside: false,
  smokeT: 0, smokePos: { x: 0, z: 0 }, polT: 0, inv: {}, obj: [], favors: {}, safeguards: { elektro: false, klodka: false, trytytka: false }, pages: [], code: [], shots: 0,
  splits: [], demkow: null, introDone: false, ended: false, lockStars: false, bought: false, met: false, sel: null, unseenT: 0, modalOpen: false, modalPause: false, busy: false,
  skillCd: 0, stage1T: 0, blackoutT: 0, freezeT: 0, speedMul: 1, noiseMul: 1, staminaMax: 100, chaseI: 0, lastBell: 0, studentT: 0, shake: 0, caughtBy: '', secretEnding: null, sms: null };
const P = { L: -1, x: 0, z: 0, y: 0, yaw: 0, pitch: 0, speed: 0, crouch: false, hidden: null, sprint: false, stamina: 100, exhausted: false, bob: 0, stepD: 0, eye: 1.65, regenT: 0, flash: true };
const K = {};
const settings = { sens: 1.0 };
let renderer, scene, camera, flashlight, lightPool = [], clock, pickups = [], students = [], smokePuffs = [], barricades = [], exitLamp, exitLampLight;
const mouse = { dx: 0, dy: 0, down: false };

// ------------------------------------------------------------------ rekordy
const REC_KEY = 'tk25_records_v2';
function loadRec() { try { return JSON.parse(localStorage.getItem(REC_KEY)) || {}; } catch (e) { return {}; } }
function saveRec(r) { try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) {} }
function rankOf(sec) { return sec <= 900 ? 'S' : sec <= 1500 ? 'A' : sec <= 2100 ? 'B' : 'C'; }

// ------------------------------------------------------------------ MENU
let menuSel = 0;
function buildMenu() {
  const rec = loadRec(), grid = $('charGrid'); grid.innerHTML = '';
  CHARS.forEach((c, i) => {
    const r = rec[c.id] || {}, stat = (v) => `<i><b style="width:${v * 20}%"></b></i>`;
    const d = document.createElement('div'); d.className = 'card' + (i === menuSel ? ' sel' : '');
    const best = (m) => r[m] ? `${fmt(r[m].best)} <span class="rank ${r[m].rank}">${r[m].rank}</span>` : '—';
    d.innerHTML = `<div class="portrait" style="background:${c.bg}">${c.icon}</div><h3 class="gta">${c.name}</h3><div class="nick">${c.nick}</div>
      <div class="quote">„${c.quote}”</div><div class="desc">${c.desc}</div>
      <div class="stat"><span>Prędkość</span>${stat(c.stats[0])}</div><div class="stat"><span>Kondycja</span>${stat(c.stats[1])}</div>
      <div class="stat"><span>Skradanie</span>${stat(c.stats[2])}</div><div class="stat"><span>Hakowanie</span>${stat(c.stats[3])}</div>
      <div class="rec">⏱ Limit: ${best('limit')}<br>⚡ Speedrun: ${best('speed')}<br>Ukończeń: ${r.wins || 0} • Złapany: ${r.fails || 0}
      ${c.secret ? `<br><span class="secret ${r.secrets && r.secrets.length ? '' : 'locked'}">🔒 Sekret: ${r.secrets && r.secrets.length ? r.secrets.join(', ') : c.secret + ' (nieodkryty)'}</span>` : ''}</div>`;
    d.onclick = () => { menuSel = i; buildMenu(); };
    grid.appendChild(d);
  });
}
$('modeLimit').onclick = () => { G.mode = 'limit'; $('modeLimit').classList.add('on'); $('modeSpeed').classList.remove('on'); };
$('modeSpeed').onclick = () => { G.mode = 'speed'; $('modeSpeed').classList.add('on'); $('modeLimit').classList.remove('on'); };
$('btnStart').onclick = () => { GAudio.init(); startRun(CHARS[menuSel]); };

// ------------------------------------------------------------------ inicjalizacja 3D
// ------------------------------------------------------------------ jakość grafiki i post-processing
const QUAL_KEY = 'tk25_quality_v1';
const Q = { level: 2, lowFpsT: 0, frames: 0, acc: 0, checked: 0 };
try { const q = localStorage.getItem(QUAL_KEY); if (q !== null && q !== 'auto') Q.level = +q; Q.auto = q === null || q === 'auto'; } catch (e) { Q.auto = true; }
const POST = {};
function makeRT(w, h, ms) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, samples: ms || 0 });
  return rt;
}
const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function initPost() {
  const w = renderer.domElement.width, h = renderer.domElement.height;
  POST.scene = makeRT(w, h, 4);
  POST.a = makeRT(w >> 1, h >> 1); POST.b = makeRT(w >> 1, h >> 1); POST.c = makeRT(w >> 2, h >> 2); POST.d = makeRT(w >> 2, h >> 2);
  POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); POST.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); POST.sc = new THREE.Scene(); POST.sc.add(POST.quad);
  POST.bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, th: { value: 0.95 } }, vertexShader: FS_VERT, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(th, th + 0.8, l); gl_FragColor = vec4(c * k, 1.0); }' });
  POST.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2(1, 0) } }, vertexShader: FS_VERT, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227027; c += texture2D(t, vUv + dir * 1.3846).rgb * 0.3162162; c += texture2D(t, vUv - dir * 1.3846).rgb * 0.3162162; c += texture2D(t, vUv + dir * 3.2308).rgb * 0.0702702; c += texture2D(t, vUv - dir * 3.2308).rgb * 0.0702702; gl_FragColor = vec4(c, 1.0); }' });
  POST.final = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, bloom: { value: null }, bloom2: { value: null }, time: { value: 0 }, chase: { value: 0 }, bs: { value: 0.55 }, res: { value: new THREE.Vector2(w, h) } }, vertexShader: FS_VERT, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D t, bloom, bloom2; uniform float time, chase, bs; uniform vec2 res; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        float ca = 0.0016 + chase * 0.004; vec2 off = d * ca * (1.0 + r2 * 6.0);
        vec3 c = vec3(texture2D(t, vUv + off).r, texture2D(t, vUv).g, texture2D(t, vUv - off).b);
        c += (texture2D(bloom, vUv).rgb * 0.7 + texture2D(bloom2, vUv).rgb * 0.9) * bs;
        c *= 1.0 + chase * 0.15;
        c = aces(c * 0.9);
        c = mix(c, c * vec3(0.92, 1.0, 1.08), 0.5);                       // chłodne cienie
        float g = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(g), c, 1.06 - chase * 0.25); // lekkie odbarwienie w pościgu
        c = pow(c, vec3(1.0 / 2.2));
        c *= 1.0 - smoothstep(0.25, 0.95, r2 * 2.6) * 0.62;               // winieta
        c += (hash(vUv * res) - 0.5) * 0.035;                              // ziarno
        gl_FragColor = vec4(c, 1.0);
      }` });
}
function resizePost() {
  if (!POST.scene) return; const w = renderer.domElement.width, h = renderer.domElement.height;
  POST.scene.setSize(w, h); POST.a.setSize(w >> 1, h >> 1); POST.b.setSize(w >> 1, h >> 1); POST.c.setSize(w >> 2, h >> 2); POST.d.setSize(w >> 2, h >> 2); POST.final.uniforms.res.value.set(w, h);
}
function pass(mat, target) { POST.quad.material = mat; renderer.setRenderTarget(target); renderer.render(POST.sc, POST.cam); }
function render() {
  if (Q.level >= 1 && POST.scene) {
    renderer.setRenderTarget(POST.scene); renderer.render(scene, camera);
    POST.bright.uniforms.t.value = POST.scene.texture; pass(POST.bright, POST.a);
    POST.blur.uniforms.dir.value.set(1 / POST.a.width, 0); POST.blur.uniforms.t.value = POST.a.texture; pass(POST.blur, POST.b);
    POST.blur.uniforms.dir.value.set(0, 1 / POST.b.height); POST.blur.uniforms.t.value = POST.b.texture; pass(POST.blur, POST.a);
    POST.blur.uniforms.dir.value.set(1 / POST.c.width, 0); POST.bright.uniforms.th.value = 0.0; POST.bright.uniforms.t.value = POST.a.texture; pass(POST.bright, POST.c); POST.bright.uniforms.th.value = 0.95;
    POST.blur.uniforms.t.value = POST.c.texture; pass(POST.blur, POST.d);
    POST.blur.uniforms.dir.value.set(0, 1 / POST.d.height); POST.blur.uniforms.t.value = POST.d.texture; pass(POST.blur, POST.c);
    const u = POST.final.uniforms; u.t.value = POST.scene.texture; u.bloom.value = POST.a.texture; u.bloom2.value = POST.c.texture; u.time.value = (performance.now() / 1000) % 100; u.chase.value = G.chaseI || 0;
    pass(POST.final, null);
  } else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
}
function applyQuality() {
  const L = Q.level;
  renderer.shadowMap.enabled = L >= 2; flashlight.castShadow = L >= 2;
  renderer.toneMapping = L >= 1 ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.setPixelRatio(L >= 1 ? Math.min(devicePixelRatio, 1.5) : 1); renderer.setSize(innerWidth, innerHeight); resizePost();
  scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } });
  lightPool.forEach((l, i) => { l.userData.off = i >= (L >= 1 ? 7 : 4); });
  try { const sel = $('quality'); if (sel) sel.value = Q.auto ? 'auto' : String(Q.level); } catch (e) {}
}
function setQuality(v) {
  if (v === 'auto') { Q.auto = true; Q.level = Q.level; try { localStorage.setItem(QUAL_KEY, 'auto'); } catch (e) {} } else { Q.auto = false; Q.level = +v; try { localStorage.setItem(QUAL_KEY, String(v)); } catch (e) {} }
  applyQuality();
}
function makeEnv() {
  const es = new THREE.Scene(); es.background = new THREE.Color(0x1a2029);
  es.add(new THREE.Mesh(new THREE.BoxGeometry(24, 7, 24), new THREE.MeshBasicMaterial({ color: 0x2a3340, side: THREE.BackSide })));
  const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(7) });
  for (let x = -8; x <= 8; x += 8) for (let z = -8; z <= 8; z += 8) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.5), pm); p.position.set(x, 3.4, z); es.add(p); }
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.7, 1.0).multiplyScalar(2.5) });
  for (let z = -8; z <= 8; z += 5) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 2.2), win); w.position.set(11.9, 0.4, z); es.add(w); }
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.7, 0.4).multiplyScalar(3) });
  for (let x = -8; x <= 8; x += 8) { const w = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 0.1), warm); w.position.set(x, 0.3, -11.9); es.add(w); }
  const pg = new THREE.PMREMGenerator(renderer); const rt = pg.fromScene(es, 0.03); pg.dispose(); return rt.texture;
}
function initGL() {
  renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.FogExp2(0x07080d, 0.035);
  camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 160);
  camera.rotation.order = 'YXZ'; scene.add(camera);
  scene.environment = makeEnv();
  scene.add(new THREE.HemisphereLight(0x8a9ab8, 0x2a2420, 0.38));
  flashlight = new THREE.SpotLight(0xfff0d0, 3.6, 34, 0.5, 0.55, 0.8);
  flashlight.position.set(0.15, -0.12, 0); camera.add(flashlight);
  flashlight.shadow.mapSize.set(1024, 1024); flashlight.shadow.bias = -0.0006; flashlight.shadow.normalBias = 0.02; flashlight.shadow.camera.near = 0.25; flashlight.shadow.camera.far = 32;
  const tgt = new THREE.Object3D(); tgt.position.set(0, 0, -6); camera.add(tgt); flashlight.target = tgt;
  for (let i = 0; i < 7; i++) { const l = new THREE.PointLight(0xdfe8ff, 16, 15, 2); scene.add(l); lightPool.push(l); }
  clock = new THREE.Clock();
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); resizePost(); });
  MAP.build(scene);
  initPost();
  MAP.groups.forEach((g) => g.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) { const t = o.material.transparent; o.castShadow = !t; o.receiveShadow = true; } }));
  // lampka Lockdownu przy wyjściu
  exitLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  exitLamp.position.set(MAP.poi.exit.x, 3.05, MAP.poi.exit.z - 0.55); scene.add(exitLamp);
  exitLampLight = new THREE.PointLight(0xff2020, 14, 12, 2); exitLampLight.position.copy(exitLamp.position); scene.add(exitLampLight);
  AI.init(aiCtx);
  applyQuality();
}

// ------------------------------------------------------------------ kontekst dla AI
const aiCtx = {
  get scene() { return scene; }, G, P,
  say: (a, text) => say(a.def.name.split(' ').pop(), text, a.def.ally ? '#6aff8a' : a.def.neutral ? '#ddd' : '#ff8a7a'),
  onSpotted: (a) => { if (a.def.hostile) { G.unseenT = 0; if ((a.id === 'topinek' || a.def.boss) && G.stars < 1) addStars(1, a); } },
  addStars: (n, a) => addStars(n, a),
  freeze: (s) => { G.freezeT = s; },
  blackout: (s) => { G.blackoutT = s; $('blackout').textContent = '📵 Nauczyciel zabrał Ci telefon…'; },
  caught: (a, hiddenFind) => { if (!G.ended && !G.god) { if (hiddenFind) say('', 'Znaleziono Cię w kryjówce!', '#ff8a7a'); endRun(false, a.def.name); } },
  shareLast: (pos, a) => { const t = AI.get('topinek'); if (t && t !== a && t.state !== 'chase' && t.stun <= 0 && t.mode !== 'desk') { if (AI.goTo(t, pos.L, pos.x, pos.z)) { t.state = 'investigate'; t.target = pos; t.lastSeen = pos; t.reached = false; } } },
  report: (pos, a) => aiCtx.shareLast(pos, a),
  quiz: (a, qs, cb) => openQuiz(a, qs, cb),
};

// ------------------------------------------------------------------ dialogi / napisy
const subs = [];
function say(who, text, color = '#ffe08a') {
  const d = document.createElement('div'); d.innerHTML = `<b style="color:${color}">${who ? who + ':' : ''}</b>${text}`;
  $('subs').appendChild(d); while ($('subs').children.length > 3) $('subs').firstChild.remove();
  setTimeout(() => d.remove(), 4200);
}
function sms(from, text, sound = true) {
  const e = $('sms'); e.querySelector('.from').textContent = '📱 ' + from; e.querySelector('.t').textContent = text; e.classList.add('show');
  if (sound) GAudio.sfx.sms(); clearTimeout(sms.t); sms.t = setTimeout(() => e.classList.remove('show'), 7500);
}
function banner(t, sub = '') { const b = $('banner'); b.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); b.classList.add('show'); clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('show'), 3200); }
function split(name) { if (G.splits.some(s => s.n === name)) return; G.splits.push({ n: name, t: G.t }); renderSplits(); }
function renderSplits() {
  $('splits').innerHTML = G.splits.slice(-7).map(s => `<div>${s.n}<b>${fmt(s.t)}</b></div>`).join('') || '<div style="color:#789">Splity: —</div>';
}

// ------------------------------------------------------------------ modale
function openModal(html, { pause = true, onClose } = {}) {
  G.modalOpen = true; G.modalPause = pause; G.busy = true; G.modalClose = onClose;
  $('modalBody').innerHTML = html; $('modal').classList.remove('hidden');
  if (document.pointerLockElement) { G.lockIgnore = performance.now() + 600; document.exitPointerLock(); }
}
function closeModal() {
  $('modal').classList.add('hidden'); G.modalOpen = false; G.modalPause = false; G.busy = false;
  const f = G.modalClose; G.modalClose = null; if (f) f();
  if (G.state === 'playing') lockPointer();
}
function lockPointer() { try { const p = $('view').requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }

function openQuiz(a, qs, cb) {
  if (G.modalOpen) return;
  let i = 0, wrong = 0;
  const title = a.def.quiz === 'pl' ? 'KARTKÓWKA Z POLSKIEGO' : 'MATEMATYKA — SZYBKIE PYTANIE';
  const show = () => {
    const q = qs[i];
    openModal(`<h2 class="gta">${title}</h2><p><b>${a.def.name}:</b> „${rnd(a.def.lines.chase)}”</p><p>Pytanie ${i + 1}/${qs.length}: <b>${q.q}</b></p>
      <div class="opts">${q.opts.map((o, k) => `<button class="btn" data-k="${k}">${'ABC'[k]}) ${o}</button>`).join('')}</div>`, { pause: true });
    $('modalBody').querySelectorAll('.btn').forEach(b => b.onclick = () => {
      const k = +b.dataset.k, ok = k === q.correct; b.classList.add(ok ? 'good' : 'bad');
      if (!ok) { wrong++; GAudio.sfx.error(); addStars(1, a); GAudio.sfx.alarm(); } else GAudio.sfx.success();
      $('modalBody').querySelectorAll('.btn').forEach(x => x.onclick = null);
      setTimeout(() => { i++; if (i < qs.length) { G.modalOpen = false; show(); } else { closeModal(); cb && cb(wrong === 0); say(a.def.name.split(' ').pop(), wrong === 0 ? 'Cała klasa jedynki!' : 'Albo wiecie, albo jeden!'); } }, 650);
    });
  };
  G.modalOpen = false; show();
}

function openDialogFavor(npcId) {
  const f = FAVORS[npcId], def = AI.DEFS[npcId];
  if (G.favors[npcId]) { say(def.name.split(' ').pop(), 'Dzięki jeszcze raz!', '#ddd'); return; }
  openModal(`<h2 class="gta">PRZYSŁUGA — ${def.name}</h2><p>${f.q}</p><div class="opts">${f.opts.map((o, k) => `<button class="btn" data-k="${k}">${o}</button>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="mClose">Zamknij</button></div>`, { pause: true });
  $('mClose').onclick = closeModal;
  $('modalBody').querySelectorAll('.opts .btn').forEach(b => b.onclick = () => {
    const ok = +b.dataset.k === f.ok;
    if (!ok) { b.classList.add('bad'); GAudio.sfx.error(); return; }
    b.classList.add('good'); GAudio.sfx.success();
    G.favors[npcId] = true; applyFavor(npcId); closeModal();
    banner('PRZYSŁUGA ZROBIONA', `${f.perk}  (−45 s do rangi)`); split('Przysługa: ' + def.name.split(' ').pop());
    updateObjectives();
  });
}
function applyFavor(id) {
  switch (id) {
    case 'grymek': { const t = AI.get('topinek'); if (t) { const r = MAP.roomByName('Sala 13', 0), p = MAP.randomPointInRoom(r, 1); t.lured = 40; t.lureTarget = p || { L: 0, x: 20, z: 20 }; t.state = 'patrol'; t.path = null; t.needRepath = true; } break; }
    case 'jelonek': G.staminaMax = G.staminaMax * 1.5 / 1; P.stamina = G.staminaMax; break;
    case 'porada': G.stars = Math.max(0, G.stars - 1); GAudio.sfx.starDown(); break;
    case 'kaczmarczyk': G.noiseMul *= 0.5; break;
    case 'rajca': G.speedMul *= 1.12; break;
  }
}

// --- Packet Tracer
function openPacketTracer() {
  if (!G.inv.ventoy) { say('Florczykiewicz', 'Bez Ventoya nic nie zrobimy, panie kolego. Pendrive jest w W-02!'); return; }
  if (G.safeguards.elektro) { say('Florczykiewicz', 'Elektrozamek już zdjęty. Prezydent musi mieć 5!'); return; }
  const ping = G.char.id === 'filip' ? 2 : G.char.id === 'arek' ? 7.5 : 15;
  const sel = (id, opts) => `<select id="${id}">${opts.map((o, k) => `<option value="${k}">${o}</option>`).join('')}</select>`;
  const cables = ['— wybierz kabel —', 'Prosty (straight-through)', 'Krosowany (crossover)', 'Konsolowy (rollover)'];
  openModal(`<h2 class="gta">PACKET TRACER — ELEKTROZAMEK</h2>
    <p><b>Florczykiewicz:</b> „Odpalamy cipsko Packet Tracer! Poprawnie połącz sieć, ustaw IP i puść ping do kontrolera drzwi.”</p>
    <div class="pt"><span class="dev">💻 PC</span> ⟷ <span class="dev">🔀 Switch</span> ⟷ <span class="dev">📡 Router</span> ⟷ <span class="dev">🖥 Kontroler zamka</span>
      <div class="link">PC → Switch: ${sel('c1', cables)}</div>
      <div class="link">Switch → Router: ${sel('c2', cables)}</div>
      <div class="link">Router → Kontroler (urządzenie końcowe): ${sel('c3', cables)}</div>
      <div class="link">IP komputera (brama 192.168.1.1/24): ${sel('ip', ['— wybierz —', '192.168.1.10 /24', '192.168.2.10 /24', '10.0.0.5 /8', '192.168.1.1 /24 (konflikt z bramą)'])}</div></div>
    <div class="prog"><div id="pbar"></div></div><div class="term" id="term">C:\\> czekam na konfigurację…</div>
    <div class="row"><button class="btn" id="ptGo">▶ ping 192.168.1.50 (czas: ${ping} s)</button><button class="btn" id="ptX">Wyjdź</button></div>
    <div style="font-size:11px;color:#789">Uwaga: świat nie jest zatrzymany — nauczyciele Cię szukają!</div>`, { pause: false });
  let running = false, tmr = null;
  $('ptX').onclick = () => { clearInterval(tmr); closeModal(); };
  $('ptGo').onclick = () => {
    if (running) return;
    const c1 = +$('c1').value, c2 = +$('c2').value, c3 = +$('c3').value, ip = +$('ip').value, T = $('term');
    const errs = [];
    if (c1 !== 1) errs.push('PC–Switch: różne urządzenia → kabel prosty'); if (c2 !== 1) errs.push('Switch–Router: różne warstwy → kabel prosty');
    if (c3 !== 2) errs.push('Router–urządzenie końcowe: te same typy portów → krosowany');
    if (ip !== 1) errs.push('IP musi być z podsieci 192.168.1.0/24 i inne niż brama');
    if (errs.length) { GAudio.sfx.error(); T.textContent = 'C:\\> ping 192.168.1.50\nRequest timed out.\nRequest timed out.\n! ' + errs[0]; return; }
    running = true; const t0 = performance.now(); T.textContent = 'C:\\> ping 192.168.1.50\nPinging 192.168.1.50 with 32 bytes of data:\n';
    tmr = setInterval(() => {
      const f = (performance.now() - t0) / 1000 / ping; $('pbar').style.width = Math.min(100, f * 100) + '%';
      if (Math.random() < 0.2) GAudio.sfx.type();
      if (f >= 1) { clearInterval(tmr); T.textContent += 'Reply from 192.168.1.50: bytes=32 time<1ms TTL=64\n>>> ELEKTROZAMEK ODBLOKOWANY <<<'; G.safeguards.elektro = true; GAudio.sfx.unlock(); closeModal(); onSafeguard('Elektrozamek zdjęty!'); split('Elektrozamek'); }
    }, 80);
  };
}
// --- keypad szafki
function openKeypad() {
  if (G.inv.fajka) { say('', 'Szafka jest już pusta.'); return; }
  const have = G.pages.length;
  openModal(`<h2 class="gta">SZAFKA ZIĘBIŃSKIEGO</h2><p>Zamek szyfrowy na 3 cyfry. Masz kartek: <b>${have}/3</b>.</p>
    ${G.pages.map((p, i) => `<p style="color:#ffd980">📄 Kartka ${p.n}: „${p.clue}” = ?</p>`).join('')}
    <div class="keypad"><input type="text" maxlength="1" id="k0"><input type="text" maxlength="1" id="k1"><input type="text" maxlength="1" id="k2"></div>
    <div class="row"><button class="btn" id="kOk">Otwórz</button><button class="btn" id="kX">Wyjdź</button></div><div id="kMsg" style="color:#f88"></div>`, { pause: false });
  $('kX').onclick = closeModal;
  ['k0', 'k1', 'k2'].forEach((id, i, arr) => $(id).oninput = () => { if ($(id).value && i < 2) $(arr[i + 1]).focus(); });
  $('k0').focus();
  $('kOk').onclick = () => {
    const v = [0, 1, 2].map(i => +$('k' + i).value);
    if (v.every((d, i) => d === G.code[i])) {
      G.inv.fajka = 1; G.safeguards.trytytka = false; GAudio.sfx.unlock(); GAudio.sfx.pickup(); closeModal(); refreshInv();
      banner('SZAFKA OTWARTA', 'Fajka na trytytce Ziębińskiego!'); split('Fajka'); updateObjectives();
      say('Ziębiński', 'Szlugen machen! Tą trytytką otworzysz każdą klamkę, panie kolego.', '#6aff8a');
    } else { GAudio.sfx.error(); $('kMsg').textContent = have < 3 ? 'Błędny kod. Zbierz wszystkie 3 kartki.' : 'Błędny kod. Rozwiąż zagadki z kartek.'; }
  };
}

// ------------------------------------------------------------------ przedmioty
function addItem(id, n = 1) { G.inv[id] = (G.inv[id] || 0) + n; refreshInv(); }
function refreshInv() {
  const ids = Object.keys(G.inv).filter(k => G.inv[k] > 0);
  if (!G.sel || !G.inv[G.sel]) G.sel = ids.find(i => ITEMS[i].usable) || ids[0] || null;
  $('inv').innerHTML = ids.map((id, i) => `<div class="slot ${id === G.sel ? 'sel' : ''}" title="${ITEMS[id].name}${ITEMS[id].desc ? ' — ' + ITEMS[id].desc : ''}"><span class="k">${i + 1}</span>${ITEMS[id].icon}${G.inv[id] > 1 || id === 'page' ? `<span class="n">${id === 'page' ? G.pages.length + '/3' : G.inv[id]}</span>` : ''}</div>`).join('');
}
function useItem() {
  if (G.busy || P.hidden) return;
  let id = G.sel && ITEMS[G.sel].usable && G.inv[G.sel] ? G.sel : Object.keys(G.inv).find(k => G.inv[k] > 0 && ITEMS[k].usable);
  if (!id) { say('', 'Nie masz nic do użycia.', '#aaa'); return; }
  G.inv[id]--; if (!G.inv[id]) delete G.inv[id];
  if (id === 'epet') {
    G.smokeT = 6; G.smokePos = { x: P.x, z: P.z }; GAudio.sfx.smoke(); AI.stunArea(P.L, P.x, P.z, 7, 6);
    for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, opacity: 0.55, depthWrite: false, color: 0xcfd6dd }));
      s.position.set(P.x + (Math.random() - 0.5) * 4, P.y + 0.4 + Math.random() * 2, P.z + (Math.random() - 0.5) * 4); s.scale.setScalar(2 + Math.random() * 2); s.userData.life = 6; scene.add(s); smokePuffs.push(s); }
    say('', 'Pyk… *E-pet Dream 45k* — chmura dymu!', '#9cf');
  } else if (id === 'polLitra') { G.polT = 10; GAudio.sfx.gulp(); say('', 'Pół litra… świat zaczyna się bujać 🍾', '#fc6'); banner('PÓŁ LITRA', '10 s nieskończonej staminy'); }
  refreshInv();
}
let _smokeTex; function smokeTex() { if (_smokeTex) return _smokeTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return _smokeTex = new THREE.CanvasTexture(c); }

function pickupMesh(icon) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,230,120,0.35)'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#ffe070'; g.lineWidth = 4; g.stroke();
  g.font = '70px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 64, 70);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: true })); s.scale.set(0.5, 0.5, 1); return s;
}
function spawnPickup(item, pos, label, extra = {}) {
  const m = pickupMesh(ITEMS[item].icon); m.position.set(pos.x, pos.L * MAP.H + (pos.y || 0.9) + 0.15, pos.z); scene.add(m);
  const p = { item, L: pos.L, x: pos.x, z: pos.z, y: pos.L * MAP.H + (pos.y || 0.9), mesh: m, label: label || ITEMS[item].name, ...extra }; pickups.push(p); return p;
}

// ------------------------------------------------------------------ gwiazdki
function addStars(n, by) {
  if (G.ended || G.noSight || !G.started) return;
  const old = G.stars; G.stars = Math.min(3, G.stars + n); G.unseenT = 0;
  if (G.stars > old) {
    GAudio.sfx.star(); $('stars').classList.remove('flash'); void $('stars').offsetWidth; $('stars').classList.add('flash');
    if (G.stars >= 2 && old < 2) GAudio.sfx.alarm();
    if (G.stars >= 3 && !G.demkow) spawnDemkow();
  }
}
function setStars(n) { G.stars = n; }
function spawnDemkow() {
  let at;
  if (G.outside) at = MAP.snap(0, 22.5, 65.5); else { const cand = [['Korytarz administracyjny', 0], ['Hol główny', 0], ['Korytarz pracowni', 0], ['Przedsionek warsztatów', 0]]; let best = null, bd = -1;
    for (const [n, l] of cand) { const r = MAP.roomByName(n, l), p = MAP.randomPointInRoom(r, 1); if (!p) continue; const d = Math.hypot(p.x - P.x, p.z - P.z) + Math.abs(l - P.L) * 20; if (d > bd) { bd = d; best = p; } } at = best || MAP.snap(0, 12, 30); }
  G.demkow = AI.create('demkow', at.L, at.x, at.z, { state: 'investigate', target: { L: P.L, x: P.x, z: P.z } });
  AI.goTo(G.demkow, P.L, P.x, P.z); G.demkow.reached = false;
  banner('3★ — PEŁNY ALARM', 'Wchodzi Mega Boss: Gabriel Demkow'); GAudio.sfx.alarm(); say('Demkow', 'IDĘ PO CIEBIE!', '#ff4a4a');
}

// ------------------------------------------------------------------ cele
function setObj() {
  G.obj = [];
}
function updateObjectives() {
  const a = [];
  const S = G.safeguards, nS = (S.elektro ? 1 : 0) + (S.klodka ? 1 : 0) + (S.trytytka ? 1 : 0);
  const fav = Object.keys(G.favors).length;
  a.push(['AKT 1 — Ucieczka z UTK', G.met, false, false]);
  if (!G.left) a.push(['Wyjdź z W-02 (E na Topinku = 30 s spokoju)', false, true]);
  else if (!G.met) a.push(['Zbiegnij schodami na parter i spotkaj Ziębińskiego pod WC przy W-22 (E)', false, true]);
  else a.push(['Spotkanie z Ziębińskim', true, true]);
  if (G.met) {
    const open = nS >= 3;
    a.push([`AKT 2 — Lockdown: zabezpieczenia ${nS}/3`, open, false]);
    a.push(['Ventoy z W-02 → Packet Tracer w Ślusarni (Elektrozamek)', S.elektro, true]);
    a.push(['Klucz z Pokoju Nauczycielskiego → Główne Wyjście (Kłódka)', S.klodka, true]);
    a.push([`3 kartki z szyfrem (${G.pages.length}/3) → szafka na korytarzu → Fajka`, !!G.inv.fajka || S.trytytka, true]);
    if (G.inv.fajka && !S.trytytka) a.push(['Użyj Fajki na trytytce na Głównym Wyjściu', false, true]);
    a.push([`Przysługa Mariusza: E-pet Duszkiewicza ${G.shots > 0 || G.mariuszDone ? '✔' : ''}`, !!G.mariuszDone, true]);
    a.push([`AKT 3 — Przysługi nauczycieli ${fav}/5 (−45 s każda)`, fav >= 5, false]);
    if (nS >= 3) {
      a.push(['AKT 4 — FINAŁ', G.won, false]);
      a.push(['Wyjdź na dziedziniec — Ziębiński biegnie za Tobą', G.outside, true]);
      a.push(['Zakup w Lewiatanie (potrzebne 100 zł)', G.bought, true]);
      a.push(['Dobiegnij z Ziębińskim na Palarnię za Lewiatanem', G.won, true]);
    }
  }
  $('objectives').innerHTML = '<h5>CELE</h5>' + a.map(([t, d, sub]) => `<div class="o ${d ? 'done' : ''} ${sub ? 'sub' : ''}">${sub ? '▸ ' : ''}${t}</div>`).join('');
}
function onSafeguard(msg) {
  const S = G.safeguards, n = (S.elektro ? 1 : 0) + (S.klodka ? 1 : 0) + (S.trytytka ? 1 : 0);
  banner(msg, `Zabezpieczenia: ${n}/3`); updateObjectives();
  if (n >= 3) openExit();
}
function openExit() {
  const e = MAP.poi.exit; MAP.setBlock(0, 11.5, 43.5, 15, 44.5, 0);
  exitLamp.material.color.set(0x20ff40); exitLampLight.color.set(0x20ff40);
  GAudio.sfx.success(); G.exitOpen = true; split('Wyjście otwarte');
  banner('LOCKDOWN ZDJĘTY', 'Główne Wyjście otwarte — biegnij na dziedziniec!');
  sms('Ziębiński', 'Panie kolego, drzwi stoją otworem! Biegnę za Tobą. Szlugen machen!');
  const z = AI.get('ziebinski'); if (z) { z.mode = 'follow'; z.path = null; }
  updateObjectives();
}

// ------------------------------------------------------------------ interakcje
function nearbyTargets() {
  const out = [];
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  const add = (o) => { const dx = o.x - P.x, dz = o.z - P.z, d = Math.hypot(dx, dz); if (d > (o.r || 2.1) || Math.abs((o.L * MAP.H + (o.yy || 0)) - P.y + (o.L === undefined ? 0 : 0)) > 2.6) return; const dot = (dx * fx + dz * fz) / (d || 1); if (dot < (o.cone === undefined ? 0.45 : o.cone) && d > 0.9) return; o.d = d - dot; out.push(o); };
  if (P.hidden) { out.push({ type: 'unhide', text: 'wyjdź z kryjówki', d: 0 }); return out; }
  for (const p of pickups) add({ type: 'pickup', p, x: p.x, z: p.z, L: Math.round(p.y / MAP.H), text: 'podnieś: ' + p.label, r: 2.2, cone: 0.3 });
  for (const a of AI.actors) {
    if (!a.active && a.def.kind === 'situational') continue;
    const id = a.id;
    if (id === 'topinek' && a.mode === 'desk' && G.graceT <= 0 && !G.left) add({ type: 'topinek', a, x: a.x, z: a.z, L: a.L, text: 'poproś Topinka o wyjście (30 s spokoju)', r: 2.6 });
    else if (id === 'ziebinski') add({ type: 'ziebinski', a, x: a.x, z: a.z, L: a.L, text: 'porozmawiaj z Ziębińskim', r: 2.6 });
    else if (id === 'mariusz') add({ type: 'mariusz', a, x: a.x, z: a.z, L: a.L, text: G.mariuszDone ? 'Mariusz Duszkiewicz' : G.inv.epetD ? 'oddaj E-peta Mariuszowi' : 'porozmawiaj z Mariuszem Duszkiewiczem', r: 2.6 });
    else if (id === 'florczykiewicz') add({ type: 'flor', a, x: a.x, z: a.z, L: a.L, text: 'porozmawiaj z Florczykiewiczem', r: 2.6 });
    else if (FAVORS[id]) add({ type: 'favor', a, id, x: a.x, z: a.z, L: a.L, text: G.favors[id] ? a.def.name + ' ✔' : 'przysługa: ' + a.def.name, r: 2.6 });
  }
  const rk = MAP.poi.rack; add({ type: 'rack', x: rk.x, z: rk.z, L: rk.L, text: G.safeguards.elektro ? 'szafa rackowa (zhakowana)' : 'zhakuj szafę rackową 19" (Packet Tracer)', r: 2.2, cone: 0.2 });
  const cl = MAP.poi.cipherLocker; if (cl) add({ type: 'locker', x: cl.x, z: cl.z, L: cl.L, text: 'zamknięta szafka (szyfr)', r: 2.2, cone: 0.3 });
  const ex = MAP.poi.exit; add({ type: 'exit', x: ex.inside.x, z: ex.inside.z, L: 0, text: 'Główne Wyjście — zabezpieczenia', r: 3.0, cone: 0.2 });
  if (MAP.poi.counter) add({ type: 'shop', x: MAP.poi.counter.x, z: MAP.poi.counter.z, L: 0, text: 'kup coś w Lewiatanie', r: 2.6, cone: 0.2 });
  if (G.exitOpen) for (const v of MAP.poi.vehicles) if (v.who === G.char.id) add({ type: 'vehicle', v, x: v.x, z: v.z, L: 0, text: 'odpal: ' + v.name, r: 3.5, cone: 0.1 });
  for (const h of MAP.hideSpots) add({ type: 'hide', h, x: h.x, z: h.z, L: h.L, text: h.kind === 'kabina' ? 'schowaj się w kabinie WC' : 'schowaj się w szafce', r: 1.7, cone: 0.35 });
  out.sort((a, b) => a.d - b.d);
  return out;
}
function doInteract() {
  if (G.busy || G.state !== 'playing') return;
  const t = nearbyTargets()[0]; if (!t) return;
  switch (t.type) {
    case 'unhide': unhide(); break;
    case 'hide': hide(t.h); break;
    case 'pickup': pickUp(t.p); break;
    case 'topinek': startGrace(); break;
    case 'ziebinski': talkZiebinski(); break;
    case 'mariusz': talkMariusz(); break;
    case 'flor': say('Florczykiewicz', rnd(['Odpalamy cipsko Packet Tracer!', 'Prezydent musi mieć 5!']) + (G.safeguards.elektro ? '' : ' Szafa rack czeka — przynieś Ventoya z W-02.'), '#6aff8a'); break;
    case 'favor': openDialogFavor(t.id); break;
    case 'rack': openPacketTracer(); break;
    case 'locker': openKeypad(); break;
    case 'exit': useExit(); break;
    case 'shop': useShop(); break;
    case 'vehicle': secretEnding(t.v); break;
  }
}
function pickUp(p) {
  GAudio.sfx.pickup(); scene.remove(p.mesh); pickups.splice(pickups.indexOf(p), 1);
  if (p.item === 'page') { G.pages.push(p.page); G.pages.sort((a, b) => a.n - b.n); G.inv.page = G.pages.length; say('', `Kartka ${p.page.n}: „${p.page.clue}” = ?  (cyfra zagadki to część kodu)`, '#ffd980'); if (G.pages.length === 3) { banner('3 KARTKI', 'Teraz szafka „NIE RUSZAĆ — ZIĘBIŃSKI” na korytarzu głównym'); split('Kartki'); } }
  else addItem(p.item);
  if (p.item === 'ventoy') { say('', 'Mam Ventoya! Teraz do Ślusarni, do Siwego.', '#9cf'); split('Ventoy'); }
  if (p.item === 'key') { say('', 'Klucz do kłódki! Teraz pod Główne Wyjście.', '#9cf'); split('Klucz'); }
  if (p.item === 'cash') say('', '100 zł — wystarczy na zakup w Lewiatanie.', '#9f9');
  if (p.item === 'epetD') say('', 'E-pet Duszkiewicza… Mariusz będzie wniebowzięty.', '#9cf');
  if (p.item === 'epet') say('', 'E-pet Dream 45k — [G] użyj, by ogłuszyć wrogów dymem.', '#9cf');
  if (p.item === 'polLitra') say('', 'Pół litra — [G] użyj na nieskończoną staminę.', '#9cf');
  refreshInv(); updateObjectives();
}
function startGrace() {
  G.graceT = 30; G.noSight = true; G.permission = true; GAudio.sfx.click();
  say('Topinek', 'Idź pan do toalety… ale na 30 sekund! Redo samo się nie naprawi.', '#ff8a7a'); say('', G.char.quote, '#ffe08a');
  banner('30 s BEZ PRZYPAŁU', 'Uciekaj schodami na parter!');
  sms('Ziębiński', 'Panie kolego, spotykamy się pod kiblem i spierdalamy na palarnię za Lewiatanem', false);
}
function talkZiebinski() {
  const z = AI.get('ziebinski');
  if (!G.met) {
    G.met = true; z.mode = 'wait'; split('Ziębiński');
    openModal(`<h2 class="gta">ZIĘBIŃSKI</h2><p><b>Ziębiński:</b> „Kurwa panowie… Panie kolego, jest źle. Szkoła jest w <b>Lockdownie</b>. Główne Wyjście ma <b>3 zabezpieczenia</b>:”</p>
      <p>🔒 <b>Elektrozamek</b> — Ventoy z W-02 + hakowanie szafy u Siwego w Ślusarni<br>🔐 <b>Kłódka</b> — klucz leży w Pokoju Nauczycielskim (strefa Pawłyszcze, Orłowskiej i I. Duszkiewicz)<br>
      🚬 <b>Trytytka</b> — moja fajka jest w szafce na korytarzu, szyfr rozsypany na 3 kartkach po szkole</p>
      <p>„Jak mnie Topin dopadnie… Zbieraj też bonusy: Mariusz Duszkiewicz da Ci <i>Strzał ojcowski</i>, a pięciu nauczycieli odpisze Ci czas za przysługi. Lewiatan wymaga <b>100 zł</b>!”</p>
      <div class="row"><button class="btn" id="mOk">Jasne, szlugen machen!</button></div>`, { pause: true });
    $('mOk').onclick = closeModal; sms('SYSTEM', 'AKT 2: zdejmij 3 zabezpieczenia Głównego Wyjścia. Cele w kolejności dowolnej.', false);
    banner('AKT 2 — LOCKDOWN', 'Zdejmij 3 zabezpieczenia'); spawnWorldItems(); updateObjectives();
  } else if (G.exitOpen) say('Ziębiński', 'Biegnij, panie kolego, biegnę za Tobą!', '#6aff8a');
  else say('Ziębiński', rnd(['Która tam na ośce?', 'Jak mnie Topin dopadnie…', 'Szlugen machen! …ale najpierw 3 zabezpieczenia.']), '#6aff8a');
}
function talkMariusz() {
  if (G.mariuszDone) { say('Mariusz', 'Strzał ojcowski masz. Używaj z głową (R).', '#6aff8a'); return; }
  if (!G.inv.epetD) { say('Mariusz', 'Młody, zgubiłem swojego e-peta Duszkiewicza. Znajdź go po szkole — odwdzięczę się Strzałem ojcowskim!', '#6aff8a'); return; }
  G.inv.epetD = 0; delete G.inv.epetD; G.shots = 1; G.mariuszDone = true; GAudio.sfx.success(); refreshInv();
  say('Mariusz', 'Mój e-pet! Dostajesz Strzał ojcowski! [R] zbija 1★ i ogłusza Topinka na 20 s.', '#6aff8a'); banner('STRZAŁ OJCOWSKI', '[R] — zbija 1★ i ogłusza Topinka na 20 s'); split('Mariusz'); updateObjectives();
}
function fatherShot() {
  if (G.busy || G.shots <= 0) { if (G.shots <= 0) say('', 'Brak Strzału ojcowskiego — pomóż Mariuszowi Duszkiewiczowi.', '#aaa'); return; }
  G.shots--; GAudio.sfx.shot(); const t = AI.get('topinek'); if (t) { t.stun = 20; t.path = null; t.state = 'stunned'; }
  G.stars = Math.max(0, G.stars - 1); GAudio.sfx.starDown(); say('Mariusz', 'STRZAŁ OJCOWSKI!', '#ff9a3a'); banner('STRZAŁ OJCOWSKI!', 'Topinek ogłuszony na 20 s, −1★');
}
function useExit() {
  if (G.exitOpen) { say('', 'Wyjście jest otwarte — biegnij!', '#9f9'); return; }
  let did = false;
  if (G.inv.key && !G.safeguards.klodka) { G.safeguards.klodka = true; delete G.inv.key; did = true; GAudio.sfx.unlock(); onSafeguard('Kłódka zdjęta!'); split('Kłódka'); }
  if (G.inv.fajka && !G.safeguards.trytytka) { G.safeguards.trytytka = true; delete G.inv.fajka; did = true; GAudio.sfx.unlock(); onSafeguard('Trytytka przecięta!'); split('Trytytka'); }
  refreshInv();
  if (!did) { const S = G.safeguards; say('', `Zabezpieczenia: Elektrozamek ${S.elektro ? '✔' : '✖'} • Kłódka ${S.klodka ? '✔' : '✖'} • Trytytka ${S.trytytka ? '✔' : '✖'}`, '#ffd980'); GAudio.sfx.error(); }
}
function useShop() {
  if (G.bought) { say('Kasjer', 'Dziękujemy, zapraszamy ponownie.', '#ddd'); return; }
  if (!G.inv.cash) { say('Kasjer', 'Brakuje 100 zł! Wróć do szkoły i poszukaj banknotu.', '#ff9'); GAudio.sfx.error(); return; }
  delete G.inv.cash; G.inv.zakup = 1; G.bought = true; refreshInv(); GAudio.sfx.pickup(); split('Zakup Lewiatan');
  say('Kasjer', 'Razem 100 zł. Paragon? …Dobra, alarm w szkole, szybko!', '#ddd');
  G.lockStars = true; G.stars = 3; GAudio.sfx.star(); if (!G.demkow) spawnDemkow(); G.noSight = false;
  banner('3★ — ZAKUP ZROBIONY', 'Demkow wchodzi! Dobiegnij z Ziębińskim na Palarnię'); updateObjectives();
}
function secretEnding(v) {
  endRun(true, null, v);
}

// ------------------------------------------------------------------ kryjówki
function hide(h) {
  P.hidden = h; P.x = h.x; P.z = h.z; P.L = h.L; P.y = h.L * MAP.H; P.sprint = false;
  for (const a of AI.actors) if (a.def.hostile && (a.state === 'chase' || a.sees) && Math.hypot(a.x - P.x, a.z - P.z) < 15) a.sawHide = { L: h.L, x: h.x, z: h.z };
  GAudio.sfx.locker(); $('hideOverlay').classList.add('on'); say('', h.kind === 'kabina' ? 'Cicho… siedzisz w kabinie.' : 'Cicho… siedzisz w szafce.', '#aaa');
}
function unhide() {
  const h = P.hidden; if (!h) return; P.hidden = null; P.x = h.ex; P.z = h.ez; GAudio.sfx.locker(); $('hideOverlay').classList.remove('on');
  for (const a of AI.actors) a.sawHide = null;
  MAP.collide(P.L, P, 0.3);
}

// ------------------------------------------------------------------ itemy w świecie
function spawnWorldItems() {
  if (G.itemsSpawned) return; G.itemsSpawned = true;
  const sp = MAP.spawnable, names = Object.keys(sp).filter(n => !/Lewiatan|W-02$|Pokój Nauczycielski|Odcięty/.test(n) && sp[n].length);
  const used = new Set(), pick = (floors) => {
    for (let k = 0; k < 60; k++) { const n = rnd(names); if (used.has(n)) continue; const pts = sp[n].filter(p => MAP.walkable(p.L, p.x, p.z) || true); const p = rnd(pts);
      if (floors && !floors.includes(p.L)) continue; used.add(n); return { ...p, y: p.y }; } return null;
  };
  // 3 kartki — różne piętra
  const order = RIDDLES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  G.code = order.map(r => r[1]);
  [[-1, 0], [0], [0, 1]].forEach((fl, i) => { const p = pick(fl) || pick(); const pg = { n: i + 1, clue: order[i][0], digit: order[i][1] }; spawnPickup('page', p, `Kartka z szyfrem (${i + 1}/3)`, { page: pg }); });
  const pe = pick(), cash = pick([0, 1, -1]);
  spawnPickup('epetD', pe, 'E-pet Duszkiewicza'); spawnPickup('cash', cash, '100 zł');
  for (let i = 0; i < 2; i++) spawnPickup('epet', pick(), 'E-pet Dream 45k');
  for (let i = 0; i < 2; i++) spawnPickup('polLitra', pick(), 'Pół litra');
}

// ------------------------------------------------------------------ start / reset
function startRun(ch) {
  G.char = ch; $('menu').classList.add('hidden'); $('endScreen').classList.add('hidden'); $('hud').classList.remove('hidden'); $('pause').classList.add('hidden');
  AI.clear(); for (const p of pickups) scene.remove(p.mesh); pickups = []; for (const s of smokePuffs) scene.remove(s); smokePuffs = [];
  for (const b of barricades) { scene.remove(b.mesh); MAP.blockCells(b.L, b.cells, 0); } barricades = [];
  MAP.setBlock(0, 11.5, 43.5, 15, 44.5, 2); exitLamp.material.color.set(0xff2020); exitLampLight.color.set(0xff2020);
  Object.assign(G, { state: 'playing', t: 0, phase: 'lesson', phaseT: 150, stars: 0, graceT: 0, noSight: false, started: true, outside: false, smokeT: 0, polT: 0, inv: {}, favors: {},
    safeguards: { elektro: false, klodka: false, trytytka: false }, pages: [], code: [], shots: 0, splits: [], demkow: null, ended: false, lockStars: false, bought: false, met: false, left: false,
    permission: false, sel: null, unseenT: 0, modalOpen: false, busy: false, skillCd: 0, stage1T: 0, blackoutT: 0, freezeT: 0, speedMul: 1, noiseMul: 1, staminaMax: 100, chaseI: 0,
    studentT: 0, itemsSpawned: false, exitOpen: false, mariuszDone: false, won: false, smsSent: false, secretEnding: null });
  if (ch.id === 'wiktor') G.staminaMax = 135;
  P.stamina = G.staminaMax; P.hidden = null; P.exhausted = false; P.crouch = false; $('hideOverlay').classList.remove('on'); $('blackout').classList.remove('on');
  const s = MAP.poi.playerStart; const sp = MAP.snap(s.L, s.x, s.z); P.L = sp.L; P.x = sp.x; P.z = sp.z; P.y = P.L * MAP.H; P.yaw = Math.PI * 0.5; P.pitch = 0;
  // NPC
  const td = MAP.snap(-1, MAP.poi.topinekDesk.x, MAP.poi.topinekDesk.z);
  AI.create('topinek', -1, td.x, td.z, { mode: 'desk', yaw: Math.PI / 2 });
  const spawnAt = (id, room, L, o = {}) => { const r = MAP.roomByName(room, L); const p = o.pt || MAP.randomPointInRoom(r, 1.0) || MAP.snap(L, (r.ix0 + r.ix1) / 2, (r.iz0 + r.iz1) / 2); return AI.create(id, L, p.x, p.z, o.opts || {}); };
  const wc = MAP.poi.meetWC; const zp = MAP.snap(0, 62.8, 20.6);
  AI.create('ziebinski', 0, zp.x, zp.z, { mode: 'idle', yaw: Math.PI });
  const fp = MAP.snap(0, 46.2, 7); AI.create('florczykiewicz', 0, fp.x, fp.z, {});
  const mp = MAP.snap(0, 38.2, 33); AI.create('mariusz', 0, mp.x, mp.z, {});
  spawnAt('pawlyszcze', 'Pokój Nauczycielski', 0); spawnAt('orlowska', 'Hol główny', 0); spawnAt('iduszkiewicz', 'Korytarz administracyjny', 0);
  const kw = spawnAt('kowalczyk', 'Korytarz piętra', 1); kw.active = false; kw.mesh.g.visible = false;
  spawnAt('grymek', 'Sala 13', 0); spawnAt('jelonek', 'Sala 14', 0); spawnAt('porada', 'W-29', 0); spawnAt('kaczmarczyk', 'Pracownia Logistyki', 0); spawnAt('rajca', 'W-26', 0);
  // przedmioty stałe
  const pd = MAP.poi.pendrive; spawnPickup('ventoy', { L: -1, x: pd.x, y: pd.y, z: pd.z }, 'Pendrive z Ventoyem');
  const kk = MAP.poi.keySpot; spawnPickup('key', { L: kk.L, x: kk.x, y: kk.y, z: kk.z }, 'Klucz do kłódki');
  spawnWorldItems();
  updateObjectives(); renderSplits(); refreshInv(); buildSkillBox();
  $('modeLbl').textContent = G.mode === 'limit' ? 'LIMIT 45:00' : 'SPEEDRUN'; GAudio.startAmbient(); GAudio.setAmbientOutdoor(false);
  G.introT = 0; G.smsT = 2; lockPointer();
  banner('AKT 1 — UCIECZKA Z UTK', 'Lekcja w W-02. Odczekaj na SMS i poproś Topinka o wyjście [E]');
}
function buildSkillBox() {
  const b = $('skillBox'); const id = G.char.skill;
  b.className = id ? '' : 'none'; $('fatherBox').classList.add('hidden');
}
function useSkill() {
  if (G.busy || P.hidden || !G.char.skill || G.skillCd > 0) return;
  if (G.char.skill === 'barykada') placeBarricade();
  else if (G.char.skill === 'stage1') { G.stage1T = 4; G.skillCd = 30; GAudio.sfx.stage1(); say('Szymon', 'Stage 1 wchodzi, panowie!', '#ffe08a'); banner('STAGE 1', 'Ogromny hałas — Topinek Cię słyszy!'); G.stageNoiseT = 0; }
}
function placeBarricade() {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), horiz = Math.abs(fx) > Math.abs(fz);
  const cx = P.x + fx * 1.5, cz = P.z + fz * 1.5;
  if (!MAP.walkable(P.L, cx, cz)) { say('', 'Za mało miejsca na barykadę.', '#aaa'); return; }
  // linia prostopadła do kierunku patrzenia, aż do ścian
  const cells = [], pts = [];
  const step = 0.5;
  for (const sgn of [1, -1]) for (let k = (sgn === 1 ? 0 : 1); k < 12; k++) {
    const x = cx + (horiz ? 0 : sgn * k * step), z = cz + (horiz ? sgn * k * step : 0);
    if (!MAP.walkable(P.L, x, z)) break; pts.push({ x, z });
  }
  if (pts.length > 11) { say('', 'Za szeroko — ławka nie zamknie przejścia.', '#aaa'); }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const ch = MAP.setBlock(P.L, x0 - 0.25, z0 - 0.25, x1 + 0.25, z1 + 0.25, 4, true);
  const w = x1 - x0 + 0.5, d = z1 - z0 + 0.5;
  const m = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), MAP.M.wood); top.position.y = 0.85; m.add(top);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.8, d * 0.5), MAP.M.darkMetal); legs.position.y = 0.4; m.add(legs);
  m.position.set((x0 + x1) / 2, P.L * MAP.H, (z0 + z1) / 2); scene.add(m);
  barricades.push({ mesh: m, cells: ch, L: P.L, t: 14 }); G.skillCd = 20; GAudio.sfx.barricade(); say('Lipiarz', 'Pirate token! Ławka na drodze!', '#ffe08a');
  for (const a of AI.actors) a.needRepath = true;
}

// ------------------------------------------------------------------ koniec gry
function endRun(win, by, vehicle) {
  if (G.ended) return; G.ended = true; G.state = 'ended'; $('hud').classList.add('hidden'); if (document.pointerLockElement) document.exitPointerLock();
  GAudio.stopAll(); win ? GAudio.sfx.win() : GAudio.sfx.caught();
  const favN = Object.keys(G.favors).length, adj = Math.max(0, G.t - favN * 45), rank = win ? rankOf(adj) : '—';
  const rec = loadRec(); const c = G.char; const r = rec[c.id] = rec[c.id] || { wins: 0, fails: 0, secrets: [] };
  let extra = '';
  if (win) {
    r.wins++; const m = G.mode; if (!r[m] || adj < r[m].best) { r[m] = { best: Math.round(adj), rank }; extra = '<div style="color:#ffd980">🏆 NOWY REKORD!</div>'; }
    if (vehicle) { r.secrets = r.secrets || []; if (!r.secrets.includes(vehicle.name)) r.secrets.push(vehicle.name); extra += `<div class="secret">🔓 SEKRETNE ZAKOŃCZENIE: ${vehicle.name}</div>`; }
  } else r.fails++;
  saveRec(rec);
  const e = $('endScreen'); e.className = 'overlay ' + (win ? 'win' : 'lose');
  const storyWin = vehicle ? (vehicle.id === 'HELI' ? 'Wiktor ładuje się do helikoptera, Ziębiński wiszący na płozach krzyczy „Szlugen machen!”. Topinek zostaje na dziedzińcu z listą nieobecności.' :
    vehicle.id === 'S1000RR' ? 'Wiktor odpala S1000RR. „Co jest tej… Bez szans!” — Demkow zostaje w obłoku spalin.' : vehicle.id === 'KEEWAY' ? 'Szymon odpala Keewaya na Stage 1. Wydech strzela, Demkow zostaje w tyle.' : 'BMW Stage 1 wyje na ulicy Ułanów. Szymon wciska gaz i znika za rogiem.') :
    'Dobiegacie na Palarnię za Lewiatanem. Ziębiński odpala fajkę: „Szlugen machen, panie kolego!”. Topinek został w szkole z zepsutym Redo.';
  e.innerHTML = `<h1 class="gta">${win ? 'MISJA UKOŃCZONA' : 'ZŁAPANY'}</h1><h2 class="gta" style="color:${win ? '#fff' : '#ff6b6b'};margin:6px 0">${win ? '+RESPECT' : 'CZARNA LISTA'}</h2>
    <div class="stats">${win ? `<p style="max-width:640px;margin:0 auto;color:#ccd">${storyWin}</p>` : `<p>${by ? `Złapał Cię: <b>${by}</b>.` : 'Czas minął — Topinek wpisał Cię na czarną listę.'} Jedna próba na run.</p>`}
      Postać: <b>${c.name}</b> • Tryb: <b>${G.mode === 'limit' ? 'Limit 45 min' : 'Speedrun'}</b><br>Czas: <b>${fmt(G.t)}</b> ${favN ? `− ${favN}×45 s przysług = <b>${fmt(adj)}</b>` : ''}<br>
      ${win ? `Ranga: <span class="rank ${rank}" style="font-size:30px;padding:2px 14px">${rank}</span>` : ''}<br>Zabezpieczenia: ${(G.safeguards.elektro ? 1 : 0) + (G.safeguards.klodka ? 1 : 0) + (G.safeguards.trytytka ? 1 : 0)}/3 • Przysługi: ${favN}/5 • Gwiazdki: ${G.stars}★</div>${extra}
    <div class="splitsEnd" style="font-size:13px;color:#9ab;max-width:600px;margin:0 auto">${G.splits.map(s => `${s.n}: ${fmt(s.t)}`).join(' • ')}</div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn big" style="width:auto" id="btnAgain">Menu główne</button></div>`;
  $('btnAgain').onclick = toMenu;
}
function toMenu() { $('endScreen').classList.add('hidden'); $('hud').classList.add('hidden'); $('pause').classList.add('hidden'); $('modal').classList.add('hidden'); G.state = 'menu'; G.started = false; GAudio.stopAll(); buildMenu(); $('menu').classList.remove('hidden'); AI.clear(); }

// ------------------------------------------------------------------ wejście
addEventListener('keydown', (e) => {
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.code !== 'Escape') return;
  K[e.code] = true;
  if (e.code === 'Tab') e.preventDefault();
  if (G.state !== 'playing') return;
  if (G.modalOpen) { if (e.code === 'Escape' && !G.modalPause) closeModal(); return; }
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE': doInteract(); break;
    case 'KeyF': P.flash = !P.flash; GAudio.sfx.click(); break;
    case 'KeyQ': useSkill(); break;
    case 'KeyG': useItem(); break;
    case 'KeyR': fatherShot(); break;
    case 'KeyM': case 'Tab': toggleMap(); break;
    case 'KeyC': P.crouch = !P.crouch; break;
    default: if (/^Digit[1-9]$/.test(e.code)) { const ids = Object.keys(G.inv).filter(k => G.inv[k] > 0); const id = ids[+e.code.slice(5) - 1]; if (id) { G.sel = id; refreshInv(); } }
  }
});
addEventListener('keyup', (e) => { K[e.code] = false; });
addEventListener('mousemove', (e) => { if (document.pointerLockElement) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
addEventListener('mousedown', (e) => { if (e.button === 0 && G.state === 'playing' && document.pointerLockElement) useItem(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && G.state === 'playing' && !G.modalOpen && !G.ended && performance.now() > (G.lockIgnore || 0)) openPause();
});
$('view').addEventListener('click', () => { if (G.state === 'playing' && !G.modalOpen && !document.pointerLockElement) lockPointer(); });
function openPause() { if (G.state !== 'playing') return; G.state = 'paused'; $('pause').classList.remove('hidden'); }
function closePause() { $('pause').classList.add('hidden'); G.state = 'playing'; lockPointer(); }
$('btnResume').onclick = closePause;
$('btnQuit').onclick = () => { toMenu(); };
$('sens').oninput = (e) => { settings.sens = +e.target.value; $('sensV').textContent = settings.sens.toFixed(2); };
$('vol').oninput = (e) => { GAudio.setVolume(+e.target.value); $('volV').textContent = (+e.target.value).toFixed(2); };
$('tts').onchange = (e) => GAudio.setTTS(e.target.checked);
$('quality').onchange = (e) => setQuality(e.target.value);
addEventListener('keydown', (e) => { if (e.code === 'Escape' && G.state === 'paused') closePause(); });
let mapOn = false;
function toggleMap() { mapOn = !mapOn; $('minimap').classList.toggle('on', mapOn); if (mapOn) drawMap(); }
function drawMap() {
  const L = MAP.levelOfY(P.y), src = MAP.minimapCanvas(L), s = 2;
  const box = L === 0 ? [-6, -6, 100, 92] : [0, 0, 92, 46];
  const sx = (box[0] - MAP.X0) / MAP.CELL * s, sy = (box[1] - MAP.Z0) / MAP.CELL * s, sw = (box[2] - box[0]) / MAP.CELL * s, sh = (box[3] - box[1]) / MAP.CELL * s;
  const cv = $('mmCanvas'); const Z = 3; cv.width = sw * Z / 2 * 1; cv.height = sh * Z / 2 * 1; const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false; g.drawImage(src, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  const px = (x) => (x - box[0]) / (box[2] - box[0]) * cv.width, pz = (z) => (z - box[1]) / (box[3] - box[1]) * cv.height;
  const dot = (x, z, c, r = 6, t) => { g.fillStyle = c; g.beginPath(); g.arc(px(x), pz(z), r, 0, 7); g.fill(); g.strokeStyle = '#000'; g.stroke(); if (t) { g.fillStyle = '#fff'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText(t, px(x), pz(z) - 10); } };
  const mk = (L2, x, z, t, c = '#ffd23a') => { if (L2 === L) dot(x, z, c, 6, t); };
  for (const s2 of MAP.stairs) { if (s2.lo === L || s2.hi === L) mk(L, (s2.x0 + s2.x1) / 2, (s2.z0 + s2.z1) / 2, s2.id === 0 ? '⇅ schody (przyziemie)' : '⇅ schody (piętro)', '#4f9'); }
  const ex = MAP.poi.exit; mk(0, ex.x, ex.z, G.exitOpen ? '🚪 WYJŚCIE (otwarte)' : '🚪 Główne Wyjście', G.exitOpen ? '#4f4' : '#f44');
  mk(0, MAP.poi.rack.x, MAP.poi.rack.z, '🖧 Rack (Ślusarnia)');
  mk(0, MAP.poi.keySpot.x, MAP.poi.keySpot.z, '🔑 Pok. Naucz.', '#f66');
  if (!G.inv.ventoy && !G.safeguards.elektro) mk(-1, MAP.poi.pendrive.x, MAP.poi.pendrive.z, '💾 W-02');
  if (MAP.poi.cipherLocker) mk(0, MAP.poi.cipherLocker.x, MAP.poi.cipherLocker.z, '🔒 szafka');
  mk(0, 24, 78, '🛒 LEWIATAN', '#3c6'); mk(0, 24, 88, '🚬 PALARNIA', '#e93');
  const z = AI.get('ziebinski'); if (z && G.met) mk(z.L, z.x, z.z, 'Ziębiński', '#6f8');
  const m = AI.get('mariusz'); if (m && G.met) mk(0, m.x, m.z, 'Mariusz', '#6af');
  g.save(); g.translate(px(P.x), pz(P.z)); g.rotate(-P.yaw + Math.PI); g.fillStyle = '#ffd23a'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 8); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
  $('mmTitle').textContent = 'PLAN EWAKUACYJNY — ' + (L === -1 ? 'PRZYZIEMIE' : L === 0 ? 'PARTER + DZIEDZINIEC' : 'PIĘTRO');
}

// ------------------------------------------------------------------ pętla
function updatePlayer(dt) {
  const ch = G.char;
  // obrót
  P.yaw -= mouse.dx * 0.0022 * settings.sens; P.pitch = clamp(P.pitch - mouse.dy * 0.0022 * settings.sens, -1.4, 1.4); mouse.dx = mouse.dy = 0;
  if (P.hidden || G.busy || G.freezeT > 0) { P.speed = 0; if (G.freezeT > 0) G.freezeT -= dt; return; }
  let mx = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0), mz = (K.KeyS ? 1 : 0) - (K.KeyW ? 1 : 0);
  const mag = Math.hypot(mx, mz) || 1; mx /= mag; mz /= mag;
  const moving = mx || mz;
  const wantSprint = K.ShiftLeft || K.ShiftRight, crouchHold = K.ControlLeft || K.ControlRight;
  const crouch = P.crouch || crouchHold; const infStam = G.polT > 0 || G.stage1T > 0;
  P.sprint = !!(wantSprint && moving && !crouch && (infStam || (!P.exhausted && P.stamina > 0)));
  let spd = crouch ? 1.6 : 3.3;
  if (P.sprint) spd = 5.6 * (ch.id === 'wiktor' ? 1.25 : 1);
  spd *= G.speedMul; if (G.stage1T > 0) spd = 5.6 * 1.9 * G.speedMul;
  if (G.polT > 0) spd *= 1.0;
  P.crouchNow = crouch;
  // stamina
  if (P.sprint && !infStam) { P.stamina -= 14 * dt; P.regenT = 1.2; if (P.stamina <= 0) { P.stamina = 0; P.exhausted = true; say('', 'Brak tchu…', '#aaa'); } }
  else { P.regenT -= dt; if (P.regenT <= 0) P.stamina = Math.min(G.staminaMax, P.stamina + 16 * dt); if (P.exhausted && P.stamina > G.staminaMax * 0.25) P.exhausted = false; }
  if (infStam) P.stamina = Math.min(G.staminaMax, P.stamina + 30 * dt);
  // ruch
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const vx = (mx * cy + mz * sy) * spd, vz = (-mx * sy + mz * cy) * spd;
  const p = { x: P.x + vx * dt, z: P.z + vz * dt };
  MAP.collide(P.L, p, 0.27);
  const moved = Math.hypot(p.x - P.x, p.z - P.z); P.x = p.x; P.z = p.z; P.speed = moved / dt;
  const g = MAP.ground(P.L, P.x, P.z); P.y += (g.y - P.y) * Math.min(1, dt * 18); if (Math.abs(g.y - P.y) < 0.02) P.y = g.y; P.L = g.L; P.onStair = !!g.stair;
  // kroki + hałas
  P.stepD += moved;
  const stride = P.sprint || G.stage1T > 0 ? 1.5 : crouch ? 1.0 : 1.15;
  if (P.stepD >= stride && moved > 0.001) {
    P.stepD = 0; const loud = G.stage1T > 0 ? 3 : P.sprint ? 1.2 : crouch ? 0.25 : 0.55;
    GAudio.sfx.step(G.outside ? 'outdoor' : P.onStair ? 'stair' : 'floor', loud * (0.5 + G.noiseMul * 0.5));
    const r = (G.stage1T > 0 ? 38 : P.sprint ? 11 : crouch ? 1.6 : 4.2) * G.noiseMul;
    AI.hearNoise({ L: P.L, x: P.x, y: P.y, z: P.z, r });
  }
  P.bob += moved * (P.sprint ? 2.2 : 2.6);
  if (G.stage1T > 0) { G.stageNoiseT = (G.stageNoiseT || 0) - dt; if (G.stageNoiseT <= 0) { G.stageNoiseT = 0.6; AI.hearNoise({ L: P.L, x: P.x, y: P.y, z: P.z, r: 50 }); } }
}

function updateWorld(dt) {
  const t = G.t;
  // zegar
  G.t += dt;
  if (G.mode === 'limit' && G.t >= 2700) { endRun(false, null); return; }
  // dzwonki
  G.phaseT -= dt;
  if (G.phaseT <= 0) {
    G.phase = G.phase === 'lesson' ? 'break' : 'lesson'; G.phaseT = G.phase === 'lesson' ? 150 : 60; GAudio.sfx.bell();
    banner(G.phase === 'break' ? '🔔 PRZERWA' : '🔔 LEKCJA', G.phase === 'break' ? 'Dyżury na korytarzach — uważaj!' : 'Nauczyciele wracają do klas');
    if (G.phase === 'break') spawnStudents(); else despawnStudents();
  }
  // SMS od Ziębińskiego po 2 s
  if (!G.smsSent) { G.smsT -= dt; if (G.smsT <= 0) { G.smsSent = true; sms('Ziębiński', 'Panie kolego, spotykamy się pod kiblem i spierdalamy na palarnię za Lewiatanem'); say(G.char.name.split(' ')[0], G.char.lines ? rnd(G.char.lines) : G.char.quote, '#ffe08a'); } }
  // grace
  if (G.graceT > 0) {
    G.graceT -= dt;
    if (G.graceT <= 0) { G.noSight = false; const tp = AI.get('topinek'); if (tp) { tp.mode = null; tp.state = 'investigate'; tp.path = null; } addStars(1); G.started = true; banner('1★ — TOPINEK POLUJE', 'Czas bez przypału minął!'); say('Topinek', 'Panie Nawrocki!', '#ff8a7a');
      const tp2 = AI.get('topinek'); if (tp2) { const tt = MAP.snap(P.L, P.x, P.z); AI.goTo(tp2, tt.L, tt.x, tt.z); tp2.target = tt; tp2.reached = false; } }
  }
  // wyjście z W-02 bez zgody
  const room = MAP.roomAt(P.L, P.x, P.z);
  if (!G.left && room && room.name !== 'W-02' && P.L === -1 && room.name !== 'Odcięty korytarz' || (!G.left && P.L >= 0)) {
    if (!G.left) {
      G.left = true; split('Wyjście z W-02');
      if (!G.permission) { G.noSight = false; const tp = AI.get('topinek'); if (tp) { tp.mode = null; } say('Topinek', 'Gdzie pan wychodzi, panie Nawrocki?!', '#ff8a7a'); addStars(1); banner('1★ — WYJŚCIE BEZ ZGODY', 'Topinek Cię zauważył!'); G.started = true; const tp3 = AI.get('topinek'); if (tp3) { tp3.state = 'chase'; tp3.lastSeen = { L: P.L, x: P.x, z: P.z }; tp3.path = null; } }
      updateObjectives();
    }
  }
  G.outside = room ? (room.type === 'outdoor' || room.type === 'shop') && room.name !== 'Hol główny' : false;
  if (room && room.name === 'Dziedziniec' && G.exitOpen && !G.reachedOut) { G.reachedOut = true; split('Dziedziniec'); updateObjectives(); }
  GAudio.setAmbientOutdoor(G.outside);
  scene.fog.density = G.outside ? 0.022 : 0.04;
  // timery efektów
  G.polT = Math.max(0, G.polT - dt); G.stage1T = Math.max(0, G.stage1T - dt); G.skillCd = Math.max(0, G.skillCd - dt); G.smokeT = Math.max(0, G.smokeT - dt);
  if (G.blackoutT > 0) { G.blackoutT -= dt; $('blackout').classList.toggle('on', true); if (G.blackoutT <= 0) $('blackout').classList.remove('on'); }
  // barykady
  for (let i = barricades.length - 1; i >= 0; i--) { const b = barricades[i]; b.t -= dt; if (b.t <= 0) { scene.remove(b.mesh); MAP.blockCells(b.L, b.cells, 0); barricades.splice(i, 1); for (const a of AI.actors) a.needRepath = true; } }
  // dym
  for (let i = smokePuffs.length - 1; i >= 0; i--) { const s = smokePuffs[i]; s.userData.life -= dt; s.material.opacity = Math.max(0, 0.55 * s.userData.life / 6); s.scale.multiplyScalar(1 + dt * 0.1); s.position.y += dt * 0.1; if (s.userData.life <= 0) { scene.remove(s); smokePuffs.splice(i, 1); } }
  // gwiazdki: wygaszanie
  if (G.stars > 0 && !G.lockStars && !G.noSight) {
    const seen = AI.actors.some(a => a.def.hostile && a.active && (a.state === 'chase' || (a.sees && !P.hidden)));
    if (seen) G.unseenT = 0; else { G.unseenT += dt; if (G.unseenT > (G.stars >= 3 ? 55 : 35)) { G.unseenT = 0; G.stars--; GAudio.sfx.starDown(); banner(G.stars ? G.stars + '★' : '0★ — ZGUBIŁEŚ POŚCIG', G.stars ? 'Stracili Cię z oczu' : 'Spokój… na razie'); if (G.stars < 3 && G.demkow) { AI.remove(G.demkow); G.demkow = null; } } }
  }
  // Ziębiński tryb follow w akcie 4 (po otwarciu wyjścia)
  // palarnia / meta
  const pal = MAP.poi.palarnia, zz = AI.get('ziebinski');
  if (G.exitOpen && !G.won && Math.hypot(P.x - pal.x, P.z - pal.z) < pal.r + 3 && P.L === 0) {
    if (!G.bought) { if (!G.palHint || G.t - G.palHint > 8) { G.palHint = G.t; say('Ziębiński', 'Najpierw obowiązkowy zakup w Lewiatanie, panie kolego!', '#6aff8a'); } }
    else if (zz && Math.hypot(zz.x - P.x, zz.z - P.z) < 7) { G.won = true; split('Palarnia'); endRun(true); return; }
    else if (!G.palHint || G.t - G.palHint > 6) { G.palHint = G.t; say('', 'Poczekaj na Ziębińskiego!', '#aaa'); }
  }
  // Kowalczyk i tło
  // zbieranie sytuacji: efekt „chaseI”
  const dist = AI.nearestHostileDist(P);
  const chasing = AI.actors.some(a => a.def.hostile && a.state === 'chase' && a.active);
  G.chaseI = clamp((chasing ? 1 : 0) * clamp(1 - dist / 30, 0.25, 1), 0, 1) * (P.hidden ? 0.4 : 1);
  GAudio.setHeart(dist < 24 && (G.stars > 0 || dist < 12) ? 55 + (24 - dist) * 5 : 0); GAudio.setTension(G.stars / 3);
  GAudio.setSiren(G.stars >= 2);
}
function spawnStudents() {
  despawnStudents();
  for (let i = 0; i < 12; i++) {
    const lv = Math.random() < 0.75 ? 0 : 1; const r = MAP.roomByName(rnd(['Korytarz główny', 'Hol główny', 'Korytarz pracowni', 'Przedsionek warsztatów']), 0); const rr = lv === 1 ? MAP.roomByName('Korytarz piętra', 1) : r;
    const p = MAP.randomPointInRoom(rr, 0.6); if (!p) continue;
    const def = Object.assign({}, AI.DEFS.student, { color: [0x4a6a9a, 0x9a4a4a, 0x4a9a6a, 0x8a8a4a, 0x7a4a9a][i % 5] });
    const a = AI.create('student', p.L, p.x, p.z, { def, pace: Math.random() * 0.8 }); students.push(a);
  }
}
function despawnStudents() { for (const s of students) AI.remove(s); students = []; }

function updateLights(dt) {
  const t = performance.now() / 1000;
  M_flick(t);
  G.lightT = (G.lightT || 0) - dt;
  if (G.lightT <= 0) {
    G.lightT = 0.2; const L = MAP.levelOfY(P.y);
    const c = MAP.lamps.filter(l => (l.L === L || (P.onStair && Math.abs(l.L - L) <= 1)) && Math.abs(l.x - P.x) < 25 && Math.abs(l.z - P.z) < 25 && (G.outside || !l.outdoor || true)).map(l => ({ l, d: (l.x - P.x) ** 2 + (l.z - P.z) ** 2 }));
    c.sort((a, b) => a.d - b.d);
    lightPool.forEach((pl, i) => { const e = pl.userData.off ? null : c[i]; if (e) { pl.userData.lamp = e.l; pl.position.set(e.l.x, e.l.y, e.l.z); pl.color.set(e.l.outdoor ? 0xffd9a0 : 0xe6eeff); pl.visible = true; } else { pl.visible = false; pl.userData.lamp = null; } });
  }
  lightPool.forEach(pl => { const l = pl.userData.lamp; if (!l) return; let k = 1; if (l.flick) k = flickState[l.flick - 1] ? 1 : 0.12; pl.intensity = (l.outdoor ? 30 : 13) * k; });
  for (const l of MAP.groups) { }
  // widoczność pięter
  const L = MAP.levelOfY(P.y);
  MAP.groups.forEach((g, i) => { const lv = i - 1; g.visible = Math.abs(lv - L) <= 1 || G.outside && lv === 0; });
  MAP.groups[1].visible = true;
}
const flickState = [true, true, true];
function M_flick(t) {
  for (let k = 0; k < 3; k++) { const on = Math.sin(t * (11 + k * 5) + k * 2) * Math.sin(t * (3.1 + k)) > -0.25; flickState[k] = on; MAP.M.lampFlick[k].color.set(on ? 0xf4f6ff : 0x3a3c46); if (on) MAP.M.lampFlick[k].color.multiplyScalar(3); }
}

function updateCamera(dt) {
  const t = performance.now() / 1000;
  const target = (P.crouchNow ? 1.0 : 1.65); P.eye += (target - P.eye) * Math.min(1, dt * 10);
  const bob = Math.sin(P.bob) * (P.sprint ? 0.045 : 0.025) * (P.speed > 0.1 ? 1 : 0);
  let shake = G.chaseI * 0.012; if (G.stage1T > 0) shake += 0.02;
  camera.position.set(P.x + (Math.random() - 0.5) * shake, P.y + P.eye + bob + (Math.random() - 0.5) * shake, P.z + (Math.random() - 0.5) * shake);
  let roll = 0, yawW = 0, fov = 72;
  if (G.polT > 0) { roll = Math.sin(t * 1.6) * 0.09; yawW = Math.sin(t * 0.9) * 0.05; fov = 72 + Math.sin(t * 1.3) * 5; }
  if (P.sprint || G.stage1T > 0) fov += G.stage1T > 0 ? 18 : 4;
  if (camera.fov !== fov) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
  camera.rotation.set(P.pitch + (P.hidden ? 0 : 0), P.yaw + yawW, roll);
  flashlight.visible = P.flash; flashlight.intensity = 3.6 + (Math.random() < 0.012 ? -2.2 : 0);
}

function updateHUD(dt) {
  // gwiazdki
  let s = ''; for (let i = 0; i < 3; i++) s += `<span class="s ${i < G.stars ? 'on' : ''}">★</span>`; $('stars').innerHTML = s;
  const ph = $('phase'); ph.className = 'gta ' + G.phase; ph.textContent = (G.phase === 'lesson' ? '🔔 LEKCJA ' : '🏃 PRZERWA / DYŻUR ') + fmt(G.phaseT);
  const tm = $('timer'); if (G.mode === 'limit') { const rem = 2700 - G.t; tm.textContent = fmt(rem); tm.classList.toggle('warn', rem < 300); } else { tm.textContent = fmt(G.t); tm.classList.remove('warn'); }
  if (G.graceT > 0) $('modeLbl').textContent = `SPOKÓJ: ${Math.ceil(G.graceT)} s bez przypału`; else $('modeLbl').textContent = G.mode === 'limit' ? 'LIMIT 45:00 • czas ' + fmt(G.t) : 'SPEEDRUN';
  const sf = $('staminaFill'); sf.style.width = (P.stamina / G.staminaMax * 100) + '%'; sf.className = (G.polT > 0 || G.stage1T > 0) ? 'beer' : (P.exhausted ? 'low' : '');
  const sb = $('skillBox'); if (G.char.skill) { sb.className = G.skillCd > 0 ? '' : 'ready'; sb.textContent = `[Q] ${G.char.skill === 'barykada' ? 'Barykada' : 'Stage 1'} ${G.skillCd > 0 ? '⏳ ' + Math.ceil(G.skillCd) + ' s' : '✔ gotowe'}`; }
  const fb = $('fatherBox'); if (G.shots > 0) { fb.classList.remove('hidden'); fb.className = 'ready'; fb.textContent = '[R] Strzał ojcowski ×' + G.shots; } else if (G.mariuszDone) { fb.classList.remove('hidden'); fb.className = ''; fb.textContent = '[R] Strzał użyty'; } else fb.classList.add('hidden');
  $('vignette').style.opacity = clamp(G.chaseI * 0.95 + (G.stars >= 2 ? 0.1 : 0), 0, 1);
  $('beerFx').style.opacity = G.polT > 0 ? 0.7 : 0;
  // prompt
  const pr = $('prompt');
  if (G.busy || G.state !== 'playing') pr.classList.add('hidden');
  else { const t = nearbyTargets()[0]; if (t) { pr.innerHTML = `<kbd>E</kbd> ${t.text}`; pr.classList.remove('hidden'); } else pr.classList.add('hidden'); }
  if (mapOn) drawMap();
}

function animateWorld(dt) {
  const t = performance.now() / 1000;
  for (const p of pickups) { p.mesh.position.y = p.y + 0.18 + Math.sin(t * 2.5 + p.x) * 0.06; p.mesh.visible = Math.abs(p.y - P.y) < 5; }
  for (const a of MAP.animated) a.update(t, dt);
  for (const v of MAP.poi.vehicles) { }
}

function simStep(dt) {
  const sim = !(G.modalOpen && G.modalPause);
  if (sim) {
    updatePlayer(dt); updateWorld(dt); if (G.state !== 'playing') return false;
    AI.update(dt); GAudio.update(dt);
  } else { mouse.dx = mouse.dy = 0; }
  return true;
}
function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta(), dt = Math.min(0.05, raw);
  if (G.state === 'playing') {
    if (Q.auto && Q.level > 0) { Q.acc += raw; if (++Q.frames >= 100) { const ms = Q.acc / Q.frames * 1000; Q.acc = 0; Q.frames = 0; if (ms > 48 && ++Q.lowFpsT >= 2) { Q.lowFpsT = 0; Q.level--; applyQuality(); banner('GRAFIKA OBNIŻONA', 'Auto-jakość: ' + ['niska', 'średnia'][Q.level] + ' (zmienisz w pauzie)'); } else if (ms <= 48) Q.lowFpsT = 0; } }
    if (!simStep(dt)) { render(); return; }
    updateLights(dt); updateCamera(dt); animateWorld(dt); if (Math.floor(G.t * 10) !== G.lastHud) { G.lastHud = Math.floor(G.t * 10); updateHUD(dt); }
  } else if (G.state === 'menu' || G.state === 'boot') {
    const t = performance.now() / 8000; camera.position.set(40 + Math.cos(t) * 30, 6, 24 + Math.sin(t) * 12); camera.lookAt(45, 1.5, 22); updateLights(dt);
  }
  render();
}

// ------------------------------------------------------------------ start
function boot() {
  try {
    initGL(); buildMenu(); $('loading').classList.add('hidden'); $('menu').classList.remove('hidden'); G.state = 'menu';
    window.__tk = { simStep, updateHUD, K, G, P, MAP, AI, CHARS, startRun, endRun, say, addStars, nearbyTargets, doInteract, hide, unhide, pickups: () => pickups, scene, camera, openExit, openPacketTracer, useExit, useShop, applyFavor, FAVORS, openDialogFavor };
    frame();
  } catch (e) { $('loading').textContent = 'Błąd inicjalizacji: ' + e.message; console.error(e); }
}
boot();
