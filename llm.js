/* llm.js — hämtar temaord + ledtrådar, samt riktiga bilder, med fallbacks.
 *
 * Ord (i tur och ordning, aldrig hårt fel):
 *   1. Gratis API-nyckel om angiven:
 *        - Google Gemini   (nyckel börjar med "AIza")
 *        - OpenRouter      (nyckel börjar med "sk-or")
 *   2. Pollinations keyless (text.pollinations.ai) — ofta rate-limitad (429)
 *   3. Inbyggd svensk ordbank (WordBank) — alltid tillgänglig
 *
 * Bilder: Wikipedia/Wikimedia (riktiga foton, ingen nyckel, CORS via origin=*).
 *   Hittas ingen bild visas textledtråden i rutan i stället.
 *
 * Allt saneras: ETT ord, versaler, endast A-ÖÄÅ, ledtråd utan svaret.
 */
(function (global) {
  'use strict';

  var TIMEOUT_MS = 18000;
  var IMG_TIMEOUT_MS = 12000;

  function lengthRule(diff) {
    if (diff === 'latt') return '3 till 6 bokstäver, vanliga vardagsord';
    if (diff === 'svar') return '5 till 11 bokstäver, gärna lite ovanligare ord';
    return '4 till 8 bokstäver';
  }
  function diffLabel(diff) {
    return diff === 'latt' ? 'lätt' : diff === 'svar' ? 'svår' : 'medel';
  }

  function buildPrompt(theme, diff, count) {
    return 'Skapa ord till ett svenskt korsord. Tema: "' + theme + '". ' +
      'Svårighetsgrad: ' + diffLabel(diff) + '. ' +
      'Ge exakt ' + count + ' ord som verkligen hör till temat. Varje ord: ' + lengthRule(diff) + '. ' +
      'Krav: "svar" ska vara ETT enda RIKTIGT svenskt ord (inga engelska ord, ' +
      'inga påhittade ord), endast bokstäver A-Ö, och använd å/ä/ö rätt (t.ex. SNÖ, ' +
      'inte SNOW). Inga mellanslag, inga bindestreck. "ledtrad" ska vara på svenska, ' +
      'kort, och får INTE innehålla själva svaret. ' +
      '"bild": fyll i ENDAST för ord som är ett konkret, avbildbart FÖREMÅL, DJUR eller ' +
      'PLATS — ett kort engelskt motiv som tydligt föreställer ordet (t.ex. "a polar bear", ' +
      '"a sled"). För abstrakta ord (känslor, riktningar, egenskaper som t.ex. kyla, nord, ' +
      'kall) MÅSTE "bild" vara tom sträng "". ' +
      'Svara ENDAST med giltig JSON i exakt detta format och inget annat: ' +
      '{"ord":[{"svar":"ORD","ledtrad":"text","bild":"a stethoscope"}]}';
  }

  function extractJson(text) {
    if (!text) return null;
    text = String(text);
    if (text.indexOf('```') >= 0) {
      var parts = text.split('```');
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].indexOf('{') >= 0) { text = parts[i]; break; }
      }
      text = text.replace(/^json/i, '');
    }
    var s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch (err) {} }
    var a = text.indexOf('['), b = text.lastIndexOf(']');
    if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (err2) {} }
    return null;
  }

  function listFrom(parsed) {
    if (!parsed) return null;
    if (Array.isArray(parsed)) return parsed;
    return parsed.ord || parsed.words || parsed.items || parsed.list || null;
  }

  function maskAnswer(clue, ans) {
    try {
      var re = new RegExp(ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
      return clue.replace(re, '___');
    } catch (e) { return clue; }
  }

  function cleanSubject(s) {
    s = String(s || '').toLowerCase().replace(/[^a-zåäö0-9 ,'-]/g, '').trim();
    return s.length > 60 ? s.slice(0, 60) : s;
  }

  function sanitize(list, theme) {
    var out = [], seen = {};
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      var a, c, img;
      if (typeof item === 'string') { a = item; c = ''; img = ''; }
      else {
        a = item.svar || item.answer || item.ord || item.word || '';
        c = item.ledtrad || item['ledtråd'] || item.clue || item.fraga || item['fråga'] || '';
        img = item.bild || item.img || item.image || item.motiv || '';
      }
      a = String(a).toUpperCase()
        .replace(/[ÉÈÊË]/g, 'E').replace(/[ÁÀÂ]/g, 'A')
        .replace(/[^A-ZÅÄÖ]/g, '');
      c = String(c).trim();
      if (a.length < 2 || a.length > 13) continue;
      if (seen[a]) continue; seen[a] = 1;
      if (!c) c = 'Ord kopplat till ' + theme + ' (' + a.length + ' bokstäver)';
      c = maskAnswer(c, a);
      out.push({ answer: a, clue: c, img: cleanSubject(img) });
    }
    return out;
  }

  function withTimeout(factory, ms) {
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, ms || TIMEOUT_MS);
    return factory(ctrl.signal).finally(function () { clearTimeout(to); });
  }

  // ---- Ord-leverantörer ----

  function fromGemini(theme, diff, count, signal, key) {
    var prim = (global.KORSORD_CONFIG && global.KORSORD_CONFIG.geminiModel) || 'gemini-2.5-flash';
    // Prova vald modell, fall sedan till flash-lite (alltid gratiskvot, snabb).
    var models = prim === 'gemini-2.5-flash-lite' ? [prim] : [prim, 'gemini-2.5-flash-lite'];
    var body = {
      contents: [{ parts: [{ text: buildPrompt(theme, diff, count) }] }],
      generationConfig: { temperature: 0.85, responseMimeType: 'application/json' }
    };
    function attempt(i) {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + models[i] +
        ':generateContent?key=' + encodeURIComponent(key);
      return fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: signal
      }).then(function (res) {
        if (!res.ok) throw new Error('Gemini ' + models[i] + ' HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        var t = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
          data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text;
        if (typeof t !== 'string') t = JSON.stringify(data);
        return listFrom(extractJson(t));
      }).catch(function (err) {
        if (i + 1 < models.length) return attempt(i + 1);
        throw err;
      });
    }
    return attempt(0);
  }

  function fromOpenRouter(theme, diff, count, signal, key) {
    var body = {
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        { role: 'system', content: 'Du är en svensk korsordskonstruktör som ALLTID svarar med ren JSON.' },
        { role: 'user', content: buildPrompt(theme, diff, count) }
      ],
      response_format: { type: 'json_object' }
    };
    return fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'X-Title': 'Korsord'
      },
      body: JSON.stringify(body), signal: signal
    }).then(function (res) {
      if (!res.ok) throw new Error('OpenRouter HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var c = data && data.choices && data.choices[0] && data.choices[0].message &&
        data.choices[0].message.content;
      return listFrom(extractJson(c || JSON.stringify(data)));
    });
  }

  function fromPollinationsPost(theme, diff, count, signal) {
    var body = {
      model: 'openai',
      messages: [
        { role: 'system', content: 'Du är en svensk korsordskonstruktör som ALLTID svarar med ren JSON.' },
        { role: 'user', content: buildPrompt(theme, diff, count) }
      ],
      jsonMode: true, response_format: { type: 'json_object' }, private: true
    };
    return fetch('https://text.pollinations.ai/openai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: signal
    }).then(function (res) {
      if (!res.ok) throw new Error('Pollinations HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var content = data && data.choices && data.choices[0] &&
        data.choices[0].message && data.choices[0].message.content;
      if (typeof content !== 'string') content = JSON.stringify(data);
      return listFrom(extractJson(content));
    });
  }

  function fromPollinationsGet(theme, diff, count, signal) {
    var url = 'https://text.pollinations.ai/' + encodeURIComponent(buildPrompt(theme, diff, count)) +
      '?model=openai&json=true&private=true';
    return fetch(url, { signal: signal }).then(function (res) {
      if (!res.ok) throw new Error('Pollinations HTTP ' + res.status);
      return res.text();
    }).then(function (text) { return listFrom(extractJson(text)); });
  }

  // ---- Bilder via Wikipedia (keyless, CORS via origin=*) ----

  function wikiThumb(lang, term, signal) {
    var u = 'https://' + lang + '.wikipedia.org/w/api.php' +
      '?action=query&generator=search&gsrsearch=' + encodeURIComponent(term) +
      '&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=320&format=json&origin=*';
    return fetch(u, { signal: signal }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (j) {
      if (!j || !j.query || !j.query.pages) return null;
      var pages = j.query.pages;
      for (var k in pages) {
        if (pages.hasOwnProperty(k) && pages[k].thumbnail && pages[k].thumbnail.source) {
          return pages[k].thumbnail.source;
        }
      }
      return null;
    }).catch(function () { return null; });
  }

  function cleanImgSubject(s) {
    return String(s || '').toLowerCase()
      .replace(/^(a|an|the)\s+/, '')   // "a polar bear" -> "polar bear"
      .trim();
  }

  // Returnerar en bild-URL. Söker i FÖRSTA hand på det engelska motivet (mest
  // träffsäkert för konkreta saker) på engelska Wikipedia, annars svenska svaret.
  function imageFor(answer, imgSubject) {
    var subj = cleanImgSubject(imgSubject);
    return withTimeout(function (signal) {
      var first = subj ? wikiThumb('en', subj, signal) : Promise.resolve(null);
      return first.then(function (url) {
        if (url) return url;
        return wikiThumb('sv', answer, signal);
      });
    }, IMG_TIMEOUT_MS).catch(function () { return null; });
  }

  // ---- Huvudfunktion ----

  function delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function fetchThemeWords(theme, diff, count, apiKey) {
    theme = (theme || '').trim() || 'blandat';
    var key = (apiKey || '').trim();
    var providers = [];
    if (key) {
      // Försök LLM:en upp till 5 gånger (tysta retrys) — fel är oftast tillfälliga.
      if (key.indexOf('sk-or') === 0) providers.push({ fn: fromOpenRouter, src: 'openrouter', key: key, retries: 5 });
      else providers.push({ fn: fromGemini, src: 'gemini', key: key, retries: 5 });
    }
    providers.push({ fn: fromPollinationsPost, src: 'pollinations', retries: 1 });
    providers.push({ fn: fromPollinationsGet, src: 'pollinations', retries: 1 });

    var keyErr = '';   // senaste felet från den nyckel-baserade LLM:en (för UI:t)
    function tryP(i, attempt) {
      if (i >= providers.length) {
        var matched = global.WordBank.matchKey(theme);
        return Promise.resolve({
          words: global.WordBank.forTheme(theme, diff, count),
          source: 'offline', matched: !!matched, error: keyErr
        });
      }
      var p = providers[i];
      var maxTries = p.retries || 1;
      return withTimeout(function (signal) {
        return p.fn(theme, diff, count, signal, p.key);
      }).then(function (list) {
        var clean = sanitize(list, theme);
        if (clean.length >= 8) return { words: clean, source: p.src, matched: true };
        throw new Error('för få giltiga ord (' + (clean ? clean.length : 0) + ')');
      }).catch(function (err) {
        var msg = (err && err.message) || String(err);
        if (p.src === 'gemini' || p.src === 'openrouter') keyErr = msg;
        if (global.console) {
          global.console.warn('LLM-försök ' + attempt + '/' + maxTries + ' (' + p.src + ') misslyckades: ' + msg);
        }
        if (attempt < maxTries) {
          return delay(700).then(function () { return tryP(i, attempt + 1); });
        }
        return tryP(i + 1, 1);
      });
    }
    return tryP(0, 1);
  }

  global.LLM = {
    fetchThemeWords: fetchThemeWords,
    imageFor: imageFor,
    _extractJson: extractJson,
    _sanitize: sanitize
  };
})(window);
