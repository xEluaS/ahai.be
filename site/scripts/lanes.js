/* AhAi: Wat ik doe, where are you?
   Each service is a band you can open. One is open at a time, so the
   section reads as a choice rather than a wall of text. A link to a
   service (the hero bands, "Past het best bij") opens that band.
   Without JavaScript every band stays open. */
(function () {
  "use strict";

  var box = document.querySelector("[data-lanes]");
  if (!box) return;
  var lanes = Array.prototype.slice.call(box.querySelectorAll(".lane"));
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* instant: no folding, so nothing shifts while the page scrolls there */
  function open(lane, instant) {
    if (instant) box.classList.add("is-instant");
    lanes.forEach(function (l) {
      var on = l === lane;
      l.classList.toggle("is-open", on);
      l.querySelector(".lane__band").setAttribute("aria-expanded", on ? "true" : "false");
      l.querySelector(".lane__more").inert = !on;
    });
    if (instant) {
      void box.offsetHeight;
      requestAnimationFrame(function () { box.classList.remove("is-instant"); });
    }
  }
  box.classList.add("is-choosing");
  lanes.forEach(function (lane) {
    lane.querySelector(".lane__band").addEventListener("click", function () {
      open(lane.classList.contains("is-open") ? null : lane);
    });
  });

  function laneFor(hash) {
    return lanes.filter(function (l) { return "#" + l.id === hash; })[0];
  }
  /* all bands start closed, unless the address points at one */
  var first = laneFor(location.hash);
  open(first || null, true);
  if (first) first.scrollIntoView({ block: "start" });
  window.addEventListener("hashchange", function () {
    var lane = laneFor(location.hash);
    if (lane) open(lane, true);
  });
  /* a link to a service opens its band first, then scrolls to it */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[href^='#']");
    var lane = a && laneFor(a.getAttribute("href"));
    if (!lane) return;
    ev.preventDefault();
    open(lane, true);
    if (history.pushState) history.pushState(null, "", "#" + lane.id);
    lane.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
  });
})();
