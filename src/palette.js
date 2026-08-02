/* =============================================================================
 * palette.js — 256 colour indexed palette + 32 level light diminishing colormap
 *
 * The renderer never touches RGB directly. Everything (textures, sprites, HUD)
 * is stored as palette indices, exactly like the original id Tech 1 engine.
 * Shading a pixel is therefore a single array lookup:
 *
 *     rgba = PAL32[ COLORMAP[light * 256 + index] ]
 *
 * which is what makes a software renderer viable at 60fps in JavaScript.
 * ============================================================================= */
(function (global) {
  'use strict';

  var PAL = new Uint8Array(256 * 3);

  function setCol(i, r, g, b) {
    PAL[i * 3] = Math.max(0, Math.min(255, Math.round(r)));
    PAL[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(g)));
    PAL[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }

  /* Linear ramp between two colours. `gamma` biases where the midtones sit. */
  function ramp(start, count, c0, c1, gamma) {
    gamma = gamma || 1;
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0 : i / (count - 1);
      t = Math.pow(t, gamma);
      setCol(start + i,
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t);
    }
  }

  /* Multi stop ramp — stops are [position 0..1, r, g, b]. */
  function rampStops(start, count, stops) {
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0 : i / (count - 1);
      var a = stops[0], b = stops[stops.length - 1];
      for (var s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
      }
      var span = (b[0] - a[0]) || 1;
      var k = (t - a[0]) / span;
      setCol(start + i, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
    }
  }

  /* ---------------------------------------------------------------------------
   * Palette layout. Index 0 is the transparency key and is never drawn.
   * Every ramp runs dark -> light so sprite shading is just index arithmetic.
   * ------------------------------------------------------------------------- */
  var P = {
    TRANS: 0,
    GRAY: 1, GRAY_N: 32,
    BROWN: 33, BROWN_N: 16,
    STONE: 49, STONE_N: 16,
    RED: 65, RED_N: 16,
    BLOOD: 81, BLOOD_N: 16,
    GREEN: 97, GREEN_N: 16,
    SLIME: 113, SLIME_N: 16,
    BLUE: 129, BLUE_N: 16,
    CYAN: 145, CYAN_N: 16,
    GOLD: 161, GOLD_N: 16,
    ORANGE: 177, ORANGE_N: 16,
    PURPLE: 193, PURPLE_N: 16,
    FLESH: 209, FLESH_N: 16,
    FIRE: 225, FIRE_N: 16,
    ACCENT: 241, ACCENT_N: 15
  };

  setCol(0, 255, 0, 255);                                    // debug magenta
  ramp(P.GRAY, P.GRAY_N, [4, 4, 6], [255, 255, 255], 0.85);
  ramp(P.BROWN, P.BROWN_N, [18, 11, 5], [222, 174, 116], 0.85);
  ramp(P.STONE, P.STONE_N, [22, 21, 18], [235, 228, 212], 0.85);
  ramp(P.RED, P.RED_N, [24, 2, 2], [255, 82, 66], 0.8);
  ramp(P.BLOOD, P.BLOOD_N, [12, 0, 0], [176, 34, 30], 0.8);
  ramp(P.GREEN, P.GREEN_N, [2, 16, 2], [104, 255, 104], 0.85);
  ramp(P.SLIME, P.SLIME_N, [6, 18, 4], [150, 226, 74], 0.85);
  ramp(P.BLUE, P.BLUE_N, [2, 8, 26], [110, 168, 255], 0.85);
  ramp(P.CYAN, P.CYAN_N, [0, 20, 22], [128, 255, 232], 0.85);
  ramp(P.GOLD, P.GOLD_N, [26, 18, 0], [255, 240, 128], 0.85);
  ramp(P.ORANGE, P.ORANGE_N, [28, 10, 0], [255, 152, 48], 0.85);
  ramp(P.PURPLE, P.PURPLE_N, [18, 0, 28], [214, 118, 255], 0.85);
  ramp(P.FLESH, P.FLESH_N, [28, 14, 10], [255, 220, 186], 0.85);
  rampStops(P.FIRE, P.FIRE_N, [
    [0.00, 40, 0, 0], [0.30, 190, 24, 0], [0.60, 255, 128, 8],
    [0.85, 255, 224, 96], [1.00, 255, 255, 230]
  ]);

  /* Hand picked accents that do not belong to any ramp. */
  var accents = [
    [255, 0, 0], [0, 255, 0], [0, 128, 255], [255, 255, 0], [255, 0, 255],
    [0, 255, 255], [255, 255, 255], [10, 10, 14], [70, 0, 0], [0, 70, 0],
    [0, 0, 70], [140, 90, 30], [90, 200, 255], [255, 180, 220], [180, 255, 120]
  ];
  for (var a = 0; a < accents.length; a++) setCol(P.ACCENT + a, accents[a][0], accents[a][1], accents[a][2]);

  /* --------------------------------------------------------------------------
   * Packed RGBA for direct ImageData writes (little endian ABGR in a Uint32).
   * ------------------------------------------------------------------------ */
  var PAL32 = new Uint32Array(256);
  function buildPal32() {
    for (var i = 0; i < 256; i++) {
      PAL32[i] = (255 << 24) | (PAL[i * 3 + 2] << 16) | (PAL[i * 3 + 1] << 8) | PAL[i * 3];
    }
  }
  buildPal32();

  /* --------------------------------------------------------------------------
   * Light diminishing table. 32 levels, 0 = fullbright, 31 = pitch black.
   * Each entry is the palette index of the nearest colour to `src * scale`.
   * ------------------------------------------------------------------------ */
  var LIGHT_LEVELS = 32;
  var COLORMAP = new Uint8Array(LIGHT_LEVELS * 256);

  function nearest(r, g, b) {
    var best = 1, bestD = 1e9;
    for (var i = 1; i < 256; i++) {
      var dr = r - PAL[i * 3], dg = g - PAL[i * 3 + 1], db = b - PAL[i * 3 + 2];
      /* Weighted for perceptual luminance — keeps ramps from cross-contaminating. */
      var d = dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  for (var l = 0; l < LIGHT_LEVELS; l++) {
    var f = 1 - l / (LIGHT_LEVELS - 1);
    f = Math.pow(f, 1.25);                                   // slightly punchier falloff
    COLORMAP[l * 256] = 0;                                   // transparency stays transparent
    for (var c = 1; c < 256; c++) {
      COLORMAP[l * 256 + c] = nearest(PAL[c * 3] * f, PAL[c * 3 + 1] * f, PAL[c * 3 + 2] * f);
    }
  }

  /* Additive "hot" map used for muzzle flashes and explosions lighting a surface. */
  var BRIGHTMAP = new Uint8Array(256);
  for (var c2 = 1; c2 < 256; c2++) {
    BRIGHTMAP[c2] = nearest(
      Math.min(255, PAL[c2 * 3] * 1.55 + 30),
      Math.min(255, PAL[c2 * 3 + 1] * 1.45 + 22),
      Math.min(255, PAL[c2 * 3 + 2] * 1.35 + 14));
  }

  global.Pal = {
    P: P,
    RGB: PAL,
    PAL32: PAL32,
    COLORMAP: COLORMAP,
    BRIGHTMAP: BRIGHTMAP,
    LIGHT_LEVELS: LIGHT_LEVELS,
    nearest: nearest,
    /* Shorthand used all over the art code: shade(ramp, 0..1) -> index */
    shade: function (rampStart, rampLen, t) {
      var i = Math.round(t * (rampLen - 1));
      if (i < 0) i = 0; else if (i > rampLen - 1) i = rampLen - 1;
      return rampStart + i;
    }
  };
})(window);
