# Klikt het? analysedienst

Een kleine Cloudflare Worker die de taakbeschrijving van een bezoeker laat beoordelen door Gemini, op vijf vaste criteria: herhaling, tekst en documenten, vast patroon, digitaal beschikbaar en mens aan het stuur. De Worker geeft alleen die scores en korte redenen terug; de website rekent het percentage zelf uit. Er wordt niets bewaard.

## Online zetten

1. Maak een gratis API-sleutel in Google AI Studio.
2. Log in bij Cloudflare: `npx wrangler login`
3. Zet de sleutel als geheim, zonder dat hij in een bestand komt: `npx wrangler secret put GEMINI_API_KEY`
4. Zet de Worker online: `npx wrangler deploy`
5. Zet het adres van de Worker op het formulier in `site/index.html`: `<form class="klikt" id="klikt" data-endpoint="https://...workers.dev">`

Zonder `data-endpoint` gebruikt de site een eenvoudige lezing in de browser.

## Privacy

Met de gratis versie van de Gemini API kan Google ingestuurde tekst gebruiken om zijn diensten te verbeteren. Pas daarom de tekst onder het veld aan wanneer de Worker aan staat, en vermeld het in de privacyverklaring.
