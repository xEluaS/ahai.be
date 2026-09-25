/* AhAi: the small helpers around contact.
   The copy button puts the address on the clipboard; the message form
   sends name, contact and question to the site's own service, which
   keeps it for Elias. Without JavaScript the mail links still work. */
(function () {
  "use strict";

  document.querySelectorAll("[data-copy]").forEach(function (button) {
    var label = button.textContent;
    button.addEventListener("click", function () {
      var done = function () {
        button.textContent = "Gekopieerd";
        setTimeout(function () { button.textContent = label; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(button.getAttribute("data-copy")).then(done, function () {});
      }
    });
  });

  var form = document.getElementById("bericht");
  if (!form) return;
  var status = form.querySelector(".bericht__status"), send = form.querySelector("button[type=submit]"), busy = false;
  function say(text) { status.textContent = text; status.hidden = !text; }
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
        say("Bedankt, je bericht is aangekomen. Ik antwoord je zo snel mogelijk.");
      }, function () {
        say("Dat lukte nu niet. Mail me gerust rechtstreeks op elias@ahai.be.");
      })
      .then(function () { busy = false; send.textContent = "Verstuur"; });
  });
})();
