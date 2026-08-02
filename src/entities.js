/* =============================================================================
 * entities.js — monsters, items, scenery, projectiles and effects.
 *
 * Monster AI is a small state machine (idle -> chase -> attack -> pain -> die)
 * with Doom style direction picking, and monsters that get hit by another
 * monster's shot will turn on it, so crossfire causes infighting.
 * ============================================================================= */
(function (global) {
  'use strict';

  var Spr = global.Spr;
  var TAU = Math.PI * 2;

  function norm(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }

  /* ==========================================================================
   * Definitions
   * ========================================================================== */
  var ENEMIES = {
    grunt: {
      name: 'Former Human', hp: 30, speed: 1.55, radius: 0.30, height: 0.95,
      sprites: Spr.enemy.grunt, pain: 0.62, painTime: 0.28, pitch: 1.35,
      attack: 'hitscan', damage: [3, 9], shots: 1, spread: 0.10, range: 22, accuracy: 0.72,
      cooldown: [0.9, 1.6], windup: 0.30, score: 100, drop: 'clip',
      alertRange: 26, gib: 24
    },
    imp: {
      name: 'Imp', hp: 60, speed: 1.85, radius: 0.32, height: 0.95,
      sprites: Spr.enemy.imp, pain: 0.42, painTime: 0.26, pitch: 1.0,
      attack: 'projectile', projectile: 'fireball', damage: [8, 18], range: 24,
      cooldown: [1.1, 2.0], windup: 0.42, score: 200, drop: null,
      melee: 12, meleeRange: 1.1,
      alertRange: 28, gib: 40
    },
    demon: {
      name: 'Demon', hp: 110, speed: 3.15, radius: 0.42, height: 0.95,
      sprites: Spr.enemy.demon, pain: 0.30, painTime: 0.22, pitch: 0.72,
      attack: 'melee', damage: [10, 22], range: 1.35,
      cooldown: [0.7, 1.1], windup: 0.26, score: 300, drop: null,
      alertRange: 30, gib: 70
    },
    baron: {
      name: 'Hell Baron', hp: 900, speed: 1.65, radius: 0.62, height: 1.55,
      sprites: Spr.enemy.baron, pain: 0.10, painTime: 0.30, pitch: 0.48,
      attack: 'projectile', projectile: 'hellball', damage: [22, 44], range: 30,
      cooldown: [1.0, 1.7], windup: 0.46, score: 2000, drop: null,
      melee: 30, meleeRange: 1.9, boss: true,
      alertRange: 40, gib: 400
    }
  };

  /* Items: `give` returns true when the pickup should be consumed. */
  var ITEMS = {
    /* Time cells replace health entirely — the only currency that matters. */
    stimpack: { pic: Spr.item.stimpack, h: 0.36, msg: '', snd: 'pickup', time: 'small' },
    medkit: { pic: Spr.item.medkit, h: 0.44, msg: '', snd: 'pickup', time: 'large' },
    armour: { pic: Spr.item.armour, h: 0.5, msg: 'Shield online.', snd: 'pickup',
      give: function (p) { if (p.shield >= 100) return false; p.shield = Math.min(100, p.shield + 50); return true; } },
    megaarmour: { pic: Spr.item.megaarmour, h: 0.5, msg: 'HARD SHIELD!', snd: 'weapon',
      give: function (p) { p.shield = 150; p.shieldAbs = 0.55; return true; } },
    clip: { pic: Spr.item.clip, h: 0.3, msg: 'Picked up a clip.', snd: 'pickup',
      give: function (p) { return giveAmmo(p, 'bullets', 20); } },
    shells: { pic: Spr.item.shells, h: 0.3, msg: 'Picked up shotgun shells.', snd: 'pickup',
      give: function (p) { return giveAmmo(p, 'shells', 8); } },
    cells: { pic: Spr.item.cells, h: 0.38, msg: 'Picked up an energy cell.', snd: 'pickup',
      give: function (p) { return giveAmmo(p, 'cells', 40); } },
    rockets: { pic: Spr.item.rockets, h: 0.38, msg: 'Picked up rockets.', snd: 'pickup',
      give: function (p) { return giveAmmo(p, 'rockets', 5); } },
    keyRed: { pic: Spr.item.keyRed, h: 0.44, msg: 'RED KEYCARD', snd: 'key', bonus: 'key',
      give: function (p) { p.keys.red = true; return true; } },
    keyBlue: { pic: Spr.item.keyBlue, h: 0.44, msg: 'BLUE KEYCARD', snd: 'key', bonus: 'key',
      give: function (p) { p.keys.blue = true; return true; } },
    keyYellow: { pic: Spr.item.keyYellow, h: 0.44, msg: 'YELLOW KEYCARD', snd: 'key', bonus: 'key',
      give: function (p) { p.keys.yellow = true; return true; } },
    wShotgun: { pic: Spr.item.wShotgun, h: 0.42, msg: 'You got the SHOTGUN!', snd: 'weapon', weapon: 1,
      give: function (p) { giveAmmo(p, 'shells', 8); return giveWeapon(p, 1); } },
    wChaingun: { pic: Spr.item.wChaingun, h: 0.42, msg: 'You got the CHAINGUN!', snd: 'weapon', weapon: 2,
      give: function (p) { giveAmmo(p, 'bullets', 40); return giveWeapon(p, 2); } },
    wPlasma: { pic: Spr.item.wPlasma, h: 0.42, msg: 'You got the PLASMA RIFLE!', snd: 'weapon', weapon: 3,
      give: function (p) { giveAmmo(p, 'cells', 40); return giveWeapon(p, 3); } },
    wRocket: { pic: Spr.item.wRocket, h: 0.42, msg: 'You got the ROCKET LAUNCHER!', snd: 'weapon', weapon: 4,
      give: function (p) { giveAmmo(p, 'rockets', 5); return giveWeapon(p, 4); } }
  };

  function giveAmmo(p, kind, n) {
    if (p.ammo[kind] >= p.maxAmmo[kind]) return false;
    p.ammo[kind] = Math.min(p.maxAmmo[kind], p.ammo[kind] + n);
    return true;
  }
  function giveWeapon(p, idx) {
    if (p.has[idx]) return true;                 /* still consumed: ammo was given */
    p.has[idx] = true;
    p.pendingWeapon = idx;
    return true;
  }

  var DECOR = {
    barrel: { pic: Spr.decor.barrel, h: 0.62, radius: 0.30, hp: 20, explosive: true },
    lamp: { pic: Spr.decor.lamp, h: 0.78, radius: 0.22, solid: true },
    pole: { pic: Spr.decor.pole, h: 0.60, radius: 0.20, solid: true },
    gore: { pic: Spr.decor.gore, h: 0.24, radius: 0, flat: true }
  };

  var PROJECTILES = {
    fireball: { frames: Spr.fx.fireball, speed: 8.5, h: 0.34, radius: 0.16, damage: [8, 18], fps: 12, bright: true, sound: 'plasma' },
    hellball: { frames: Spr.fx.hellball, speed: 9.5, h: 0.48, radius: 0.22, damage: [22, 44], fps: 12, bright: true, splash: 40, splashDmg: 26 },
    plasma: { frames: Spr.fx.plasma, speed: 18, h: 0.26, radius: 0.12, damage: [12, 22], fps: 20, bright: true },
    rocket: { frames: Spr.fx.rocket, speed: 12, h: 0.34, radius: 0.18, damage: [40, 80], fps: 14, bright: true, splash: 2.6, splashDmg: 70 },
    /* Slow, fat, and detonates into a wide arc field — good for corridors. */
    shockorb: { frames: Spr.fx.plasma, speed: 6.5, h: 0.62, radius: 0.30, damage: [0, 0], fps: 22, bright: true, splash: 3.6, splashDmg: 62 },
    /* Airbursts into bomblets on impact. */
    cluster: { frames: Spr.fx.rocket, speed: 11.5, h: 0.36, radius: 0.18, damage: [0, 0], fps: 14, bright: true, splash: 2.1, splashDmg: 46, bomblets: 4 }
  };

  /* ==========================================================================
   * Spawning
   * ========================================================================== */
  function spawn(game, x, y, name) {
    if (ENEMIES[name]) return spawnEnemy(game, x, y, name);
    if (ITEMS[name]) {
      var d = ITEMS[name];
      return push(game, {
        kind: 'item', type: name, x: x, y: y, z: 0.04, h: d.h,
        pic: d.pic, radius: 0.42, bob: Math.random() * 6.28
      });
    }
    if (DECOR[name]) {
      var k = DECOR[name];
      return push(game, {
        kind: 'decor', type: name, x: x, y: y, z: 0, h: k.h, pic: k.pic,
        radius: k.radius, solid: !!k.solid || !!k.explosive, hp: k.hp || 0,
        explosive: !!k.explosive
      });
    }
    console.warn('unknown thing: ' + name);
    return null;
  }

  function spawnEnemy(game, x, y, name) {
    var d = ENEMIES[name];
    return push(game, {
      kind: 'enemy', type: name, def: d,
      x: x, y: y, z: 0, h: d.height, radius: d.radius,
      hp: d.hp, maxhp: d.hp, angle: Math.random() * TAU,
      state: 'idle', stateTime: 0, walkTime: Math.random() * 4,
      target: null, cooldown: 0.4 + Math.random(), moveDir: 0, moveTime: 0,
      pic: d.sprites.walk[0][0], mirror: false, alerted: false,
      deathFrame: 0, solid: true, threat: true
    });
  }

  function push(game, e) { game.entities.push(e); return e; }

  function spawnProjectile(game, owner, x, y, angle, kind, pitchZ) {
    var d = PROJECTILES[kind];
    var e = push(game, {
      kind: 'proj', type: kind, def: d,
      x: x, y: y, z: pitchZ === undefined ? 0.5 : pitchZ, h: d.h,
      vx: Math.cos(angle) * d.speed, vy: Math.sin(angle) * d.speed,
      radius: d.radius, owner: owner, life: 6, anim: 0,
      pic: d.frames[0], bright: d.bright
    });
    return e;
  }

  function spawnFX(game, x, y, z, frames, fps, scale, bright) {
    return push(game, {
      kind: 'fx', x: x, y: y, z: z, h: scale,
      frames: frames, fps: fps, anim: 0, pic: frames[0],
      bright: bright !== false, radius: 0
    });
  }

  function spawnCorpse(game, x, y, pic, h) {
    return push(game, { kind: 'corpse', x: x, y: y, z: 0, h: h, pic: pic, radius: 0 });
  }

  /* ==========================================================================
   * Damage
   * ========================================================================== */
  function hurt(game, e, amount, source) {
    if (e.kind === 'decor') {
      if (!e.explosive || e.dying) return;
      e.hp -= amount;
      if (e.hp <= 0) { e.dying = true; e.fuse = 0.06; }
      return;
    }
    if (e.kind !== 'enemy' || e.state === 'die' || e.state === 'dead') return;

    /* Every point of damage you land is worth clock. This is what keeps the
       loop alive in rooms where kills are rare — a long fight with a Baron
       pays you the whole way through instead of only at the end. */
    if (source === game.player) game.onDamageDealt(Math.min(amount, e.hp));

    e.hp -= amount;
    if (e.hp <= 0) {
      /* First lethal blow drops it to a knee instead of killing it. A staggered
         monster is a free execution if you close the distance — that is the
         whole risk/reward loop, since executions are what refill you. */
      if (!e.staggerUsed && !e.def.noStagger) {
        e.staggerUsed = true;
        e.hp = 1;
        e.state = 'stagger';
        e.stateTime = 0;
        e.threat = false;
        e.vulnerable = true;
        game.sound('stagger', e.x, e.y, 0.95, e.def.pitch);
        game.markStagger(e);
        return;
      }
      kill(game, e, amount);
      return;
    }
    /* infighting: retaliate against whoever actually hit you */
    if (source && source !== e && source.kind === 'enemy') e.target = source;
    else if (source === game.player || !e.target) e.target = game.player;
    e.alerted = true;

    if (Math.random() < e.def.pain && e.state !== 'pain') {
      e.state = 'pain'; e.stateTime = 0;
      game.sound('pain', e.x, e.y, 0.75, e.def.pitch);
    }
  }

  function kill(game, e, overkill, executed) {
    e.state = executed ? 'exec' : 'die';
    e.stateTime = 0;
    e.deathFrame = 0;
    e.solid = false;
    e.threat = false;
    e.bright = !!executed;
    e.glow = 0;
    e.vulnerable = false;
    e.gibbed = executed || overkill >= e.def.gib;
    game.sound('death', e.x, e.y, 0.9, e.def.pitch);
    game.stats.kills++;
    if (e.def.drop) {
      var it = spawn(game, e.x, e.y, e.def.drop);
      if (it) it.dropped = true;
    }
    game.onKill(e, executed);
    if (e.def.boss) game.onBossKilled(e);
  }

  /* Finisher. Only reachable on a staggered monster, and the only reliable
     source of health and chrono — so the game pushes you forward, not back. */
  function execute(game, e) {
    var bonus = Math.round(e.def.score * 0.75);
    var away = Math.atan2(e.y - game.player.y, e.x - game.player.x);
    var boss = !!e.def.boss;

    spawnFX(game, e.x, e.y, 0.30, Spr.fx.execute, 30, 0.78, true);
    kill(game, e, 9999, true);
    game.player.score += bonus;

    var n = boss ? 6 : 3;
    for (var i = 0; i < n; i++) spawnOrb(game, e.x, e.y, i % 3 === 2 ? 'chrono' : 'health');

    /* chunks thrown mostly away from you, so the camera sees them fly */
    var gn = boss ? 30 : 20;
    for (var g = 0; g < gn; g++) {
      var a = away + (Math.random() - 0.5) * 2.3;
      var sp = 1.1 + Math.random() * 3.6;
      spawnGib(game, e.x, e.y, 0.35 + Math.random() * 0.55,
        Math.cos(a) * sp, Math.sin(a) * sp, 1.6 + Math.random() * 3.6);
    }

    game.sound('execute', e.x, e.y, 1.0);
    game.onExecuteCamera(e);
    return bonus;
  }

  function spawnGib(game, x, y, z, vx, vy, vz) {
    return push(game, {
      kind: 'gib', x: x, y: y, z: z, h: 0.18,
      vx: vx, vy: vy, vz: vz, life: 2.4 + Math.random() * 1.6,
      pic: Spr.gib[(Math.random() * Spr.gib.length) | 0], radius: 0
    });
  }

  function updateGib(game, e, dt) {
    e.life -= dt;
    if (e.life <= 0) { e.remove = true; return; }
    e.vz -= 9.4 * dt;
    var nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
    if (!game.solidAt(nx, e.y)) e.x = nx; else e.vx = -e.vx * 0.35;
    if (!game.solidAt(e.x, ny)) e.y = ny; else e.vy = -e.vy * 0.35;
    e.z += e.vz * dt;
    if (e.z <= 0.03) {                            /* skid to a halt on the floor */
      e.z = 0.03;
      e.vz = -e.vz * 0.30;
      e.vx *= 0.55; e.vy *= 0.55;
      if (Math.abs(e.vz) < 0.45) { e.vz = 0; e.vx *= 0.2; e.vy *= 0.2; }
    }
  }

  function spawnOrb(game, x, y, type) {
    var a = Math.random() * TAU, s = 0.7 + Math.random() * 1.1;
    return push(game, {
      kind: 'orb', type: type, x: x, y: y, z: 0.36, h: 0.26,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 16, bob: Math.random() * TAU,
      pic: Spr.orb[type][0], bright: true, radius: 0
    });
  }

  function updateOrb(game, e, dt) {
    e.life -= dt;
    if (e.life <= 0) { e.remove = true; return; }
    e.bob += dt * 7;
    var p = game.player;
    var dx = p.x - e.x, dy = p.y - e.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    if (d < 3.4) {                                   /* drifts toward you */
      var pull = (1 - d / 3.4) * 13;
      e.vx += dx / d * pull * dt;
      e.vy += dy / d * pull * dt;
    }
    var damp = Math.pow(0.22, dt);
    e.vx *= damp; e.vy *= damp;
    var nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
    if (!game.solidAt(nx, e.y)) e.x = nx; else e.vx = -e.vx * 0.4;
    if (!game.solidAt(e.x, ny)) e.y = ny; else e.vy = -e.vy * 0.4;
    e.z = 0.34 + Math.sin(e.bob) * 0.05;
    var fr = Spr.orb[e.type];
    e.pic = fr[((e.bob * 1.7) | 0) % fr.length];
    if (d < 0.62) { game.collectOrb(e.type); e.remove = true; }
  }

  function explode(game, x, y, radius, damage, source) {
    spawnFX(game, x, y, 0.35, Spr.fx.explosion, 18, 2.0, true);
    game.sound('explode', x, y, 1.0);
    game.shake(0.55);
    for (var i = 0; i < game.entities.length; i++) {
      var e = game.entities[i];
      if (e === source) continue;
      if (e.kind !== 'enemy' && !(e.kind === 'decor' && e.explosive)) continue;
      var dx = e.x - x, dy = e.y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > radius) continue;
      var amt = damage * (1 - d / radius);
      if (amt > 0) hurt(game, e, amt, source);
    }
    var pdx = game.player.x - x, pdy = game.player.y - y;
    var pd = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pd < radius) game.damagePlayer(damage * (1 - pd / radius) * 0.75, x, y);
  }

  /* ==========================================================================
   * Per frame update
   * ========================================================================== */
  function update(game, dt) {
    var list = game.entities;
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      switch (e.kind) {
        case 'enemy': updateEnemy(game, e, dt); break;
        case 'proj': updateProjectile(game, e, dt); break;
        case 'fx': updateFX(game, e, dt); break;
        case 'item': updateItem(game, e, dt); break;
        case 'orb': updateOrb(game, e, dt); break;
        case 'gib': updateGib(game, e, dt); break;
        case 'timer':
          e.fuse -= dt;
          if (e.fuse <= 0) { e.remove = true; explode(game, e.x, e.y, e.blastR, e.blastD, e.owner); }
          break;
        case 'decor': updateDecor(game, e, dt); break;
      }
      if (e.remove) list.splice(i, 1);
    }
  }

  function updateItem(game, e, dt) {
    e.bob += dt * 3;
    e.z = 0.04 + Math.sin(e.bob) * 0.02;
    var p = game.player;
    var dx = p.x - e.x, dy = p.y - e.y;
    if (dx * dx + dy * dy < 0.30) {
      var def = ITEMS[e.type];
      if (def.time) {
        if (p.clock >= p.clockCap - 0.5) return;
        game.addTime(game.timeValue(def.time), 'TIME CELL');
        game.sound(def.snd, e.x, e.y, 0.9);
        game.pickupFlash = 0.5;
        game.stats.items++;
        e.remove = true;
        return;
      }
      if (def.give(p)) {
        if (def.bonus) game.addTime(game.timeValue(def.bonus), 'KEYCARD');
        game.message(def.msg);
        game.sound(def.snd, e.x, e.y, 0.9);
        game.pickupFlash = 0.5;
        if (def.weapon !== undefined) p.faceGrin = 1.2;
        game.stats.items++;
        e.remove = true;
      }
    }
  }

  function updateDecor(game, e, dt) {
    if (e.dying) {
      e.fuse -= dt;
      if (e.fuse <= 0) {
        e.remove = true;
        explode(game, e.x, e.y, 2.4, 60, e);
      }
    }
  }

  function updateFX(game, e, dt) {
    e.anim += dt * e.fps;
    var f = e.anim | 0;
    if (f >= e.frames.length) { e.remove = true; return; }
    e.pic = e.frames[f];
  }

  function updateProjectile(game, e, dt) {
    e.anim += dt * e.def.fps;
    e.pic = e.def.frames[(e.anim | 0) % e.def.frames.length];
    e.life -= dt;
    if (e.life <= 0) { e.remove = true; return; }

    /* substep so fast projectiles cannot tunnel through walls */
    var steps = Math.max(1, Math.ceil(e.def.speed * dt / 0.18));
    var sdt = dt / steps;
    for (var s = 0; s < steps; s++) {
      var nx = e.x + e.vx * sdt, ny = e.y + e.vy * sdt;
      if (game.solidAt(nx, ny)) { impact(game, e, e.x, e.y); return; }
      e.x = nx; e.y = ny;

      /* entity hits */
      for (var i = 0; i < game.entities.length; i++) {
        var o = game.entities[i];
        if (o === e || o === e.owner) continue;
        if (!(o.kind === 'enemy' && o.state !== 'die' && o.state !== 'dead') &&
            !(o.kind === 'decor' && o.explosive)) continue;
        var dx = o.x - e.x, dy = o.y - e.y;
        var rr = o.radius + e.radius;
        if (dx * dx + dy * dy < rr * rr) { impact(game, e, e.x, e.y, o); return; }
      }
      /* player hit */
      if (e.owner !== game.player) {
        var px = game.player.x - e.x, py = game.player.y - e.y;
        if (px * px + py * py < 0.14) { impact(game, e, e.x, e.y, game.player); return; }
      }
    }
  }

  function impact(game, e, x, y, victim) {
    e.remove = true;
    var d = e.def, mul = e.dmgMul || 1;
    if (d.splash) {
      explode(game, x, y, d.splash, d.splashDmg * mul, e.owner);
      if (d.bomblets) {
        for (var c = 0; c < d.bomblets; c++) {
          var a = Math.random() * TAU, rr = 0.9 + Math.random() * 1.6;
          var bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr;
          if (game.solidAt(bx, by)) continue;
          push(game, {
            kind: 'timer', x: bx, y: by, fuse: 0.10 + c * 0.075,
            blastR: d.splash * 0.85, blastD: d.splashDmg * 0.65 * mul,
            owner: e.owner, pic: null, radius: 0
          });
        }
      }
      return;
    }
    var dmg = (d.damage[0] + Math.random() * (d.damage[1] - d.damage[0])) * mul;
    if (victim === game.player) {
      game.damagePlayer(dmg, x, y);
      spawnFX(game, x, y, e.z, Spr.fx.blood, 22, 0.5);
    } else if (victim) {
      hurt(game, victim, dmg, e.owner);
      spawnFX(game, x, y, e.z, victim.kind === 'enemy' ? Spr.fx.blood : Spr.fx.spark, 22, 0.5);
    } else {
      spawnFX(game, x, y, e.z, e.type === 'plasma' ? Spr.fx.zap : Spr.fx.spark, 24, 0.45);
    }
    game.sound(e.type === 'plasma' ? 'plasma' : 'melee', x, y, 0.45);
  }

  /* Soft body separation. Two monsters that end up overlapping would otherwise
     block each other's move test forever and freeze in place; nudging them
     apart also stops crowds from stacking into a single sprite. */
  function separate(game, e, dt) {
    var push = Math.min(1, dt * 9);
    for (var i = 0; i < game.entities.length; i++) {
      var o = game.entities[i];
      if (o === e || !o.solid) continue;
      var dx = e.x - o.x, dy = e.y - o.y;
      var rr = e.radius + o.radius;
      var d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      var d = Math.sqrt(d2);
      if (d < 1e-4) { dx = Math.cos(i * 2.4); dy = Math.sin(i * 2.4); d = 1; }
      var k = (rr - d) * 0.5 * push;
      var nx = e.x + (dx / d) * k, ny = e.y + (dy / d) * k;
      var r = e.radius;
      if (!game.solidAt(nx - r, ny - r) && !game.solidAt(nx + r, ny - r) &&
          !game.solidAt(nx - r, ny + r) && !game.solidAt(nx + r, ny + r)) {
        e.x = nx; e.y = ny;
      }
    }
  }

  /* ---- monster brain ------------------------------------------------------ */
  function updateEnemy(game, e, dt) {
    var d = e.def;
    e.stateTime += dt;
    if (e.state !== 'die' && e.state !== 'dead') separate(game, e, dt);

    if (e.state === 'die') {
      var frames = d.sprites.die.length;
      var idx = Math.floor(e.stateTime * (e.gibbed ? 15 : 11));
      if (idx >= frames) {
        idx = frames - 1;
        e.state = 'dead';
        spawnCorpse(game, e.x, e.y, d.sprites.die[frames - 1], d.height * 0.55);
        e.remove = true;
        return;
      }
      e.pic = d.sprites.die[idx];
      e.mirror = false;
      return;
    }

    if (e.state === 'stagger') {
      e.pic = pick(d.sprites.pain[0], e, game);
      /* A slow ember pulse from across the room, tightening to a hard strobe
         once you are close enough and facing it — so the glow tells you not
         just "this one is wounded" but "you can do it right now". */
      var ready = game.canExecute(e);
      var rate = ready ? 10 : 4.2;
      /* Kept deliberately shy of full brightness: the point is a pulse you
         notice, not a whiteout that erases the thing you are aiming at. */
      var lo = ready ? 0.26 : 0.05, hi = ready ? 0.72 : 0.26;
      var wave = 0.5 + 0.5 * Math.sin(e.stateTime * rate);
      e.glow = lo + (hi - lo) * wave * wave;
      e.bright = false;
      /* fading out as the window closes */
      var left = 4.2 - e.stateTime;
      if (left < 1.0) e.glow *= Math.max(0.15, left);
      if (e.stateTime > 4.2) { e.glow = 0; kill(game, e, 0); }
      return;
    }

    if (e.state === 'exec') {
      var ex = d.sprites.exec;
      var xi = Math.floor(e.stateTime * 16);
      if (xi >= ex.length) {
        e.glow = 0; e.bright = false;
        spawnCorpse(game, e.x, e.y, ex[ex.length - 1], d.height * 0.5);
        e.state = 'dead';
        e.remove = true;
        return;
      }
      e.pic = ex[xi];
      e.mirror = false;
      e.bright = xi < 1;                       /* only the contact frame blows out */
      e.glow = xi < 4 ? 0.62 - xi * 0.15 : 0;
      return;
    }

    if (e.state === 'pain') {
      e.pic = pick(d.sprites.pain[0], e, game);
      if (e.stateTime >= d.painTime) { e.state = 'chase'; e.stateTime = 0; }
      return;
    }

    var p = game.player;
    var tgt = e.target;
    if (tgt && (tgt.kind === 'enemy' && (tgt.state === 'die' || tgt.state === 'dead' || tgt.remove))) tgt = e.target = null;
    if (!tgt) tgt = p;

    var dx = tgt.x - e.x, dy = tgt.y - e.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    /* --- idle: wake on sight --- */
    if (e.state === 'idle') {
      e.pic = pick(d.sprites.walk[0], e, game);
      if (game.player.dead) return;
      if (dist < d.alertRange && game.lineOfSight(e.x, e.y, p.x, p.y)) {
        var facing = Math.abs(norm(Math.atan2(dy, dx) - e.angle));
        if (facing < 1.9 || dist < 6 || game.noiseAlert) {
          e.state = 'chase'; e.stateTime = 0; e.alerted = true; e.target = p;
          game.sound('sight', e.x, e.y, 0.85, d.pitch);
        }
      }
      return;
    }

    /* --- attack windup / release --- */
    if (e.state === 'attack') {
      var k = e.stateTime < d.windup * 0.55 ? 0 : 1;
      e.pic = pick(d.sprites.attack[k], e, game);
      e.angle = Math.atan2(dy, dx);
      if (!e.fired && e.stateTime >= d.windup) {
        e.fired = true;
        fire(game, e, tgt, dist);
      }
      if (e.stateTime >= d.windup + 0.30) {
        e.state = 'chase'; e.stateTime = 0;
        e.cooldown = d.cooldown[0] + Math.random() * (d.cooldown[1] - d.cooldown[0]);
      }
      return;
    }

    /* --- chase --- */
    e.cooldown -= dt;
    e.walkTime += dt;
    e.pic = pick(d.sprites.walk[(e.walkTime * 5.5 | 0) % 4], e, game);

    var canSee = game.lineOfSight(e.x, e.y, tgt.x, tgt.y);
    var meleeRange = d.attack === 'melee' ? d.range : (d.meleeRange || 0);

    if (e.cooldown <= 0 && canSee) {
      var inRange = (d.attack === 'melee') ? dist < d.range : dist < d.range;
      if (meleeRange && dist < meleeRange) inRange = true;
      if (inRange) {
        e.state = 'attack'; e.stateTime = 0; e.fired = false;
        e.usedMelee = meleeRange && dist < meleeRange && d.attack !== 'melee';
        return;
      }
    }

    /* move */
    var speed = d.speed * dt;
    var wantAngle = Math.atan2(dy, dx);
    e.moveTime -= dt;
    if (e.moveTime <= 0 || canSee) { e.moveDir = wantAngle; e.moveTime = 0.35; }

    /* Doom style: try the direct route, then progressively wider deflections */
    var tries = [0, 0.5, -0.5, 1.05, -1.05, 1.9, -1.9, 2.6, -2.6];
    var moved = false;
    for (var t = 0; t < tries.length; t++) {
      var a = e.moveDir + tries[t];
      var nx = e.x + Math.cos(a) * speed, ny = e.y + Math.sin(a) * speed;
      if (game.canMove(nx, ny, e.radius, e)) {
        e.x = nx; e.y = ny;
        e.angle = a;
        if (t > 0) { e.moveDir = a; e.moveTime = 0.5 + Math.random() * 0.6; }
        moved = true;
        break;
      }
    }
    /* Nothing worked — slide along whichever axis is still free. Without this a
       bulky monster wedged into a corner can never dig itself out. */
    if (!moved) {
      var ax = e.x + Math.cos(e.moveDir) * speed, ay = e.y + Math.sin(e.moveDir) * speed;
      if (game.canMove(ax, e.y, e.radius, e)) { e.x = ax; moved = true; }
      if (game.canMove(e.x, ay, e.radius, e)) { e.y = ay; moved = true; }
    }
    if (!moved) { e.moveDir += (Math.random() < 0.5 ? 1 : -1) * 1.6; e.moveTime = 0.5; }

    /* barge open doors */
    game.monsterUseDoor(e);
  }

  function fire(game, e, tgt, dist) {
    var d = e.def;
    var isPlayer = tgt === game.player;
    var ang = Math.atan2(tgt.y - e.y, tgt.x - e.x);

    if (e.usedMelee || d.attack === 'melee') {
      var mr = d.attack === 'melee' ? d.range : d.meleeRange;
      if (dist <= mr + 0.35) {
        var md = d.attack === 'melee'
          ? d.damage[0] + Math.random() * (d.damage[1] - d.damage[0])
          : d.melee;
        if (isPlayer) game.damagePlayer(md, e.x, e.y);
        else hurt(game, tgt, md, e);
        game.sound('melee', e.x, e.y, 0.8);
      }
      return;
    }

    if (d.attack === 'hitscan') {
      game.sound('pistol', e.x, e.y, 0.7);
      for (var s = 0; s < d.shots; s++) {
        var a = ang + (Math.random() - 0.5) * d.spread * 2;
        var hit = game.hitscan(e.x, e.y, a, d.range, e);
        var dmg = d.damage[0] + Math.random() * (d.damage[1] - d.damage[0]);
        if (hit.entity) {
          /* something else walked into the line of fire — that starts a feud */
          hurt(game, hit.entity, dmg, e);
          spawnFX(game, hit.x, hit.y, 0.5, Spr.fx.blood, 22, 0.5);
        } else if (hit.dist > dist - 0.7 && Math.random() < d.accuracy) {
          if (isPlayer) game.damagePlayer(dmg, e.x, e.y);
          else hurt(game, tgt, dmg, e);
        } else {
          spawnFX(game, hit.x, hit.y, 0.5, Spr.fx.spark, 24, 0.4);
        }
      }
      return;
    }

    /* projectile */
    var sx = e.x + Math.cos(ang) * (e.radius + 0.30);
    var sy = e.y + Math.sin(ang) * (e.radius + 0.30);
    if (!game.solidAt(sx, sy)) {
      spawnProjectile(game, e, sx, sy, ang, d.projectile, e.h * 0.62);
      game.sound(d.projectile === 'hellball' ? 'rocket' : 'plasma', e.x, e.y, 0.8);
    }
  }

  /* Choose the right rotation of a 3 view sprite set for the current camera. */
  function pick(views, e, game) {
    var toCam = Math.atan2(game.player.y - e.y, game.player.x - e.x);
    var rel = norm(e.angle - toCam);
    var oct = Math.round(rel / (Math.PI / 4));
    var a = Math.abs(oct);
    e.mirror = oct < 0;
    if (a === 0) return views[Spr.FRONT];
    if (a <= 2) return views[Spr.SIDE];
    return views[Spr.BACK];
  }

  global.Ent = {
    ENEMIES: ENEMIES, ITEMS: ITEMS, DECOR: DECOR, PROJECTILES: PROJECTILES,
    spawn: spawn, spawnProjectile: spawnProjectile, spawnFX: spawnFX,
    spawnOrb: spawnOrb, spawnGib: spawnGib, execute: execute,
    update: update, hurt: hurt, explode: explode, norm: norm
  };
})(window);
