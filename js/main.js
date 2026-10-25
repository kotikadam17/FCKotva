/* ==========================================================================
   FC Kotva – vše se generuje z data/team.json
   ========================================================================== */
(function () {
  'use strict';

  const DATA_URL = 'data/team.json';
  const TZ = 'Europe/Prague';
  const DAY_NAMES = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ANCHOR_SVG = '<svg aria-hidden="true" focusable="false"><use href="#i-anchor"/></svg>';
  const icon = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;

  const KIT_COLORS = {
    'černá': '#111111', 'bílá': '#FFFFFF', 'modrá': '#1F4FD1', 'světle modrá': '#6CB4EE',
    'tmavě modrá': '#14275E', 'oranžová': '#F28C28', 'růžová': '#F49AC1', 'vínová': '#7A1F2B',
    'červená': '#D7262E', 'zelená': '#1E9E4A', 'žlutá': '#F5D000', 'šedá': '#8A8A8A',
    'zlatá': '#F2C12E', 'fialová': '#6B3FA0', 'hnědá': '#6B4423', 'tyrkysová': '#1CB5B0'
  };

  let D = null;              // načtená data
  let playersBySlug = {};

  // ---------- Pomocné funkce ----------

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  function plural(n, one, few, many) {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
  }

  const goalsWord = (n) => plural(n, 'gól', 'góly', 'gólů');

  // ---------- Čas: Europe/Prague včetně přechodu letní/zimní čas ----------

  // Fallback podle pravidel EU: letní čas od poslední neděle v březnu 01:00 UTC
  // do poslední neděle v říjnu 01:00 UTC.
  function lastSundayUtc(year, month) {
    const d = new Date(Date.UTC(year, month + 1, 0, 1, 0));
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.getTime();
  }
  function euOffsetMinutes(utcMs) {
    const y = new Date(utcMs).getUTCFullYear();
    return utcMs >= lastSundayUtc(y, 2) && utcMs < lastSundayUtc(y, 9) ? 120 : 60;
  }

  let pragueFmt = null;
  try {
    pragueFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
    });
  } catch (e) { pragueFmt = null; }

  // Posun Prahy vůči UTC (v minutách) v daném okamžiku.
  function pragueOffsetMinutes(utcMs) {
    if (!pragueFmt) return euOffsetMinutes(utcMs);
    const p = {};
    pragueFmt.formatToParts(new Date(utcMs)).forEach((x) => { p[x.type] = x.value; });
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000);
  }

  // "2026-10-30" + "19:15" (pražský místní čas) -> Date (skutečný okamžik)
  function pragueToDate(dateStr, timeStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
    const naive = Date.UTC(y, m - 1, d, hh, mm);
    let t = naive - pragueOffsetMinutes(naive) * 60000;
    t = naive - pragueOffsetMinutes(t) * 60000;
    return new Date(t);
  }

  function formatDate(dateStr, withYear = true) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const wd = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${wd} ${d}. ${m}.${withYear ? ' ' + y : ''}`;
  }

  // ---------- Zápasy z pohledu Kotvy ----------

  const isUs = (name) => name === D.team.psmfName;
  const durationMs = () => (D.team.matchDurationMinutes || 70) * 60000;

  function view(m) {
    const home = isUs(m.home);
    const start = pragueToDate(m.date, m.time);
    const usColors = home ? m.homeColors : m.awayColors;
    const v = {
      m, start, end: new Date(start.getTime() + durationMs()),
      home, opponent: home ? m.away : m.home,
      usColors: usColors && usColors.length ? usColors : D.team.colors,
      oppColors: (home ? m.awayColors : m.homeColors) || []
    };
    if (m.score) {
      v.gf = home ? m.score[0] : m.score[1];
      v.ga = home ? m.score[1] : m.score[0];
      v.outcome = v.gf > v.ga ? 'W' : v.gf < v.ga ? 'L' : 'D';
    }
    return v;
  }

  const OUTCOME = {
    W: { short: 'V', long: 'Výhra' },
    D: { short: 'R', long: 'Remíza' },
    L: { short: 'P', long: 'Prohra' }
  };

  function playedMatches() {
    return D.matches.filter((m) => Array.isArray(m.score)).map(view)
      .sort((a, b) => a.start - b.start);
  }
  function upcomingMatches() {
    return D.matches.filter((m) => !Array.isArray(m.score)).map(view)
      .sort((a, b) => a.start - b.start);
  }

  // Nejbližší zápas, který ještě neskončil (start + délka zápasu).
  function currentMatch(now) {
    return upcomingMatches().find((v) => now < v.end.getTime()) || null;
  }

  // ---------- Fallbacky obrázků ----------

  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
    const box = img.parentElement;
    switch (img.dataset.fallback) {
      case 'logo':
        box.classList.add('logo--fallback');
        box.setAttribute('role', 'img');
        box.setAttribute('aria-label', img.alt || 'FC Kotva');
        box.innerHTML = ANCHOR_SVG;
        break;
      case 'initials':
        // náhradní fotka (např. týmová místo instagramové), jinak zůstanou iniciály
        if (img.dataset.fallbackSrc) {
          img.src = img.dataset.fallbackSrc;
          delete img.dataset.fallbackSrc;
        } else {
          img.remove(); // iniciály pod fotkou jsou vidět od začátku
        }
        break;
      case 'photo': {
        const ph = document.createElement('div');
        ph.className = 'ph';
        ph.style.aspectRatio = img.dataset.ratio || '4 / 3';
        ph.setAttribute('role', 'img');
        ph.setAttribute('aria-label', (img.alt || 'Fotka') + ' (fotka zatím chybí)');
        ph.innerHTML = '<img src="assets/logo.png" alt="" aria-hidden="true">';
        img.replaceWith(ph);
        break;
      }
    }
  }, true);

  // fotku hráče ukázat až po načtení (jinak by během načítání probleskla ikona rozbitého obrázku)
  document.addEventListener('load', (e) => {
    if (e.target instanceof HTMLImageElement && e.target.dataset.fallback === 'initials') e.target.classList.add('is-loaded');
  }, true);

  function logoHtml(alt) {
    return `<img src="assets/logo.png" alt="${esc(alt)}" data-fallback="logo">`;
  }

  // iniciály jsou vždy pod fotkou; fotka z assets/players/<slug>.jpg je překryje, až se načte
  function photoHtml(p, cls, alt = '') {
    return `<span class="${cls}"><span class="initials" aria-hidden="true">${esc(initials(p.name))}</span><img src="assets/players/${esc(p.slug)}.jpg" alt="${esc(alt)}" loading="lazy" data-fallback="initials"></span>`;
  }
  const avatarHtml = (p, cls, alt = '') => photoHtml(p, `avatar ${cls || ''}`, alt);

  // profilovka z Instagramu (assets/players/ig/<slug>.jpg); dokud chybí, ukáže se týmová fotka
  function igAvatarHtml(p, cls) {
    const slug = esc(p.slug);
    return `<span class="avatar ${cls}"><span class="initials" aria-hidden="true">${esc(initials(p.name))}</span><img src="assets/players/ig/${slug}.jpg" data-fallback-src="assets/players/${slug}.jpg" alt="" loading="lazy" data-fallback="initials"></span>`;
  }

  function kitsHtml(colors) {
    if (!colors || !colors.length) return '<span class="kits"><span class="kits__label">dresy neuvedeny</span></span>';
    const swatches = colors.map((name) => {
      const parts = name.split('-').map((part) => {
        const key = part.trim().toLowerCase();
        return KIT_COLORS[key] || KIT_COLORS[Object.keys(KIT_COLORS).find((k) => k.startsWith(key.slice(0, 3)))] || '#666';
      });
      const bg = parts.length > 1 ? `linear-gradient(90deg, ${parts[0]} 50%, ${parts[1]} 50%)` : parts[0];
      return `<span class="kit" style="background:${bg}" title="${esc(name)}"></span>`;
    }).join('');
    return `<span class="kits">${swatches}<span class="sr-only">Barvy dresů: ${esc(colors.join(', '))}</span></span>`;
  }

  // ---------- Animace ----------

  function animateCount(node) {
    const target = Number(node.dataset.count);
    if (!Number.isFinite(target)) return;
    if (reduceMotion || target === 0) { node.textContent = target; return; }
    const duration = 1100;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      node.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function observeCounters(root) {
    const nodes = $$('[data-count]', root);
    if (!('IntersectionObserver' in window)) { nodes.forEach(animateCount); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { animateCount(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    nodes.forEach((n) => { n.textContent = '0'; io.observe(n); });
  }

  function initReveal() {
    const nodes = $$('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach((n) => io.observe(n));
  }

  // ---------- Navigace ----------

  function initNav() {
    const toggle = $('.nav__toggle');
    const menu = $('#nav-menu');
    const isOpen = () => menu.classList.contains('is-open');
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      $('.sr-only', toggle).textContent = open ? 'Zavřít menu' : 'Otevřít menu';
      menu.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('menu-open', open); // zamkne scroll stránky pod menu
    };
    toggle.addEventListener('click', () => setOpen(!isOpen()));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') { setOpen(false); toggle.focus(); return; }
      // Tab koluje jen mezi tlačítkem menu a odkazy v něm
      if (e.key === 'Tab') {
        const items = [toggle, ...$$('a', menu)];
        const i = items.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === -1 || i === items.length - 1 ? 0 : i + 1);
        e.preventDefault();
        items[next].focus();
      }
    });
    // po roztažení na desktop menu zavřít (jinak by zůstal zamčený scroll)
    window.matchMedia('(min-width: 960px)').addEventListener('change', (mq) => { if (mq.matches && isOpen()) setOpen(false); });

    // zvýraznění aktivní sekce
    if (!('IntersectionObserver' in window)) return;
    const links = $$('a[href^="#"]', menu);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => {
          const on = a.getAttribute('href') === '#' + en.target.id;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((a) => { const s = document.getElementById(a.getAttribute('href').slice(1)); if (s) io.observe(s); });
  }

  // ---------- Texty a odkazy ----------

  // Poznámka pod tabulkou: bodování + kolik zápasů má Kotva k dobru (počítá se z tabulky),
  // případně doplněná o vlastní text z team.json (tableNote)
  function tableNote() {
    const rows = D.table || [];
    const us = rows.find((r) => isUs(r.team));
    const parts = ['V Hanspaulce je výhra za 2 body, remíza za 1.'];
    if (us) {
      const behind = Math.max(...rows.map((r) => r.played)) - us.played;
      if (behind > 0) {
        let s = `Kotva má o ${behind === 1 ? 'zápas' : behind + ' ' + plural(behind, 'zápas', 'zápasy', 'zápasů')} méně`;
        const postponed = upcomingMatches().find((v) => /odlož/i.test(v.m.round));
        if (postponed) {
          const [, mo, d] = postponed.m.date.split('-').map(Number);
          s += ` – odložené ${postponed.m.round.replace(/\s*\(.*\)/, '')} proti týmu ${postponed.opponent} se dohrává ${d}. ${mo}.`;
        } else s += '.';
        parts.push(s);
      }
    }
    if (D.tableNote) parts.push(D.tableNote);
    return parts.join(' ');
  }

  function renderBindings() {
    const t = D.team;
    const ig = D.instagram;
    const [uy, um, ud] = (D.updated || '').split('-').map(Number);
    const values = {
      leagueLine: `${t.league} · ${t.division} · skupina ${t.group.replace(/^\d+/, '')} · ${t.season}`,
      intro: t.intro,
      group: t.group,
      tableNote: tableNote(),
      igHandle: ig.handle,
      footerLine: `${t.league} · ${t.group} · ${t.season}`,
      footerQuip: t.footerQuip,
      updated: D.updated ? `Data aktualizována ${ud}. ${um}. ${uy}` : ''
    };
    $$('[data-bind]').forEach((node) => {
      const key = node.dataset.bind;
      if (key === 'slogan') {
        node.innerHTML = (t.slogan || []).map((s) => `<li>${esc(s)}</li>`).join('');
      } else if (key === 'igPosts' || key === 'igFollowers') {
        node.dataset.count = key === 'igPosts' ? ig.posts : ig.followers;
      } else if (key in values) {
        node.textContent = values[key];
      }
    });
    $$('[data-ig-link]').forEach((a) => { a.href = ig.url; });
    $$('[data-bind-href="psmfUrl"]').forEach((a) => { a.href = t.psmfUrl; });
    $$('[data-logo]').forEach((box) => { box.innerHTML = logoHtml('Logo FC Kotva'); });
  }

  // ---------- Matchday + odpočet ----------

  let matchdayKey = null;

  function renderMatchday(now) {
    const box = $('#matchday');
    const v = currentMatch(now);
    const live = !!v && now >= v.start.getTime();
    const key = v ? v.m.id + (live ? ':live' : '') : 'none';

    if (key !== matchdayKey) {
      matchdayKey = key;
      if (!v) {
        box.innerHTML = '<p class="empty">Sezóna je dohraná. Kotva teď regeneruje (rozuměj: hospoda). Uvidíme se na jaře! ⚓</p>';
        $('#h2h').innerHTML = '';
      } else {
        box.innerHTML = matchdayHtml(v, live);
        renderH2H(v);
      }
      renderFixtures(now);
    }
    if (v && !live) updateCountdown(v.start.getTime() - now);
  }

  function matchdayHtml(v, live) {
    const m = v.m;
    const us = `<div class="team-badge team-badge--us"><span class="team-badge__name">${esc(D.team.psmfName)}</span>${kitsHtml(v.usColors)}</div>`;
    const them = `<div class="team-badge"><span class="team-badge__name">${esc(v.opponent)}</span>${kitsHtml(v.oppColors)}</div>`;
    const body = live
      ? `<div class="live"><span class="live__dot" aria-hidden="true"></span><span class="live__text">Zápas právě probíhá 🔴</span></div>`
      : `<div class="countdown" role="timer" aria-label="Odpočet do výkopu">
          ${['dní', 'hodin', 'minut', 'sekund'].map((label, i) => `
            <div class="countdown__cell"><span class="countdown__num" data-cd="${i}">00</span><span class="countdown__label">${label}</span></div>`).join('')}
        </div>`;
    return `
      <p class="eyebrow matchday__round">${esc(m.round)} · ${v.home ? 'doma' : 'venku'}</p>
      <div class="matchday__teams">${v.home ? us + '<span class="vs" aria-label="proti">VS</span>' + them : them + '<span class="vs" aria-label="proti">VS</span>' + us}</div>
      ${body}
      <ul class="matchday__meta">
        <li>${icon('calendar')} ${esc(formatDate(m.date))}, ${esc(m.time)}</li>
        <li>${icon('pin')} Hřiště <a href="https://www.psmf.cz/hriste/#${encodeURIComponent(m.venue)}" target="_blank" rel="noopener">${esc(m.venue)}</a></li>
      </ul>`;
  }

  function updateCountdown(diff) {
    const s = Math.max(0, Math.floor(diff / 1000));
    const parts = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
    $$('[data-cd]').forEach((n) => { n.textContent = String(parts[n.dataset.cd]).padStart(2, '0'); });
  }

  // ---------- Head2Head ----------

  function renderH2H(v) {
    const box = $('#h2h');
    const rows = D.table || [];
    const usIdx = rows.findIndex((r) => isUs(r.team));
    const themIdx = rows.findIndex((r) => r.team === v.opponent);
    if (usIdx < 0 || themIdx < 0) { box.innerHTML = ''; return; }
    const a = rows[usIdx], b = rows[themIdx];
    const ppg = (r) => (r.played ? r.points / r.played : 0);
    const metrics = [
      { label: 'Pozice', a: usIdx + 1, b: themIdx + 1, fmt: (x) => x + '.', lowerBetter: true },
      { label: 'Body', a: a.points, b: b.points },
      { label: 'Zápasy', a: a.played, b: b.played, neutral: true },
      { label: 'V–R–P', a: `${a.won}–${a.drawn}–${a.lost}`, b: `${b.won}–${b.drawn}–${b.lost}`, neutral: true },
      { label: 'Skóre', a: `${a.gf}:${a.ga}`, b: `${b.gf}:${b.ga}`, neutral: true },
      { label: 'Rozdíl', a: a.gf - a.ga, b: b.gf - b.ga, fmt: (x) => (x > 0 ? '+' : '') + x },
      { label: 'Body/zápas', a: ppg(a), b: ppg(b), fmt: (x) => x.toFixed(2).replace('.', ',') }
    ];
    const cell = (val, better, fmt) => `<span class="h2h__val${better ? ' is-better' : ''}">${esc(fmt ? fmt(val) : val)}</span>`;
    box.innerHTML = `
      <h3 class="display h2h__title">Head<span class="gold-text">2</span>Head</h3>
      <div class="h2h__grid" role="table" aria-label="Srovnání s ${esc(v.opponent)}">
        <div class="h2h__row" role="row">
          <span class="h2h__name" role="columnheader">${esc(D.team.psmfName)}</span>
          <span class="h2h__label" role="columnheader"><span class="sr-only">Ukazatel</span></span>
          <span class="h2h__name" role="columnheader">${esc(v.opponent)}</span>
        </div>
        ${metrics.map((x) => {
          const aBetter = !x.neutral && (x.lowerBetter ? x.a < x.b : x.a > x.b);
          const bBetter = !x.neutral && (x.lowerBetter ? x.b < x.a : x.b > x.a);
          return `<div class="h2h__row" role="row">
            <span role="cell">${cell(x.a, aBetter, x.fmt)}</span>
            <span class="h2h__label" role="rowheader">${x.label}</span>
            <span role="cell">${cell(x.b, bBetter, x.fmt)}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  // ---------- Bilance + forma ----------

  // ---------- Šampioni – sekce o úspěchu z minulé sezóny ----------
  // text a fotky: team.json → champions; čísla: previousRecord (plní scripts/update.js)

  function renderChampions() {
    const c = D.champions;
    const section = $('#sampioni');
    const navLink = $('.nav__menu a[href="#sampioni"]');
    if (!c) { section.hidden = true; if (navLink) navLink.parentElement.hidden = true; return; }

    const r = D.previousRecord;
    const photos = (c.photos || []).slice(0, 3);
    // postup = minule nižší liga (8I) než teď (7I)
    const promoted = r && r.group && parseInt(r.group, 10) > parseInt(D.team.group, 10);
    const badges = [
      r && r.played > 0 && r.lost === 0 ? 'Bez porážky' : '',
      promoted ? `Postup do ${D.team.division.replace(/liga$/, 'ligy')} ⬆` : ''
    ].filter(Boolean);
    const paragraphs = Array.isArray(c.text) ? c.text : [c.text || ''];

    $('#champions-season').textContent = c.season || D.team.previousSeason || '';
    $('#champions').innerHTML = `
      <div class="champs__photos">
        ${photos.map((g, i) => `
          <button class="champs__photo champs__photo--${i + 1}" type="button" data-index="${i}" aria-haspopup="dialog" aria-label="Zvětšit fotku: ${esc(g.caption)}">
            <img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy" data-fallback="photo"${g.focus ? ` style="object-position: ${esc(g.focus)}"` : ''}>
            ${g.caption ? `<span class="gallery__cap" aria-hidden="true">${esc(g.caption)}</span>` : ''}
          </button>`).join('')}
      </div>
      <div class="champs__body">
        <div class="champs__story">
          <p class="champs__title">🏆 ${esc(c.title)}</p>
          ${badges.length ? `<ul class="champs__badges">${badges.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
          ${paragraphs.filter(Boolean).map((p) => `<p class="champs__text">${esc(p)}</p>`).join('')}
        </div>
        ${r ? `
        <dl class="champs__stats">
          <div class="champs__stat--big"><dt>Umístění</dt><dd><span data-count="${r.place}">${r.place}</span>.<small> z ${r.teams}</small></dd></div>
          <div><dt>Zápasy</dt><dd data-count="${r.played}">${r.played}</dd></div>
          <div><dt>V–R–P</dt><dd>${r.won}–${r.drawn}–${r.lost}</dd></div>
          <div><dt>Skóre</dt><dd>${r.gf}:${r.ga}</dd></div>
          <div><dt>Body</dt><dd data-count="${r.points}">${r.points}</dd></div>
        </dl>` : ''}
      </div>`;

    $('#champions').addEventListener('click', (e) => {
      const item = e.target.closest('[data-index]');
      if (item) openLightbox(photos, Number(item.dataset.index));
    });
  }

  function renderStats() {
    const played = playedMatches();
    const w = played.filter((v) => v.outcome === 'W').length;
    const d = played.filter((v) => v.outcome === 'D').length;
    const l = played.filter((v) => v.outcome === 'L').length;
    const gf = played.reduce((s, v) => s + v.gf, 0);
    const ga = played.reduce((s, v) => s + v.ga, 0);
    const pts = w * 2 + d;
    const pos = (D.table || []).findIndex((r) => isUs(r.team)) + 1;

    const tile = (num, label, gold) =>
      `<div class="stat${gold ? ' stat--gold' : ''}"><span class="stat__num">${num}</span><span class="stat__label">${label}</span></div>`;
    const n = (x) => `<span data-count="${x}">${x}</span>`;

    $('#stats').innerHTML = [
      tile(n(played.length), 'Zápasy'),
      tile(n(w), 'Výhry'),
      tile(n(d), 'Remízy'),
      tile(n(l), 'Prohry'),
      tile(`${n(gf)}:${n(ga)}<span class="stat__sub">rozdíl ${gf - ga > 0 ? '+' : ''}${gf - ga}</span>`, 'Skóre'),
      tile(n(pts), 'Body', true),
      pos ? tile(`${n(pos)}.`, 'Pozice', true) : ''
    ].join('');

    const last5 = played.slice(-5);
    $('#form').innerHTML = last5.length ? `
      <span class="form__label" id="form-label">Forma (posledních ${last5.length}, nejnovější vpravo)</span>
      <ol class="form__dots" aria-labelledby="form-label">
        ${last5.map((v) => {
          const desc = `${OUTCOME[v.outcome].long} ${v.gf}:${v.ga} s ${v.opponent} (${formatDate(v.m.date, false)})`;
          return `<li class="dot dot--${v.outcome}" title="${esc(desc)}"><span aria-hidden="true">${OUTCOME[v.outcome].short}</span><span class="sr-only">${esc(desc)}</span></li>`;
        }).join('')}
      </ol>` : '';
  }

  // ---------- Tabulka ----------

  function renderTable() {
    const rows = D.table || [];
    $('#table').innerHTML = `
      <table class="league-table">
        <caption class="sr-only">Tabulka skupiny ${esc(D.team.group)}</caption>
        <thead><tr>
          <th scope="col" class="pos"><abbr title="Pořadí">#</abbr></th>
          <th scope="col" class="team">Tým</th>
          <th scope="col"><abbr title="Zápasy">Z</abbr></th>
          <th scope="col" class="col-sm-hide"><abbr title="Výhry">V</abbr></th>
          <th scope="col" class="col-sm-hide"><abbr title="Remízy">R</abbr></th>
          <th scope="col" class="col-sm-hide"><abbr title="Prohry">P</abbr></th>
          <th scope="col">Skóre</th>
          <th scope="col"><abbr title="Body">B</abbr></th>
        </tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr${isUs(r.team) ? ' class="is-us" aria-current="true"' : ''}>
              <td class="pos">${i + 1}.</td>
              <td class="team">${esc(r.team)}</td>
              <td>${r.played}</td>
              <td class="col-sm-hide">${r.won}</td>
              <td class="col-sm-hide">${r.drawn}</td>
              <td class="col-sm-hide">${r.lost}</td>
              <td>${r.gf}:${r.ga}</td>
              <td class="pts">${r.points}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ---------- Hráči – společné prvky ----------

  const hasValue = (x) => x !== null && x !== undefined && x !== '';
  const placeholder = (txt = 'doplníme') => `<span class="ph-text">${txt}</span>`;
  const perMatch = (goals, apps) => (apps ? (goals / apps).toFixed(2).replace('.', ',') : '–');

  // jméno ve dvou řádcích: malé křestní, velké příjmení
  // (mezera mezi spany je kvůli čtečkám – ve flexu se vizuálně neprojeví)
  function nameHtml(p) {
    const parts = p.name.split(' ');
    const last = parts.pop();
    return `<span class="pname"><span class="pname__first">${esc(parts.join(' '))}</span> <span class="pname__last">${esc(last)}</span></span>`;
  }

  function igUrl(value) {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return `https://www.instagram.com/${encodeURIComponent(value.replace(/^@/, ''))}/`;
  }
  function igHandle(value) {
    const m = String(value).match(/instagram\.com\/([^/?#]+)/i);
    return '@' + (m ? m[1] : String(value).replace(/^@/, ''));
  }

  const isKeeper = (p) => /brank/i.test(p.position);
  // obdržené góly v zápasech, kde hráč chytal (match.goalkeeper)
  const conceded = (p) => playedMatches().filter((v) => v.m.goalkeeper === p.slug).reduce((sum, v) => sum + v.ga, 0);

  // pořadí hráčů v kádru (brankáři první, pak podle gólů)
  // Kádr jako sestava na hřišti: útok nahoře, brankář dole
  const SQUAD_LINES = [
    { title: 'Útočníci', match: /útoč/i },
    { title: 'Záložníci', match: /zálo/i },
    { title: 'Obránci', match: /obrán/i },
    { title: 'Brankář', match: /brank/i },
  ];
  const lineIndex = (p) => {
    const i = SQUAD_LINES.findIndex((l) => l.match.test(p.position || ''));
    return i < 0 ? SQUAD_LINES.length : i;
  };

  function squadOrder() {
    return D.players.slice().sort((a, b) => lineIndex(a) - lineIndex(b)
      || (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'cs'));
  }

  // ---------- Střelci ----------

  function rankedScorers() {
    const list = D.players.filter((p) => p.goals > 0)
      .sort((a, b) => b.goals - a.goals || a.apps - b.apps || a.name.localeCompare(b.name, 'cs'));
    // „Sportovní“ pořadí: při shodě stejné místo, další místo se přeskočí (1, 2, 3, 3, 3, 6…)
    return list.map((p) => ({ p, rank: 1 + list.filter((q) => q.goals > p.goals).length }));
  }

  function renderScorers() {
    const ranked = rankedScorers();
    const steps = [2, 1, 3].map((rank) => ({ rank, list: ranked.filter((x) => x.rank === rank) }))
      .filter((s) => s.list.length);
    const podium = $('#podium');
    podium.style.setProperty('--cols', steps.length || 1);

    podium.innerHTML = steps.map((s) => {
      const goals = s.list[0].p.goals;
      const shared = s.list.length > 1;
      return `
        <div class="podium__col podium__col--${s.rank}${shared ? ' is-shared' : ''}">
          <ul class="podium__people" role="list">
            ${s.list.map(({ p }) => `
              <li><button class="podium__person" type="button" data-player="${esc(p.slug)}" aria-haspopup="dialog">
                ${avatarHtml(p, 'podium__avatar')}${nameHtml(p)}
              </button></li>`).join('')}
          </ul>
          <div class="podium__block">
            <span class="podium__rank" aria-hidden="true">${s.rank}</span>
            <span class="sr-only">${s.rank}. místo${shared ? ' (dělené)' : ''}</span>
            <span class="podium__goals"><b data-count="${goals}">${goals}</b> ${goalsWord(goals)}</span>
            ${shared ? `<span class="podium__shared" aria-hidden="true">${s.list.length}× dělené</span>` : ''}
          </div>
        </div>`;
    }).join('') || '<p class="empty">Zatím nikdo neskóroval. To se brzy změní.</p>';

    $('#scorers-table').innerHTML = `
      <table class="league-table scorers-table">
        <caption class="sr-only">Kompletní střelecká tabulka</caption>
        <thead><tr>
          <th scope="col" class="pos">#</th>
          <th scope="col" class="team">Hráč</th>
          <th scope="col"><abbr title="Zápasy">Z</abbr></th>
          <th scope="col">Góly</th>
          <th scope="col" class="col-sm-hide"><abbr title="Góly na zápas">G/Z</abbr></th>
        </tr></thead>
        <tbody>
          ${ranked.map(({ p, rank }) => `
            <tr>
              <td class="pos">${rank}.</td>
              <td class="team"><button class="link-player" type="button" data-player="${esc(p.slug)}" aria-haspopup="dialog">${avatarHtml(p, 'link-player__avatar')}${esc(p.name)}</button></td>
              <td>${p.apps}</td>
              <td class="pts">${p.goals}</td>
              <td class="col-sm-hide">${perMatch(p.goals, p.apps)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ---------- Kádr ----------

  function renderSquad() {
    const order = squadOrder();
    const lines = [...SQUAD_LINES, { title: 'Ostatní' }]
      .map((l, i) => ({ title: l.title, players: order.filter((p) => lineIndex(p) === i) }))
      .filter((l) => l.players.length);
    $('#squad').innerHTML = lines.map((l) => `
      <div class="squad__line">
        <h3 class="squad__title">${esc(l.title)}</h3>
        <div class="squad__cards">${l.players.map(futHtml).join('')}</div>
      </div>`).join('');
  }

  function futHtml(p) {
    return `
      <button class="fut" type="button" data-player="${esc(p.slug)}" aria-haspopup="dialog" aria-label="Profil hráče ${esc(p.name)}">
        ${photoHtml(p, 'fut__photo photo')}
        <span class="fut__body">
          <span class="fut__id">
            ${nameHtml(p)}
            ${p.position ? `<span class="fut__pos">${esc(p.position)}</span>` : ''}
          </span>
          <span class="fut__num">${hasValue(p.number) ? esc(p.number) : '–'}</span>
        </span>
        <span class="fut__more" aria-hidden="true">Profil ${icon('chevron')}</span>
      </button>`;
  }

  let currentPlayer = null;

  function openPlayer(slug) {
    const p = playersBySlug[slug];
    if (!p) return;
    currentPlayer = slug;
    const prev = p.previous || {};
    const ig = igUrl(p.instagram);

    // odehrané zápasy (podle sestav z PSMF; u starších dat bez sestavy aspoň ty, kde skóroval)
    const matchLog = playedMatches().filter((v) => (v.m.lineup || []).includes(slug) || (v.m.scorers || []).some((s) => s.player === slug))
      .map((v) => ({
        v,
        minutes: (v.m.scorers || []).filter((s) => s.player === slug).map((s) => s.minute).sort((a, b) => a - b),
        cards: (v.m.cards || []).filter((c) => c.player === slug)
      })).reverse();
    const count = (key) => matchLog.filter((x) => x.v.m[key] === slug).length;
    const nCards = matchLog.reduce((s, x) => s + x.cards.length, 0);
    const honours = [
      [count('best'), '⭐', `hráč zápasu ${count('best')}×`],
      [count('captain'), 'C', `kapitán ${count('captain')}×`],
      [nCards, '🟨', `${nCards} ${plural(nCards, 'karta', 'karty', 'karet')}`]
    ].filter(([n]) => n > 0);

    // u brankáře místo vstřelených gólů obdržené
    const keeper = isKeeper(p);
    const [goalsLabel, perLabel] = keeper ? ['Obdržené', 'O/Z'] : ['Góly', 'G/Z'];
    const seasonBox = (title, apps, goals, now) => `
      <div class="season${now ? ' season--now' : ''}">
        <h3 class="season__title">${esc(title)}</h3>
        <dl class="season__stats">
          <div><dt>Zápasy</dt><dd>${hasValue(apps) ? apps : '–'}</dd></div>
          <div><dt>${goalsLabel}</dt><dd>${hasValue(goals) ? goals : '–'}</dd></div>
          <div><dt>${perLabel}</dt><dd>${hasValue(apps) && hasValue(goals) ? perMatch(goals, apps) : '–'}</dd></div>
        </dl>
      </div>`;

    $('#player-modal-content').innerHTML = `
      <div class="profile">
        <header class="profile__head">
          ${photoHtml(p, 'profile__photo photo', 'Fotka: ' + p.name)}
          <div class="profile__id">
            <p class="profile__tags">
              <span class="tag tag--gold">#${hasValue(p.number) ? esc(p.number) : '?'}</span>
              <span class="tag">${p.position ? esc(p.position) : 'Pozice: doplníme'}</span>
            </p>
            <h2 class="profile__name" id="pm-name">${nameHtml(p)}</h2>
            <p class="profile__nick">${p.nickname ? '„' + esc(p.nickname) + '“' : placeholder('Přezdívka: doplníme')}</p>
          </div>
        </header>

        <dl class="profile__facts">
          <div class="profile__ig"><dt>Instagram</dt><dd>${ig
            ? `<a href="${esc(ig)}" target="_blank" rel="noopener">${igAvatarHtml(p, 'profile__ig-avatar')} ${esc(igHandle(p.instagram))} ${icon('instagram')}</a>`
            : placeholder()}</dd></div>
        </dl>

        <section class="profile__section">
          <h3 class="profile__h">O hráči</h3>
          <p class="profile__bio">${p.bio ? esc(p.bio) : placeholder('Pár vět o hráči doplníme. Prý to bude delší než jeho rozcvička.')}</p>
        </section>

        <section class="profile__section">
          <h3 class="profile__h">Statistiky</h3>
          <div class="profile__seasons">
            ${seasonBox(D.team.season, p.apps, keeper ? conceded(p) : p.goals, true)}
            ${seasonBox(D.team.previousSeason || 'Minulá sezóna', prev.apps, keeper ? prev.conceded : prev.goals, false)}
          </div>
        </section>

          ${honours.length ? `<ul class="profile__honours">${honours.map(([n, ico, label]) =>
            `<li><span aria-hidden="true">${ico}</span> ${label}</li>`).join('')}</ul>` : ''}

        ${matchLog.length ? `
        <section class="profile__section">
          <h3 class="profile__h">Zápasy v této sezóně</h3>
          <ul class="profile__goals">
            ${matchLog.map(({ v, minutes, cards }) => `
              <li>
                <span class="profile__match">
                  <span class="dot dot--sm dot--${v.outcome}" title="${OUTCOME[v.outcome].long}"><span aria-hidden="true">${OUTCOME[v.outcome].short}</span><span class="sr-only">${OUTCOME[v.outcome].long}</span></span>
                  <span>${esc(v.home ? 'vs' : '@')} ${esc(v.opponent)} <b>${v.gf}:${v.ga}</b> <small>${esc(formatDate(v.m.date, false))}</small></span>
                </span>
                <span class="profile__min">
                  ${minutes.length ? `<span>⚽ ${minutes.map((x) => x + '′').join(', ')}</span>` : ''}
                  ${v.m.goalkeeper === slug ? `<span title="obdržené góly">🧤 ${v.ga}</span>` : ''}
                  ${cards.map((c) => `<span title="${CARD[c.type] ? CARD[c.type].label : 'karta'}">${CARD[c.type] ? CARD[c.type].icon : '🟨'} ${c.minute}′</span>`).join('')}
                  ${v.m.captain === slug ? '<span class="role role--c" title="kapitán">C</span>' : ''}
                  ${v.m.best === slug ? '<span title="nejlepší hráč zápasu">⭐</span>' : ''}
                </span>
              </li>`).join('')}
          </ul>
        </section>` : ''}
      </div>`;

    const modal = $('#player-modal');
    if (!modal.open) modal.showModal();
    $('.modal__close', modal).focus();
  }

  function stepPlayer(delta) {
    const order = squadOrder();
    const i = order.findIndex((p) => p.slug === currentPlayer);
    openPlayer(order[(i + delta + order.length) % order.length].slug);
  }

  // ---------- Výsledky + MVP ----------

  function scorerLabel(s) {
    const p = playersBySlug[s.player];
    return p ? (p.short || p.name) : s.player;
  }

  const CARD = {
    yellow: { icon: '🟨', label: 'žlutá karta' },
    red: { icon: '🟥', label: 'červená karta' },
    'yellow-red': { icon: '🟨🟥', label: 'druhá žlutá a červená karta' }
  };

  // značky hráče v zápase: brankář, kapitán, nejlepší hráč (z PSMF, plní scripts/update.js)
  function roleBadges(m, slug) {
    return [
      m.goalkeeper === slug ? '<span class="role" title="brankář">🧤<span class="sr-only"> brankář</span></span>' : '',
      m.captain === slug ? '<span class="role role--c" title="kapitán"><span aria-hidden="true">C</span><span class="sr-only"> kapitán</span></span>' : '',
      m.best === slug ? '<span class="role" title="nejlepší hráč zápasu">⭐<span class="sr-only"> nejlepší hráč zápasu</span></span>' : ''
    ].join('');
  }

  function lineupHtml(m) {
    // brankář vždy první (i když je opravený přes corrections a PSMF má v sestavě na začátku někoho jiného)
    const lineup = (m.lineup || []).slice().sort((a, b) => (b === m.goalkeeper) - (a === m.goalkeeper));
    if (!lineup.length) return '';
    return `
      <details class="result__lineup">
        <summary>Sestava Kotvy <span class="result__lineup-n">(${lineup.length})</span></summary>
        <ul class="lineup">
          ${lineup.map((s) => {
            const p = playersBySlug[s];
            if (!p) return `<li class="lineup__guest">${esc(s)}</li>`;
            return `<li><button class="chip-player" type="button" data-player="${esc(s)}" aria-haspopup="dialog">${esc(p.short || p.name)}${roleBadges(m, s)}</button></li>`;
          }).join('')}
        </ul>
      </details>`;
  }

  function renderResults() {
    const played = playedMatches().reverse();
    $('#results').innerHTML = played.map((v) => {
      const m = v.m;
      // seskupí góly hráče: „Hejduk 18′, 46′, 50′“
      const grouped = [];
      (m.scorers || []).slice().sort((a, b) => a.minute - b.minute).forEach((s) => {
        const g = grouped.find((x) => x.player === s.player);
        if (g) g.minutes.push(s.minute); else grouped.push({ player: s.player, minutes: [s.minute] });
      });
      const row = (team, goals, ht, us, win) => `
        <div class="sb__row${us ? ' is-us' : ''}${win ? ' is-win' : ''}">
          <span class="sb__team">${esc(team)}</span>
          ${ht != null ? `<span class="sb__ht" title="poločas">${ht}</span>` : ''}
          <span class="sb__goals">${goals}</span>
        </div>`;
      return `
        <article class="result" aria-label="${esc(m.home)} ${m.score[0]}:${m.score[1]} ${esc(m.away)}">
          <header class="result__head">
            <h3 class="display result__ft">Full <span class="gold-text">time</span><span class="sr-only">: ${esc(m.home)} ${m.score[0]}:${m.score[1]} ${esc(m.away)}</span></h3>
            <span class="result__badge result__badge--${v.outcome}">${OUTCOME[v.outcome].long}</span>
          </header>
          <div class="sb">
            ${m.halftime ? '<div class="sb__legend" aria-hidden="true"><span>poločas</span><span>konec</span></div>' : ''}
            ${row(m.home, m.score[0], m.halftime ? m.halftime[0] : null, v.home, m.score[0] > m.score[1])}
            ${row(m.away, m.score[1], m.halftime ? m.halftime[1] : null, !v.home, m.score[1] > m.score[0])}
          </div>
          <ul class="result__meta">
            <li>${esc(m.round)}</li>
            <li>${icon('calendar')} ${esc(formatDate(m.date))}, ${esc(m.time)}</li>
            <li>${icon('pin')} <a href="https://www.psmf.cz/hriste/#${encodeURIComponent(m.venue)}" target="_blank" rel="noopener">${esc(m.venue)}</a></li>
          </ul>
          ${grouped.length ? `<ul class="result__scorers" aria-label="Střelci Kotvy">${grouped.map((g) => `
            <li><button class="chip-player" type="button" data-player="${esc(g.player)}" aria-haspopup="dialog">
              <span aria-hidden="true">⚽</span> ${esc(scorerLabel(g))} <span class="chip-player__min">${g.minutes.map((x) => x + '′').join(', ')}</span>${g.minutes.length >= 3 ? ' <span title="hattrick">🎩</span>' : ''}
            </button></li>`).join('')}</ul>` : ''}
          ${(m.cards || []).length ? `<ul class="result__scorers" aria-label="Karty Kotvy">${m.cards.map((c) => `
            <li><button class="chip-player" type="button" data-player="${esc(c.player)}" aria-haspopup="dialog">
              <span aria-hidden="true">${CARD[c.type] ? CARD[c.type].icon : '🟨'}</span> ${esc(scorerLabel(c))} <span class="chip-player__min">${c.minute}′</span><span class="sr-only"> – ${CARD[c.type] ? CARD[c.type].label : 'karta'}</span>
            </button></li>`).join('')}</ul>` : ''}
          ${m.report ? `<p class="result__report">${esc(m.report)}</p>` : ''}
          ${lineupHtml(m)}
        </article>`;
    }).join('') || '<p class="empty">Zatím žádný odehraný zápas.</p>';
  }

  // MVP posledního odehraného zápasu: ruční výběr z team.json (mvp), pokud patří k poslednímu
  // zápasu; jinak nejlepší hráč podle PSMF (matches[].best, plní scripts/update.js)
  function renderMvp() {
    const box = $('#mvp');
    const last = playedMatches().pop();
    if (!last) { box.innerHTML = ''; return; }
    const m = last.m;
    const manual = D.mvp && D.mvp.match === m.id ? D.mvp : null;
    const p = playersBySlug[manual ? manual.player : m.best];
    if (!p) { box.innerHTML = ''; return; }
    const text = manual && manual.text;
    const vs = ` · ${last.gf}:${last.ga} vs ${last.opponent}`;
    box.innerHTML = `
      <button class="mvp__btn" type="button" data-player="${esc(p.slug)}" aria-haspopup="dialog">
        ${avatarHtml(p, '')}
        <span class="mvp__body">
          <span class="mvp__tag">🏆 Hráč posledního zápasu${esc(vs)}</span>
          <span class="mvp__name">${esc(p.name)}</span>
          ${text ? `<span class="mvp__text">${esc(text)}</span>` : ''}
        </span>
      </button>`;
  }

  // ---------- Program ----------

  function renderFixtures(now) {
    const list = upcomingMatches();
    const next = currentMatch(now);
    $('#fixtures').innerHTML = list.map((v) => {
      const m = v.m;
      const [, mo, d] = m.date.split('-').map(Number);
      const waiting = now >= v.end.getTime();
      const teams = `<span class="${v.home ? 'is-us' : ''}">${esc(m.home)}</span> – <span class="${v.home ? '' : 'is-us'}">${esc(m.away)}</span>`;
      return `
        <li class="fixture${next && next.m.id === m.id ? ' is-next' : ''}">
          <span class="fixture__date"><span class="fixture__day">${DAY_NAMES[new Date(m.date + 'T12:00:00Z').getUTCDay()]}</span><span class="fixture__dm">${d}.${mo}.</span></span>
          <span class="fixture__teams">${teams}</span>
          <span class="fixture__meta">
            <span>${esc(m.round)}</span>
            <span>${esc(m.time)}</span>
            <a href="https://www.psmf.cz/hriste/#${encodeURIComponent(m.venue)}" target="_blank" rel="noopener">${icon('pin')} ${esc(m.venue)}</a>
            ${next && next.m.id === m.id ? '<span class="fixture__tag">Příští zápas</span>' : ''}
            ${waiting ? '<span class="fixture__tag">Čeká na výsledek</span>' : ''}
          </span>
        </li>`;
    }).join('') || '<li class="empty">Žádné další zápasy v programu.</li>';
  }

  // ---------- Galerie + lightbox ----------

  const RATIOS = ['4 / 5', '1 / 1', '4 / 3', '3 / 4', '16 / 10', '1 / 1'];

  function renderGallery() {
    const items = D.gallery || [];
    const box = $('#gallery');
    box.innerHTML = items.map((g, i) => `
      <button class="gallery__item" type="button" data-index="${i}" aria-haspopup="dialog" aria-label="Zvětšit fotku${g.caption ? ': ' + esc(g.caption) : ` ${i + 1}`}">
        <img src="${esc(g.src)}" alt="${esc(g.caption || 'Fotka FC Kotva')}" loading="lazy" data-fallback="photo" data-ratio="${RATIOS[i % RATIOS.length]}">
        ${g.caption ? `<span class="gallery__cap" aria-hidden="true">${esc(g.caption)}</span>` : ''}
      </button>`).join('') || '<p class="empty">Fotky brzy přibudou.</p>';

    box.addEventListener('click', (e) => {
      const item = e.target.closest('[data-index]');
      if (item) openLightbox(items, Number(item.dataset.index));
    });
  }

  // Lightbox je společný pro galerii i sekci šampionů – zobrazuje vždy sadu fotek, ze které byl otevřen.
  let lbItems = [];
  let lbIndex = 0;

  function showLightbox(i) {
    lbIndex = (i + lbItems.length) % lbItems.length;
    const g = lbItems[lbIndex];
    $('#lightbox-media').innerHTML = `<img src="${esc(g.src)}" alt="${esc(g.caption || 'Fotka FC Kotva')}" data-fallback="photo" data-ratio="4 / 3">`;
    $('#lightbox-caption').innerHTML = `${esc(g.caption)}<small>${lbIndex + 1} / ${lbItems.length}</small>`;
  }

  function openLightbox(items, i) {
    lbItems = items;
    showLightbox(i);
    $('#lightbox').showModal();
  }

  function initLightbox() {
    const lb = $('#lightbox');
    const show = (i) => showLightbox(i);
    $('[data-prev]', lb).addEventListener('click', () => show(lbIndex - 1));
    $('[data-next]', lb).addEventListener('click', () => show(lbIndex + 1));
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(lbIndex - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(lbIndex + 1); }
    });

    let touchX = null, touchY = null;
    lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(lbIndex + (dx < 0 ? 1 : -1));
      touchX = touchY = null;
    }, { passive: true });
  }

  function initDialogs() {
    $$('dialog').forEach((dlg) => {
      $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
      // klik na pozadí zavře
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.classList.contains('lightbox__figure') || e.target.classList.contains('lightbox__media')) dlg.close();
      });
    });
  }

  // Na hráče jde kliknout kdekoli na webu – stačí prvek s data-player="<slug>".
  function initPlayerLinks() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-player]');
      if (el) openPlayer(el.dataset.player);
    });
    const modal = $('#player-modal');
    $('[data-pprev]', modal).addEventListener('click', () => stepPlayer(-1));
    $('[data-pnext]', modal).addEventListener('click', () => stepPlayer(1));
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepPlayer(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepPlayer(1); }
    });
  }

  // ---------- Start ----------

  function showLoadError() {
    $('#matchday').innerHTML = '<p class="empty">Nepodařilo se načíst <code>data/team.json</code>. Pokud web otevíráš přímo ze souboru, spusť lokální server (viz README).</p>';
  }

  function init(data) {
    D = data;
    D.players.forEach((p) => { playersBySlug[p.slug] = p; });

    renderBindings();
    renderStats();
    renderChampions();
    renderTable();
    renderScorers();
    renderSquad();
    renderMvp();
    renderResults();
    renderGallery();
    initLightbox();
    initDialogs();
    initPlayerLinks();

    const tick = () => renderMatchday(Date.now());
    tick();
    setInterval(tick, 1000);

    observeCounters(document);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initReveal();
    fetch(DATA_URL, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(init)
      .catch((err) => { console.error(err); showLoadError(); });
  });

  // pro testy v konzoli
  window.__kotva = { pragueToDate, euOffsetMinutes };
})();
