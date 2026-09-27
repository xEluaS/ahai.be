/* AhAi: Vragen als deze, a cloud of questions.
   A handful of questions is in view at once, each in its own cell of an
   invisible grid, so none can cover another. They come and go at their
   own pace and never drift; a new one takes a free cell, and a question
   that just left does not come straight back. Pointing at a question
   holds it and quiets the rest; clicking it shows the answer below.
   Without JavaScript, or with reduced motion, all questions stand still
   in one list. */
(function () {
  "use strict";

  var cloud = document.querySelector("[data-cloud]");
  if (!cloud) return;
  var list = cloud.querySelector(".cloud__all"), stage = cloud.querySelector("[data-stage]");
  var hint = cloud.querySelector("[data-hint]"), reply = cloud.querySelector("[data-reply]");
  var asked = cloud.querySelector("[data-asked]"), text = cloud.querySelector("[data-text]");
  var mode = cloud.querySelector("[data-mode]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  var QS = Array.prototype.map.call(list.querySelectorAll(".cloud__q"), function (b, i) {
    return { id: i, q: b.textContent, who: b.getAttribute("data-wie"), a: b.getAttribute("data-antwoord") };
  });

  /* ── The answer, shared by the cloud and the plain list ─────────── */
  var active = null; /* the shown item in the cloud whose answer is open */
  function answer(q, item) {
    if (active && active !== item) unpin(active, "open");
    active = item || null;
    if (item) { pin(item, "open"); item.el.classList.add("is-open"); }
    asked.textContent = q.q;
    text.textContent = q.a;
    hint.hidden = true;
    reply.hidden = false;
    reply.classList.add("is-before");
    void reply.offsetWidth;
    reply.classList.remove("is-before");
  }
  function close() {
    if (active) unpin(active, "open");
    active = null;
    reply.hidden = true;
    hint.hidden = false;
  }
  cloud.querySelector("[data-close]").addEventListener("click", close);
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !reply.hidden) close(); });
  list.addEventListener("click", function (ev) {
    var b = ev.target.closest(".cloud__q");
    if (b) answer(QS[Array.prototype.indexOf.call(list.querySelectorAll(".cloud__q"), b)], null);
  });

  /* ── The live cloud ──────────────────────────────────────────── */
  var FADE_IN = 900, FADE_OUT = 700, TICK = 100;
  var cells = [], shown = [], recent = [], target = 0, spawnIn = 0, timer = 0, onScreen = false, live = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* the grid adapts to the room: three columns on wide screens, one on
     phones, as many rows as fit; roughly half the cells hold a question */
  function layout() {
    var W = stage.clientWidth, H = stage.clientHeight;
    var cols = W >= 960 ? 3 : W >= 600 ? 2 : 1;
    var rows = Math.max(2, Math.floor(H / (cols === 1 ? 118 : 138)));
    cells = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      cells.push({ x: (c * W) / cols, y: (r * H) / rows, w: W / cols, h: H / rows, row: r, col: c, busy: null, left: 0 });
    }
    target = Math.max(2, Math.min(QS.length - 3, Math.round(cells.length * (cols === 1 ? 0.75 : 0.55))));
  }

  function nextQuestion() {
    var inView = shown.map(function (s) { return s.q.id; });
    var pool = QS.filter(function (q) { return inView.indexOf(q.id) < 0 && recent.indexOf(q.id) < 0; });
    if (!pool.length) pool = QS.filter(function (q) { return inView.indexOf(q.id) < 0; });
    return pick(pool);
  }
  function freeCell() {
    /* a free cell that was not just emptied, preferring one with no busy
       neighbour on the same row, so the cloud stays open */
    var free = cells.filter(function (c) { return !c.busy && Date.now() - c.left > 1500; });
    if (!free.length) free = cells.filter(function (c) { return !c.busy; });
    var calm = free.filter(function (c) {
      return !cells.some(function (o) { return o.busy && o.row === c.row && Math.abs(o.col - c.col) === 1; });
    });
    return free.length ? pick(calm.length ? calm : free) : null;
  }

  var SIZES = ["l", "m", "s"];
  function spawn() {
    var cell = freeCell(), q = nextQuestion();
    if (!cell || !q) return;
    var el = document.createElement("div"), b = document.createElement("button"), who = document.createElement("span");
    el.className = "cloud__item";
    b.type = "button";
    b.className = "cloud__q";
    var qt = document.createElement("span");
    qt.className = "cloud__qt";
    qt.textContent = q.q;
    b.appendChild(qt);
    who.className = "cloud__who label";
    who.textContent = q.who;
    if (q.who) b.appendChild(who);
    el.appendChild(b);
    el.style.maxWidth = Math.max(160, cell.w - 28) + "px";
    stage.appendChild(el);
    /* the largest size that fits its cell, then a random spot inside it */
    var sizes = SIZES.slice(Math.random() < 0.45 ? 0 : 1), size;
    for (var i = 0; i < sizes.length; i++) {
      size = sizes[i];
      el.setAttribute("data-size", size);
      if (el.offsetHeight <= cell.h - 12) break;
    }
    var x = cell.x + rand(0, Math.max(0, cell.w - el.offsetWidth - 16));
    var y = cell.y + rand(0, Math.max(0, cell.h - el.offsetHeight - 8));
    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
    var item = { el: el, q: q, cell: cell, life: rand(5200, 9000) * (Math.random() < 0.25 ? 1.5 : 1), holds: {} };
    cell.busy = item;
    shown.push(item);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });

    b.addEventListener("pointerenter", function () { focusOn(item, true); });
    b.addEventListener("pointerleave", function () { focusOn(item, false); });
    b.addEventListener("focus", function () { focusOn(item, true); });
    b.addEventListener("blur", function () { focusOn(item, false); });
    b.addEventListener("click", function () {
      if (active === item) close();
      else answer(q, item);
    });
  }

  function pinned(item) { return Object.keys(item.holds).some(function (k) { return item.holds[k]; }); }
  function pin(item, why) { item.holds[why] = true; item.el.classList.add("is-held"); }
  function unpin(item, why) {
    item.holds[why] = false;
    if (!pinned(item)) {
      item.el.classList.remove("is-held");
      item.life = Math.max(item.life, 1800); /* it lingers a moment after you let go */
    }
    item.el.classList.toggle("is-open", !!item.holds.open);
  }
  function focusOn(item, on) {
    if (on) pin(item, "hover"); else unpin(item, "hover");
    item.el.classList.toggle("is-focus", on);
    stage.classList.toggle("has-focus", shown.some(function (s) { return s.el.classList.contains("is-focus"); }));
  }

  function leave(item) {
    item.leaving = true;
    item.el.classList.remove("is-in");
    item.el.classList.add("is-out");
    recent.push(item.q.id);
    if (recent.length > Math.max(1, QS.length - target - 2)) recent.shift();
    setTimeout(function () {
      item.el.remove();
      item.cell.busy = null;
      item.cell.left = Date.now();
      shown.splice(shown.indexOf(item), 1);
    }, FADE_OUT);
  }

  function tick() {
    if (!onScreen || document.hidden) return;
    shown.forEach(function (item) {
      if (item.leaving || pinned(item)) return;
      item.life -= TICK;
      if (item.life <= 0) leave(item);
    });
    /* one question at a time arrives, a little after the last one */
    spawnIn -= TICK;
    var present = shown.filter(function (s) { return !s.leaving; }).length;
    if (spawnIn <= 0 && present < target) {
      spawn();
      spawnIn = rand(500, 1500);
    }
  }

  function start() {
    live = true;
    cloud.classList.add("is-live");
    stage.hidden = false;
    mode.hidden = false;
    mode.textContent = "Toon alle vragen";
    layout();
    spawnIn = 0;
    timer = setInterval(tick, TICK);
  }
  function stop() {
    live = false;
    clearInterval(timer);
    if (active) close();
    shown.forEach(function (s) { s.el.remove(); });
    shown = [];
    cells.forEach(function (c) { c.busy = null; });
    cloud.classList.remove("is-live");
    stage.hidden = true;
    stage.classList.remove("has-focus");
  }

  mode.addEventListener("click", function () {
    if (live) { stop(); mode.hidden = false; mode.textContent = "Laat ze weer verschijnen"; }
    else start();
  });

  if (reduce.matches) return; /* the plain list stays, nothing moves */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; }, { threshold: 0.15 }).observe(cloud);
  } else onScreen = true;
  start();

  /* a new width means a new grid: the cloud starts over, calmly */
  var lastW = stage.clientWidth, resizing = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizing);
    resizing = setTimeout(function () {
      if (!live || Math.abs(stage.clientWidth - lastW) < 40) return;
      lastW = stage.clientWidth;
      stop();
      start();
    }, 250);
  });
})();
