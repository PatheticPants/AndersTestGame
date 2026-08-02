/* =============================================================================
 * levels.js — the campaign.
 *
 * Levels are declared as rectangles rather than hand typed ASCII. Two reasons:
 * geometry is guaranteed valid (no typo can wall off a room), and the layout
 * you read in the source is the layout you walk.
 *
 * The shape is deliberately a gauntlet, not a maze. A countdown for a health
 * bar and a Doom style key hunt actively fight each other: wandering lost is
 * the one thing the clock cannot forgive, and enemies spread thin across a big
 * map means you can never earn enough time back. So every level is a straight
 * line of arenas joined by short halls. Walk into an arena, the gate on the far
 * side seals, and it only opens when the room is dead.
 * ============================================================================= */
(function (global) {
  'use strict';

  var W = global.Tex.W, F = global.Tex.F;

  /* Solid tiles ------------------------------------------------------------- */
  var WALLS = {
    '#': { tex: W.TECH },
    'B': { tex: W.BRICK },
    'S': { tex: W.STONE },
    'M': { tex: W.METAL },
    'R': { tex: W.RUST },
    'F': { tex: W.FLESH },
    'P': { tex: W.SUPPORT },
    'H': { tex: W.HAZARD },
    'L': { tex: W.LIGHTWALL },
    'C': { tex: W.COMPUTER },
    'D': { tex: W.DOOR, door: true },
    'G': { tex: W.DOOR_RED, door: true, gate: true },
    'r': { tex: W.DOOR_RED, door: true, key: 'red' },
    'b': { tex: W.DOOR_BLUE, door: true, key: 'blue' },
    'y': { tex: W.DOOR_YELLOW, door: true, key: 'yellow' },
    '%': { tex: W.STONE, door: true, secret: true },
    'X': { tex: W.EXIT, exit: true }
  };

  /* Open tiles -------------------------------------------------------------- */
  var FLOORS = {
    '.': { floor: F.TILE, ceil: F.CEIL, light: 0 },
    '-': { floor: F.TILE, ceil: F.CEILLIGHT, light: -4 },
    ',': { floor: F.METAL, ceil: F.CEIL, light: 1 },
    '"': { floor: F.METAL, ceil: F.CEILLIGHT, light: -4 },
    ':': { floor: F.GRATE, ceil: F.CEIL, light: 2 },
    ';': { floor: F.ROCK, ceil: F.CEILROCK, light: 2 },
    '*': { floor: F.ROCK, ceil: F.CEILROCK, light: 3 },
    '_': { floor: F.ROCK, ceil: -1, light: -3, sky: true },
    '~': { floor: F.SLIME, ceil: F.CEIL, light: 1, damage: 4 },
    '=': { floor: F.LAVA, ceil: F.CEILROCK, light: -2, damage: 12 },
    '+': { floor: F.BLOOD, ceil: F.CEIL, light: 3 }
  };

  /* ==========================================================================
   * Rect carver
   * ========================================================================== */
  function carve(def) {
    var g = [], y, x;
    for (y = 0; y < def.h; y++) {
      var row = [];
      for (x = 0; x < def.w; x++) row.push(def.wall || '#');
      g.push(row);
    }
    function fill(r) {
      for (var yy = r.y; yy < r.y + r.h; yy++)
        for (var xx = r.x; xx < r.x + r.w; xx++)
          if (xx > 0 && yy > 0 && xx < def.w - 1 && yy < def.h - 1) g[yy][xx] = r.f;
    }
    def.rooms.forEach(fill);
    (def.pillars || []).forEach(function (p) { g[p[1]][p[0]] = p[2] || 'P'; });
    (def.doors || []).forEach(function (d) { g[d[1]][d[0]] = d[2] || 'D'; });
    /* Gates are three tiles wide. A one tile hole is the only way forward in a
       gauntlet, and threading a 0.5 unit gap under fire is friction, not
       difficulty — so they read as blast doors and walk like them. */
    (def.gates || []).forEach(function (gt) {
      var gx = gt.at[0], gy = gt.at[1];
      var horizontalTravel = !!FLOORS[g[gy][gx - 1]] && !!FLOORS[g[gy][gx + 1]];
      gt.tiles = [];
      for (var s = -1; s <= 1; s++) {
        var tx = horizontalTravel ? gx : gx + s;
        var ty = horizontalTravel ? gy + s : gy;
        if (tx <= 0 || ty <= 0 || tx >= def.w - 1 || ty >= def.h - 1) continue;
        if (s !== 0 && FLOORS[g[ty][tx]]) continue;      /* never punch through a room */
        g[ty][tx] = 'G';
        gt.tiles.push([tx, ty]);
      }
    });
    if (def.exit) g[def.exit[1]][def.exit[0]] = 'X';
    var out = [];
    for (y = 0; y < def.h; y++) out.push(g[y].join(''));
    return out;
  }

  /* ==========================================================================
   * SECTOR 01 — COOLANT DECK
   * Three short arenas. Teaches every verb and gets out of the way.
   * ========================================================================== */
  var L1 = {
    w: 40, h: 30, wall: '#',
    rooms: [
      { x: 2, y: 23, w: 6, h: 5, f: ',' },        /* start */
      { x: 8, y: 24, w: 6, h: 3, f: ',' },
      { x: 14, y: 20, w: 11, h: 9, f: '-' },      /* arena A */
      { x: 26, y: 23, w: 5, h: 3, f: ',' },
      { x: 31, y: 14, w: 8, h: 14, f: '-' },      /* arena B */
      { x: 33, y: 9, w: 4, h: 4, f: ',' },
      { x: 14, y: 2, w: 24, h: 7, f: '"' },       /* arena C */
      { x: 8, y: 3, w: 5, h: 5, f: ',' }          /* exit alcove */
    ],
    pillars: [[17, 23], [22, 26], [34, 18], [36, 24], [20, 5], [26, 4], [32, 6]],
    gates: [
      { at: [25, 24], zone: [14, 20, 24, 28] },
      { at: [34, 13], zone: [31, 14, 38, 27] },
      { at: [13, 5], zone: [14, 2, 37, 8] }
    ],
    exit: [7, 5],
    start: [4.5, 25.5], angle: 0,
    things: [
      /* arena A — three troopers, nothing else to think about */
      [17, 22, 'grunt'], [22, 24, 'grunt'], [19, 27, 'grunt'],
      [15, 21, 'stimpack'], [23, 21, 'lamp'], [15, 27, 'lamp'],
      /* hall */
      [28, 24, 'stimpack'],
      /* arena B — the shotgun is the first thing you see walking in */
      [34, 26, 'wShotgun'],
      [33, 22, 'grunt'], [37, 20, 'grunt'], [34, 16, 'grunt'],
      [32, 18, 'imp'], [37, 24, 'imp'],
      [36, 15, 'stimpack'], [32, 25, 'barrel'], [33, 25, 'barrel'],
      [38, 17, 'shells'], [35, 21, 'gore'],
      /* arena C — first demons, room to dash */
      [18, 4, 'demon'], [30, 6, 'demon'],
      [23, 3, 'imp'], [28, 7, 'imp'],
      [35, 4, 'grunt'], [16, 7, 'grunt'],
      [24, 6, 'medkit'], [34, 7, 'shells'], [19, 2, 'pole'], [31, 2, 'pole'],
      [10, 5, 'stimpack']
    ],
    name: 'SECTOR 01 :: COOLANT DECK',
    subtitle: 'Clear the room. The gate opens when it is dead.',
    ambient: 3, music: 0, par: 75, skyIndex: 0, secretTex: W.TECH
  };

  /* ==========================================================================
   * SECTOR 02 — REPROCESSING
   * Four arenas, tighter, with hazard floor and the autocannon.
   * ========================================================================== */
  var L2 = {
    w: 44, h: 32, wall: '#',
    rooms: [
      { x: 2, y: 26, w: 5, h: 5, f: ',' },        /* start */
      { x: 7, y: 27, w: 6, h: 3, f: ':' },
      { x: 13, y: 23, w: 11, h: 8, f: '"' },      /* arena A */
      { x: 25, y: 26, w: 5, h: 3, f: ':' },
      { x: 30, y: 19, w: 13, h: 12, f: '"' },     /* arena B */
      { x: 33, y: 27, w: 5, h: 3, f: '~' },       /* slime pool inside B */
      { x: 35, y: 14, w: 4, h: 4, f: ':' },
      { x: 21, y: 5, w: 21, h: 9, f: '-' },       /* arena C */
      { x: 15, y: 8, w: 5, h: 3, f: ':' },
      { x: 2, y: 3, w: 13, h: 13, f: '"' }        /* arena D */
    ],
    pillars: [[16, 26], [21, 29], [33, 22], [40, 27], [36, 21],
              [25, 8], [31, 11], [37, 7], [5, 6], [11, 12], [6, 13]],
    gates: [
      { at: [24, 27], zone: [13, 23, 23, 30] },
      { at: [36, 18], zone: [30, 19, 42, 30] },
      { at: [20, 9], zone: [21, 5, 41, 13] }
    ],
    exit: [1, 9],
    start: [4.5, 28.5], angle: 0,
    things: [
      [15, 24, 'grunt'], [21, 26, 'grunt'], [17, 29, 'grunt'], [22, 23, 'imp'],
      [14, 30, 'shells'], [19, 23, 'stimpack'], [23, 29, 'lamp'],
      [27, 27, 'stimpack'],
      /* arena B hands over the autocannon */
      [33, 29, 'wChaingun'],
      [32, 21, 'imp'], [41, 22, 'imp'], [36, 26, 'demon'],
      [31, 25, 'grunt'], [40, 29, 'grunt'], [38, 20, 'grunt'],
      [42, 25, 'stimpack'], [30, 30, 'clip'], [37, 30, 'barrel'], [38, 30, 'barrel'],
      [34, 24, 'gore'], [41, 19, 'shells'],
      [36, 15, 'stimpack'],
      /* arena C — open floor, two demons and archers on the flanks */
      [24, 7, 'demon'], [38, 11, 'demon'],
      [22, 11, 'imp'], [34, 6, 'imp'], [29, 13, 'imp'],
      [40, 8, 'grunt'], [26, 5, 'grunt'],
      [30, 9, 'stimpack'], [23, 13, 'clip'], [39, 5, 'armour'], [27, 12, 'pole'],
      [17, 9, 'shells'],
      /* arena D — the squeeze */
      [4, 5, 'demon'], [12, 14, 'demon'],
      [8, 4, 'imp'], [3, 12, 'imp'], [13, 8, 'imp'],
      [10, 6, 'grunt'], [5, 15, 'grunt'],
      [8, 9, 'medkit'], [3, 8, 'clip'], [13, 4, 'megaarmour'],
      [7, 11, 'barrel'], [8, 11, 'barrel'], [11, 3, 'gore']
    ],
    name: 'SECTOR 02 :: REPROCESSING',
    subtitle: 'Something came up through the drains.',
    ambient: 5, music: 1, par: 120, skyIndex: 0, secretTex: W.TECH
  };

  /* ==========================================================================
   * SECTOR 03 — THE CORE
   * Two warm ups and then a boss room you cannot leave until it is over.
   * ========================================================================== */
  var L3 = {
    w: 40, h: 30, wall: 'S',
    rooms: [
      { x: 2, y: 24, w: 5, h: 4, f: '*' },        /* start */
      { x: 7, y: 25, w: 7, h: 3, f: '*' },
      { x: 14, y: 20, w: 11, h: 8, f: ';' },      /* arena A */
      { x: 26, y: 23, w: 6, h: 3, f: '*' },
      { x: 32, y: 13, w: 6, h: 14, f: ';' },      /* arena B */
      { x: 34, y: 9, w: 3, h: 3, f: '*' },
      { x: 4, y: 2, w: 34, h: 8, f: ';' },        /* arena C — the Core */
      { x: 12, y: 5, w: 6, h: 2, f: '=' },        /* lava */
      { x: 24, y: 5, w: 6, h: 2, f: '=' }
    ],
    pillars: [[17, 22], [22, 26], [35, 17], [33, 23],
              [9, 4], [9, 8], [20, 3], [20, 9], [32, 4], [32, 8]],
    gates: [
      { at: [25, 24], zone: [14, 20, 24, 27] },
      { at: [35, 12], zone: [32, 13, 37, 26] }
    ],
    exit: [3, 6],
    exitNeedsBoss: true,
    start: [4.5, 26.5], angle: 0,
    things: [
      [17, 21, 'imp'], [22, 25, 'imp'], [19, 27, 'demon'],
      [15, 26, 'shells'], [23, 21, 'clip'], [20, 24, 'gore'],
      [28, 24, 'stimpack'],
      /* arena B hands over the arc projector */
      [35, 25, 'wPlasma'],
      [33, 21, 'imp'], [36, 16, 'imp'], [34, 14, 'demon'], [33, 26, 'grunt'],
      [36, 22, 'cells'], [33, 18, 'stimpack'], [36, 13, 'cells'],
      /* the Core */
      [20, 6, 'baron'],
      [7, 3, 'imp'], [34, 8, 'imp'], [14, 8, 'imp'], [27, 3, 'imp'],
      [6, 8, 'demon'], [35, 3, 'demon'],
      [5, 5, 'wRocket'], [36, 6, 'rockets'], [11, 2, 'rockets'],
      [30, 2, 'cells'], [16, 3, 'medkit'], [24, 9, 'stimpack'],
      [8, 6, 'megaarmour'], [22, 2, 'pole'], [18, 9, 'pole']
    ],
    name: 'SECTOR 03 :: THE CORE',
    subtitle: 'It has been waiting for the clock to stop.',
    ambient: 6, music: 2, par: 150, skyIndex: 1, secretTex: W.STONE
  };

  var DEFS = [L1, L2, L3];
  var LEVELS = DEFS.map(function (d) {
    d.map = carve(d);
    return d;
  });

  /* Sanity check the generated geometry so a bad rectangle is loud, not subtle. */
  function validate() {
    LEVELS.forEach(function (lv, n) {
      var bad = 0, m = lv.map, tag = 'Level ' + (n + 1);
      function solid(x, y) {
        if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return true;
        return !FLOORS[m[y][x]];
      }
      m.forEach(function (row, y) {
        if (row.length !== lv.w) { console.error(tag + ' row ' + y + ' width ' + row.length); bad++; }
        for (var x = 0; x < row.length; x++)
          if (!WALLS[row[x]] && !FLOORS[row[x]]) {
            console.error(tag + ' unknown glyph "' + row[x] + '" at ' + x + ',' + y); bad++;
          }
      });
      /* doors need solid tiles on the axis they slide across */
      (lv.doors || []).concat((lv.gates || []).map(function (g) { return g.at; })).forEach(function (d) {
        var lr = solid(d[0] - 1, d[1]) && solid(d[0] + 1, d[1]);
        var ud = solid(d[0], d[1] - 1) && solid(d[0], d[1] + 1);
        if (!(lr ^ ud)) { console.error(tag + ' door at ' + d[0] + ',' + d[1] + ' is badly framed'); bad++; }
      });
      lv.things.forEach(function (t) {
        if (solid(t[0], t[1])) { console.error(tag + ' thing ' + t[2] + ' inside wall at ' + t[0] + ',' + t[1]); bad++; }
      });
      if (solid(lv.start[0] | 0, lv.start[1] | 0)) { console.error(tag + ' start is inside a wall'); bad++; }
      if (bad) console.error(tag + ': ' + bad + ' problem(s)');
    });
  }
  validate();

  global.Levels = { list: LEVELS, WALLS: WALLS, FLOORS: FLOORS };
})(window);
