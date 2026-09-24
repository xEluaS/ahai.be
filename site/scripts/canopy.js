/* AhAi: the silk canopy.
   Each band is a ribbon on a cubic centre curve. It sags under gravity,
   narrows where it twists, drapes in soft folds that follow its curve,
   and carries a woven thread texture. Where two ribbons cross, the
   crossing is painted in an authored chord colour, clipped exactly to
   their intersection. Your work crossing AI is the one green: the aha. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var narrowQuery = window.matchMedia("(max-width: 760px)");
  var stripQuery = window.matchMedia("(max-width: 1199px)");
  var root = getComputedStyle(document.documentElement);
  function token(name) { return root.getPropertyValue(name).trim(); }

  var DYE = { indigo: token("--indigo"), madder: token("--madder"), saffron: token("--saffron"), chord: token("--chord-madder-saffron") };
  var TAG = { indigo: token("--tag-indigo"), madder: token("--tag-madder"), saffron: token("--tag-saffron") };
  var CHORD = {
    "indigo+saffron": token("--chord-work-ai"),
    "indigo+madder": token("--chord-work-why"),
    "madder+saffron": token("--chord-madder-saffron"),
    all: token("--chord-all")
  };

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function easeOut(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  /* a colour with every channel multiplied by k, for dye laid on under layers that darken it */
  function scale(hex, k) {
    var n = parseInt(hex.slice(1), 16), out = "#";
    [16, 8, 0].forEach(function (s) {
      var v = Math.min(255, Math.round(((n >> s) & 255) * k));
      out += (v < 16 ? "0" : "") + v.toString(16);
    });
    return out;
  }
  function f1(n) { return n.toFixed(1); }
  var uid = 0;

  /* ── Thread texture: generated once, shared by every ribbon ───── */
  var weaveURL = "";
  function makeWeave(done) {
    var S = 96, c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    /* dark threads only: the weave darkens the dye the way a doubled
       cloth does, and never washes it towards white */
    for (var y = 0; y < S; y += 2) {
      var a = 0.1 + rnd() * 0.14;
      g.fillStyle = "rgba(0,0,0," + a.toFixed(3) + ")"; g.fillRect(0, y + 1, S, 1);
    }
    for (var x = 0; x < S; x += 3) { g.fillStyle = "rgba(0,0,0,0.05)"; g.fillRect(x, 0, 1, S); }
    for (var i = 0; i < 22; i++) {
      var sy = Math.floor(rnd() * (S / 2)) * 2 + 1, sx = rnd() * S, sl = 6 + rnd() * 20;
      g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(sx, sy, sl, 1);
      if (sx + sl > S) g.fillRect(sx - S, sy, sl, 1);
    }
    if (c.toBlob) c.toBlob(function (b) { weaveURL = b ? URL.createObjectURL(b) : c.toDataURL(); done(); });
    else { weaveURL = c.toDataURL(); done(); }
  }

  /* ── Geometry ─────────────────────────────────────────────────── */
  function geometry(r) {
    if (r.fn) return geometryFn(r);
    var ax = r.a[0], ay = r.a[1], bx = r.b[0], by = r.b[1];
    var dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    var angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    /* a band being pulled in exists only up to its leading end */
    var U = r.reveal == null ? 1 : r.reveal;
    if (U <= 0.001) return { d: "", pts: [], angle: angle };
    var nx = -dy / len, ny = dx / len;
    if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
    var s = r.sag * len;
    var c1x = ax + dx / 3 + nx * s, c1y = ay + dy / 3 + ny * s;
    var c2x = ax + (2 * dx) / 3 + nx * s * r.skew, c2y = ay + (2 * dy) / 3 + ny * s * r.skew;
    var N = 72, pts = [];
    for (var i = 0; i <= N; i++) {
      var u = (U * i) / N, m = 1 - u;
      var x = m * m * m * ax + 3 * m * m * u * c1x + 3 * m * u * u * c2x + u * u * u * bx;
      var y = m * m * m * ay + 3 * m * m * u * c1y + 3 * m * u * u * c2y + u * u * u * by;
      var tx = 3 * m * m * (c1x - ax) + 6 * m * u * (c2x - c1x) + 3 * u * u * (bx - c2x);
      var ty = 3 * m * m * (c1y - ay) + 6 * m * u * (c2y - c1y) + 3 * u * u * (by - c2y);
      var tl = Math.hypot(tx, ty) || 1;
      var pinch = 1 - r.pinch * Math.pow(Math.sin(Math.PI * (u * r.folds + r.phase)), 2);
      pts.push({ x: x, y: y, px: -ty / tl, py: tx / tl, hw: (r.w / 2) * pinch });
    }
    if (U < 1) taper(pts, r.w * 0.9);
    return { d: offsetOutline(pts), pts: pts, angle: angle };
  }
  /* The leading end of a band being pulled in narrows as if the cloth
     turns almost edge-on there: a twisting thread, never a cut end. */
  function taper(pts, T) {
    var d = 0;
    for (var i = pts.length - 1; i >= 0; i--) {
      if (i < pts.length - 1) d += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      if (d >= T) break;
      pts[i].hw *= 0.14 + 0.86 * Math.sin((d / T) * (Math.PI / 2));
    }
  }
  /* A ribbon on any centre line u -> [x, y], sampled finely enough for a braid. */
  function geometryFn(r) {
    var N = r.samples || 140, pts = [], h = 0.5 / N;
    for (var i = 0; i <= N; i++) {
      var u = i / N, p = r.fn(u), a = r.fn(Math.max(0, u - h)), b = r.fn(Math.min(1, u + h));
      var tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      var pinch = 1 - r.pinch * Math.pow(Math.sin(Math.PI * (u * r.folds + r.phase)), 2);
      /* widthAt lets a strand swell as it turns towards the viewer */
      pts.push({ x: p[0], y: p[1], px: -ty / tl, py: tx / tl, hw: (r.w / 2) * pinch * (r.widthAt ? r.widthAt(u) : 1) });
    }
    var s0 = r.fn(0), s1 = r.fn(1);
    return { d: offsetOutline(pts), pts: pts, angle: (Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) * 180) / Math.PI };
  }
  function offsetOutline(pts) {
    var d = "", i, p;
    for (i = 0; i < pts.length; i++) { p = pts[i]; d += (i ? "L" : "M") + f1(p.x + p.px * p.hw) + "," + f1(p.y + p.py * p.hw); }
    for (i = pts.length - 1; i >= 0; i--) { p = pts[i]; d += "L" + f1(p.x - p.px * p.hw) + "," + f1(p.y - p.py * p.hw); }
    return d + "Z";
  }
  function offsetLine(pts, f) {
    var d = "";
    for (var i = 0; i < pts.length; i++) { var p = pts[i]; d += (i ? "L" : "M") + f1(p.x + p.px * p.hw * f) + "," + f1(p.y + p.py * p.hw * f); }
    return d;
  }

  /* Folds: lines of light and shade lying along the ribbon, blurred, so
     the cloth drapes instead of reading as a flat vector stroke. */
  var FOLDS = [
    { f: -0.93, w: 0.05, c: "#000", o: 0.24 },
    { f: -0.72, w: 0.16, c: "#000", o: 0.2 },
    { f: -0.4, w: 0.2, c: "#fff", o: 0.14 },
    { f: -0.08, w: 0.12, c: "#000", o: 0.14 },
    { f: 0.28, w: 0.24, c: "#fff", o: 0.16 },
    { f: 0.62, w: 0.14, c: "#000", o: 0.18 },
    { f: 0.93, w: 0.05, c: "#000", o: 0.24 }
  ];

  /* ── A set of ribbons in one SVG ──────────────────────────────── */
  function Silk(svg, opts) {
    this.svg = svg;
    this.opts = opts || {};
    this.ribbons = [];
    this.chords = [];
    this.overs = [];
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    this.defs = el("defs", {}, svg);
    var fid = "soft" + ++uid;
    var f = el("filter", { id: fid, x: "-20%", y: "-20%", width: "140%", height: "140%" }, this.defs);
    el("feGaussianBlur", { stdDeviation: this.opts.blur || 3.5 }, f);
    this.blur = "url(#" + fid + ")";
    /* chords lie beneath the texture: a crossing is two layers of cloth,
       so both weaves and both sets of folds run over it and deepen it */
    this.bodies = el("g", {}, svg);
    this.chordLayer = el("g", { class: "silk__chords" }, svg);
    this.texture = el("g", {}, svg);
    this.labels = el("g", {}, svg);
  }
  Silk.prototype.add = function (spec) {
    var id = ++uid;
    var r = {
      a: [0, 0], b: [0, 0], w: 40, sag: 0.04, skew: 0.85, pinch: 0.14, folds: 1, phase: 0.2,
      opacity: 0.9, weave: 1, sheen: 0.08, dye: "indigo", label: null, labelColor: "#fff", labelInset: 0
    };
    for (var key in spec) r[key] = spec[key];
    r.color = DYE[r.dye];

    var clip = el("clipPath", { id: "clip" + id }, this.defs);
    r.clipPath = el("path", {}, clip);
    r.clipRef = "url(#clip" + id + ")";

    var pat = el("pattern", { id: "weave" + id, width: 96, height: 96, patternUnits: "userSpaceOnUse" }, this.defs);
    el("image", { href: weaveURL, width: 96, height: 96 }, pat);
    var grad = el("linearGradient", { id: "sheen" + id, gradientUnits: "userSpaceOnUse" }, this.defs);
    [[0, 0], [0.18, 1], [0.34, 0], [0.6, 0.8], [0.78, 0], [1, 0.4]].forEach(function (s) {
      el("stop", { offset: s[0], "stop-color": "#fff", "stop-opacity": s[1] }, grad);
    });

    r.body = el("path", { class: "silk__body", fill: r.color, "fill-opacity": r.opacity }, this.bodies);

    var tex = el("g", { class: "silk__tex", "clip-path": r.clipRef }, this.texture);
    var folds = el("g", { filter: this.blur }, tex);
    r.foldPaths = FOLDS.map(function (fd) {
      return el("path", { fill: "none", stroke: fd.c, "stroke-opacity": fd.o, "stroke-linecap": "butt" }, folds);
    });
    r.weavePath = el("path", { fill: "url(#weave" + id + ")", opacity: r.weave }, tex);
    r.sheenPath = el("path", { fill: "url(#sheen" + id + ")", opacity: r.sheen, style: "mix-blend-mode:screen" }, tex);
    r.tex = tex;
    r.foldGroup = folds;
    r.pat = pat;
    r.grad = grad;

    if (r.label) {
      /* the outer group falls back with its band; the inner one is sewn on */
      var outer = el("g", { class: "silk__label" }, this.labels);
      var lg = el("g", {}, outer);
      r.labelTag = el("rect", { fill: TAG[r.dye] }, lg);
      r.labelText = el("text", {
        fill: r.labelColor, "font-size": 11.5, "font-weight": 500, "letter-spacing": "0.24em",
        "dominant-baseline": "central", style: "font-family:var(--font);text-transform:uppercase"
      }, lg);
      r.labelText.textContent = r.label;
      if (r.link) {
        r.labelArrow = el("path", { class: "silk__arrow", fill: "none", stroke: r.labelColor, "stroke-width": 1.3, "stroke-linecap": "square" }, lg);
        /* a keyboard focus ring that reads on any dye: sky inside, ink outside */
        r.ringIn = el("rect", { class: "silk__ring", fill: "none", stroke: token("--sky"), "stroke-width": 2 }, lg);
        r.ringOut = el("rect", { class: "silk__ring", fill: "none", stroke: token("--ink"), "stroke-width": 2 }, lg);
      }
      r.labelOuter = outer;
      r.labelGroup = lg;
    }
    this.ribbons.push(r);
    return r;
  };
  /* A chord: ribbon A painted again, clipped to B, and to C for three. */
  Silk.prototype.chord = function (a, b, c, lift) {
    var key = c ? "all" : [a.dye, b.dye].sort().join("+");
    var color = CHORD[key];
    if (!color) return;
    if (lift) color = scale(color, lift);
    var parent = this.chordLayer;
    if (c) parent = el("g", { "clip-path": c.clipRef }, parent);
    var p = el("path", { fill: color, "clip-path": b.clipRef }, parent);
    this.chords.push({ path: p, a: a });
  };
  /* A weave: `top` lies over `under`. Under's folds and sheen stop at top's
     edges, so the crossing reads over and under, while both weaves still
     run through the chord: two layers of cloth. The cut is an even-odd
     clip of both outlines, which inside the under band leaves under
     minus top. */
  Silk.prototype.over = function (top, under) {
    if (!under.cut) {
      var id = "under" + ++uid, cp = el("clipPath", { id: id }, this.defs);
      under.cut = { path: el("path", { "clip-rule": "evenodd" }, cp), ref: "url(#" + id + ")", tops: [] };
      under.foldGroup.setAttribute("clip-path", under.cut.ref);
      under.sheenPath.setAttribute("clip-path", under.cut.ref);
    }
    under.cut.tops.push(top);
    this.overs.push([top, under]);
  };
  Silk.prototype.isOver = function (a, b) {
    return this.overs.some(function (o) { return o[0] === a && o[1] === b; });
  };
  /* Lift one ribbon above the rest and let the others fall back; null
     puts everything back in its place. */
  Silk.prototype.lift = function (r) {
    var self = this, was = this.lifted;
    if (was === r) return;
    this.lifted = r;
    function restore(o) {
      /* only the lifted ribbon moves in the DOM, so the others keep their fades */
      [["bodies", "body"], ["texture", "tex"], ["labels", "labelOuter"]].forEach(function (pair) {
        var node = o[pair[1]], layer = self[pair[0]], next = null;
        if (!node) return;
        for (var k = self.ribbons.indexOf(o) + 1; k < self.ribbons.length && !next; k++) next = self.ribbons[k][pair[1]] || null;
        layer.insertBefore(node, next);
      });
      if (o.cut) { o.foldGroup.setAttribute("clip-path", o.cut.ref); o.sheenPath.setAttribute("clip-path", o.cut.ref); }
    }
    if (was) restore(was);
    this.ribbons.forEach(function (o) {
      var dim = !!r && o !== r;
      o.body.classList.toggle("is-dim", dim);
      o.tex.classList.toggle("is-dim", dim);
      if (o.labelOuter) o.labelOuter.classList.toggle("is-dim", dim);
      o.hot = o === r;
      if (o.labelOuter) o.labelOuter.classList.toggle("is-hot", o.hot);
    });
    this.chordLayer.classList.toggle("is-dim", !!r);
    if (r) {
      this.bodies.appendChild(r.body);
      this.texture.appendChild(r.tex);
      if (r.labelOuter) this.labels.appendChild(r.labelOuter);
      if (r.cut) { r.foldGroup.removeAttribute("clip-path"); r.sheenPath.removeAttribute("clip-path"); }
    }
    this.draw();
  };
  Silk.prototype.size = function () {
    var box = this.svg.getBoundingClientRect();
    this.W = Math.max(1, box.width);
    this.H = Math.max(1, box.height);
    this.svg.setAttribute("viewBox", "0 0 " + f1(this.W) + " " + f1(this.H));
    return this;
  };
  Silk.prototype.draw = function () {
    var W = this.W, H = this.H, i, j;
    for (i = 0; i < this.ribbons.length; i++) {
      var r = this.ribbons[i], geo = geometry(r);
      r.geo = geo;
      r.body.setAttribute("d", geo.d);
      r.clipPath.setAttribute("d", geo.d);
      r.weavePath.setAttribute("d", geo.d);
      r.sheenPath.setAttribute("d", geo.d);
      r.pat.setAttribute("patternTransform", "rotate(" + geo.angle.toFixed(2) + ")");
      /* while a band is pulled in, its sheen rides with the leading end */
      var tip = r.reveal != null && r.reveal < 1 && geo.pts.length ? geo.pts[geo.pts.length - 1] : null;
      r.grad.setAttribute("x1", r.a[0]); r.grad.setAttribute("y1", r.a[1]);
      r.grad.setAttribute("x2", tip ? f1(tip.x) : r.b[0]); r.grad.setAttribute("y2", tip ? f1(tip.y) : r.b[1]);
      for (j = 0; j < FOLDS.length; j++) {
        r.foldPaths[j].setAttribute("d", offsetLine(geo.pts, FOLDS[j].f));
        r.foldPaths[j].setAttribute("stroke-width", f1(Math.max(1.2, r.w * FOLDS[j].w)));
      }
      if (r.labelGroup) placeLabel(r, geo, W, H);
    }
    for (j = 0; j < this.chords.length; j++) this.chords[j].path.setAttribute("d", this.chords[j].a.geo.d);
    for (i = 0; i < this.ribbons.length; i++) {
      var u = this.ribbons[i];
      if (u.cut) u.cut.path.setAttribute("d", u.geo.d + u.cut.tops.map(function (t) { return t.geo.d; }).join(""));
    }
  };

  /* Sew a woven tag onto the ribbon where it becomes visible, plus an inset.
     The entry point is found exactly, not at the nearest sample, so the tag
     glides with the cloth instead of hopping from sample to sample. */
  function inside(x, y, W, H) { return x >= 0 && y >= 0 && x <= W && y <= H; }
  function entry(x0, y0, x1, y1, W, H) {
    var t = 0, dx = x1 - x0, dy = y1 - y0;
    if (x0 < 0 && dx > 0) t = Math.max(t, -x0 / dx);
    if (x0 > W && dx < 0) t = Math.max(t, (W - x0) / dx);
    if (y0 < 0 && dy > 0) t = Math.max(t, -y0 / dy);
    if (y0 > H && dy < 0) t = Math.max(t, (H - y0) / dy);
    return Math.min(1, t);
  }
  function placeLabel(r, geo, W, H) {
    var pts = geo.pts, run = 0, target = null, at = null;
    for (var p = 1; p < pts.length; p++) {
      var a = pts[p - 1], b = pts[p], x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
      var seg = Math.hypot(x1 - x0, y1 - y0);
      if (target === null && inside(x1, y1, W, H)) {
        target = run + (inside(x0, y0, W, H) ? 0 : entry(x0, y0, x1, y1, W, H) * seg) + r.labelInset;
      }
      if (target !== null && run + seg >= target) {
        var f = seg ? (target - run) / seg : 0;
        /* the tangent is blended between samples too, so the tag turns smoothly */
        var tx = a.py + (b.py - a.py) * f, ty = -(a.px + (b.px - a.px) * f);
        at = { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, ang: (Math.atan2(ty, tx) * 180) / Math.PI };
        break;
      }
      run += seg;
    }
    if (!at) { r.labelGroup.setAttribute("visibility", "hidden"); return; }
    var flipped = at.ang > 90 || at.ang < -90;
    if (at.ang > 90) at.ang -= 180;
    if (at.ang < -90) at.ang += 180;
    var len;
    try { len = r.labelText.getComputedTextLength(); } catch (e) { len = r.label.length * 10; }
    var track = 11.5 * 0.24, padX = 9, h = 22, end = len - track;
    var wide = end + padX * 2 + (r.hot && r.labelArrow ? 18 : 0);
    r.labelTag.setAttribute("x", -padX);
    r.labelTag.setAttribute("y", -h / 2);
    r.labelTag.setAttribute("width", f1(wide));
    r.labelTag.setAttribute("height", h);
    if (r.labelArrow) {
      var ax = end + 6;
      r.labelArrow.setAttribute("d", "M" + f1(ax) + ",0h11M" + f1(ax + 7) + ",-3.5l3.5,3.5-3.5,3.5");
      [[r.ringIn, 3], [r.ringOut, 5]].forEach(function (ring) {
        ring[0].setAttribute("x", f1(-padX - ring[1])); ring[0].setAttribute("y", f1(-h / 2 - ring[1]));
        ring[0].setAttribute("width", f1(wide + ring[1] * 2)); ring[0].setAttribute("height", f1(h + ring[1] * 2));
      });
    }
    /* a tag shows once its band has carried it fully into view */
    for (var q = 1, total = 0; q < pts.length; q++) total += Math.hypot(pts[q].x - pts[q - 1].x, pts[q].y - pts[q - 1].y);
    var shown = r.reveal == null || r.reveal >= 1 ? 1 : Math.max(0, Math.min(1, (total - target - (flipped ? 0 : wide)) / 60));
    r.labelGroup.setAttribute("opacity", shown.toFixed(2));
    r.labelGroup.removeAttribute("visibility");
    r.labelGroup.setAttribute("transform", "translate(" + f1(at.x) + "," + f1(at.y) + ") rotate(" + at.ang.toFixed(2) + ")");
  }

  /* ── Hero: your work, AI, and the explanation ─────────────────── */
  /* The bands weave in one by one: your work first, then expertise, and
     AI last, so the green aha appears as the final crossing. Each band is
     pulled in along its own path with a twisting leading end, and every
     band lies over one and under the other. Afterwards each band is a
     link to the service named after it. */
  var PULL = 1200, STAGGER = 450;
  function heroCanopy() {
    var svg = document.querySelector(".canopy");
    if (!svg) return null;
    var silk = new Silk(svg, { blur: 5 });
    var specs = [
      { dye: "madder", a: [-0.08, 0.2], b: [1.08, 0.5], w: 0.2, sag: 0.07, pinch: 0.2, folds: 1.1, phase: 0.62, label: "Expertise", link: true, enter: 1 },
      { dye: "indigo", a: [-0.08, 0.76], b: [1.08, 0.08], w: 0.3, sag: 0.05, pinch: 0.24, folds: 0.9, phase: 0.08, label: "Jouw werk", link: true, enter: 0 },
      { dye: "saffron", a: [0.22, -0.24], b: [1.08, 0.86], w: 0.25, sag: 0.04, pinch: 0.3, folds: 1.2, phase: 0.36, opacity: 0.88, label: "AI", labelColor: DYE.indigo, link: true, enter: 2 }
    ];
    var rb = specs.map(function (s) { var r = silk.add(s); r.spec = s; return r; });
    var why = rb[0], work = rb[1], ai = rb[2];
    silk.chord(work, why);
    silk.chord(why, ai);
    silk.chord(work, ai);
    /* In this weave every band lies under another where all three cross, so
       no folds reach that crossing, only three weaves, which darken it to
       about 0.7. Its dye is laid on lighter by that much, so it reads as
       the authored chord. */
    silk.chord(work, why, ai, 1 / 0.7);
    /* the weave: your work over expertise, expertise over AI, AI over your work */
    silk.over(work, why);
    silk.over(why, ai);
    silk.over(ai, work);

    var elapsed = reduce.matches ? Infinity : 0, begun = 0, raf = 0;
    var total = PULL + STAGGER * 2;
    /* where a band's centre line first enters the picture, so its leading
       end starts at the edge instead of travelling unseen */
    function entryU(r) {
      var pts = geometry({ a: r.a, b: r.b, w: r.w, sag: r.sag, skew: r.skew, pinch: 0, folds: 1, phase: 0 }).pts;
      for (var i = 0; i < pts.length; i++) {
        if (inside(pts[i].x, pts[i].y, silk.W, silk.H)) return Math.max(0, (i - 1) / (pts.length - 1));
      }
      return 0;
    }
    function place() {
      var W = silk.W, H = silk.H, narrow = narrowQuery.matches;
      rb.forEach(function (r) {
        var s = r.spec;
        var p = Math.max(0, Math.min(1, (elapsed - s.enter * STAGGER) / PULL)), e = easeInOut(p);
        r.a = [s.a[0] * W, s.a[1] * H];
        r.b = [s.b[0] * W, s.b[1] * H];
        r.w = s.w * H * (narrow ? 0.9 : 1);
        r.labelInset = narrow ? 24 : Math.max(28, (W - 1240) / 2 + 72);
        /* the twist travels along the cloth as it is pulled, then rests */
        r.phase = s.phase + (1 - e) * 1.1;
        r.sag = s.sag + (1 - e) * 0.02;
        if (r.uIn == null) r.uIn = entryU(r);
        r.reveal = p <= 0 ? 0 : r.uIn + (1 - r.uIn) * e;
      });
      silk.draw();
    }
    function frame(now) {
      if (!begun) begun = now;
      elapsed = now - begun;
      place();
      raf = elapsed < total ? requestAnimationFrame(frame) : 0;
    }
    function resize() {
      silk.size();
      rb.forEach(function (r) { r.uIn = null; });
      place();
    }
    resize();
    if (!reduce.matches) raf = requestAnimationFrame(frame);

    /* Links: the pointer finds the band it is over (at a crossing, the band
       lying on top), the keyboard reaches the same links through a list the
       canopy draws its focus ring for. */
    rb.forEach(function (r) { r.anchor = document.querySelector('.canopy__links a[data-band="' + r.dye + '"]'); });
    function bandAt(ev) {
      var box = svg.getBoundingClientRect(), pt = svg.createSVGPoint();
      pt.x = ev.clientX - box.left;
      pt.y = ev.clientY - box.top;
      var hits = rb.filter(function (r) { return r.geo && r.geo.d && r.body.isPointInFill(pt); });
      if (hits.length < 2) return hits[0] || null;
      for (var i = 0; i < hits.length; i++) {
        if (hits.every(function (o) { return o === hits[i] || silk.isOver(hits[i], o); })) return hits[i];
      }
      return hits[0];
    }
    function hover(r) { silk.lift(r); svg.style.cursor = r ? "pointer" : ""; }
    if (finePointer.matches) {
      svg.addEventListener("pointermove", function (ev) { hover(bandAt(ev)); });
      svg.addEventListener("pointerleave", function () { hover(null); });
    }
    svg.addEventListener("click", function (ev) {
      var r = bandAt(ev);
      if (r && r.anchor) r.anchor.click();
    });
    rb.forEach(function (r) {
      if (!r.anchor) return;
      r.anchor.addEventListener("focus", function () { r.labelOuter.classList.add("is-focus"); silk.lift(r); });
      r.anchor.addEventListener("blur", function () { r.labelOuter.classList.remove("is-focus"); silk.lift(null); });
    });
    return resize;
  }

  /* ── Herken je dit: your work, crossed by AI ──────────────────── */
  var TASKS = {
    excel: { name: "Excel-lijsten", items: [
      "Gegevens uit mails of pdf's overnemen, in plaats van ze over te typen.",
      "Een rommelige export opkuisen tot een tabel waar je mee kan werken.",
      "Uit honderd rijen halen wat opvalt, zonder zelf formules te bouwen."] },
    mails: { name: "Mails", items: [
      "Een lange mailwisseling samenvatten tot wat er van jou gevraagd wordt.",
      "Een eerste antwoord klaarzetten op vragen die altijd terugkomen.",
      "Een lastige mail herschrijven zodat hij vriendelijk en duidelijk is."] },
    verslagen: { name: "Verslagen", items: [
      "Notities van een vergadering omzetten in een verslag met taken.",
      "Een rapport van twintig pagina's samenvatten op één pagina.",
      "Een verslag herschrijven in gewone taal, voor wie niet van het vak is."] },
    planning: { name: "Planning", items: [
      "Een weekrooster opstellen dat met ieders wensen rekening houdt.",
      "Zien waar een planning knelt, nog voor het misloopt.",
      "Uit losse mails en lijstjes een overzicht maken van wie wat wanneer doet."] },
    zoeken: { name: "Informatie zoeken", items: [
      "Een antwoord vinden in jullie eigen handleidingen en procedures.",
      "Een lange richtlijn doorzoeken en uitleggen wat erin staat.",
      "De kern halen uit een document dat niemand graag leest."] }
  };

  function crossing() {
    var box = document.querySelector("[data-crossing]");
    if (!box) return null;
    var list = box.querySelector("[data-examples]");
    var items = Array.prototype.slice.call(list.children);
    var workTag = box.querySelector(".crossing__work");
    var jobLabel = box.querySelector("[data-job-label]");

    /* wide screens: one indigo band, three AI bands running frame to frame */
    var wide = new Silk(box.querySelector(".crossing__silk"), { blur: 4 });
    var band = wide.add({ dye: "indigo", w: 84, sag: 0.012, pinch: 0.12, folds: 1.6, phase: 0.3 });
    var ais = items.map(function (li, i) {
      var r = wide.add({ dye: "saffron", w: 42, sag: 0.02, pinch: 0.22, folds: 0.8, phase: 0.15 + i * 0.25, opacity: 0.88 });
      wide.chord(band, r);
      return r;
    });

    /* narrow screens: each example gets its own crossing, edge to edge */
    var strips = items.map(function (li, i) {
      var s = new Silk(li.querySelector(".x-strip"), { blur: 2 });
      var w = s.add({ dye: "indigo", w: 30, sag: 0.01, pinch: 0.1, folds: 1.3, phase: 0.2 + i * 0.2 });
      var a = s.add({ dye: "saffron", w: 26, sag: 0.02, pinch: 0.18, folds: 0.7, phase: 0.3, opacity: 0.88 });
      s.chord(w, a);
      return { silk: s, work: w, ai: a, at: [0.3, 0.56, 0.8][i] };
    });
    var pulse = items.map(function () { return 0; });

    function layout() {
      if (!stripQuery.matches) {
        wide.size();
        var rect = box.getBoundingClientRect(), W = wide.W, H = wide.H, bandY = 116;
        band.a = [-40, bandY - 5]; band.b = [W + 40, bandY + 7]; band.w = 84;
        workTag.style.top = f1(bandY - workTag.offsetHeight / 2) + "px";
        items.forEach(function (li, i) {
          var x = li.getBoundingClientRect().left - rect.left;
          ais[i].a = [x + 50, -40];
          ais[i].b = [x - 40, H + 40];
          ais[i].w = 42;
          ais[i].sag = 0.02 + pulse[i];
        });
        wide.draw();
      } else {
        workTag.style.top = "";
        strips.forEach(function (st) {
          st.silk.size();
          var W = st.silk.W, H = st.silk.H, cx = W * st.at;
          st.work.a = [-30, H / 2 - 2]; st.work.b = [W + 30, H / 2 + 3]; st.work.w = 32;
          st.ai.a = [cx + 30, -24]; st.ai.b = [cx - 30, H + 24]; st.ai.w = 26;
          st.silk.draw();
        });
      }
    }

    function retension() {
      if (reduce.matches || stripQuery.matches) return;
      var start = performance.now();
      function step(now) {
        var t = (now - start) / 520, live = false;
        for (var i = 0; i < pulse.length; i++) {
          var local = Math.max(0, Math.min(1, (t - i * 0.08) / 0.9));
          pulse[i] = -0.04 * Math.sin(Math.PI * local) * (1 - local * 0.4);
          if (local < 1) live = true;
        }
        layout();
        if (live) requestAnimationFrame(step);
        else { for (var k = 0; k < pulse.length; k++) pulse[k] = 0; layout(); }
      }
      requestAnimationFrame(step);
    }

    function setJob(key, instant) {
      var job = TASKS[key];
      if (!job) return;
      var texts = items.map(function (li) { return li.querySelector("p"); });
      var targets = [jobLabel].concat(texts);
      function apply() {
        jobLabel.textContent = job.name;
        texts.forEach(function (p, i) { p.textContent = job.items[i]; });
        layout();
      }
      if (instant || reduce.matches) { apply(); return; }
      targets.forEach(function (t) { t.classList.add("swapping", "swap-out"); });
      setTimeout(function () {
        apply();
        requestAnimationFrame(function () { targets.forEach(function (t) { t.classList.remove("swap-out"); }); });
      }, 150);
      retension();
    }
    document.querySelectorAll('input[name="task"]').forEach(function (input) {
      input.addEventListener("change", function () { if (input.checked) setJob(input.value); });
    });
    function sync() {
      var checked = document.querySelector('input[name="task"]:checked');
      if (checked) setJob(checked.value, true);
    }
    window.addEventListener("pageshow", sync);
    sync();
    return layout;
  }

  /* ── Sessions: one band per format, edge to edge ──────────────── */
  function lanes() {
    var fns = [];
    document.querySelectorAll(".lane").forEach(function (lane, i) {
      var silk = new Silk(lane.querySelector(".lane__silk svg"), { blur: 3.5 });
      var r = silk.add({ dye: lane.getAttribute("data-dye") || "indigo", w: 84, sag: 0.01, pinch: 0.12, folds: 1.8, phase: 0.15 + i * 0.3, opacity: 0.94 });
      function layout() {
        silk.size();
        var W = silk.W, H = silk.H, tilt = i % 2 ? -5 : 5;
        r.a = [-30, H / 2 + tilt];
        r.b = [W + 30, H / 2 - tilt];
        r.w = H * 0.8;
        silk.draw();
      }
      layout();
      fns.push(layout);
    });
    return function () { fns.forEach(function (f) { f(); }); };
  }

  /* ── Portrait placeholder: a swatch study until the photo lands ── */
  function portrait() {
    var svg = document.querySelector(".portrait svg");
    if (!svg) return null;
    var silk = new Silk(svg, { blur: 4 });
    var parts = [
      { dye: "madder", a: [-0.35, 0.233], b: [1.35, 0.727], w: 0.2, sag: 0.036, pinch: 0.2, phase: 0.5 },
      { dye: "indigo", a: [-0.35, 0.939], b: [1.35, 0.061], w: 0.28, sag: 0.029, pinch: 0.22, phase: 0.1 }
    ].map(function (s) { var r = silk.add(s); r.spec = s; return r; });
    silk.chord(parts[1], parts[0]);
    function layout() {
      silk.size();
      var W = silk.W, H = silk.H;
      parts.forEach(function (r) {
        r.a = [r.spec.a[0] * W, r.spec.a[1] * H];
        r.b = [r.spec.b[0] * W, r.spec.b[1] * H];
        r.w = r.spec.w * H;
      });
      silk.draw();
    }
    layout();
    return layout;
  }

  /* ── Back to top: the mark waits in the corner once the hero is gone,
     keeps only its arrow beside the closing AhA!, and rides up with the
     footer rather than covering it ─────────────────────────────── */
  function toTop() {
    var tile = document.querySelector(".totop"), hero = document.querySelector(".hero"), foot = document.querySelector(".footer");
    if (!tile || !hero || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (e) { tile.classList.toggle("is-shown", !e[0].isIntersecting); }).observe(hero);
    var end = document.querySelector(".closing"), fold = 0, quick = reduce.matches ? 0 : parseFloat(token("--d-quick")) || 150;
    if (end) new IntersectionObserver(function (e) {
      clearTimeout(fold);
      if (e[0].isIntersecting) {
        tile.classList.add("is-quiet");
        fold = setTimeout(function () { tile.classList.add("is-folded"); }, quick);
      } else {
        tile.classList.remove("is-folded");
        void tile.offsetWidth; /* the mark is back in layout before it fades in */
        tile.classList.remove("is-quiet");
      }
    }).observe(end);
    if (!foot) return;
    var queued = false;
    function lift() {
      queued = false;
      tile.style.setProperty("--lift", Math.max(0, Math.round(window.innerHeight - foot.getBoundingClientRect().top)) + "px");
    }
    window.addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(lift); } }, { passive: true });
    window.addEventListener("resize", lift);
    lift();
  }

  /* ── Menu on small screens ────────────────────────────────────── */
  function menu() {
    var toggle = document.querySelector(".menu-toggle");
    var panel = document.getElementById("menu");
    if (!toggle || !panel) return;
    function set(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Sluit" : "Menu";
      panel.classList.toggle("is-open", open);
    }
    toggle.addEventListener("click", function () { set(toggle.getAttribute("aria-expanded") !== "true"); });
    panel.addEventListener("click", function (ev) { if (ev.target.closest("a")) set(false); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { set(false); toggle.focus(); }
    });
  }

  /* ── The finale: the three silks weave into one ───────────────── */
  function braid() {
    var svg = document.querySelector(".braid__silk");
    if (!svg) return null;
    var silk = new Silk(svg, { blur: 3.5 });
    var strands = [
      { dye: "madder", label: "Expertise" },
      { dye: "indigo", label: "Jouw werk" },
      { dye: "saffron", label: "AI", labelColor: DYE.indigo }
    ].map(function (spec, i) {
      var r = silk.add({ dye: spec.dye, label: spec.label, labelColor: spec.labelColor || "#fff", pinch: 0.08, folds: 2, phase: i * 0.3, opacity: spec.dye === "saffron" ? 0.88 : 0.9 });
      r.index = i;
      return r;
    });
    silk.chord(strands[1], strands[0]);
    silk.chord(strands[0], strands[2]);
    silk.chord(strands[1], strands[2]);
    silk.chord(strands[1], strands[0], strands[2]);
    var weave = reduce.matches ? 1 : 0;
    function smooth(e0, e1, u) { var t = Math.max(0, Math.min(1, (u - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
    function layout() {
      silk.size();
      var W = silk.W, H = silk.H, narrow = narrowQuery.matches;
      /* separate lanes on the left, one braid from the middle onwards */
      var cy = H / 2, S = H * 0.3, A = H * 0.2, k = narrow ? 1.5 : 3.2;
      strands.forEach(function (r) {
        var off = (r.index - 1) * S, ph = (r.index * 2 * Math.PI) / 3;
        r.fn = function (u) {
          var m = weave * smooth(0.16, 0.58, u);
          return [-0.06 * W + u * 1.12 * W, cy + (1 - m) * off + m * A * Math.sin(2 * Math.PI * k * u + ph)];
        };
        r.a = r.fn(0);
        r.b = r.fn(1);
        r.w = H * (narrow ? 0.15 : 0.14);
        r.labelInset = narrow ? 24 : Math.max(28, (W - 1240) / 2 + 72);
      });
      silk.draw();
    }
    layout();
    if (!reduce.matches && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var t0 = performance.now();
        (function step(now) {
          var t = Math.min(1, (now - t0) / 1800);
          weave = easeOut(t);
          layout();
          if (t < 1) requestAnimationFrame(step);
        })(t0);
      }, { threshold: 0.35 });
      io.observe(svg);
    } else {
      weave = 1;
      layout();
    }
    return layout;
  }

  /* ── Klikt het? The meter ────────────────────────────────────────
     Your work runs straight to the edge; expertise and AI wind around it
     as far as the match reaches, then run on beside it. Each strand is
     cut into half turns: the halves in front are drawn over the blue and
     cross it as a chord (AI over your work is the green aha), the halves
     behind slip under it. The turns meet where the strands are furthest
     from the blue, so no seam ever shows on it. */
  function meter() {
    var svg = document.querySelector(".match__silk svg");
    if (!svg) return null;
    var silk = null, g = null, ratio = 0, raf = 0;
    function smooth(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
    function wrapAt(x) {
      var f = g.x0 + (g.xR - g.x0) * ratio;
      if (f <= g.x0) return 0;
      return Math.min(1, (f - g.x0) / (g.P / 2)) * smooth(g.x0 - g.P / 4, g.x0, x) * (1 - smooth(f, f + g.P / 2, x));
    }
    function theta(x) { return (2 * Math.PI * (x - g.x0)) / g.P; }
    /* sign -1 is expertise, above the blue; sign +1 is AI, below it */
    function strandY(sign, x) {
      var lane = g.cy + sign * g.S, helix = g.cy + sign * g.A * Math.cos(theta(x));
      return lane + (helix - lane) * wrapAt(x);
    }
    /* A ribbon wound around the blue faces you in front and behind, and
       turns edge-on at the top and bottom of each turn, where it narrows. */
    function facing(x) { return 1 - wrapAt(x) * 0.7 * (1 - Math.abs(Math.sin(theta(x)))); }
    function build() {
      silk = new Silk(svg, { blur: 3 });
      silk.size();
      var W = silk.W, H = silk.H, narrow = narrowQuery.matches;
      var inset = narrow ? 24 : Math.max(28, (W - 1240) / 2 + 72);
      g = { cy: H / 2, wI: H * 0.26, wS: H * 0.16, A: H * 0.24, S: H * 0.36, P: H * (narrow ? 1.7 : 2.4), xL: -0.02 * W, xR: 1.02 * W };
      /* the strands run straight past their tags before they start to turn */
      g.x0 = inset + (narrow ? 112 : 150) + g.P / 4;
      /* half-turn boundaries: there both strands are furthest from the blue */
      var cuts = [g.xL];
      for (var k = 0; g.x0 + (k * g.P) / 2 < g.xR; k++) cuts.push(g.x0 + (k * g.P) / 2);
      cuts.push(g.xR);
      var backs = [], fronts = [];
      [{ dye: "madder", sign: -1, label: "Expertise" }, { dye: "saffron", sign: 1, label: "AI", labelColor: DYE.indigo }].forEach(function (s) {
        for (var i = 0; i < cuts.length - 1; i++) {
          /* half turn i - 1: expertise lies in front on even turns, AI on odd ones */
          var turn = i - 1, inFront = turn >= 0 && (s.sign < 0 ? turn % 2 === 0 : turn % 2 === 1);
          (inFront ? fronts : backs).push({ s: s, xa: cuts[i], xb: cuts[i + 1] + (i < cuts.length - 2 ? 0.6 : 0), first: i === 0 });
        }
      });
      function strand(seg) {
        var r = silk.add({ dye: seg.s.dye, label: seg.first ? seg.s.label : null, labelColor: seg.s.labelColor || "#fff", pinch: 0, opacity: 1, samples: 36 });
        r.fn = function (u) { var x = seg.xa + (seg.xb - seg.xa) * u; return [x, strandY(seg.s.sign, x)]; };
        r.widthAt = function (u) { return facing(seg.xa + (seg.xb - seg.xa) * u); };
        r.w = g.wS;
        r.labelInset = inset;
        return r;
      }
      var under = backs.map(strand);
      var work = silk.add({ dye: "indigo", label: "Jouw werk", pinch: 0.1, folds: 1.4, phase: 0.2, opacity: 0.92 });
      work.fn = function (u) { return [g.xL + (g.xR - g.xL) * u, g.cy]; };
      work.w = g.wI;
      work.labelInset = inset;
      var over = fronts.map(strand);
      over.forEach(function (f) { silk.chord(f, work); silk.over(f, work); });
      under.forEach(function (b) { silk.over(work, b); });
    }
    function draw() {
      silk.ribbons.forEach(function (r) { r.a = r.fn(0); r.b = r.fn(1); });
      silk.draw();
    }
    return {
      /* null lets the strands wait beside your work; a score winds them in */
      show: function (score, onStep) {
        /* the strip may have changed size while it was hidden */
        if (!silk || Math.abs(svg.getBoundingClientRect().width - silk.W) > 1) build();
        cancelAnimationFrame(raf);
        var to = score == null ? 0 : Math.max(0, Math.min(1, score / 100)), from = ratio, t0 = 0;
        if (reduce.matches || score == null) { ratio = to; draw(); if (onStep) onStep(1); return; }
        raf = requestAnimationFrame(function step(now) {
          if (!t0) t0 = now;
          var t = Math.min(1, (now - t0) / 1600), e = 1 - Math.pow(1 - t, 3);
          ratio = from + (to - from) * e;
          draw();
          if (onStep) onStep(e);
          if (t < 1) raf = requestAnimationFrame(step);
        });
      },
      layout: function () {
        if (!svg.getBoundingClientRect().width) return;
        build();
        draw();
      }
    };
  }

  /* ── The mark: the i becomes ! on a spring ───────────────────── */
  /* Each mark's markup draws the i at its own weight; the ! is Lexend's at
     any weight: a stroke from cap height down to 241, then a dot sunk a
     touch below the baseline (the viewBox baseline sits at 750). */
  var BANG = { top: 50, bot: 509, sink: 5 };
  function marks() {
    document.querySelectorAll("[data-mark]").forEach(function (m) {
      var stem = m.querySelector(".mark__stem"), dot = m.querySelector(".mark__dot");
      if (!stem || !dot) return;
      var top0 = +stem.getAttribute("y"), bot0 = top0 + +stem.getAttribute("height");
      var cy0 = +dot.getAttribute("cy"), cy1 = 750 + BANG.sink - +dot.getAttribute("r");
      var x = 0, v = 0, target = 0, raf = 0, last = 0;
      function render() {
        var top = top0 + (BANG.top - top0) * x;
        var bot = bot0 + (BANG.bot - bot0) * x;
        stem.setAttribute("y", f1(top));
        stem.setAttribute("height", f1(Math.max(20, bot - top)));
        dot.setAttribute("cy", f1(cy0 + (cy1 - cy0) * x));
      }
      function step(now) {
        var dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        /* underdamped spring: overshoots about ten percent, settles in half a second */
        v += (-170 * (x - target) - 15 * v) * dt;
        x += v * dt;
        render();
        if (Math.abs(x - target) < 0.001 && Math.abs(v) < 0.002) { x = target; v = 0; render(); raf = 0; return; }
        raf = requestAnimationFrame(step);
      }
      m.aha = function (to) {
        target = to;
        if (reduce.matches) { x = to; v = 0; render(); return; }
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
      };
      if (m.hasAttribute("data-mark-hover")) {
        if (finePointer.matches) {
          m.addEventListener("pointerenter", function () { m.aha(1); });
          m.addEventListener("pointerleave", function () { m.aha(0); });
        }
        m.addEventListener("focus", function () { m.aha(1); });
        m.addEventListener("blur", function () { m.aha(0); });
      }
    });
  }

  /* ── The page ends on the aha ─────────────────────────────────── */
  function closing() {
    var mark = document.querySelector(".closing [data-mark]");
    if (!mark || !mark.aha) return;
    if (!("IntersectionObserver" in window)) { mark.aha(1); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { mark.aha(1); io.disconnect(); } });
    }, { threshold: 0.9 });
    io.observe(mark);
  }

  function start() {
    makeWeave(function () {
      var layouts = [heroCanopy(), crossing(), lanes(), portrait(), braid()].filter(Boolean);
      var m = meter();
      if (m) {
        /* klikt.js drives the meter; the page only keeps it in shape */
        window.AhAi = window.AhAi || {};
        window.AhAi.meter = m;
        layouts.push(m.layout);
      }
      var pending = 0;
      window.addEventListener("resize", function () {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(function () { layouts.forEach(function (f) { f(); }); });
      });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { layouts.forEach(function (f) { f(); }); });
      }
    });
    menu();
    marks();
    closing();
    toTop();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
