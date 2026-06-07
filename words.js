/* words.js — inbyggd svensk ordbank (offline-fallback).
 * Används när LLM:en inte svarar eller ger för få giltiga ord, så att
 * korsordet ALLTID kan genereras. Varje post: [SVAR, "ledtråd"].
 * Svar = ETT ord, versaler, endast A-ÖÅÄ. Ledtråd innehåller aldrig svaret. */
(function (global) {
  'use strict';

  var THEMES = {
    djur: {
      syn: ['djur', 'animal', 'husdjur', 'vilda djur', 'zoo', 'fauna', 'skogen'],
      words: [
        ['HUND', 'Skäller och viftar på svansen'],
        ['KATT', 'Spinner och jagar möss'],
        ['HÄST', 'Galopperar på ängen'],
        ['GRIS', 'Bor i en stia och gillar lera'],
        ['ÄLG', 'Skogens konung'],
        ['RÄV', 'Listig och rödbrun'],
        ['BJÖRN', 'Går i ide på vintern'],
        ['VARG', 'Ylar mot månen'],
        ['ORM', 'Krälar utan ben'],
        ['GRODA', 'Kväker vid dammen'],
        ['DELFIN', 'Smart däggdjur i havet'],
        ['TIGER', 'Randigt stort kattdjur'],
        ['LEJON', 'Savannens kung'],
        ['ZEBRA', 'Randig släkting till hästen'],
        ['KANIN', 'Hoppar och har långa öron'],
        ['EKORRE', 'Samlar nötter i trädet'],
        ['UGGLA', 'Vaken nattfågel som hoar'],
        ['GET', 'Mekar och klättrar gärna']
      ]
    },
    mat: {
      syn: ['mat', 'food', 'kök', 'middag', 'frukost', 'lunch', 'maträtt'],
      words: [
        ['BRÖD', 'Bakas av mjöl och jäst'],
        ['OST', 'Gult pålägg med hål ibland'],
        ['SMÖR', 'Breds på mackan'],
        ['KÖTT', 'Biff eller fläsk'],
        ['FISK', 'Simmar och kan ätas'],
        ['PASTA', 'Italienskt, t.ex. spaghetti'],
        ['PIZZA', 'Italiensk med tomat och ost'],
        ['SOPPA', 'Äts varm med sked'],
        ['SALLAD', 'Grön och nyttig till maten'],
        ['POTATIS', 'Kokas eller mosas'],
        ['KORV', 'Grillas på sommaren'],
        ['SOCKER', 'Gör maten söt'],
        ['SALT', 'Kryddar och finns i havet'],
        ['PEPPAR', 'Svart krydda i kvarn'],
        ['KAKA', 'Söt och bakad'],
        ['GLASS', 'Kall sommargodis'],
        ['HONUNG', 'Sött från bin']
      ]
    },
    frukt: {
      syn: ['frukt', 'fruit', 'bär', 'grönsak', 'frukter'],
      words: [
        ['ÄPPLE', 'Röd eller grön och knaprig'],
        ['PÄRON', 'Saftig grön frukt'],
        ['BANAN', 'Gul och böjd'],
        ['APELSIN', 'Orange citrusfrukt'],
        ['CITRON', 'Gul och sur'],
        ['DRUVA', 'Växer i klasar'],
        ['HALLON', 'Rött bär som smular lätt'],
        ['MELON', 'Stor och saftig'],
        ['KIWI', 'Grön med små kärnor'],
        ['PLOMMON', 'Blålila stenfrukt'],
        ['ANANAS', 'Taggig tropisk frukt'],
        ['MANGO', 'Söt tropisk frukt'],
        ['MOROT', 'Orange och växer i jorden'],
        ['TOMAT', 'Röd och rund i salladen']
      ]
    },
    natur: {
      syn: ['natur', 'nature', 'landskap', 'utomhus', 'miljö'],
      words: [
        ['SKOG', 'Full av träd'],
        ['BERG', 'Högt och stenigt'],
        ['SJÖ', 'Vatten omgivet av land'],
        ['HAV', 'Stort saltvatten'],
        ['FLOD', 'Rinnande vattendrag'],
        ['ÄNG', 'Blommor och gräs'],
        ['TRÄD', 'Har stam och grenar'],
        ['BLOMMA', 'Doftar och slår ut'],
        ['GRÄS', 'Grönt på gräsmattan'],
        ['STEN', 'Hård bit av berg'],
        ['SAND', 'Finns på stranden'],
        ['MOLN', 'Vitt på himlen'],
        ['REGN', 'Faller från skyn'],
        ['VIND', 'Blåser i träden'],
        ['GROTTA', 'Mörkt hål i berget']
      ]
    },
    kropp: {
      syn: ['kropp', 'kroppen', 'body', 'anatomi', 'människa'],
      words: [
        ['HUVUD', 'Sitter ovanpå halsen'],
        ['ARM', 'Mellan axel och hand'],
        ['HAND', 'Har fem fingrar'],
        ['FOT', 'Står på marken'],
        ['BEN', 'Mellan höft och fot'],
        ['ÖGA', 'Ser med det'],
        ['NÄSA', 'Luktar med den'],
        ['MUN', 'Pratar och äter med den'],
        ['ÖRA', 'Hör med det'],
        ['TAND', 'Tuggar med dem'],
        ['HJÄRTA', 'Pumpar blodet'],
        ['MAGE', 'Smälter maten'],
        ['FINGER', 'Tio på händerna'],
        ['HÅR', 'Växer på huvudet'],
        ['HALS', 'Mellan huvud och axlar']
      ]
    },
    sport: {
      syn: ['sport', 'idrott', 'träning', 'spel', 'lek'],
      words: [
        ['FOTBOLL', 'Sparkas mot mål'],
        ['HOCKEY', 'Spelas på is med klubba'],
        ['TENNIS', 'Slås med racket över nät'],
        ['GOLF', 'Liten boll i hål'],
        ['SIMNING', 'Sport i vatten'],
        ['BOXNING', 'Kamp med handskar'],
        ['LÖPNING', 'Att springa fort'],
        ['SKIDOR', 'Åker i snön'],
        ['HANDBOLL', 'Kastas mot mål med händerna'],
        ['BASKET', 'Boll i korg'],
        ['CYKLING', 'Tävling på två hjul'],
        ['RIDNING', 'Sport på hästrygg'],
        ['BANDY', 'Liknar hockey utomhus']
      ]
    },
    farg: {
      syn: ['färg', 'färger', 'color', 'colour', 'kulör'],
      words: [
        ['RÖD', 'Färgen på blod'],
        ['BLÅ', 'Färgen på himlen'],
        ['GUL', 'Färgen på solen'],
        ['GRÖN', 'Färgen på gräset'],
        ['SVART', 'Mörkaste färgen'],
        ['VIT', 'Färgen på snön'],
        ['ROSA', 'Ljust rödaktig'],
        ['LILA', 'Blandning av blått och rött'],
        ['BRUN', 'Färgen på choklad'],
        ['GRÅ', 'Mellan svart och vitt'],
        ['ORANGE', 'Färgen på en morot']
      ]
    },
    land: {
      syn: ['land', 'länder', 'country', 'geografi', 'nationer', 'världen'],
      words: [
        ['SVERIGE', 'Vårt avlånga land'],
        ['NORGE', 'Grannland i väst med fjordar'],
        ['FINLAND', 'Grannland i öst'],
        ['DANMARK', 'Grannland i söder'],
        ['ISLAND', 'Ö i Atlanten med vulkaner'],
        ['TYSKLAND', 'Stort land i Centraleuropa'],
        ['SPANIEN', 'Soligt land med tjurfäktning'],
        ['ITALIEN', 'Stövelformat land'],
        ['ENGLAND', 'Del av Storbritannien'],
        ['POLEN', 'Land söder om Östersjön'],
        ['JAPAN', 'Önation i Östasien']
      ]
    },
    yrke: {
      syn: ['yrke', 'yrken', 'jobb', 'arbete', 'profession'],
      words: [
        ['LÄKARE', 'Hjälper sjuka'],
        ['LÄRARE', 'Undervisar i skolan'],
        ['BAGARE', 'Bakar bröd'],
        ['POLIS', 'Upprätthåller lagen'],
        ['KOCK', 'Lagar mat på restaurang'],
        ['PILOT', 'Flyger flygplan'],
        ['SNICKARE', 'Bygger i trä'],
        ['BRANDMAN', 'Släcker bränder'],
        ['BONDE', 'Odlar och har djur'],
        ['FISKARE', 'Fångar fisk'],
        ['MÅLARE', 'Målar väggar och tavlor']
      ]
    },
    fordon: {
      syn: ['fordon', 'transport', 'bilar', 'vehicle', 'färdmedel'],
      words: [
        ['BIL', 'Fyra hjul och ratt'],
        ['BUSS', 'Stor för många passagerare'],
        ['TÅG', 'Går på räls'],
        ['CYKEL', 'Två hjul och pedaler'],
        ['BÅT', 'Färdas på vatten'],
        ['FLYGPLAN', 'Färdas i luften'],
        ['LASTBIL', 'Stor för transport'],
        ['TRAKTOR', 'Används på gården'],
        ['MOPED', 'Liten motorcykel'],
        ['SPÅRVAGN', 'Går på räls i stan'],
        ['HELIKOPTER', 'Flyger med rotor']
      ]
    },
    vader: {
      syn: ['väder', 'vader', 'weather', 'klimat', 'meteorologi'],
      words: [
        ['SOL', 'Lyser och värmer'],
        ['REGN', 'Blött från skyn'],
        ['SNÖ', 'Vit vinternederbörd'],
        ['VIND', 'Rör luften'],
        ['DIMMA', 'Gör sikten dålig'],
        ['ÅSKA', 'Mullrar och blixtrar'],
        ['STORM', 'Mycket kraftig vind'],
        ['MOLN', 'Vita på himlen'],
        ['HAGEL', 'Iskorn som faller'],
        ['FROST', 'Vit rim på morgonen'],
        ['VÄRME', 'Hög temperatur']
      ]
    },
    rymd: {
      syn: ['rymd', 'rymden', 'space', 'universum', 'astronomi', 'planeter'],
      words: [
        ['MÅNE', 'Lyser på natthimlen'],
        ['STJÄRNA', 'Glittrar på natten'],
        ['PLANET', 'Jorden är en sådan'],
        ['RAKET', 'Skjuts upp i rymden'],
        ['KOMET', 'Har en lysande svans'],
        ['GALAX', 'Stor samling av stjärnor'],
        ['METEOR', 'Stjärnfall på himlen'],
        ['SATELLIT', 'Kretsar runt jorden'],
        ['ASTRONAUT', 'Reser i rymden'],
        ['JUPITER', 'Solsystemets största planet'],
        ['MARS', 'Den röda planeten']
      ]
    },
    hem: {
      syn: ['hem', 'hemmet', 'möbler', 'hus', 'home', 'inredning', 'rum'],
      words: [
        ['BORD', 'Står ofta på fyra ben'],
        ['STOL', 'Sitter på den'],
        ['SÄNG', 'Sover i den'],
        ['SOFFA', 'Mjuk att sitta i'],
        ['LAMPA', 'Ger ljus'],
        ['DÖRR', 'Öppnas och stängs'],
        ['FÖNSTER', 'Släpper in ljus'],
        ['SPIS', 'Lagar mat på den'],
        ['KYLSKÅP', 'Håller maten kall'],
        ['MATTA', 'Ligger på golvet'],
        ['SPEGEL', 'Visar din spegelbild'],
        ['KUDDE', 'Mjuk under huvudet']
      ]
    },
    medicin: {
      syn: ['medicin', 'mediciner', 'apotek', 'apoteket', 'läkemedel', 'lakemedel', 'sjuk', 'sjukdom', 'hälsa', 'halsa', 'vård', 'vard', 'sjukhus'],
      words: [
        ['TABLETT', 'Sväljs med vatten mot värk'],
        ['MEDICIN', 'Tas när man är sjuk'],
        ['RECEPT', 'Krävs för att hämta viss medicin'],
        ['SALVA', 'Smörjs på huden'],
        ['PLÅSTER', 'Sätts på ett sår'],
        ['VITAMIN', 'Finns i frukt, t.ex. C'],
        ['FEBER', 'Hög kroppstemperatur'],
        ['VÄRK', 'Gör ont, t.ex. huvud-'],
        ['SPRUTA', 'Ger ofta ett vaccin'],
        ['VACCIN', 'Skyddar mot sjukdom'],
        ['HOSTA', 'Skäller till i halsen'],
        ['ALLERGI', 'Reaktion mot t.ex. pollen'],
        ['KAPSEL', 'Form av medicin att svälja'],
        ['APOTEK', 'Här köper man läkemedel'],
        ['TERMOMETER', 'Mäter febern'],
        ['STETOSKOP', 'Läkaren lyssnar på hjärtat med det'],
        ['FÖRBAND', 'Lindas runt ett sår']
      ]
    },
    skola: {
      syn: ['skola', 'skolan', 'school', 'utbildning', 'klassrum'],
      words: [
        ['PENNA', 'Skriver med den'],
        ['BOK', 'Läser i den'],
        ['SUDD', 'Tar bort blyerts'],
        ['TAVLA', 'Läraren skriver på den'],
        ['RAST', 'Paus mellan lektioner'],
        ['LÄXA', 'Görs hemma efter skolan'],
        ['PROV', 'Mäter vad du kan'],
        ['BETYG', 'Sätts på din kunskap'],
        ['LINJAL', 'Mäter och drar raka streck'],
        ['KLASS', 'Grupp av elever'],
        ['MATTE', 'Ämne med tal och siffror']
      ]
    }
  };

  function norm(s) { return (s || '').toString().toLowerCase().trim(); }

  function lenOk(w, diff) {
    var n = w.length;
    if (diff === 'latt') return n >= 3 && n <= 6;
    if (diff === 'svar') return n >= 5 && n <= 12;
    return n >= 3 && n <= 9; // medel
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(pairs, diff, count) {
    var pool = pairs.filter(function (p) { return lenOk(p[0], diff); });
    if (pool.length < count) pool = pairs.slice(); // hellre fler ord än för få
    pool = shuffle(pool.slice());
    return pool.slice(0, count).map(function (p) {
      return { answer: p[0], clue: p[1] };
    });
  }

  // Returnerar nyckeln för den tema-lista som matchar fritextsträngen, annars null.
  function matchKey(theme) {
    var t = norm(theme);
    if (!t) return null;
    for (var key in THEMES) {
      if (!THEMES.hasOwnProperty(key)) continue;
      if (key === t) return key;
      var th = THEMES[key];
      var hit = th.syn.some(function (s) {
        return t.indexOf(s) >= 0 || s.indexOf(t) >= 0;
      });
      if (hit) return key;
    }
    return null;
  }

  // Hitta bästa tema-träff för en fritextsträng. Faller tillbaka på ALLA ord.
  function forTheme(theme, diff, count) {
    var key = matchKey(theme);
    var pairs;
    if (key) {
      pairs = THEMES[key].words.slice();
    } else {
      pairs = [];
      for (var k in THEMES) {
        if (THEMES.hasOwnProperty(k)) pairs = pairs.concat(THEMES[k].words);
      }
    }
    return pick(pairs, diff, Math.max(count, 12));
  }

  global.WordBank = { forTheme: forTheme, matchKey: matchKey, THEMES: THEMES };
})(window);
