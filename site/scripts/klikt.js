/* AhAi: Klikt het?
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
    caption: panel.querySelector(".match__caption"),
    reasons: panel.querySelector("[data-reasons]"),
    fit: panel.querySelector("[data-fit]"),
    mail: panel.querySelector("[data-mail]"),
    again: panel.querySelector("[data-again]")
  };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var busy = false, keep = false;

  /* ── The framework: factors rated 0 to 3 and weighed 1 to 3 ─────── */
  var SERVICES = {
    uitleggen: { name: "Ik leg het uit", href: "#uitleggen" },
    kijken: { name: "Ik kom kijken", href: "#kijken" },
    bouwen: { name: "Ik bouw het", href: "#bouwen" }
  };
  var WEIGHT = { 1: "weegt licht", 2: "weegt gewoon", 3: "weegt zwaar" };
  var HUMAN = "Mens aan het stuur";

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
    var cues = (freq ? 1 : 0) + docs.length + steps.length + (WORDS.digital.test(t) ? 1 : 0);
    if (words < 5 || cues === 0) return { status: "vaag" };

    var r = {
      herhaling: WORDS.freq3.test(t) ? 3 : WORDS.freq2.test(t) ? 2 : 1,
      tekst: docs.length >= 2 ? 3 : docs.length === 1 ? 2 : 0,
      patroon: steps.length >= 2 ? 3 : steps.length === 1 ? 2 : 1,
      digitaal: WORDS.paper.test(t) ? 1 : WORDS.digital.test(t) ? 3 : 2,
      mens: WORDS.stakes.test(t) ? 1 : WORDS.check.test(t) ? 3 : 2
    };
    var step = steps.filter(Boolean)[0];
    /* only what the description actually says becomes a factor */
    var factors = [];
    if (freq) factors.push({ name: "Herhaling", rating: r.herhaling, weight: 3, reason: r.herhaling >= 2
      ? "Het komt " + freq + " terug: vaste stappen die een tool kan overnemen."
      : "Ook als het niet vaak terugkomt, kan AI de voorbereiding versnellen." });
    if (docs.length) factors.push({ name: "Tekst en documenten", rating: r.tekst, weight: 3,
      reason: "Het draait om " + docs.slice(0, 2).join(" en ") + ": taal en documenten zijn waar AI het sterkst in is." });
    if (steps.length) factors.push({ name: "Vast patroon", rating: r.patroon, weight: 2,
      reason: step ? "Het " + step + " volgt een vast patroon, dus AI kan het grootste deel voorbereiden." : "Er zit een vast patroon in, dus AI kan het grootste deel voorbereiden." });
    if (WORDS.digital.test(t) || WORDS.paper.test(t)) factors.push({ name: "Digitaal beschikbaar", rating: r.digitaal, weight: 2, reason: r.digitaal >= 3
      ? "De informatie staat al digitaal, dus niets hoeft opnieuw getypt te worden."
      : "Een deel staat nog op papier: dat eerst digitaal krijgen is al winst." });
    factors.push({ name: HUMAN, rating: r.mens, weight: 2, reason: r.mens >= 3
      ? "Jij kijkt het resultaat na voor het telt, dus je blijft zelf aan het stuur."
      : r.mens <= 1
        ? "Hier weegt elke fout zwaar, dus AI mag hier alleen voorbereiden, nooit beslissen."
        : "Een mens kijkt het resultaat na voor het telt: zo blijf je zelf aan het stuur." });
    return {
      status: "ok",
      factors: factors,
      service: r.herhaling >= 2 && r.patroon >= 2 && r.digitaal >= 2 ? "bouwen" : r.tekst >= 2 && r.patroon <= 1 ? "uitleggen" : "kijken"
    };
  }

  function analyse(text) {
    var endpoint = form.getAttribute("data-endpoint");
    if (!endpoint) return Promise.resolve(standIn(text));
    /* when the service is busy or away, the plain reading still answers */
    return fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tekst: text }) })
      .then(function (res) { if (!res.ok) throw new Error("status " + res.status); return res.json(); })
      .catch(function () { return standIn(text); });
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
    /* empty blocks would still take up the grid's gaps */
    [out.caption, out.reasons, out.fit].forEach(function (n) { n.hidden = true; });
  }
  function meter(score, onStep) {
    var m = window.AhAi && window.AhAi.meter;
    if (m) m.show(score, onStep);
    else if (onStep) onStep(1);
  }
  function render(text, result) {
    clear();
    if (!result || result.status !== "ok") {
      out.score.textContent = "Vertel iets meer";
      out.verdict.textContent = (result && result.vraag) || "Welke mails, lijsten of documenten komen erbij kijken, en hoe vaak doe je het?";
      out.mail.hidden = true;
      out.again.textContent = "Vul je beschrijving aan";
      keep = true;
      meter(null);
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
    meter(score, function (e) { count.textContent = String(Math.round(score * e)); });

    out.verdict.textContent = verdictOf(score);
    [out.caption, out.reasons, out.fit].forEach(function (n) { n.hidden = false; });
    /* each factor with how heavily it weighs, the heaviest first */
    heaviest(result.factors).forEach(function (f) {
      var row = el("div"), dt = el("dt", null, f.name + " "), dd = el("dd");
      dt.append(el("span", "match__weight", WEIGHT[f.weight] || ""));
      row.append(dt, dd);
      for (var i = 1; i <= 3; i++) dd.append(el("span", i <= f.rating ? "is-on" : null));
      dd.append(el("span", "sr-only", f.rating + " van 3"));
      out.frame.append(row);
    });
    pick(result.factors).forEach(function (reason) { out.reasons.append(el("li", null, reason)); });
    var fit = SERVICES[result.service] || SERVICES.kijken, link = el("a", null, fit.name);
    link.href = fit.href;
    out.fit.append("Past het best bij: ", link);

    var body = "Hoi Elias,\n\nIk probeerde \"Klikt het?\" op je site met deze taak:\n\n" + text +
      "\n\nHet klikte voor " + score + "%. Kunnen we eens bekijken wat AI hier kan doen?\n";
    out.mail.href = "mailto:elias@ahai.be?subject=" + encodeURIComponent("Klikt het? " + score + "%") + "&body=" + encodeURIComponent(body);
    out.mail.hidden = false;
  }

  function fail() {
    clear();
    out.score.textContent = "Dat lukt nu even niet";
    out.verdict.textContent = "Schrijf me gerust rechtstreeks, dan bekijk ik je taak zelf.";
    out.mail.href = "mailto:elias@ahai.be?subject=" + encodeURIComponent("Klikt het?");
    out.mail.hidden = false;
    meter(null);
  }

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
    clear();
    out.score.textContent = "Even kijken…";
    out.mail.hidden = true;
    panel.hidden = false;
    inner.setAttribute("aria-busy", "true");
    meter(null);
    panel.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
    analyse(text).then(function (result) { render(text, result); }, fail).then(function () {
      busy = false;
      inner.setAttribute("aria-busy", "false");
      out.score.focus({ preventScroll: true });
    });
  });
  out.again.addEventListener("click", function () {
    panel.hidden = true;
    /* a vague description is kept, so it can be added to */
    if (!keep) field.value = "";
    grow();
    field.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "center" });
  });
})();
