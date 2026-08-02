/* =============================================================================
 * pixbuf.js — indexed colour bitmap + the tiny drawing DSL every asset is
 * built from. There are no image files in this game: all art is generated
 * at load time by code, into these buffers.
 * ============================================================================= */
(function (global) {
  'use strict';

  var Pal = global.Pal;

  /* Deterministic PRNG so the procedural art is identical on every machine. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function PixBuf(w, h, fill) {
    this.w = w; this.h = h;
    this.d = new Uint8Array(w * h);
    if (fill) this.d.fill(fill);
  }

  PixBuf.prototype.px = function (x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  };

  PixBuf.prototype.get = function (x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  };

  /* Same as px but leaves the pixel alone when it is transparent underneath —
     used to keep highlights inside a silhouette. */
  PixBuf.prototype.pxIn = function (x, y, c) {
    if (this.get(x, y) !== 0) this.px(x, y, c);
  };

  PixBuf.prototype.fill = function (c) { this.d.fill(c); return this; };

  PixBuf.prototype.rect = function (x, y, w, h, c) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  };

  PixBuf.prototype.frame = function (x, y, w, h, c) {
    for (var i = 0; i < w; i++) { this.px(x + i, y, c); this.px(x + i, y + h - 1, c); }
    for (var j = 0; j < h; j++) { this.px(x, y + j, c); this.px(x + w - 1, y + j, c); }
    return this;
  };

  PixBuf.prototype.ellipse = function (cx, cy, rx, ry, c) {
    if (rx <= 0 || ry <= 0) return this;
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      var dy = (y - cy) / ry;
      var s = 1 - dy * dy;
      if (s < 0) continue;
      var hw = rx * Math.sqrt(s);
      for (var x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        var dx = (x - cx) / rx;
        if (dx * dx + dy * dy <= 1.0) this.px(x, y, c);
      }
    }
    return this;
  };

  /* Ellipse lit from the upper left using a palette ramp — the workhorse for
     making blobby sprite volumes read as three dimensional. */
  PixBuf.prototype.ellipseShaded = function (cx, cy, rx, ry, rampStart, rampLen, lo, hi) {
    lo = lo === undefined ? 0.15 : lo;
    hi = hi === undefined ? 1.0 : hi;
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry;
        var d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        var nz = Math.sqrt(Math.max(0, 1 - d2));
        /* light from (-0.55, -0.6, 0.58) */
        var l = (-dx * 0.55) + (-dy * 0.6) + nz * 0.58;
        l = Math.max(0, Math.min(1, l * 0.85 + 0.32));
        this.px(x, y, Pal.shade(rampStart, rampLen, lo + (hi - lo) * l));
      }
    }
    return this;
  };

  PixBuf.prototype.line = function (x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  };

  PixBuf.prototype.thickLine = function (x0, y0, x1, y1, r, c) {
    var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      this.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c);
    }
    return this;
  };

  /* Vertical gradient across a rect using a ramp. */
  PixBuf.prototype.vgrad = function (x, y, w, h, rampStart, rampLen, t0, t1) {
    for (var j = 0; j < h; j++) {
      var t = h === 1 ? t0 : t0 + (t1 - t0) * (j / (h - 1));
      var c = Pal.shade(rampStart, rampLen, t);
      for (var i = 0; i < w; i++) this.px(x + i, y + j, c);
    }
    return this;
  };

  /* Sprinkle ramp noise over existing non transparent pixels. */
  PixBuf.prototype.grain = function (rand, amount, rampStart, rampLen) {
    for (var i = 0; i < this.d.length; i++) {
      var c = this.d[i];
      if (c === 0) continue;
      if (c >= rampStart && c < rampStart + rampLen) {
        var n = Math.round((rand() - 0.5) * 2 * amount);
        var v = c + n;
        if (v < rampStart) v = rampStart;
        if (v > rampStart + rampLen - 1) v = rampStart + rampLen - 1;
        this.d[i] = v;
      }
    }
    return this;
  };

  /* Dark outline around the silhouette — makes sprites pop against walls. */
  PixBuf.prototype.outline = function (c) {
    var src = new Uint8Array(this.d);
    for (var y = 0; y < this.h; y++) {
      for (var x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== 0) continue;
        var n = 0;
        if (x > 0 && src[y * this.w + x - 1]) n = 1;
        else if (x < this.w - 1 && src[y * this.w + x + 1]) n = 1;
        else if (y > 0 && src[(y - 1) * this.w + x]) n = 1;
        else if (y < this.h - 1 && src[(y + 1) * this.w + x]) n = 1;
        if (n) this.d[y * this.w + x] = c;
      }
    }
    return this;
  };

  PixBuf.prototype.blit = function (src, dx, dy) {
    for (var y = 0; y < src.h; y++) {
      for (var x = 0; x < src.w; x++) {
        var c = src.d[y * src.w + x];
        if (c !== 0) this.px(dx + x, dy + y, c);
      }
    }
    return this;
  };

  PixBuf.prototype.clone = function () {
    var b = new PixBuf(this.w, this.h);
    b.d.set(this.d);
    return b;
  };

  PixBuf.prototype.mirrorX = function () {
    var b = new PixBuf(this.w, this.h);
    for (var y = 0; y < this.h; y++)
      for (var x = 0; x < this.w; x++)
        b.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
    return b;
  };

  /* Mirror the left half onto the right half, in place. Most creature art is
     drawn on one side only and reflected — halves the art code. */
  PixBuf.prototype.symmetrise = function () {
    var mid = this.w >> 1;
    for (var y = 0; y < this.h; y++)
      for (var x = 0; x < mid; x++)
        this.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
    return this;
  };

  /* Trim to the tight bounding box of non transparent pixels, returning both the
     new buffer and the offset that was removed (sprites need the offset to stay
     anchored at their feet). */
  PixBuf.prototype.trimmed = function () {
    var minX = this.w, minY = this.h, maxX = -1, maxY = -1;
    for (var y = 0; y < this.h; y++) {
      for (var x = 0; x < this.w; x++) {
        if (this.d[y * this.w + x] !== 0) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { buf: new PixBuf(1, 1), ox: 0, oy: 0 };
    var b = new PixBuf(maxX - minX + 1, maxY - minY + 1);
    for (var j = minY; j <= maxY; j++)
      for (var i = minX; i <= maxX; i++)
        b.d[(j - minY) * b.w + (i - minX)] = this.d[j * this.w + i];
    return { buf: b, ox: minX, oy: minY };
  };

  /* Scale by an integer factor (nearest neighbour, stays crunchy). */
  PixBuf.prototype.scale = function (n) {
    var b = new PixBuf(this.w * n, this.h * n);
    for (var y = 0; y < b.h; y++)
      for (var x = 0; x < b.w; x++)
        b.d[y * b.w + x] = this.d[((y / n) | 0) * this.w + ((x / n) | 0)];
    return b;
  };

  global.PixBuf = PixBuf;
  global.rng = rng;
})(window);
