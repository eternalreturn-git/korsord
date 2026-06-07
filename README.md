# Korsord

En fristående korsordswebbsida. Skriv ett **tema**, välj **svårighetsgrad** (lätt/medel/svår)
och få ett **tätt korsord** — med **bildledtrådar** (riktiga genererade bilder med pil in i
rutnätet, som i ett svenskt bildkorsord). Fungerar i webbläsare och på iPad.

## Köra
Det är en ren statisk sida (HTML/CSS/JS, ingen server behövs).

- **Snabbast:** öppna `index.html` i en webbläsare.
- **Lokalt med server** (rekommenderas, undviker ev. CORS-strul med `file://`):
  ```
  py -3.11 -m http.server 8766 --directory .
  ```
  Öppna sedan http://localhost:8766
- **På iPad:** lägg upp mappen på valfri statisk värd (t.ex. GitHub Pages) och öppna URL:en.

## Hur orden hämtas
Orden och ledtrådarna **genereras av en riktig LLM över internet** — inga statiska
ämneslistor i normalfallet. Det kräver en **gratis API-nyckel** (det finns 2026 ingen
pålitlig nyckelfri publik LLM; Pollinations keyless är numera deprecated/strypt, 429).

1. **Google Gemini** (nyckel börjar med `AIza`) — gratis, inget kreditkort:
   aistudio.google.com/apikey. Eller **OpenRouter** (`sk-or…`): openrouter.ai/keys.
2. Lägg in nyckeln antingen i fältet på sidan (sparas lokalt på enheten) **eller** i
   `config.js` (bäddas in i sidan — bäst för t.ex. en iPad som inte ska behöva nån inloggning).
3. Om ingen LLM kan nås visas tydligt märkta **reservord** (inbyggd lista) så att sidan
   aldrig kraschar — men det är inte det tänkta läget.

Statusraden visar alltid vilken källa som användes (Gemini / OpenRouter / reservord).

**Bilder:** hämtas keyless från **Wikipedia/Wikimedia** (riktiga foton, CORS via `origin=*`)
genom att söka på ordet. Hittas ingen bild visas textledtråden → alltid lösbart.

## Sätta upp för en iPad (utan inloggning för användaren)
1. Hämta en gratis Gemini-nyckel: aistudio.google.com/apikey
2. Klistra in den i `config.js` (`apiKey: '...'`).
3. Lägg upp mappen på en webbserver (t.ex. GitHub Pages).
4. Öppna URL:en på iPaden. Skriv tema → Generera. Allt genereras, inget krångel.

> Nyckeln syns i sidans källkod. För en gratis Gemini-nyckel utan fakturering är risken bara
> kvotförbrukning; vill du begränsa den kan du lägga en HTTP-referrer-restriktion på nyckeln.

## Filer
| Fil | Innehåll |
|---|---|
| `config.js` | Din inbäddade API-nyckel (för iPad utan inloggning) |
| `index.html` | Sidans struktur |
| `style.css` | Design (responsiv, iPad-vänlig) |
| `words.js` | Inbyggd svensk ordbank (offline-fallback) |
| `generator.js` | Korsordsgeneratorn (tät packning + bildrutor) |
| `llm.js` | Hämtar ord/ledtrådar/bildmotiv + bygger bild-URL:er |
| `app.js` | UI: rendering, ifyllning, navigering, kontroll |

## Så blir korsordet tätt
Generatorn provar hundratals slumpade placeringar (utforskande greedy), poängsätter efter
antal korsningar + kompakthet, och **beskär utstickande "pendel-ord"** så blocket blir tätt
i stället för spretigt. Fler temaord (online-läget) ger ännu tätare rutnät.

## Kontroller i spelet
- **Generera** – nytt korsord. **Kontrollera** – markerar fel rött. **Visa bokstav** – avslöjar
  markerad ruta. **Visa lösning** – fyller allt. **Rensa** – tömmer.
- Klicka en ruta för att skriva; klicka igen (eller mellanslag) för att växla vågrätt/lodrätt.
- Klicka en bildruta för att förstora bilden och hoppa till ordet.
