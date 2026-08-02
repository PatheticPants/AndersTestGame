/* =============================================================================
 * game.js — world construction, the player, weapons, input and the main loop.
 * ============================================================================= */
(function (global) {
  'use strict';

  var Pal = global.Pal, P = Pal.P, Tex = global.Tex, Spr = global.Spr;
  var Levels = global.Levels, Ent = global.Ent, Hud = global.Hud, Sound = global.Sound;
  var sh = Pal.shade;

  var BUF_W = 320, BUF_H = 200, STATUS_H = 0;

  /* ==========================================================================
   * Weapons
   * ========================================================================== */
  /* Every weapon carries a secondary on right mouse. They cost a burst of
     reserve, so the interesting decision is always "spend now or save". */
  var WEAPONS = [
    {
      /* The sidearm never runs dry. You should always be able to shoot your way
         back into the fight, because the fight is where clock comes from. */
      name: 'SIDEARM', ammo: null, use: 0, rate: 0.34, frames: Spr.weapon.pistol,
      seq: [1, 2, 0], damage: [9, 17], spread: 0.022, pellets: 1, range: 40,
      sound: 'pistol', flash: 5, kick: 2.2, slot: 0,
      /* Its secondary is paid for in clock instead of bullets — the only
         resource that matters, and a real decision every time. */
      alt: { name: 'RAILSHOT', use: 0, clockCost: 2.5, rate: 0.85, damage: [46, 64],
             spread: 0, pellets: 1, range: 48, pierce: 4, sound: 'plasma', flash: 10, kick: 7.5 }
    },
    {
      name: 'SCATTERGUN', ammo: 'shells', use: 1, rate: 0.92, frames: Spr.weapon.shotgun,
      seq: [1, 2, 3, 4, 0], damage: [7, 14], spread: 0.10, pellets: 8, range: 32,
      sound: 'shotgun', extra: { snd: 'pump', at: 0.42 }, flash: 8, kick: 6.5, slot: 1,
      alt: { name: 'DOUBLE BLAST', use: 3, rate: 1.25, damage: [8, 15], spread: 0.16,
             pellets: 18, range: 26, sound: 'shotgun', flash: 13, kick: 13, kickback: 9 }
    },
    {
      name: 'AUTOCANNON', ammo: 'bullets', use: 1, rate: 0.10, frames: Spr.weapon.chaingun,
      seq: [1, 2, 3, 0], damage: [7, 15], spread: 0.055, pellets: 1, range: 40,
      sound: 'chaingun', flash: 5, kick: 1.4, slot: 2, auto: true,
      alt: { name: 'FLAK BURST', use: 12, rate: 0.70, damage: [9, 17], spread: 0.32,
             pellets: 14, range: 20, sound: 'shotgun', flash: 11, kick: 5.5 }
    },
    {
      name: 'ARC PROJECTOR', ammo: 'cells', use: 1, rate: 0.085, frames: Spr.weapon.plasma,
      seq: [1, 2, 0], projectile: 'plasma', range: 40,
      sound: 'plasma', flash: 6, kick: 1.0, slot: 3, auto: true,
      alt: { name: 'SHOCK ORB', use: 28, rate: 1.05, projectile: 'shockorb',
             sound: 'rocket', flash: 11, kick: 4.5 }
    },
    {
      name: 'SIEGE LAUNCHER', ammo: 'rockets', use: 1, rate: 0.95, frames: Spr.weapon.rocket,
      seq: [1, 2, 0], projectile: 'rocket', range: 40,
      sound: 'rocket', flash: 9, kick: 8.0, slot: 4,
      alt: { name: 'CLUSTER', use: 3, rate: 1.45, projectile: 'cluster',
             sound: 'rocket', flash: 13, kick: 11 }
    }
  ];

  var DIFFS = [
    { name: 'RECRUIT', blurb: 'GENEROUS CLOCK', dmgTaken: 0.5, enemyRate: 1.45, ammoMul: 2, clock: 70 },
    { name: 'OPERATIVE', blurb: 'THE INTENDED RUN', dmgTaken: 1.0, enemyRate: 1.0, ammoMul: 1, clock: 55 },
    { name: 'OVERCLOCKED', blurb: 'NO SLACK AT ALL', dmgTaken: 1.6, enemyRate: 0.68, ammoMul: 1, clock: 42 }
  ];

  /* Chain kills to climb the ladder. Rank scales damage and chrono regen, and
     resets hard when you get hit, so the game rewards forward pressure. */
  var RANKS = [
    { at: 0, name: 'STEADY', mult: 1.00, ramp: P.STONE, rampN: P.STONE_N },
    { at: 3, name: 'HEATED', mult: 1.15, ramp: P.GOLD, rampN: P.GOLD_N },
    { at: 7, name: 'BLAZING', mult: 1.35, ramp: P.ORANGE, rampN: P.ORANGE_N },
    { at: 12, name: 'MELTDOWN', mult: 1.60, ramp: P.RED, rampN: P.RED_N },
    { at: 20, name: 'OVERCLOCKED', mult: 2.00, ramp: P.CYAN, rampN: P.CYAN_N }
  ];

  function rankFor(combo) {
    var r = 0;
    for (var i = 0; i < RANKS.length; i++) if (combo >= RANKS[i].at) r = i;
    return r;
  }

  /* ==========================================================================
   * World construction
   * ========================================================================== */
  function buildWorld(def) {
    var rows = def.map, h = rows.length, w = rows[0].length;
    var n = w * h;
    var world = {
      w: w, h: h, ambient: def.ambient,
      type: new Uint8Array(n), wtex: new Uint16Array(n),
      ftex: new Int16Array(n), ctex: new Int16Array(n),
      tlight: new Int8Array(n), dmg: new Uint8Array(n),
      dopen: new Float32Array(n), daxis: new Uint8Array(n),
      dstate: new Uint8Array(n), dtimer: new Float32Array(n),
      dkey: new Array(n), dsecret: new Uint8Array(n),
      seen: new Uint8Array(n), doors: [],
      dgate: new Int8Array(n).fill(-1),
      sky: Tex.skies[def.skyIndex || 0]
    };

    function glyph(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return '#';
      return rows[y][x];
    }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x, c = rows[y][x];
        var wl = Levels.WALLS[c], fl = Levels.FLOORS[c];
        if (fl) {
          world.type[i] = 0;
          world.ftex[i] = fl.floor;
          world.ctex[i] = fl.sky ? -1 : fl.ceil;
          world.tlight[i] = fl.light || 0;
          world.dmg[i] = fl.damage || 0;
        } else if (wl) {
          world.type[i] = wl.door ? 2 : 1;
          world.wtex[i] = wl.secret ? def.secretTex : wl.tex;
          world.ftex[i] = Tex.F.TILE; world.ctex[i] = Tex.F.CEIL; world.tlight[i] = 0;
          if (wl.exit) world.exitTile = i;
          if (wl.door) {
            /* slab orientation: perpendicular to the direction you walk through */
            var lw = !Levels.FLOORS[glyph(x - 1, y)], rw = !Levels.FLOORS[glyph(x + 1, y)];
            world.daxis[i] = (lw && rw) ? 1 : 0;
            world.dkey[i] = wl.key || null;
            if (wl.gate) world.dgate[i] = -2;      /* resolved to an index below */
            world.dsecret[i] = wl.secret ? 1 : 0;
            world.doors.push(i);
            /* borrow floor/ceiling from a neighbour so standing in the doorway looks right */
            var nb = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]];
            for (var k = 0; k < nb.length; k++) {
              var g = Levels.FLOORS[glyph(nb[k][0], nb[k][1])];
              if (g) { world.ftex[i] = g.floor; world.ctex[i] = g.sky ? Tex.F.CEIL : g.ceil; world.tlight[i] = g.light || 0; break; }
            }
          }
        } else {
          world.type[i] = 1; world.wtex[i] = Tex.W.TECH;
        }
      }
    }

    /* Bind each declared gate to its door tile and its arena rectangle. */
    world.gates = (def.gates || []).map(function (gt, idx) {
      var tiles = (gt.tiles || [gt.at]).map(function (t) { return t[1] * w + t[0]; });
      tiles.forEach(function (i) { world.dgate[i] = idx; });
      return { tiles: tiles, tile: tiles[0], zone: gt.zone, armed: false, cleared: false, live: 0 };
    });
    world.exitNeedsBoss = !!def.exitNeedsBoss;
    return world;
  }

  /* ==========================================================================
   * Game
   * ========================================================================== */
  var Game = {
    state: 'title',
    stateTime: 0,
    menuItems: DIFFS.map(function (d) { return d.name; }),
    menuIndex: 1,
    difficulty: 1,
    levelIndex: 0,
    totalTime: 0,
    crosshair: true,
    crtEnabled: true,
    cheatMap: false,
    mapZoom: 4.2,
    showMap: false,
    messages: [],
    entities: [],
    pickupFlash: 0,
    hitMarker: 0,
    shotPulse: 0,
    shakeAmt: 0,
    noiseAlert: false,
    weapons: WEAPONS,
    ranks: RANKS,
    /* time control */
    timeScale: 1,
    chronoActive: false,
    hitStop: 0,
    chronoFlash: 0,
    dashFlash: 0,
    rankFlash: 0,
    popups: [],
    cam: { x: 0, y: 0, angle: 0, pitch: 0, z: 0.55, flash: 0, fov: 0.66 }
  };

  Game.difficultyName = function () { return DIFFS[this.difficulty].name; };
  Game.difficultyBlurb = function (i) { return DIFFS[i].blurb; };
  Game.timeValue = function (k) { return TIME[k]; };

  /* ---- player ------------------------------------------------------------- */
  /* ==========================================================================
   * THE CLOCK
   *
   * There is no health bar. There is a clock, it only ever falls, and killing
   * is the only thing that winds it back up. Everything else in the design
   * hangs off that one rule: you cannot camp, you cannot back off to heal, and
   * slowing time costs you the very thing keeping you alive.
   * ========================================================================== */
  var CLOCK_CAP = 99;                    /* hard ceiling so you cannot bank forever */
  var CLOCK_DRAIN = 1.0;                 /* clock seconds burned per real second */
  var DMG_TO_SECONDS = 0.12;              /* a 25 damage fireball costs 3s */
  var MAX_HIT_SECONDS = 4.0;              /* no single hit may gut a whole run */
  var HIT_IFRAMES = 0.45;                 /* stops a swarm from chain-melting you */
  var CHRONO_BURN = 1.5;                  /* extra drain per second while slowed */
  var CHRONO_MIN = 6;                     /* cannot dip below this to engage */
  var PANIC_CLOCK = 14;                   /* below this the game starts helping */

  /* Tuned against a bot that aims and shoots but never explores: it has to be
     able to break even on kills alone, because that is the promise the game
     makes on the title screen. */
  /* Retuned for the gauntlet. The old numbers were set against sparse maps
     where enemies were hard to find; packed arenas pay far more often, so a
     full clear should net a modest surplus rather than pin the ceiling. A
     clean second per second of drain also just reads honestly on the HUD. */
  var TIME = {
    perDamage: 0.012,                     /* landing 100 damage buys ~1.2 seconds */
    kill: 2.5,
    execute: 6.0,
    orb: 2.0,
    small: 5.0,
    large: 8.0,
    key: 6.0,
    secret: 8.0,
    roomClear: 4.0
  };

  function newPlayer(startClock) {
    return {
      x: 0, y: 0, angle: 0, vx: 0, vy: 0,
      clock: startClock, clockCap: CLOCK_CAP, dead: false, deadTime: 0,
      shield: 0, shieldAbs: 0.40,
      ammo: { bullets: 50, shells: 0, cells: 0, rockets: 0 },
      maxAmmo: { bullets: 200, shells: 50, cells: 300, rockets: 50 },
      has: [true, false, false, false, false],
      weapon: 0, pendingWeapon: -1, weaponTimer: 0, weaponAnim: -1, weaponStep: 0,
      raise: 0, lowering: false,
      keys: { red: false, blue: false, yellow: false },
      score: 0, bobTime: 0, pitch: 0, pitchKick: 0,
      facePain: 0, faceGrin: 0,
      painFlash: 0, damageDir: 0, stepTimer: 0, hurtTimer: 0, tickTimer: 0,

      /* dash */
      dash: 3, dashMax: 3, dashRecharge: 0, dashTime: 0, dashVX: 0, dashVY: 0, invuln: 0,
      /* kill chain */
      combo: 0, comboTimer: 0, rank: 0, bestCombo: 0, executes: 0,
      timeGained: 0
    };
  }

  Game.startLevel = function (index, keepPlayer) {
    this.levelIndex = index;
    this.level = Levels.list[index];
    this.world = buildWorld(this.level);
    this.entities = [];
    this.messages = [];
    this.popups = [];
    this.chronoActive = false;
    this.hitStop = 0;
    this.execSlow = 0;
    this.execPunch = 0;
    this.timeScale = 1;
    this.pickupFlash = 0;
    this.hitMarker = 0;
    this.shotPulse = 0;
    this.shakeAmt = 0;

    var prev = keepPlayer && this.player;
    this.player = newPlayer(DIFFS[this.difficulty].clock);
    if (prev) {
      /* Carry the clock forward, but top it up so a sector never opens on a
         death sentence. Finishing fast is rewarded, not punished. */
      this.player.clock = Math.min(CLOCK_CAP, Math.max(prev.clock + 18, DIFFS[this.difficulty].clock));
      this.player.shield = prev.shield;
      this.player.shieldAbs = prev.shieldAbs;
      this.player.ammo = prev.ammo;
      this.player.has = prev.has;
      this.player.weapon = prev.weapon;
      this.player.score = prev.score;
      this.player.bestCombo = prev.bestCombo;
      this.player.executes = prev.executes;
    } else if (this.difficulty === 0) {
      this.player.ammo.bullets = 100;
    }
    this.tut = { moved: false, fired: false, killed: false, chrono: false, dashed: false, staggerSeen: false, executed: false };
    this.tutStep = 0;
    this.tutHold = 0;
    this.tutorialText = null;
    this.timeFlash = 0;

    this.player.x = this.level.start[0];
    this.player.y = this.level.start[1];
    this.player.angle = this.level.angle;

    var self = this;
    var totalKills = 0, totalItems = 0;
    var gates = this.world.gates;
    this.level.things.forEach(function (t) {
      var e = Ent.spawn(self, t[0] + 0.5, t[1] + 0.5, t[2]);
      if (!e) return;
      if (e.kind === 'enemy') {
        totalKills++;
        /* which arena is this one holding shut? */
        for (var q = 0; q < gates.length; q++) {
          var z = gates[q].zone;
          if (t[0] >= z[0] && t[0] <= z[2] && t[1] >= z[1] && t[1] <= z[3]) { e.gate = q; break; }
        }
      }
      if (e.kind === 'item') totalItems++;
    });

    var secrets = 0;
    for (var i = 0; i < this.world.doors.length; i++) if (this.world.dsecret[this.world.doors[i]]) secrets++;

    this.stats = {
      kills: 0, totalKills: totalKills,
      items: 0, totalItems: totalItems,
      secrets: 0, totalSecrets: secrets,
      time: 0
    };
    this.bossDead = false;
    this.state = 'playing';
    this.stateTime = 0;
    this.showMap = false;
    Sound.startMusic(this.level.music);
    this.message('');
  };

  /* ---- geometry queries --------------------------------------------------- */
  Game.solidAt = function (x, y) {
    var w = this.world;
    var tx = x | 0, ty = y | 0;
    if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) return true;
    var i = ty * w.w + tx;
    var t = w.type[i];
    if (t === 1) return true;
    if (t === 2) return w.dopen[i] < 0.82;
    return false;
  };

  /* `mover` is the entity being moved, so it does not collide with itself.
     Anything that is not the player also has to respect the player's body. */
  Game.canMove = function (x, y, r, mover) {
    if (this.solidAt(x - r, y - r) || this.solidAt(x + r, y - r) ||
        this.solidAt(x - r, y + r) || this.solidAt(x + r, y + r)) return false;
    if (mover !== this.player && !this.player.dead) {
      var px = this.player.x - x, py = this.player.y - y, pr = 0.30 + r;
      if (px * px + py * py < pr * pr) return false;
    }
    for (var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i];
      if (e === mover || !e.solid) continue;
      var dx = e.x - x, dy = e.y - y, rr = e.radius + r;
      if (dx * dx + dy * dy < rr * rr) return false;
    }
    return true;
  };

  /* Exact distance to the first blocking tile along a unit direction, by DDA.
     `openAt` is how far a door must be open before the ray passes through it. */
  Game.rayWall = function (px, py, dirX, dirY, maxDist, openAt) {
    var w = this.world;
    var mapX = px | 0, mapY = py | 0;
    var deltaX = dirX === 0 ? 1e30 : Math.abs(1 / dirX);
    var deltaY = dirY === 0 ? 1e30 : Math.abs(1 / dirY);
    var stepX, stepY, sideX, sideY;
    if (dirX < 0) { stepX = -1; sideX = (px - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - px) * deltaX; }
    if (dirY < 0) { stepY = -1; sideY = (py - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - py) * deltaY; }

    var dist = 0, guard = 0;
    while (guard++ < 512) {
      if (sideX < sideY) { dist = sideX; sideX += deltaX; mapX += stepX; }
      else { dist = sideY; sideY += deltaY; mapY += stepY; }
      if (dist >= maxDist) return maxDist;
      if (mapX < 0 || mapY < 0 || mapX >= w.w || mapY >= w.h) return dist;
      var i = mapY * w.w + mapX, t = w.type[i];
      if (t === 1) return dist;
      if (t === 2 && w.dopen[i] < openAt) return dist;
    }
    return maxDist;
  };

  Game.lineOfSight = function (x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return true;
    return this.rayWall(x0, y0, dx / dist, dy / dist, dist, 0.55) >= dist - 0.0001;
  };

  /* First wall or entity struck along a ray. */
  Game.hitscan = function (x, y, angle, range, ignore) {
    var dx = Math.cos(angle), dy = Math.sin(angle);
    var best = null, bestT = this.rayWall(x, y, dx, dy, range, 0.82);
    var many = ignore && ignore.length !== undefined;
    for (var n = 0; n < this.entities.length; n++) {
      var e = this.entities[n];
      if (many ? ignore.indexOf(e) >= 0 : e === ignore) continue;
      var shootable = (e.kind === 'enemy' && e.state !== 'die' && e.state !== 'dead' && e.state !== 'exec') ||
                      (e.kind === 'decor' && (e.explosive || e.solid));
      if (!shootable) continue;
      var ex = e.x - x, ey = e.y - y;
      var t = ex * dx + ey * dy;
      if (t <= 0 || t >= bestT) continue;
      var px = ex - dx * t, py = ey - dy * t;
      var rad = e.radius + 0.05;
      if (px * px + py * py > rad * rad) continue;
      bestT = t; best = e;
    }
    return { x: x + dx * bestT, y: y + dy * bestT, dist: bestT, entity: best };
  };

  Game.alertNearby = function (radius) {
    var p = this.player;
    for (var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i];
      if (e.kind !== 'enemy' || e.state !== 'idle') continue;
      var dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (!this.lineOfSight(e.x, e.y, p.x, p.y)) continue;
      e.state = 'chase'; e.stateTime = 0; e.target = p; e.alerted = true;
      Sound.play('sight', 0.6 * this.volAt(e.x, e.y), this.panAt(e.x, e.y), e.def.pitch);
    }
  };

  /* ---- sound helpers ------------------------------------------------------ */
  Game.volAt = function (x, y) {
    var dx = x - this.player.x, dy = y - this.player.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - d / 20);
  };
  Game.panAt = function (x, y) {
    var dx = x - this.player.x, dy = y - this.player.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var rx = -Math.sin(this.player.angle), ry = Math.cos(this.player.angle);
    return Math.max(-1, Math.min(1, (dx * rx + dy * ry) / d));
  };
  Game.sound = function (name, x, y, vol, pitch) {
    Sound.play(name, (vol === undefined ? 1 : vol) * this.volAt(x, y), this.panAt(x, y), pitch);
  };

  Game.message = function (text) {
    if (!text) return;
    this.messages.unshift({ text: text, life: 3.2 });
    if (this.messages.length > 4) this.messages.pop();
  };

  Game.shake = function (a) { this.shakeAmt = Math.min(1.4, this.shakeAmt + a); };

  Game.onBossKilled = function () {
    this.bossDead = true;
    this.message('THE BARON IS DEAD. FIND THE EXIT.');
    this.shake(1.2);
  };

  /* ---- damage ------------------------------------------------------------- */
  /* Damage is denominated in seconds. Getting hit does not chip a health bar,
     it robs you of clock — which is the same as robbing you of distance. */
  Game.damagePlayer = function (amount, srcX, srcY) {
    var p = this.player;
    if (p.dead) return;
    if (p.invuln > 0) return;                       /* dash i-frames */
    amount *= DIFFS[this.difficulty].dmgTaken;
    this.knockCombo(amount);
    if (p.shield > 0) {
      var absorbed = amount * p.shieldAbs;
      if (absorbed > p.shield) absorbed = p.shield;
      p.shield -= absorbed;
      amount -= absorbed;
    }
    /* Capped, because a barrel or a baron rocket landing for 12 seconds turns
       the clock back into a health bar you can be one-shot through. */
    var secs = Math.min(MAX_HIT_SECONDS, amount * DMG_TO_SECONDS);
    p.clock -= secs;
    p.invuln = Math.max(p.invuln, HIT_IFRAMES);
    p.painFlash = Math.min(1, p.painFlash + amount / 45 + 0.16);
    this.shake(Math.min(0.5, amount / 60));
    if (secs > 1.2) this.popup('-' + secs.toFixed(1) + ' SEC', P.RED, P.RED_N);
    if (srcX !== undefined) p.damageDir = Math.atan2(srcY - p.y, srcX - p.x);
    if (p.hurtTimer <= 0) { Sound.play('hurt', 0.75); p.hurtTimer = 0.32; }
    if (p.clock <= 0) this.timeOut();
  };

  Game.timeOut = function () {
    var p = this.player;
    p.clock = 0; p.dead = true; p.deadTime = 0;
    Sound.play('playerdie', 1);
    Sound.stopMusic();
    Sound.setTempoScale(1);
  };

  /* Every second of clock you gain is announced, because the whole game is
     teaching you one sentence: killing buys time. */
  Game.addTime = function (secs, label) {
    var p = this.player;
    if (p.dead) return;
    p.clock = Math.min(p.clockCap, p.clock + secs);
    p.timeGained += secs;
    this.timeFlash = 1;
    if (label) this.popup(label + ' +' + secs.toFixed(1) + ' SEC', P.CYAN, P.CYAN_N);
  };

  /* ---- doors -------------------------------------------------------------- */
  Game.tryUse = function () {
    var p = this.player, w = this.world;
    var dx = Math.cos(p.angle), dy = Math.sin(p.angle);
    for (var d = 0.35; d <= 1.85; d += 0.15) {
      var tx = (p.x + dx * d) | 0, ty = (p.y + dy * d) | 0;
      if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) break;
      var i = ty * w.w + tx;
      if (w.type[i] === 2) { this.openDoor(i, true); return; }
      if (w.type[i] === 1) {
        if (i === w.exitTile) {
          if (w.exitNeedsBoss && !this.bossDead) {
            this.message('THE CORE IS STILL BREATHING.');
            Sound.play('noammo', 0.8);
            return;
          }
          this.exitLevel();
          return;
        }
        return;                                        /* solid wall blocks the reach */
      }
    }
    this.message('Nothing usable there.');
  };

  Game.openDoor = function (i, byPlayer) {
    var w = this.world, p = this.player;
    if (w.dgate[i] >= 0) {
      var gt = w.gates[w.dgate[i]];
      if (!gt.cleared) {
        if (byPlayer) {
          this.message('SEALED - ' + gt.live + ' LEFT IN THIS ROOM');
          Sound.play('noammo', 0.8);
        }
        return;
      }
    }
    if (w.dstate[i] === 1 || w.dstate[i] === 2) { w.dtimer[i] = 4.0; return; }
    var key = w.dkey[i];
    if (key && !p.keys[key]) {
      if (byPlayer) {
        this.message('You need the ' + key.toUpperCase() + ' keycard.');
        Sound.play('noammo', 0.8);
      }
      return;
    }
    if (w.dsecret[i] && !w.dfound) {
      this.stats.secrets++;
      Sound.play('secret', 0.9);
      this.addTime(TIME.secret, 'SECRET');
      w.dsecret[i] = 0;
    }
    w.dstate[i] = 1;
    w.dtimer[i] = 4.0;
    this.sound('door', (i % w.w) + 0.5, ((i / w.w) | 0) + 0.5, 0.85);
  };

  Game.monsterUseDoor = function (e) {
    var w = this.world;
    var tx = (e.x + Math.cos(e.moveDir) * (e.radius + 0.35)) | 0;
    var ty = (e.y + Math.sin(e.moveDir) * (e.radius + 0.35)) | 0;
    if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) return;
    var i = ty * w.w + tx;
    if (w.type[i] === 2 && !w.dkey[i] && !w.dsecret[i] && w.dgate[i] < 0 && w.dstate[i] === 0) this.openDoor(i, false);
  };

  Game.updateDoors = function (dt) {
    var w = this.world, p = this.player;
    for (var n = 0; n < w.doors.length; n++) {
      var i = w.doors[n];
      var st = w.dstate[i];
      if (st === 1) {                                   /* opening */
        w.dopen[i] += dt * 1.35;
        if (w.dopen[i] >= 1) { w.dopen[i] = 1; w.dstate[i] = 2; }
      } else if (st === 2) {                            /* open, waiting */
        w.dtimer[i] -= dt;
        if (w.dtimer[i] <= 0) {
          var tx = i % w.w, ty = (i / w.w) | 0;
          if (this.tileOccupied(tx, ty)) { w.dtimer[i] = 1.2; continue; }
          w.dstate[i] = 3;
          this.sound('doorclose', tx + 0.5, ty + 0.5, 0.7);
        }
      } else if (st === 3) {                            /* closing */
        var tx2 = i % w.w, ty2 = (i / w.w) | 0;
        if (this.tileOccupied(tx2, ty2)) { w.dstate[i] = 1; w.dtimer[i] = 3; continue; }
        w.dopen[i] -= dt * 1.05;
        if (w.dopen[i] <= 0) { w.dopen[i] = 0; w.dstate[i] = 0; }
      }
    }
  };

  /* ==========================================================================
   * Arena gates.
   *
   * Walk in and the way forward seals behind a red door. It opens the moment
   * the room is dead — which is also the moment your clock is fullest, so the
   * pacing of the level and the pacing of the resource line up.
   * ========================================================================== */
  Game.updateGates = function () {
    var w = this.world, p = this.player;
    if (!w.gates) return;
    for (var i = 0; i < w.gates.length; i++) {
      var gt = w.gates[i];
      if (gt.cleared) continue;

      var live = 0;
      for (var e = 0; e < this.entities.length; e++) {
        var en = this.entities[e];
        if (en.kind === 'enemy' && en.gate === i && en.state !== 'die' && en.state !== 'dead' && en.state !== 'exec') live++;
      }
      gt.live = live;

      if (!gt.armed) {
        var z = gt.zone;
        if (p.x >= z[0] && p.x <= z[2] + 1 && p.y >= z[1] && p.y <= z[3] + 1) {
          gt.armed = true;
          if (live > 0) {
            this.sound('doorclose', (gt.tile % w.w) + 0.5, ((gt.tile / w.w) | 0) + 0.5, 0.9);
            this.popup('SEALED', P.RED, P.RED_N);
            /* everything in the room notices you at once */
            for (var k = 0; k < this.entities.length; k++) {
              var m = this.entities[k];
              if (m.kind === 'enemy' && m.gate === i && m.state === 'idle') {
                m.state = 'chase'; m.stateTime = 0; m.target = p; m.alerted = true;
              }
            }
            Sound.play('sight', 0.5, 0, 0.8);
          }
        }
      }

      if (gt.armed && live === 0) {
        gt.cleared = true;
        for (var t = 0; t < gt.tiles.length; t++) {
          w.dstate[gt.tiles[t]] = 1;
          w.dtimer[gt.tiles[t]] = 1e9;           /* stays open for good */
        }
        this.popup('WAY CLEAR', P.CYAN, P.CYAN_N);
        Sound.play('secret', 0.85);
        this.addTime(TIME.roomClear, 'ROOM CLEAR');
      }
    }
  };

  /* The arena the player is standing in, if it is still holding them. */
  Game.activeGate = function () {
    var w = this.world, p = this.player;
    if (!w.gates) return null;
    for (var i = 0; i < w.gates.length; i++) {
      var gt = w.gates[i];
      if (!gt.armed || gt.cleared) continue;
      var z = gt.zone;
      if (p.x >= z[0] - 1 && p.x <= z[2] + 2 && p.y >= z[1] - 1 && p.y <= z[3] + 2) return gt;
    }
    return null;
  };

  Game.tileOccupied = function (tx, ty) {
    var p = this.player;
    if ((p.x | 0) === tx && (p.y | 0) === ty) return true;
    for (var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i];
      if (!e.solid) continue;
      if ((e.x | 0) === tx && (e.y | 0) === ty) return true;
    }
    return false;
  };

  Game.exitLevel = function () {
    Sound.play('switch', 1);
    this.state = 'intermission';
    this.stateTime = 0;
    this.totalTime += this.stats.time;
    Sound.stopMusic();
  };

  /* ==========================================================================
   * Input
   * ========================================================================== */
  var keys = {}, mouseDown = false, mouseAlt = false, fireQueued = false, altQueued = false;
  var mouseDX = 0, mouseDY = 0, locked = false;

  function bindInput(canvas) {
    global.addEventListener('keydown', function (e) {
      if (e.repeat) { e.preventDefault(); return; }
      keys[e.code] = true;
      Game.onKey(e.code, e);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
    });
    global.addEventListener('keyup', function (e) { keys[e.code] = false; });
    global.addEventListener('blur', function () {
      keys = {}; mouseDown = false; mouseAlt = false; fireQueued = false; altQueued = false;
      Game.setChrono(false);
    });

    canvas.addEventListener('mousedown', function (e) {
      Sound.init();
      /* The canvas is a real start/resume surface, not a dead screen that only
         responds to the keyboard. */
      if (Game.state === 'title' && e.button === 0) {
        Game.difficulty = Game.menuIndex;
        Game.totalTime = 0;
        Game.startLevel(0, false);
        canvas.requestPointerLock();
        return;
      }
      if (Game.state === 'paused' && e.button === 0) {
        Game.state = 'playing';
        canvas.requestPointerLock();
        return;
      }
      if (Game.state !== 'playing') return;

      /* Queue the press before asking for pointer lock. Previously the first
         click returned early, which made the pistol appear unable to fire. */
      if (e.button === 0) {
        mouseDown = true;
        fireQueued = true;
      }
      if (e.button === 2) {
        mouseAlt = true;
        altQueued = true;
      }
      if (!locked) canvas.requestPointerLock();
    });
    global.addEventListener('mouseup', function (e) {
      if (e.button === 2) mouseAlt = false; else mouseDown = false;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('pointerlockchange', function () {
      locked = document.pointerLockElement === canvas;
      if (!locked && Game.state === 'playing') Game.state = 'paused';
    });
    document.addEventListener('mousemove', function (e) {
      if (!locked) return;
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    });
  }

  Game.onKey = function (code, ev) {
    Sound.init();
    var p = this.player;

    if (this.state === 'title') {
      if (code === 'ArrowUp' || code === 'KeyW') this.menuIndex = (this.menuIndex + this.menuItems.length - 1) % this.menuItems.length;
      if (code === 'ArrowDown' || code === 'KeyS') this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
      if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
        this.difficulty = this.menuIndex;
        this.totalTime = 0;
        this.startLevel(0, false);
        this.canvas.requestPointerLock();
      }
      return;
    }
    if (this.state === 'intermission') {
      if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
        if (this.levelIndex + 1 < Levels.list.length) {
          this.startLevel(this.levelIndex + 1, true);
          this.canvas.requestPointerLock();
        } else {
          this.state = 'victory'; this.stateTime = 0;
        }
      }
      return;
    }
    if (this.state === 'gameover') {
      if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
        this.startLevel(this.levelIndex, false);
        this.canvas.requestPointerLock();
      }
      return;
    }
    if (this.state === 'victory') {
      if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') { this.state = 'title'; this.stateTime = 0; }
      return;
    }
    if (this.state === 'paused') {
      if (code === 'Escape' || code === 'KeyP') { this.state = 'playing'; this.canvas.requestPointerLock(); }
      if (code === 'KeyM') Sound.toggleMusic();
      if (code === 'KeyN') Sound.toggleSfx();
      if (code === 'KeyV') this.crtEnabled = !this.crtEnabled;
      if (code === 'KeyR') { this.startLevel(this.levelIndex, false); this.canvas.requestPointerLock(); }
      if (code === 'KeyQ') { this.state = 'title'; this.stateTime = 0; Sound.stopMusic(); }
      return;
    }

    /* playing */
    if (code === 'Escape' || code === 'KeyP') { this.state = 'paused'; document.exitPointerLock(); return; }
    if (code === 'Tab') { this.showMap = !this.showMap; return; }
    if (code === 'KeyE') { if (!p.dead) this.tryUse(); return; }
    if (code === 'Space') { if (!p.dead) this.tryDash(); return; }
    if (code === 'KeyF') { if (!p.dead && !this.tryExecute()) this.tryUse(); return; }
    if (code === 'KeyX') { this.crosshair = !this.crosshair; return; }
    if (code === 'KeyV') { this.crtEnabled = !this.crtEnabled; return; }
    if (code === 'KeyM') { Sound.toggleMusic(); return; }
    if (code === 'Equal' || code === 'NumpadAdd') { this.mapZoom = Math.min(12, this.mapZoom * 1.25); return; }
    if (code === 'Minus' || code === 'NumpadSubtract') { this.mapZoom = Math.max(1.5, this.mapZoom / 1.25); return; }
    var slot = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[code];
    if (slot !== undefined && !p.dead) this.selectWeapon(slot);
    if (code === 'KeyQ' && !p.dead) this.cycleWeapon(-1);
  };

  /* ==========================================================================
   * Chrono gauntlet, dash, kill chain, executions
   * ========================================================================== */

  /* Hold to slow the world. You keep most of your own speed, so this is the
     panic button, the aiming aid and the traversal tool all at once. */
  Game.setChrono = function (on) {
    var p = this.player;
    if (!p || this.state !== 'playing') { this.chronoActive = false; return; }
    if (on) {
      if (this.chronoActive || p.dead || p.clock < CHRONO_MIN) {
        if (!this.chronoActive && p.clock < CHRONO_MIN) Sound.play('empty', 0.5);
        return;
      }
      this.chronoActive = true;
      this.chronoFlash = 1;
      this.tut.chrono = true;
      Sound.play('chronoIn', 0.9);
      Sound.setTempoScale(0.62);
    } else if (this.chronoActive) {
      this.chronoActive = false;
      Sound.play('chronoOut', 0.75);
      Sound.setTempoScale(this.tempoForClock());
    }
  };

  /* The soundtrack tightens as the clock runs down. Free tension. */
  Game.tempoForClock = function () {
    var p = this.player;
    if (!p) return 1;
    if (p.clock > 25) return 1;
    return 1 + (25 - Math.max(0, p.clock)) / 25 * 0.30;
  };

  Game.tryDash = function () {
    var p = this.player;
    if (p.dead || p.dash < 1 || p.dashTime > 0) { if (p.dash < 1) Sound.play('empty', 0.6); return; }
    var fwd = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    var strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    var dx = Math.cos(p.angle), dy = Math.sin(p.angle);
    var ax = dx * fwd - dy * strafe, ay = dy * fwd + dx * strafe;
    if (!fwd && !strafe) { ax = dx; ay = dy; }
    var l = Math.hypot(ax, ay) || 1;
    p.dashVX = ax / l * 17; p.dashVY = ay / l * 17;
    p.dashTime = 0.17;
    p.invuln = Math.max(p.invuln, 0.28);
    p.dash--;
    this.tut.dashed = true;
    this.dashFlash = 1;
    Sound.play('dash', 0.85);
    Ent.spawnFX(this, p.x, p.y, 0.5, Spr.fx.zap, 26, 0.75);
  };

  var EXEC_RANGE = 2.6, EXEC_CONE = 1.25;

  /* Is this specific body in reach right now? Drives both the F key and the
     brightness of the pulse, so what you see is exactly what you can do. */
  Game.canExecute = function (e) {
    if (!e || e.kind !== 'enemy' || e.state !== 'stagger') return false;
    var p = this.player;
    if (p.dead) return false;
    var dx = e.x - p.x, dy = e.y - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > EXEC_RANGE) return false;
    return Math.abs(Ent.norm(Math.atan2(dy, dx) - p.angle)) <= EXEC_CONE;
  };

  Game.nearestStagger = function () {
    var best = null, bestD = EXEC_RANGE + 1;
    for (var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i];
      if (!this.canExecute(e)) continue;
      var d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  };

  /* The payoff camera: snap onto the kill, punch the lens, freeze, then let a
     sliver of slow motion run out before normal speed resumes. */
  Game.onExecuteCamera = function (e) {
    var p = this.player;
    p.aimLock = { angle: Math.atan2(e.y - p.y, e.x - p.x), t: 0.26 };
    this.hitStop = Math.max(this.hitStop, 0.15);
    this.execSlow = 0.40;
    this.execPunch = 1;
    this.shake(0.65);
  };

  Game.tryExecute = function () {
    var target = this.nearestStagger();
    if (!target) return false;
    var gained = Ent.execute(this, target);
    this.tut.executed = true;
    return true;
  };

  Game.markStagger = function (e) {
    this.popup('STAGGERED', P.GOLD, P.GOLD_N);
  };

  Game.popup = function (text, ramp, rampN) {
    this.popups.unshift({ text: text, life: 1.6, ramp: ramp, rampN: rampN });
    if (this.popups.length > 5) this.popups.pop();
  };

  Game.rank = function () { return RANKS[this.player ? this.player.rank : 0]; };

  Game.onKill = function (e, executed) {
    var p = this.player;
    p.combo++;
    p.comboTimer = executed ? 6.0 : 4.5;
    if (p.combo > p.bestCombo) p.bestCombo = p.combo;

    var nr = rankFor(p.combo);
    if (nr > p.rank) {
      p.rank = nr;
      this.rankFlash = 1;
      Sound.play('rankup', 0.9, 0, 1 + nr * 0.11);
      this.popup(RANKS[nr].name, RANKS[nr].ramp, RANKS[nr].rampN);
    }
    var mult = RANKS[p.rank].mult;
    p.score += Math.round(e.def.score * mult);
    if (executed) p.executes++;
    /* This is the whole loop: a kill is worth seconds, and rank makes each
       kill worth more, so a chain is literally life support. */
    this.addTime((executed ? TIME.execute : TIME.kill) * mult, executed ? 'EXECUTE' : null);
    /* Death-spiral valve: down to the wire, every kill sheds extra time so a
       bad fight is recoverable instead of terminal. */
    if (p.clock < PANIC_CLOCK && !executed) {
      Ent.spawnOrb(this, e.x, e.y, 'health');
      Ent.spawnOrb(this, e.x, e.y, 'chrono');
    }
    this.tut.killed = true;
  };

  /* Small, constant, unannounced — the drip that makes shooting feel like
     progress even before anything dies. */
  Game.onDamageDealt = function (amount) {
    var p = this.player;
    if (p.dead || amount <= 0) return;
    p.clock = Math.min(p.clockCap, p.clock + amount * TIME.perDamage * RANKS[p.rank].mult);
    p.timeGained += amount * TIME.perDamage;
  };

  Game.collectOrb = function (type) {
    this.addTime(TIME.orb);
    Sound.play('orb', 0.55);
    this.pickupFlash = Math.max(this.pickupFlash, 0.22);
  };

  /* Chain lapsed on its own — full reset. */
  Game.breakCombo = function () {
    var p = this.player;
    if (p.combo <= 0) return;
    p.combo = 0;
    p.comboTimer = 0;
    p.rank = 0;
  };

  /* Took a hit. Halving rather than wiping keeps the pressure on without
     making a single stray pellet erase a whole fight's worth of work. */
  Game.knockCombo = function (amount) {
    var p = this.player;
    if (amount < 5 || p.combo <= 0) return;
    p.combo = Math.floor(p.combo * 0.5);
    p.rank = rankFor(p.combo);
    if (p.combo <= 0) p.comboTimer = 0;
  };

  /* ==========================================================================
   * Teaching by doing.
   *
   * The mechanics that make this game itself — the falling clock, chrono,
   * dash, executions — are worth nothing if the player never finds them. So
   * sector one hands them over one at a time, in the moment each becomes
   * relevant, and gets out of the way the instant you use it.
   * ========================================================================== */
  var TUTORIAL = [
    { text: 'WASD TO MOVE  -  MOUSE TO LOOK', done: function (g) { return g.tut.moved; } },
    { text: 'LEFT MOUSE TO FIRE', done: function (g) { return g.tut.fired; } },
    { text: 'YOUR CLOCK IS ALWAYS FALLING  -  KILLING IS THE ONLY THING THAT ADDS TIME',
      done: function (g) { return g.tut.killed; }, hold: 3.5 },
    { text: 'HOLD SHIFT TO SLOW THE WORLD  -  IT COSTS CLOCK', done: function (g) { return g.tut.chrono; } },
    { text: 'SPACE TO DASH  -  YOU CANNOT BE HIT MID-DASH', done: function (g) { return g.tut.dashed; } },
    { text: 'WOUNDED ENEMIES DROP TO A KNEE  -  PRESS F TO EXECUTE FOR BIG TIME',
      wait: function (g) { return g.tut.staggerSeen; }, done: function (g) { return g.tut.executed; } }
  ];

  Game.updateTutorial = function (raw) {
    this.tutorialText = null;
    if (this.levelIndex !== 0 || this.tutStep >= TUTORIAL.length) return;
    var p = this.player;
    if (Math.hypot(p.vx, p.vy) > 1.2) this.tut.moved = true;
    for (var i = 0; i < this.entities.length; i++)
      if (this.entities[i].state === 'stagger') { this.tut.staggerSeen = true; break; }

    var step = TUTORIAL[this.tutStep];
    if (step.wait && !step.wait(this)) return;              /* not relevant yet */
    /* Hold state lives on the game, not on the shared step objects, or a
       second playthrough would skip straight past every prompt. */
    if (step.done(this)) {
      this.tutHold += raw;
      if (this.tutHold > (step.hold || 1.1)) { this.tutStep++; this.tutHold = 0; return; }
    }
    this.tutorialText = step.text;
  };

  Game.selectWeapon = function (slot) {
    var p = this.player;
    if (!p.has[slot] || p.weapon === slot || p.lowering) return;
    p.pendingWeapon = slot;
    p.lowering = true;
  };

  Game.cycleWeapon = function (dir) {
    var p = this.player;
    for (var i = 1; i <= 5; i++) {
      var s = (p.weapon + dir * i + 5 * 5) % 5;
      if (p.has[s]) { this.selectWeapon(s); return; }
    }
  };

  /* ==========================================================================
   * Player update
   * ========================================================================== */
  Game.updatePlayer = function (dt) {
    var p = this.player, w = this.world;

    /* mouse look */
    if (locked) {
      p.angle += mouseDX * 0.0026 * this.sensitivity;
      p.pitch -= mouseDY * 0.0026 * this.sensitivity * 55;
    }
    if (keys['ArrowLeft']) p.angle -= 2.4 * dt;
    if (keys['ArrowRight']) p.angle += 2.4 * dt;
    if (keys['ArrowUp']) p.pitch += 90 * dt;
    if (keys['ArrowDown']) p.pitch -= 90 * dt;
    mouseDX = 0; mouseDY = 0;
    var maxPitch = this.renderer.viewH * 0.42;
    p.pitch = Math.max(-maxPitch, Math.min(maxPitch, p.pitch));
    if (!keys['ArrowUp'] && !keys['ArrowDown']) p.pitch *= Math.pow(0.02, dt);   /* eases back to level */

    /* Executions briefly take the camera so the kill lands centre-frame. */
    if (p.aimLock && p.aimLock.t > 0) {
      p.aimLock.t -= dt;
      p.angle += Ent.norm(p.aimLock.angle - p.angle) * Math.min(1, dt * 18);
    }

    p.pitchKick += (0 - p.pitchKick) * Math.min(1, dt * 11);

    if (p.dead) {
      p.deadTime += dt;
      p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
      if (p.deadTime > 1.6 && this.state === 'playing') { this.state = 'gameover'; this.stateTime = 0; }
      return;
    }

    /* movement — always running; the old walk speed just made you a target */
    var fwd = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    var strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    var speed = 4.6;
    var dx = Math.cos(p.angle), dy = Math.sin(p.angle);
    var rx = -dy, ry = dx;
    var wishX = dx * fwd + rx * strafe, wishY = dy * fwd + ry * strafe;
    var len = Math.hypot(wishX, wishY);
    if (len > 0.001) { wishX = wishX / len * speed; wishY = wishY / len * speed; }

    if (p.dashTime > 0) {
      /* Dash overrides normal acceleration outright, and leaves a short trail. */
      p.dashTime -= dt;
      p.vx = p.dashVX; p.vy = p.dashVY;
      p.dashTrail = (p.dashTrail || 0) - dt;
      if (p.dashTrail <= 0) {
        p.dashTrail = 0.045;
        Ent.spawnFX(this, p.x, p.y, 0.45, Spr.fx.zap, 30, 0.5);
      }
      if (p.dashTime <= 0) { p.vx *= 0.34; p.vy *= 0.34; }
    } else {
      var accel = len > 0.001 ? 17 : 13;
      p.vx += (wishX - p.vx) * Math.min(1, accel * dt);
      p.vy += (wishY - p.vy) * Math.min(1, accel * dt);
    }

    var r = 0.22;
    var nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (this.canMove(nx, p.y, r, p)) p.x = nx; else { p.vx *= 0.2; if (p.dashTime > 0) p.dashVX *= 0.2; }
    if (this.canMove(p.x, ny, r, p)) p.y = ny; else { p.vy *= 0.2; if (p.dashTime > 0) p.dashVY *= 0.2; }

    /* head bob and footsteps */
    var moving = Math.hypot(p.vx, p.vy);
    p.bobTime += dt * moving * 2.4;
    if (moving > 1.2) {
      p.stepTimer -= dt * moving;
      if (p.stepTimer <= 0) { p.stepTimer = 1.5; Sound.play('step', 0.4); }
    }

    /* damaging floor */
    var ti = (p.y | 0) * w.w + (p.x | 0);
    if (ti >= 0 && ti < w.dmg.length && w.dmg[ti] > 0) {
      p.hurtFloor = (p.hurtFloor || 0) + dt;
      if (p.hurtFloor > 0.45) { p.hurtFloor = 0; this.damagePlayer(w.dmg[ti], p.x, p.y); }
    }

    /* feedback timers */
    p.facePain = Math.max(0, p.facePain - dt);
    p.faceGrin = Math.max(0, p.faceGrin - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.painFlash = Math.max(0, p.painFlash - dt * 1.5);

    /* reveal the automap around the player */
    this.markSeen(p.x, p.y, 7);
  };

  /* Everything here runs on unscaled time: the kill chain, dash cooldowns and
     the chrono reserve should not themselves be slowed by chrono. */
  Game.updateMeters = function (raw) {
    var p = this.player;
    p.invuln = Math.max(0, p.invuln - raw);

    if (p.dash < p.dashMax) {
      p.dashRecharge += raw;
      if (p.dashRecharge >= 1.9) { p.dashRecharge = 0; p.dash++; }
    } else p.dashRecharge = 0;

    if (p.comboTimer > 0) {
      p.comboTimer -= raw;
      if (p.comboTimer <= 0) this.breakCombo();
    }

    var holding = keys['ShiftLeft'] || keys['ShiftRight'];
    if (holding && !this.chronoActive) this.setChrono(true);
    else if (!holding && this.chronoActive) this.setChrono(false);

    /* The clock. Always falling, faster while you are bending time. */
    if (!p.dead) {
      p.clock -= raw * (CLOCK_DRAIN + (this.chronoActive ? CHRONO_BURN : 0));
      if (this.chronoActive && p.clock < CHRONO_MIN * 0.5) this.setChrono(false);
      if (p.clock <= 0) { this.timeOut(); return; }

      /* audible countdown once it gets genuinely dangerous */
      if (p.clock < 10) {
        p.tickTimer -= raw;
        if (p.tickTimer <= 0) { p.tickTimer = Math.max(0.22, p.clock / 22); Sound.play('tick', 0.5); }
      }
      Sound.setTempoScale(this.chronoActive ? 0.62 : this.tempoForClock());
    }
  };

  /* Reveal the automap. Open tiles need line of sight; the walls that enclose a
     revealed open tile come along with it, otherwise nothing would ever be
     drawn — a ray aimed at a wall's centre is by definition blocked by it. */
  Game.markSeen = function (x, y, rad) {
    var w = this.world;
    var x0 = Math.max(0, (x - rad) | 0), x1 = Math.min(w.w - 1, (x + rad) | 0);
    var y0 = Math.max(0, (y - rad) | 0), y1 = Math.min(w.h - 1, (y + rad) | 0);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var i = ty * w.w + tx;
        if (w.seen[i] || w.type[i] !== 0) continue;
        var dx = tx + 0.5 - x, dy = ty + 0.5 - y;
        var d2 = dx * dx + dy * dy;
        if (d2 > rad * rad) continue;
        if (d2 > 2.5 && !this.lineOfSight(x, y, tx + 0.5, ty + 0.5)) continue;
        w.seen[i] = 1;
        for (var oy = -1; oy <= 1; oy++) {
          for (var ox = -1; ox <= 1; ox++) {
            var nx = tx + ox, ny = ty + oy;
            if (nx < 0 || ny < 0 || nx >= w.w || ny >= w.h) continue;
            w.seen[ny * w.w + nx] = 1;
          }
        }
      }
    }
  };

  /* ---- weapons ------------------------------------------------------------ */
  Game.updateWeapon = function (dt) {
    var p = this.player;
    p.weaponTimer = Math.max(0, p.weaponTimer - dt);

    /* switching: lower, swap, raise */
    if (p.lowering) {
      p.raise += dt * 5.2;
      if (p.raise >= 1) {
        p.raise = 1; p.lowering = false;
        p.weapon = p.pendingWeapon; p.pendingWeapon = -1;
        p.weaponAnim = -1; p.weaponTimer = 0.1;
        this.message(WEAPONS[p.weapon].name);
      }
    } else if (p.raise > 0) {
      p.raise = Math.max(0, p.raise - dt * 4.6);
    } else if (p.pendingWeapon >= 0 && p.pendingWeapon !== p.weapon) {
      p.lowering = true;
    }

    /* animation timeline */
    var wdef = WEAPONS[p.weapon];
    if (p.weaponAnim >= 0) {
      p.weaponAnim += dt;
      var stepDur = wdef.rate / wdef.seq.length;
      var step = Math.floor(p.weaponAnim / stepDur);
      if (wdef.extra && !p.playedExtra && p.weaponAnim >= wdef.rate * wdef.extra.at) {
        p.playedExtra = true;
        Sound.play(wdef.extra.snd, 0.7);
      }
      if (step >= wdef.seq.length) { p.weaponAnim = -1; p.weaponStep = 0; }
      else p.weaponStep = wdef.seq[step];
    }

    var ready = !p.dead && p.weaponTimer <= 0 && !p.lowering && p.raise <= 0.01;
    var wantAlt = mouseAlt || altQueued;
    var wantFire = mouseDown || fireQueued || keys['ControlLeft'] || keys['ControlRight'];

    if (ready && wantAlt) {
      if (!p.altThisPress || altQueued) { this.fireWeapon(true); altQueued = false; }
      p.altThisPress = true;
    } else if (ready && wantFire) {
      if (wdef.auto || fireQueued || !p.firedThisPress) { this.fireWeapon(false); fireQueued = false; }
      p.firedThisPress = true;
    }
    if (!wantFire) p.firedThisPress = false;
    if (!wantAlt) p.altThisPress = false;
  };

  Game.fireWeapon = function (isAlt) {
    var p = this.player, base = WEAPONS[p.weapon];
    var w = isAlt && base.alt ? base.alt : base;
    var ammoKind = base.ammo;

    /* clock-priced secondaries */
    if (w.clockCost) {
      if (p.clock < w.clockCost + 3) {
        Sound.play('noammo', 0.8);
        this.popup('NOT ENOUGH CLOCK', P.RED, P.RED_N);
        p.weaponTimer = 0.35;
        return;
      }
      p.clock -= w.clockCost;
      this.popup('-' + w.clockCost.toFixed(1) + ' SEC', P.RED, P.RED_N);
    }

    if (ammoKind && p.ammo[ammoKind] < w.use) {
      Sound.play('noammo', 0.8);
      p.weaponTimer = 0.35;
      if (isAlt) { this.popup('NEED ' + w.use + ' ' + ammoKind.toUpperCase(), P.RED, P.RED_N); return; }
      /* fall back to something we can actually shoot */
      for (var s = 4; s >= 0; s--) {
        var ww = WEAPONS[s];
        if (p.has[s] && (!ww.ammo || p.ammo[ww.ammo] >= ww.use)) { this.selectWeapon(s); break; }
      }
      return;
    }
    if (ammoKind) p.ammo[ammoKind] -= w.use;

    this.tut.fired = true;
    p.weaponTimer = w.rate;
    p.weaponAnim = 0; p.weaponStep = base.seq[0];
    p.playedExtra = false;
    p.pitchKick -= w.kick;
    this.cam.flash = w.flash;
    this.shotPulse = 1;
    Sound.play(w.sound, isAlt ? 1.0 : 0.9, 0);
    this.alertNearby(isAlt ? 20 : 15);
    this.shake(w.kick * 0.02);
    if (isAlt) this.popup(w.name, P.GOLD, P.GOLD_N);

    /* recoil strong enough to move you — the double blast is a movement tool */
    if (w.kickback) {
      p.vx -= Math.cos(p.angle) * w.kickback;
      p.vy -= Math.sin(p.angle) * w.kickback;
    }

    var mult = RANKS[p.rank].mult;

    if (w.projectile) {
      var a = p.angle;
      var sx = p.x + Math.cos(a) * 0.42, sy = p.y + Math.sin(a) * 0.42;
      if (!this.solidAt(sx, sy)) {
        var pr = Ent.spawnProjectile(this, p, sx, sy, a, w.projectile, 0.5);
        if (pr) pr.dmgMul = mult;
      } else Ent.explode(this, p.x, p.y, 1.6, 30 * mult, p);
      return;
    }

    for (var i = 0; i < w.pellets; i++) {
      var ang = p.angle + (Math.random() - 0.5) * w.spread * 2;
      var dmg = (w.damage[0] + Math.random() * (w.damage[1] - w.damage[0])) * mult;
      var ignore = [], pierced = 0;
      /* A railshot keeps going through bodies until it runs out of penetration. */
      do {
        var hit = this.hitscan(p.x, p.y, ang, w.range, ignore);
        if (hit.entity) {
          this.hitMarker = 0.16;
          Ent.hurt(this, hit.entity, dmg, p);
          Ent.spawnFX(this, hit.x, hit.y, 0.45 + Math.random() * 0.25,
            hit.entity.kind === 'enemy' ? Spr.fx.blood : Spr.fx.spark, 26, 0.42);
          ignore.push(hit.entity);
          pierced++;
        } else {
          Ent.spawnFX(this, hit.x, hit.y, 0.4 + Math.random() * 0.4,
            w.pierce ? Spr.fx.zap : Spr.fx.spark, 28, w.pierce ? 0.5 : 0.34);
          break;
        }
      } while (w.pierce && pierced < w.pierce);
    }
  };

  /* ==========================================================================
   * Frame
   * ========================================================================== */
  Game.update = function (raw) {
    this.stateTime += raw;

    for (var i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].life -= raw;
      if (this.messages[i].life <= 0) this.messages.splice(i, 1);
    }
    for (var j = this.popups.length - 1; j >= 0; j--) {
      this.popups[j].life -= raw;
      if (this.popups[j].life <= 0) this.popups.splice(j, 1);
    }
    this.pickupFlash = Math.max(0, this.pickupFlash - raw * 1.6);
    this.hitMarker = Math.max(0, this.hitMarker - raw);
    this.shotPulse = Math.max(0, this.shotPulse - raw * 8);
    this.shakeAmt = Math.max(0, this.shakeAmt - raw * 2.6);
    this.chronoFlash = Math.max(0, this.chronoFlash - raw * 2.6);
    this.dashFlash = Math.max(0, this.dashFlash - raw * 4.5);
    this.rankFlash = Math.max(0, this.rankFlash - raw * 1.4);
    this.cam.flash = Math.max(0, this.cam.flash - raw * 42);

    if (this.state === 'title') { this.updateTitleCam(raw); return; }
    if (this.state !== 'playing') { this.chronoActive = false; return; }

    this.updateMeters(raw);
    if (this.player.dead) { this.tutorialText = null; } else this.updateTutorial(raw);
    this.timeFlash = Math.max(0, (this.timeFlash || 0) - raw * 1.8);

    /* Two clocks. The world runs on `worldDt`, you run on `playerDt`, and a
       brief hit stop freezes both so executions land with weight. */
    if (this.hitStop > 0) this.hitStop -= raw;
    this.execSlow = Math.max(0, (this.execSlow || 0) - raw);
    this.execPunch = Math.max(0, (this.execPunch || 0) - raw * 2.6);
    var frozen = this.hitStop > 0;
    var slow = this.chronoActive ? 0.26 : (this.execSlow > 0 ? 0.38 : 1);
    this.timeScale = frozen ? 0 : slow;
    var worldDt = raw * this.timeScale;
    var playerDt = frozen ? 0 : raw * (this.chronoActive ? 0.74 : (this.execSlow > 0 ? 0.8 : 1));
    var weaponDt = frozen ? 0 : raw * (this.chronoActive ? 0.88 : 1);

    this.stats.time += raw;
    this.updatePlayer(playerDt);
    this.updateWeapon(weaponDt);
    this.updateGates();
    this.updateDoors(worldDt);
    Ent.update(this, worldDt);

    var p = this.player;
    var shakeX = (Math.random() - 0.5) * this.shakeAmt * 0.05;
    this.cam.x = p.x; this.cam.y = p.y;
    this.cam.angle = p.angle + shakeX;
    this.cam.pitch = p.pitch + p.pitchKick + (Math.random() - 0.5) * this.shakeAmt * 6;
    this.cam.z = 0.55 + Math.sin(p.bobTime * 2) * 0.019;
    /* dash and chrono both widen the lens a touch — cheap, and it reads as speed */
    this.cam.fov = 0.66 + (p.dashTime > 0 ? 0.085 : 0) + this.chronoFlash * 0.03
      - (this.execPunch || 0) * 0.055;
  };

  Game.updateTitleCam = function (dt) {
    if (!this.world) {
      this.level = Levels.list[0];
      this.world = buildWorld(this.level);
      this.player = newPlayer();
      this.entities = [];
      this.stats = { kills: 0, totalKills: 1, items: 0, totalItems: 1, secrets: 0, totalSecrets: 1, time: 0 };
      var self = this;
      this.level.things.forEach(function (t) { Ent.spawn(self, t[0] + 0.5, t[1] + 0.5, t[2]); });
      this.titleT = 0;
    }
    this.titleT = (this.titleT || 0) + dt * 0.12;
    var cx = 19.5, cy = 11.5, rad = 5.0;
    this.cam.x = cx + Math.cos(this.titleT) * rad;
    this.cam.y = cy + Math.sin(this.titleT) * rad * 0.8;
    this.cam.angle = this.titleT + Math.PI * 0.5;
    this.cam.pitch = 6;
    this.cam.z = 0.55;
    this.player.x = this.cam.x; this.player.y = this.cam.y; this.player.angle = this.cam.angle;
    /* keep the demons milling about in the background */
    Ent.update(this, dt);
  };

  /* ---- render ------------------------------------------------------------- */
  Game.render = function (now) {
    var r = this.renderer, p = this.player;
    if (!this.world) return;

    var sprites = this.entities;
    r.render(this.world, this.cam, sprites, now);

    if (this.state === 'playing' || this.state === 'paused') {
      if (this.showMap) Hud.drawAutomap(r, this);
      else this.drawWeapon(r);
    }

    /* full screen tints */
    if (p) {
      /* The world itself gets anxious as the clock runs out. */
      if (this.state === 'playing' && !p.dead && p.clock < 15) {
        var urg = (15 - Math.max(0, p.clock)) / 15;
        var beat = 0.5 + 0.5 * Math.sin(this.stateTime * (p.clock < 8 ? 15 : 8));
        r.tint(150, 10, 10, urg * 0.30 * beat, 0, r.viewH);
      }
      if (this.chronoActive) r.tint(20, 140, 175, 0.14, 0, r.viewH);
      if (this.timeFlash > 0) r.tint(60, 220, 235, this.timeFlash * 0.16, 0, r.viewH);
      if (this.execPunch > 0) r.tint(220, 245, 255, this.execPunch * 0.22, 0, r.viewH);
      if (p.painFlash > 0) r.tint(190, 20, 10, Math.min(0.62, p.painFlash * 0.55), 0, r.viewH);
      if (this.pickupFlash > 0) r.tint(220, 190, 60, this.pickupFlash * 0.22, 0, r.viewH);
      if (p.dead) r.tint(120, 0, 0, Math.min(0.55, p.deadTime * 0.35), 0, r.viewH);
    }
    if (this.crtEnabled) this.postProcess(r);

    if (this.state === 'playing' || this.state === 'paused') {
      Hud.drawHud(r, this);
      if (!this.showMap) { Hud.drawMessages(r, this); Hud.drawPopups(r, this); }
      Hud.drawCrosshair(r, this);
      if (this.stateTime < 2.0) Hud.drawLevelIntro(r, this, this.stateTime);
    }

    /* These screens own the whole frame, so wipe the strip the 3D view never
       touches — otherwise the last status bar drawn stays burned in below. */
        switch (this.state) {
      case 'title': Hud.drawTitle(r, this, this.stateTime); break;
      case 'paused': Hud.drawPaused(r, this, this.stateTime); break;
      case 'intermission': Hud.drawIntermission(r, this, this.stateTime); break;
      case 'gameover': Hud.drawGameOver(r, this, this.stateTime); break;
      case 'victory': Hud.drawVictory(r, this, this.stateTime); break;
    }

    r.present();
  };

  Game.drawWeapon = function (r) {
    var p = this.player;
    if (p.dead) return;
    var w = WEAPONS[p.weapon];
    var pic = w.frames[p.weaponStep] || w.frames[0];
    /* Drawn oversized and anchored past the bottom edge: a first person weapon
       should feel like it is a foot from your face, not sitting on a shelf. */
    var scale = 1.18;
    var bobX = Math.sin(p.bobTime) * 7;
    var bobY = Math.abs(Math.cos(p.bobTime)) * 5;
    var x = (r.W - pic.w * scale) / 2 + bobX;
    var y = r.viewH - pic.h * scale + bobY + p.raise * 150;

    /* the gun is lit by the room, and by its own muzzle flash */
    var light = this.world.ambient + 1;
    if (this.cam.flash > 0) light -= this.cam.flash;
    light = Math.max(0, Math.min(28, light));
    r.blit(pic, x, y, light, scale, false);
  };

  /* Scanlines + vignette. Cheap, and it sells the CRT look. */
  Game.postProcess = function (r) {
    var W = r.W, H = r.viewH, buf = r.buf8;
    for (var y = 0; y < H; y += 2) {
      var p = y * W * 4;
      for (var x = 0; x < W; x++, p += 4) {
        buf[p] = buf[p] * 0.82;
        buf[p + 1] = buf[p + 1] * 0.82;
        buf[p + 2] = buf[p + 2] * 0.82;
      }
    }
    if (!this._vig || this._vig.length !== W * H) {
      this._vig = new Float32Array(W * H);
      var cx = W / 2, cy = H / 2, maxd = Math.hypot(cx, cy);
      for (var vy = 0; vy < H; vy++)
        for (var vx = 0; vx < W; vx++) {
          var d = Math.hypot(vx - cx, vy - cy) / maxd;
          this._vig[vy * W + vx] = Math.max(0.42, 1 - Math.pow(d, 2.6) * 0.85);
        }
    }
    var vig = this._vig;
    for (var i = 0, q = 0; i < W * H; i++, q += 4) {
      var v = vig[i];
      buf[q] *= v; buf[q + 1] *= v; buf[q + 2] *= v;
    }
  };

  /* ==========================================================================
   * Boot
   * ========================================================================== */
  Game.init = function (canvas) {
    this.canvas = canvas;
    this.renderer = new global.Renderer(canvas, BUF_W, BUF_H, STATUS_H);
    this.sensitivity = 1.0;
    bindInput(canvas);

    var last = performance.now(), self = this;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      self.update(dt);
      self.render(now / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  global.Game = Game;
})(window);
