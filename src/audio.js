/* =============================================================================
 * audio.js — every sound is synthesised at runtime with the Web Audio API.
 * No audio files ship with the game.
 *
 * Includes a small step sequencer that plays a driving metal-ish soundtrack,
 * with a different riff per level.
 * ============================================================================= */
(function (global) {
  'use strict';

  var ctx = null, master = null, sfxBus = null, musicBus = null;
  var noiseBuf = null, distCurve = null;
  var enabled = true, musicOn = true;
  var started = false;

  function makeDistCurve(amount) {
    var n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function init() {
    if (ctx) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { enabled = false; return; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.34; musicBus.connect(master);

    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    distCurve = makeDistCurve(24);
  }

  function now() { return ctx.currentTime; }

  /* Route a node through optional panning into the sfx bus. */
  function out(node, vol, pan) {
    var g = ctx.createGain();
    g.gain.value = vol === undefined ? 1 : vol;
    node.connect(g);
    if (pan !== undefined && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); p.connect(sfxBus);
    } else {
      g.connect(sfxBus);
    }
    return g;
  }

  function noise(t0, dur, f0, f1, vol, pan, type, q) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    var flt = ctx.createBiquadFilter();
    flt.type = type || 'lowpass';
    flt.Q.value = q || 1;
    flt.frequency.setValueAtTime(f0, t0);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(env);
    out(env, 1, pan);
    src.start(t0); src.stop(t0 + dur + 0.02);
    return env;
  }

  function tone(t0, dur, type, f0, f1, vol, pan, dist) {
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var node = osc;
    if (dist) {
      var ws = ctx.createWaveShaper();
      ws.curve = distCurve; ws.oversample = '2x';
      osc.connect(ws); node = ws;
    }
    node.connect(env);
    out(env, 1, pan);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
    return env;
  }

  /* ---- sound effects ------------------------------------------------------ */

  var S = {
    pistol: function (v, p) {
      var t = now();
      noise(t, 0.11, 3200, 260, 0.55 * v, p);
      tone(t, 0.07, 'square', 340, 90, 0.22 * v, p, true);
      noise(t + 0.02, 0.20, 900, 120, 0.14 * v, p);
    },
    shotgun: function (v, p) {
      var t = now();
      noise(t, 0.26, 2600, 110, 0.85 * v, p);
      tone(t, 0.16, 'sawtooth', 180, 45, 0.34 * v, p, true);
      noise(t + 0.03, 0.42, 700, 70, 0.28 * v, p);
    },
    pump: function (v, p) {
      var t = now();
      noise(t, 0.05, 5000, 1800, 0.22 * v, p, 'bandpass', 4);
      noise(t + 0.09, 0.05, 4200, 1400, 0.20 * v, p, 'bandpass', 4);
    },
    chaingun: function (v, p) {
      var t = now();
      noise(t, 0.08, 3600, 320, 0.48 * v, p);
      tone(t, 0.05, 'square', 300, 110, 0.18 * v, p, true);
    },
    plasma: function (v, p) {
      var t = now();
      tone(t, 0.16, 'sawtooth', 1400, 240, 0.30 * v, p, true);
      tone(t, 0.12, 'sine', 2200, 500, 0.18 * v, p);
      noise(t, 0.14, 4000, 900, 0.16 * v, p, 'bandpass', 3);
    },
    rocket: function (v, p) {
      var t = now();
      noise(t, 0.55, 1600, 180, 0.55 * v, p);
      tone(t, 0.45, 'sawtooth', 420, 60, 0.28 * v, p, true);
    },
    explode: function (v, p) {
      var t = now();
      noise(t, 0.85, 1800, 45, 0.95 * v, p);
      tone(t, 0.55, 'sine', 130, 28, 0.60 * v, p);
      tone(t + 0.01, 0.30, 'sawtooth', 240, 40, 0.28 * v, p, true);
      noise(t + 0.12, 0.9, 500, 60, 0.30 * v, p);
    },
    sight: function (v, p, pitch) {
      var t = now(), f = (pitch || 1);
      tone(t, 0.55, 'sawtooth', 150 * f, 90 * f, 0.34 * v, p, true);
      tone(t + 0.03, 0.5, 'square', 74 * f, 58 * f, 0.28 * v, p, true);
      noise(t, 0.5, 1200 * f, 300, 0.20 * v, p, 'bandpass', 1.4);
    },
    pain: function (v, p, pitch) {
      var t = now(), f = (pitch || 1);
      tone(t, 0.22, 'sawtooth', 320 * f, 140 * f, 0.36 * v, p, true);
      noise(t, 0.2, 2000, 400, 0.22 * v, p, 'bandpass', 2);
    },
    death: function (v, p, pitch) {
      var t = now(), f = (pitch || 1);
      tone(t, 0.85, 'sawtooth', 260 * f, 45 * f, 0.44 * v, p, true);
      noise(t, 0.8, 1600, 120, 0.34 * v, p);
      tone(t + 0.2, 0.6, 'square', 120 * f, 32 * f, 0.22 * v, p, true);
    },
    melee: function (v, p) {
      var t = now();
      noise(t, 0.14, 2400, 200, 0.5 * v, p);
      tone(t, 0.1, 'square', 200, 70, 0.3 * v, p, true);
    },
    hurt: function (v, p) {
      var t = now();
      tone(t, 0.3, 'sawtooth', 220, 110, 0.34 * v, p, true);
      noise(t, 0.25, 1400, 260, 0.24 * v, p);
    },
    playerdie: function (v) {
      var t = now();
      tone(t, 1.4, 'sawtooth', 210, 40, 0.5 * v, 0, true);
      noise(t, 1.3, 1200, 70, 0.4 * v, 0);
    },
    pickup: function (v) {
      var t = now();
      tone(t, 0.07, 'square', 660, 660, 0.16 * v, 0);
      tone(t + 0.06, 0.10, 'square', 990, 990, 0.16 * v, 0);
    },
    weapon: function (v) {
      var t = now();
      tone(t, 0.08, 'square', 440, 440, 0.16 * v, 0);
      tone(t + 0.07, 0.08, 'square', 660, 660, 0.16 * v, 0);
      tone(t + 0.14, 0.16, 'square', 880, 880, 0.18 * v, 0);
    },
    key: function (v) {
      var t = now();
      tone(t, 0.09, 'triangle', 880, 880, 0.18 * v, 0);
      tone(t + 0.08, 0.09, 'triangle', 1174, 1174, 0.18 * v, 0);
      tone(t + 0.16, 0.22, 'triangle', 1760, 1760, 0.20 * v, 0);
    },
    door: function (v, p) {
      var t = now();
      noise(t, 0.75, 380, 1500, 0.34 * v, p, 'bandpass', 1.2);
      tone(t, 0.7, 'sawtooth', 55, 90, 0.18 * v, p);
    },
    doorclose: function (v, p) {
      var t = now();
      noise(t, 0.6, 1400, 300, 0.30 * v, p, 'bandpass', 1.2);
      tone(t + 0.55, 0.16, 'sine', 90, 40, 0.32 * v, p);
    },
    switch_: function (v) {
      var t = now();
      noise(t, 0.06, 3000, 900, 0.34 * v, 0, 'bandpass', 5);
      tone(t + 0.05, 0.5, 'sawtooth', 70, 130, 0.24 * v, 0);
    },
    noammo: function (v) {
      var t = now();
      tone(t, 0.05, 'square', 180, 120, 0.16 * v, 0);
    },
    step: function (v) {
      var t = now();
      noise(t, 0.07, 420, 120, 0.10 * v, 0);
    },
    secret: function (v) {
      var t = now();
      var seq = [523, 659, 784, 1047];
      for (var i = 0; i < seq.length; i++) tone(t + i * 0.09, 0.24, 'triangle', seq[i], seq[i], 0.16 * v, 0);
    },
    stagger: function (v, p, pitch) {
      var t = now(), f = pitch || 1;
      tone(t, 0.30, 'sawtooth', 420 * f, 90 * f, 0.30 * v, p, true);
      noise(t, 0.34, 2600, 300, 0.26 * v, p, 'bandpass', 2.2);
      tone(t + 0.05, 0.5, 'sine', 210, 70, 0.16 * v, p);
    },
    execute: function (v, p) {
      var t = now();
      noise(t, 0.20, 5200, 240, 0.72 * v, p);
      tone(t, 0.26, 'square', 140, 42, 0.44 * v, p, true);
      tone(t + 0.03, 0.42, 'sawtooth', 900, 120, 0.26 * v, p, true);
      noise(t + 0.10, 0.5, 1300, 90, 0.30 * v, p);
    },
    dash: function (v) {
      var t = now();
      noise(t, 0.24, 900, 4200, 0.34 * v, 0, 'bandpass', 1.1);
      tone(t, 0.20, 'sine', 220, 640, 0.16 * v, 0);
    },
    chronoIn: function (v) {
      var t = now();
      tone(t, 0.55, 'sine', 900, 150, 0.28 * v, 0);
      tone(t, 0.55, 'triangle', 1350, 220, 0.16 * v, 0);
      noise(t, 0.5, 6000, 400, 0.20 * v, 0, 'bandpass', 0.9);
    },
    chronoOut: function (v) {
      var t = now();
      tone(t, 0.40, 'sine', 180, 1000, 0.24 * v, 0);
      noise(t, 0.36, 500, 6500, 0.18 * v, 0, 'bandpass', 0.9);
    },
    rankup: function (v, p, pitch) {
      var t = now(), f = pitch || 1;
      var seq = [523, 698, 880];
      for (var i = 0; i < seq.length; i++)
        tone(t + i * 0.055, 0.22, 'square', seq[i] * f, seq[i] * f, 0.13 * v, 0);
    },
    orb: function (v) {
      var t = now();
      tone(t, 0.09, 'sine', 780, 1300, 0.14 * v, 0);
      tone(t + 0.03, 0.12, 'triangle', 1560, 1900, 0.09 * v, 0);
    },
    empty: function (v) {
      var t = now();
      noise(t, 0.05, 3200, 1200, 0.18 * v, 0, 'bandpass', 6);
    },
    tick: function (v) {
      var t = now();
      tone(t, 0.05, 'square', 1500, 1500, 0.10 * v, 0);
      noise(t, 0.03, 4000, 2000, 0.07 * v, 0, 'bandpass', 8);
    },
    telefrag: function (v) {
      var t = now();
      noise(t, 0.6, 5000, 200, 0.5 * v, 0, 'bandpass', 2);
      tone(t, 0.5, 'sawtooth', 900, 80, 0.3 * v, 0, true);
    }
  };

  /* ---- music -------------------------------------------------------------- */

  var N = {                                                    // note -> Hz
    E1: 41.20, F1: 43.65, G1: 49.00, A1: 55.00, B1: 61.74, C2: 65.41, D2: 73.42,
    E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.0, Bb2: 116.5, B2: 123.5, C3: 130.8, D3: 146.8,
    E3: 164.8, F3: 174.6, G3: 196.0, A3: 220.0, B3: 246.9, C4: 261.6, D4: 293.7, E4: 329.6, G4: 392.0
  };

  /* Each track is 16 steps. 0 = rest. */
  var SONGS = [
    {                                                          /* level 1 — driving E minor chug */
      bpm: 152,
      bass: ['E1', 'E1', 0, 'E1', 0, 'E1', 'G1', 0, 'E1', 'E1', 0, 'E1', 'D2', 0, 'C2', 0],
      lead: [0, 0, 'E3', 0, 'G3', 0, 0, 'E3', 0, 'B3', 0, 'A3', 0, 'G3', 0, 0],
      kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
    {                                                          /* level 2 — darker, half time feel */
      bpm: 138,
      bass: ['A1', 0, 'A1', 'A1', 0, 'C2', 0, 'A1', 'F1', 0, 'F1', 0, 'G1', 0, 'G1', 'A1'],
      lead: ['A3', 0, 0, 'C4', 0, 'B3', 0, 0, 'A3', 0, 'G3', 0, 'E3', 0, 0, 0],
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1]
    },
    {                                                          /* level 3 — boss, fast and mean */
      bpm: 168,
      bass: ['E1', 'E1', 'E1', 'F1', 'E1', 'E1', 'Bb2', 0, 'E1', 'E1', 'E1', 'F1', 'G1', 'F1', 'E1', 0],
      lead: ['E4', 0, 'D4', 0, 'C4', 0, 'B3', 0, 'C4', 0, 'B3', 'A3', 'G3', 0, 'F3', 0],
      kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    }
  ];

  var song = SONGS[0], step = 0, nextTime = 0, timer = null, tempoScale = 1;

  function mout(node, vol, pan) {
    var g = ctx.createGain(); g.gain.value = vol;
    node.connect(g);
    if (pan !== undefined && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner(); p.pan.value = pan;
      g.connect(p); p.connect(musicBus);
    } else g.connect(musicBus);
  }

  function mKick(t) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); mout(g, 1);
    o.start(t); o.stop(t + 0.18);
  }

  function mSnare(t) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    s.connect(f); f.connect(g); mout(g, 1);
    s.start(t); s.stop(t + 0.17);
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.3, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g2); mout(g2, 1);
    o.start(t); o.stop(t + 0.1);
  }

  function mHat(t) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    s.connect(f); f.connect(g); mout(g, 1);
    s.start(t); s.stop(t + 0.06);
  }

  function mBass(t, note, dur) {
    var f = N[note]; if (!f) return;
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f * 0.5;
    var ws = ctx.createWaveShaper(); ws.curve = distCurve; ws.oversample = '2x';
    var flt = ctx.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(1500, t);
    flt.frequency.exponentialRampToValueAtTime(320, t + dur);
    flt.Q.value = 3;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(ws); o2.connect(ws); ws.connect(flt); flt.connect(g);
    mout(g, 1, -0.15);
    o.start(t); o.stop(t + dur + 0.02);
    o2.start(t); o2.stop(t + dur + 0.02);
  }

  function mLead(t, note, dur) {
    var f = N[note]; if (!f) return;
    for (var v = 0; v < 2; v++) {
      var o = ctx.createOscillator(); o.type = v ? 'square' : 'sawtooth';
      o.frequency.value = f * (v ? 1.005 : 0.997);
      var ws = ctx.createWaveShaper(); ws.curve = distCurve; ws.oversample = '2x';
      var flt = ctx.createBiquadFilter(); flt.type = 'bandpass';
      flt.frequency.value = f * 3.2; flt.Q.value = 1.4;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.13, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(ws); ws.connect(flt); flt.connect(g);
      mout(g, 1, v ? 0.3 : -0.3);
      o.start(t); o.stop(t + dur + 0.02);
    }
  }

  function schedule() {
    if (!ctx || !musicOn) return;
    var spb = 60 / song.bpm / 4 / tempoScale;                  // 16th notes
    while (nextTime < now() + 0.18) {
      var t = Math.max(nextTime, now() + 0.01);
      if (song.kick[step]) mKick(t);
      if (song.snare[step]) mSnare(t);
      if (song.hat[step]) mHat(t);
      if (song.bass[step]) mBass(t, song.bass[step], spb * 1.7);
      if (song.lead[step]) mLead(t, song.lead[step], spb * 2.4);
      nextTime += spb;
      step = (step + 1) % 16;
    }
  }

  var Audio = {
    init: function () {
      init();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      started = true;
    },
    ready: function () { return !!ctx; },
    play: function (name, vol, pan, pitch) {
      if (!enabled || !ctx || !started) return;
      var f = S[name === 'switch' ? 'switch_' : name];
      if (!f) return;
      if (vol === undefined) vol = 1;
      if (vol <= 0.005) return;
      try { f(vol, pan || 0, pitch); } catch (e) { /* audio graph overrun — ignore */ }
    },
    startMusic: function (index) {
      if (!ctx) return;
      song = SONGS[Math.min(index, SONGS.length - 1)];
      step = 0; nextTime = now() + 0.1;
      if (!timer) timer = setInterval(schedule, 30);
    },
    stopMusic: function () {
      if (timer) { clearInterval(timer); timer = null; }
      tempoScale = 1;
    },
    /* Drops the soundtrack into a drag when the chrono gauntlet is running. */
    setTempoScale: function (s) { tempoScale = Math.max(0.35, Math.min(2, s)); },
    toggleMusic: function () {
      musicOn = !musicOn;
      if (musicBus) musicBus.gain.value = musicOn ? 0.34 : 0;
      return musicOn;
    },
    toggleSfx: function () {
      enabled = !enabled;
      return enabled;
    },
    musicEnabled: function () { return musicOn; },
    sfxEnabled: function () { return enabled; },
    setVolume: function (v) { if (master) master.gain.value = v; }
  };

  global.Sound = Audio;
})(window);
