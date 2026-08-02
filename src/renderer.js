/* =============================================================================
 * renderer.js — the software 3D renderer.
 *
 *   * per-column DDA wall casting with textured columns
 *   * per-row textured floor and ceiling casting, with sky tiles
 *   * thin sliding doors resolved inside the DDA loop
 *   * depth sorted billboard sprites clipped against a per-column z-buffer
 *   * 32 level light diminishing straight out of the colormap
 *
 * Everything writes palette indices through COLORMAP into one Uint32 buffer,
 * which is blitted to a canvas once per frame and upscaled with nearest
 * neighbour filtering. That is what gives the chunky 1993 look.
 * ============================================================================= */
(function (global) {
  'use strict';

  var Pal = global.Pal, Tex = global.Tex;
  var CMAP = Pal.COLORMAP, PAL32 = Pal.PAL32, BRIGHT = Pal.BRIGHTMAP;
  var LL = Pal.LIGHT_LEVELS;

  function Renderer(canvas, w, h, statusH) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.setSize(w, h, statusH);
    this.fog = 1.25;
  }

  Renderer.prototype.setSize = function (w, h, statusH) {
    this.W = w; this.H = h;
    this.statusH = statusH;
    this.viewH = h - statusH;
    this.proj = h;                                        /* keeps 4:3 pixels square */
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.img = this.ctx.createImageData(w, h);
    this.buf8 = this.img.data;
    this.buf32 = new Uint32Array(this.buf8.buffer);
    this.zbuf = new Float32Array(w);
    this.wallTop = new Int32Array(w);
    this.wallBot = new Int32Array(w);
    this.rayDirX = new Float32Array(w);
    this.rayDirY = new Float32Array(w);
    this.colAngle = new Float32Array(w);
  };

  /* --------------------------------------------------------------------------
   * Main entry.  cam = {x, y, angle, pitch, z, flash}
   * ------------------------------------------------------------------------ */
  Renderer.prototype.render = function (world, cam, sprites, time) {
    var W = this.W, viewH = this.viewH;
    var dirX = Math.cos(cam.angle), dirY = Math.sin(cam.angle);
    var fov = cam.fov || 0.66;
    var planeX = -dirY * fov, planeY = dirX * fov;

    this.cam = cam;
    this.dirX = dirX; this.dirY = dirY;
    this.planeX = planeX; this.planeY = planeY;
    this.horizon = Math.round(viewH * 0.5 + cam.pitch);

    for (var x = 0; x < W; x++) {
      var cameraX = 2 * x / W - 1;
      var rx = dirX + planeX * cameraX, ry = dirY + planeY * cameraX;
      this.rayDirX[x] = rx; this.rayDirY[x] = ry;
      this.colAngle[x] = Math.atan2(ry, rx);
    }

    this.castWalls(world, cam, time);
    this.castPlanes(world, cam, time);
    this.drawSprites(world, cam, sprites);
    return this;
  };

  /* --------------------------------------------------------------------------
   * Walls
   * ------------------------------------------------------------------------ */
  Renderer.prototype.castWalls = function (world, cam, time) {
    var W = this.W, H = this.H, viewH = this.viewH, buf = this.buf32;
    var mw = world.w, mh = world.h;
    var horizon = this.horizon, proj = this.proj;
    var camZ = cam.z, fog = this.fog, ambient = world.ambient;
    var posX = cam.x, posY = cam.y;
    var TS = Tex.TS;

    for (var x = 0; x < W; x++) {
      var rayDirX = this.rayDirX[x], rayDirY = this.rayDirY[x];
      var mapX = posX | 0, mapY = posY | 0;
      var deltaX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
      var deltaY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);
      var stepX, stepY, sideDistX, sideDistY;

      if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaX; }
      else { stepX = 1; sideDistX = (mapX + 1 - posX) * deltaX; }
      if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaY; }
      else { stepY = 1; sideDistY = (mapY + 1 - posY) * deltaY; }

      var hit = 0, side = 0, dist = 0, texId = 0, texU = 0, glowTile = 0;
      var guard = 0;

      while (!hit && guard++ < 200) {
        if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
        else { sideDistY += deltaY; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= mw || mapY >= mh) break;

        var idx = mapY * mw + mapX;
        var type = world.type[idx];
        if (type === 0) continue;

        if (type === 2) {
          /* --- thin sliding door: intersect the slab at the tile centre --- */
          var open = world.dopen[idx];
          var axis = world.daxis[idx];                    /* 1 = slab across Y */
          var t, u;
          if (axis === 1) {
            if (rayDirY === 0) continue;
            t = (mapY + 0.5 - posY) / rayDirY;
            u = posX + t * rayDirX - mapX;
          } else {
            if (rayDirX === 0) continue;
            t = (mapX + 0.5 - posX) / rayDirX;
            u = posY + t * rayDirY - mapY;
          }
          if (t <= 0 || u < 0 || u >= 1 || u < open) continue;
          hit = 1;
          dist = t;
          side = axis;
          texId = world.wtex[idx];
          texU = u - open;
          glowTile = 0;
        } else {
          hit = 1;
          dist = side === 0 ? (sideDistX - deltaX) : (sideDistY - deltaY);
          texId = world.wtex[idx];
          if (side === 0) texU = posY + dist * rayDirY - mapY;
          else texU = posX + dist * rayDirX - mapX;
          if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) texU = 1 - texU;
        }
      }

      if (!hit) {
        this.zbuf[x] = 1e9;
        this.wallTop[x] = -1; this.wallBot[x] = viewH;
        continue;
      }
      if (dist < 0.02) dist = 0.02;
      this.zbuf[x] = dist;

      /* project */
      var yBot = horizon + camZ * proj / dist;
      var yTop = horizon + (camZ - 1) * proj / dist;
      var lineH = yBot - yTop;
      var d0 = Math.ceil(yTop), d1 = Math.floor(yBot);
      this.wallTop[x] = d0; this.wallBot[x] = d1;

      var tex = Tex.wall(texId);
      var frame = tex.fps ? tex.frames[((time * tex.fps) | 0) % tex.frames.length] : tex.frames[0];
      var glowMask = tex.glow;
      var tx = (texU * TS) | 0;
      if (tx < 0) tx = 0; else if (tx >= TS) tx = TS - 1;

      /* base light for this column */
      var light = ambient + dist * fog + (side === 1 ? 1.6 : 0);
      if (cam.flash > 0) light -= cam.flash * Math.max(0, 1 - dist / 7);
      light = light < 0 ? 0 : (light > LL - 1 ? LL - 1 : light);
      var li = light | 0;
      var cmapOff = li * 256;
      var glowOff = (li > 5 ? 5 : li) * 256;

      var yStart = d0 < 0 ? 0 : d0;
      var yEnd = d1 > viewH - 1 ? viewH - 1 : d1;
      var stepTex = TS / lineH;
      var texPos = (yStart - yTop) * stepTex;
      var col = tx * 1;
      var p = yStart * W + x;

      for (var y = yStart; y <= yEnd; y++) {
        var ty = texPos | 0;
        if (ty < 0) ty = 0; else if (ty >= TS) ty = TS - 1;
        var o = ty * TS + col;
        var c = frame[o];
        buf[p] = PAL32[glowMask && glowMask[o] ? CMAP[glowOff + c] : CMAP[cmapOff + c]];
        texPos += stepTex;
        p += W;
      }
    }
  };

  /* --------------------------------------------------------------------------
   * Floors, ceilings and sky
   * ------------------------------------------------------------------------ */
  Renderer.prototype.castPlanes = function (world, cam, time) {
    var W = this.W, viewH = this.viewH, buf = this.buf32;
    var mw = world.w, mh = world.h;
    var horizon = this.horizon, proj = this.proj;
    var camZ = cam.z, fog = this.fog, ambient = world.ambient;
    var posX = cam.x, posY = cam.y;
    var dirX = this.dirX, dirY = this.dirY, planeX = this.planeX, planeY = this.planeY;
    var TS = Tex.TS, flats = Tex.flats, sky = world.sky || Tex.sky;
    var animFrame = (time * 9) | 0;

    for (var y = 0; y < viewH; y++) {
      var isFloor = y > horizon;
      var denom = isFloor ? (y - horizon) : (horizon - y);
      if (denom <= 0) denom = 0.0001;
      var rowDist = (isFloor ? camZ : (1 - camZ)) * proj / denom;
      if (rowDist > 90) rowDist = 90;

      var stepX = rowDist * 2 * planeX / W;
      var stepY = rowDist * 2 * planeY / W;
      var wx = posX + rowDist * (dirX - planeX);
      var wy = posY + rowDist * (dirY - planeY);

      /* distance shading is constant across the row */
      var light = ambient + rowDist * fog;
      if (cam.flash > 0) light -= cam.flash * Math.max(0, 1 - rowDist / 7);
      var p = y * W;

      for (var x = 0; x < W; x++, p++) {
        if (isFloor ? (y <= this.wallBot[x]) : (y >= this.wallTop[x])) { wx += stepX; wy += stepY; continue; }

        var tx = wx | 0, ty = wy | 0;
        if (tx < 0) tx = 0; else if (tx >= mw) tx = mw - 1;
        if (ty < 0) ty = 0; else if (ty >= mh) ty = mh - 1;
        var ti = ty * mw + tx;

        var flatId = isFloor ? world.ftex[ti] : world.ctex[ti];

        if (!isFloor && flatId < 0) {
          /* sky: sample by view angle, independent of distance */
          var a = this.colAngle[x];
          var sx = ((a / 6.283185) * sky.w * 4) % sky.w;
          if (sx < 0) sx += sky.w;
          var sy = (y - horizon) * 1.15 + 104;
          if (sy < 0) sy = 0; else if (sy > sky.h - 1) sy = sky.h - 1;
          buf[p] = PAL32[sky.d[(sy | 0) * sky.w + (sx | 0)]];
          wx += stepX; wy += stepY;
          continue;
        }

        var l = light + world.tlight[ti];
        l = l < 0 ? 0 : (l > LL - 1 ? LL - 1 : l);
        var li = l | 0;

        var flat = flats[flatId] || flats[0];
        var frame = flat.fps ? flat.frames[animFrame % flat.frames.length] : flat.frames[0];
        var u = ((wx - tx) * TS) | 0, v = ((wy - ty) * TS) | 0;
        if (u < 0) u = 0; else if (u >= TS) u = TS - 1;
        if (v < 0) v = 0; else if (v >= TS) v = TS - 1;
        var o = v * TS + u;
        var c = frame[o];
        buf[p] = PAL32[CMAP[(flat.glow && flat.glow[o] ? (li > 4 ? 4 : li) : li) * 256 + c]];

        wx += stepX; wy += stepY;
      }
    }
  };

  /* --------------------------------------------------------------------------
   * Sprites
   * ------------------------------------------------------------------------ */
  Renderer.prototype.drawSprites = function (world, cam, sprites) {
    var W = this.W, viewH = this.viewH, buf = this.buf32;
    var horizon = this.horizon, proj = this.proj, camZ = cam.z;
    var dirX = this.dirX, dirY = this.dirY, planeX = this.planeX, planeY = this.planeY;
    var fog = this.fog, ambient = world.ambient;
    var invDet = 1.0 / (planeX * dirY - dirX * planeY);
    var list = [];

    for (var i = 0; i < sprites.length; i++) {
      var s = sprites[i];
      if (!s.pic) continue;
      var relX = s.x - cam.x, relY = s.y - cam.y;
      var tX = invDet * (dirY * relX - dirX * relY);
      var tY = invDet * (-planeY * relX + planeX * relY);
      if (tY <= 0.08) continue;
      s._tx = tX; s._ty = tY;
      list.push(s);
    }
    list.sort(function (a, b) { return b._ty - a._ty; });

    for (var n = 0; n < list.length; n++) {
      var sp = list[n];
      var pic = sp.pic, depth = sp._ty;
      var screenX = (W / 2) * (1 + sp._tx / depth);
      var zb = sp.z || 0;
      var hW = sp.h || 1;
      var yBottom = horizon + (camZ - zb) * proj / depth;
      var yTop = horizon + (camZ - zb - hW) * proj / depth;
      var sh = yBottom - yTop;
      if (sh < 0.5) continue;
      var sw = sh * (pic.w / pic.h);
      var x0 = screenX - sw / 2;

      var startX = Math.ceil(x0), endX = Math.floor(x0 + sw);
      if (endX < 0 || startX >= W) continue;
      if (startX < 0) startX = 0;
      if (endX > W - 1) endX = W - 1;

      var y0 = Math.ceil(yTop), y1 = Math.floor(yBottom);
      var yA = y0 < 0 ? 0 : y0, yB = y1 > viewH - 1 ? viewH - 1 : y1;
      if (yB < yA) continue;

      var light;
      if (sp.bright) light = 0;
      else {
        light = ambient + depth * fog + (sp.lightAdd || 0);
        if (cam.flash > 0) light -= cam.flash * Math.max(0, 1 - depth / 7);
        if (light < 0) light = 0; else if (light > LL - 1) light = LL - 1;
      }
      var cmapOff = (light | 0) * 256;
      var pw = pic.w, ph = pic.h, pd = pic.d;
      var stepY = ph / sh, stepX = pw / sw;
      var mirror = sp.mirror;

      for (var x = startX; x <= endX; x++) {
        if (depth >= this.zbuf[x]) continue;
        var u = ((x - x0) * stepX) | 0;
        if (u < 0) u = 0; else if (u >= pw) u = pw - 1;
        if (mirror) u = pw - 1 - u;
        var v = (yA - yTop) * stepY;
        var p = yA * W + x;
        for (var y = yA; y <= yB; y++) {
          var vi = v | 0;
          if (vi >= ph) vi = ph - 1;
          var c = pd[vi * pw + u];
          if (c !== 0) buf[p] = PAL32[CMAP[cmapOff + c]];
          v += stepY;
          p += W;
        }
      }
    }
  };

  /* --------------------------------------------------------------------------
   * Screen space blitting used by the weapon and the HUD
   * ------------------------------------------------------------------------ */
  Renderer.prototype.blit = function (pic, dx, dy, light, scale, bright) {
    var W = this.W, H = this.H, buf = this.buf32;
    scale = scale || 1;
    var cmapOff = (bright ? 0 : (light | 0)) * 256;
    var w = Math.round(pic.w * scale), h = Math.round(pic.h * scale);
    var sx = pic.w / w, sy = pic.h / h;
    var x0 = Math.round(dx), y0 = Math.round(dy);
    for (var y = 0; y < h; y++) {
      var py = y0 + y;
      if (py < 0 || py >= H) continue;
      var v = (y * sy) | 0;
      var row = v * pic.w, prow = py * W;
      for (var x = 0; x < w; x++) {
        var px = x0 + x;
        if (px < 0 || px >= W) continue;
        var c = pic.d[row + ((x * sx) | 0)];
        if (c !== 0) buf[prow + px] = PAL32[CMAP[cmapOff + c]];
      }
    }
  };

  /* Solid rectangle in palette colour. */
  Renderer.prototype.rect = function (x, y, w, h, colour) {
    var W = this.W, H = this.H, buf = this.buf32, c = PAL32[colour];
    var x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    var x1 = Math.min(W, (x + w) | 0), y1 = Math.min(H, (y + h) | 0);
    for (var j = y0; j < y1; j++) {
      var p = j * W;
      for (var i = x0; i < x1; i++) buf[p + i] = c;
    }
  };

  Renderer.prototype.line = function (x0, y0, x1, y1, colour) {
    var W = this.W, H = this.H, buf = this.buf32, c = PAL32[colour];
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var err = dx + dy, guard = 0;
    for (;;) {
      if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) buf[y0 * W + x0] = c;
      if ((x0 === x1 && y0 === y1) || guard++ > 4000) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  /* Whole screen tint, applied after everything else. */
  Renderer.prototype.tint = function (r, g, b, amount, fromY, toY) {
    if (amount <= 0) return;
    var W = this.W, buf8 = this.buf8;
    var a = Math.min(1, amount);
    var y0 = fromY || 0, y1 = toY === undefined ? this.H : toY;
    var start = y0 * W * 4, end = y1 * W * 4;
    for (var i = start; i < end; i += 4) {
      buf8[i] += (r - buf8[i]) * a;
      buf8[i + 1] += (g - buf8[i + 1]) * a;
      buf8[i + 2] += (b - buf8[i + 2]) * a;
    }
  };

  Renderer.prototype.present = function () {
    this.ctx.putImageData(this.img, 0, 0);
  };

  Renderer.prototype.clear = function (colour) {
    this.buf32.fill(PAL32[colour === undefined ? 1 : colour]);
  };

  global.Renderer = Renderer;
})(window);
