/* AhAi: Waar klikt het?
   A visitor describes a task from their work. The analysis service (a
   data-endpoint on the form) has Gemini choose the factors that matter for
   that task, rate and weigh them and write the reasons; the match is then
   computed here from those factors, never taken from the model. Without an
   endpoint, a plain-language stand-in rates the text in the browser. */
(function () {
  "use strict";

  var form = document.getElementById("klikt");
  var panel = document.getElementById("klikt-uitslag");
  if (!form || !panel) return;
  var field = form.querySelector("textarea"), fout = document.getElementById("klikt-fout");
  var inner = panel.querySelector(".match__in");
  var out = {
    score: panel.querySelector("[data-score]"),
    verdict: panel.querySelector("[data-verdict]"),
    frame: panel.querySelector("[data-frame]"),
    acts: panel.querySelector("#klikt-acties"),
    caption: panel.querySelector(".match__caption"),
    reasons: panel.querySelector("[data-reasons]"),
    fit: panel.querySelector("[data-fit]"),
    mail: panel.querySelector("[data-mail]"),
    again: panel.querySelector("[data-again]"),
    mark: panel.querySelector(".match__mark"),
    quip: panel.querySelector(".match__quip")
  };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var busy = false, keep = false;

  /* ── The framework: factors rated 0 to 3 and weighed 1 to 3 ─────── */
  var SERVICES = {
    uitleggen: { name: "Ik leg het uit", href: "#uitleggen" },
    kijken: { name: "Ik kom kijken", href: "#kijken" },
    bouwen: { name: "Ik bouw het", href: "#bouwen" }
  };
  var WEIGHT = { 1: "telt licht", 2: "telt gewoon", 3: "telt zwaar" };
  var LEVEL = { 0: "niet gunstig", 1: "een beetje gunstig", 2: "duidelijk gunstig", 3: "sterk gunstig" };
  var HUMAN = "Mens aan het stuur";
  var ASK = "Wat doe je op een gewone werkdag? Een tuinman maakt bijvoorbeeld offertes, beantwoordt mails en plant de week in.";

  /* Generous but honest: the weighted average of the factors maps onto 45
     to 95. Nothing is a sure thing, so the match never reaches 100. The
     analysis service stores its answers with the same formula. */
  function scoreOf(factors) {
    var sum = 0, weight = 0;
    factors.forEach(function (f) { sum += f.weight * f.rating; weight += f.weight; });
    return Math.min(95, Math.round(45 + 50 * (sum / (3 * weight))));
  }
  function heaviest(factors) {
    return factors.slice().sort(function (a, b) { return b.weight - a.weight || b.rating - a.rating; });
  }
  function verdictOf(score) {
    if (score >= 85) return "Dit is precies het soort werk waar AI tijd wint.";
    if (score >= 70) return "Hier kan AI je duidelijk werk uit handen nemen.";
    if (score >= 58) return "Op een paar plekken kan AI helpen.";
    return "AI helpt hier maar een beetje. Vertel me gerust meer: vaak zit er meer in dan je denkt.";
  }
  /* The reasons of the heaviest factors, two to four. Whether a person
     stays in control is always said: reassurance when it holds, a warning
     when not. */
  function pick(factors) {
    var order = heaviest(factors);
    var chosen = order.filter(function (f) { return f.name !== HUMAN; }).slice(0, 3);
    order.forEach(function (f) { if (f.name === HUMAN) chosen.push(f); });
    return chosen.map(function (f) { return f.reason; }).filter(Boolean);
  }

  /* ── The stand-in: a plain reading of the text ───────────────── */
  var WORDS = {
    freq3: /\b(elke dag|iedere dag|dagelijks|elke ochtend|elke avond|de hele dag|meerdere keren per dag)\b/,
    freq2: /\b(elke week|iedere week|wekelijks|elke (?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)|iedere (?:maandag|dinsdag|woensdag|donderdag|vrijdag)|elke maand|iedere maand|maandelijks|telkens|elke keer|iedere keer|steeds opnieuw|altijd weer)\b/,
    freq1: /\b(soms|af en toe|elk kwartaal|per kwartaal|jaarlijks|elk jaar)\b/,
    docs: /\b((?:e-?)?mails?|mailtjes|verslag(?:en)?|rapport(?:en)?|pdf'?s?|document(?:en)?|excel|lijst(?:en)?|tabel(?:len)?|formulier(?:en)?|offertes?|factu(?:ur|ren)|notulen|contract(?:en)?|brie(?:f|ven)|handleiding(?:en)?|procedures?|dossiers?|aanvra(?:ag|gen)|roosters?|planning(?:en)?|bestelling(?:en)?|tekst(?:en)?)\b/g,
    digital: /\b(excel|e-?mails?|mails?|pdf'?s?|outlook|word|teams|sharepoint|drive|crm|erp|systeem|software|app|website|online|digitaal|database|portaal|computer)\b/,
    paper: /\b(papier|geprint|uitgeprint|handgeschreven|fax)\b/,
    check: /\b(controle|nakijk|goedkeur|check|nalees|valide)|\bkijk\w*\b.{0,60}?\bna\b|\bkeur\w*\b.{0,60}?\bgoed\b|\blees\w*\b.{0,60}?\bna\b/,
    stakes: /\b(diagnose|medisch|juridisch|vonnis|ontslag)\b/
  };
  /* Steps with a fixed pattern, in the forms Dutch really uses: split
     verbs ("neem ... over") and conjugations ("controleer"), each named
     by its infinitive for the reason sentence. */
  var STEPS = [
    [/\b(overnem|overgenom|neem\w*\b.{0,60}?\bover\b)/, "overnemen"],
    [/\b(overtyp|typ\w*\b.{0,60}?\bover\b)/, "overtypen"],
    [/\b(kopi[eë]|plak)/, "kopiëren"],
    [/\b(invul|ingevuld|vul\w*\b.{0,60}?\bin\b)/, "invullen"],
    [/\b(opzoek|zoek)/, "opzoeken"],
    [/\b(samenvat|vat\w*\b.{0,60}?\bsamen\b)/, "samenvatten"],
    [/\b(sorteer|sorter)/, "sorteren"],
    [/\b(controle)/, "controleren"],
    [/\b(vergelijk)/, "vergelijken"],
    [/\b(nakijk|kijk\w*\b.{0,60}?\bna\b)/, "nakijken"],
    [/\b(beantwoord|antwoord)/, "beantwoorden"],
    [/\b(opstel|stel\w*\b.{0,60}?\bop\b)/, "opstellen"],
    [/\b(herschrijf|herschrijv)/, "herschrijven"],
    [/\b(vertaal|vertal)/, "vertalen"],
    [/\b(inplan|plan\w*\b.{0,60}?\bin\b)/, "inplannen"],
    [/\b(verwerk)/, "verwerken"],
    [/\b(sjabloon|template|hetzelfde|vaste stappen)/, null]
  ];
  /* how each word reads in a reason: Excel by name, everything else plural */
  var SHOWN = {
    excel: "Excel", pdf: "pdf's", "pdf's": "pdf's", pdfs: "pdf's",
    mail: "mails", email: "mails", emails: "mails", "e-mail": "mails", "e-mails": "mails", mailtjes: "mails",
    verslag: "verslagen", rapport: "rapporten", document: "documenten", lijst: "lijsten", tabel: "tabellen",
    formulier: "formulieren", offerte: "offertes", factuur: "facturen", contract: "contracten", brief: "brieven",
    handleiding: "handleidingen", procedure: "procedures", dossier: "dossiers", aanvraag: "aanvragen",
    rooster: "roosters", planning: "planningen", bestelling: "bestellingen", tekst: "teksten"
  };

  function standIn(text) {
    var t = text.toLowerCase(), words = text.trim().split(/\s+/).length;
    var freq = (t.match(WORDS.freq3) || t.match(WORDS.freq2) || t.match(WORDS.freq1) || [])[0];
    var docs = [], steps = [];
    STEPS.forEach(function (s) { if (s[0].test(t)) steps.push(s[1]); });
    (t.match(WORDS.docs) || []).forEach(function (w) { w = SHOWN[w] || w; if (docs.indexOf(w) < 0) docs.push(w); });
    /* Asking straight for what Elias offers (a site, an app, a workshop) is
       never vague and always fits, as the analysis service rates it too:
       it saves the searching, and it is what AI does well today. */
    var made = t.match(/\b(website|site|webshop|webwinkel|app|applicatie|tool|platform|portfolio|chatbot)\b/);
    var taught = /\b(workshop|opleiding|lezing|training|cursus)\b/.test(t);
    if ((made || taught) && words >= 4 && /\b(wil|wilde|graag|zoek|zoeken|nodig|idee|bouwen|bouw|maken|laten)\b/.test(t)) {
      var thing = made ? (made[1] === "site" ? "website" : made[1] === "applicatie" ? "app" : made[1]) : "";
      return made ? {
        status: "ok", service: "bouwen",
        factors: [
          { name: "Tijd die je terugwint", rating: 2, weight: 1, reason: "Je hoeft niet zelf uit te zoeken hoe het moet: een eerste versie staat er snel." },
          { name: "Hoe goed AI dit al kan", rating: 3, weight: 1, reason: "Een " + thing + " bouwen met AI kan vandaag goed." }
        ],
        acties: ["Ik bouw een eerste versie van je " + thing + ", zodat je snel ziet of het werkt.", "Daarna verfijnen we samen tot het doet wat je nodig hebt."]
      } : {
        status: "ok", service: "uitleggen",
        factors: [
          { name: "Tijd die je terugwint", rating: 2, weight: 1, reason: "Je leert in een paar uur wat je anders zelf moet uitzoeken." },
          { name: "Hoe goed AI dit al kan", rating: 3, weight: 1, reason: "De AI-tools die hierbij helpen, bestaan vandaag al." }
        ],
        acties: ["Ik geef een workshop met voorbeelden uit je eigen werk.", "Ik toon je welke AI-tools vandaag al helpen, en wat je beter niet doet."]
      };
    }
    var cues = (freq ? 1 : 0) + docs.length + steps.length + (WORDS.digital.test(t) ? 1 : 0);
    if (words < 5 || cues === 0) return { status: "vaag", vraag: ASK };

    var r = {
      herhaling: WORDS.freq3.test(t) ? 3 : WORDS.freq2.test(t) ? 2 : 1,
      tekst: docs.length >= 2 ? 3 : docs.length === 1 ? 2 : 0,
      patroon: steps.length >= 2 ? 3 : steps.length === 1 ? 2 : 1,
      digitaal: WORDS.paper.test(t) ? 1 : WORDS.digital.test(t) ? 3 : 2,
      mens: WORDS.stakes.test(t) ? 1 : WORDS.check.test(t) ? 3 : 2
    };
    var step = steps.filter(Boolean)[0];
    /* the same two measures the analysis service uses, and what Elias can do */
    var easy = (docs.length ? 3 : 1) + (steps.length ? 3 : 1) + (r.digitaal >= 3 ? 3 : r.digitaal <= 1 ? 1 : 2);
    var factors = [
      { name: "Tijd die je terugwint", rating: r.herhaling, weight: 1, reason: freq
        ? "Het komt " + freq + " terug, dus je wint elke keer opnieuw tijd."
        : "Het komt niet vaak terug, dus de tijdwinst blijft eerder beperkt." },
      { name: "Hoe goed AI dit al kan", rating: Math.round(easy / 3), weight: 1, reason: docs.length
        ? "Werken met " + docs.slice(0, 2).join(" en ") + " kan AI vandaag al goed."
        : "Het hangt af van hoe je werkt, dus eerst even kijken." }
    ];
    var service = r.herhaling >= 2 && r.patroon >= 2 && r.digitaal >= 2 ? "bouwen" : r.tekst >= 2 && r.patroon <= 1 ? "uitleggen" : "kijken";
    var acties = {
      bouwen: ["Ik bouw een tool die het " + (step || "werk") + " voor je voorbereidt.", "Jij kijkt het resultaat na, de tool doet het herhaalwerk."],
      uitleggen: ["Ik toon je welke AI-tools hier vandaag al helpen.", "Ik oefen met je op je eigen " + (docs[0] || "werk") + "."],
      kijken: ["Ik kom kijken hoe je dit vandaag aanpakt.", "Ik zeg eerlijk waar AI hier tijd wint, en waar niet."]
    }[service];
    return { status: "ok", factors: factors, acties: acties, service: service };
  }

  function analyse(text) {
    var endpoint = form.getAttribute("data-endpoint");
    if (!endpoint) return Promise.resolve(standIn(text));
    /* when the service is busy or away, the plain reading still answers */
    return fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tekst: text }) })
      .then(function (res) { if (!res.ok) throw new Error("status " + res.status); return res.json(); })
      .catch(function () {
        /* the plain reading is what the visitor sees, so it is kept too */
        var result = standIn(text);
        try {
          fetch(new URL("bewaar", endpoint).href, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tekst: text, result: result }) }).catch(function () {});
        } catch (e) { /* keeping is never worth an error */ }
        return result;
      });
  }

  /* ── The reading ─────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear() {
    [out.frame, out.reasons, out.fit].forEach(function (n) { n.textContent = ""; });
    out.verdict.textContent = "";
    out.frame.classList.remove("is-grown");
    /* the mark waits as AhAi until the next match lands */
    if (out.mark) {
      out.mark.hidden = true;
      var m = out.mark.querySelector("[data-mark]");
      if (m && m.aha) m.aha(0);
    }
    /* empty blocks would still take up the grid's gaps */
    [out.caption, out.acts, out.reasons, out.fit].forEach(function (n) { if (n) n.hidden = true; });
  }
  function meter(score, onStep) {
    var m = window.AhAi && window.AhAi.meter;
    if (m) m.show(score, onStep);
    else if (onStep) onStep(1);
  }
  /* While the answer is on its way, the mark thinks: its i leans towards
     the ! and back, as if it almost has it. Below the wait, a light line
     changes every few seconds. */
  var QUIPS = [
    "De draden worden gesorteerd…",
    "AI leest je taak. Twee keer, voor de zekerheid.",
    "Expertise en AI overleggen nog even…",
    "Even de koffie van de AI bijvullen…",
    "Rood, geel en blauw zoeken hun plek…",
    "Goede ideeën laten zich niet haasten…",
    "De AI doet alsof dit een makkelijke is…",
    "Zoeken naar het moment dat het klikt…",
    "Ondertussen: heb jij al koffie?"
  ];
  var quipTimer = 0, thinkTimer = 0;
  function think(on) {
    clearInterval(quipTimer);
    clearInterval(thinkTimer);
    var m = out.mark && out.mark.querySelector("[data-mark]");
    if (!on) {
      if (out.quip) { out.quip.hidden = true; out.quip.textContent = ""; }
      return;
    }
    if (out.mark) out.mark.hidden = false;
    if (out.quip) {
      /* a fresh order each time, so the lines never come in the same row */
      var order = QUIPS.slice().sort(function () { return Math.random() - 0.5; }), at = 0;
      out.quip.textContent = order[0];
      out.quip.hidden = false;
      if (!reduce.matches) quipTimer = setInterval(function () {
        out.quip.classList.add("is-swap");
        setTimeout(function () {
          at = (at + 1) % order.length;
          out.quip.textContent = order[at];
          out.quip.classList.remove("is-swap");
        }, 200);
      }, 2600);
    }
    if (m && m.aha && !reduce.matches) {
      var up = false;
      thinkTimer = setInterval(function () { up = !up; m.aha(up ? 0.35 : 0); }, 700);
    }
  }
  function waiting() {
    var m = window.AhAi && window.AhAi.meter;
    if (m && m.wait) m.wait();
  }
  /* The reading settles in once the answer is there: verdict and threads
     first, then the actions one by one, then the way on. */
  function enter() {
    var order = [out.verdict, out.caption, out.frame, out.acts];
    out.reasons.querySelectorAll("li").forEach(function (li) { order.push(li); });
    order.push(out.fit, out.again.parentNode);
    var step = 0;
    order.forEach(function (n, i) {
      if (!n || n.hidden) return;
      if (i > 3) step++;
      n.setAttribute("data-enter", "");
      n.style.setProperty("--i", step);
    });
    inner.classList.add("is-before");
    void inner.offsetWidth;
    inner.classList.remove("is-before");
    /* the threads grow with the meter */
    out.frame.classList.add("is-grown");
  }
  function render(text, result) {
    clear();
    if (!result || result.status !== "ok") {
      out.score.textContent = "Vertel iets meer";
      out.verdict.textContent = (result && result.vraag) || ASK;
      out.mail.hidden = true;
      out.again.textContent = "Vul je beschrijving aan";
      keep = true;
      meter(null);
      enter();
      return;
    }
    out.again.textContent = "Probeer een andere taak";
    keep = false;
    var score = scoreOf(result.factors);
    out.score.textContent = "Het klikt voor ";
    var count = el("span", null, reduce.matches ? String(score) : "0");
    count.setAttribute("aria-hidden", "true");
    var pct = el("span", null, "%");
    pct.setAttribute("aria-hidden", "true");
    out.score.append(count, pct, el("span", "sr-only", score + " procent"));
    if (out.mark) out.mark.hidden = false;
    meter(score, function (e) {
      count.textContent = String(Math.round(score * e));
      /* once the strands have wound in, AhAi becomes AhA! */
      if (e >= 1 && out.mark) {
        var m = out.mark.querySelector("[data-mark]");
        if (m && m.aha) m.aha(1);
      }
    });

    out.verdict.textContent = verdictOf(score);
    [out.caption, out.acts, out.reasons, out.fit].forEach(function (n) { if (n) n.hidden = false; });
    /* each factor with how heavily it weighs, the heaviest first */
    /* each factor as a thread from "weinig" to "sterk", with its reason and
       how much it counts behind an info button, the heaviest first */
    var factors = heaviest(result.factors);
    var weighted = factors.some(function (f) { return f.weight !== factors[0].weight; });
    factors.forEach(function (f, n) {
      var row = el("div"), dt = el("dt", null, f.name), dd = el("dd");
      var id = "klikt-uitleg-" + n, info = el("button", "match__info", "i"), tip = el("span", "match__tip");
      info.type = "button";
      info.setAttribute("aria-label", "Meer over " + f.name);
      info.setAttribute("aria-describedby", id);
      info.setAttribute("aria-expanded", "false");
      tip.id = id;
      tip.setAttribute("role", "tooltip");
      tip.append(el("span", null, f.reason || ""));
      if (weighted) tip.append(el("span", "match__tip-weight", "Deze factor " + (WEIGHT[f.weight] || "telt gewoon") + " voor jouw taak."));
      dt.append(info, tip);
      var track = el("span", "match__track"), fill = el("span", "match__fill");
      fill.style.width = Math.max(4, (f.rating / 3) * 100) + "%";
      track.append(fill);
      dd.append(track, el("span", "sr-only", LEVEL[f.rating] || ""));
      row.append(dt, dd);
      out.frame.append(row);
    });
    var ends = el("div", "match__ends");
    ends.setAttribute("aria-hidden", "true");
    ends.append(el("span", null, "weinig"), el("span", null, "sterk"));
    out.frame.append(ends);
    (result.acties && result.acties.length ? result.acties : pick(result.factors)).forEach(function (line) { out.reasons.append(el("li", null, line)); });
    var fit = SERVICES[result.service] || SERVICES.kijken, link = el("a", null, fit.name);
    link.href = fit.href;
    out.fit.append("Past het best bij: ", link);

    told = { text: text, score: score };
    out.mail.hidden = false;
    enter();
  }

  function fail() {
    clear();
    out.score.textContent = "Dat lukt nu even niet";
    out.verdict.textContent = "Schrijf me gerust rechtstreeks, dan bekijk ik je taak zelf.";
    told.score = null;
    out.mail.hidden = false;
    meter(null);
    enter();
  }

  /* "Stuur dit naar Elias" puts the task and its match in the message
     form below, where it can still be added to before it is sent. */
  var told = { text: "", score: null };
  out.mail.addEventListener("click", function (ev) {
    var box = document.getElementById("bericht");
    if (!box || !told.text) return;
    ev.preventDefault();
    var note = "Ik probeerde \u201cWaar klikt het?\u201d met deze taak:\n" + told.text + "\n\n" +
      (told.score != null ? "Het klikte voor " + told.score + "%. Kunnen we eens bekijken wat AI hier kan doen?\n\n" : "");
    var area = box.vraag;
    /* whatever the visitor wrote there already stays */
    area.value = !area.value || area.value === area.dataset.fromTool ? note : note + area.value;
    area.dataset.fromTool = area.value;
    area.style.height = "auto";
    area.style.height = Math.max(area.offsetHeight, area.scrollHeight + 2) + "px";
    box.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "center" });
    var next = !box.naam.value ? box.naam : area;
    next.focus({ preventScroll: true });
    if (next === area) area.setSelectionRange(area.value.length, area.value.length);
  });

  /* The info bubbles: they open on hover and focus; a tap toggles them,
     for phones, and Escape or a tap elsewhere closes them. */
  function closeTips(except) {
    out.frame.querySelectorAll(".match__info[aria-expanded='true']").forEach(function (b) {
      if (b !== except) b.setAttribute("aria-expanded", "false");
    });
  }
  out.frame.addEventListener("click", function (ev) {
    var b = ev.target.closest(".match__info");
    if (!b) return;
    var open = b.getAttribute("aria-expanded") !== "true";
    closeTips(b);
    b.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", function (ev) { if (!ev.target.closest(".match__info")) closeTips(null); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeTips(null); });

  /* The example chips fill in a task and ask straight away. */
  form.querySelectorAll("[data-voorbeeld]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      field.value = chip.getAttribute("data-voorbeeld");
      grow();
      form.requestSubmit();
    });
  });

  /* ── The form ────────────────────────────────────────────────── */
  /* The field is as tall as its text, or, while empty, as its example:
     where the example wraps, the field shows both lines. */
  function grow() {
    var empty = !field.value;
    field.style.height = "auto";
    if (empty) field.value = field.placeholder;
    field.style.height = field.scrollHeight + "px";
    if (empty) field.value = "";
  }
  grow();
  var sizing = 0;
  window.addEventListener("resize", function () {
    cancelAnimationFrame(sizing);
    sizing = requestAnimationFrame(grow);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(grow);
  function say(message) {
    fout.textContent = message || "";
    fout.hidden = !message;
    if (message) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }
  field.addEventListener("input", function () { grow(); say(null); });
  field.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (busy) return;
    var text = field.value.trim();
    if (text.length < 12 || text.split(/\s+/).length < 3) {
      say("Beschrijf je taak in een of twee zinnen.");
      field.focus();
      return;
    }
    busy = true;
    told = { text: text, score: null };
    clear();
    out.score.textContent = "Even kijken…";
    out.mail.hidden = true;
    panel.hidden = false;
    inner.setAttribute("aria-busy", "true");
    meter(null);
    waiting();
    think(true);
    panel.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
    /* ?traag (or ?traag=10) in the address makes the answer wait that many
       seconds, so the wait itself can be seen and tested */
    var slow = /[?&]traag(?:=(\d+))?/.exec(location.search);
    var pause = slow ? new Promise(function (ok) { setTimeout(ok, (Number(slow[1]) || 6) * 1000); }) : null;
    var answer = analyse(text);
    if (pause) answer = Promise.all([answer, pause]).then(function (both) { return both[0]; });
    answer.then(function (result) { think(false); render(text, result); }, function () { think(false); fail(); }).then(function () {
      busy = false;
      inner.setAttribute("aria-busy", "false");
      out.score.focus({ preventScroll: true });
    });
  });
  /* the reading fades out first; only then does the panel close and the
     page scroll back to the field */
  var leaving = 0;
  out.again.addEventListener("click", function () {
    if (leaving) return;
    panel.classList.add("is-leaving");
    leaving = setTimeout(function () {
      leaving = 0;
      /* a wait still running stops here, while the strip can be measured */
      if (busy) { meter(null); think(false); }
      panel.hidden = true;
      panel.classList.remove("is-leaving");
      /* a vague description is kept, so it can be added to */
      if (!keep) field.value = "";
      grow();
      field.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "center" });
    }, reduce.matches ? 0 : 150);
  });
})();
