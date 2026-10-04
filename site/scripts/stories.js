/* AhAi: the little story in each service band, told with a thread and
   its knots.
   Ik leg het uit: a tangled thread straightens into your question, an
     explanation with your own work, and doing it yourself.
   Ik kom kijken: the steps done by hand are taken over by AI one by one;
     the check stays with a person.
   Ik bouw het: the thread grows knot by knot, from an idea to a tool in use.
   Each story plays once when its band opens. Without JavaScript, or with
   reduced motion, the finished story shows. */
(function () {
  "use strict";

  var stories = Array.prototype.slice.call(document.querySelectorAll("[data-story]"));
  if (!stories.length) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ── Ik leg het uit: the tangle ─────────────────────────────── */
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function untangle(story, done) {
    var svg = story.querySelector(".story__tangle"), path = svg && svg.querySelector("path");
    var knots = story.querySelectorAll(".flow__knot");
    if (!path || knots.length < 2) { done(); return; }
    var box = svg.getBoundingClientRect(), first = knots[0].getBoundingClientRect(), last = knots[knots.length - 1].getBoundingClientRect();
    var x0 = first.left + first.width / 2 - box.left, x1 = last.left + last.width / 2 - box.left;
    var y = first.top + first.height / 2 - box.top, ax = (x1 - x0) * 0.11;
    svg.setAttribute("viewBox", "0 0 " + box.width.toFixed(1) + " " + box.height.toFixed(1));
    /* loops where the thread doubles back, flattening as m runs to 1 */
    function draw(m) {
      var d = "", k = 1 - m;
      for (var i = 0; i <= 90; i++) {
        var t = i / 90;
        var px = x0 + (x1 - x0) * t + ax * Math.sin(5 * Math.PI * t) * k;
        var py = y + 20 * Math.sin(7 * Math.PI * t + 0.6) * Math.cos(2 * Math.PI * t) * k;
        d += (i ? "L" : "M") + px.toFixed(1) + "," + py.toFixed(1);
      }
      path.setAttribute("d", d);
    }
    draw(0);
    var t0 = 0;
    requestAnimationFrame(function step(now) {
      if (!t0) t0 = now;
      var t = Math.min(1, (now - t0) / 1100);
      draw(easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
      else done();
    });
  }

  /* Back to the start without animating, then tell it again. */
  function tell(story) {
    story.classList.add("is-rewind");
    story.classList.remove("is-told");
    void story.offsetWidth;
    story.classList.remove("is-rewind");
    function told() { story.classList.add("is-told"); }
    if (story.classList.contains("story--untangle")) {
      /* a frame first, so the band has its size before the thread is measured */
      requestAnimationFrame(function () { untangle(story, told); });
    } else {
      requestAnimationFrame(told);
    }
  }

  stories.forEach(function (story) {
    story.querySelectorAll(".flow__step").forEach(function (step, i) {
      if (!step.style.getPropertyValue("--n")) step.style.setProperty("--n", i);
    });
    var lane = story.closest(".lane");
    /* the starting state only exists when the story can be told */
    if (reduce.matches || !lane) { story.classList.add("is-ready", "is-told"); return; }
    story.classList.add("is-ready");
    /* a band that was already open on arrival shows its story finished */
    if (lane.classList.contains("is-open")) story.classList.add("is-told");
    lane.addEventListener("lane-open", function () { tell(story); });
  });
})();
