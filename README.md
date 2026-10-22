# FC Kotva – web ⚓

Statický web bez build kroku. Všechno, co se mění během sezóny, je v **`data/team.json`**. HTML ani JS kvůli novému kolu upravovat nemusíš.

```
index.html          kostra stránky
css/style.css       vzhled (barvy jsou CSS proměnné nahoře v souboru)
js/main.js          vykreslování, odpočet, výpočty (bilance, forma, střelci, H2H)
data/team.json      data: tým, hráči, zápasy, tabulka, MVP, galerie
assets/logo.png     logo (dodat), použije se i jako favicon a náhled při sdílení
assets/favicon.svg  záložní favicon (zlatá kotva)
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
- změň `updated` a případně `mvp` (`match` je `id` zápasu, `player` je slug hráče).

Bilanci, formu, Top 3 střelce, příští zápas, odpočet a Head2Head si web spočítá sám. Časy zápasů se zadávají v pražském čase (`"date": "2026-10-30", "time": "19:15"`) a přechod mezi letním a zimním časem se řeší automaticky.

## Automatická aktualizace (GitHub Actions)

Web běží na **https://kotikadam17.github.io/FCKotva/**. Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

- v pátek večer, v sobotu, v neděli a každé ráno spustí `scripts/update.js`; když se na PSMF něco změnilo, uloží nový `team.json` jako commit a web znovu nasadí,
- při každém pushi do `main` (např. nové fotky nebo bio) web nasadí znovu,
- ručně jde spustit v záložce **Actions → Aktualizace a nasazení → Run workflow**, třeba hned po zápase.

Když běh selže (např. PSMF změní vzhled stránek), GitHub pošle e-mail a web dál ukazuje poslední data.

Jednorázové nastavení: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Když upravuješ `team.json` ručně, nejdřív si stáhni případné automatické změny (`git pull`), ať se nepřepíšou.

## Nasazení jinam

**Netlify:** na [app.netlify.com/drop](https://app.netlify.com/drop) přetáhni celou složku. Hotovo.

**GitHub Pages:**
1. Nahraj obsah složky do repozitáře (soubor `index.html` musí být v kořeni).
2. Otevři Settings → Pages → Source: *Deploy from a branch*, větev `main` a složka `/ (root)`.
3. Web poběží na `https://<uživatel>.github.io/<repo>/`.

**Po nasazení** v `index.html` přepiš `og:url` a `og:image` na absolutní adresy (např. `https://fckotva.netlify.app/assets/logo.png`). Facebook, WhatsApp a Instagram relativní cestu k obrázku v náhledu nenačtou.
