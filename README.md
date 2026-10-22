# FC Kotva – web ⚓

Statický web bez build kroku. Všechno, co se mění během sezóny, je v **`data/team.json`**. HTML ani JS kvůli novému kolu upravovat nemusíš.

```
index.html          kostra stránky
css/style.css       vzhled (barvy jsou CSS proměnné nahoře v souboru)
js/main.js          vykreslování, odpočet, výpočty (bilance, forma, střelci, H2H)
data/team.json      data: tým, hráči, zápasy, tabulka, MVP, galerie
assets/logo.png     logo (štít bez pozadí), použije se i jako náhled při sdílení
assets/icon-512.png favicon (čtvercové logo)
assets/players/     fotky hráčů
assets/gallery/     fotky do galerie
scripts/update.js   stažení aktuálních dat z PSMF
```

## Lokální spuštění

Prohlížeč nenačte `team.json` při otevření `index.html` dvojklikem (`file://`), takže web spouštěj přes lokální server:

```bash
npm start              # = node scripts/serve.js -> http://localhost:6546/
```

## Fotky hráčů

Ulož fotku jako `assets/players/<slug>.jpg`. `slug` najdeš u hráče v `team.json`, např. `ondrej-hejduk.jpg`. Ideální je čtvercová fotka aspoň 400 × 400 px. Když fotka chybí, zobrazí se iniciály na zlatém pozadí.

## Profily hráčů

V `team.json` doplň u každého hráče tato pole. Prázdná pole se na webu zobrazí jako „doplníme“.

```json
{
  "slug": "ondrej-hejduk", "name": "Ondřej Hejduk", "short": "Hejduk",
  "number": 9,                         // číslo dresu
  "position": "Útočník",               // Brankář / Obránce / Záložník / Útočník
  "nickname": "Hejdy",
  "age": 23,
  "study": "ČVUT – stavební fakulta",
  "instagram": "@hejduk",              // nebo celý odkaz https://www.instagram.com/...
  "bio": "Pár vět o hráči.",
  "apps": 3, "goals": 7,               // tato sezóna (aktualizuje i scripts/update.js)
  "previous": { "apps": 8, "goals": 5 } // minulá sezóna
}
```

Název minulé sezóny se nastavuje jednou pro všechny v `team.previousSeason` (např. „Jaro 2026 · 8I“). Pole `previous` vyplní automaticky `node scripts/update.js` z odkazu `team.previousPsmfUrl`. Až skončí podzim, přepiš `previousSeason` a `previousPsmfUrl` na podzimní sezónu a `psmfUrl` na novou. Na hráče jde kliknout kdekoli na webu: na kartě, na podiu, ve střelecké tabulce, u střelců ve výsledcích i u MVP. V profilu se dá listovat tlačítky Předchozí/Další nebo šipkami na klávesnici.

## Galerie

1. Nahraj fotku do `assets/gallery/` (stačí šířka kolem 1600 px, JPG).
2. Přidej ji do pole `gallery` v `team.json`:
   ```json
   { "src": "assets/gallery/07.jpg", "caption": "Popisek fotky" }
   ```

Položky, ke kterým soubor chybí, se zobrazí jako zlatý placeholder s kotvou, takže je stačí smazat nebo nahradit.

## Aktualizace po kole

**Automaticky (doporučeno):**

```bash
node scripts/update.js --dry   # ukáže, co se změní
node scripts/update.js         # přepíše data/team.json
```

Skript stáhne profil týmu z PSMF a aktualizuje tabulku, výsledky (skóre, poločas, střelce Kotvy), program, barvy dresů a statistiky hráčů. Ručně psané věci zachová: pozice, čísla, přezdívky, bio, vlastní popisy zápasů, názvy kol a galerii. Pokud zápas nemá vlastní popis, převezme ho z PSMF. Potřebuje Node 18 nebo novější.

**Ručně:** v `team.json`

- u odehraného zápasu vyplň `score` `[domácí, hosté]`, `halftime`, `scorers` (`{ "player": "slug", "minute": 12 }`) a `report`,
- přepiš `table` podle PSMF,
- uprav `apps` a `goals` u hráčů,
- změň `updated`.

**Hráč posledního zápasu (MVP)** se vybírá sám: web vezme hráče, kterého PSMF u posledního zápasu označilo jako nejlepšího (`best` u zápasu, plní ho `update.js`). Pokud chceš vlastního hráče nebo vtipný komentář, vyplň `mvp`:
```json
"mvp": { "match": "r06", "player": "matej-hykrda", "text": "Krátký komentář." }
```
Platí jen pro zápas uvedený v `match`. Po dalším kole se web sám vrátí k výběru z PSMF.

**Sestavy, kapitán, brankář a karty** se berou z PSMF (`lineup`, `captain`, `goalkeeper`, `cards` u zápasu). Ve výsledcích je rozbalovací sestava, v profilu hráče přehled jeho zápasů.

**Chyba v zápisu na PSMF?** Neopravuj ji přímo u zápasu, `update.js` by ji při dalším běhu přepsal. Zapiš ji do `corrections` (klíčem je `id` zápasu). Opravy se použijí vždy až po stažení dat z PSMF:
```json
"corrections": {
  "r04": { "goalkeeper": "vojtech-polacek" }
}
```
Opravit jde jakékoli pole zápasu, třeba `best`, `captain`, `scorers` nebo `report`.

**Minulá sezóna:** `update.js` uloží konečné umístění do `previousRecord` (z `team.previousPsmfUrl`). Web z něj sám napíše odznak v úvodu (např. „Vítěz skupiny 8I · bez porážky · postup do 7. ligy“) a řádek v bilanci.

**Poznámka pod tabulkou** (bodování, o kolik zápasů má Kotva méně a kdy se dohrává odložené kolo) se počítá z dat. Do `tableNote` můžeš připsat vlastní text, který se přidá na konec.

Bilanci, formu, Top 3 střelce, příští zápas, odpočet a Head2Head si web spočítá sám. Časy zápasů se zadávají v pražském čase (`"date": "2026-10-30", "time": "19:15"`) a přechod mezi letním a zimním časem se řeší automaticky.

## Automatická aktualizace (GitHub Actions)

Web běží na **https://kotikadam17.github.io/FCKotva/**. Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

- v pátek večer, v sobotu, v neděli a každé ráno spustí `scripts/update.js`; když se na PSMF něco změnilo, uloží nový `team.json` jako commit a web znovu nasadí,
- při každém pushi do `main` (např. nové fotky nebo bio) web nasadí znovu,
- ručně jde spustit v záložce **Actions → Aktualizace a nasazení → Run workflow**, třeba hned po zápase.

Když běh selže (např. PSMF změní vzhled stránek), GitHub pošle e-mail a web dál ukazuje poslední data.

Jednorázové nastavení: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

**Vyhledávače:** web má kanonickou adresu, strukturovaná data (`SportsTeam`), `sitemap.xml` a vlastní stránku `404.html`. Aby ho Google našel rychleji, přidej web v [Google Search Console](https://search.google.com/search-console) a zadej tam sitemapu `https://kotikadam17.github.io/FCKotva/sitemap.xml`. Soubor `robots.txt` u webu na GitHub Pages v podsložce nemá smysl, protože vyhledávače ho čtou jen z kořene domény.

Když upravuješ `team.json` ručně, nejdřív si stáhni případné automatické změny (`git pull`), ať se nepřepíšou.

## Nasazení jinam

**Netlify:** na [app.netlify.com/drop](https://app.netlify.com/drop) přetáhni celou složku. Hotovo.

**GitHub Pages:**
1. Nahraj obsah složky do repozitáře (soubor `index.html` musí být v kořeni).
2. Otevři Settings → Pages → Source: *Deploy from a branch*, větev `main` a složka `/ (root)`.
3. Web poběží na `https://<uživatel>.github.io/<repo>/`.

**Po nasazení** v `index.html` přepiš `og:url` a `og:image` na absolutní adresy (např. `https://fckotva.netlify.app/assets/logo.png`). Facebook, WhatsApp a Instagram relativní cestu k obrázku v náhledu nenačtou.
