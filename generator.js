/* generator.js — bygger ett TÄTT korsord av en lista {answer, clue, img?}.
 *
 * Strategi: girig placering med många slumpade omstarter. För varje nytt ord
 * provas ALLA placeringar som korsar ett redan placerat ord i en matchande
 * bokstav; placeringen som ger flest korsningar och mest kompakt rutnät vinner.
 * Slutpoängen belönar (1) antal placerade ord, (2) antal korsningar och
 * (3) täthet — så resultatet blir tätt och sammanhängande, inte spretigt.
 *
 * Stöd för bildledtrådar: efter att layouten valts kan 2-3 ord märkas som
 * "bildord". Bildrutan placeras i den (garanterat tomma) rutan precis före
 * ordets första bokstav, med en pil i ordets riktning.
 */
(function (global) {
  'use strict';

  function key(r, c) { return r + ',' + c; }
  function isLetter(cell) { return !!(cell && cell.letter); }

  // Prova att lägga `word` med start i (row,col) i riktning dir ('H'|'V').
  // dirGrid spårar vilka riktningar (H/V) som redan upptar varje ruta, så att
  // två ord i SAMMA riktning aldrig kan dela en ruta (korsningar är bara vinkelräta).
  function tryPlacement(grid, dirGrid, word, row, col, dir) {
    var n = word.length;
    var dr = dir === 'V' ? 1 : 0;
    var dc = dir === 'H' ? 1 : 0;

    if (grid.has(key(row - dr, col - dc))) return null;         // ruta före start
    if (grid.has(key(row + dr * n, col + dc * n))) return null; // ruta efter slut

    var intersections = 0;
    for (var i = 0; i < n; i++) {
      var r = row + dr * i, c = col + dc * i;
      var k = key(r, c);
      var cur = grid.get(k);
      var ch = word.charAt(i);
      if (cur !== undefined) {
        if (cur !== ch) return null;                                // krock: olika bokstäver
        if ((dirGrid.get(k) || '').indexOf(dir) >= 0) return null;  // redan ett ord i samma riktning här
        intersections++;                                            // giltig vinkelrät korsning
      } else {
        if (dir === 'H') {
          if (grid.has(key(r - 1, c)) || grid.has(key(r + 1, c))) return null;
        } else {
          if (grid.has(key(r, c - 1)) || grid.has(key(r, c + 1))) return null;
        }
      }
    }
    return { row: row, col: col, dir: dir, intersections: intersections };
  }

  function commit(grid, dirGrid, placed, item, p) {
    var word = item.answer;
    var dr = p.dir === 'V' ? 1 : 0, dc = p.dir === 'H' ? 1 : 0;
    for (var i = 0; i < word.length; i++) {
      var k = key(p.row + dr * i, p.col + dc * i);
      grid.set(k, word.charAt(i));
      dirGrid.set(k, (dirGrid.get(k) || '') + p.dir);
    }
    placed.push({
      answer: word, clue: item.clue, img: item.img || '',
      row: p.row, col: p.col, dir: p.dir, len: word.length, picture: false
    });
  }

  function bounds(placed, extra) {
    var minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
    for (var i = 0; i < placed.length; i++) {
      var w = placed[i];
      var dr = w.dir === 'V' ? 1 : 0, dc = w.dir === 'H' ? 1 : 0;
      if (w.row < minR) minR = w.row;
      if (w.col < minC) minC = w.col;
      var er = w.row + dr * (w.len - 1), ec = w.col + dc * (w.len - 1);
      if (er > maxR) maxR = er;
      if (ec > maxC) maxC = ec;
    }
    if (extra) {
      for (var j = 0; j < extra.length; j++) {
        var p = extra[j];
        if (p.r < minR) minR = p.r; if (p.r > maxR) maxR = p.r;
        if (p.c < minC) minC = p.c; if (p.c > maxC) maxC = p.c;
      }
    }
    return { minR: minR, minC: minC, maxR: maxR, maxC: maxC,
             h: maxR - minR + 1, w: maxC - minC + 1 };
  }

  function attempt(items, firstDir, rng, explore) {
    var grid = new Map();
    var dirGrid = new Map();
    var placed = [];
    commit(grid, dirGrid, placed, items[0], { row: 0, col: 0, dir: firstDir || 'H', intersections: 0 });

    var unplaced = [];
    for (var idx = 1; idx < items.length; idx++) {
      placeOne(grid, dirGrid, placed, items[idx], unplaced, rng, explore);
    }
    // andra svepet — nu finns fler ankarpunkter; greedy (ej utforskande)
    for (var k = unplaced.length - 1; k >= 0; k--) {
      if (placeOne(grid, dirGrid, placed, unplaced[k], null, null, false)) unplaced.splice(k, 1);
    }
    return { grid: grid, placed: placed, unplaced: unplaced };
  }

  // Samla alla giltiga placeringar, poängsätt (korsningar + kompakthet) och
  // välj bästa — eller, i utforskningsläge, slumpa bland topp-kandidaterna.
  function placeOne(grid, dirGrid, placed, item, unplacedSink, rng, explore) {
    var word = item.answer;
    var ob = bounds(placed);
    var oldArea = ob.h * ob.w;
    var W = global.CW_W || {};
    var cands = [];
    for (var w = 0; w < placed.length; w++) {
      var pw = placed[w];
      var dr = pw.dir === 'V' ? 1 : 0, dc = pw.dir === 'H' ? 1 : 0;
      for (var i = 0; i < pw.len; i++) {
        var cr = pw.row + dr * i, cc = pw.col + dc * i;
        var cellLetter = pw.answer.charAt(i);
        for (var j = 0; j < word.length; j++) {
          if (word.charAt(j) !== cellLetter) continue;
          var ndir = pw.dir === 'H' ? 'V' : 'H';
          var ndr = ndir === 'V' ? 1 : 0, ndc = ndir === 'H' ? 1 : 0;
          var sr = cr - ndr * j, sc = cc - ndc * j;
          var p = tryPlacement(grid, dirGrid, word, sr, sc, ndir);
          if (!p) continue;
          var b = bounds(placed.concat([{ row: sr, col: sc, dir: ndir, len: word.length }]));
          var growth = b.h * b.w - oldArea;
          var maxSide = b.h > b.w ? b.h : b.w;
          var score = p.intersections * (W.pc || 3200) - growth * (W.pg || 11) - maxSide * (W.pm || 5);
          cands.push({ row: sr, col: sc, dir: ndir, intersections: p.intersections, score: score });
        }
      }
    }
    if (!cands.length) { if (unplacedSink) unplacedSink.push(item); return false; }
    cands.sort(function (a, b2) { return b2.score - a.score; });
    var pick;
    if (explore && rng && cands.length > 1) {
      var topK = Math.min(cands.length, W.topk || 4);
      pick = cands[Math.floor(rng() * topK)];
    } else {
      pick = cands[0];
    }
    commit(grid, dirGrid, placed, item, pick);
    return true;
  }

  function wordCells(w) {
    var dr = w.dir === 'V' ? 1 : 0, dc = w.dir === 'H' ? 1 : 0, a = [];
    for (var i = 0; i < w.len; i++) a.push(key(w.row + dr * i, w.col + dc * i));
    return a;
  }
  function buildCount(placed) {
    var m = {};
    placed.forEach(function (w) { wordCells(w).forEach(function (k) { m[k] = (m[k] || 0) + 1; }); });
    return m;
  }
  function crossOf(w, count) {
    return wordCells(w).reduce(function (n, k) { return n + (count[k] >= 2 ? 1 : 0); }, 0);
  }

  // Ta bort utstickande "pendel-ord" (<=1 korsning) vars borttagning krymper
  // rutnätet märkbart -> tätare, mindre spretig form. Behåller minst minWords.
  function trimOutliers(res, minWords) {
    var guard = 0;
    while (res.placed.length > minWords && guard++ < 300) {
      var count = buildCount(res.placed);
      var b0 = bounds(res.placed);
      var area0 = b0.h * b0.w;
      var bestIdx = -1, bestGain = 0;
      for (var i = 1; i < res.placed.length; i++) {        // behåll seed-ordet (i=0)
        var wi = res.placed[i];
        if (crossOf(wi, count) > 1) continue;               // bara pendlar (<=1 korsning)
        var rest = res.placed.slice(0, i).concat(res.placed.slice(i + 1));
        var b1 = bounds(rest);
        var gain = area0 - b1.h * b1.w;                     // frigjord bounding-box-yta
        // trimma bara om ordet sticker ut i tomrum (mycket yta för få rutor)
        if (gain > bestGain && gain >= wi.len * 2) { bestGain = gain; bestIdx = i; }
      }
      if (bestIdx < 0) break;
      var w = res.placed[bestIdx];
      wordCells(w).forEach(function (k) { if (count[k] === 1) res.grid.delete(k); });
      res.placed.splice(bestIdx, 1);
    }
  }

  function shuffle(a, rnd) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Slutpoäng: ord väger tyngst, sen korsningar, sen täthet.
  function scoreLayout(res) {
    var used = res.grid.size;
    var total = 0;
    for (var i = 0; i < res.placed.length; i++) total += res.placed[i].len;
    var crossings = total - used;           // varje korsning delar en ruta
    var b = bounds(res.placed);
    var area = (b.h * b.w) || 1;
    var density = used / area;               // andel fyllda rutor i bounding box
    var maxSide = b.h > b.w ? b.h : b.w;
    var minSide = b.h < b.w ? b.h : b.w;
    var aspect = maxSide / (minSide || 1);   // 1 = kvadrat, högre = avlångt
    var W = global.CW_W || {};
    return res.placed.length * (W.lw || 3200) + crossings * (W.lc || 700) +
           density * (W.ld || 1700) - maxSide * (W.lm || 8) - aspect * (W.la || 3000);
  }

  // Märk upp till n ord som bildord och bestäm var bildrutan ska ligga.
  function attachPictures(res, n) {
    res.pictures = [];
    if (!n) return;
    // ENDAST ord med ett konkret bildmotiv (img) blir bildord -> relevanta bilder.
    var cand = res.placed.filter(function (e) { return e.len >= 3 && e.img; });
    cand.sort(function (a, b) { return a.len - b.len; });   // kortare/mer ikoniska först
    var usedKeys = {};
    for (var i = 0; i < cand.length && res.pictures.length < n; i++) {
      var e = cand[i];
      var dr = e.dir === 'V' ? 1 : 0, dc = e.dir === 'H' ? 1 : 0;
      var kr = e.row - dr, kc = e.col - dc;          // ruta före första bokstaven
      var kk = key(kr, kc);
      if (usedKeys[kk] || res.grid.has(kk)) continue;
      // isolera bildrutan: alla grannar utom ordets start ska vara tomma
      var startKey = key(e.row, e.col);
      var neigh = [[kr - 1, kc], [kr + 1, kc], [kr, kc - 1], [kr, kc + 1]];
      var ok = true;
      for (var g = 0; g < neigh.length; g++) {
        var nk = key(neigh[g][0], neigh[g][1]);
        if (nk === startKey) continue;
        if (res.grid.has(nk)) { ok = false; break; }
      }
      if (!ok) continue;
      usedKeys[kk] = 1;
      e.picture = true;
      res.pictures.push({ r: kr, c: kc, dir: e.dir, entry: e });
    }
  }

  function generate(words, opts) {
    opts = opts || {};
    var attempts = opts.attempts || 300;
    var nPictures = opts.pictures || 0;

    var items = (words || []).filter(function (w) {
      return w && w.answer && w.answer.length >= 2;
    });
    var seen = {};
    items = items.filter(function (w) {
      if (seen[w.answer]) return false; seen[w.answer] = 1; return true;
    });
    items.sort(function (a, b) { return b.answer.length - a.answer.length; });
    if (items.length === 0) return null;

    var best = null;
    var greedyCut = Math.floor(attempts * 0.15);   // första 15% ren greedy, resten utforskar
    for (var t = 0; t < attempts; t++) {
      var rnd = mulberry32((0x9e3779b9 ^ Math.imul(t + 1, 2654435761)) >>> 0);
      var arr = items.slice();
      if (t > 0) {
        if (t % 4 === 0) {
          arr = shuffle(arr, rnd);
        } else {
          var head = arr.slice(0, 2);
          arr = head.concat(shuffle(arr.slice(2), rnd));
        }
      }
      var explore = t >= greedyCut;
      var res = attempt(arr, t % 2 === 0 ? 'H' : 'V', rnd, explore);
      var sc = scoreLayout(res);
      if (!best || sc > best.score) best = { res: res, score: sc };
    }

    if (opts.trim !== false) {
      var Wt = global.CW_W || {};
      var keepFrac = Wt.trimKeep || 0.72;
      trimOutliers(best.res, Math.max(7, Math.ceil(best.res.placed.length * keepFrac)));
    }
    attachPictures(best.res, nPictures);
    return finalize(best.res);
  }

  function finalize(res) {
    var b = bounds(res.placed, res.pictures);
    var rows = b.h, cols = b.w;

    var cells = [];
    for (var r = 0; r < rows; r++) cells.push(new Array(cols).fill(null));

    res.grid.forEach(function (v, k) {
      var parts = k.split(',');
      var rr = parseInt(parts[0], 10) - b.minR;
      var cc = parseInt(parts[1], 10) - b.minC;
      cells[rr][cc] = { letter: v, number: null };
    });

    var entries = res.placed.map(function (w) {
      return {
        answer: w.answer, clue: w.clue, img: w.img,
        row: w.row - b.minR, col: w.col - b.minC,
        dir: w.dir, len: w.len, number: null, picture: !!w.picture
      };
    });

    // Bildrutor
    var pictures = [];
    (res.pictures || []).forEach(function (p) {
      var rr = p.r - b.minR, cc = p.c - b.minC;
      var e = p.entry;
      cells[rr][cc] = { image: true, dir: e.dir, answer: e.answer, clue: e.clue, img: e.img || '' };
      pictures.push({
        r: rr, c: cc, dir: e.dir,
        startR: e.row - b.minR, startC: e.col - b.minC,
        answer: e.answer, clue: e.clue, img: e.img || '', len: e.len
      });
    });

    // Numrering (endast bokstavsrutor räknas som grannar)
    var num = 0;
    var startMap = {};
    for (var rr2 = 0; rr2 < rows; rr2++) {
      for (var cc2 = 0; cc2 < cols; cc2++) {
        var cell = cells[rr2][cc2];
        if (!isLetter(cell)) continue;
        var leftEmpty = cc2 === 0 || !isLetter(cells[rr2][cc2 - 1]);
        var rightFilled = cc2 + 1 < cols && isLetter(cells[rr2][cc2 + 1]);
        var upEmpty = rr2 === 0 || !isLetter(cells[rr2 - 1][cc2]);
        var downFilled = rr2 + 1 < rows && isLetter(cells[rr2 + 1][cc2]);
        if ((leftEmpty && rightFilled) || (upEmpty && downFilled)) {
          num++; cell.number = num; startMap[rr2 + ',' + cc2] = num;
        }
      }
    }

    // Numret visas på ALLA ords första ruta — även bildord (bilden bredvid är
    // dess ledtråd; pilen pekar in i ordet).
    entries.forEach(function (e) { e.number = startMap[e.row + ',' + e.col] || null; });

    entries.sort(function (a, b2) {
      if (a.number !== b2.number) return (a.number || 0) - (b2.number || 0);
      return a.dir === 'H' ? -1 : 1;
    });

    return { rows: rows, cols: cols, cells: cells, entries: entries,
             pictures: pictures, unplaced: res.unplaced };
  }

  global.CrosswordGen = { generate: generate, _tryPlacement: tryPlacement };
})(window);
