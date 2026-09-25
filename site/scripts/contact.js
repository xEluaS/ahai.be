/* AhAi: the small helpers around contact.
   The copy button puts the address on the clipboard; the message form
   sends name, contact and question to the site's own service, which
   keeps it for Elias. Without JavaScript the mail links still work. */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Both words of the copy button share one cell, so the button keeps its
     width; "Gekopieerd" fades in over "Kopieer" and back after a while. */
  document.querySelectorAll("[data-copy]").forEach(function (button) {
    var told = button.parentNode.querySelector("[data-copy-status]"), back = 0;
    button.addEventListener("click", function () {
      var done = function () {
        clearTimeout(back);
        button.classList.add("is-done");
        if (told) told.textContent = "Gekopieerd";
        back = setTimeout(function () {
          button.classList.remove("is-done");
          if (told) told.textContent = "";
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(button.getAttribute("data-copy")).then(done, function () {});
      }
    });
  });

  var form = document.getElementById("bericht");
  if (!form) return;
  var status = form.querySelector(".bericht__status"), send = form.querySelector("button[type=submit]"), busy = false;
  var line = status.querySelector("[data-status-text]"), mark = status.querySelector("[data-mark]");
  /* A line comes in from just below; once a message has arrived, the mark
     before it turns its i into the aha. */
  function say(text, arrived) {
    line.textContent = text;
    status.hidden = !text;
    if (mark) {
      mark.hidden = !arrived;
      if (mark.aha) mark.aha(0);
    }
    if (!text) return;
    status.classList.add("is-before");
    void status.offsetWidth;
    status.classList.remove("is-before");
    if (arrived && mark && mark.aha) setTimeout(function () { mark.aha(1); }, reduce.matches ? 0 : 150);
  }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (busy) return;
    var data = { naam: form.naam.value.trim(), contact: form.contact.value.trim(), vraag: form.vraag.value.trim(), website: form.website.value };
    if (!data.naam || !data.contact || !data.vraag) { say("Vul je naam, hoe ik je kan bereiken en je vraag in."); return; }
    busy = true;
    send.textContent = "Even versturen…";
    fetch("/api/bericht", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (res) { if (!res.ok) throw new Error(res.status); })
      .then(function () {
        form.reset();
        say("Bedankt, je bericht is aangekomen. Ik antwoord je zo snel mogelijk.", true);
      }, function () {
        say("Dat lukte nu niet. Mail me gerust rechtstreeks op elias@ahai.be.");
      })
      .then(function () { busy = false; send.textContent = "Verstuur"; });
  });
})();
