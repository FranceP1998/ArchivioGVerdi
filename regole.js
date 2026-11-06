// Regole della banda: da organico e parti disponibili a "chi stampa quale parte".
// Usato da stampa.html e cartellina.html. Per cambiare una regola si modifica solo questo file.
(function () {
  const low = s => String(s).toLowerCase().trim();

  const COMUNE = '1 corno 1\n1 corno 2\n1 corno 3\n1 corno 4\n2 tromba 1\n1 tromba 2\n2 tromba 3\n1 trombone 1\n1 trombone 2\n1 trombone 3\n1 eufonio\n4 tuba';
  const ORG0 = {
    concerto: '1 oboe\n2 flauto 1\n2 flauto 2\n3 clarinetto 1\n4 clarinetto 2\n4 clarinetto 3\n2 sax contralto 1\n2 sax contralto 2\n3 sax tenore\n1 sax baritono\n' + COMUNE,
    marce: '2 flauto 1\n2 flauto 2\n5 clarinetto 1\n3 clarinetto 2\n3 clarinetto 3\n2 sax contralto 1\n2 sax contralto 2\n4 sax tenore\n1 sax baritono\n' + COMUNE
  };
  // Tonalità ammesse, in ordine di preferenza (null = parte senza tonalità scritta)
  const TONL = {
    corno: ['f', 'eb', 'bb'],
    trombone: ['c bc', 'bb bc', 'eb bc'],
    tuba: ['c bc', 'bb bc', 'eb bc'],
    eufonio: ['c bc', 'bb tc']
  };

  // ---- Sinonimi: "Flute" -> "flauto", "Sib" -> "bb", ... (parole intere, vince la frase più lunga) ----
  const SYN0 = [
    ['flute', 'flauto'], ['piccolo', 'ottavino'], ['clarinet', 'clarinetto'], ['cl', 'clarinetto'],
    ['bass clarinet', 'clarinetto basso'], ['bass cl', 'clarinetto basso'],
    ['sax alto', 'sax contralto'], ['alto sax', 'sax contralto'], ['tenor sax', 'sax tenore'], ['ten sax', 'sax tenore'],
    ['sax bar', 'sax baritono'], ['sax baritone', 'sax baritono'], ['bar sax', 'sax baritono'],
    ['euphonium', 'eufonio'], ['trumpet', 'tromba'], ['horn', 'corno'], ['basses', 'tuba'], ['bass', 'tuba'],
    ['bass trombone', 'trombone basso'], ['baritone sax', 'sax baritono'], ['french horn', 'corno'], ['english horn', 'corno inglese'], ['bassoon', 'fagotto'],
    ['fa', 'f'], ['mib', 'eb'], ['sib', 'bb']
  ];
  let SYN = SYN0;
  const setSynonyms = l => { SYN = Array.isArray(l) && l.length ? l : SYN0; };
  function applySyn(text) {
    const tok = norm(text).split(' ').filter(Boolean), out = [];
    const rules = SYN.filter(r => r && r[0] && r[1] != null).map(([a, b]) => [norm(a).split(' '), norm(b).split(' ').filter(Boolean)])
      .filter(([a]) => a[0]).sort((x, y) => y[0].length - x[0].length);
    for (let i = 0; i < tok.length;) {
      const r = rules.find(([a]) => a.every((w, j) => tok[i + j] === w));
      if (r) { out.push(...r[1]); i += r[0].length; } else out.push(tok[i++]);
    }
    return out.join(' ');
  }

  // ---- Percussioni: la posizione di una parte dipende dal gruppo, deciso da parole chiave ----
  const norm = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const KW0 = {
    'timpani': ['timpani', 'timpano'],
    'mallet': ['mallet', 'glockenspiel', 'vibrafono', 'marimba', 'xilofono', 'campane', 'campane tubolari', 'celesta'],
    'batteria': ['batteria'],
    'rullante': ['rullante'],
    'cassa e piatti': ['cassa', 'grancassa', 'piatti']
  };
  let KW = KW0;
  const setKeywords = o => { KW = o && typeof o === 'object' ? o : KW0; };
  // I gruppi sono le voci "Percussioni - Gruppo" dell'ordine classico, nell'ordine in cui sono scritte (vince la prima)
  function percKey(name, L) {
    const exact = L.indexOf(name); if (exact >= 0) return exact;
    const gen = L.indexOf('Percussioni'), fb = gen >= 0 ? gen : 9999;
    const rest = norm(String(name).replace(/^percussioni\s*[-–:]?\s*/i, ''));
    if (!rest) return fb;
    if (/^\d+$/.test(rest)) { const i = L.findIndex(x => norm(x) === 'percussioni ' + rest); return i >= 0 ? i : fb; }
    for (let i = 0; i < L.length; i++) {
      const m = L[i].match(/^percussioni\s*-\s*(.+)$/i); if (!m) continue;
      const g = norm(m[1]), words = [g, ...(KW[g] || (KW0[g] || [])).map(norm)];
      if (words.some(w => w && (' ' + rest + ' ').includes(' ' + w + ' '))) return i;
    }
    return fb;
  }
  // Posizione di una parte nell'ordine classico (9999 = fuori elenco)
  function ordKey(n, L) {
    let i = L.indexOf(n); if (i >= 0) return i;
    if (/^percussioni/i.test(n)) return percKey(n, L);
    if (/ solo$/i.test(n)) { const b = n.slice(0, -5); i = L.indexOf(b + ' 1'); if (i < 0) i = L.indexOf(b); if (i >= 0) return i - .5; }
    return 9999;
  }

  // "Corno 3 e 4 in F" -> {base: 'corno', roles: ['3','4'], ton: 'f'}; "Trombone 3 e Trombone Basso in C BC" -> roles ['3','basso']
  function parsePart(name) {
    let n = low(name), solo = false, ton = null, m;
    if (n.startsWith('percussioni')) return {base: 'percussioni', roles: [], ton, solo};
    if (/\s+solo$/.test(n)) { solo = true; n = n.replace(/\s+solo$/, ''); }
    if ((m = n.match(/\s+in\s+((?:c|bb|eb|f)(?:\s+(?:bc|tc))?)$/))) { ton = m[1]; n = n.slice(0, m.index); }
    if ((m = n.match(/^ottavino e flauto(?:\s+(\d+))?$/))) return {base: 'flauto', roles: m[1] ? [m[1]] : [], ton: null, solo, ott: true}; // vale anche per l'ottavino
    if (n === 'clarinetto' && ton === 'eb') return {base: 'clarinetto in eb', roles: [], ton: null, solo};
    if (n === 'clarinetto basso') return {base: n, roles: [], ton, solo};
    m = n.match(/^(.*?)\s+(\d+|basso)(?:\s+e\s+(?:\1\s+)?(\d+|basso))?$/);
    return m ? {base: m[1], roles: [m[2], m[3]].filter(Boolean), ton, solo} : {base: n, roles: [], ton, solo};
  }
  const parseOrg = t => String(t).split('\n').map(l => l.trim().match(/^(\d+)\s+(.+)$/)).filter(Boolean).map(m => ({n: +m[1], role: m[2].trim()}));
  const build = parts => parts.map(p => ({p, ...parsePart(p.name)})).filter(x => !x.solo);

  // Copie di un ruolo dell'organico: restituisce [{part: nome in minuscolo, n}]
  function alloc(PP, role, n, pref) {
    let q = parsePart(role);
    if (q.base === 'ottavino' && !PP.some(x => x.base === 'ottavino')) {
      const c = PP.find(x => x.ott); // parte "Ottavino e Flauto" (o "Ottavino e Flauto 1"): va anche all'ottavino
      if (c) return [{part: low(c.p.name), n}];
      q = {base: 'flauto', roles: ['1']};
    }
    let b = q.base;
    if (b === 'tromba' && !PP.some(x => x.base === 'tromba') && PP.some(x => x.base === 'cornetta')) b = 'cornetta';
    const T = TONL[b] ? ([...TONL[b], null].find(t => PP.some(x => x.base === b && x.ton === t)) ?? 'none') : undefined;
    const L = PP.filter(x => x.base === b && (T === undefined || x.ton === T));
    if (!L.length) return [];
    const nm = x => low(x.p.name), one = x => (x ? [{part: nm(x), n}] : []);
    const sp = (a, c) => [{part: nm(a), n: Math.ceil(n / 2)}, {part: nm(c), n: Math.floor(n / 2)}];
    const single = r => L.find(x => x.roles.length === 1 && x.roles[0] === r);
    const R = r => single(r) || L.find(x => x.roles.length > 1 && x.roles.includes(r)); // parte singola, o combinata che nomina quel ruolo
    const U = L.find(x => !x.roles.length);                                              // parte unica, senza numero
    const first = (...c) => c.find(Boolean);

    // Strumento non diviso in organico: una parte unica o combinata va a tutti
    if (!q.roles.length) {
      const pr = pref ? String(pref) : null; // parte scelta a mano (cartellina), se le parti sono separate
      if ((b === 'sax tenore' || b === 'tuba') && !U && single('1') && single('2')) return pr && single(pr) ? one(single(pr)) : sp(single('1'), single('2'));
      return one(first(U, L.find(x => x.roles.length > 1 && x.roles.includes(pr || '1')), pr && single(pr), single('1'), L[0]));
    }
    const k = +q.roles[0];
    if (isNaN(k)) return one(first(R(q.roles[0]), U, L[0]));
    if ((b === 'tromba' || b === 'cornetta') && k === 3 && single('3') && single('4')) return sp(single('3'), single('4'));
    const rules = {
      corno: [[R('1'), U], [R('2'), U, R('1')], [R('3'), R('1'), U], [R('4'), R('3'), R('2'), U, R('1')]],
      trombone: [[R('1'), U], [R('2'), U, R('1')], [R('3'), R('basso'), R('2'), U, R('1')]]
    };
    const generic = [[R('1'), U], [R('2'), U, R('1')], [R('3'), R('2'), U, R('1')], [R('4'), R('3'), R('2'), U, R('1')]];
    return one(first(...((rules[b] || generic)[k - 1] || [U])));
  }

  // Copie da stampare per tutta la banda
  function calc(parts, orgText) {
    const org = parseOrg(orgText), PP = build(parts), cnt = {}, extra = {};
    const res = org.map(o => ({...o, al: alloc(PP, o.role, o.n)}));
    parts.filter(p => / solo$/i.test(p.name)).forEach(p => {
      const b = low(p.name).slice(0, -5), o = res.find(x => low(x.role) === b + ' 1') || res.find(x => low(x.role) === b);
      if (o) { if (o.al[0] && o.n > 1) o.al[0].n -= 1; extra[low(p.name)] = 1; }
    });
    res.forEach(o => o.al.forEach(a => { cnt[a.part] = (cnt[a.part] || 0) + a.n; }));
    Object.assign(cnt, extra);
    parts.filter(p => /^percussioni/i.test(p.name)).forEach(p => { cnt[low(p.name)] = 1; });
    return {
      rows: parts.filter(p => cnt[low(p.name)] > 0).map(p => ({p, n: cnt[low(p.name)]})),
      warn: res.filter(o => !o.al.length).map(o => `Nessuna parte trovata per «${o.role}» (${o.n} musici).`),
      skip: parts.filter(p => !(cnt[low(p.name)] > 0)).map(p => p.name)
    };
  }
  // La parte che suona un singolo musicista di quel ruolo (per la cartellina)
  function partFor(parts, role, pref) {
    const a = alloc(build(parts), role, 1, pref).find(x => x.n > 0);
    return a ? parts.find(p => low(p.name) === a.part) : null;
  }

  (typeof window !== 'undefined' ? window : globalThis).Regole = {ORG0, KW0, SYN0, applySyn, setSynonyms, getSynonyms: () => SYN, parseOrg, parsePart, calc, partFor, percKey, ordKey, setKeywords, getKeywords: () => KW, norm};
})();
