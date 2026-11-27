// =====================================================================
//  audio.js — proceduralny dźwięk (Web Audio API), zero plików audio
// =====================================================================
'use strict';

const GAudio = (() => {
  let ctx = null, master = null, sfxBus = null, ambBus = null;
  let noiseBuf = null;
  let volume = 0.7;
  let sirenNodes = null, humNodes = null, droneNodes = null;
  let heartTimer = 0, heartRate = 0;
  let ttsEnabled = true;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.6; ambBus.connect(master);
    // bufor szumu białego (2 s)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function setVolume(v) { volume = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }
  function now() { return ctx ? ctx.currentTime : 0; }

  function env(g, t, a, peak, dcy, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + dcy);
  }

  function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, bus = sfxBus, slideTo = null) {
    if (!ctx) return;
    const t = now() + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.008, vol, dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol = 0.3, filterType = 'lowpass', freq = 1000, q = 1, when = 0, bus = sfxBus, attack = 0.005) {
    if (!ctx) return;
    const t = now() + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, attack, vol, dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
  }

  // ------------------------------------------------------------ SFX
  const S = {
    step(kind = 'floor', loud = 1) {
      if (!ctx) return;
      const base = kind === 'outdoor' ? 600 : kind === 'stair' ? 1400 : 1100;
      noise(0.07, 0.12 * loud, 'bandpass', base + Math.random() * 300, 1.2);
      tone(90 + Math.random() * 20, 0.06, 'sine', 0.08 * loud);
    },
    pickup() { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.18, i * 0.07)); },
    sms() { tone(1320, 0.09, 'square', 0.12); tone(1760, 0.12, 'square', 0.12, 0.13); tone(1320, 0.09, 'square', 0.1, 0.32); },
    click() { tone(900, 0.03, 'square', 0.08); },
    error() { tone(220, 0.18, 'sawtooth', 0.15); tone(160, 0.25, 'sawtooth', 0.15, 0.12); },
    success() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.17, i * 0.09)); },
    star() { tone(440, 0.15, 'square', 0.18); tone(330, 0.3, 'square', 0.18, 0.15); noise(0.2, 0.1, 'highpass', 3000, 1, 0.05); },
    starDown() { tone(330, 0.12, 'triangle', 0.15); tone(523, 0.25, 'triangle', 0.15, 0.12); },
    bell() {
      // dzwonek elektryczny: prostokąt modulowany 24 Hz
      if (!ctx) return;
      const t = now(), dur = 2.6;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 940;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 1410;
      const am = ctx.createOscillator(); am.frequency.value = 24;
      const amG = ctx.createGain(); amG.gain.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.03);
      g.gain.setValueAtTime(0.09, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
      am.connect(amG); amG.connect(g.gain);
      o.connect(bp); o2.connect(bp); bp.connect(g); g.connect(sfxBus);
      [o, o2, am].forEach(n => { n.start(t); n.stop(t + dur + 0.05); });
    },
    heartbeat(vol = 0.5) { tone(62, 0.12, 'sine', vol); tone(52, 0.14, 'sine', vol * 0.8, 0.16); },
    caught() {
      tone(110, 1.4, 'sawtooth', 0.25, 0, sfxBus, 55); tone(116, 1.4, 'sawtooth', 0.2, 0, sfxBus, 58);
      noise(0.8, 0.25, 'lowpass', 400, 1);
    },
    win() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, i * 0.11)); },
    smoke() { noise(1.2, 0.25, 'bandpass', 700, 0.6, 0, sfxBus, 0.05); },
    gulp() { for (let i = 0; i < 4; i++) tone(180 - i * 15, 0.12, 'sine', 0.2, i * 0.22, sfxBus, 120 - i * 10); },
    shot() { noise(0.5, 0.6, 'lowpass', 2500, 0.5); tone(70, 0.6, 'sine', 0.5, 0, sfxBus, 35); tone(1200, 0.25, 'sawtooth', 0.15, 0.05, sfxBus, 300); },
    stage1() {
      if (!ctx) return;
      const t = now();
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(220, t + 1.2);
      o.frequency.setValueAtTime(140, t + 1.25); o.frequency.exponentialRampToValueAtTime(260, t + 2.6);
      o.frequency.exponentialRampToValueAtTime(70, t + 4);
      const ws = ctx.createWaveShaper(); const c = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 6); } ws.curve = c;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.1);
      g.gain.setValueAtTime(0.25, t + 3.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.1);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      o.connect(ws); ws.connect(lp); lp.connect(g); g.connect(sfxBus);
      o.start(t); o.stop(t + 4.2);
      // strzały z wydechu
      [1.22, 2.65, 3.3].forEach(w => noise(0.08, 0.5, 'lowpass', 1200, 1, w));
    },
    door() { noise(0.25, 0.1, 'lowpass', 500, 1); tone(140, 0.2, 'triangle', 0.06); },
    locker() { noise(0.15, 0.18, 'bandpass', 2200, 2); tone(300, 0.08, 'square', 0.05, 0.05); },
    barricade() { noise(0.3, 0.35, 'lowpass', 300, 1); tone(80, 0.25, 'sine', 0.3); },
    alarm() { for (let i = 0; i < 3; i++) tone(700, 0.35, 'sawtooth', 0.12, i * 0.45, sfxBus, 1300); },
    type() { tone(1800 + Math.random() * 400, 0.02, 'square', 0.04); },
    unlock() { tone(500, 0.06, 'square', 0.1); tone(750, 0.08, 'square', 0.1, 0.08); noise(0.1, 0.1, 'highpass', 2000, 1, 0.1); },
    engine(kind) { // odpalanie pojazdu
      if (!ctx) return;
      const t = now();
      const o = ctx.createOscillator(); o.type = kind === 'heli' ? 'triangle' : 'sawtooth';
      if (kind === 'heli') {
        const lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(3, t); lfo.frequency.linearRampToValueAtTime(18, t + 4);
        const lg = ctx.createGain(); lg.gain.value = 0.2;
        o.frequency.value = 70;
        const g = ctx.createGain(); g.gain.value = 0.2;
        lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(sfxBus);
        o.start(t); o.stop(t + 5); lfo.start(t); lfo.stop(t + 5);
        noise(5, 0.15, 'lowpass', 300, 1, 0, sfxBus, 1);
      } else {
        o.frequency.setValueAtTime(40, t); o.frequency.exponentialRampToValueAtTime(kind === 'car' ? 120 : 260, t + 2.5);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t + 3.5);
        const lp = ctx.createBiquadFilter(); lp.frequency.value = 1400;
        o.connect(lp); lp.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 3.6);
      }
    },
  };

  // ------------------------------------------------------------ pętle
  function setSiren(on) {
    if (!ctx) return;
    if (on && !sirenNodes) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 800;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.45;
      const lg = ctx.createGain(); lg.gain.value = 350;
      lfo.connect(lg); lg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.045, now(), 0.5);
      o.connect(f); f.connect(g); g.connect(ambBus);
      o.start(); lfo.start();
      sirenNodes = { o, lfo, g };
    } else if (!on && sirenNodes) {
      const n = sirenNodes; sirenNodes = null;
      n.g.gain.setTargetAtTime(0, now(), 0.3);
      setTimeout(() => { try { n.o.stop(); n.lfo.stop(); } catch (e) {} }, 1500);
    }
  }

  function startAmbient() {
    if (!ctx || humNodes) return;
    // brzęczenie jarzeniówek 100 Hz
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = ctx.createGain(); g.gain.value = 0.012;
    o.connect(f); f.connect(g); g.connect(ambBus); o.start();
    humNodes = { o, g };
    // niski horrorowy dron
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = 4;
    const dg = ctx.createGain(); dg.gain.value = 0.08;
    const d1 = ctx.createOscillator(); d1.frequency.value = 41; d1.type = 'sine';
    const d1g = ctx.createGain(); d1g.gain.value = 0.03;
    s.connect(lp); lp.connect(dg); dg.connect(ambBus); s.start();
    d1.connect(d1g); d1g.connect(ambBus); d1.start();
    droneNodes = { s, dg, d1, d1g };
  }
  function setAmbientOutdoor(outdoor) {
    if (!humNodes) return;
    humNodes.g.gain.setTargetAtTime(outdoor ? 0 : 0.012, now(), 0.5);
  }
  function setTension(t) { // 0..1
    if (!droneNodes) return;
    droneNodes.dg.gain.setTargetAtTime(0.06 + t * 0.12, now(), 0.4);
    droneNodes.d1g.gain.setTargetAtTime(0.02 + t * 0.06, now(), 0.4);
  }
  function stopAll() {
    setSiren(false);
    if (humNodes) { try { humNodes.o.stop(); } catch (e) {} humNodes = null; }
    if (droneNodes) { try { droneNodes.s.stop(); droneNodes.d1.stop(); } catch (e) {} droneNodes = null; }
    heartRate = 0;
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
  }

  // bicie serca: rate w uderzeniach/min (0 = wył.)
  function setHeart(bpm) { heartRate = bpm; }
  function update(dt) {
    if (!ctx || heartRate <= 0) { heartTimer = 0; return; }
    heartTimer -= dt;
    if (heartTimer <= 0) {
      S.heartbeat(Math.min(0.75, 0.25 + heartRate / 300));
      heartTimer = 60 / heartRate;
    }
  }

  // ------------------------------------------------------------ TTS (opcjonalny głos)
  let plVoice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices();
    plVoice = vs.find(v => /pl/i.test(v.lang)) || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(text, pitch = 1, rate = 1.1) {
    if (!ttsEnabled || !window.speechSynthesis || !plVoice) return;
    try {
      if (speechSynthesis.speaking) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = plVoice; u.lang = plVoice.lang; u.pitch = pitch; u.rate = rate; u.volume = Math.min(1, volume * 1.2);
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function setTTS(on) { ttsEnabled = on; if (!on && window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} }

  return { init, setVolume, sfx: S, setSiren, startAmbient, setAmbientOutdoor, setTension, setHeart, update, stopAll, say, setTTS,
    get volume() { return volume; }, get tts() { return ttsEnabled; } };
})();
