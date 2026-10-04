# AhAi Worker

Een Cloudflare Worker die ahai.be en www.ahai.be serveert: de website uit `../site`, en daarnaast:

- `POST /api/klikt`: "Waar klikt het?". Gemini beoordeelt de taak van een bezoeker op twee maatstaven (tijd die je terugwint, hoe goed AI dit al kan), schrijft 2 tot 3 dingen die Elias kan doen en 3 tot 5 stappen voor "Zo kan het lopen". De website rekent het percentage zelf uit die maatstaven; het model geeft nooit zelf een getal.
- `POST /api/bewaar`: bewaart de eenvoudige lezing van de pagina zelf, als Gemini niet kon antwoorden.
- `POST /api/bericht`: bewaart een bericht uit het contactformulier en mailt Elias dat het er is.
- `GET /overzicht`: Elias' eigen overzicht van wat bezoekers vroegen, met wachtwoord, en `/overzicht.csv`.

Antwoorden worden bewaard zonder naam, IP-adres of cookies, in een D1-databank in Europa, en na twaalf maanden 's nachts gewist.

## Online zetten

1. Een gratis API-sleutel uit Google AI Studio als geheim, zonder dat hij in een bestand komt: `npx wrangler secret put GEMINI_API_KEY`
2. Het wachtwoord voor het overzicht: `npx wrangler secret put OVERZICHT_WACHTWOORD`
3. Site en Worker samen online: `npx wrangler deploy` in deze map.

Pushen naar GitHub zet niets online; dat doet alleen `wrangler deploy`.

## Privacy

Google leest via de Gemini API de tekst die een bezoeker in "Waar klikt het?" typt. De privacypagina (`site/privacy.html`) zegt dat, en wat er bewaard wordt.
