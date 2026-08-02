/* =============================================================================
 * sprites.js — all creature, item, effect and weapon art.
 *
 * Creatures are drawn in three views (front / side / back) and mirrored at
 * render time, giving eight usable rotations like the original engine, so
 * enemies visibly turn as they circle you.
 *
 * Canvas convention: 64x64 with the feet on the bottom row. A creature that
 * should look short simply occupies fewer rows.
 * ============================================================================= */
(function (global) {
  'use strict';

  var Pal = global.Pal, P = Pal.P, PixBuf = global.PixBuf, rng = global.rng;
  var sh = Pal.shade;
  var FRONT = 0, SIDE = 1, BACK = 2;

  /* ---- drawing helpers ---------------------------------------------------- */

  /* Shaded capsule: base fill, contact shadow low-right, rim light upper-left. */
  function limb(b, x0, y0, x1, y1, r, rs, rn, t) {
    r = Math.max(0.7, r);
    b.thickLine(x0, y0, x1, y1, r, sh(rs, rn, t));
    b.thickLine(x0 + r * 0.42, y0 + r * 0.42, x1 + r * 0.42, y1 + r * 0.42, r * 0.55, sh(rs, rn, Math.max(0.02, t - 0.16)));
    b.thickLine(x0 - r * 0.36, y0 - r * 0.36, x1 - r * 0.36, y1 - r * 0.36, r * 0.42, sh(rs, rn, Math.min(1, t + 0.22)));
  }

  function blob(b, cx, cy, rx, ry, rs, rn, t) {
    b.ellipseShaded(cx, cy, rx, ry, rs, rn, Math.max(0.02, t - 0.26), Math.min(1, t + 0.30));
  }

  function eyes(b, cx, cy, spread, rad, rs, rn, glow) {
    for (var s = -1; s <= 1; s += 2) {
      var x = cx + s * spread;
      b.ellipse(x, cy, rad + 0.6, rad + 0.6, sh(P.GRAY, P.GRAY_N, 0.02));
      b.ellipse(x, cy, rad, rad, sh(rs, rn, glow));
      b.px(x - 0.4, cy - 0.4, sh(rs, rn, Math.min(1, glow + 0.25)));
    }
  }

  function teeth(b, x, y, w, n, up) {
    for (var i = 0; i < n; i++) {
      var tx = x + i * (w / n);
      b.line(tx, y, tx, y + (up ? -2 : 2), sh(P.STONE, P.STONE_N, 0.92));
      b.px(tx + 0.5, y + (up ? -1 : 1), sh(P.STONE, P.STONE_N, 0.7));
    }
  }

  function finish(b) { b.outline(sh(P.GRAY, P.GRAY_N, 0.02)); return b; }

  /* ==========================================================================
   * FORMER HUMAN — "Grunt". Hitscan rifle trooper.
   * ========================================================================== */
  function grunt(view, pose, k) {
    var b = new PixBuf(64, 64);
    var cx = 32, gy = 62;
    var sw = pose === 'walk' ? [0, 1, 0, -1][k] : 0;          // leg swing
    var bob = pose === 'walk' ? [0, -1, 0, -1][k] : 0;
    var lean = pose === 'pain' ? -3 : 0;
    var narrow = view === SIDE ? 0.55 : 1;
    gy += bob;

    var hipY = gy - 20, shY = gy - 38, headY = gy - 46;
    var U = P.GREEN, UN = P.GREEN_N;                          // uniform ramp

    /* legs */
    limb(b, cx - 5 * narrow, hipY, cx - 5 * narrow + sw * 4, gy - 2, 4, U, UN, 0.20);
    limb(b, cx + 5 * narrow, hipY, cx + 5 * narrow - sw * 4, gy - 2, 4, U, UN, 0.26);
    b.rect(cx - 9 * narrow + sw * 4, gy - 3, 8 * narrow + 2, 3, sh(P.GRAY, P.GRAY_N, 0.10));
    b.rect(cx + 1 * narrow - sw * 4, gy - 3, 8 * narrow + 2, 3, sh(P.GRAY, P.GRAY_N, 0.14));

    /* torso + webbing */
    blob(b, cx + lean * 0.3, (hipY + shY) / 2, 11 * narrow, 11, U, UN, 0.34);
    b.rect(cx - 10 * narrow, hipY - 3, 20 * narrow, 3, sh(P.BROWN, P.BROWN_N, 0.30));
    if (view !== BACK) {
      b.line(cx - 7 * narrow, shY + 2, cx + 5 * narrow, hipY - 2, sh(P.BROWN, P.BROWN_N, 0.42));
      b.rect(cx + 2 * narrow, hipY - 9, 5, 6, sh(P.BROWN, P.BROWN_N, 0.24));
    } else {
      b.rect(cx - 8, shY + 3, 16, 14, sh(P.GRAY, P.GRAY_N, 0.16));   // backpack
      b.frame(cx - 8, shY + 3, 16, 14, sh(P.GRAY, P.GRAY_N, 0.06));
      b.rect(cx - 5, shY + 6, 10, 3, sh(P.GRAY, P.GRAY_N, 0.28));
    }

    /* head */
    blob(b, cx + lean, headY, 7, 7, P.FLESH, P.FLESH_N, 0.44);
    b.rect(cx - 8 + lean, headY - 8, 16, 6, sh(P.GRAY, P.GRAY_N, 0.26));   // helmet
    b.rect(cx - 8 + lean, headY - 3, 16, 2, sh(P.GRAY, P.GRAY_N, 0.12));
    b.ellipse(cx + lean, headY - 7, 8, 5, sh(P.GRAY, P.GRAY_N, 0.30));
    b.ellipse(cx - 2 + lean, headY - 9, 4, 2, sh(P.GRAY, P.GRAY_N, 0.44));
    if (view === FRONT) {
      eyes(b, cx + lean, headY - 1, 3, 1.2, P.GOLD, P.GOLD_N, pose === 'pain' ? 1.0 : 0.55);
      b.rect(cx - 2 + lean, headY + 3, 5, 1, sh(P.FLESH, P.FLESH_N, 0.12));
    } else if (view === SIDE) {
      eyes(b, cx + 3 + lean, headY - 1, 0, 1.2, P.GOLD, P.GOLD_N, 0.55);
      b.rect(cx + 4 + lean, headY + 2, 3, 1, sh(P.FLESH, P.FLESH_N, 0.12));
    }

    /* arms + rifle */
    var firing = pose === 'attack';
    var ax = view === SIDE ? cx + 2 : cx - 9 * narrow;
    if (firing) {
      limb(b, cx - 7 * narrow, shY + 2, ax + 8, shY + 4, 3, U, UN, 0.30);
      limb(b, cx + 7 * narrow, shY + 2, ax + 12, shY + 6, 3, U, UN, 0.36);
      /* rifle pointing at the viewer */
      b.rect(ax + 8, shY + 1, 12, 4, sh(P.GRAY, P.GRAY_N, 0.16));
      b.rect(ax + 18, shY + 2, 6, 2, sh(P.GRAY, P.GRAY_N, 0.28));
      if (k === 0) {
        b.ellipse(ax + 25, shY + 3, 5, 4, sh(P.FIRE, P.FIRE_N, 0.98));
        b.ellipse(ax + 27, shY + 3, 3, 2, sh(P.FIRE, P.FIRE_N, 1.0));
        b.ellipse(ax + 23, shY + 3, 7, 2, sh(P.FIRE, P.FIRE_N, 0.80));
      }
    } else {
      limb(b, cx - 8 * narrow, shY + 1, cx - 10 * narrow, shY + 14, 3, U, UN, 0.28);
      limb(b, cx + 8 * narrow, shY + 1, cx + 6 * narrow, shY + 14, 3, U, UN, 0.34);
      if (view !== BACK) {
        b.rect(cx - 12 * narrow, shY + 10, 20 * narrow + 4, 3, sh(P.GRAY, P.GRAY_N, 0.14));
        b.rect(cx - 4, shY + 12, 6, 3, sh(P.BROWN, P.BROWN_N, 0.24));
      }
    }
    return finish(b);
  }

  /* ==========================================================================
   * IMP — hunched brown demon, lobs fireballs.
   * ========================================================================== */
  function imp(view, pose, k) {
    var b = new PixBuf(64, 64);
    var cx = 32, gy = 62;
    var sw = pose === 'walk' ? [0, 1.2, 0, -1.2][k] : 0;
    var bob = pose === 'walk' ? [0, -1, -2, -1][k] : 0;
    var narrow = view === SIDE ? 0.6 : 1;
    var atk = pose === 'attack';
    gy += bob;

    var hipY = gy - 18, shY = gy - 34, headY = gy - 43;
    var S = P.BROWN, SN = P.BROWN_N;

    /* tail */
    if (view !== FRONT) {
      var tdir = view === SIDE ? -1 : 1;
      limb(b, cx + 6 * tdir, hipY + 2, cx + 15 * tdir, hipY + 10, 2.2, S, SN, 0.16);
      limb(b, cx + 15 * tdir, hipY + 10, cx + 19 * tdir, hipY + 2, 1.4, S, SN, 0.20);
    }

    /* digitigrade legs */
    for (var s = -1; s <= 1; s += 2) {
      var kneeX = cx + s * 7 * narrow + (s > 0 ? -sw * 2 : sw * 2);
      var footX = cx + s * 6 * narrow + (s > 0 ? -sw * 5 : sw * 5);
      limb(b, cx + s * 5 * narrow, hipY, kneeX, hipY + 9, 3.4, S, SN, s < 0 ? 0.20 : 0.26);
      limb(b, kneeX, hipY + 9, footX, gy - 3, 2.6, S, SN, s < 0 ? 0.18 : 0.24);
      b.rect(footX - 4, gy - 3, 9, 3, sh(S, SN, 0.14));
      for (var t = 0; t < 3; t++) b.px(footX + 4, gy - 3 + t, sh(P.STONE, P.STONE_N, 0.8));
    }

    /* hunched torso */
    blob(b, cx, (hipY + shY) / 2 + 2, 10 * narrow, 10, S, SN, 0.32);
    blob(b, cx, shY + 2, 11 * narrow, 7, S, SN, 0.26);
    if (view === BACK) {
      for (var sp = 0; sp < 5; sp++) {
        var spx = cx - 8 + sp * 4;
        b.line(spx, shY - 2, spx, shY - 6 - (sp === 2 ? 3 : 0), sh(S, SN, 0.60));
        b.px(spx, shY - 7 - (sp === 2 ? 3 : 0), sh(P.STONE, P.STONE_N, 0.7));
      }
    }

    /* head with horns */
    blob(b, cx, headY, 8 * (view === SIDE ? 0.8 : 1), 7, S, SN, 0.38);
    for (var hs = -1; hs <= 1; hs += 2) {
      limb(b, cx + hs * 5, headY - 5, cx + hs * 9, headY - 12, 1.6, P.STONE, P.STONE_N, 0.30);
      b.px(cx + hs * 9, headY - 13, sh(P.STONE, P.STONE_N, 0.62));
    }
    if (view !== BACK) {
      var ex = view === SIDE ? cx + 3 : cx;
      eyes(b, ex, headY - 1, view === SIDE ? 0 : 3.5, 1.6, P.FIRE, P.FIRE_N, atk ? 1.0 : 0.80);
      /* snarling mouth */
      b.rect(cx - 4 + (view === SIDE ? 4 : 0), headY + 3, view === SIDE ? 6 : 9, 2, sh(P.BLOOD, P.BLOOD_N, 0.10));
      teeth(b, cx - 4 + (view === SIDE ? 4 : 0), headY + 3, view === SIDE ? 6 : 9, 4, false);
    }

    /* arms */
    if (atk) {
      for (var a = -1; a <= 1; a += 2) {
        limb(b, cx + a * 9 * narrow, shY + 1, cx + a * 15 * narrow, shY - 9, 3, S, SN, 0.30);
        limb(b, cx + a * 15 * narrow, shY - 9, cx + a * 13 * narrow, shY - 17, 2.4, S, SN, 0.34);
      }
      /* charging fireball between the claws */
      var fy = shY - 20, fr = 4 + k * 2;
      b.ellipse(cx, fy, fr + 2, fr + 2, sh(P.FIRE, P.FIRE_N, 0.55));
      b.ellipse(cx, fy, fr, fr, sh(P.FIRE, P.FIRE_N, 0.85));
      b.ellipse(cx, fy, fr - 2, fr - 2, sh(P.FIRE, P.FIRE_N, 1.0));
    } else {
      for (var a2 = -1; a2 <= 1; a2 += 2) {
        var swing = a2 * sw * 3;
        limb(b, cx + a2 * 9 * narrow, shY + 1, cx + a2 * 13 * narrow + swing, shY + 11, 3, S, SN, a2 < 0 ? 0.28 : 0.34);
        limb(b, cx + a2 * 13 * narrow + swing, shY + 11, cx + a2 * 12 * narrow + swing * 1.6, shY + 20, 2.4, S, SN, a2 < 0 ? 0.24 : 0.30);
        for (var c = -1; c <= 1; c++)
          b.line(cx + a2 * 12 * narrow + swing * 1.6 + c, shY + 21, cx + a2 * 12 * narrow + swing * 1.6 + c * 2, shY + 25, sh(P.STONE, P.STONE_N, 0.72));
      }
    }
    return finish(b);
  }

  /* ==========================================================================
   * DEMON — squat pink bruiser that charges and bites.
   * ========================================================================== */
  function demon(view, pose, k) {
    var b = new PixBuf(64, 64);
    var cx = 32, gy = 62;
    var sw = pose === 'walk' ? [1, 0, -1, 0][k] : 0;
    var bob = pose === 'walk' ? [0, -2, 0, -2][k] : 0;
    var narrow = view === SIDE ? 0.7 : 1;
    var atk = pose === 'attack';
    gy += bob;

    var hipY = gy - 15, shY = gy - 30, headY = gy - 36;
    var S = P.FLESH, SN = P.FLESH_N;

    /* stubby legs */
    for (var s = -1; s <= 1; s += 2) {
      var fx = cx + s * 9 * narrow + s * sw * 3;
      limb(b, cx + s * 8 * narrow, hipY, fx, gy - 4, 5, S, SN, s < 0 ? 0.20 : 0.26);
      b.ellipse(fx, gy - 3, 6, 3, sh(S, SN, 0.16));
      for (var t = -1; t <= 1; t++) b.line(fx + t * 3, gy - 2, fx + t * 3, gy, sh(P.STONE, P.STONE_N, 0.75));
    }

    /* barrel torso */
    blob(b, cx, (hipY + shY) / 2, 15 * narrow, 12, S, SN, 0.34);
    blob(b, cx, shY + 1, 16 * narrow, 8, S, SN, 0.30);
    if (view === BACK) {
      for (var r = 0; r < 6; r++) {
        var rx = cx - 12 + r * 5;
        b.ellipse(rx, shY - 2 + (r % 2) * 3, 2.2, 3, sh(P.BLOOD, P.BLOOD_N, 0.30));
      }
    }

    /* head merged into shoulders */
    blob(b, cx, headY, 11 * (view === SIDE ? 0.85 : 1), 8, S, SN, 0.42);
    for (var hs = -1; hs <= 1; hs += 2) {
      limb(b, cx + hs * 8, headY - 4, cx + hs * 13, headY - 10, 2.2, P.STONE, P.STONE_N, 0.26);
      limb(b, cx + hs * 13, headY - 10, cx + hs * 11, headY - 15, 1.6, P.STONE, P.STONE_N, 0.34);
    }
    if (view !== BACK) {
      var jaw = atk ? 7 + k * 2 : 3;
      var mx = view === SIDE ? cx + 4 : cx;
      var mw = view === SIDE ? 12 : 18;
      b.rect(mx - mw / 2, headY + 2, mw, jaw, sh(P.BLOOD, P.BLOOD_N, 0.06));
      teeth(b, mx - mw / 2 + 1, headY + 2, mw - 2, 6, false);
      teeth(b, mx - mw / 2 + 2, headY + 2 + jaw, mw - 3, 5, true);
      if (atk) {
        b.ellipse(mx, headY + 2 + jaw * 0.5, mw * 0.34, jaw * 0.3, sh(P.BLOOD, P.BLOOD_N, 0.34));
      }
      eyes(b, mx, headY - 3, view === SIDE ? 0 : 5, 1.4, P.RED, P.RED_N, atk ? 1.0 : 0.7);
    }

    /* short arms */
    for (var a = -1; a <= 1; a += 2) {
      var swg = -a * sw * 3;
      limb(b, cx + a * 14 * narrow, shY + 2, cx + a * 17 * narrow + swg, shY + 12, 4, S, SN, a < 0 ? 0.26 : 0.32);
      for (var c = -1; c <= 1; c++)
        b.line(cx + a * 17 * narrow + swg + c * 2, shY + 13, cx + a * 17 * narrow + swg + c * 3, shY + 18, sh(P.STONE, P.STONE_N, 0.72));
    }
    return finish(b);
  }

  /* ==========================================================================
   * HELL BARON — the level 3 boss. Rocket arm, huge, slow, mean.
   * ========================================================================== */
  function baron(view, pose, k) {
    var b = new PixBuf(96, 96);
    var cx = 48, gy = 94;
    var sw = pose === 'walk' ? [0, 1.3, 0, -1.3][k] : 0;
    var bob = pose === 'walk' ? [0, -2, 0, -2][k] : 0;
    var narrow = view === SIDE ? 0.62 : 1;
    var atk = pose === 'attack';
    gy += bob;

    var hipY = gy - 30, shY = gy - 58, headY = gy - 70;
    var S = P.PURPLE, SN = P.PURPLE_N;
    var M = P.GRAY, MN = P.GRAY_N;

    /* mechanical legs */
    for (var s = -1; s <= 1; s += 2) {
      var kneeX = cx + s * 12 * narrow + s * sw * 3;
      var footX = cx + s * 11 * narrow + s * sw * 7;
      limb(b, cx + s * 9 * narrow, hipY, kneeX, hipY + 15, 6, S, SN, s < 0 ? 0.22 : 0.28);
      limb(b, kneeX, hipY + 15, footX, gy - 6, 4.5, M, MN, s < 0 ? 0.20 : 0.28);
      b.rect(footX - 8, gy - 6, 17, 6, sh(M, MN, 0.18));
      b.rect(footX - 8, gy - 6, 17, 2, sh(M, MN, 0.34));
      for (var t = -1; t <= 1; t++) b.line(footX + t * 5, gy - 1, footX + t * 5, gy + 1, sh(P.STONE, P.STONE_N, 0.8));
    }

    /* torso */
    blob(b, cx, (hipY + shY) / 2, 19 * narrow, 17, S, SN, 0.32);
    b.rect(cx - 20 * narrow, hipY - 6, 40 * narrow, 6, sh(M, MN, 0.22));
    blob(b, cx, shY + 4, 23 * narrow, 11, S, SN, 0.28);
    /* chest plate / exhaust */
    if (view !== BACK) {
      b.rect(cx - 10 * narrow, shY + 8, 20 * narrow, 16, sh(M, MN, 0.20));
      b.frame(cx - 10 * narrow, shY + 8, 20 * narrow, 16, sh(M, MN, 0.36));
      for (var v = 0; v < 3; v++) b.rect(cx - 7 * narrow, shY + 11 + v * 4, 14 * narrow, 2, sh(P.FIRE, P.FIRE_N, 0.75));
    } else {
      for (var e = -1; e <= 1; e += 2) {
        b.rect(cx + e * 12 - 4, shY - 4, 8, 12, sh(M, MN, 0.22));
        b.ellipse(cx + e * 12, shY - 5, 4, 2.5, sh(P.FIRE, P.FIRE_N, 0.85));
      }
    }

    /* head */
    blob(b, cx, headY, 12 * (view === SIDE ? 0.85 : 1), 10, S, SN, 0.36);
    for (var hs = -1; hs <= 1; hs += 2) {
      limb(b, cx + hs * 9, headY - 6, cx + hs * 17, headY - 16, 3, P.STONE, P.STONE_N, 0.26);
      limb(b, cx + hs * 17, headY - 16, cx + hs * 14, headY - 24, 2, P.STONE, P.STONE_N, 0.36);
    }
    if (view !== BACK) {
      var mx = view === SIDE ? cx + 5 : cx;
      b.rect(mx - 9, headY + 3, 18, 5, sh(P.BLOOD, P.BLOOD_N, 0.06));
      teeth(b, mx - 8, headY + 3, 16, 6, false);
      teeth(b, mx - 7, headY + 8, 14, 5, true);
      /* single cyclopean eye */
      b.ellipse(mx, headY - 3, 5, 4, sh(M, MN, 0.06));
      b.ellipse(mx, headY - 3, 4, 3, sh(P.FIRE, P.FIRE_N, atk ? 1.0 : 0.78));
      b.ellipse(mx, headY - 3, 1.6, 1.6, 247);
    }

    /* left arm: claw. right arm: rocket cannon */
    limb(b, cx - 20 * narrow, shY + 6, cx - 26 * narrow + sw * 2, shY + 24, 6, S, SN, 0.26);
    for (var c2 = -1; c2 <= 1; c2++)
      b.line(cx - 26 * narrow + sw * 2 + c2 * 3, shY + 26, cx - 26 * narrow + sw * 2 + c2 * 5, shY + 34, sh(P.STONE, P.STONE_N, 0.74));

    var gx = cx + 21 * narrow, gyy = shY + (atk ? 4 : 10);
    limb(b, cx + 18 * narrow, shY + 6, gx, gyy, 6, S, SN, 0.30);
    b.rect(gx - 5, gyy - 5, 22, 11, sh(M, MN, 0.24));
    b.frame(gx - 5, gyy - 5, 22, 11, sh(M, MN, 0.40));
    b.rect(gx + 16, gyy - 3, 8, 7, sh(M, MN, 0.16));
    b.ellipse(gx + 24, gyy, 3.5, 3.5, sh(M, MN, 0.06));
    if (atk && k === 1) {
      b.ellipse(gx + 30, gyy, 9, 7, sh(P.FIRE, P.FIRE_N, 0.60));
      b.ellipse(gx + 30, gyy, 6, 5, sh(P.FIRE, P.FIRE_N, 0.90));
      b.ellipse(gx + 30, gyy, 3, 3, sh(P.FIRE, P.FIRE_N, 1.0));
    }
    return finish(b);
  }

  /* ==========================================================================
   * Death sequences — one shared routine, tinted per creature.
   * ========================================================================== */
  function deathFrames(size, rs, rn, count, seed) {
    var out = [], r = rng(seed);
    for (var f = 0; f < count; f++) {
      var b = new PixBuf(size, size);
      var cx = size / 2, gy = size - 2;
      var t = f / (count - 1);
      var collapse = t * t;
      if (f === 0) {
        /* thrown backwards, arms out */
        blob(b, cx, gy - 26, 11, 13, rs, rn, 0.30);
        blob(b, cx, gy - 40, 7, 7, rs, rn, 0.36);
        limb(b, cx - 9, gy - 34, cx - 20, gy - 42, 3, rs, rn, 0.26);
        limb(b, cx + 9, gy - 34, cx + 20, gy - 42, 3, rs, rn, 0.30);
        limb(b, cx - 6, gy - 14, cx - 10, gy - 2, 4, rs, rn, 0.22);
        limb(b, cx + 6, gy - 14, cx + 10, gy - 2, 4, rs, rn, 0.26);
        b.rect(cx - 4, gy - 44, 9, 4, sh(P.BLOOD, P.BLOOD_N, 0.55));
      } else if (f < count - 1) {
        var hgt = 26 * (1 - collapse) + 5;
        var wid = 11 + collapse * 10;
        blob(b, cx, gy - hgt * 0.5, wid, Math.max(4, hgt * 0.5), rs, rn, 0.28);
        blob(b, cx - collapse * 10, gy - hgt * 0.9, 7 - collapse * 2, 6 - collapse * 2, rs, rn, 0.34);
        limb(b, cx - wid * 0.6, gy - hgt * 0.4, cx - wid - 4, gy - 2, 3, rs, rn, 0.24);
        limb(b, cx + wid * 0.6, gy - hgt * 0.4, cx + wid + 4, gy - 2, 3, rs, rn, 0.28);
        for (var i = 0; i < 10 * f; i++)
          b.px(cx + (r() - 0.5) * wid * 2.6, gy - r() * hgt, sh(P.BLOOD, P.BLOOD_N, 0.14 + r() * 0.4));
      } else {
        /* final gib pile */
        b.ellipse(cx, gy - 3, 17, 4, sh(P.BLOOD, P.BLOOD_N, 0.16));
        b.ellipse(cx - 3, gy - 5, 12, 4, sh(rs, rn, 0.22));
        b.ellipse(cx + 7, gy - 4, 6, 3, sh(rs, rn, 0.28));
        blob(b, cx - 9, gy - 6, 5, 4, rs, rn, 0.30);
        for (var j = 0; j < 60; j++)
          b.px(cx + (r() - 0.5) * 38, gy - r() * 9, sh(P.BLOOD, P.BLOOD_N, 0.12 + r() * 0.45));
      }
      out.push(finish(b));
    }
    return out;
  }

  /* ==========================================================================
   * Execution sequence.
   *
   * Deliberately not the ordinary death: the body arches, tears open across the
   * middle, and the top half is thrown clear before the whole thing comes apart.
   * Six frames at 16fps, so it reads in about a third of a second.
   * ========================================================================== */
  function executeFrames(size, rs, rn, count, seed) {
    var out = [], r = rng(seed);
    for (var f = 0; f < count; f++) {
      var b = new PixBuf(size, size);
      var cx = size / 2, gy = size - 2;
      var t = count === 1 ? 0 : f / (count - 1);
      var tear = Math.max(0, (t - 0.14) / 0.86);     /* held for one frame, then rips */
      var lift = tear * tear * 46;                   /* accelerating, not linear */
      var drift = tear * 17;
      var last = f === count - 1;

      if (!last) {
        /* lower half buckling under the weight it no longer carries */
        var hipY = gy - 21 + tear * 15;
        var spread = 5 + tear * 11;
        limb(b, cx - 4, hipY, cx - spread, gy - 2, 4.2 - tear, rs, rn, 0.20);
        limb(b, cx + 4, hipY, cx + spread, gy - 2, 4.2 - tear, rs, rn, 0.26);
        blob(b, cx, hipY - 3 + tear * 6, 10 - tear * 2, 8 - tear * 3, rs, rn, 0.28);

        /* ragged tear across the middle, opening up as it goes */
        if (tear > 0.02) {
          var ty = hipY - 11 + tear * 5;
          for (var x = -11; x <= 11; x++) {
            var jag = ((x * 7 + f * 13) % 5) - 2;
            for (var k = 0; k < 1 + tear * 4; k++)
              b.px(cx + x, ty + jag - k, sh(P.BLOOD, P.BLOOD_N, 0.55 - k * 0.08));
          }
        }

        /* upper half torn free, thrown up and back, tumbling as it goes */
        if (t < 0.86) {
          var s = 1 - tear * 0.20;
          var ux = cx - drift, uy = hipY - 19 - lift;
          var roll = tear * 7;                       /* head swings round */
          blob(b, ux, uy, 10 * s, 9 * s, rs, rn, 0.32);
          blob(b, ux - roll, uy - 11 * s + roll * 0.5, 6.5 * s, 6 * s, rs, rn, 0.38);
          limb(b, ux - 8 * s, uy - 2, ux - 18 * s - tear * 12, uy - 4 + tear * 12, 3, rs, rn, 0.26);
          limb(b, ux + 8 * s, uy - 2, ux + 18 * s + tear * 12, uy - 10 - tear * 10, 3, rs, rn, 0.30);
          /* spine and viscera trailing out of the torn torso */
          if (tear > 0.08) {
            for (var v = 0; v < 7; v++)
              b.px(ux + v * roll * 0.3, uy + 10 * s + v * 2.4, sh(P.STONE, P.STONE_N, 0.58 - v * 0.06));
            for (var w = 0; w < 5; w++)
              b.ellipse(ux + (r() - 0.5) * 9, uy + 11 * s + w * 3, 1.6, 1.3,
                sh(P.BLOOD, P.BLOOD_N, 0.30 + r() * 0.3));
          }
        }

        /* spray, widening and thickening as it comes apart */
        var n = 30 + f * 34;
        for (var i = 0; i < n; i++) {
          var a = -Math.PI / 2 + (r() - 0.5) * (1.1 + tear * 3.6);
          var d = r() * (8 + tear * 40);
          var px = cx + Math.cos(a) * d * (0.6 + r() * 0.9);
          var py = hipY - 9 + Math.sin(a) * d * 0.75 + tear * 10;
          if (r() < 0.30 * tear) b.ellipse(px, py, 1.4, 1.2, sh(P.BLOOD, P.BLOOD_N, 0.30 + r() * 0.45));
          else b.px(px, py, sh(P.BLOOD, P.BLOOD_N, 0.18 + r() * 0.55));
        }
      } else {
        /* nothing left but a wet pile */
        b.ellipse(cx, gy - 3, 20, 5, sh(P.BLOOD, P.BLOOD_N, 0.16));
        b.ellipse(cx - 4, gy - 5, 13, 4, sh(rs, rn, 0.20));
        b.ellipse(cx + 8, gy - 4, 7, 3, sh(rs, rn, 0.26));
        blob(b, cx - 11, gy - 6, 5, 4, rs, rn, 0.28);
        for (var j = 0; j < 90; j++)
          b.px(cx + (r() - 0.5) * 46, gy - r() * 11, sh(P.BLOOD, P.BLOOD_N, 0.12 + r() * 0.48));
      }

      /* the hit itself: a hard white core on the first frame only */
      if (f === 0) {
        b.ellipse(cx, gy - 30, 10, 8, sh(P.CYAN, P.CYAN_N, 0.85));
        b.ellipse(cx, gy - 30, 5, 4, 247);
      }
      out.push(finish(b));
    }
    return out;
  }

  /* Chunks thrown clear by an execution. */
  function gibSpr(k) {
    var b = new PixBuf(8, 8), r = rng(760 + k);
    var w = 1.8 + (k % 3) * 0.9;
    b.ellipseShaded(4, 4, w, w * 0.85, P.FLESH, P.FLESH_N, 0.10, 0.55);
    for (var i = 0; i < 5; i++)
      b.px(2 + r() * 4, 2 + r() * 4, sh(P.BLOOD, P.BLOOD_N, 0.25 + r() * 0.5));
    return finish(b);
  }

  /* ==========================================================================
   * Items and scenery
   * ========================================================================== */
  function itemBase(b, w, cx, gy, rs, rn) {
    b.ellipse(cx, gy, w, 2.5, sh(rs, rn, 0.08));
  }

  function medkit(big) {
    var b = new PixBuf(32, 32), cx = 16, gy = 29;
    var w = big ? 11 : 7, h = big ? 9 : 6;
    itemBase(b, w + 2, gy, P.GRAY, P.GRAY_N);
    b.rect(cx - w, gy - h * 2, w * 2, h * 2, sh(P.STONE, P.STONE_N, 0.80));
    b.rect(cx - w, gy - h * 2, w * 2, 2, sh(P.STONE, P.STONE_N, 0.95));
    b.rect(cx - w, gy - 3, w * 2, 3, sh(P.STONE, P.STONE_N, 0.50));
    b.frame(cx - w, gy - h * 2, w * 2, h * 2, sh(P.GRAY, P.GRAY_N, 0.10));
    var cw = big ? 3 : 2, cl = big ? 9 : 6;
    b.rect(cx - cw / 2, gy - h - cl / 2, cw, cl, sh(P.RED, P.RED_N, 0.85));
    b.rect(cx - cl / 2, gy - h - cw / 2, cl, cw, sh(P.RED, P.RED_N, 0.85));
    if (!big) { b.rect(cx - w, gy - h * 2 - 2, w * 2, 2, sh(P.BLUE, P.BLUE_N, 0.55)); }
    return finish(b);
  }

  function armour(blue) {
    var b = new PixBuf(32, 32), cx = 16, gy = 29;
    var rs = blue ? P.BLUE : P.GREEN, rn = blue ? P.BLUE_N : P.GREEN_N;
    itemBase(b, 10, gy, P.GRAY, P.GRAY_N);
    /* chest plate silhouette */
    for (var y = 0; y < 18; y++) {
      var t = y / 17;
      var hw = 10 - t * t * 6;
      for (var x = -hw; x <= hw; x++) {
        var l = 0.30 + 0.42 * Math.max(0, 1 - Math.abs((x + 3) / 9)) - t * 0.10;
        b.px(cx + x, gy - 19 + y, sh(rs, rn, l));
      }
    }
    b.rect(cx - 9, gy - 19, 18, 2, sh(rs, rn, 0.90));
    b.line(cx, gy - 17, cx, gy - 4, sh(rs, rn, 0.14));
    b.ellipse(cx, gy - 13, 3, 3, sh(rs, rn, 0.95));
    b.ellipse(cx, gy - 13, 1.4, 1.4, 247);
    return finish(b);
  }

  function ammoBox(kind) {
    var b = new PixBuf(32, 32), cx = 16, gy = 29;
    itemBase(b, 9, gy, P.GRAY, P.GRAY_N);
    if (kind === 'clip') {
      b.rect(cx - 5, gy - 9, 10, 9, sh(P.GRAY, P.GRAY_N, 0.34));
      b.rect(cx - 5, gy - 9, 10, 2, sh(P.GRAY, P.GRAY_N, 0.52));
      for (var i = 0; i < 4; i++) b.rect(cx - 4 + i * 3, gy - 12, 2, 3, sh(P.GOLD, P.GOLD_N, 0.80));
      b.frame(cx - 5, gy - 9, 10, 9, sh(P.GRAY, P.GRAY_N, 0.10));
    } else if (kind === 'shell') {
      b.rect(cx - 8, gy - 8, 16, 8, sh(P.BROWN, P.BROWN_N, 0.28));
      b.rect(cx - 8, gy - 8, 16, 2, sh(P.BROWN, P.BROWN_N, 0.44));
      for (var s = 0; s < 4; s++) {
        b.rect(cx - 7 + s * 4, gy - 12, 3, 4, sh(P.RED, P.RED_N, 0.60));
        b.rect(cx - 7 + s * 4, gy - 13, 3, 1, sh(P.GOLD, P.GOLD_N, 0.85));
      }
      b.frame(cx - 8, gy - 8, 16, 8, sh(P.BROWN, P.BROWN_N, 0.08));
    } else if (kind === 'cell') {
      b.rect(cx - 6, gy - 14, 12, 14, sh(P.GRAY, P.GRAY_N, 0.24));
      b.rect(cx - 4, gy - 12, 8, 10, sh(P.CYAN, P.CYAN_N, 0.90));
      for (var c = 0; c < 3; c++) b.rect(cx - 4, gy - 11 + c * 3, 8, 1, sh(P.CYAN, P.CYAN_N, 0.35));
      b.frame(cx - 6, gy - 14, 12, 14, sh(P.GRAY, P.GRAY_N, 0.46));
      b.rect(cx - 2, gy - 16, 4, 2, sh(P.GRAY, P.GRAY_N, 0.50));
    } else {                                                  /* rocket */
      b.rect(cx - 3, gy - 10, 6, 10, sh(P.GREEN, P.GREEN_N, 0.30));
      b.ellipse(cx, gy - 11, 3, 4, sh(P.RED, P.RED_N, 0.60));
      b.rect(cx - 5, gy - 2, 11, 2, sh(P.GRAY, P.GRAY_N, 0.22));
      b.line(cx - 3, gy - 1, cx - 6, gy + 1, sh(P.GRAY, P.GRAY_N, 0.30));
      b.line(cx + 3, gy - 1, cx + 6, gy + 1, sh(P.GRAY, P.GRAY_N, 0.30));
    }
    return finish(b);
  }

  function keycard(rs, rn) {
    var b = new PixBuf(32, 32), cx = 16, gy = 28;
    itemBase(b, 5, gy, P.GRAY, P.GRAY_N);
    b.rect(cx - 4, gy - 14, 9, 14, sh(rs, rn, 0.70));
    b.rect(cx - 4, gy - 14, 9, 3, sh(rs, rn, 0.95));
    b.rect(cx - 2, gy - 10, 5, 4, sh(P.GRAY, P.GRAY_N, 0.90));
    b.rect(cx - 3, gy - 4, 7, 1, sh(rs, rn, 0.30));
    b.frame(cx - 4, gy - 14, 9, 14, sh(rs, rn, 0.20));
    return finish(b);
  }

  function gunPickup(kind) {
    var b = new PixBuf(32, 32), cx = 16, gy = 28;
    itemBase(b, 12, gy, P.GRAY, P.GRAY_N);
    var G = P.GRAY, GN = P.GRAY_N;
    if (kind === 'shotgun') {
      b.rect(cx - 13, gy - 7, 20, 4, sh(G, GN, 0.30));
      b.rect(cx - 13, gy - 7, 20, 1, sh(G, GN, 0.48));
      b.rect(cx - 13, gy - 4, 16, 2, sh(G, GN, 0.14));
      b.rect(cx + 6, gy - 8, 8, 5, sh(P.BROWN, P.BROWN_N, 0.34));
      b.rect(cx - 2, gy - 3, 5, 3, sh(P.BROWN, P.BROWN_N, 0.26));
    } else if (kind === 'chaingun') {
      b.rect(cx - 12, gy - 9, 12, 9, sh(G, GN, 0.28));
      b.frame(cx - 12, gy - 9, 12, 9, sh(G, GN, 0.44));
      for (var i = 0; i < 3; i++) b.rect(cx, gy - 8 + i * 3, 15, 2, sh(G, GN, 0.20 + i * 0.10));
      b.rect(cx + 13, gy - 9, 3, 9, sh(G, GN, 0.38));
      b.ellipse(cx - 9, gy - 4, 4, 4, sh(G, GN, 0.16));
    } else if (kind === 'plasma') {
      b.rect(cx - 12, gy - 8, 22, 7, sh(G, GN, 0.26));
      b.rect(cx - 12, gy - 8, 22, 2, sh(G, GN, 0.42));
      b.rect(cx - 8, gy - 12, 10, 5, sh(P.CYAN, P.CYAN_N, 0.85));
      b.rect(cx + 10, gy - 7, 6, 5, sh(G, GN, 0.34));
      b.ellipse(cx + 16, gy - 5, 3, 3, sh(P.CYAN, P.CYAN_N, 0.95));
      b.rect(cx - 4, gy - 1, 5, 2, sh(G, GN, 0.16));
    } else {                                                  /* rocket launcher */
      b.rect(cx - 14, gy - 9, 26, 8, sh(P.GREEN, P.GREEN_N, 0.24));
      b.rect(cx - 14, gy - 9, 26, 2, sh(P.GREEN, P.GREEN_N, 0.40));
      b.ellipse(cx + 12, gy - 5, 4, 5, sh(G, GN, 0.14));
      b.rect(cx - 16, gy - 8, 4, 6, sh(G, GN, 0.30));
      b.rect(cx - 6, gy - 13, 9, 4, sh(G, GN, 0.34));
    }
    return finish(b);
  }

  function barrel() {
    var b = new PixBuf(32, 40), cx = 16, gy = 38;
    b.ellipse(cx, gy, 10, 3, sh(P.GRAY, P.GRAY_N, 0.06));
    for (var y = 0; y < 28; y++) {
      for (var x = -9; x <= 9; x++) {
        var l = 0.24 + 0.36 * Math.max(0, 1 - Math.abs((x + 3.5) / 10));
        b.px(cx + x, gy - 29 + y, sh(P.GREEN, P.GREEN_N, l));
      }
    }
    b.ellipse(cx, gy - 29, 9.4, 3, sh(P.GREEN, P.GREEN_N, 0.44));
    b.ellipse(cx, gy - 29, 7, 2, sh(P.GREEN, P.GREEN_N, 0.30));
    b.rect(cx - 9, gy - 24, 19, 2, sh(P.GREEN, P.GREEN_N, 0.14));
    b.rect(cx - 9, gy - 9, 19, 2, sh(P.GREEN, P.GREEN_N, 0.14));
    /* hazard trefoil */
    b.ellipse(cx, gy - 16, 4, 4, sh(P.GOLD, P.GOLD_N, 0.85));
    for (var a = 0; a < 3; a++) {
      var an = a * 2.094 - 1.57;
      b.thickLine(cx, gy - 16, cx + Math.cos(an) * 5, gy - 16 + Math.sin(an) * 5, 1.6, sh(P.GRAY, P.GRAY_N, 0.04));
    }
    return finish(b);
  }

  function lamp() {
    var b = new PixBuf(32, 48), cx = 16, gy = 46;
    b.ellipse(cx, gy, 7, 2.5, sh(P.GRAY, P.GRAY_N, 0.08));
    b.rect(cx - 6, gy - 4, 13, 4, sh(P.GRAY, P.GRAY_N, 0.22));
    b.rect(cx - 2, gy - 28, 5, 25, sh(P.GRAY, P.GRAY_N, 0.30));
    b.rect(cx - 1, gy - 28, 1, 25, sh(P.GRAY, P.GRAY_N, 0.46));
    b.ellipse(cx, gy - 32, 7, 8, sh(P.FIRE, P.FIRE_N, 0.92));
    b.ellipse(cx, gy - 33, 4, 5, sh(P.FIRE, P.FIRE_N, 1.0));
    b.rect(cx - 5, gy - 40, 11, 4, sh(P.GRAY, P.GRAY_N, 0.26));
    return finish(b);
  }

  function gore(kind) {
    var b = new PixBuf(32, 32), r = rng(kind === 'pole' ? 3 : 9), cx = 16, gy = 30;
    if (kind === 'pole') {
      b.rect(cx - 1, gy - 26, 3, 26, sh(P.GRAY, P.GRAY_N, 0.20));
      blob(b, cx, gy - 28, 6, 6, P.FLESH, P.FLESH_N, 0.30);
      b.ellipse(cx - 2, gy - 29, 1.4, 1.4, sh(P.GRAY, P.GRAY_N, 0.02));
      b.ellipse(cx + 2, gy - 29, 1.4, 1.4, sh(P.GRAY, P.GRAY_N, 0.02));
      b.rect(cx - 3, gy - 25, 7, 2, sh(P.BLOOD, P.BLOOD_N, 0.30));
      for (var d = 0; d < 8; d++) b.px(cx + (r() - 0.5) * 6, gy - 22 + r() * 12, sh(P.BLOOD, P.BLOOD_N, 0.25));
    } else {
      b.ellipse(cx, gy - 2, 13, 4, sh(P.BLOOD, P.BLOOD_N, 0.14));
      b.ellipse(cx - 3, gy - 4, 8, 3, sh(P.FLESH, P.FLESH_N, 0.20));
      blob(b, cx + 6, gy - 5, 4, 3, P.FLESH, P.FLESH_N, 0.26);
      for (var i = 0; i < 40; i++) b.px(cx + (r() - 0.5) * 28, gy - r() * 7, sh(P.BLOOD, P.BLOOD_N, 0.10 + r() * 0.4));
    }
    return finish(b);
  }

  /* ==========================================================================
   * Projectiles and effects
   * ========================================================================== */
  function fireball(k, rs, rn) {
    var b = new PixBuf(24, 24), r = rng(70 + k), cx = 12, cy = 12;
    var wob = 1 + Math.sin(k * 2.1) * 0.5;
    b.ellipse(cx, cy, 8 + wob, 8, sh(rs, rn, 0.35));
    b.ellipse(cx, cy, 6 + wob * 0.6, 6, sh(rs, rn, 0.70));
    b.ellipse(cx - 0.5, cy - 0.5, 3.6, 3.6, sh(rs, rn, 0.95));
    b.ellipse(cx - 1, cy - 1, 1.8, 1.8, sh(rs, rn, 1.0));
    for (var i = 0; i < 14; i++) {
      var a = r() * 6.283, d = 6 + r() * 4;
      b.px(cx + Math.cos(a) * d, cy + Math.sin(a) * d, sh(rs, rn, 0.5 + r() * 0.4));
    }
    return b;
  }

  function plasmaBall(k) {
    var b = new PixBuf(20, 20), cx = 10, cy = 10;
    var s = 1 + Math.sin(k * 1.6) * 0.18;
    b.ellipse(cx, cy, 7 * s, 7 * s, sh(P.CYAN, P.CYAN_N, 0.30));
    b.ellipse(cx, cy, 5 * s, 5 * s, sh(P.CYAN, P.CYAN_N, 0.70));
    b.ellipse(cx, cy, 3 * s, 3 * s, sh(P.CYAN, P.CYAN_N, 1.0));
    b.ellipse(cx, cy, 1.5, 1.5, 247);
    for (var a = 0; a < 4; a++) {
      var an = a * 1.57 + k * 0.6;
      b.px(cx + Math.cos(an) * 7.5, cy + Math.sin(an) * 7.5, sh(P.CYAN, P.CYAN_N, 0.85));
    }
    return b;
  }

  function rocketSpr(k) {
    var b = new PixBuf(24, 24), cx = 12, cy = 12;
    b.rect(cx - 3, cy - 4, 7, 9, sh(P.GREEN, P.GREEN_N, 0.30));
    b.ellipse(cx, cy - 5, 3.4, 3, sh(P.RED, P.RED_N, 0.55));
    b.rect(cx - 5, cy + 3, 11, 2, sh(P.GRAY, P.GRAY_N, 0.24));
    var f = 4 + (k % 2) * 2;
    b.ellipse(cx, cy + 6 + f * 0.3, 3.2, f, sh(P.FIRE, P.FIRE_N, 0.85));
    b.ellipse(cx, cy + 5 + f * 0.2, 1.8, f * 0.6, sh(P.FIRE, P.FIRE_N, 1.0));
    return b;
  }

  function explosion(k, n) {
    var b = new PixBuf(80, 80), r = rng(900 + k), cx = 40, cy = 40;
    var t = k / (n - 1);
    var rad = 8 + t * 30;
    var blobs = 26;
    for (var i = 0; i < blobs; i++) {
      var a = (i / blobs) * 6.283 + r() * 0.4;
      var d = rad * (0.35 + r() * 0.65);
      var br = rad * (0.30 + r() * 0.34) * (1 - t * 0.35);
      var heat = Math.max(0.05, (1 - t) * (0.55 + r() * 0.45) - d / (rad * 3));
      b.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, br, br, sh(P.FIRE, P.FIRE_N, heat));
    }
    if (t < 0.55) {
      b.ellipse(cx, cy, rad * 0.55, rad * 0.5, sh(P.FIRE, P.FIRE_N, 1.0));
      b.ellipse(cx, cy, rad * 0.3, rad * 0.28, 247);
    }
    /* smoke ring on the tail end */
    if (t > 0.4) {
      for (var s = 0; s < 16; s++) {
        var a2 = r() * 6.283, d2 = rad * (0.6 + r() * 0.6);
        b.ellipse(cx + Math.cos(a2) * d2, cy + Math.sin(a2) * d2 * 0.8, 3 + r() * 5, 3 + r() * 5,
          sh(P.GRAY, P.GRAY_N, 0.05 + r() * 0.10));
      }
    }
    return b;
  }

  /* Pickup orbs shed by executions — the loop that keeps you moving forward. */
  function orbSpr(k, rs, rn) {
    var b = new PixBuf(16, 16), cx = 8, cy = 8;
    var s = 1 + Math.sin(k * 1.15) * 0.15;
    b.ellipse(cx, cy, 6.4 * s, 6.4 * s, sh(rs, rn, 0.24));
    b.ellipse(cx, cy, 4.4 * s, 4.4 * s, sh(rs, rn, 0.62));
    b.ellipse(cx, cy, 2.4 * s, 2.4 * s, sh(rs, rn, 1.0));
    b.ellipse(cx - 0.7, cy - 0.9, 1.1, 1.1, 247);
    for (var i = 0; i < 4; i++) {
      var a = i * 1.5708 + k * 0.5;
      b.px(cx + Math.cos(a) * 7.2, cy + Math.sin(a) * 7.2, sh(rs, rn, 0.8));
    }
    return b;
  }

  /* Execution flash: a hard white core with a cyan shockwave and gore. */
  function executeBurst(k, n) {
    var b = new PixBuf(72, 72), r = rng(1300 + k), cx = 36, cy = 36;
    var t = k / (n - 1);
    var rad = 7 + t * 29;
    for (var i = 0; i < 20; i++) {
      var a = (i / 20) * 6.283 + t * 0.5;
      var d = rad * (0.72 + r() * 0.5);
      b.thickLine(cx + Math.cos(a) * d * 0.34, cy + Math.sin(a) * d * 0.34,
        cx + Math.cos(a) * d, cy + Math.sin(a) * d,
        Math.max(0.7, 3.2 * (1 - t)), sh(P.CYAN, P.CYAN_N, Math.max(0.06, 1 - t * 0.95)));
    }
    if (t < 0.55) {
      var cr = rad * 0.52 * (1 - t * 1.5);
      b.ellipse(cx, cy, cr, cr, sh(P.CYAN, P.CYAN_N, 1.0));
      b.ellipse(cx, cy, cr * 0.55, cr * 0.55, 247);
    }
    for (var s = 0; s < 26; s++) {
      var a2 = r() * 6.283, d2 = rad * (0.35 + r() * 0.85);
      b.px(cx + Math.cos(a2) * d2, cy + Math.sin(a2) * d2, sh(P.BLOOD, P.BLOOD_N, 0.28 + r() * 0.55));
    }
    return b;
  }

  function puff(k, rs, rn) {
    var b = new PixBuf(20, 20), r = rng(400 + k), cx = 10, cy = 10;
    var rad = 2 + k * 2.4;
    for (var i = 0; i < 8; i++) {
      var a = r() * 6.283, d = r() * rad;
      b.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.4 + r() * 2.4, 1.4 + r() * 2.4,
        sh(rs, rn, Math.max(0.05, 0.62 - k * 0.16 + r() * 0.2)));
    }
    return b;
  }

  /* ==========================================================================
   * First person weapons.
   *
   * Framing rules, learned the hard way: a held weapon is NOT a corridor
   * vanishing at the crosshair. It sits below the sightline, recedes only
   * mildly (roughly 2:1 near-to-far), and its muzzle stops well short of the
   * horizon. The hands run off the bottom edge so they read as attached to you.
   *
   * Buffer is 320 x 104 and is blitted flush with the bottom of the view, so
   * buffer y=0 is just under the crosshair and y=104 is the bottom of screen.
   * ========================================================================== */
  var WW = 320, WH = 104;

  /* Scanline polygon fill. */
  function poly(b, pts, c) {
    var minY = 1e9, maxY = -1e9;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][1] < minY) minY = pts[i][1];
      if (pts[i][1] > maxY) maxY = pts[i][1];
    }
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var xs = [];
      for (var e = 0; e < pts.length; e++) {
        var a = pts[e], d = pts[(e + 1) % pts.length];
        if ((a[1] <= y && d[1] > y) || (d[1] <= y && a[1] > y))
          xs.push(a[0] + (y - a[1]) * (d[0] - a[0]) / (d[1] - a[1]));
      }
      xs.sort(function (a, d) { return a - d; });
      for (var n = 0; n + 1 < xs.length; n += 2)
        for (var x = Math.ceil(xs[n]); x <= Math.floor(xs[n + 1]); x++) b.px(x, y, c);
    }
  }

  /* A tapered cylinder seen end-on: body, left rim light, right rim shadow.
     (xn,yn,wn) is the near end (bigger, lower), (xf,yf,wf) the far end. */
  function tube(b, xn, yn, wn, xf, yf, wf, rs, rn, t) {
    poly(b, [[xf - wf, yf], [xf + wf, yf], [xn + wn, yn], [xn - wn, yn]], sh(rs, rn, t));
    poly(b, [[xf - wf, yf], [xf - wf * 0.42, yf], [xn - wn * 0.42, yn], [xn - wn, yn]],
      sh(rs, rn, Math.min(1, t + 0.19)));
    poly(b, [[xf + wf * 0.50, yf], [xf + wf, yf], [xn + wn, yn], [xn + wn * 0.50, yn]],
      sh(rs, rn, Math.max(0.02, t - 0.13)));
  }

  /* Open muzzle: rim, then the dark bore inside it. */
  function bore(b, x, y, w, h, rs, rn) {
    b.ellipse(x, y, w, h, sh(rs || P.GRAY, rn || P.GRAY_N, 0.34));
    b.ellipse(x, y, w * 0.74, h * 0.72, sh(P.GRAY, P.GRAY_N, 0.10));
    b.ellipse(x, y, w * 0.46, h * 0.46, sh(P.GRAY, P.GRAY_N, 0.02));
  }

  /* Gloved hand gripping the weapon. `toward` is +1 if the gun is to the right
     of this hand, -1 if it is to the left — the fingers wrap that way. */
  function weaponHand(b, x, y, toward, rad) {
    var s = toward < 0 ? -1 : 1;
    var B = P.BROWN, BN = P.BROWN_N;
    poly(b, [[x - rad * 0.80, y + rad * 0.3], [x + rad * 0.80, y + rad * 0.3],
             [x + rad * 1.16 - s * 5, WH], [x - rad * 1.16 - s * 5, WH]], sh(B, BN, 0.12));
    poly(b, [[x - rad * 0.94, y + rad * 0.50], [x + rad * 0.94, y + rad * 0.50],
             [x + rad * 1.04, y + rad * 1.12], [x - rad * 1.04, y + rad * 1.12]], sh(B, BN, 0.23));
    blob(b, x, y, rad, rad * 0.84, B, BN, 0.31);
    b.ellipse(x - s * rad * 0.70, y + rad * 0.04, rad * 0.31, rad * 0.45, sh(B, BN, 0.43));
    for (var f = 0; f < 3; f++)
      b.ellipse(x + s * rad * 0.46, y - rad * 0.46 + f * rad * 0.40,
        rad * 0.31, rad * 0.21, sh(B, BN, 0.51 - f * 0.06));
    b.line(x - rad * 0.78, y + rad * 0.30, x + rad * 0.78, y + rad * 0.30, sh(B, BN, 0.10));
  }

  function muzzleFlash(b, x, y, size, rs, rn) {
    rs = rs || P.FIRE; rn = rn || P.FIRE_N;
    for (var i = 0; i < 9; i++) {
      var a = i * 0.698;
      var d = size * (i % 2 ? 1.0 : 0.55);
      b.thickLine(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, size * 0.20, sh(rs, rn, 0.72));
    }
    b.ellipse(x, y, size * 0.62, size * 0.62, sh(rs, rn, 0.90));
    b.ellipse(x, y, size * 0.38, size * 0.38, sh(rs, rn, 1.0));
    b.ellipse(x, y, size * 0.18, size * 0.18, 247);
  }

  /* --- 0. SIDEARM ---------------------------------------------------------- */
  function pistolSpr(k) {
    var b = new PixBuf(WW, WH);
    var kick = k === 1 ? 7 : (k === 2 ? 3 : 0);
    var slide = k === 1 ? 7 : (k === 2 ? 3 : 0);
    var G = P.GRAY, GN = P.GRAY_N;

    tube(b, 190, 104 + kick, 22, 184, 78 + kick, 17, G, GN, 0.19);
    for (var g = 0; g < 4; g++)
      b.line(167, 84 + g * 6 + kick, 205, 85 + g * 6 + kick, sh(G, GN, 0.08));
    b.frame(166, 76 + kick, 22, 15, sh(G, GN, 0.26));

    tube(b, 185, 80 + kick, 24, 177, 50 + kick + slide, 18, G, GN, 0.31);
    b.rect(190, 58 + kick, 8, 14, sh(G, GN, 0.06));
    for (var i2 = 0; i2 < 6; i2++)
      b.line(192, 62 + i2 * 4 + kick, 200, 63 + i2 * 4 + kick, sh(G, GN, 0.11));

    tube(b, 177, 52 + kick + slide, 15, 174, 40 + kick, 12, G, GN, 0.25);
    bore(b, 174, 40 + kick, 12, 5, G, GN);
    b.rect(171, 32 + kick, 5, 8, sh(G, GN, 0.47));
    b.rect(181, 48 + kick + slide, 8, 3, sh(G, GN, 0.44));

    weaponHand(b, 163, 97 + kick, 1, 18);
    weaponHand(b, 203, 91 + kick, -1, 19);

    if (k === 1) muzzleFlash(b, 174, 30, 30);
    else if (k === 2) {
      b.rect(206, 54, 9, 5, sh(P.GOLD, P.GOLD_N, 0.76));
      b.rect(211, 54, 4, 3, sh(P.GOLD, P.GOLD_N, 0.98));
    }
    return finish(b);
  }

  /* --- 1. SCATTERGUN ------------------------------------------------------- */
  function shotgunSpr(k) {
    var b = new PixBuf(WW, WH);
    var kick = [0, 9, 5, 2, 0][k];
    var slid = [0, 0, 0.62, 0.95, 0.34][k];              /* pump travel 0..1 */
    var G = P.GRAY, GN = P.GRAY_N, Wd = P.BROWN, WdN = P.BROWN_N;

    tube(b, 170, 104 + kick, 50, 165, 68 + kick, 37, G, GN, 0.25);
    b.line(130, 74 + kick, 122, 100 + kick, sh(G, GN, 0.40));
    b.line(201, 74 + kick, 212, 100 + kick, sh(G, GN, 0.09));
    b.rect(140, 80 + kick, 52, 5, sh(G, GN, 0.10));
    b.rect(146, 88 + kick, 40, 3, sh(G, GN, 0.34));

    tube(b, 176, 72 + kick, 13, 167, 44 + kick, 9, G, GN, 0.16);     /* magazine tube */
    tube(b, 165, 70 + kick, 18, 160, 32 + kick, 13, G, GN, 0.33);    /* barrel */
    bore(b, 160, 32 + kick, 13, 5, G, GN);
    b.rect(158, 24 + kick, 4, 7, sh(G, GN, 0.58));

    /* Pump grip rides the magazine tube between two keyframed positions. */
    var px0 = 174, py0 = 92, pw0 = 24, px1 = 168, py1 = 58, pw1 = 16;
    var cx = px0 + (px1 - px0) * slid, cy = py0 + (py1 - py0) * slid, cw = pw0 + (pw1 - pw0) * slid;
    tube(b, cx + 1, cy + 12 + kick, cw + 1, cx - 1, cy - 10 + kick, cw - 2, Wd, WdN, 0.35);
    for (var i = 0; i < 7; i++)
      b.line(cx - cw + 4 + i * (cw * 0.30), cy - 9 + kick, cx - cw + 2 + i * (cw * 0.30), cy + 11 + kick, sh(Wd, WdN, 0.13));

    weaponHand(b, cx - cw - 13, cy + 17 + kick, 1, 18);
    weaponHand(b, 214, 94 + kick, -1, 19);

    if (k === 3) {
      b.rect(222, 48, 10, 5, sh(P.RED, P.RED_N, 0.72));
      b.rect(229, 48, 3, 5, sh(P.GOLD, P.GOLD_N, 0.92));
    }
    if (k === 1) muzzleFlash(b, 160, 24, 38);
    return finish(b);
  }

  /* --- 2. AUTOCANNON ------------------------------------------------------- */
  function chaingunSpr(k) {
    var b = new PixBuf(WW, WH);
    var spin = k * 1.047, kick = (k === 1 || k === 3) ? 4 : 0;
    var G = P.GRAY, GN = P.GRAY_N;

    for (var i = 0; i < 7; i++) {                                   /* ammo belt */
      var lx = 96 - i * 9, ly = 80 + i * 6;
      b.rect(lx, ly, 12, 8, sh(P.GOLD, P.GOLD_N, 0.70 - i * 0.05));
      b.rect(lx + 1, ly, 10, 2, sh(P.GOLD, P.GOLD_N, 0.94));
    }
    tube(b, 160, 104 + kick, 58, 160, 66 + kick, 42, G, GN, 0.20);
    b.rect(144, 72 + kick, 32, 30, sh(G, GN, 0.07));
    b.rect(148, 76 + kick, 24, 6, sh(P.RED, P.RED_N, 0.55));

    /* Rotor disc goes down first so the barrels stand proud of it, then the
       barrels back-to-front, then the muzzle plate over their tips. */
    b.ellipse(160, 67 + kick, 42, 14, sh(G, GN, 0.22));
    b.ellipse(160, 67 + kick, 18, 8, sh(G, GN, 0.07));
    var order = [];
    for (var bl = 0; bl < 6; bl++) order.push(bl);
    order.sort(function (a, c) { return Math.cos(spin + a * 1.047) - Math.cos(spin + c * 1.047); });
    for (var n = 0; n < 6; n++) {
      var a2 = spin + order[n] * 1.047;
      var off = Math.sin(a2), dep = Math.cos(a2);
      tube(b, 160 + off * 28, 68 + kick + dep * 6, 9,
              160 + off * 15, 34 + kick + dep * 4, 6, G, GN, 0.10 + (dep + 1) * 0.23);
      b.ellipse(160 + off * 15, 34 + kick + dep * 4, 6, 2.6, sh(G, GN, 0.04));
    }
    b.ellipse(160, 34 + kick, 18, 6, sh(G, GN, 0.30));
    b.ellipse(160, 34 + kick, 13, 4, sh(G, GN, 0.13));

    weaponHand(b, 104, 96, 1, 19);
    weaponHand(b, 216, 96, -1, 19);
    if (k === 1 || k === 3) muzzleFlash(b, 160, 26, 34);
    return finish(b);
  }

  /* --- 3. ARC PROJECTOR ---------------------------------------------------- */
  function plasmaSpr(k) {
    var b = new PixBuf(WW, WH);
    var kick = k === 1 ? 5 : 0, G = P.GRAY, GN = P.GRAY_N;
    var glow = k === 1 ? 1.0 : (k === 2 ? 0.78 : 0.60);

    tube(b, 160, 104 + kick, 54, 160, 58 + kick, 36, G, GN, 0.22);
    tube(b, 160, 96 + kick, 28, 160, 64 + kick, 19, G, GN, 0.05);
    tube(b, 160, 93 + kick, 25, 160, 67 + kick, 16, P.CYAN, P.CYAN_N, glow * 0.70);
    for (var i = 0; i < 5; i++) {
      var t = i / 4;
      b.line(137 + t * 46, 92 + kick, 145 + t * 30, 68 + kick,
        sh(P.CYAN, P.CYAN_N, Math.min(1, glow + 0.16)));
    }
    tube(b, 160, 62 + kick, 34, 160, 38 + kick, 23, G, GN, 0.17);
    for (var s = -1; s <= 1; s += 2) {
      tube(b, 160 + s * 18, 40 + kick, 7, 160 + s * 28, 26 + kick, 5, G, GN, 0.28);
      b.ellipse(160 + s * 28, 26 + kick, 5.6, 4.4, sh(P.CYAN, P.CYAN_N, glow));
    }
    b.ellipse(160, 36 + kick, 14, 7, sh(P.CYAN, P.CYAN_N, glow * 0.52));
    b.ellipse(160, 36 + kick, 7, 4, sh(P.CYAN, P.CYAN_N, Math.min(1, glow + 0.2)));

    weaponHand(b, 100, 96, 1, 19);
    weaponHand(b, 220, 96, -1, 19);
    if (k === 1) {
      b.ellipse(160, 26, 24, 16, sh(P.CYAN, P.CYAN_N, 0.30));
      muzzleFlash(b, 160, 26, 30, P.CYAN, P.CYAN_N);
    }
    return finish(b);
  }

  /* --- 4. SIEGE LAUNCHER --------------------------------------------------- */
  function rocketSprGun(k) {
    var b = new PixBuf(WW, WH);
    var kick = k === 1 ? 8 : (k === 2 ? 3 : 0);
    var G = P.GRAY, GN = P.GRAY_N, Gr = P.GREEN, GrN = P.GREEN_N;

    tube(b, 164, 104 + kick, 52, 159, 42 + kick, 35, Gr, GrN, 0.23);
    b.line(126, 48 + kick, 114, 100 + kick, sh(Gr, GrN, 0.40));
    b.line(193, 48 + kick, 208, 100 + kick, sh(Gr, GrN, 0.08));
    bore(b, 159, 42 + kick, 35, 12, G, GN);
    if (k !== 1) b.ellipse(159, 42 + kick, 12, 5, sh(P.RED, P.RED_N, 0.60));

    tube(b, 160, 74 + kick, 10, 158, 46 + kick, 8, G, GN, 0.30);
    b.rect(155, 37 + kick, 5, 9, sh(G, GN, 0.44));
    poly(b, [[114, 64 + kick], [136, 60 + kick], [140, 90], [110, 96]], sh(G, GN, 0.22));
    b.rect(117, 70 + kick, 16, 11, sh(P.RED, P.RED_N, 0.60));
    b.rect(120, 72 + kick, 9, 7, sh(P.FIRE, P.FIRE_N, 0.92));
    b.line(124, 86 + kick, 198, 86 + kick, sh(P.GOLD, P.GOLD_N, 0.80));
    b.line(122, 92 + kick, 200, 92 + kick, sh(P.GRAY, P.GRAY_N, 0.04));

    weaponHand(b, 98, 98, 1, 19);
    weaponHand(b, 222, 98, -1, 19);
    if (k === 1) {
      muzzleFlash(b, 159, 32, 44);
      for (var n = 0; n < 12; n++)
        b.ellipse(110 + (n * 21) % 100, 100 - (n * 13) % 20, 3 + n % 3, 2 + n % 2, sh(P.GRAY, P.GRAY_N, 0.19));
    }
    return finish(b);
  }

  /* ==========================================================================
   * Status bar face — reacts to health, damage direction and pickups.
   * ========================================================================== */
  function face(tier, dir, mode) {
    var b = new PixBuf(24, 29);
    var F = P.FLESH, FN = P.FLESH_N;
    if (mode === 'dead') {
      b.ellipse(12, 17, 9, 8, sh(F, FN, 0.16));
      b.rect(3, 8, 18, 6, sh(P.BROWN, P.BROWN_N, 0.10));
      for (var x = 0; x < 2; x++) {
        var ex = 8 + x * 8;
        b.line(ex - 2, 14, ex + 2, 18, sh(P.GRAY, P.GRAY_N, 0.02));
        b.line(ex + 2, 14, ex - 2, 18, sh(P.GRAY, P.GRAY_N, 0.02));
      }
      b.rect(9, 22, 7, 2, sh(P.GRAY, P.GRAY_N, 0.02));
      for (var d = 0; d < 26; d++) b.px(2 + (d * 7) % 20, 4 + (d * 11) % 24, sh(P.BLOOD, P.BLOOD_N, 0.25 + (d % 5) * 0.1));
      return b;
    }
    /* head */
    b.ellipse(12, 15, 9.5, 11, sh(F, FN, 0.40));
    b.ellipse(10, 13, 7, 8, sh(F, FN, 0.52));
    b.rect(3, 3, 18, 8, sh(P.BROWN, P.BROWN_N, 0.22));         // hair
    b.rect(3, 3, 18, 2, sh(P.BROWN, P.BROWN_N, 0.34));
    b.line(3, 11, 20, 11, sh(P.BROWN, P.BROWN_N, 0.12));
    /* brow gets angrier as health drops */
    var anger = (4 - tier) * 0.5;
    for (var s = 0; s < 2; s++) {
      var bx = 6 + s * 8, sgn = s === 0 ? 1 : -1;
      b.line(bx - 3, 12 - anger * sgn * 0.6, bx + 3, 12 + anger * sgn * 0.6, sh(P.BROWN, P.BROWN_N, 0.10));
    }
    /* eyes look left / centre / right */
    var off = Math.round((dir - 1) * 1.6);
    for (var e = 0; e < 2; e++) {
      var ex2 = 7 + e * 9;
      b.ellipse(ex2, 15, 2.6, 2.2, sh(P.STONE, P.STONE_N, 0.95));
      b.rect(ex2 + off - 1, 14, 2, 3, sh(P.GRAY, P.GRAY_N, 0.04));
    }
    b.rect(11, 17, 3, 3, sh(F, FN, 0.26));                     // nose
    /* mouth */
    if (mode === 'grin') {
      b.rect(7, 22, 11, 3, sh(P.GRAY, P.GRAY_N, 0.02));
      for (var t2 = 0; t2 < 5; t2++) b.rect(8 + t2 * 2, 22, 1, 3, sh(P.STONE, P.STONE_N, 0.95));
    } else if (mode === 'ouch') {
      b.ellipse(12, 23, 4, 3, sh(P.GRAY, P.GRAY_N, 0.02));
      b.ellipse(12, 23, 2.4, 1.6, sh(P.BLOOD, P.BLOOD_N, 0.30));
    } else {
      var w = 9 - tier;
      b.rect(12 - w / 2, 22, w, 2, sh(P.GRAY, P.GRAY_N, 0.04));
      if (tier < 2) b.rect(12 - w / 2, 22, w, 1, sh(P.BLOOD, P.BLOOD_N, 0.30));
    }
    /* accumulating damage */
    var wounds = (4 - tier) * 6;
    for (var d2 = 0; d2 < wounds; d2++) {
      b.px(3 + (d2 * 5) % 18, 5 + (d2 * 9) % 22, sh(P.BLOOD, P.BLOOD_N, 0.22 + (d2 % 4) * 0.12));
    }
    return b;
  }

  /* ==========================================================================
   * Build everything
   * ========================================================================== */
  function creature(fn, size, rampS, rampN, deaths, seed) {
    var set = {
      walk: [], attack: [], pain: [], size: size,
      die: deathFrames(size, rampS, rampN, deaths, seed),
      exec: executeFrames(size, rampS, rampN, 6, seed + 5)
    };
    for (var f = 0; f < 4; f++) set.walk.push([fn(FRONT, 'walk', f), fn(SIDE, 'walk', f), fn(BACK, 'walk', f)]);
    for (var a = 0; a < 2; a++) set.attack.push([fn(FRONT, 'attack', a), fn(SIDE, 'attack', a), fn(BACK, 'attack', a)]);
    set.pain.push([fn(FRONT, 'pain', 0), fn(SIDE, 'pain', 0), fn(BACK, 'pain', 0)]);
    return set;
  }

  var Spr = {
    enemy: {
      grunt: creature(grunt, 64, P.GREEN, P.GREEN_N, 5, 11),
      imp: creature(imp, 64, P.BROWN, P.BROWN_N, 5, 22),
      demon: creature(demon, 64, P.FLESH, P.FLESH_N, 5, 33),
      baron: creature(baron, 96, P.PURPLE, P.PURPLE_N, 6, 44)
    },
    item: {
      stimpack: medkit(false),
      medkit: medkit(true),
      armour: armour(false),
      megaarmour: armour(true),
      clip: ammoBox('clip'),
      shells: ammoBox('shell'),
      cells: ammoBox('cell'),
      rockets: ammoBox('rocket'),
      keyRed: keycard(P.RED, P.RED_N),
      keyBlue: keycard(P.BLUE, P.BLUE_N),
      keyYellow: keycard(P.GOLD, P.GOLD_N),
      wShotgun: gunPickup('shotgun'),
      wChaingun: gunPickup('chaingun'),
      wPlasma: gunPickup('plasma'),
      wRocket: gunPickup('rocket')
    },
    decor: {
      barrel: barrel(),
      lamp: lamp(),
      pole: gore('pole'),
      gore: gore('pile')
    },
    fx: {
      fireball: [fireball(0, P.FIRE, P.FIRE_N), fireball(1, P.FIRE, P.FIRE_N), fireball(2, P.FIRE, P.FIRE_N)],
      hellball: [fireball(0, P.GREEN, P.GREEN_N), fireball(1, P.GREEN, P.GREEN_N), fireball(2, P.GREEN, P.GREEN_N)],
      plasma: [plasmaBall(0), plasmaBall(1), plasmaBall(2), plasmaBall(3)],
      rocket: [rocketSpr(0), rocketSpr(1)],
      explosion: [],
      blood: [puff(0, P.BLOOD, P.BLOOD_N), puff(1, P.BLOOD, P.BLOOD_N), puff(2, P.BLOOD, P.BLOOD_N), puff(3, P.BLOOD, P.BLOOD_N)],
      spark: [puff(0, P.GRAY, P.GRAY_N), puff(1, P.GRAY, P.GRAY_N), puff(2, P.GRAY, P.GRAY_N)],
      zap: [puff(0, P.CYAN, P.CYAN_N), puff(1, P.CYAN, P.CYAN_N), puff(2, P.CYAN, P.CYAN_N)],
      execute: []
    },
    orb: { health: [], chrono: [] },
    gib: [],
    weapon: {},
    faces: {},
    FRONT: FRONT, SIDE: SIDE, BACK: BACK
  };

  for (var e = 0; e < 7; e++) Spr.fx.explosion.push(explosion(e, 7));
  for (var xb = 0; xb < 6; xb++) Spr.fx.execute.push(executeBurst(xb, 6));
  for (var gb = 0; gb < 5; gb++) Spr.gib.push(gibSpr(gb));
  for (var ob = 0; ob < 4; ob++) {
    Spr.orb.health.push(orbSpr(ob, P.RED, P.RED_N));
    Spr.orb.chrono.push(orbSpr(ob, P.CYAN, P.CYAN_N));
  }

  Spr.weapon.pistol = [pistolSpr(0), pistolSpr(1), pistolSpr(2)];
  Spr.weapon.shotgun = [shotgunSpr(0), shotgunSpr(1), shotgunSpr(2), shotgunSpr(3), shotgunSpr(4)];
  Spr.weapon.chaingun = [chaingunSpr(0), chaingunSpr(1), chaingunSpr(2), chaingunSpr(3)];
  Spr.weapon.plasma = [plasmaSpr(0), plasmaSpr(1), plasmaSpr(2)];
  Spr.weapon.rocket = [rocketSprGun(0), rocketSprGun(1), rocketSprGun(2)];

  Spr.faces.normal = [];
  for (var t = 0; t < 5; t++) {
    var row = [];
    for (var d3 = 0; d3 < 3; d3++) row.push(face(t, d3, 'normal'));
    Spr.faces.normal.push(row);
  }
  Spr.faces.ouch = [];
  Spr.faces.grin = [];
  for (var t2 = 0; t2 < 5; t2++) {
    Spr.faces.ouch.push(face(t2, 1, 'ouch'));
    Spr.faces.grin.push(face(t2, 1, 'grin'));
  }
  Spr.faces.dead = face(0, 1, 'dead');

  global.Spr = Spr;
})(window);
