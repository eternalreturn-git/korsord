/* app.js — kopplar ihop UI: hämta ord/bilder, generera, rita, fyll i, kontrollera. */
(function () {
  'use strict';

  var VALID = /^[A-ZÅÄÖ]$/;

  var data = null;       // { rows, cols, cells, entries, pictures }
  var inputs = [];       // inputs[r][c] -> <input> | null
  var acrossOf = [];     // acrossOf[r][c] -> entry | null
  var downOf = [];       // downOf[r][c]  -> entry | null
  var curEntry = null;
  var curDir = 'H';
  var lastCell = null;
  var editOrder = [];        // ord i den ordning användaren senast skrev i dem (för Ångra)
  var solutionShown = false; // växling för "Visa lösning"
  var savedSnapshot = null;  // användarens ifyllning innan lösningen visades
  var checkShown = false;    // växling för "Kontrollera"

  var el = {};
  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function () {
    el.theme = $('theme');
    el.difficulty = $('difficulty');
    el.generate = $('generate');
    el.status = $('status');
    el.grid = $('grid');
    el.across = $('across');
    el.down = $('down');
    el.check = $('check');
    el.revealCell = $('revealCell');
    el.revealAll = $('revealAll');
    el.clear = $('clear');
    el.sourceNote = $('source-note');
    el.pop = $('img-pop');
    el.overlay = $('overlay');
    el.overlayText = $('overlay-text');
    el.apikey = $('apikey');
    el.apiBox = $('apiBox');

    try {
      el.theme.value = localStorage.getItem('kw_theme') || '';
      var d = localStorage.getItem('kw_diff');
      if (d) setDiff(d);
      var k = localStorage.getItem('kw_apikey') || '';
      if (k) { el.apikey.value = k; }
    } catch (e) {}

    el.apikey.addEventListener('change', function () {
      try { localStorage.setItem('kw_apikey', el.apikey.value.trim()); } catch (e) {}
      updateApiPanel();
    });
    updateApiPanel();   // dölj panelen direkt om en nyckel redan finns

    // Segmentkontroll
    el.difficulty.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      setDiff(b.dataset.val);
      try { localStorage.setItem('kw_diff', b.dataset.val); } catch (e) {}
    });

    el.generate.addEventListener('click', onGenerate);
    el.theme.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') onGenerate(); });
    el.check.addEventListener('click', onCheck);
    el.revealCell.addEventListener('click', onRevealCell);
    el.revealAll.addEventListener('click', onRevealAll);
    el.clear.addEventListener('click', onClear);
    window.addEventListener('resize', computeCellSize);
    window.addEventListener('scroll', hidePop, true);

    setActionsEnabled(false);
  });

  function getDiff() {
    var on = el.difficulty.querySelector('.on');
    return on ? on.dataset.val : 'medel';
  }
  function setDiff(val) {
    var btns = el.difficulty.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].dataset.val === val);
  }

  function setStatus(msg, level) {
    el.status.textContent = msg || '';
    el.status.classList.toggle('error', level === 'error');
    el.status.classList.toggle('warn', level === 'warn');
  }

  // Nyckel att använda: inmatad (denna enhet) annars inbäddad i config.js.
  function effectiveKey() {
    var entered = (el.apikey && el.apikey.value || '').trim();
    if (entered) return entered;
    return (window.KORSORD_CONFIG && window.KORSORD_CONFIG.apiKey || '').trim();
  }

  // Dölj hela API-nyckelpanelen så fort en nyckel finns (inmatad eller i config).
  function updateApiPanel() {
    if (el.apiBox) el.apiBox.style.display = effectiveKey() ? 'none' : '';
  }
  function setActionsEnabled(on) {
    [el.check, el.revealCell, el.revealAll, el.clear].forEach(function (b) { if (b) b.disabled = !on; });
  }
  function showOverlay(text) { el.overlayText.textContent = text; el.overlay.hidden = false; }
  function hideOverlay() { el.overlay.hidden = true; }

  function describeSource(res) {
    switch (res.source) {
      case 'gemini': return 'Google Gemini';
      case 'openrouter': return 'OpenRouter';
      case 'pollinations': return 'gratis tjänst (Pollinations)';
      default: return res.matched
        ? 'inbyggd ordlista'
        : 'inbyggd ordlista (temat matchade ingen lista — blandade ord)';
    }
  }

  // ---- Generering ----

  function onGenerate() {
    hidePop();
    var theme = el.theme.value.trim();
    var diff = getDiff();
    try {
      localStorage.setItem('kw_theme', theme);
      localStorage.setItem('kw_diff', diff);
    } catch (e) {}

    var count = diff === 'latt' ? 16 : diff === 'svar' ? 24 : 20;
    var apiKey = effectiveKey();
    try { localStorage.setItem('kw_apikey', (el.apikey.value || '').trim()); } catch (e) {}

    el.generate.disabled = true;
    setActionsEnabled(false);
    showOverlay('Hämtar ord för temat…');

    LLM.fetchThemeWords(theme || 'blandat', diff, count, apiKey).then(function (res) {
      showOverlay('Bygger korsordet…');
      setTimeout(function () { buildAndRender(res, theme); }, 30);
    }).catch(function () {
      var t = theme || 'blandat';
      buildAndRender({
        words: window.WordBank.forTheme(t, diff, count),
        source: 'offline', matched: !!window.WordBank.matchKey(t)
      }, theme);
    });
  }

  function buildAndRender(res, theme) {
    try {
      var puzzle = CrosswordGen.generate(res.words, { attempts: 350, pictures: 3 });
      if (!puzzle || puzzle.entries.length < 2) {
        var extra = window.WordBank.forTheme(theme || 'blandat', getDiff(), 24);
        puzzle = CrosswordGen.generate(res.words.concat(extra), { attempts: 350, pictures: 3 });
      }
      data = puzzle;
      renderGrid();
      renderClues();
      var placed = data.entries.length;
      if (res.source === 'offline') {
        var why = effectiveKey()
          ? (res.error || 'kunde inte nå LLM:en')
          : 'ingen API-nyckel angiven';
        setStatus('Reservord visas — ' + why, 'warn');
        el.sourceNote.textContent = 'Lägg till/byt en gratis API-nyckel i panelen ovan för att ' +
          'generera riktiga ord om "' + (theme || 'blandat') + '".';
        if (el.apiBox) el.apiBox.style.display = '';   // visa panelen så nyckeln kan rättas
      } else {
        setStatus('Klart — ' + placed + ' ord placerade, ' + data.pictures.length +
                  ' bildledtrådar. Källa: ' + describeSource(res) + '.');
        el.sourceNote.textContent = 'Tema: ' + (theme || 'blandat') + '. Ordkälla: ' + describeSource(res) + '.';
        updateApiPanel();   // dölj panelen när allt funkar
      }
      setActionsEnabled(true);
      var first = data.entries.find(function (e) { return !e.picture; }) || data.entries[0];
      if (first) selectEntry(first, true);
    } catch (e) {
      setStatus('Något gick fel vid generering. Försök igen.', true);
      if (window.console) console.error(e);
    } finally {
      el.generate.disabled = false;
      hideOverlay();
    }
  }

  function make2d(rows, cols, val) {
    var a = [];
    for (var r = 0; r < rows; r++) { var row = []; for (var c = 0; c < cols; c++) row.push(val); a.push(row); }
    return a;
  }

  function cellsOfEntry(e) {
    var list = [];
    var dr = e.dir === 'V' ? 1 : 0, dc = e.dir === 'H' ? 1 : 0;
    for (var i = 0; i < e.len; i++) list.push({ r: e.row + dr * i, c: e.col + dc * i });
    return list;
  }

  // ---- Rendering ----

  function renderGrid() {
    editOrder = [];
    solutionShown = false;
    savedSnapshot = null;
    checkShown = false;
    if (el.revealAll) el.revealAll.textContent = 'Visa lösning';
    if (el.check) el.check.textContent = 'Kontrollera';
    el.grid.innerHTML = '';
    el.grid.style.gridTemplateColumns = 'repeat(' + data.cols + ', var(--cs))';
    inputs = make2d(data.rows, data.cols, null);
    acrossOf = make2d(data.rows, data.cols, null);
    downOf = make2d(data.rows, data.cols, null);

    data.entries.forEach(function (e) {
      cellsOfEntry(e).forEach(function (p) {
        if (e.dir === 'H') acrossOf[p.r][p.c] = e; else downOf[p.r][p.c] = e;
      });
    });

    for (var r = 0; r < data.rows; r++) {
      for (var c = 0; c < data.cols; c++) {
        var cell = data.cells[r][c];
        var div = document.createElement('div');
        if (cell && cell.image) { renderImageCell(div, cell, r, c); }
        else if (cell) { renderLetterCell(div, cell, r, c); }
        else { div.className = 'cell black'; }
        el.grid.appendChild(div);
      }
    }
    computeCellSize();
  }

  function renderLetterCell(div, cell, r, c) {
    div.className = 'cell';
    if (cell.number) {
      var num = document.createElement('span');
      num.className = 'num'; num.textContent = cell.number;
      div.appendChild(num);
    }
    var inp = document.createElement('input');
    inp.type = 'text'; inp.maxLength = 1;
    inp.setAttribute('inputmode', 'text');
    inp.setAttribute('autocapitalize', 'characters');
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('autocorrect', 'off');
    inp.spellcheck = false;
    inp.dataset.r = r; inp.dataset.c = c;
    inp.addEventListener('input', onInput);
    inp.addEventListener('keydown', onKeyDown);
    inp.addEventListener('focus', onFocus);
    inp.addEventListener('click', onCellClick);
    div.appendChild(inp);
    inputs[r][c] = inp;
  }

  function renderImageCell(div, cell, r, c) {
    div.className = 'cell clue-cell dir-' + cell.dir;
    div.tabIndex = 0;
    var sr = cell.dir === 'H' ? r : r + 1;
    var sc = cell.dir === 'H' ? c + 1 : c;
    div.dataset.sr = sr; div.dataset.sc = sc; div.dataset.dir = cell.dir;

    var shim = document.createElement('div'); shim.className = 'shimmer'; div.appendChild(shim);
    var arrow = document.createElement('span'); arrow.className = 'arrow'; div.appendChild(arrow);

    var img = document.createElement('img');
    img.alt = cell.clue;
    function showFallback() {
      // Ingen bild hittades: visa textledtråden i rutan -> alltid lösbart.
      if (shim.parentNode) shim.parentNode.removeChild(shim);
      if (img.parentNode) img.parentNode.removeChild(img);
      div._popUrl = '';
      if (!div.querySelector('.clue-fallback')) {
        var fb = document.createElement('div');
        fb.className = 'clue-fallback'; fb.textContent = cell.clue;
        div.appendChild(fb);
      }
    }
    img.onload = function () { if (shim.parentNode) shim.parentNode.removeChild(shim); };
    img.onerror = showFallback;
    // Hämta en riktig bild från Wikipedia (svenska svaret, annars engelska motivet).
    LLM.imageFor(cell.answer, cell.img).then(function (url) {
      if (url) { div._popUrl = url; div.insertBefore(img, arrow); img.src = url; }
      else showFallback();
    });

    function selectPictureWord() {
      var lut = cell.dir === 'H' ? acrossOf : downOf;
      var e = lut[sr] ? lut[sr][sc] : null;
      if (e) selectEntry(e, true);
    }
    div._popUrl = '';
    div.addEventListener('pointerenter', function () { showPop(div, div._popUrl); });
    div.addEventListener('pointerleave', hidePop);
    div.addEventListener('focus', function () { showPop(div, div._popUrl); });
    div.addEventListener('blur', hidePop);
    div.addEventListener('click', function () { selectPictureWord(); showPop(div, div._popUrl); });
  }

  function showPop(refEl, url) {
    if (!url) return;
    var rect = refEl.getBoundingClientRect();
    el.pop.innerHTML = '';
    var im = document.createElement('img'); im.src = url; el.pop.appendChild(im);
    var w = 200, h = 200;
    var x = rect.right + 12, y = rect.top - 10;
    if (x + w > window.innerWidth - 8) x = rect.left - w - 12;
    if (x < 8) x = 8;
    if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    if (y < 8) y = 8;
    el.pop.style.left = x + 'px'; el.pop.style.top = y + 'px';
    el.pop.classList.add('show');
  }
  function hidePop() { el.pop.classList.remove('show'); }

  function computeCellSize() {
    if (!data) return;
    var wrap = el.grid.parentElement;
    var avail = wrap.clientWidth - 28;
    if (avail <= 0) avail = window.innerWidth - 60;
    var size = Math.floor(avail / data.cols);
    size = Math.max(26, Math.min(size, 48));
    document.documentElement.style.setProperty('--cs', size + 'px');
  }

  function renderClues() {
    el.across.innerHTML = '';
    el.down.innerHTML = '';
    data.entries.forEach(function (e) {
      if (e.picture) return; // bildord har bilden som ledtråd, ej i listan
      var li = document.createElement('li');
      li.dataset.dir = e.dir; li.dataset.num = e.number;
      var n = document.createElement('span'); n.className = 'cnum'; n.textContent = (e.number || '?') + '.';
      var txt = document.createElement('span'); txt.textContent = e.clue + ' (' + e.len + ')';
      li.appendChild(n); li.appendChild(txt);
      li.addEventListener('click', function () { selectEntry(e, true); });
      (e.dir === 'H' ? el.across : el.down).appendChild(li);
    });
  }

  // ---- Markering / navigering ----

  function getCellRC(inp) {
    return { r: parseInt(inp.dataset.r, 10), c: parseInt(inp.dataset.c, 10) };
  }
  function onFocus(ev) { hidePop(); ev.target.select(); var rc = getCellRC(ev.target); pickEntryForCell(rc.r, rc.c, false); }
  function onCellClick(ev) { var rc = getCellRC(ev.target); pickEntryForCell(rc.r, rc.c, true); }

  function pickEntryForCell(r, c, allowToggle) {
    var a = acrossOf[r][c], d = downOf[r][c];
    var keyStr = r + ',' + c;
    if (allowToggle && lastCell === keyStr && a && d) {
      curDir = curDir === 'H' ? 'V' : 'H';
    } else if (curDir === 'H' && a) { curDir = 'H'; }
    else if (curDir === 'V' && d) { curDir = 'V'; }
    else { curDir = a ? 'H' : 'V'; }
    lastCell = keyStr;
    curEntry = (curDir === 'H') ? a : d;
    if (!curEntry) curEntry = a || d;
    highlight(); syncActiveClue();
  }

  function selectEntry(e, focusFirstEmpty) {
    curEntry = e; curDir = e.dir;
    var cells = cellsOfEntry(e);
    var target = cells[0];
    if (focusFirstEmpty) {
      for (var i = 0; i < cells.length; i++) {
        var p = cells[i];
        if (inputs[p.r][p.c] && !inputs[p.r][p.c].value) { target = p; break; }
      }
    }
    lastCell = target.r + ',' + target.c;
    var inp = inputs[target.r][target.c];
    if (inp) inp.focus();
    highlight(); syncActiveClue();
  }

  function clearHighlight() {
    var nodes = el.grid.querySelectorAll('.cell.hl, .cell.cur');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('hl', 'cur');
  }
  function highlight() {
    clearHighlight();
    if (!curEntry) return;
    var active = document.activeElement;
    var ar = active && active.dataset ? parseInt(active.dataset.r, 10) : -1;
    var ac = active && active.dataset ? parseInt(active.dataset.c, 10) : -1;
    cellsOfEntry(curEntry).forEach(function (p) {
      var inp = inputs[p.r][p.c];
      if (!inp) return;
      var div = inp.parentElement;
      div.classList.add('hl');
      if (p.r === ar && p.c === ac) div.classList.add('cur');
    });
  }
  function syncActiveClue() {
    [el.across, el.down].forEach(function (ul) {
      for (var i = 0; i < ul.children.length; i++) ul.children[i].classList.remove('active');
    });
    if (!curEntry || curEntry.picture) return;
    var ul = curEntry.dir === 'H' ? el.across : el.down;
    for (var i = 0; i < ul.children.length; i++) {
      if (parseInt(ul.children[i].dataset.num, 10) === curEntry.number) {
        ul.children[i].classList.add('active'); break;
      }
    }
  }

  // ---- Inmatning ----

  function onInput(ev) {
    var inp = ev.target;
    var ch = (inp.value || '').toUpperCase().slice(-1);
    if (VALID.test(ch)) {
      inp.value = ch;
      inp.parentElement.classList.remove('wrong', 'correct');
      noteEdit();
      moveNext();
    } else { inp.value = ''; }
  }

  // Kom ihåg vilket ord som senast redigerades (för Ångra-knappen).
  function noteEdit() {
    if (!curEntry) return;
    var i = editOrder.indexOf(curEntry);
    if (i >= 0) editOrder.splice(i, 1);
    editOrder.push(curEntry);
  }

  function onKeyDown(ev) {
    var rc = getCellRC(ev.target);
    var k = ev.key;
    // Skriv direkt: en bokstavstangent ERSÄTTER innevarande bokstav och går vidare,
    // utan att man behöver radera först.
    if (k && k.length === 1 && /[A-Za-zÅÄÖåäö]/.test(k)) {
      ev.preventDefault();
      ev.target.value = k.toUpperCase();
      ev.target.parentElement.classList.remove('wrong', 'correct');
      noteEdit();
      moveNext();
      return;
    }
    if (k === 'Backspace') {
      if (ev.target.value) { ev.target.value = ''; ev.target.parentElement.classList.remove('wrong', 'correct'); }
      else { ev.preventDefault(); movePrev(); }
      return;
    }
    if (k === 'ArrowRight') { ev.preventDefault(); step(rc, 0, 1); return; }
    if (k === 'ArrowLeft') { ev.preventDefault(); step(rc, 0, -1); return; }
    if (k === 'ArrowDown') { ev.preventDefault(); step(rc, 1, 0); return; }
    if (k === 'ArrowUp') { ev.preventDefault(); step(rc, -1, 0); return; }
    if (k === ' ') { ev.preventDefault(); pickEntryForCell(rc.r, rc.c, true); return; }
    if (k === 'Enter') { ev.preventDefault(); gotoNextEntry(); return; }
  }

  function focusCell(r, c) {
    if (r < 0 || c < 0 || r >= data.rows || c >= data.cols) return false;
    var inp = inputs[r][c];
    if (!inp) return false;
    inp.focus();
    try { inp.select(); } catch (e) {}   // markera ev. befintlig bokstav -> nästa tangent ersätter
    lastCell = r + ',' + c; highlight();
    return true;
  }
  function step(rc, dr, dc) {
    var r = rc.r + dr, c = rc.c + dc;
    while (r >= 0 && c >= 0 && r < data.rows && c < data.cols) {
      if (inputs[r][c]) { focusCell(r, c); pickEntryForCell(r, c, false); return; }
      r += dr; c += dc;
    }
  }
  function moveNext() {
    if (!curEntry) return;
    var cells = cellsOfEntry(curEntry);
    var active = document.activeElement;
    var idx = cells.findIndex(function (p) { return inputs[p.r][p.c] === active; });
    for (var i = idx + 1; i < cells.length; i++) { var p = cells[i]; focusCell(p.r, p.c); return; }
    gotoNextEntry();
  }
  function movePrev() {
    if (!curEntry) return;
    var cells = cellsOfEntry(curEntry);
    var active = document.activeElement;
    var idx = cells.findIndex(function (p) { return inputs[p.r][p.c] === active; });
    if (idx > 0) {
      var p = cells[idx - 1];
      inputs[p.r][p.c].focus(); lastCell = p.r + ',' + p.c; highlight();
    }
  }
  function gotoNextEntry() {
    if (!curEntry || !data) return;
    var idx = data.entries.indexOf(curEntry);
    for (var s = 1; s <= data.entries.length; s++) {
      var e = data.entries[(idx + s) % data.entries.length];
      var cells = cellsOfEntry(e);
      var hasEmpty = cells.some(function (p) { return inputs[p.r][p.c] && !inputs[p.r][p.c].value; });
      if (hasEmpty) { selectEntry(e, true); return; }
    }
    selectEntry(data.entries[(idx + 1) % data.entries.length], false);
  }

  // ---- Knappar ----

  // Växla: markera rätt/fel / dölj markeringen igen.
  function onCheck() {
    if (!data) return;
    if (checkShown) {
      var nodes = el.grid.querySelectorAll('.cell.wrong, .cell.correct');
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('wrong', 'correct');
      [el.across, el.down].forEach(function (ul) {
        for (var j = 0; j < ul.children.length; j++) ul.children[j].classList.remove('solved');
      });
      checkShown = false;
      el.check.textContent = 'Kontrollera';
      setStatus('Kontroll dold.');
      return;
    }
    var allFilled = true, allCorrect = true;
    for (var r = 0; r < data.rows; r++) {
      for (var c = 0; c < data.cols; c++) {
        var cell = data.cells[r][c], inp = inputs[r][c];
        if (!cell || !cell.letter || !inp) continue;
        var div = inp.parentElement; div.classList.remove('wrong', 'correct');
        var v = (inp.value || '').toUpperCase();
        if (!v) { allFilled = false; allCorrect = false; continue; }
        if (v === cell.letter) div.classList.add('correct');
        else { div.classList.add('wrong'); allCorrect = false; }
      }
    }
    markSolvedClues();
    checkShown = true;
    el.check.textContent = 'Dölj kontroll';
    if (allFilled && allCorrect) setStatus('Snyggt — allt rätt!');
    else if (allCorrect) setStatus('Så långt rätt. Fortsätt! (Tryck igen för att dölja.)');
    else setStatus('Rött = fel. Tryck igen för att dölja markeringen.');
  }

  function markSolvedClues() {
    if (!data) return;
    function solved(e) {
      return cellsOfEntry(e).every(function (p) {
        var inp = inputs[p.r][p.c];
        return inp && (inp.value || '').toUpperCase() === data.cells[p.r][p.c].letter;
      });
    }
    [el.across, el.down].forEach(function (ul) {
      for (var i = 0; i < ul.children.length; i++) {
        var num = parseInt(ul.children[i].dataset.num, 10);
        var dir = ul.children[i].dataset.dir;
        var e = data.entries.find(function (x) { return x.number === num && x.dir === dir && !x.picture; });
        ul.children[i].classList.toggle('solved', !!(e && solved(e)));
      }
    });
  }

  function onRevealCell() {
    var active = document.activeElement;
    if (!active || !active.dataset || active.dataset.r === undefined) return;
    var r = parseInt(active.dataset.r, 10), c = parseInt(active.dataset.c, 10);
    var cell = data.cells[r][c];
    if (!cell || !cell.letter) return;
    active.value = cell.letter;
    active.parentElement.classList.remove('wrong');
    active.parentElement.classList.add('correct');
    moveNext(); markSolvedClues();
  }
  // Växla: visa hela lösningen / dölj den och återställ användarens ifyllning.
  function onRevealAll() {
    if (!data) return;
    if (!solutionShown) {
      savedSnapshot = snapshotValues();
      for (var r = 0; r < data.rows; r++) for (var c = 0; c < data.cols; c++) {
        var cell = data.cells[r][c], inp = inputs[r][c];
        if (cell && cell.letter && inp) {
          inp.value = cell.letter;
          inp.parentElement.classList.remove('wrong');
          inp.parentElement.classList.add('correct');
        }
      }
      solutionShown = true;
      el.revealAll.textContent = 'Dölj lösning';
      markSolvedClues();
      setStatus('Lösningen visas. Tryck igen för att dölja den.');
    } else {
      restoreValues(savedSnapshot);
      solutionShown = false;
      el.revealAll.textContent = 'Visa lösning';
      markSolvedClues();
      setStatus('Lösningen dold.');
    }
  }

  function snapshotValues() {
    var snap = [];
    for (var r = 0; r < data.rows; r++) {
      var row = [];
      for (var c = 0; c < data.cols; c++) { var inp = inputs[r][c]; row.push(inp ? inp.value : null); }
      snap.push(row);
    }
    return snap;
  }
  function restoreValues(snap) {
    if (!snap) return;
    for (var r = 0; r < data.rows; r++) for (var c = 0; c < data.cols; c++) {
      var inp = inputs[r][c];
      if (inp) { inp.value = (snap[r] && snap[r][c]) || ''; inp.parentElement.classList.remove('wrong', 'correct'); }
    }
  }

  // Ångra: rensa det SENAST ifyllda ordet, sedan det näst senaste osv.
  // Korsningsrutor lämnas kvar (de tillhör även ett annat ord).
  function onClear() {
    if (!data) return;
    if (solutionShown) { onRevealAll(); return; }   // dölj lösningen först om den visas
    while (editOrder.length) {
      var e = editOrder[editOrder.length - 1];
      var cells = cellsOfEntry(e);
      var cleared = false;
      for (var i = 0; i < cells.length; i++) {
        var p = cells[i];
        var inp = inputs[p.r][p.c];
        if (!inp || !inp.value) continue;
        // Korsningsruta: behåll bokstaven bara om det korsande ordet har fler
        // ifyllda rutor (annars rensas den så att ordet försvinner helt).
        if (acrossOf[p.r][p.c] && downOf[p.r][p.c]) {
          var other = (e.dir === 'H') ? downOf[p.r][p.c] : acrossOf[p.r][p.c];
          var otherHasMore = cellsOfEntry(other).some(function (q) {
            return !(q.r === p.r && q.c === p.c) && inputs[q.r][q.c] && inputs[q.r][q.c].value;
          });
          if (otherHasMore) continue;
        }
        inp.value = '';
        inp.parentElement.classList.remove('wrong', 'correct');
        cleared = true;
      }
      editOrder.pop();
      if (cleared) {
        markSolvedClues();
        setStatus('Ångrade ' + (e.number || '') + ' ' + (e.dir === 'H' ? 'vågrätt' : 'lodrätt') + '.');
        return;
      }
    }
    setStatus('Inget mer att ångra.');
  }
})();
