/* Arkham Horror 3ª ed. — gestor de mazos (encuentros, eventos, titulares, anomalías, terror, archivo). */
(() => {
  'use strict';

  const CARDS = {};
  for (const c of window.AH_CARDS) CARDS[c.id] = c;
  const SCEN = window.AH_SCENARIOS;
  const LS_LANG = 'ahm.lang';
  const LS_CUR = 'ahm.current', LS_SAVES = 'ahm.saves', LS_HIST = 'ahm.hist';
  const HIST_MAX = 150;

  const ICON = {
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M9 4v16"/></svg>',
    clue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/></svg>',
    doom: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-3 3-7 4-7 10a7 7 0 0 0 14 0c0-6-4-7-7-10Zm0 17a3 3 0 0 1-3-3c0-2 1.5-3 3-5 1.5 2 3 3 3 5a3 3 0 0 1-3 3Z"/></svg>',
    gate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>',
    head: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h13v14H6a2 2 0 0 1-2-2Z"/><path d="M17 8h3v9a2 2 0 0 1-2 2"/><path d="M7 9h7M7 13h7"/></svg>',
    terror: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3c4 0 7 3 7 7 0 3-2 4-2 6v3H7v-3c0-2-2-3-2-6 0-4 3-7 7-7Z"/><circle cx="9.5" cy="11" r="1.3" fill="currentColor"/><circle cx="14.5" cy="11" r="1.3" fill="currentColor"/></svg>',
    anom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 12c0-3 3-5 5-3s0 6-5 6-7-4-5-8 8-4 10 0"/></svg>',
  };

  // ---------- utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const face = (id) => `img/c/${id}.webp`;
  const back = (id) => { const b = CARDS[id]?.b; return b == null ? '' : (typeof b === 'number' ? `img/b/${b}.webp` : `img/c/${b}.webp`); };
  const timeStr = (t) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  const KIND_LABEL = { nb: 'Encuentro', ev: 'Evento', an: 'Anomalía', hl: 'Titular', te: 'Terror', ar: 'Archivo' };
  const cardLabel = (id) => {
    const c = CARDS[id]; if (!c) return '¿?';
    if (c.k === 'ar') return `Archivo ${c.n}`;
    if (c.k === 'ev') return `Evento (${c.nb || '¿barrio?'})`;
    if (c.k === 'nb') return `Encuentro (${c.d})`;
    if (c.k === 'an') return `Anomalía (${c.set})`;
    if (c.k === 'te') return `Terror (${c.set})`;
    return KIND_LABEL[c.k] || 'Carta';
  };

  // ---------- estado ----------
  let S = null;          // estado de la partida
  let H = [];            // historial para deshacer (snapshots JSON)
  let ui = { tab: 'city', screen: 'home' };

  const deck = (id) => S.decks[id];
  // Calles, Rutas de viaje y Umbrales (sin Pistas) siempre al final.
  const LAST = ['E:Calles', 'E:Ruta de Viaje', 'E:Umbrales'];
  const encIds = () => {
    const ids = S.order.filter((id) => id.startsWith('E:'));
    return [...ids.filter((id) => !LAST.includes(id)), ...LAST.filter((id) => ids.includes(id))];
  };

  function log(msg) { S.log.unshift({ t: Date.now(), m: msg }); if (S.log.length > 600) S.log.length = 600; }
  function snap() { H.push(JSON.stringify(S)); if (H.length > HIST_MAX) H.shift(); }
  function persist() {
    if (!S) return;
    lsSet(LS_CUR, S);
    lsSet(LS_HIST, H.slice(-40));
  }
  function act(fn) { snap(); fn(); persist(); render(); }
  function undo(msg) {
    if (!H.length) return;
    const last = S.log[0]?.m;
    S = JSON.parse(H.pop());
    persist(); closeModal(); render();
    toast(msg || `Deshecho: ${last || 'acción'}`);
  }

  function mkDeck(id, name, kind, cards = []) { return { id, name, kind, cards, disc: [], att: [], link: [], anom: false }; }

  // Mazo de Encuentros de un barrio / calle / misterio / ruta / umbral
  function encounterCards(name) { return window.AH_CARDS.filter((c) => c.k === 'nb' && c.d === name).map((c) => c.id); }
  function eventsFor(scId) { return window.AH_CARDS.filter((c) => c.k === 'ev' && c.s === scId); }

  function newGame(sc) {
    S = {
      v: 1, scen: sc.id, created: Date.now(), name: sc.name,
      decks: {}, order: [], codex: [], flip: {}, pending: [], log: [], n: 3,
      aside: [...(sc.aside || [])],
    };
    H = [];
    const names = ['Calles', ...sc.nbs];
    for (const n of names) addEncounterDeck(n, false);
    const evs = eventsFor(sc.id);
    const asideNbs = new Set(sc.aside || []);
    S.decks.EV = mkDeck('EV', 'Mazo de Eventos', 'ev', shuffle(evs.filter((c) => !(c.x || asideNbs.has(c.nb))).map((c) => c.id)));
    S.asideEv = evs.filter((c) => c.x || asideNbs.has(c.nb)).map((c) => c.id);
    const hl = shuffle(window.AH_CARDS.filter((c) => c.k === 'hl').map((c) => c.id)).slice(0, 13);
    S.decks.HL = mkDeck('HL', 'Titulares', 'hl', hl);
    if (sc.anomaly) S.decks.AN = mkDeck('AN', `Anomalías · ${sc.anomaly}`, 'an', shuffle(window.AH_CARDS.filter((c) => c.k === 'an' && c.set === sc.anomaly).map((c) => c.id)));
    if (sc.terror) S.decks.TE = mkDeck('TE', `Terror · ${sc.terror}`, 'te', shuffle(window.AH_CARDS.filter((c) => c.k === 'te' && c.set === sc.terror).map((c) => c.id)));
    const arch = window.AH_CARDS.filter((c) => c.k === 'ar').sort((a, b) => a.n - b.n).map((c) => c.id);
    S.decks.AR = mkDeck('AR', 'Archivo', 'ar', arch);
    if (sc.invest) {
      const inv = sc.invest.map(archId).filter((x) => x != null);
      S.decks.AR.cards = S.decks.AR.cards.filter((x) => !inv.includes(x));
      S.decks.INV = mkDeck('INV', 'Mazo de Investigación', 'inv', shuffle(inv));
    }
    for (const n of sc.codex || []) { const id = archId(n); if (id != null) { removeEverywhere(id); S.codex.push(id); } }
    log(`Nueva partida: ${sc.name}. Titulares: 13 al azar de ${window.AH_CARDS.filter((c) => c.k === 'hl').length}.`);
    // Preparativos finales: 3 Pistas y la Perdición se propaga una vez.
    const clues = [];
    for (let i = 0; i < 3; i++) clues.push(spawnClue(true));
    const doom = spreadDoom(true);
    H = [];
    persist();
    ui.screen = 'game'; ui.tab = 'city';
    render();
    showSetupSummary(sc, clues, doom);
  }

  function addEncounterDeck(name, withLog = true) {
    const id = 'E:' + name;
    if (S.decks[id]) return;
    S.decks[id] = mkDeck(id, name, 'nb', shuffle(encounterCards(name)));
    S.order.push(id);
    if (withLog) log(`Entra en juego el mazo de ${name}.`);
  }

  function archId(n) { const c = window.AH_CARDS.find((x) => x.k === 'ar' && x.n === n); return c ? c.id : null; }

  // Saca una carta de donde esté (mazo, descarte, vinculadas, códice, pendientes).
  function removeEverywhere(id) {
    for (const d of Object.values(S.decks)) {
      for (const key of ['cards', 'disc', 'att', 'link']) { const i = (d[key] || []).indexOf(id); if (i >= 0) d[key].splice(i, 1); }
    }
    let i = S.codex.indexOf(id); if (i >= 0) S.codex.splice(i, 1);
    i = S.pending.findIndex((p) => p.id === id); if (i >= 0) S.pending.splice(i, 1);
    i = (S.asideEv || []).indexOf(id); if (i >= 0) S.asideEv.splice(i, 1);
    i = (S.asideArch || []).indexOf(id); if (i >= 0) S.asideArch.splice(i, 1);
  }
  function whereIs(id) {
    for (const d of Object.values(S.decks)) {
      if (d.cards.includes(id)) return { deck: d.id, zone: 'cards' };
      if (d.disc.includes(id)) return { deck: d.id, zone: 'disc' };
      if ((d.link || []).includes(id)) return { deck: d.id, zone: 'link' };
      if (d.att.includes(id)) return { deck: d.id, zone: 'att' };
    }
    if (S.codex.includes(id)) return { zone: 'codex' };
    if (S.pending.some((p) => p.id === id)) return { zone: 'pending' };
    return { zone: 'none' };
  }

  // pos: 'top' | 'bottom' | 'random' | número N (mezclar entre las N primeras, contándola)
  function place(id, deckId, pos) {
    removeEverywhere(id);
    const d = deck(deckId); if (!d) return;
    if (pos === 'top') d.cards.unshift(id);
    else if (pos === 'bottom') d.cards.push(id);
    else if (pos === 'random') d.cards.splice(Math.floor(Math.random() * (d.cards.length + 1)), 0, id);
    else if (pos === 'disc') d.disc.push(id);
    else { const n = Math.max(1, pos | 0); const top = d.cards.splice(0, n - 1); d.cards.unshift(...shuffle([id, ...top])); }
  }
  const posLabel = (pos) => pos === 'top' ? 'arriba' : pos === 'bottom' ? 'al fondo' : pos === 'random' ? 'en posición aleatoria' : pos === 'disc' ? 'al descarte' : `mezclada entre las ${pos} primeras`;

  function draw(deckId, where = 'top') {
    const d = deck(deckId); if (!d || !d.cards.length) { toast(`${d ? d.name : 'Mazo'} está vacío.`); return null; }
    let id;
    if (where === 'bottom') id = d.cards.pop();
    else if (where === 'random') id = d.cards.splice(Math.floor(Math.random() * d.cards.length), 1)[0];
    else id = d.cards.shift();
    S.pending.push({ id, from: deckId });
    log(`Se roba ${where === 'bottom' ? 'de abajo ' : where === 'random' ? 'al azar ' : ''}de ${d.name}: ${cardLabel(id)}.`);
    return id;
  }

  // ---------- Mitos ----------
  function refillEventsIfEmpty() {
    const ev = deck('EV');
    if (ev.cards.length) return true;
    ev.cards = shuffle(ev.disc.splice(0));
    log('Mazo de Eventos vacío: el efecto se anula, coloca 1 Perdición en la hoja de Escenario y se baraja el descarte como nuevo mazo.');
    alertModal('Mazo de Eventos vacío', 'El efecto se anula. Coloca <b>1 ficha de Perdición en la hoja de Escenario</b>. El descarte de Eventos se baraja y forma un nuevo mazo.');
    return false;
  }
  function spawnClue(silent = false) {
    if (!refillEventsIfEmpty()) return null;
    const ev = deck('EV');
    const id = ev.cards.shift();
    const c = CARDS[id];
    const target = c.nb && S.decks['E:' + c.nb] ? 'E:' + c.nb : null;
    if (target) {
      place(id, target, 3);
      log(`Aparece una Pista en ${c.nb} (el Evento se mezcla entre las 3 primeras cartas).`);
      if (!silent) toast(`Aparece una Pista en <b>${esc(c.nb)}</b>`, back(id));
      return { id, nb: c.nb };
    }
    S.pending.push({ id, from: 'EV', clue: true });
    log(`Aparece una Pista: el barrio ${c.nb ? `(${c.nb}) no está en juego` : 'no se pudo identificar'}; elige el mazo.`);
    if (!silent) openCard(id, { fresh: true });
    return { id, nb: c.nb, manual: true };
  }
  function spreadDoom(silent = false) {
    if (!refillEventsIfEmpty()) return null;
    const ev = deck('EV');
    const id = ev.cards.pop();
    ev.disc.push(id);
    log(`La Perdición se propaga: ${cardLabel(id)} (fondo del mazo de Eventos → descarte).`);
    if (!silent) openCard(id, { info: `La Perdición se propaga en <b>${esc(CARDS[id].nb || '¿?')}</b>: coloca 1 Perdición en cada espacio marcado con el icono de Perdición (toca la carta para ver el dorso). Esta carta queda en el descarte y marca el espacio inestable.`, readonly: true });
    return id;
  }
  function gateBurst() {
    if (!refillEventsIfEmpty()) return;
    const ev = deck('EV');
    const id = ev.cards.shift();
    const nb = CARDS[id].nb;
    ev.cards.push(...shuffle([id, ...ev.disc.splice(0)]));
    log(`Estallido de portal en ${nb || '¿?'}: la carta y el descarte se barajan y van al fondo del mazo de Eventos.`);
    openCard(id, { info: `Estallido de portal: coloca 1 Perdición en <b>cada espacio de ${esc(nb || 'ese Barrio')}</b> (en un Barrio ampliado con Misterio: en tres espacios distintos). La carta y el descarte ya se barajaron al fondo del mazo de Eventos; el espacio inestable vuelve a ser el de inicio.`, readonly: true });
  }
  function readHeadline() {
    const d = deck('HL');
    if (!d.cards.length) { log('No quedan Titulares: coloca 1 Perdición en la hoja de Escenario.'); alertModal('Sin Titulares', 'No quedan cartas de Titular: coloca <b>1 ficha de Perdición sobre la hoja de Escenario</b>.'); return; }
    const id = draw('HL'); openCard(id, { fresh: true });
  }
  function unstableNb() { const ev = deck('EV'); const id = ev.disc[ev.disc.length - 1]; return id ? CARDS[id].nb : null; }
  function spreadTerror(nbName) {
    const te = deck('TE');
    if (!te.cards.length) { log('No quedan cartas de Terror: coloca 1 Perdición en la hoja de Escenario.'); alertModal('Sin cartas de Terror', 'Coloca <b>1 ficha de Perdición sobre la hoja de Escenario</b>.'); return; }
    const id = te.cards.shift();
    deck('E:' + nbName).att.push(id);
    log(`Se propaga el Terror en ${nbName}: 1 ficha de Terror y se vincula una carta de Terror.`);
    toast(`Terror en <b>${esc(nbName)}</b>: coloca 1 ficha de Terror`);
  }

  // ---------- render principal ----------
  function render() {
    const app = $('#app');
    if (ui.screen === 'home' || !S) { app.innerHTML = homeHTML(); bindHome(); return; }
    const sc = SCEN.find((x) => x.id === S.scen);
    app.innerHTML = `
      <header class="top">
        <span class="sign sm"><img src="img/logo.svg" alt="Arkham Horror"></span>
        <div class="title"><b>${esc(sc.name)}</b><small>${esc(sc.box)} · ${S.log.length} acciones</small></div>
        <button class="iconbtn" data-a="sheet" title="Hoja de escenario">${ICON.sheet}</button>
        <button class="iconbtn" data-a="undo" title="Deshacer" ${H.length ? '' : 'disabled'}>${ICON.undo}</button>
        <button class="iconbtn" data-a="menu" title="Menú">${ICON.menu}</button>
      </header>
      <nav class="tabs">
        ${[['city', 'Ciudad'], ['codex', 'Códice'], ['log', 'Registro']].map(([k, l]) => `<button class="tab ${ui.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}
      </nav>
      <main class="main">
        <div class="cols">
          <section class="pane ${ui.tab === 'city' ? 'on' : ''}">${cityHTML()}</section>
          <section>
            <div class="pane ${ui.tab === 'codex' ? 'on' : ''}">${codexHTML()}</div>
            <div class="pane ${ui.tab === 'log' ? 'on' : ''}">${logHTML()}</div>
          </section>
        </div>
      </main>
      ${S.pending.length ? `<div class="mythos" style="bottom:calc(66px + env(safe-area-inset-bottom,0px));background:rgba(58,42,26,.96);justify-content:flex-start">
        <span class="muted" style="align-self:center;padding:0 6px;white-space:nowrap">En mano:</span>
        ${S.pending.map((p) => `<button class="chip" data-open="${p.id}">${esc(cardLabel(p.id))}</button>`).join('')}
      </div>` : ''}
      <nav class="mythos">
        <button class="myth clue" data-m="clue">${ICON.clue}Aparición<br>de Pista</button>
        <button class="myth doom" data-m="doom">${ICON.doom}Propagar<br>Perdición</button>
        <button class="myth gate" data-m="gate">${ICON.gate}Estallido<br>de portal</button>
        <button class="myth head" data-m="head">${ICON.head}Leer<br>Titular</button>
        ${S.decks.TE ? `<button class="myth terr" data-m="terror">${ICON.terror}Propagar<br>Terror</button>` : ''}
      </nav>`;
    bindGame();
  }

  function cityHTML() {
    const ev = deck('EV');
    const topId = ev.cards[0], discId = ev.disc[ev.disc.length - 1];
    const unst = discId ? CARDS[discId].nb : null;
    let h = `<h2 class="sec">Mazo de Eventos</h2>
      <div class="evstrip">
        <div class="evslot"><div class="lbl">Arriba</div>
          ${topId != null ? `<div class="cardmini" style="background-image:url(${back(topId)})" data-peek="EV" title="Dorso de la primera carta"></div>` : '<div class="cardmini empty">vacío</div>'}
          <div class="nm">${topId != null ? esc(CARDS[topId].nb || '¿?') : '—'}</div><div class="ct">${ev.cards.length} cartas</div></div>
        <div class="evslot"><div class="lbl">Espacio inestable</div>
          ${discId != null ? `<div class="cardmini" style="background-image:url(${face(discId)});background-position:center top" data-open="${discId}"></div>` : '<div class="cardmini empty">espacio de inicio</div>'}
          <div class="nm">${unst ? esc(unst) : 'Espacio de inicio'}</div><div class="ct">${ev.disc.length} descartadas</div></div>
        <div class="evslot"><div class="lbl">Pistas en juego</div>
          <div class="cardmini empty" style="font-size:2rem;color:var(--clue-2);font-family:var(--display)">${encIds().reduce((a, id) => a + deck(id).cards.filter((x) => CARDS[x].k === 'ev').length, 0)}</div>
          <div class="nm">Eventos en mazos de barrio</div><div class="ct"><button class="chip" data-a="evmenu">Opciones</button></div></div>
      </div>
      <h2 class="sec">Encuentros</h2><div class="grid">`;
    for (const id of encIds()) h += tileHTML(deck(id));
    h += `</div><div class="chips"><button class="chip" data-a="adddeck">+ Añadir mazo de encuentros</button></div>`;
    const others = ['AN', 'TE', 'HL', 'INV'].filter((k) => S.decks[k]);
    if (others.length) {
      h += `<h2 class="sec">Otros mazos</h2><div class="grid">`;
      for (const k of others) h += tileHTML(deck(k));
      h += '</div>';
    }
    return h;
  }

  function tileHTML(d) {
    const nClues = d.kind === 'nb' ? d.cards.filter((x) => CARDS[x].k === 'ev').length : 0;
    const bg = d.cards.length ? back(d.cards[0]) : (d.kind === 'nb' ? back(encounterCards(d.name)[0]) : '');
    const sub = d.kind === 'hl' ? `${d.cards.length} en mazo · ${d.disc.length} leídos`
      : d.kind === 'inv' ? `${d.cards.length} cartas · robar → Códice`
      : `${d.cards.length} cartas`;
    return `<div class="tile ${d.kind === 'nb' ? '' : 'small'}" data-draw="${esc(d.id)}" style="background-image:url(${bg})">
      <div class="badges">
        ${nClues ? `<span class="badge clue">${ICON.clue.replace('<svg', '<svg width="13" height="13"')} ${nClues}</span>` : ''}
        ${d.att.length ? `<span class="badge terror" data-terr="${esc(d.id)}">Terror ${d.att.length}</span>` : ''}
        ${d.anom ? `<span class="badge anom">Anomalía</span>` : ''}
        ${(d.link || []).map((x) => `<span class="badge link" data-open="${x}">Archivo ${CARDS[x].n}</span>`).join('')}
      </div>
      <button class="more" data-dmenu="${esc(d.id)}" title="Opciones">⋯</button>
      <div class="name">${esc(d.name)}<small>${sub}</small></div>
    </div>`;
  }

  function codexHTML() {
    let h = `<h2 class="sec">Códice</h2>`;
    h += S.codex.length ? `<div class="codex">${S.codex.map((id) => S.hid?.[id] ? `<div class="c hidden" data-open="${id}"><div class="hidcard">?</div><span>oculta</span></div>` : `<div class="c" data-open="${id}"><img src="${S.flip[id] ? back(id) : face(id)}" loading="lazy" alt=""><span>${CARDS[id].k === 'ar' ? CARDS[id].n : 'T'}</span></div>`).join('')}</div>`
      : `<p class="muted">El Códice está vacío.</p>`;
    h += `<h2 class="sec">Archivo</h2><div class="panel">
      <div class="row"><input class="input" id="archNum" type="number" inputmode="numeric" min="1" max="200" placeholder="Nº de carta" style="width:8em">
      <button class="btn primary" data-a="archGo">Buscar</button><span class="spacer"></span>
      <button class="btn" data-a="archAll">Ver todo</button></div>
      <div class="row" style="margin-top:8px"><input class="input" id="archTxt" type="search" placeholder="Buscar texto en el Archivo…" style="flex:1"><button class="btn" data-a="archFind">Buscar</button></div>
      <p class="muted" style="margin:8px 0 0">${deck('AR').cards.length} cartas en el Archivo.</p></div>
      <h2 class="sec">Sorteos del Archivo</h2><div class="panel">
      <p class="muted" style="margin:0 0 6px">Para «coge las cartas 109–112, barájalas y añade una al azar», «elige dos al azar», etc.</p>
      <div class="row">Coger <input class="input" id="rndK" type="number" inputmode="numeric" min="1" value="1" style="width:3.6em"> al azar entre
        <input class="input" id="rndA" type="number" inputmode="numeric" placeholder="desde" style="width:5em"> y
        <input class="input" id="rndB" type="number" inputmode="numeric" placeholder="hasta" style="width:5em"></div>
      <div class="row" style="margin-top:8px"><label class="row" style="gap:6px"><input type="checkbox" id="rndHide"> sin mirarla (boca abajo en el Códice)</label><span class="spacer"></span><button class="btn primary" data-a="rnd">Sortear</button></div>
      <div class="row" style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px">Mazo de Investigación con las cartas
        <input class="input" id="invA" type="number" inputmode="numeric" placeholder="desde" style="width:5em"> a
        <input class="input" id="invB" type="number" inputmode="numeric" placeholder="hasta" style="width:5em"><button class="btn" data-a="inv">Crear</button></div>
      </div>`;
    if (S.aside?.length) {
      h += `<h2 class="sec">Apartado</h2><div class="panel"><p class="muted" style="margin-top:0">Módulos apartados por la preparación. Ponlos en juego cuando una carta lo indique; sus Eventos apartados se barajan en el mazo de Eventos.</p><div class="chips">`;
      h += S.aside.map((n) => `<button class="chip" data-aside="${esc(n)}">+ ${esc(n)} (${(S.asideEv || []).filter((x) => CARDS[x].nb === n).length} Eventos)</button>`).join('');
      h += '</div></div>';
    }
    return h;
  }

  function logHTML() {
    return `<h2 class="sec">Registro</h2><ul class="log">${S.log.slice(0, 250).map((l) => `<li><time>${timeStr(l.t)}</time><span>${esc(l.m)}</span></li>`).join('')}</ul>`;
  }

  function bindGame() {
    const app = $('#app');
    app.onclick = (e) => {
      const t = e.target.closest('[data-a],[data-tab],[data-draw],[data-dmenu],[data-m],[data-open],[data-peek],[data-terr],[data-aside]');
      if (!t) return;
      e.stopPropagation();
      if (t.dataset.tab) { ui.tab = t.dataset.tab; render(); return; }
      if (t.dataset.dmenu) { deckMenu(t.dataset.dmenu); return; }
      if (t.dataset.terr) { terrorEncounter(t.dataset.terr); return; }
      if (t.dataset.open) { openCard(+t.dataset.open); return; }
      if (t.dataset.peek) { const id = deck('EV').cards[0]; if (id != null) viewImage(back(id), 'Dorso de la primera carta de Eventos'); return; }
      if (t.dataset.aside) { bringAside(t.dataset.aside); return; }
      if (t.dataset.draw) { tileTap(t.dataset.draw); return; }
      if (t.dataset.m) {
        const m = t.dataset.m;
        if (m === 'clue') act(() => spawnClue());
        else if (m === 'doom') act(() => spreadDoom());
        else if (m === 'gate') act(() => gateBurst());
        else if (m === 'head') act(() => readHeadline());
        else if (m === 'terror') terrorPicker();
        return;
      }
      const a = t.dataset.a;
      if (a === 'undo') undo();
      else if (a === 'menu') mainMenu();
      else if (a === 'sheet') sheetModal();
      else if (a === 'adddeck') addDeckModal();
      else if (a === 'evmenu') deckMenu('EV');
      else if (a === 'archGo') { const n = +$('#archNum').value; const id = archId(n); if (id == null) toast('No existe esa carta de Archivo.'); else openCard(id); }
      else if (a === 'archAll') browse('AR', true);
      else if (a === 'archFind') archiveSearch($('#archTxt').value);
      else if (a === 'rnd') archiveDraw(+$('#rndK').value || 1, +$('#rndA').value, +$('#rndB').value, $('#rndHide').checked);
      else if (a === 'inv') makeInvestigation(+$('#invA').value, +$('#invB').value);
    };
    const inp = $('#archNum'); if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') $('[data-a=archGo]').click(); };
    const inp2 = $('#archTxt'); if (inp2) inp2.onkeydown = (e) => { if (e.key === 'Enter') archiveSearch(inp2.value); };
  }

  function tileTap(deckId) {
    const d = deck(deckId);
    if (d.kind === 'nb' && d.anom && S.decks.AN) {
      openModal(`<div class="mbox"><div class="mhead"><h3>${esc(d.name)}</h3><button class="iconbtn" data-x>✕</button></div>
        <div class="note">Este Barrio tiene una Anomalía: se resuelve un encuentro en la Anomalía en lugar del encuentro normal.</div>
        <div class="actions"><button class="btn primary" data-go="an">Encuentro en Anomalía</button><button class="btn" data-go="nb">Encuentro normal</button></div></div>`,
        (e) => { const g = e.target.closest('[data-go]'); if (!g) return; closeModal(); drawAndOpen(g.dataset.go === 'an' ? 'AN' : deckId); });
      return;
    }
    if (d.kind === 'nb' && d.att.length) {
      openModal(`<div class="mbox"><div class="mhead"><h3>${esc(d.name)}</h3><button class="iconbtn" data-x>✕</button></div>
        <div class="note warn">Hay ${d.att.length} carta(s) de Terror vinculada(s): primero se resuelve un encuentro de Terror elegido al azar (máximo uno por investigador y ronda); luego puedes resolver el encuentro normal.</div>
        <div class="actions"><button class="btn danger" data-go="te">Encuentro de Terror</button><button class="btn" data-go="nb">Encuentro normal</button></div></div>`,
        (e) => { const g = e.target.closest('[data-go]'); if (!g) return; closeModal(); if (g.dataset.go === 'te') terrorEncounter(deckId); else drawAndOpen(deckId); });
      return;
    }
    if (d.kind === 'hl') { act(() => readHeadline()); return; }
    if (d.kind === 'ar') { browse('AR', true); return; }
    drawAndOpen(deckId);
  }
  function drawAndOpen(deckId, where = 'top') {
    let id = null;
    act(() => { id = draw(deckId, where); });
    if (id != null) openCard(id, { fresh: true });
  }
  function terrorEncounter(deckId) {
    const d = deck(deckId); if (!d.att.length) return;
    let id;
    act(() => { id = d.att.splice(Math.floor(Math.random() * d.att.length), 1)[0]; S.pending.push({ id, from: 'TE', at: deckId }); log(`Encuentro de Terror en ${d.name}.`); });
    openCard(id, { fresh: true, info: `Lee la sección correspondiente a la cantidad de <b>fichas de Terror</b> que haya en ${esc(d.name)}.` });
  }
  function terrorPicker() {
    const un = unstableNb();
    openModal(`<div class="mbox"><div class="mhead"><h3>Propagar Terror</h3><button class="iconbtn" data-x>✕</button></div>
      <p>El Terror se propaga en el Barrio del <b>espacio inestable</b>${un ? `: <b>${esc(un)}</b>` : ''}. Elige el Barrio:</p>
      <div class="targets">${encIds().filter((id) => !['E:Calles', 'E:Ruta de Viaje', 'E:Umbrales'].includes(id)).map((id) => `<button class="btn ${deck(id).name === un ? 'on' : ''}" data-nb="${esc(deck(id).name)}">${esc(deck(id).name)}</button>`).join('')}</div>
      <p class="muted">${deck('TE').cards.length} cartas en el mazo de Terror.</p></div>`,
      (e) => { const b = e.target.closest('[data-nb]'); if (!b) return; closeModal(); act(() => spreadTerror(b.dataset.nb)); });
  }
  function bringAside(name) {
    act(() => {
      addEncounterDeck(name);
      const evs = (S.asideEv || []).filter((x) => CARDS[x].nb === name);
      S.asideEv = S.asideEv.filter((x) => !evs.includes(x));
      const ev = deck('EV'); ev.cards.push(...evs); shuffle(ev.cards);
      S.aside = S.aside.filter((x) => x !== name);
      log(`${name}: ${evs.length} Eventos apartados se barajan en el mazo de Eventos.`);
    });
    toast(`${esc(name)} entra en juego`);
  }

  // ---------- visor de carta ----------
  function openCard(id, opt = {}) {
    const c = CARDS[id]; if (!c) return;
    if (S.hid?.[id]) {
      openModal(`<div class="mbox"><div class="mhead"><h3>Carta oculta del Códice</h3><button class="iconbtn" data-x>✕</button></div>
        <div class="note">Está boca abajo: nadie la ha mirado. Revélala sólo cuando una carta lo indique.</div>
        <div class="actions"><button class="btn gold" data-r>Revelar</button><button class="btn" data-back>Devolver al Archivo</button></div></div>`,
        (e) => {
          if (e.target.closest('[data-r]')) { closeModal(); act(() => { delete S.hid[id]; log(`Se revela la carta oculta: ${cardLabel(id)}.`); }); openCard(id); }
          else if (e.target.closest('[data-back]')) { closeModal(); act(() => { delete S.hid[id]; place(id, 'AR', 'top'); deck('AR').cards.sort((x, y) => CARDS[x].n - CARDS[y].n); log('Una carta oculta vuelve al Archivo sin revelarse.'); }); }
        });
      return;
    }
    const p = S.pending.find((x) => x.id === id);
    const w = whereIs(id);
    const flipped = !!S.flip[id];
    const hasBack = c.b != null;
    const title = cardLabel(id);
    let actions = '';
    const fromDeck = p ? deck(p.from) : null;
    if (opt.readonly) {
      actions = `<button class="btn primary full" data-x>Hecho</button>`;
    } else if (p) {
      if (p.clue) {
        actions = `<div class="full note">Aparición de Pista: elige el mazo de Encuentros donde se mezcla este Evento (entre las 3 primeras).</div>
          ${encIds().map((d) => `<button class="btn" data-mv="${esc(d)}" data-pos="3">${esc(deck(d).name)}</button>`).join('')}`;
      } else if (c.k === 'ev' && p.from.startsWith('E:')) {
        actions = `<button class="btn primary" data-do="evwin">Gané la Pista<small>Evento al descarte</small></button>
          <button class="btn" data-do="evback">No la gané<small>mezclar entre las ${S.n} primeras</small></button>`;
      } else if (p.from === 'HL') {
        actions = `<button class="btn primary" data-do="hldisc">Descartar</button><button class="btn gold" data-do="codex">Al Códice<small>Rumor</small></button>`;
      } else if (p.from === 'TE') {
        actions = `<button class="btn primary full" data-do="tebottom">Resuelto<small>al fondo del mazo de Terror</small></button>`;
      } else if (p.from === 'INV') {
        actions = `<button class="btn primary" data-do="codex">Al Códice</button><button class="btn" data-do="toarch">Descartar<small>vuelve al Archivo</small></button>`;
      } else if (c.k === 'ar') {
        actions = `<button class="btn gold" data-do="codex">Al Códice</button><button class="btn" data-do="toarch">Devolver al Archivo</button>`;
      } else {
        actions = `<button class="btn primary" data-mv="${esc(p.from)}" data-pos="bottom">Al fondo<small>${esc(fromDeck?.name || '')}</small></button>
          <button class="btn" data-mv="${esc(p.from)}" data-pos="top">Arriba</button>
          <button class="btn" data-mv="${esc(p.from)}" data-pos="${S.n}">Mezclar en las ${S.n} primeras</button>
          <button class="btn" data-mv="${esc(p.from)}" data-pos="random">Al azar en el mazo</button>`;
      }
      actions += `<button class="btn full" data-do="move">Mover a otro mazo…</button>`;
    } else if (w.zone === 'codex' && c.k === 'hl') {
      actions = `<button class="btn primary" data-do="hldisc">Descartar<small>pila de descartes de Titulares</small></button><button class="btn" data-do="move">Mover a un mazo…</button>`;
    } else if (w.zone === 'codex') {
      actions = `<button class="btn" data-do="toarch">Devolver al Archivo</button><button class="btn" data-do="move">Mover a un mazo…</button>`;
    } else if (c.k === 'ar' && w.deck === 'AR') {
      actions = `<button class="btn gold" data-do="codex">Añadir al Códice</button><button class="btn" data-do="take">Sacar a la mano<small>(p. ej. un artefacto)</small></button>
        <button class="btn full" data-do="move">Mezclar en un mazo…</button>`;
    } else {
      actions = `<button class="btn" data-do="take">Sacar a la mano</button><button class="btn" data-do="move">Mover a un mazo…</button>`;
    }
    const where = p ? `Robada de ${esc(fromDeck?.name || p.from)}` : w.zone === 'codex' ? 'En el Códice' : w.deck ? `${esc(deck(w.deck).name)}${w.zone === 'disc' ? ' (descarte)' : w.zone === 'att' || w.zone === 'link' ? ' (vinculada)' : ''}` : '';
    openModal(`<div class="mbox">
      <div class="mhead"><div style="flex:1"><h3>${esc(title)}</h3><div class="sub">${where}</div></div><button class="iconbtn" data-x>✕</button></div>
      ${opt.info ? `<div class="note" style="margin:0 0 10px">${opt.info}</div>` : ''}
      ${c.en ? `<div class="note en" style="margin:0 0 10px">Esta carta falta en el mod en español: se muestra la versión en inglés (Orden Esotérica de Dagón · Tienda de comestibles · Prisión de Innsmouth).</div>` : ''}
      ${englishHTML(c)}
      <div class="viewer"><div class="flip ${flipped ? 'back' : ''}" id="flipper">
        <div class="face a"><img src="${face(id)}" alt=""></div>
        <div class="face b">${hasBack ? `<img src="${back(id)}" alt="">` : ''}</div>
      </div></div>
      ${hasBack ? `<div class="fliphint">Toca la carta para darle la vuelta${c.k === 'ar' ? ' (queda así en el Códice) · <button class="chip" data-rside>Lado al azar</button>' : ''}</div>` : ''}
      <div id="cardacts">${cardActionsHTML(id)}</div>
      <div class="actions">${actions}</div>
      ${opt.fresh && p ? '<p class="muted" style="text-align:center;font-size:.85rem">Cerrar con ✕ cancela el robo: la carta vuelve a su lugar.</p>' : ''}
    </div>`, (e) => {
      if (e.target.closest('[data-rside]')) {
        const b = Math.random() < 0.5; S.flip[id] = b; persist();
        $('#flipper').classList.toggle('back', b); toast(`Lado al azar: ${b ? 'reverso' : 'anverso'}`); const ca = $('#cardacts'); if (ca) ca.innerHTML = cardActionsHTML(id); return;
      }
      if (e.target.closest('#flipper')) {
        if (!hasBack) return;
        const f = $('#flipper'); f.classList.toggle('back');
        if (c.k === 'ar') { S.flip[id] = f.classList.contains('back'); persist(); const ca = $('#cardacts'); if (ca) ca.innerHTML = cardActionsHTML(id); }
        return;
      }
      const cab = e.target.closest('[data-ca]');
      if (cab) { runCardAction(id, +cab.dataset.ca); return; }
      const mv = e.target.closest('[data-mv]');
      if (mv) {
        const pos = /^\d+$/.test(mv.dataset.pos) ? +mv.dataset.pos : mv.dataset.pos;
        const dn = deck(mv.dataset.mv).name;
        closeModal(); act(() => { place(id, mv.dataset.mv, pos); log(`${cardLabel(id)} → ${dn}, ${posLabel(pos)}.`); });
        return;
      }
      const d = e.target.closest('[data-do]'); if (!d) return;
      const k = d.dataset.do;
      if (k === 'move') { moveModal(id); return; }
      closeModal();
      act(() => {
        if (k === 'evwin') { place(id, 'EV', 'disc'); log(`${cardLabel(id)}: se gana la Pista; el Evento va al descarte (nuevo espacio inestable).`); }
        else if (k === 'evback') { place(id, p.from, S.n); log(`${cardLabel(id)}: no se gana la Pista; vuelve mezclado entre las ${S.n} primeras de ${deck(p.from).name}.`); }
        else if (k === 'hldisc') { place(id, 'HL', 'disc'); log(w.zone === 'codex' ? 'Un Titular del Códice se descarta.' : 'Titular leído y descartado.'); }
        else if (k === 'codex') { removeEverywhere(id); S.codex.push(id); log(`${cardLabel(id)} se añade al Códice.`); }
        else if (k === 'toarch') { place(id, 'AR', 'top'); deck('AR').cards.sort((a, b) => CARDS[a].n - CARDS[b].n); delete S.flip[id]; log(`${cardLabel(id)} vuelve al Archivo.`); }
        else if (k === 'tebottom') { place(id, 'TE', 'bottom'); log('Carta de Terror resuelta: al fondo del mazo de Terror.'); }
        else if (k === 'take') { removeEverywhere(id); S.pending.push({ id, from: w.deck || 'AR' }); log(`${cardLabel(id)} pasa a la mano.`); }
      });
    }, opt.fresh && p ? () => { if (S.pending.some((x) => x.id === id)) undo('Robo cancelado: la carta volvió a su lugar'); } : null);
  }

  // ---------- acciones sugeridas de las cartas del Archivo (acciones.js) ----------
  const ACTS = window.AH_ACTIONS || {};
  const ARCHNB = window.AH_ARCHNB || {};
  function cardActs(id) {
    const c = CARDS[id];
    if (c.k !== 'ar') return [];
    const w = whereIs(id);
    if (!(w.zone === 'codex' || w.zone === 'pending' || w.zone === 'link')) return [];
    return (ACTS[c.n] || {})[S.flip[id] ? 'b' : 'f'] || [];
  }
  const inAR = (n) => { const x = archId(n); return x != null && deck('AR').cards.includes(x); };
  const inCodex = (n) => { const x = archId(n); return x != null && S.codex.includes(x); };
  function actLabel(me, a) {
    const n = a.n, self = n === CARDS[me].n;
    const r = a.a ? `${a.a}–${a.b}` : '';
    switch (a.t) {
      case 'codex': return [`Añadir ${n} al Códice${a.down ? ' (por el reverso)' : a.rside ? ' (lado al azar)' : ''}`, inCodex(n) ? `ya está en el Códice` : !inAR(n) ? 'no está en el Archivo' : ''];
      case 'arch': return [self ? 'Devolver esta carta al Archivo' : `Devolver ${n} al Archivo`, inAR(n) ? 'ya está en el Archivo' : ''];
      case 'flip': return [self ? 'Dar la vuelta a esta carta' : `Dar la vuelta a ${n}`, !self && !inCodex(n) ? 'no está en el Códice' : ''];
      case 'back': return [`Leer el reverso de ${n}`, ''];
      case 'show': return [`Ver carta ${n}`, ''];
      case 'take': return [self ? 'Tomar esta carta (a la mano)' : `Tomar ${n} (a la mano)`, ''];
      case 'link': return [`Vincular ${n} al mazo de ${ARCHNB[n] || '…'}`, ''];
      case 'rnd': return [`Sortear ${a.k} entre ${r} → Códice${a.hide ? ' (boca abajo, sin mirar)' : ''}`, ''];
      case 'inv': return [`Crear mazo de Investigación con ${r}`, ''];
      case 'mix': return [a.pos === 'top' ? `Poner ${r} boca abajo arriba de su mazo de barrio` : `Mezclar ${r} en sus mazos de barrio (entre las 3 primeras)`, ''];
      case 'aside': return [`Apartar ${r}`, ''];
      case 'archr': return [`Devolver ${r} al Archivo`, ''];
      case 'linkaside': return ['Vincular al azar una carta apartada a su mazo', (S.asideArch || []).length ? '' : 'no hay cartas apartadas'];
      case 'invtop': return ['Mostrar la primera del mazo de Investigación', S.decks.INV?.cards.length ? '' : 'no hay mazo de Investigación'];
      case 'invback': return ['Devolver el mazo de Investigación al Archivo', S.decks.INV ? '' : 'no hay mazo de Investigación'];
      case 'invrnd': return ['Mostrar una carta al azar de Investigación y devolverla al Archivo', S.decks.INV?.cards.length ? '' : 'no hay mazo de Investigación'];
      case 'invlast': return ['Añadir al Códice la última carta de Investigación', S.decks.INV?.cards.length === 1 ? '' : 'sólo cuando quede una'];
      case 'invpick': return ['Una carta al azar de Investigación → Códice; el resto al Archivo', S.decks.INV?.cards.length ? '' : 'no hay mazo de Investigación'];
      case 'reveal': return ['Revelar la carta boca abajo y añadirla al Códice', Object.keys(S.hid || {}).length ? '' : 'no hay cartas boca abajo'];
      case 'hlmix': return [`Mezclar ${n} entre las 3 primeras de Titulares`, ''];
      case 'board': return [`Añadir al tablero ${a.nbs.join(' y ')} y mezclar sus Eventos`, a.nbs.every((x) => S.decks['E:' + x]) ? 'ya están en juego' : ''];
      case 'ms153': return ['Añadir el Mundo subterráneo y los Umbrales; retirar 4 Eventos; 2 Eventos del Mundo subterráneo al mazo y 2 al descarte', S.decks['E:El Mundo Subterráneo'] ? 'ya está en juego' : ''];
      case 'rndto': return [`Coger al azar una de ${r} → ${a.pos === 'top' ? 'arriba del' : 'mezclar entre las 3 primeras del'} mazo de ${a.to}`, S.decks['E:' + a.to] ? '' : `${a.to} no está en juego`];
      case 'codexclear': return ['Devolver al Archivo las demás cartas del Códice', ''];
      case 'totop': return [`Poner esta carta arriba del mazo de ${a.to}`, S.decks['E:' + a.to] ? '' : `${a.to} no está en juego`];
      default: return [a.t, ''];
    }
  }
  function cardActionsHTML(id) {
    const list = cardActs(id);
    if (!list.length) return '';
    return `<div class="cacts"><div class="cacts-h">Lo que pide esta cara <span class="muted">(toca sólo cuando se cumpla la condición)</span></div>
      ${list.map((a, i) => { const [l, why] = actLabel(id, a); const sub = why || a.note || ''; return `<button class="btn ca" data-ca="${i}" ${why ? 'disabled' : ''}>${esc(l)}${sub ? `<small>${esc(why ? why : 'Sólo ' + a.note)}</small>` : ''}</button>`; }).join('')}</div>`;
  }
  function sortAR() { deck('AR').cards.sort((a, b) => CARDS[a].n - CARDS[b].n); }
  function toArchive(x) { delete S.flip[x]; if (S.hid) delete S.hid[x]; place(x, 'AR', 'top'); sortAR(); }
  function linkTo(x) {
    const nb = ARCHNB[CARDS[x].n];
    const d = nb && S.decks['E:' + nb];
    removeEverywhere(x);
    if (d) { d.link = d.link || []; d.link.push(x); return nb; }
    S.pending.push({ id: x, from: 'AR' });
    return null;
  }
  function runCardAction(me, i) {
    const a = cardActs(me)[i]; if (!a) return;
    const n = a.n, x = n != null ? archId(n) : null, self = x === me;
    const reopen = () => { const w = whereIs(me); if (w.zone === 'codex' || w.zone === 'pending' || w.zone === 'link') openCard(me); else closeModal(); };
    if (a.t === 'show') { openCard(x); return; }
    if (a.t === 'back') { openModal(`<div class="mbox"><div class="mhead"><h3>Reverso de la carta ${n}</h3><button class="iconbtn" data-x>✕</button></div><div class="viewer"><div class="flip"><div class="face a"><img src="${back(x)}" alt=""></div></div></div><div class="actions"><button class="btn full" data-ret>Volver a la carta ${CARDS[me].n}</button></div></div>`, (e) => { if (e.target.closest('[data-ret]')) openCard(me); }); return; }
    if (a.t === 'rnd') { closeModal(); archiveDraw(a.k, a.a, a.b, a.hide); return; }
    if (a.t === 'inv') { makeInvestigation(a.a, a.b); reopen(); return; }
    if (a.t === 'invtop') { let t; act(() => { t = draw('INV'); }); if (t != null) openCard(t, { fresh: true, info: 'Si es un artefacto, un investigador lo gana («Sacar a la mano»); si no, se añade al Códice.' }); return; }
    if (a.t === 'invrnd') { let t; act(() => { t = draw('INV', 'random'); if (t != null) { toArchive(t); log(`Investigación: se muestra ${cardLabel(t)} y vuelve al Archivo.`); } }); if (t != null) openCard(t, { info: 'Carta mostrada al azar del mazo de Investigación: ya volvió al Archivo.', readonly: true }); return; }
    act(() => {
      switch (a.t) {
        case 'codex': removeEverywhere(x); S.codex.push(x); if (a.down) S.flip[x] = true; else if (a.rside) S.flip[x] = Math.random() < 0.5; else delete S.flip[x]; log(`Carta ${n} se añade al Códice${a.down ? ' por el reverso' : a.rside ? ` con un lado al azar (${S.flip[x] ? 'reverso' : 'anverso'})` : ''}.`); break;
        case 'arch': toArchive(x); log(`Carta ${n} vuelve al Archivo.`); break;
        case 'flip': S.flip[x] = !S.flip[x]; log(`Se da la vuelta a la carta ${n}.`); break;
        case 'take': removeEverywhere(x); S.pending.push({ id: x, from: 'AR' }); log(`Carta ${n} pasa a la mano.`); break;
        case 'link': { const nb = linkTo(x); log(nb ? `Carta ${n} queda vinculada al mazo de ${nb}.` : `Carta ${n}: barrio no identificado, queda en la mano.`); break; }
        case 'archr': for (let k = a.a; k <= a.b; k++) { const y = archId(k); if (y != null && !deck('AR').cards.includes(y) && y !== me) toArchive(y); } log(`Cartas ${a.a}–${a.b} vuelven al Archivo.`); break;
        case 'aside': { S.asideArch = S.asideArch || []; const got = archRange(a.a, a.b) || []; for (const y of got) { removeEverywhere(y); S.asideArch.push(y); } log(`Se apartan las cartas ${a.a}–${a.b} (${got.length}).`); break; }
        case 'linkaside': { const pool = S.asideArch || []; const y = pool[Math.floor(Math.random() * pool.length)]; const nb = linkTo(y); log(`Al azar: la carta ${CARDS[y].n} se vincula a ${nb || '¿?'}.`); toast(`Carta ${CARDS[y].n} → ${esc(nb || 'en mano')}`); break; }
        case 'mix': { const got = archRange(a.a, a.b) || []; const done = []; for (const y of got) { const nb = ARCHNB[CARDS[y].n]; if (nb && S.decks['E:' + nb]) { place(y, 'E:' + nb, a.pos || 3); done.push(`${CARDS[y].n}→${nb}`); } else { removeEverywhere(y); S.pending.push({ id: y, from: 'AR' }); done.push(`${CARDS[y].n}→mano`); } } log(`Se mezclan en sus mazos de barrio (entre las 3 primeras): ${done.join(', ')}.`); break; }
        case 'invback': { const d = S.decks.INV; for (const y of d.cards.splice(0)) toArchive(y); delete S.decks.INV; log('El mazo de Investigación vuelve al Archivo.'); break; }
        case 'invlast': { const y = S.decks.INV.cards.pop(); S.codex.push(y); delete S.decks.INV; log(`La última carta de Investigación (${CARDS[y].n}) se añade al Códice.`); break; }
        case 'invpick': { const d = S.decks.INV; const y = d.cards.splice(Math.floor(Math.random() * d.cards.length), 1)[0]; S.codex.push(y); for (const z of d.cards.splice(0)) toArchive(z); delete S.decks.INV; log(`Investigación: la carta ${CARDS[y].n} (al azar) va al Códice; el resto vuelve al Archivo.`); break; }
        case 'reveal': { for (const y of Object.keys(S.hid || {})) { delete S.hid[y]; log(`Se revela la carta ${CARDS[y].n}.`); } break; }
        case 'hlmix': place(x, 'HL', 3); log(`Carta ${n} se mezcla entre las 3 primeras de Titulares.`); break;
        case 'board': {
          const ev = deck('EV'); const add = [];
          for (const nb of a.nbs) {
            if (!S.decks['E:' + nb]) addEncounterDeck(nb);
            S.aside = (S.aside || []).filter((z) => z !== nb);
            const evs = (S.asideEv || []).filter((z) => CARDS[z].nb === nb);
            S.asideEv = (S.asideEv || []).filter((z) => !evs.includes(z)); add.push(...evs);
          }
          ev.cards = shuffle([...ev.cards, ...ev.disc.splice(0), ...add]);
          log(`Se añaden al tablero ${a.nbs.join(' y ')}; el mazo de Eventos se baraja con su descarte y ${add.length} Eventos de ${a.ev}.`);
          break;
        }
        case 'ms153': {
          if (!S.decks['E:El Mundo Subterráneo']) addEncounterDeck('El Mundo Subterráneo');
          if (!S.decks['E:Umbrales']) addEncounterDeck('Umbrales');
          S.aside = (S.aside || []).filter((z) => z !== 'El Mundo Subterráneo' && z !== 'Umbrales');
          const ev = deck('EV'); const gone = ev.cards.splice(0, 4);
          const ms = shuffle((S.asideEv || []).filter((z) => CARDS[z].nb === 'El Mundo Subterráneo'));
          S.asideEv = (S.asideEv || []).filter((z) => !ms.includes(z));
          ev.cards.push(...ms.slice(0, 2)); shuffle(ev.cards); ev.disc.push(...ms.slice(2));
          log(`Entran el Mundo subterráneo y los Umbrales. Se retiran ${gone.length} Eventos del mazo; 2 Eventos del Mundo subterráneo se barajan en el mazo y ${ms.slice(2).length} van al descarte.`);
          break;
        }
        case 'rndto': { const pool = archRange(a.a, a.b) || []; const y = pool[Math.floor(Math.random() * pool.length)]; if (y == null) break; place(y, 'E:' + a.to, a.pos); log(`Carta al azar entre ${a.a}–${a.b} → ${a.to}, ${posLabel(a.pos)}.`); break; }
        case 'codexclear': { const keep = new Set(a.keep.map(archId)); const gone = S.codex.filter((y) => CARDS[y].k === 'ar' && !keep.has(y)); for (const y of gone) toArchive(y); log(`Vuelven al Archivo las cartas del Códice ${gone.map((y) => CARDS[y].n).join(', ')} (se quedan ${a.keep.join(' y ')} y los Rumores).`); break; }
        case 'totop': place(x, 'E:' + a.to, 'top'); log(`Carta ${n} se coloca arriba del mazo de ${a.to}.`); break;
      }
    });
    if (a.t === 'flip' && self) { openCard(me); return; }
    reopen();
  }

  function moveModal(id) {
    let pos = 'top';
    const targets = [...encIds(), 'EV', ...['AN', 'TE', 'HL', 'INV'].filter((k) => S.decks[k])];
    const html = () => `<div class="mbox"><div class="mhead"><h3>Mover ${esc(cardLabel(id))}</h3><button class="iconbtn" data-x>✕</button></div>
      <p class="muted" style="margin:0 0 6px">Posición</p>
      <div class="chips" style="margin-bottom:12px">${[['top', 'Arriba'], ['bottom', 'Al fondo'], ['2', 'Entre las 2 primeras'], ['3', 'Entre las 3 primeras'], ['4', 'Entre las 4 primeras'], ['random', 'Al azar'], ['disc', 'Descarte']].map(([k, l]) => `<button class="chip ${String(pos) === k ? 'on' : ''}" data-pos="${k}">${l}</button>`).join('')}</div>
      <p class="muted" style="margin:0 0 6px">Mazo destino</p>
      <div class="targets">${targets.map((d) => `<button class="btn" data-to="${esc(d)}">${esc(deck(d).name)} <span class="muted">(${deck(d).cards.length})</span></button>`).join('')}
        <button class="btn" data-to="#codex">Códice</button><button class="btn" data-to="#arch">Archivo</button></div></div>`;
    openModal(html(), function h(e) {
      const pb = e.target.closest('[data-pos]');
      if (pb) { pos = /^\d+$/.test(pb.dataset.pos) ? +pb.dataset.pos : pb.dataset.pos; $('#modal').innerHTML = html(); return; }
      const tb = e.target.closest('[data-to]'); if (!tb) return;
      const to = tb.dataset.to;
      closeModal();
      act(() => {
        if (to === '#codex') { removeEverywhere(id); S.codex.push(id); log(`${cardLabel(id)} → Códice.`); }
        else if (to === '#arch') { place(id, 'AR', 'top'); deck('AR').cards.sort((a, b) => CARDS[a].n - CARDS[b].n); log(`${cardLabel(id)} → Archivo.`); }
        else { place(id, to, pos); log(`${cardLabel(id)} → ${deck(to).name}, ${posLabel(pos)}.`); }
      });
    });
  }

  // ---------- menús ----------
  function deckMenu(deckId) {
    const d = deck(deckId);
    const isNb = d.kind === 'nb';
    openModal(`<div class="mbox"><div class="mhead"><div style="flex:1"><h3>${esc(d.name)}</h3><div class="sub">${d.cards.length} cartas${d.disc.length ? ` · ${d.disc.length} en descarte` : ''}</div></div><button class="iconbtn" data-x>✕</button></div>
      <div class="menu">
        ${deckId !== 'EV' ? `<button class="btn" data-k="top">Robar de arriba</button><button class="btn" data-k="bottom">Robar de abajo</button><button class="btn" data-k="random">Robar al azar</button>` : ''}
        <button class="btn" data-k="shuffle">Barajar el mazo</button>
        <button class="btn" data-k="browse">Ver las cartas del mazo (y sacar una)</button>
        ${d.disc.length ? `<button class="btn" data-k="disc">Ver el descarte (${d.disc.length})</button><button class="btn" data-k="reshuffle">Barajar el descarte dentro del mazo</button>` : ''}
        ${isNb && S.decks.AN ? `<button class="btn" data-k="anom">${d.anom ? 'Quitar la Anomalía de este Barrio' : 'Marcar Anomalía en este Barrio'}</button>` : ''}
        ${isNb && d.att.length ? `<button class="btn" data-k="terr">Encuentro de Terror (${d.att.length} vinculadas)</button>` : ''}
        ${d.kind === 'inv' ? `<button class="btn" data-k="invback">Devolver el mazo al Archivo</button>` : ''}
        ${isNb && d.name !== 'Calles' ? `<button class="btn danger" data-k="remove">Quitar este módulo del tablero</button>` : ''}
      </div></div>`, (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k; closeModal();
      if (k === 'top' || k === 'bottom' || k === 'random') { if (deckId === 'HL' && k === 'top') act(() => readHeadline()); else drawAndOpen(deckId, k); }
      else if (k === 'shuffle') act(() => { shuffle(d.cards); log(`Se baraja ${d.name}.`); toast(`${esc(d.name)} barajado`); });
      else if (k === 'browse') browse(deckId, false);
      else if (k === 'disc') browse(deckId, false, true);
      else if (k === 'reshuffle') act(() => { d.cards.push(...d.disc.splice(0)); shuffle(d.cards); log(`El descarte de ${d.name} se baraja en el mazo.`); });
      else if (k === 'anom') act(() => { d.anom = !d.anom; log(`${d.name}: ${d.anom ? 'aparece una Anomalía' : 'la Anomalía se estabiliza'}.`); });
      else if (k === 'terr') terrorEncounter(deckId);
      else if (k === 'invback') act(() => { const ids = d.cards.splice(0); for (const id of ids) place(id, 'AR', 'top'); deck('AR').cards.sort((a, b) => CARDS[a].n - CARDS[b].n); delete S.decks.INV; log(`El mazo de Investigación vuelve al Archivo (${ids.length} cartas).`); });
      else if (k === 'remove') confirmModal(`¿Quitar ${esc(d.name)} del tablero?`, 'Se retiran del juego sus cartas de Encuentro y sus cartas de Evento del mazo de Eventos (no del descarte); luego se baraja el mazo de Eventos.', () => act(() => {
        const ev = deck('EV'); const gone = ev.cards.filter((x) => CARDS[x].nb === d.name);
        ev.cards = shuffle(ev.cards.filter((x) => CARDS[x].nb !== d.name));
        delete S.decks[deckId]; S.order = S.order.filter((x) => x !== deckId);
        log(`${d.name} se quita del tablero (${gone.length} Eventos retirados; se baraja el mazo de Eventos).`);
      }));
    });
  }

  function browse(deckId, isArchive, disc = false) {
    const d = deck(deckId);
    const list = disc ? [...d.disc].reverse() : d.cards;
    const go = () => openModal(`<div class="mbox wide"><div class="mhead"><div style="flex:1"><h3>${esc(d.name)}${disc ? ' · descarte' : ''}</h3><div class="sub">${isArchive ? 'Toca una carta para verla.' : disc ? 'La primera es la última descartada.' : 'En orden, de arriba a abajo. Toca una carta para sacarla a la mano.'}</div></div><button class="iconbtn" data-x>✕</button></div>
      <div class="thumbs">${list.map((id, i) => `<div class="t" data-pick="${id}"><img src="${face(id)}" loading="lazy" alt=""><span>${CARDS[id].k === 'ar' ? CARDS[id].n : i + 1}</span></div>`).join('')}</div></div>`,
      (e) => {
        const t = e.target.closest('[data-pick]'); if (!t) return;
        const id = +t.dataset.pick; closeModal();
        if (isArchive || disc) openCard(id);
        else { act(() => { removeEverywhere(id); S.pending.push({ id, from: deckId }); log(`Se busca y saca de ${d.name}: ${cardLabel(id)}.`); }); openCard(id, { fresh: true }); }
      });
    if (!isArchive && !disc && d.kind !== 'ar') confirmModal('¿Mirar el mazo?', 'Vas a ver el contenido y el orden del mazo (spoilers).', go, 'Mirar');
    else go();
  }

  // Nombres de cartas (Objetos, Aliados, Hechizos, especiales, Monstruos, Estados) en inglés.
  const EN = window.AH_ES2EN || {};
  // Los nombres con artículo (arcanos del tarot: «La Luna», «La Torre»…) sólo cuentan tras «carta».
  // Términos de reglas (glosario oficial en inglés).
  const TERMS = {
    'Objeto Común': 'Common Item', 'Objeto Extraordinario': 'Unique Item', 'Restos': 'Remnants', 'Rezagado': 'Delayed',
    'Concentración': 'Focus', 'Retribución': 'Reckoning', 'Transeúnte': 'Bystander', 'Monstruo épico': 'Epic Monster',
    'Talento': 'Talent', 'Aliado': 'Ally', 'Hechizo': 'Spell', 'Espacio inestable': 'Unstable space', 'Estallido de portal': 'Gate Burst',
    'Salvaguarda': 'Ward', 'Anomalía': 'Anomaly', 'Códice': 'Codex', 'Archivo': 'Archive', 'Titular': 'Headline',
    'Catálogo': 'Reserve', 'Reserva de Mitos': 'Mythos cup', 'Pista': 'Clue', 'Perdición': 'Doom', 'Cordura': 'Sanity',
    'Vida': 'Health', 'Daño': 'Damage', 'Saber': 'Lore', 'Influencia': 'Influence', 'Observación': 'Observation',
    'Fuerza': 'Strength', 'Voluntad': 'Will', 'Descomunal': 'Massive', 'Élite': 'Elite', 'Sectario': 'Cultist',
  };
  const mkKeys = (dict) => Object.keys(dict).filter((k) => k.length >= 4).map((k) => {
    const body = fold(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pre = /^(la|el|los|las) /i.test(k) ? 'cartas? ' : '(^|[^\\p{L}])';
    return [k, new RegExp(`${pre}${body}(?:es|s)?(?=$|[^\\p{L}])`, 'u')];
  });
  const EN_KEYS = mkKeys(EN);
  const TERM_KEYS = mkKeys(TERMS);
  function englishHTML(c) {
    if (!c.t) return '';
    const txt = fold(c.t);
    const find = (keys) => { const hits = []; for (const [k, re] of keys) if (re.test(txt) && !hits.some((h) => fold(h).includes(fold(k)))) hits.push(k); return hits; };
    const names = find(EN_KEYS);
    const terms = find(TERM_KEYS).filter((k) => !names.some((n) => fold(n).includes(fold(k))));
    if (!names.length && !terms.length) return '';
    return `<div class="note en" style="margin:0 0 10px">${names.length ? `<b>En inglés:</b> ${names.map((k) => `${esc(k)} → <i>${esc(EN[k])}</i>`).join(' · ')}` : ''}
      ${terms.length ? `<div class="terms">${terms.map((k) => `${esc(k)} → <i>${esc(TERMS[k])}</i>`).join(' · ')}</div>` : ''}</div>`;
  }

  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
  function archiveSearch(q) {
    const f = fold(q).trim(); if (f.length < 3) { toast('Escribe al menos 3 letras.'); return; }
    const hits = window.AH_CARDS.filter((c) => c.k === 'ar' && fold(c.t).includes(f)).sort((a, b) => a.n - b.n);
    openModal(`<div class="mbox wide"><div class="mhead"><div style="flex:1"><h3>«${esc(q)}» en el Archivo</h3><div class="sub">${hits.length} coincidencias (texto leído por OCR: puede fallar alguna letra).</div></div><button class="iconbtn" data-x>✕</button></div>
      <div class="thumbs">${hits.map((c) => `<div class="t" data-pick="${c.id}"><img src="${face(c.id)}" loading="lazy" alt=""><span>${c.n}</span></div>`).join('')}</div></div>`,
      (e) => { const t = e.target.closest('[data-pick]'); if (t) { closeModal(); openCard(+t.dataset.pick); } });
  }

  function archRange(a, b) {
    if (!a || !b) return null;
    if (a > b) [a, b] = [b, a];
    return deck('AR').cards.filter((id) => CARDS[id].n >= a && CARDS[id].n <= b);
  }
  function archiveDraw(k, a, b, hidden) {
    const pool = archRange(a, b);
    if (!pool) { toast('Indica el rango de cartas (desde / hasta).'); return; }
    if (pool.length < k) { toast(`Sólo hay ${pool.length} carta(s) de ese rango en el Archivo.`); return; }
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const picks = shuffle([...pool]).slice(0, k);
    act(() => {
      for (const id of picks) {
        removeEverywhere(id);
        if (hidden) { S.codex.push(id); S.hid = S.hid || {}; S.hid[id] = true; }
        else S.pending.push({ id, from: 'AR' });
      }
      log(`Sorteo del Archivo: ${k} al azar entre ${lo} y ${hi}${hidden ? ' (boca abajo en el Códice, sin mirar)' : `: ${picks.map((id) => CARDS[id].n).join(', ')}`}.`);
    });
    if (hidden) { toast(`${k} carta(s) boca abajo en el Códice`); return; }
    if (picks.length === 1) { openCard(picks[0], { fresh: true, info: `Sorteada al azar entre las cartas ${lo}–${hi}. Las demás siguen en el Archivo.` }); return; }
    openModal(`<div class="mbox wide"><div class="mhead"><div style="flex:1"><h3>Cartas sorteadas</h3><div class="sub">${picks.map((id) => CARDS[id].n).join(', ')} · las demás siguen en el Archivo</div></div><button class="iconbtn" data-x>✕</button></div>
      <div class="thumbs">${picks.map((id) => `<div class="t" data-pick="${id}"><img src="${face(id)}" alt=""><span>${CARDS[id].n}</span></div>`).join('')}</div>
      <div class="actions"><button class="btn gold full" data-all>Añadir todas al Códice</button></div></div>`,
      (e) => {
        if (e.target.closest('[data-all]')) { closeModal(); act(() => { for (const id of picks) { removeEverywhere(id); S.codex.push(id); } log(`Cartas ${picks.map((id) => CARDS[id].n).join(', ')} se añaden al Códice.`); }); return; }
        const t = e.target.closest('[data-pick]'); if (t) { closeModal(); openCard(+t.dataset.pick); }
      }, () => { if (picks.some((id) => S.pending.some((x) => x.id === id))) undo('Sorteo cancelado: las cartas volvieron al Archivo'); });
  }
  function makeInvestigation(a, b) {
    const pool = archRange(a, b);
    if (!pool || !pool.length) { toast('No hay cartas de ese rango en el Archivo.'); return; }
    act(() => {
      for (const id of pool) removeEverywhere(id);
      if (!S.decks.INV) S.decks.INV = mkDeck('INV', 'Mazo de Investigación', 'inv', []);
      S.decks.INV.cards.push(...pool); shuffle(S.decks.INV.cards);
      log(`Mazo de Investigación creado con las cartas ${Math.min(a, b)}–${Math.max(a, b)} (${pool.length}), barajado.`);
    });
    toast('Mazo de Investigación listo (en «Otros mazos»)');
  }

  function addDeckModal() {
    const all = [...new Set(window.AH_CARDS.filter((c) => c.k === 'nb').map((c) => c.d))].sort();
    const avail = all.filter((n) => !S.decks['E:' + n]);
    openModal(`<div class="mbox"><div class="mhead"><h3>Añadir mazo de Encuentros</h3><button class="iconbtn" data-x>✕</button></div>
      <p class="muted">Se baraja y entra en juego (p. ej. cuando el Códice añade un módulo al tablero).</p>
      <div class="targets">${avail.map((n) => `<button class="btn" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>`,
      (e) => { const b = e.target.closest('[data-n]'); if (!b) return; closeModal(); const n = b.dataset.n; if (S.aside?.includes(n)) bringAside(n); else act(() => addEncounterDeck(n)); });
  }

  function mainMenu() {
    openModal(`<div class="mbox"><div class="mhead"><h3>Menú</h3><button class="iconbtn" data-x>✕</button></div>
      <div class="menu">
        <button class="btn" data-k="save">Guardar partida con nombre…</button>
        <button class="btn" data-k="export">Exportar partida a archivo (.json)</button>
        <button class="btn" data-k="import">Importar partida desde archivo</button>
        <button class="btn" data-k="notes">Preparación del escenario</button>
        <button class="btn" data-k="topn">Mezclar «entre las N primeras»: N = ${S.n}</button>
        <button class="btn" data-k="home">Volver al inicio (la partida queda guardada)</button>
      </div>${langChips()}</div>`, (e) => {
      const lb = e.target.closest('[data-lang]');
      if (lb) { lsSet(LS_LANG, lb.dataset.lang); closeModal(); render(); return; }
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'save') saveNamed();
      else if (k === 'export') { exportGame(); closeModal(); }
      else if (k === 'import') { closeModal(); $('#importFile').click(); }
      else if (k === 'notes') { const sc = SCEN.find((x) => x.id === S.scen); showSetupSummary(sc); }
      else if (k === 'topn') { S.n = S.n >= 4 ? 2 : S.n + 1; persist(); mainMenu(); }
      else if (k === 'home') { closeModal(); ui.screen = 'home'; render(); }
    });
  }

  function sheetModal() {
    const sc = SCEN.find((x) => x.id === S.scen);
    openModal(`<div class="mbox wide"><div class="mhead"><h3>${esc(sc.name)}</h3><button class="iconbtn" data-x>✕</button></div>
      <img class="sheet-img" src="img/s/${sc.sheet}a.webp" alt="Anverso"><img class="sheet-img" src="img/s/${sc.sheet}b.webp" alt="Reverso"></div>`);
  }

  function monstersHTML(sc) {
    const M = (window.AH_MONSTERS || {})[sc.id]; if (!M) return '';
    const en = nbLang() === 'en';
    const nm = (m) => (en ? m.en : m.es);
    const key = (m) => nm(m).replace(/^[^\p{L}]+/u, '').toLowerCase();
    const list = (arr) => [...arr].sort((x, y) => key(x).localeCompare(key(y), 'es')).map((m) => `<li>${esc(nm(m))}${m.q > 1 ? ` <b>×${m.q}</b>` : ''}</li>`).join('');
    const tot = (arr) => arr.reduce((t, m) => t + m.q, 0);
    return `<details class="panel mons" open><summary><b>Monstruos</b> <span class="muted">(${tot(M.deck)} cartas${M.aside.length ? ` + ${tot(M.aside)} apartadas` : ''})</span></summary>
      <ul class="monlist">${list(M.deck)}</ul>
      ${M.aside.length ? `<div class="muted" style="margin-top:6px">Apartados al inicio:</div><ul class="monlist">${list(M.aside)}</ul>` : ''}
      <div class="muted" style="font-size:.8rem;margin-top:4px">Incluye los que se colocan en el tablero al empezar.</div></details>`;
  }
  function showSetupSummary(sc, clues, doom) {
    let h = `<div class="mbox"><div class="mhead"><h3>Preparación · ${esc(sc.name)}</h3><button class="iconbtn" data-x>✕</button></div>
      <div class="panel"><ul style="margin:0;padding-left:1.1em">${sc.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
      ${monstersHTML(sc)}`;
    if (clues) {
      h += `<div class="note"><b>Pistas iniciales:</b> ${clues.filter(Boolean).map((c) => esc(c.nb || '¿?')).join(', ')}. Coloca una ficha de Pista en cada uno de esos Barrios (los Eventos ya están mezclados en sus mazos).</div>`;
    }
    if (doom != null) {
      h += `<div class="note warn"><b>La Perdición se propaga una vez en ${esc(CARDS[doom].nb || '¿?')}:</b> coloca 1 Perdición en el espacio marcado con el icono de Perdición (además de la Perdición inicial de la hoja de Escenario).</div>
        <div class="pair"><img src="${back(doom)}" alt="Dorso"><img src="${face(doom)}" alt="Frente"></div>`;
    }
    h += `<div class="actions"><button class="btn" data-k="sheet">Ver hoja de escenario</button><button class="btn primary" data-x>Empezar</button></div></div>`;
    openModal(h, (e) => { if (e.target.closest('[data-k=sheet]')) sheetModal(); });
  }

  // ---------- guardado ----------
  function saveNamed() {
    const saves = lsGet(LS_SAVES, []);
    const name = `${S.name} · ${new Date().toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}`;
    saves.unshift({ name, t: Date.now(), data: S });
    if (!lsSet(LS_SAVES, saves.slice(0, 30))) { toast('No se pudo guardar (almacenamiento lleno).'); return; }
    closeModal(); toast('Partida guardada');
  }
  function exportGame() {
    const blob = new Blob([JSON.stringify({ app: 'arkham-mazos', v: 1, state: S }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `arkham-${S.scen}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Partida exportada');
  }
  $('#importFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const st = j.state || j;
      if (!st.decks || !st.scen) throw new Error('formato');
      S = st; H = []; ui.screen = 'game'; persist(); render(); toast('Partida importada');
    } catch { toast('El archivo no es una partida válida.'); }
    e.target.value = '';
  };

  // ---------- inicio ----------
  function homeHTML() {
    const cur = lsGet(LS_CUR, null);
    const saves = lsGet(LS_SAVES, []);
    const boxes = [...new Set(SCEN.map((s) => s.box))];
    return `<div class="hero"><span class="sign"><img src="img/logo.svg" alt="Arkham Horror"></span><p>Tercera edición · mazos de Encuentro, Eventos, Titulares, Anomalías, Terror y Archivo</p></div>
      <main class="main">
        ${cur ? `<h2 class="sec">Continuar</h2><div class="panel save"><div class="info"><b>${esc(cur.name)}</b><div class="muted">${cur.log.length} acciones · ${cur.log[0] ? timeStr(cur.log[0].t) : ''}</div></div><button class="btn primary" data-k="continue">Continuar</button></div>` : ''}
        ${boxes.map((b) => `<h2 class="sec">${esc(b)}</h2><div class="scgrid">${SCEN.filter((s) => s.box === b).map((s) => `
          <button class="sc" data-sc="${s.id}"><div class="img" style="background-image:url(img/s/${s.sheet}a.webp)"></div>
          <div class="t"><b>${esc(s.name)}</b><small>${s.nbs.length} mazos de encuentro${s.anomaly ? ' · Anomalías' : ''}${s.terror ? ' · Terror' : ''}${s.invest ? ' · Investigación' : ''}</small></div></button>`).join('')}</div>`).join('')}
        <h2 class="sec">Idioma</h2>${langChips()}
        <h2 class="sec">Partidas guardadas</h2>
        <div class="saves">${saves.length ? saves.map((s, i) => `<div class="panel save"><div class="info"><b>${esc(s.name)}</b><div class="muted">${s.data.log.length} acciones</div></div><button class="btn" data-load="${i}">Cargar</button><button class="btn" data-del="${i}">✕</button></div>`).join('') : '<p class="muted">Todavía no hay partidas guardadas con nombre.</p>'}
          <div class="row"><button class="btn" data-k="import">Importar partida (.json)</button></div></div>
      </main>`;
  }
  function bindHome() {
    $('#app').onclick = (e) => {
      const lb = e.target.closest('[data-lang]');
      if (lb) { lsSet(LS_LANG, lb.dataset.lang); render(); return; }
      const t = e.target.closest('[data-sc],[data-k],[data-load],[data-del]'); if (!t) return;
      if (t.dataset.sc) {
        const sc = SCEN.find((x) => x.id === t.dataset.sc);
        const cur = lsGet(LS_CUR, null);
        openModal(`<div class="mbox"><div class="mhead"><h3>${esc(sc.name)}</h3><button class="iconbtn" data-x>✕</button></div>
          <div class="panel" style="margin-bottom:10px"><b>Mazos de encuentro:</b> ${sc.nbs.map(esc).join(' · ')}${sc.aside ? `<br><span class="muted">Apartados: ${sc.aside.map(esc).join(' · ')}</span>` : ''}</div>
          ${monstersHTML(sc).replace('<details class="panel mons" open>', '<details class="panel mons" style="margin-bottom:10px">')}
          <img class="sheet-img" src="img/s/${sc.sheet}b.webp" alt="">
          ${cur ? '<div class="note warn">Empezar reemplaza la partida en curso (guárdala antes con nombre si la quieres conservar).</div>' : ''}
          <div class="actions"><button class="btn" data-x>Cancelar</button><button class="btn primary" data-go>Preparar partida</button></div></div>`,
          (e2) => { if (e2.target.closest('[data-go]')) { closeModal(); newGame(sc); } });
      } else if (t.dataset.k === 'continue') { S = lsGet(LS_CUR, null); H = lsGet(LS_HIST, []); ui.screen = 'game'; render(); }
      else if (t.dataset.k === 'import') $('#importFile').click();
      else if (t.dataset.load) { const s = lsGet(LS_SAVES, [])[+t.dataset.load]; S = s.data; H = []; ui.screen = 'game'; persist(); render(); }
      else if (t.dataset.del) { const saves = lsGet(LS_SAVES, []); const s = saves[+t.dataset.del]; confirmModal('¿Borrar partida guardada?', esc(s.name), () => { saves.splice(+t.dataset.del, 1); lsSet(LS_SAVES, saves); render(); }, 'Borrar'); }
    };
  }

  // ---------- nombres de barrios en inglés ----------
  const NB_EN = {
    'Barrio Este': 'Easttown', 'Barrio Fluvial': 'Rivertown', 'Centro': 'Downtown', 'Periferia': 'Uptown',
    'Distrito Comercial': 'Merchant District', 'Barrio Norte': 'Northside', 'Barrio Sur': 'Southside',
    'Universidad Miskatonic': 'Miskatonic University', 'Calles': 'Streets', 'Centro de Kingsport': 'Central Kingsport',
    'Puerto de Kingsport': 'Kingsport Harbor', 'Costa de Innsmouth': 'Innsmouth Shore', 'Pueblo de Innsmouth': 'Innsmouth Village',
    'El Mundo Subterráneo': 'The Underworld', 'Mundo subterráneo': 'The Underworld', 'La Casa de la Bruja': 'Witch House',
    'Lo Innombrable': 'The Unnamable', 'La extraña Casa en la Niebla': 'Strange High House', 'Arrecife del Diablo': 'Devil Reef',
    'Ruta de Viaje': 'Travel Routes', 'Umbrales': 'Thresholds',
  };
  const NB_RE = new RegExp('(?<!\\p{L})(' + Object.keys(NB_EN).sort((a, b) => b.length - a.length).join('|') + ')(?!\\p{L})(?! \\()', 'gu');
  const doneText = new WeakSet();
  function nbLang() { return lsGet(LS_LANG, 'es'); }
  function langChips() {
    const l = nbLang();
    return `<div class="chips"><span class="muted" style="align-self:center">Nombres de barrios:</span><button class="chip ${l === 'es' ? 'on' : ''}" data-lang="es">Español</button><button class="chip ${l === 'en' ? 'on' : ''}" data-lang="en">English</button></div>`;
  }
  function addEnglish(root) {
    if (!root) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (tw.nextNode()) nodes.push(tw.currentNode);
    for (const t of nodes) {
      if (doneText.has(t) || /^(SCRIPT|STYLE|TEXTAREA)$/.test(t.parentNode?.nodeName)) continue;
      if (nbLang() !== 'en') { doneText.add(t); continue; }
      const v = t.data.replace(NB_RE, (m) => NB_EN[m]);
      if (v !== t.data) t.data = v;
      doneText.add(t);
    }
  }
  new MutationObserver(() => { addEnglish($('#app')); addEnglish($('#modal')); addEnglish($('#toast')); })
    .observe(document.body, { childList: true, subtree: true, characterData: false });

  // ---------- modal / toast ----------
  // onDismiss sólo se ejecuta si el usuario cierra sin elegir (✕, tocar afuera o Escape).
  let modalHandler = null, modalDismiss = null;
  function openModal(html, handler, onDismiss) {
    const m = $('#modal'); m.innerHTML = html; m.hidden = false; modalHandler = handler || null; modalDismiss = onDismiss || null;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; modalHandler = null; modalDismiss = null; document.body.style.overflow = ''; }
  function dismissModal() { const f = modalDismiss; closeModal(); if (f) f(); }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-x]') || e.target.id === 'modal') { dismissModal(); return; }
    if (modalHandler) modalHandler(e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) dismissModal();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && ui.screen === 'game' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); undo(); }
  });
  function alertModal(title, html) { openModal(`<div class="mbox"><div class="mhead"><h3>${esc(title)}</h3></div><div class="note warn">${html}</div><div class="actions"><button class="btn primary full" data-x>Entendido</button></div></div>`); }
  function confirmModal(title, html, onOk, okLabel = 'Confirmar') {
    openModal(`<div class="mbox"><div class="mhead"><h3>${title}</h3></div><p>${html}</p><div class="actions"><button class="btn" data-x>Cancelar</button><button class="btn primary" data-ok>${okLabel}</button></div></div>`,
      (e) => { if (e.target.closest('[data-ok]')) { closeModal(); onOk(); } });
  }
  function viewImage(src, title) { openModal(`<div class="mbox"><div class="mhead"><h3>${esc(title)}</h3><button class="iconbtn" data-x>✕</button></div><img src="${src}" style="width:min(100%,420px);margin:auto;border-radius:10px" alt=""></div>`); }
  let toastT = null;
  function toast(html, img) {
    const t = $('#toast'); t.innerHTML = `${img ? `<img src="${img}" alt="">` : ''}<span>${html}</span>`; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // arranque
  const cur = lsGet(LS_CUR, null);
  if (cur) { S = cur; H = lsGet(LS_HIST, []); ui.screen = 'game'; }
  // Atajo: index.html#nuevo=<id de escenario> prepara directamente una partida.
  const hm = location.hash.match(/^#nuevo=([\w-]+)/);
  const hsc = hm && SCEN.find((x) => x.id === hm[1]);
  if (hsc) { history.replaceState(null, '', location.pathname); newGame(hsc); } else render();
})();
