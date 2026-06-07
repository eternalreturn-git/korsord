/* config.js — fyll i EN gratis API-nyckel här så funkar sidan direkt på t.ex.
 * en iPad, utan att användaren behöver göra något. Allt genereras då av en
 * riktig LLM över internet (inga statiska ordlistor).
 *
 * Hämta en gratis nyckel (tar en minut, INGET kreditkort):
 *   - Google Gemini:  https://aistudio.google.com/apikey   (nyckeln börjar med "AIza")
 *   - eller OpenRouter: https://openrouter.ai/keys          (nyckeln börjar med "sk-or")
 *
 * Klistra in den mellan citattecknen nedan, spara, och lägg upp mappen på en
 * webbserver (t.ex. GitHub Pages). Klart.
 *
 * OBS: nyckeln blir synlig i sidans källkod. För en gratis Gemini-nyckel utan
 * fakturering är risken bara kvotförbrukning. Vill du begränsa den: lägg till en
 * "HTTP-referrer"-restriktion på nyckeln i Google AI Studio / Google Cloud.
 */
window.KORSORD_CONFIG = {
  apiKey: '',                     // håll TOM — bädda inte in publikt (Google stänger av läckta nycklar). Ange i panelen på enheten.
  geminiModel: 'gemini-2.5-flash' // faller automatiskt till gemini-2.5-flash-lite vid behov
};
