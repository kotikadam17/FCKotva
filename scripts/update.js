#!/usr/bin/env node
/*
 * Aktualizace data/team.json z profilu týmu na PSMF.
 *
 *   node scripts/update.js            stáhne PSMF a přepíše data/team.json
 *   node scripts/update.js --dry      jen vypíše, co by se změnilo
 *   node scripts/update.js --out x.json   zapíše výsledek jinam
 *
 * Přepisuje: tabulku, výsledky (skóre, poločas, střelce Kotvy), program,
 * barvy dresů, zápasy a góly hráčů. Je-li vyplněné team.previousPsmfUrl,
 * doplní i statistiky z minulé sezóny (players[].previous).
 * Zachovává: pozice, čísla, přezdívky, bio, vlastní popisy zápasů,
 * názvy kol (např. „1. kolo (odložené)“), galerii, MVP a texty webu.
 * Potřebuje Node 18+ (vestavěný fetch), žádné balíčky.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data', 'team.json');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : DATA;

// ---------- HTML pomocníci (bez závislostí) ----------

const ENTITIES = { nbsp: ' ', ndash: '–', mdash: '—', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => (n in ENTITIES ? ENTITIES[n] : m));
const text = (html) => decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t ]+/g, ' ').trim();
const cells = (rowHtml) => [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
const rows = (tableHtml) => [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);

function tableByClass(html, cls) {
  const start = html.indexOf(`class="component__table has-wrapper ${cls}`);
  if (start < 0) return '';
  const end = html.indexOf('</table>', start);
  return html.slice(start, end);
}

function teamTitles(cellHtml) {
  return [...cellHtml.matchAll(/<a href="[^"]*\/tymy\/[^"]*" title="([^"]+)"/g)].map((m) => decode(m[1]));
}

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "16. 10. 26" nebo "Pá 23.10.26" -> "2026-10-16"
function parseDate(s) {
  const m = text(s).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// ---------- Parsování stránky týmu ----------

function parseTable(html) {
  return rows(tableByClass(html, 'tables-table')).map(cells).filter((c) => c.length >= 8).map((c) => {
    const [gf, ga] = text(c[6]).split(':').map(Number);
    return {
      team: teamTitles(c[1])[0] || text(c[1]),
      played: +text(c[2]), won: +text(c[3]), drawn: +text(c[4]), lost: +text(c[5]),
      gf, ga, points: +text(c[7])
    };
  });
}

function parseFixtures(html) {
  return rows(tableByClass(html, 'games-new-table')).map(cells).filter((c) => c.length >= 5).map((c) => {
    const [home, away] = teamTitles(c[3]);
    const colors = [...c[3].matchAll(/data-dccolor="([^"]*)"/g)].map((m) => decode(m[1]));
    const split = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
    return {
      date: parseDate(c[0]), time: text(c[1]), venue: text(c[2]),
      home, away, roundNo: parseInt(text(c[4]), 10),
      homeColors: split(colors[0]), awayColors: split(colors[1])
    };
  });
}

function parseGoals(cellHtml) {
  // "9. Matěj Hykrda<br /> 49., 53. Adam Kotík"
  return text(cellHtml).split('\n').map((l) => l.trim()).filter(Boolean).flatMap((line) => {
    const m = line.match(/^((?:\d+\.\s*,?\s*)+)(.+)$/);
    if (!m) return [];
    return [...m[1].matchAll(/(\d+)\./g)].map((x) => ({ name: m[2].trim(), minute: +x[1] }));
  });
}

function parseResults(html) {
  const chunks = html.split(/<div class="component__table-wrap" id="GameResultItem\d+">/).slice(1);
  return chunks.map((ch) => {
    const head = rows(ch).map(cells).find((c) => c.length >= 6 && /is-result|\d+:\d+/.test(c[5]));
    if (!head) return null;
    const score = text(head[5]).match(/(\d+)\s*:\s*(\d+)(?:\s*\((\d+)\s*:\s*(\d+)\))?/);
    if (!score) return null;
    const [home, away] = teamTitles(head[3]);
    const desc = ch.match(/<th>Popis zápasu<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/);
    const goalsRow = ch.match(/<th class="is-centered">Góly<\/th>[\s\S]*?<\/tr>\s*<tr>([\s\S]*?)<\/tr>/);
    const g = goalsRow ? cells(goalsRow[1]) : [];
    return {
      date: parseDate(head[0]), time: text(head[1]), venue: text(head[2]),
      home, away, roundNo: parseInt(text(head[4]), 10),
      score: [+score[1], +score[2]],
      halftime: score[3] != null ? [+score[3], +score[4]] : null,
      homeGoals: g[0] ? parseGoals(g[0]) : [],
      awayGoals: g[3] ? parseGoals(g[3]) : [],
      description: desc ? text(desc[1]) : ''
    };
  }).filter(Boolean);
}

function parseStats(html) {
  return rows(tableByClass(html, 'player-stats-table')).map(cells).filter((c) => c.length >= 3)
    .map((c) => ({ psmfName: text(c[0]), apps: +text(c[1]), goals: +text(c[2]) }));
}

// ---------- Sloučení s existujícími daty ----------

const tokens = (name) => slugify(name).split('-').sort().join('-');

function main(html, data) {
  const us = data.team.psmfName;
  const log = [];

  // Hráči: PSMF píše „Příjmení Jméno“
  const stats = parseStats(html);
  if (stats.length) {
    stats.forEach((s) => {
      let p = data.players.find((x) => tokens(x.name) === tokens(s.psmfName));
      if (!p) {
        const parts = s.psmfName.split(' ');
        const name = parts.slice(1).concat(parts[0]).join(' ');
        p = { slug: slugify(name), name, short: parts[0], number: null, position: '', nickname: '', age: null, study: '',
          instagram: '', bio: '', apps: 0, goals: 0, previous: { apps: null, goals: null } };
        data.players.push(p);
        log.push(`+ nový hráč ${name}`);
      }
      if (p.apps !== s.apps || p.goals !== s.goals) log.push(`~ ${p.name}: ${p.apps}/${p.goals} -> ${s.apps}/${s.goals}`);
      p.apps = s.apps; p.goals = s.goals;
    });
  }
  const slugFor = (name) => {
    const p = data.players.find((x) => tokens(x.name) === tokens(name));
    if (!p) log.push(`! střelec „${name}“ není v kádru, ukládám jako ${slugify(name)}`);
    return p ? p.slug : slugify(name);
  };

  // Zápasy – identita = dvojice domácí/hosté
  const find = (home, away) => data.matches.find((m) => m.home === home && m.away === away);
  const upsert = (src) => {
    let m = find(src.home, src.away);
    if (!m) {
      m = { id: 'm' + src.date.replace(/-/g, ''), round: `${src.roundNo}. kolo`, home: src.home, away: src.away,
        homeColors: [], awayColors: [], score: null, halftime: null, scorers: [], report: '' };
      data.matches.push(m);
      log.push(`+ nový zápas ${src.home} – ${src.away}`);
    }
    if (m.date !== src.date || m.time !== src.time || m.venue !== src.venue) {
      if (m.date) log.push(`~ ${m.home} – ${m.away}: termín ${m.date} ${m.time} ${m.venue} -> ${src.date} ${src.time} ${src.venue}`);
    }
    Object.assign(m, { date: src.date, time: src.time, venue: src.venue });
    return m;
  };

  parseFixtures(html).forEach((f) => {
    const m = upsert(f);
    if (f.homeColors.length) m.homeColors = f.homeColors;
    if (f.awayColors.length) m.awayColors = f.awayColors;
  });

  parseResults(html).forEach((r) => {
    const m = upsert(r);
    if (!m.score) log.push(`+ výsledek ${r.home} ${r.score.join(':')} ${r.away}`);
    m.score = r.score;
    m.halftime = r.halftime;
    const ours = r.home === us ? r.homeGoals : r.awayGoals;
    m.scorers = ours.map((g) => ({ player: slugFor(g.name), minute: g.minute })).sort((a, b) => a.minute - b.minute);
    if (!m.report && r.description) m.report = r.description;
  });

  data.matches.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const table = parseTable(html);
  if (table.length) data.table = table;
  else log.push('! tabulku se nepodařilo najít – nechávám původní');

  return log;
}

// Minulá sezóna (team.previousPsmfUrl): doplní hráčům previous.apps / previous.goals
function applyPrevious(html, data) {
  const log = [];
  parseStats(html).forEach((s) => {
    const p = data.players.find((x) => tokens(x.name) === tokens(s.psmfName));
    if (!p) return;
    const prev = p.previous || {};
    if (prev.apps !== s.apps || prev.goals !== s.goals) log.push(`~ ${p.name} (minulá sezóna): ${s.apps}/${s.goals}`);
    p.previous = { apps: s.apps, goals: s.goals };
  });
  return log;
}

async function download(url) {
  console.log(`Stahuji ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (FC Kotva web updater)' } });
  if (!res.ok) throw new Error(`PSMF vrátilo ${res.status} pro ${url}`);
  return res.text();
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const before = JSON.stringify(data);
  const html = await download(data.team.psmfUrl);

  const log = main(html, data);
  if (data.team.previousPsmfUrl) log.push(...applyPrevious(await download(data.team.previousPsmfUrl), data));
  console.log(log.length ? log.join('\n') : 'Žádné změny v hráčích ani zápasech.');
  console.log(`Tabulka: ${data.table.length} týmů, zápasy: ${data.matches.length} (${data.matches.filter((m) => m.score).length} odehraných)`);

  // nic nového -> soubor nepřepisovat (automatická aktualizace pak nedělá prázdné commity)
  if (JSON.stringify(data) === before) { console.log('Na PSMF nic nového, team.json nechávám beze změny.'); return; }
  data.updated = new Date().toISOString().slice(0, 10);

  if (DRY) { console.log('--dry: nic jsem nezapsal.'); return; }
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Zapsáno do ${path.relative(process.cwd(), OUT) || OUT}`);
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
