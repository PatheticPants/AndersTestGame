/* =============================================================================
 * textures.js — every wall, floor, ceiling and sky in the game, drawn by code.
 *
 * A texture is { w, h, frames: [Uint8Array], glow: Uint8Array|null, fps }.
 * `glow` marks pixels that ignore distance shading (computer screens, light
 * strips, lava) so dark rooms get real emissive detail.
 * ============================================================================= */
(function (global) {
  'use strict';

  var Pal = global.Pal, P = Pal.P, PixBuf = global.PixBuf, rng = global.rng;
  var TS = 64;
  var sh = Pal.shade;

  /* ---- small helpers ------------------------------------------------------ */

  function bevel(b, x, y, w, h, rs, rn, base, lite, dark) {
    b.rect(x, y, w, h, sh(rs, rn, base));
    for (var i = 0; i < w; i++) { b.px(x + i, y, sh(rs, rn, lite)); b.px(x + i, y + h - 1, sh(rs, rn, dark)); }
    for (var j = 0; j < h; j++) { b.px(x, y + j, sh(rs, rn, lite)); b.px(x + w - 1, y + j, sh(rs, rn, dark)); }
    b.px(x + w - 1, y, sh(rs, rn, base));
    b.px(x, y + h - 1, sh(rs, rn, base));
  }

  function rivet(b, x, y, rs, rn) {
    b.px(x, y, sh(rs, rn, 0.85));
    b.px(x + 1, y, sh(rs, rn, 0.55));
    b.px(x, y + 1, sh(rs, rn, 0.55));
    b.px(x + 1, y + 1, sh(rs, rn, 0.25));
  }

  function markGlow(buf, pred) {
    var m = new Uint8Array(buf.d.length);
    for (var i = 0; i < buf.d.length; i++) if (pred(buf.d[i])) m[i] = 1;
    return m;
  }

  function tex(frames, glow, fps) {
    var f = [];
    for (var i = 0; i < frames.length; i++) f.push(frames[i].d);
    return { w: TS, h: TS, frames: f, glow: glow || null, fps: fps || 0 };
  }

  /* ---- wall textures ------------------------------------------------------ */

  function techWall(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.GRAY, P.GRAY_N, 0.22));
    /* three stacked panels with bevelled edges */
    bevel(b, 2, 2, 60, 26, P.GRAY, P.GRAY_N, 0.34, 0.52, 0.12);
    bevel(b, 2, 30, 60, 14, P.GRAY, P.GRAY_N, 0.28, 0.46, 0.10);
    bevel(b, 2, 46, 60, 16, P.GRAY, P.GRAY_N, 0.34, 0.52, 0.12);
    /* vent slits */
    for (var i = 0; i < 7; i++) {
      b.rect(8 + i * 7, 33, 4, 8, sh(P.GRAY, P.GRAY_N, 0.06));
      b.line(8 + i * 7, 33, 8 + i * 7 + 3, 33, sh(P.GRAY, P.GRAY_N, 0.42));
    }
    for (var k = 0; k < 4; k++) {
      rivet(b, 5 + (k % 2) * 54, 5 + ((k / 2) | 0) * 53, P.GRAY, P.GRAY_N);
    }
    b.rect(2, 50, 60, 3, sh(P.GOLD, P.GOLD_N, 0.55));
    for (var x = 0; x < 60; x++) if (((x + 2) >> 1) % 3 === 0) b.rect(2 + x, 50, 2, 3, sh(P.GRAY, P.GRAY_N, 0.06));
    b.grain(r, 1.2, P.GRAY, P.GRAY_N);
    return b;
  }

  function brickWall(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.BROWN, P.BROWN_N, 0.12));                     // mortar
    var bh = 8;
    for (var row = 0; row < TS / bh; row++) {
      var off = (row % 2) * 8;
      for (var c = -1; c < 5; c++) {
        var bx = c * 16 + off + 1, by = row * bh + 1;
        var t = 0.32 + r() * 0.30;
        for (var j = 0; j < bh - 2; j++)
          for (var i = 0; i < 14; i++) {
            var v = t + (j === 0 ? 0.12 : 0) - (j === bh - 3 ? 0.10 : 0) + (r() - 0.5) * 0.06;
            b.px(bx + i, by + j, sh(P.BROWN, P.BROWN_N, v));
          }
      }
    }
    for (var n = 0; n < 60; n++) b.px((r() * TS) | 0, (r() * TS) | 0, sh(P.BROWN, P.BROWN_N, 0.08));
    return b;
  }

  function stoneWall(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.STONE, P.STONE_N, 0.10));
    var rows = [[0, 22], [22, 20], [42, 22]];
    for (var q = 0; q < rows.length; q++) {
      var y = rows[q][0], h = rows[q][1];
      var xs = q % 2 ? [-6, 26, 52] : [0, 32];
      for (var s = 0; s < xs.length; s++) {
        var w = q % 2 ? 30 : 30;
        bevel(b, xs[s] + 1, y + 1, w, h - 2, P.STONE, P.STONE_N, 0.30 + r() * 0.16, 0.52, 0.12);
      }
    }
    /* cracks */
    for (var cr = 0; cr < 5; cr++) {
      var x = (r() * TS) | 0, yy = (r() * TS) | 0;
      for (var st = 0; st < 12; st++) {
        b.px(x, yy, sh(P.STONE, P.STONE_N, 0.06));
        x += (r() * 3 | 0) - 1; yy += (r() * 2 | 0);
      }
    }
    b.grain(r, 1.4, P.STONE, P.STONE_N);
    return b;
  }

  function metalWall(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    for (var x = 0; x < TS; x++) {
      var t = 0.30 + 0.22 * Math.cos((x / 8) * Math.PI * 2);
      for (var y = 0; y < TS; y++) b.px(x, y, sh(P.GRAY, P.GRAY_N, t));
    }
    b.rect(0, 0, TS, 4, sh(P.GRAY, P.GRAY_N, 0.44));
    b.rect(0, 4, TS, 1, sh(P.GRAY, P.GRAY_N, 0.10));
    b.rect(0, 59, TS, 5, sh(P.GRAY, P.GRAY_N, 0.20));
    b.rect(0, 58, TS, 1, sh(P.GRAY, P.GRAY_N, 0.08));
    for (var i = 0; i < 8; i++) { rivet(b, 3 + i * 8, 1, P.GRAY, P.GRAY_N); rivet(b, 3 + i * 8, 60, P.GRAY, P.GRAY_N); }
    b.grain(r, 1.0, P.GRAY, P.GRAY_N);
    return b;
  }

  function rustWall(seed) {
    var r = rng(seed), b = metalWall(seed);
    for (var n = 0; n < 900; n++) {
      var x = (r() * TS) | 0, y = (r() * TS) | 0, rad = 1 + (r() * 3 | 0);
      b.ellipse(x, y, rad, rad, sh(P.BROWN, P.BROWN_N, 0.18 + r() * 0.35));
    }
    b.grain(r, 1.5, P.BROWN, P.BROWN_N);
    return b;
  }

  function fleshWall(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    for (var y = 0; y < TS; y++)
      for (var x = 0; x < TS; x++) {
        var v = 0.30
          + 0.14 * Math.sin(x * 0.31 + Math.sin(y * 0.17) * 2.0)
          + 0.10 * Math.sin(y * 0.24 + Math.cos(x * 0.11) * 1.6);
        b.px(x, y, sh(P.BLOOD, P.BLOOD_N, v));
      }
    /* veins */
    for (var v2 = 0; v2 < 7; v2++) {
      var px = (r() * TS) | 0, py = (r() * TS) | 0, a = r() * 6.283;
      for (var s = 0; s < 40; s++) {
        b.px(px, py, sh(P.RED, P.RED_N, 0.55));
        b.px(px, py + 1, sh(P.BLOOD, P.BLOOD_N, 0.12));
        a += (r() - 0.5) * 0.7;
        px = (px + Math.cos(a) * 1.6 + TS) % TS; py = (py + Math.sin(a) * 1.6 + TS) % TS;
      }
    }
    /* eye sockets */
    for (var e = 0; e < 3; e++) {
      var ex = 10 + (r() * 44) | 0, ey = 10 + (r() * 44) | 0;
      b.ellipse(ex, ey, 5, 4, sh(P.BLOOD, P.BLOOD_N, 0.04));
      b.ellipse(ex, ey, 3, 2, sh(P.GOLD, P.GOLD_N, 0.85));
      b.ellipse(ex, ey, 1, 1, 248);
    }
    b.grain(r, 1.0, P.BLOOD, P.BLOOD_N);
    return b;
  }

  function computerWall(seed, frame) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.GRAY, P.GRAY_N, 0.16));
    bevel(b, 1, 1, 62, 62, P.GRAY, P.GRAY_N, 0.24, 0.42, 0.08);
    /* CRT screen */
    b.rect(6, 6, 34, 24, sh(P.GRAY, P.GRAY_N, 0.04));
    for (var y = 0; y < 22; y++) {
      var lit = ((y + frame) % 3) !== 0;
      for (var x = 0; x < 32; x++) {
        var w = (Math.sin((x * 0.7 + y * 1.3 + frame * 2.1)) + 1) * 0.5;
        var t = lit ? 0.30 + w * 0.55 : 0.14;
        b.px(7 + x, 7 + y, sh(P.CYAN, P.CYAN_N, t));
      }
    }
    /* readout bars */
    for (var i = 0; i < 6; i++) {
      var len = 3 + ((i * 7 + frame * 3) % 22);
      b.rect(7, 8 + i * 3, len, 2, sh(P.CYAN, P.CYAN_N, 0.85));
    }
    /* indicator column */
    for (var k = 0; k < 8; k++) {
      var on = ((k * 5 + frame * 3) % 7) < 3;
      var rs = k % 2 ? P.GREEN : P.RED, rn = k % 2 ? P.GREEN_N : P.RED_N;
      b.rect(46, 7 + k * 3, 5, 2, sh(rs, rn, on ? 0.95 : 0.14));
    }
    /* lower dials */
    b.rect(5, 34, 54, 26, sh(P.GRAY, P.GRAY_N, 0.20));
    for (var d = 0; d < 5; d++) {
      var cx = 12 + d * 11, cy = 47;
      b.ellipse(cx, cy, 4, 4, sh(P.GRAY, P.GRAY_N, 0.08));
      b.ellipse(cx, cy, 3, 3, sh(P.GRAY, P.GRAY_N, 0.34));
      var a = (d * 1.3 + frame * 0.9);
      b.line(cx, cy, cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, sh(P.GOLD, P.GOLD_N, 0.9));
    }
    for (var g = 0; g < 4; g++) rivet(b, 3 + (g % 2) * 58, 3 + ((g / 2) | 0) * 57, P.GRAY, P.GRAY_N);
    return b;
  }

  function lightWall(seed) {
    var b = techWall(seed);
    b.rect(26, 4, 12, 46, sh(P.GRAY, P.GRAY_N, 0.05));
    b.vgrad(27, 5, 10, 44, P.FIRE, P.FIRE_N, 0.95, 0.55);
    b.frame(26, 4, 12, 46, sh(P.GRAY, P.GRAY_N, 0.55));
    return b;
  }

  function hazardWall(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    for (var y = 0; y < TS; y++)
      for (var x = 0; x < TS; x++) {
        var s = ((x + y) / 10) | 0;
        b.px(x, y, s % 2 ? sh(P.GOLD, P.GOLD_N, 0.72) : sh(P.GRAY, P.GRAY_N, 0.08));
      }
    b.rect(0, 0, TS, 6, sh(P.GRAY, P.GRAY_N, 0.30));
    b.rect(0, 58, TS, 6, sh(P.GRAY, P.GRAY_N, 0.30));
    b.grain(r, 1.0, P.GOLD, P.GOLD_N);
    return b;
  }

  function doorTex(seed, keyRamp, keyN) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.GRAY, P.GRAY_N, 0.20));
    bevel(b, 0, 0, TS, TS, P.GRAY, P.GRAY_N, 0.26, 0.46, 0.08);
    bevel(b, 4, 4, 26, 56, P.GRAY, P.GRAY_N, 0.34, 0.52, 0.12);
    bevel(b, 34, 4, 26, 56, P.GRAY, P.GRAY_N, 0.34, 0.52, 0.12);
    b.rect(31, 0, 2, TS, sh(P.GRAY, P.GRAY_N, 0.04));       // centre seam
    for (var i = 0; i < 5; i++) {
      b.rect(8, 10 + i * 4, 18, 2, sh(P.GRAY, P.GRAY_N, 0.12));
      b.rect(38, 10 + i * 4, 18, 2, sh(P.GRAY, P.GRAY_N, 0.12));
    }
    for (var g = 0; g < 4; g++) rivet(b, 2 + (g % 2) * 59, 2 + ((g / 2) | 0) * 59, P.GRAY, P.GRAY_N);
    if (keyRamp) {
      /* keycard reader panel */
      b.rect(20, 34, 24, 12, sh(P.GRAY, P.GRAY_N, 0.06));
      b.rect(22, 36, 20, 8, sh(keyRamp, keyN, 0.85));
      b.frame(20, 34, 24, 12, sh(P.GRAY, P.GRAY_N, 0.48));
      b.rect(24, 38, 4, 4, sh(keyRamp, keyN, 1.0));
    }
    b.grain(r, 0.9, P.GRAY, P.GRAY_N);
    return b;
  }

  function exitSwitch(seed, on) {
    var b = techWall(seed);
    b.rect(18, 14, 28, 36, sh(P.GRAY, P.GRAY_N, 0.08));
    bevel(b, 20, 16, 24, 32, P.GRAY, P.GRAY_N, 0.28, 0.48, 0.10);
    var rs = on ? P.GREEN : P.RED, rn = on ? P.GREEN_N : P.RED_N;
    b.rect(24, 20, 16, 12, sh(rs, rn, 0.95));
    b.frame(24, 20, 16, 12, sh(P.GRAY, P.GRAY_N, 0.5));
    /* lever */
    b.thickLine(32, 44, 32, on ? 36 : 40, 2, sh(P.GRAY, P.GRAY_N, 0.6));
    b.ellipse(32, on ? 35 : 39, 3, 3, sh(P.RED, P.RED_N, 0.8));
    return b;
  }

  function supportWall(seed) {
    var b = metalWall(seed);
    b.rect(0, 0, 10, TS, sh(P.GRAY, P.GRAY_N, 0.42));
    b.rect(54, 0, 10, TS, sh(P.GRAY, P.GRAY_N, 0.42));
    b.rect(10, 0, 2, TS, sh(P.GRAY, P.GRAY_N, 0.06));
    b.rect(52, 0, 2, TS, sh(P.GRAY, P.GRAY_N, 0.06));
    for (var i = 0; i < 8; i++) { rivet(b, 4, 3 + i * 8, P.GRAY, P.GRAY_N); rivet(b, 58, 3 + i * 8, P.GRAY, P.GRAY_N); }
    return b;
  }

  /* ---- flats (floors + ceilings) ----------------------------------------- */

  function floorTile(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.GRAY, P.GRAY_N, 0.10));
    for (var j = 0; j < 2; j++)
      for (var i = 0; i < 2; i++)
        bevel(b, i * 32 + 1, j * 32 + 1, 30, 30, P.GRAY, P.GRAY_N, 0.26 + r() * 0.08, 0.40, 0.10);
    b.grain(r, 1.4, P.GRAY, P.GRAY_N);
    return b;
  }

  function metalFloor(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.GRAY, P.GRAY_N, 0.24));
    for (var j = 0; j < 8; j++)
      for (var i = 0; i < 8; i++) {
        var x = i * 8, y = j * 8;
        var d = ((i + j) % 2) ? 0.30 : 0.20;
        b.rect(x + 1, y + 1, 6, 6, sh(P.GRAY, P.GRAY_N, d));
        b.line(x + 1, y + 1, x + 6, y + 6, sh(P.GRAY, P.GRAY_N, d + 0.14));
      }
    b.grain(r, 1.2, P.GRAY, P.GRAY_N);
    return b;
  }

  function grateFloor(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.GRAY, P.GRAY_N, 0.03));
    for (var i = 0; i < TS; i += 8) {
      b.rect(i, 0, 3, TS, sh(P.GRAY, P.GRAY_N, 0.30));
      b.rect(i, 0, 1, TS, sh(P.GRAY, P.GRAY_N, 0.44));
      b.rect(0, i, TS, 2, sh(P.GRAY, P.GRAY_N, 0.24));
    }
    b.grain(r, 1.0, P.GRAY, P.GRAY_N);
    return b;
  }

  function rockFloor(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    for (var y = 0; y < TS; y++)
      for (var x = 0; x < TS; x++) {
        var v = 0.22 + 0.10 * Math.sin(x * 0.4 + Math.sin(y * 0.23) * 3) + r() * 0.10;
        b.px(x, y, sh(P.BROWN, P.BROWN_N, v));
      }
    for (var n = 0; n < 24; n++) {
      var cx = (r() * TS) | 0, cy = (r() * TS) | 0, rad = 2 + (r() * 4 | 0);
      b.ellipse(cx, cy, rad, rad * 0.7, sh(P.BROWN, P.BROWN_N, 0.14 + r() * 0.22));
    }
    return b;
  }

  function bloodFloor(seed) {
    var r = rng(seed), b = rockFloor(seed);
    for (var n = 0; n < 40; n++) {
      var cx = (r() * TS) | 0, cy = (r() * TS) | 0, rad = 2 + (r() * 7 | 0);
      b.ellipse(cx, cy, rad, rad * 0.8, sh(P.BLOOD, P.BLOOD_N, 0.16 + r() * 0.35));
    }
    return b;
  }

  function slimeFlat(seed, frame) {
    var b = new PixBuf(TS, TS);
    var t = frame * 0.9;
    for (var y = 0; y < TS; y++)
      for (var x = 0; x < TS; x++) {
        var v = 0.34
          + 0.24 * Math.sin(x * 0.20 + t + Math.sin(y * 0.16 + t * 0.7) * 2.2)
          + 0.16 * Math.sin(y * 0.27 - t * 1.3);
        b.px(x, y, sh(P.SLIME, P.SLIME_N, v));
      }
    return b;
  }

  function lavaFlat(seed, frame) {
    var b = new PixBuf(TS, TS);
    var t = frame * 1.1;
    for (var y = 0; y < TS; y++)
      for (var x = 0; x < TS; x++) {
        var v = 0.50
          + 0.32 * Math.sin(x * 0.17 + t + Math.sin(y * 0.21 - t * 0.6) * 2.6)
          + 0.18 * Math.sin(y * 0.13 + t * 1.7);
        b.px(x, y, sh(P.FIRE, P.FIRE_N, v));
      }
    return b;
  }

  function ceilTile(seed) {
    var r = rng(seed), b = new PixBuf(TS, TS);
    b.fill(sh(P.GRAY, P.GRAY_N, 0.14));
    for (var j = 0; j < 4; j++)
      for (var i = 0; i < 4; i++)
        bevel(b, i * 16 + 1, j * 16 + 1, 14, 14, P.GRAY, P.GRAY_N, 0.20 + r() * 0.05, 0.30, 0.08);
    b.grain(r, 1.0, P.GRAY, P.GRAY_N);
    return b;
  }

  function ceilLight(seed) {
    var b = ceilTile(seed);
    b.rect(12, 12, 40, 40, sh(P.GRAY, P.GRAY_N, 0.06));
    b.rect(14, 14, 36, 36, sh(P.FIRE, P.FIRE_N, 0.92));
    for (var i = 0; i < 4; i++) b.rect(14, 20 + i * 8, 36, 2, sh(P.GRAY, P.GRAY_N, 0.20));
    b.frame(12, 12, 40, 40, sh(P.GRAY, P.GRAY_N, 0.44));
    return b;
  }

  function ceilRock(seed) {
    var r = rng(seed), b = rockFloor(seed + 7);
    b.grain(r, 2.0, P.BROWN, P.BROWN_N);
    return b;
  }

  /* ---- sky ---------------------------------------------------------------- */

  /* `cold` swaps the hellfire gradient for a freezing industrial night with
     stars — the surface levels and the foundry should not look alike. */
  function makeSky(seed, cold) {
    var W = 320, H = 128, r = rng(seed);
    var b = new PixBuf(W, H);
    var RS = cold ? P.BLUE : P.FIRE, RN = cold ? P.BLUE_N : P.FIRE_N;
    for (var y = 0; y < H; y++) {
      var t = y / (H - 1);
      for (var x = 0; x < W; x++) {
        var band = Math.pow(t, cold ? 2.3 : 1.6);
        var v = (cold ? 0.02 : 0.06) + band * (cold ? 0.5 : 0.62) + 0.05 * Math.sin(x * 0.05 + y * 0.11);
        b.px(x, y, sh(RS, RN, Math.min(0.92, v)));
      }
    }
    /* clouds — tinted with whichever ramp this sky is built from */
    var nClouds = cold ? 40 : 90;
    for (var c = 0; c < nClouds; c++) {
      var cx = r() * W, cy = r() * H * (cold ? 0.55 : 0.75), rx = 8 + r() * 34, ry = 2 + r() * 7;
      var dark = r() < (cold ? 0.78 : 0.6);
      for (var yy = -ry; yy <= ry; yy++)
        for (var xx = -rx; xx <= rx; xx++) {
          if ((xx / rx) * (xx / rx) + (yy / ry) * (yy / ry) > 1) continue;
          var px = ((cx + xx) % W + W) % W, py = cy + yy;
          if (py < 0 || py >= H) continue;
          var cur = b.get(px, py);
          var tt = (cur - RS) / (RN - 1);
          b.px(px, py, sh(RS, RN, Math.max(0.02, Math.min(1, tt + (dark ? -0.22 : 0.14)))));
        }
    }
    if (cold) {
      for (var st = 0; st < 220; st++) {
        var sx2 = (r() * W) | 0, sy2 = (r() * H * 0.62) | 0;
        var mag = r();
        b.px(sx2, sy2, sh(P.STONE, P.STONE_N, 0.35 + mag * 0.6));
        if (mag > 0.93) {
          b.px(sx2 + 1, sy2, sh(P.CYAN, P.CYAN_N, 0.45));
          b.px(sx2 - 1, sy2, sh(P.CYAN, P.CYAN_N, 0.45));
        }
      }
      /* a cold band of aurora sitting on the horizon */
      for (var ax = 0; ax < W; ax++) {
        var ah = H * 0.58 + Math.sin(ax * 0.035) * 7 + Math.sin(ax * 0.011) * 11;
        for (var ay = 0; ay < 16; ay++) {
          var yy2 = (ah + ay) | 0;
          if (yy2 < 0 || yy2 >= H) continue;
          b.px(ax, yy2, sh(P.CYAN, P.CYAN_N, Math.max(0.04, 0.32 - ay * 0.02)));
        }
      }
    }
    /* jagged mountain silhouette along the horizon */
    var hgt = new Array(W);
    var hcur = H * 0.72;
    for (var i = 0; i < W; i++) {
      hcur += (r() - 0.5) * 5.5;
      hcur = Math.max(H * 0.55, Math.min(H * 0.86, hcur));
      hgt[i] = hcur;
    }
    for (var x2 = 0; x2 < W; x2++) {
      for (var y2 = Math.floor(hgt[x2]); y2 < H; y2++) {
        var d = (y2 - hgt[x2]) / (H - hgt[x2] + 1);
        b.px(x2, y2, sh(P.GRAY, P.GRAY_N, 0.02 + d * 0.05));
      }
      b.px(x2, Math.floor(hgt[x2]), sh(cold ? P.CYAN : P.FIRE, cold ? P.CYAN_N : P.FIRE_N, 0.75));
    }
    return { w: W, h: H, d: b.d };
  }

  /* ---- registry ----------------------------------------------------------- */

  var W = {};                                                 // wall texture ids
  var F = {};                                                 // flat texture ids
  var walls = [], flats = [];

  function addWall(name, texture) { W[name] = walls.length; walls.push(texture); }
  function addFlat(name, texture) { F[name] = flats.length; flats.push(texture); }

  function build() {
    /* index 0 must exist for "no texture" lookups */
    addWall('NONE', tex([new PixBuf(TS, TS, sh(P.GRAY, P.GRAY_N, 0.2))]));
    addWall('TECH', tex([techWall(11)]));
    addWall('BRICK', tex([brickWall(22)]));
    addWall('STONE', tex([stoneWall(33)]));
    addWall('METAL', tex([metalWall(44)]));
    addWall('RUST', tex([rustWall(55)]));
    addWall('FLESH', tex([fleshWall(66)]));
    addWall('SUPPORT', tex([supportWall(77)]));
    addWall('HAZARD', tex([hazardWall(88)]));

    var lw = lightWall(99);
    addWall('LIGHTWALL', tex([lw], markGlow(lw, function (c) { return c >= P.FIRE && c < P.FIRE + P.FIRE_N; }), 0));

    var comps = [], compGlow = null;
    for (var i = 0; i < 4; i++) {
      var cf = computerWall(101, i);
      if (!compGlow) compGlow = markGlow(cf, function (c) {
        return (c >= P.CYAN && c < P.CYAN + P.CYAN_N) ||
               (c >= P.GREEN + 10 && c < P.GREEN + P.GREEN_N) ||
               (c >= P.RED + 10 && c < P.RED + P.RED_N);
      });
      comps.push(cf);
    }
    addWall('COMPUTER', tex(comps, compGlow, 7));

    addWall('DOOR', tex([doorTex(120, null, 0)]));
    addWall('DOOR_RED', tex([doorTex(121, P.RED, P.RED_N)]));
    addWall('DOOR_BLUE', tex([doorTex(122, P.BLUE, P.BLUE_N)]));
    addWall('DOOR_YELLOW', tex([doorTex(123, P.GOLD, P.GOLD_N)]));

    var exOff = exitSwitch(130, false), exOn = exitSwitch(130, true);
    addWall('EXIT', tex([exOff], markGlow(exOff, function (c) { return c >= P.RED + 8 && c < P.RED + P.RED_N; })));
    addWall('EXIT_ON', tex([exOn], markGlow(exOn, function (c) { return c >= P.GREEN + 8 && c < P.GREEN + P.GREEN_N; })));

    addFlat('NONE', tex([new PixBuf(TS, TS, sh(P.GRAY, P.GRAY_N, 0.15))]));
    addFlat('TILE', tex([floorTile(201)]));
    addFlat('METAL', tex([metalFloor(202)]));
    addFlat('GRATE', tex([grateFloor(203)]));
    addFlat('ROCK', tex([rockFloor(204)]));
    addFlat('BLOOD', tex([bloodFloor(205)]));
    addFlat('CEIL', tex([ceilTile(206)]));
    addFlat('CEILROCK', tex([ceilRock(207)]));

    var cl = ceilLight(208);
    addFlat('CEILLIGHT', tex([cl], markGlow(cl, function (c) { return c >= P.FIRE && c < P.FIRE + P.FIRE_N; })));

    var slimes = [], slimeGlow = null;
    for (var s = 0; s < 8; s++) {
      var sf = slimeFlat(209, s / 8 * Math.PI * 2);
      if (!slimeGlow) slimeGlow = markGlow(sf, function (c) { return c >= P.SLIME + 8; });
      slimes.push(sf);
    }
    addFlat('SLIME', tex(slimes, slimeGlow, 9));

    var lavas = [], lavaGlow = null;
    for (var v = 0; v < 8; v++) {
      var lf = lavaFlat(210, v / 8 * Math.PI * 2);
      if (!lavaGlow) { lavaGlow = new Uint8Array(lf.d.length); lavaGlow.fill(1); }
      lavas.push(lf);
    }
    addFlat('LAVA', tex(lavas, lavaGlow, 9));
  }

  build();

  global.Tex = {
    TS: TS,
    W: W, F: F,
    walls: walls, flats: flats,
    sky: makeSky(555, false),
    skies: [makeSky(777, true), makeSky(555, false)],
    wall: function (id) { return walls[id] || walls[0]; },
    flat: function (id) { return flats[id] || flats[0]; }
  };
})(window);
