/* =============================================================================
 * hud.js — bitmap font, heads-up display, automap and full screen overlays.
 * ============================================================================= */
(function (global) {
  'use strict';

  var Pal = global.Pal, P = Pal.P, PixBuf = global.PixBuf, Spr = global.Spr, rng = global.rng;
  var sh = Pal.shade;

  /* ---- 5x7 bitmap font ---------------------------------------------------- */
  var GLYPHS = {
    'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11], 'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
    'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E], 'D': [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
    'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F], 'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
    'G': [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F], 'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
    'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E], 'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
    'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], 'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
    'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11], 'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
    'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D], 'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
    'S': [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E], 'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
    'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11], 'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
    'Y': [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04], 'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
    '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E], '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
    '2': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F], '3': [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
    '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02], '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
    '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E], '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E], '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
    ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0x0C, 0x0C], ',': [0, 0, 0, 0, 0x0C, 0x0C, 0x08],
    '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04], '?': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
    '-': [0, 0, 0, 0x1F, 0, 0, 0], ':': [0, 0x0C, 0x0C, 0, 0x0C, 0x0C, 0], "'": [0x04, 0x04, 0, 0, 0, 0, 0],
    '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10], '%': [0x11, 0x12, 0x04, 0x04, 0x08, 0x09, 0x11],
    '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02], ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
    '+': [0, 0x04, 0x04, 0x1F, 0x04, 0x04, 0], '*': [0, 0x0A, 0x04, 0x1F, 0x04, 0x0A, 0],
    '=': [0, 0, 0x1F, 0, 0x1F, 0, 0], '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
    '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02], '#': [0x0A, 0x0A, 0x1F, 0x0A, 0x1F, 0x0A, 0x0A],
    '[': [0x0E, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0E], ']': [0x0E, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0E],
    '_': [0, 0, 0, 0, 0, 0, 0x1F], '|': [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04]
  };

  function textWidth(s, scale) { scale = scale || 1; return s.length * 6 * scale - scale; }

  function drawText(r, s, x, y, colour, scale, shadow) {
    scale = scale || 1;
    s = String(s).toUpperCase();
    for (var i = 0; i < s.length; i++) {
      var g = GLYPHS[s[i]] || GLYPHS['?'];
      var gx = x + i * 6 * scale;
      for (var row = 0; row < 7; row++) {
        var bits = g[row];
        if (!bits) continue;
        for (var col = 0; col < 5; col++) {
          if (!(bits & (0x10 >> col))) continue;
          if (shadow !== false) r.rect(gx + col * scale + scale, y + row * scale + scale, scale, scale, sh(P.GRAY, P.GRAY_N, 0.02));
          r.rect(gx + col * scale, y + row * scale, scale, scale, colour);
        }
      }
    }
  }

  function drawTextCentre(r, s, cx, y, colour, scale, shadow) {
    drawText(r, s, cx - textWidth(s, scale) / 2, y, colour, scale, shadow);
  }

  /* ---- large readout digits ---------------------------------------------- */
  var BIGS = 3;                                             /* pixel scale */
  var BIGCACHE = {};

  /* Built per colour ramp on demand — health, ammo and score each want a
     different one, and there are only a handful of ramps in play. */
  function bigSet(rs, rn) {
    var key = rs + '_' + rn;
    if (BIGCACHE[key]) return BIGCACHE[key];
    var set = {}, chars = '0123456789%-';
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      var g = GLYPHS[c] || GLYPHS['?'];
      var b = new PixBuf(5 * BIGS + 2, 7 * BIGS + 2);
      for (var row = 0; row < 7; row++) {
        for (var col = 0; col < 5; col++) {
          if (!(g[row] & (0x10 >> col))) continue;
          for (var yy = 0; yy < BIGS; yy++)
            for (var xx = 0; xx < BIGS; xx++) {
              var t = 0.98 - (row * BIGS + yy) / (7 * BIGS) * 0.42;
              b.px(col * BIGS + xx + 1, row * BIGS + yy + 1, sh(rs, rn, t));
            }
        }
      }
      b.outline(sh(P.GRAY, P.GRAY_N, 0.02));
      set[c] = b;
    }
    BIGCACHE[key] = set;
    return set;
  }

  function drawBig(r, s, rightX, y, rs, rn) {
    var set = bigSet(rs === undefined ? P.RED : rs, rn === undefined ? P.RED_N : rn);
    s = String(s);
    var w = 0, i;
    for (i = 0; i < s.length; i++) w += (set[s[i]] ? set[s[i]].w : 8) + 1;
    var x = rightX - w;
    for (i = 0; i < s.length; i++) {
      var b = set[s[i]];
      if (b) { r.blit(b, x, y, 0, 1, true); x += b.w + 1; }
      else x += 9;
    }
  }

  /* ---- key icons ---------------------------------------------------------- */
  function keyIcon(rs, rn) {
    var b = new PixBuf(9, 6);
    b.rect(0, 0, 9, 6, sh(rs, rn, 0.70));
    b.rect(0, 0, 9, 1, sh(rs, rn, 0.98));
    b.rect(3, 2, 4, 2, sh(P.GRAY, P.GRAY_N, 0.88));
    b.frame(0, 0, 9, 6, sh(rs, rn, 0.20));
    return b;
  }
  var KEYICON = { red: keyIcon(P.RED, P.RED_N), blue: keyIcon(P.BLUE, P.BLUE_N), yellow: keyIcon(P.GOLD, P.GOLD_N) };

  /* ==========================================================================
   * Heads-up display.
   *
   * No status bar. The whole 320x200 is the world; readouts sit in the corners
   * where they stay out of the fight, and the two things you have to watch
   * moment to moment — chrono and the kill chain — get the centre.
   * ========================================================================== */

  /* Segmented meter. Segments read faster than a smooth bar at this size. */
  function meter(r, x, y, w, h, frac, rs, rn, segs) {
    r.rect(x - 1, y - 1, w + 2, h + 2, sh(P.GRAY, P.GRAY_N, 0.03));
    r.rect(x, y, w, h, sh(P.GRAY, P.GRAY_N, 0.09));
    segs = segs || 1;
    if (segs > 1) {
      var sw = w / segs;
      for (var i = 0; i < segs; i++) {
        var lo = i / segs, hi = (i + 1) / segs;
        var f = Math.max(0, Math.min(1, (frac - lo) / (hi - lo)));
        if (f <= 0) continue;
        r.rect(x + i * sw, y, Math.max(1, (sw - 1) * f), h, sh(rs, rn, 0.55 + 0.4 * f));
      }
    } else if (frac > 0) {
      r.rect(x, y, Math.max(1, w * frac), h, sh(rs, rn, 0.9));
    }
  }

  function fmtClock(s) {
    s = Math.max(0, s);
    var whole = Math.floor(s);
    return whole + '.' + Math.floor((s - whole) * 10);
  }

  function drawHud(r, game) {
    var p = game.player, W = r.W, H = r.viewH;
    var base = game.weapons[p.weapon];
    var dim = sh(P.STONE, P.STONE_N, 0.46);

    /* ---- THE CLOCK: dead centre bottom, the only number that matters ---- */
    var urgent = p.clock < 15;
    var crit = p.clock < 8;
    var cRamp = crit ? P.RED : (urgent ? P.ORANGE : (game.chronoActive ? P.FIRE : P.CYAN));
    var cRampN = crit ? P.RED_N : (urgent ? P.ORANGE_N : (game.chronoActive ? P.FIRE_N : P.CYAN_N));
    var beat = urgent ? 1 + Math.sin(game.stateTime * (crit ? 16 : 9)) * 0.5 : 0;

    var clockTxt = fmtClock(p.clock);
    var cw2 = clockTxt.length * 18;
    drawBig(r, clockTxt, (W >> 1) + cw2 / 2, H - 34, cRamp, cRampN);
    drawTextCentre(r, 'SECONDS', W / 2, H - 12, sh(cRamp, cRampN, 0.45 + beat * 0.25), 1);
    var bw = 104;
    meter(r, (W - bw) >> 1, H - 4, bw, 3, Math.min(1, p.clock / 90), cRamp, cRampN, 6);

    /* time just gained flashes above the clock */
    if (game.timeFlash > 0)
      drawTextCentre(r, '+TIME', W / 2, H - 44, sh(P.CYAN, P.CYAN_N, Math.min(1, game.timeFlash)), 1);

    /* ---- bottom left: shield and dash ---- */
    if (p.shield > 0) {
      drawText(r, 'SHIELD', 6, H - 34, dim, 1);
      meter(r, 6, H - 25, 52, 4, Math.min(1, p.shield / 100), P.BLUE, P.BLUE_N, 5);
    }
    drawText(r, 'DASH', 6, H - 16, dim, 1);
    for (var d = 0; d < p.dashMax; d++) {
      var dx = 6 + d * 12;
      var ready = d < p.dash;
      r.rect(dx, H - 7, 10, 4, ready ? sh(P.CYAN, P.CYAN_N, 0.92) : sh(P.GRAY, P.GRAY_N, 0.11));
      if (!ready && d === p.dash)
        r.rect(dx, H - 7, Math.max(1, 10 * (p.dashRecharge / 1.9)), 4, sh(P.CYAN, P.CYAN_N, 0.36));
    }

    /* ---- bottom right: weapon and ammo ---- */
    var ammoTxt = base.ammo ? String(p.ammo[base.ammo]) : '--';
    var lowAmmo = base.ammo && p.ammo[base.ammo] <= 5;
    drawBig(r, ammoTxt, W - 6, H - 34, lowAmmo ? P.RED : P.GOLD, lowAmmo ? P.RED_N : P.GOLD_N);
    drawText(r, base.name, W - 6 - textWidth(base.name, 1), H - 8, sh(P.STONE, P.STONE_N, 0.80), 1);
    if (base.alt) {
      var altTxt = 'RMB ' + base.alt.name;
      var canAlt = !base.ammo || p.ammo[base.ammo] >= base.alt.use;
      drawText(r, altTxt, W - 6 - textWidth(altTxt, 1), H - 16,
        canAlt ? sh(P.CYAN, P.CYAN_N, 0.74) : sh(P.GRAY, P.GRAY_N, 0.30), 1);
    }
    for (var s = 0; s < 5; s++) {
      var px = W - 6 - (5 - s) * 9;
      r.rect(px, H - 43, 7, 5, s === p.weapon ? sh(P.CYAN, P.CYAN_N, 0.95)
        : (p.has[s] ? sh(P.STONE, P.STONE_N, 0.40) : sh(P.GRAY, P.GRAY_N, 0.09)));
    }

    /* ---- chrono state ---- */
    if (game.chronoActive)
      drawTextCentre(r, '>> TIME DILATED - BURNING CLOCK <<', W / 2, 40,
        sh(P.FIRE, P.FIRE_N, 0.7 + Math.sin(game.stateTime * 10) * 0.25), 1);

    /* ---- top centre: kill chain ---- */
    if (p.combo > 0) {
      var rk = game.ranks[p.rank];
      var big = p.rank >= 3;
      var pulse = Math.min(1, 0.74 + game.rankFlash * 0.26 + Math.sin(game.stateTime * 9) * 0.05);
      drawTextCentre(r, rk.name + '  X' + rk.mult.toFixed(2), W / 2, 5, sh(rk.ramp, rk.rampN, pulse), big ? 2 : 1);
      var cbw = 70, cby = big ? 24 : 15;
      meter(r, (W - cbw) >> 1, cby, cbw, 3, Math.max(0, p.comboTimer / 4.5), rk.ramp, rk.rampN, 1);
      drawTextCentre(r, p.combo + ' CHAIN  -  KILLS WORTH X' + rk.mult.toFixed(2) + ' TIME',
        W / 2, cby + 6, sh(rk.ramp, rk.rampN, 0.62), 1);
    }

    /* ---- top left: score, top right: keys ---- */
    drawText(r, String(p.score), 6, 5, sh(P.GOLD, P.GOLD_N, 0.76), 1);
    var kx = W - 6;
    ['red', 'yellow', 'blue'].forEach(function (k) {
      if (!p.keys[k]) return;
      kx -= 11;
      r.blit(KEYICON[k], kx, 5, 0, 1, true);
    });

    /* ---- execution prompt ---- */
    if (game.nearestStagger && game.nearestStagger()) {
      var f = 0.60 + Math.sin(game.stateTime * 12) * 0.34;
      drawTextCentre(r, 'EXECUTE [F]   +' + game.timeValue('execute').toFixed(0) + ' SEC',
        W / 2, (H >> 1) + 24, sh(P.CYAN, P.CYAN_N, f), 1);
    }

    if (game.tutorialText) {
      var tf = 0.62 + Math.sin(game.stateTime * 5) * 0.22;
      drawTextCentre(r, game.tutorialText, W / 2, (H >> 1) - 44, sh(P.GOLD, P.GOLD_N, tf), 1);
    }
  }

  /* Floating feedback near the crosshair: rank ups, executions, alt-fire names. */
  function drawPopups(r, game) {
    for (var i = 0; i < game.popups.length; i++) {
      var q = game.popups[i];
      var a = Math.min(1, q.life / 0.5);
      var y = (r.viewH >> 1) - 34 - i * 10 - (1.6 - q.life) * 5;
      drawTextCentre(r, q.text, r.W / 2, y, sh(q.ramp, q.rampN, 0.35 + a * 0.6), 1);
    }
  }

  /* ==========================================================================
   * Messages
   * ========================================================================== */
  function drawMessages(r, game) {
    var msgs = game.messages;
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      var a = Math.min(1, m.life);
      var col = a > 0.35 ? sh(P.STONE, P.STONE_N, 0.95) : sh(P.STONE, P.STONE_N, 0.45);
      var y = 4 + i * 10, tw = textWidth(m.text, 1);
      r.rect(3, y - 2, tw + 8, 10, sh(P.GRAY, P.GRAY_N, 0.035));
      r.rect(3, y - 2, 2, 10, sh(P.ORANGE, P.ORANGE_N, 0.72));
      drawText(r, m.text, 8, y, col, 1);
    }
  }

  /* ==========================================================================
   * Automap
   * ========================================================================== */
  function drawAutomap(r, game) {
    var W = r.W, vh = r.viewH, world = game.world, p = game.player;
    r.rect(0, 0, W, vh, sh(P.GRAY, P.GRAY_N, 0.02));

    var scale = game.mapZoom;
    var cx = W / 2, cy = vh / 2;
    var ca = Math.cos(-p.angle - Math.PI / 2), sa = Math.sin(-p.angle - Math.PI / 2);

    function proj(wx, wy) {
      var dx = wx - p.x, dy = wy - p.y;
      return [cx + (dx * ca - dy * sa) * scale, cy + (dx * sa + dy * ca) * scale];
    }

    var wallCol = sh(P.RED, P.RED_N, 0.62);
    var doorCol = sh(P.GOLD, P.GOLD_N, 0.85);
    var seenCol = sh(P.BROWN, P.BROWN_N, 0.42);

    for (var y = 0; y < world.h; y++) {
      for (var x = 0; x < world.w; x++) {
        var i = y * world.w + x;
        if (!world.seen[i]) continue;
        var t = world.type[i];
        if (t === 0) continue;
        /* draw only the faces that touch open, seen space */
        var col = t === 2 ? doorCol : (world.wtex[i] === global.Tex.W.EXIT ? sh(P.GREEN, P.GREEN_N, 0.9) : wallCol);
        var edges = [
          [x, y, x + 1, y, x, y - 1],
          [x + 1, y, x + 1, y + 1, x + 1, y],
          [x, y + 1, x + 1, y + 1, x, y + 1],
          [x, y, x, y + 1, x - 1, y]
        ];
        for (var e = 0; e < edges.length; e++) {
          var ed = edges[e];
          var nx = ed[4], ny = ed[5];
          if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
          if (world.type[ny * world.w + nx] !== 0) continue;
          if (!world.seen[ny * world.w + nx]) continue;
          var a = proj(ed[0], ed[1]), b = proj(ed[2], ed[3]);
          r.line(a[0], a[1], b[0], b[1], col);
        }
      }
    }

    /* pickups worth remembering */
    for (var n = 0; n < game.entities.length; n++) {
      var ent = game.entities[n];
      var ti = (ent.y | 0) * world.w + (ent.x | 0);
      if (!world.seen[ti]) continue;
      var c = null;
      if (ent.kind === 'item') {
        if (ent.type === 'keyRed') c = sh(P.RED, P.RED_N, 1);
        else if (ent.type === 'keyBlue') c = sh(P.BLUE, P.BLUE_N, 1);
        else if (ent.type === 'keyYellow') c = sh(P.GOLD, P.GOLD_N, 1);
        else if (ent.type.charAt(0) === 'w') c = sh(P.CYAN, P.CYAN_N, 0.9);
      } else if (ent.kind === 'enemy' && game.cheatMap) c = sh(P.GREEN, P.GREEN_N, 0.9);
      if (c) { var q = proj(ent.x, ent.y); r.rect(q[0] - 1, q[1] - 1, 3, 3, c); }
    }

    /* player arrow */
    var col2 = sh(P.STONE, P.STONE_N, 0.98);
    var pts = [[0, -7], [4, 5], [0, 2], [-4, 5]];
    for (var k = 0; k < pts.length; k++) {
      var a1 = pts[k], b1 = pts[(k + 1) % pts.length];
      r.line(cx + a1[0], cy + a1[1], cx + b1[0], cy + b1[1], col2);
    }

    drawText(r, game.level.name, 4, vh - 12, sh(P.STONE, P.STONE_N, 0.9), 1);
    var pct = Math.round(game.stats.kills / Math.max(1, game.stats.totalKills) * 100);
    drawText(r, 'KILLS ' + pct + '%   SECRETS ' + game.stats.secrets + '/' + game.stats.totalSecrets,
      4, vh - 22, sh(P.STONE, P.STONE_N, 0.7), 1);
  }

  /* ==========================================================================
   * Full screen overlays
   * ========================================================================== */
  function panel(r, x, y, w, h) {
    r.rect(x, y, w, h, sh(P.GRAY, P.GRAY_N, 0.05));
    r.rect(x, y, w, 1, sh(P.BROWN, P.BROWN_N, 0.50));
    r.rect(x, y + h - 1, w, 1, sh(P.BROWN, P.BROWN_N, 0.16));
    r.rect(x, y, 1, h, sh(P.BROWN, P.BROWN_N, 0.50));
    r.rect(x + w - 1, y, 1, h, sh(P.BROWN, P.BROWN_N, 0.16));
  }

  function drawTitle(r, game, t) {
    var W = r.W, cx = W / 2;
    r.tint(0, 0, 0, 0.60, 0, r.viewH);
    var pulse = 0.76 + Math.sin(t * 2.4) * 0.22;
    drawTextCentre(r, 'OVERCLOCK', cx, 22, sh(P.CYAN, P.CYAN_N, pulse), 4);
    drawTextCentre(r, 'YOU HAVE NO HEALTH. YOU HAVE A CLOCK.', cx, 52,
      sh(P.STONE, P.STONE_N, 0.74), 1);
    drawTextCentre(r, 'IT ONLY FALLS. KILL TO WIND IT BACK UP.', cx, 62,
      sh(P.CYAN, P.CYAN_N, 0.66), 1);

    panel(r, cx - 116, 76, 232, 56);
    var items = game.menuItems;
    for (var i = 0; i < items.length; i++) {
      var sel = i === game.menuIndex;
      var col = sel ? sh(P.CYAN, P.CYAN_N, 0.74 + Math.sin(t * 8) * 0.24) : sh(P.STONE, P.STONE_N, 0.44);
      var y = 81 + i * 16;
      drawTextCentre(r, items[i], cx, y, col, 2);
      if (sel) {
        drawText(r, '>', cx - 108, y, col, 2);
        drawText(r, '<', cx + 98, y, col, 2);

      }
    }
    drawTextCentre(r, game.difficultyBlurb(game.menuIndex), cx, 136, sh(P.STONE, P.STONE_N, 0.42), 1);
    drawTextCentre(r, 'ARROWS CHOOSE  -  ENTER OR CLICK TO DROP IN', cx, 147,
      sh(P.STONE, P.STONE_N, 0.46), 1);

    var rows = [
      ['WASD MOVE', 'MOUSE LOOK', 'LMB FIRE', 'RMB ALT-FIRE'],
      ['SHIFT CHRONO', 'SPACE DASH', 'F EXECUTE', 'E DOORS'],
      ['1-5 WEAPONS', 'TAB MAP', 'ESC PAUSE', 'V FILTER']
    ];
    for (var q = 0; q < rows.length; q++)
      drawTextCentre(r, rows[q].join('   '), cx, 162 + q * 9,
        sh(q === 1 ? P.CYAN : P.STONE, q === 1 ? P.CYAN_N : P.STONE_N, q === 1 ? 0.52 : 0.36), 1);
  }

  function drawIntermission(r, game, t) {
    var W = r.W;
    r.tint(0, 0, 0, 0.72);
    drawTextCentre(r, game.level.name, W / 2, 16, sh(P.RED, P.RED_N, 0.9), 2);
    drawTextCentre(r, 'FINISHED', W / 2, 34, sh(P.BROWN, P.BROWN_N, 0.8), 1);

    panel(r, 46, 44, 228, 100);
    var s = game.stats;
    var rows = [
      ['KILLS', s.kills + ' / ' + s.totalKills, pct(s.kills, s.totalKills)],
      ['ITEMS', s.items + ' / ' + s.totalItems, pct(s.items, s.totalItems)],
      ['SECRETS', s.secrets + ' / ' + s.totalSecrets, pct(s.secrets, s.totalSecrets)],
      ['TIME', fmtTime(s.time), 'PAR ' + fmtTime(game.level.par)],
      ['BEST CHAIN', String(game.player.bestCombo), game.player.executes + ' EXEC'],
      ['TIME BANKED', Math.round(game.player.timeGained) + 'S', Math.round(game.player.clock) + 'S LEFT']
    ];
    for (var i = 0; i < rows.length; i++) {
      var y = 56 + i * 16;
      var reveal = t > 0.35 + i * 0.35;
      drawText(r, rows[i][0], 64, y, sh(P.GOLD, P.GOLD_N, 0.85), 1);
      if (reveal) {
        drawText(r, rows[i][1], 150, y, sh(P.STONE, P.STONE_N, 0.92), 1);
        drawText(r, rows[i][2], 214, y, sh(P.BROWN, P.BROWN_N, 0.75), 1);
      }
    }
    if (t > 2.2) drawTextCentre(r, 'PRESS ENTER TO CONTINUE', W / 2, 152,
      sh(P.GOLD, P.GOLD_N, 0.6 + Math.sin(t * 7) * 0.3), 1);
  }

  function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '100%'; }
  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function drawGameOver(r, game, t) {
    var W = r.W;
    r.tint(60, 0, 0, Math.min(0.7, t * 0.4));
    drawTextCentre(r, 'TIME OUT', W / 2, 50, sh(P.RED, P.RED_N, 0.95), 4);
    if (t > 1.2) {
      drawTextCentre(r, 'THE CLOCK REACHED ZERO. KILL FASTER.', W / 2, 84, sh(P.STONE, P.STONE_N, 0.62), 1);
      drawTextCentre(r, 'PRESS ENTER TO TRY AGAIN', W / 2, 104,
        sh(P.GOLD, P.GOLD_N, 0.6 + Math.sin(t * 7) * 0.3), 1);
    }
  }

  function drawVictory(r, game, t) {
    var W = r.W;
    r.tint(0, 0, 0, 0.72);
    drawTextCentre(r, 'CLOCK STOPPED', W / 2, 22, sh(P.CYAN, P.CYAN_N, 0.9), 3);
    var lines = [
      'THE CORE GOES QUIET. THE STATION CLOCK RESETS.',
      '',
      'YOU WALK OUT AT NORMAL SPEED FOR THE FIRST TIME',
      'IN HOURS, AND IT FEELS UNBEARABLY SLOW.',
      '',
      'TOTAL SCORE    ' + game.player.score,
      'BEST CHAIN     ' + game.player.bestCombo,
      'EXECUTIONS     ' + game.player.executes,
      'TOTAL TIME     ' + fmtTime(game.totalTime),
      'PROTOCOL       ' + game.difficultyName()
    ];
    for (var i = 0; i < lines.length; i++) {
      if (t < 0.4 + i * 0.28) break;
      drawTextCentre(r, lines[i], W / 2, 52 + i * 11,
        i >= 5 ? sh(P.CYAN, P.CYAN_N, 0.85) : sh(P.STONE, P.STONE_N, 0.85), 1);
    }
    if (t > 3.4) drawTextCentre(r, 'PRESS ENTER', W / 2, r.viewH - 14,
      sh(P.GOLD, P.GOLD_N, 0.6 + Math.sin(t * 7) * 0.3), 1);
  }

  function drawPaused(r, game, t) {
    r.tint(0, 0, 0, 0.62);
    drawTextCentre(r, 'PAUSED', r.W / 2, 28, sh(P.CYAN, P.CYAN_N, 0.9), 3);
    var left = [
      'WASD      MOVE',
      'MOUSE     LOOK',
      'LMB       FIRE',
      'RMB       ALT-FIRE',
      'SHIFT     CHRONO SURGE',
      'SPACE     DASH',
      'F         EXECUTE'
    ];
    var right = [
      'E         DOORS / SWITCHES',
      '1-5       WEAPONS',
      'TAB       MAP    +/- ZOOM',
      'M / N     MUSIC / SOUND',
      'V         CRT FILTER ' + (game.crtEnabled ? 'ON' : 'OFF'),
      'R         RESTART SECTOR',
      'Q         QUIT TO TITLE'
    ];
    for (var i = 0; i < left.length; i++) {
      drawText(r, left[i], 16, 58 + i * 10, sh(P.STONE, P.STONE_N, 0.62), 1);
      drawText(r, right[i], 164, 58 + i * 10, sh(P.STONE, P.STONE_N, 0.62), 1);
    }
    drawTextCentre(r, 'ESC OR CLICK TO RESUME', r.W / 2, 178, sh(P.CYAN, P.CYAN_N, 0.5 + Math.sin(t * 6) * 0.25), 1);
  }

  function drawLevelIntro(r, game, t) {
    var a = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.9);
    if (a <= 0) return;
    r.tint(0, 0, 0, a * 0.45, 0, r.viewH);
    panel(r, 34, 52, 252, 48);
    r.rect(34, 52, 3, 48, sh(P.ORANGE, P.ORANGE_N, 0.78));
    drawTextCentre(r, 'MISSION START', r.W / 2, 58, sh(P.GOLD, P.GOLD_N, 0.72), 1);
    drawTextCentre(r, game.level.name, r.W / 2, 70, sh(P.RED, P.RED_N, 0.95 * a + 0.05), 2);
    drawTextCentre(r, game.level.subtitle, r.W / 2, 88, sh(P.STONE, P.STONE_N, 0.78 * a), 1);
  }

  function drawCrosshair(r, game) {
    if (!game.crosshair) return;
    var cx = r.W >> 1, cy = (r.viewH >> 1) + Math.round(game.cam.pitch);
    var hit = game.hitMarker > 0;
    var c = hit ? sh(P.RED, P.RED_N, 0.98) : sh(P.STONE, P.STONE_N, 0.86);
    var gap = 2 + Math.round((game.shotPulse || 0) * 2);
    r.rect(cx, cy, 1, 1, c);
    r.rect(cx, cy - gap - 3, 1, 3, c);
    r.rect(cx, cy + gap + 1, 1, 3, c);
    r.rect(cx - gap - 3, cy, 3, 1, c);
    r.rect(cx + gap + 1, cy, 3, 1, c);
    if (hit) {
      r.line(cx - 6, cy - 6, cx - 4, cy - 4, c);
      r.line(cx + 6, cy - 6, cx + 4, cy - 4, c);
      r.line(cx - 6, cy + 6, cx - 4, cy + 4, c);
      r.line(cx + 6, cy + 6, cx + 4, cy + 4, c);
    }
  }

  global.Hud = {
    drawText: drawText, drawTextCentre: drawTextCentre, textWidth: textWidth,
    drawHud: drawHud, drawPopups: drawPopups, drawMessages: drawMessages, drawAutomap: drawAutomap,
    drawTitle: drawTitle, drawIntermission: drawIntermission, drawGameOver: drawGameOver,
    drawVictory: drawVictory, drawPaused: drawPaused, drawLevelIntro: drawLevelIntro,
    drawCrosshair: drawCrosshair, fmtTime: fmtTime
  };
})(window);
