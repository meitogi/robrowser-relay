# roBrowser relay — Firefox extension

Keeps `wtf robrowser prod --local-grf` (`https://cyro.localhost:6988/api.html?app=ONLINE`) playable when
the local servers are down, and makes its static copy on GitHub Pages playable
(`https://robrowser.suuuper.app/cyro.live/`, deployed from the fork's `gh-pages` by
`.github/workflows/pages-sites.yml` + `.github/pages-sites/` on the fork's `master`). You give the extension
your client folder once (`data.grf` plus its loose files: `BGM/`, `AI/`…); while it is on, the page reads
its assets from that folder and calls the cyro.live API directly. The game socket already goes straight to
`wss://cyro.live`.

It is the second half of a pair. The first half lives in [`robrowser/pwa/`](../../../pwa/) and is served by
`serve-robrowser-prod.mjs` in `--local-grf` mode only:

| File | Layer | Role |
|---|---|---|
| `pwa/sw.js` | page shell | Service worker. `api.html`, scripts, workers, plugins: network first, the last good copy when the server is down. Never caches `/grf/` nor the API. |
| `pwa/pwa-client.js` | page shell | Registers `sw.js`. |
| `pwa/relay-sw.js` | relay | Imported by `sw.js`. Its fetch listener answers `/grf/` from the relay's folder and sends `/userconfig`, `/emblem`, `/api` to `https://cyro.live/api`, while the relay is on. Off: the network, as before. |
| `pwa/relay-client.js` | relay | Gets the folder from this extension and hands it to the service worker (again when a restarted worker asks). |
| `relay/ext/` | relay | This extension. |

The page shell works without the relay: drop the `importScripts` line from `sw.js` and
`relay-client.js` from `PWA_PAGE_SCRIPTS`.

## How it runs

- **Storage.** The folder is kept in the extension's IndexedDB (`unlimitedStorage`): `grf` (the archive
  `File`), `root` (`{ <lowercased path>: File }` for the loose files), `enabled`. Choosing the same
  `data.grf` again does not copy it again (same name, size and date).
- **Hand-over.** `content.js` runs on `cyro.localhost:6988` and `robrowser.suuuper.app/cyro.live/` only.
  The page posts `{ roRelay: 'want-files' }`; the background answers with the stored `File`s, by
  structured clone, which passes references: 18 ms for the 4.4 GB archive, nothing copied.
- **Reads.** `relay-sw.js` parses the GRF (0x200 / 0x300) like `tools/client-data/grf-reader.mjs` and
  resolves a request like `grf-serve.mjs`: loose files, then the archive, then the
  `data/resnametable.txt` alias. `POST /grf/` (`FileManager.search`) is answered from the file table.
  DES-encrypted entries are left to the network (the cyro archive has none).
- **Load-time signal.** Soon after `document_start` the page gets the relay's state, see
  [Page contract](#page-contract). The Pages copy's `gate.js` boots the client on `ready` only: no signal
  within 1.5 s means no extension, and the page says so instead of loading `Online.js`.
- **Badge.** When the page took the folder (`{ roRelay: 'used' }`) its tab's toolbar icon shows **GRF**.
- **CORS.** `cyro.live/api` sends no `Access-Control-Allow-Origin`. `webRequest.onHeadersReceived` adds it
  for the two game origins only (`https://cyro.localhost:6988`, `https://robrowser.suuuper.app`), while the
  relay is on.
- **Popup.** The relay's name and version, one status line with a mark — ✓ **Ready**, ⚠︎ **No client
  folder**, ✗ **Relay off** (the [page contract](#page-contract) states) — and the stored archive's name,
  size and loose-file count, then whether this tab uses the relay, the on/off switch, **Allow access to the
  game pages and cyro.live** (only while that host access is missing) and **Choose the client folder…**
  (highlighted while no folder is stored). Light and dark follow the system theme.
- **Install page.** On a first install (`runtime.onInstalled`, `reason === 'install'`) the background opens
  `store.html#welcome`: the same folder page, titled as a welcome step. It says in three lines what the relay
  does, shows the same status line and access button as the popup, takes the client folder by drag and drop
  or the picker (or only a `.grf`), shows progress while it reads and stores, then **Ready — open the game**
  (`https://robrowser.suuuper.app/cyro.live/`) once the state is `ready`. Updates do not open it.
- **Shared files.** `state.js` (the state), `ui.css` (the look, light and dark), `ui.js` (status line and
  access button) are loaded by both the popup and the folder page.

Measured in Firefox on the cyro archive (4.42 GB, v0x300, 290 305 entries): file table inflated in 95 ms
and parsed in 23 ms (once per service-worker start), 1000 random entries at 1.75 ms average (worst 123 ms).

## Page contract

On the game pages only (`https://cyro.localhost:6988/*`, `https://robrowser.suuuper.app/cyro.live/*`),
`content.js` asks the background for the state once, right after `document_start`, then publishes it
twice, in this order:

1. `document.documentElement.dataset.roRelay` (the `data-ro-relay` attribute of `<html>`) = the state;
2. a `ro-relay` `CustomEvent` on `window`, `detail` = `{ ready, state, name }`.

| `state` | Meaning | `ready` | `name` |
|---|---|---|---|
| `ready` | relay on, client folder stored | `true` | the stored archive's file name (`"data.grf"`) |
| `nogrf` | relay on, no client folder stored | `false` | `null` |
| `off` | relay switched off in the popup, folder or not | `false` | the stored archive's name, or `null` |
| *(nothing)* | extension not installed, disabled, or no host access | — | — |

- One function decides the state, `relayState(enabled, hasGrf)` in `ext/state.js`, shared by the popup and
  the content script (tested in `../test/relay-state.test.mjs`).
- The state is read once per page load: switching the relay or choosing a folder shows on the next load.
- A page that only cares about booting keeps reading `ready` (or `data-ro-relay === 'ready'`); `state`
  tells it which message to show. A page script may run after the attribute is set and miss the event:
  read the attribute first, then listen.
- 0.2.0 and older publish `ready|off` only and no `state` (`nogrf` was folded into `off`).
- Today's `gate.js` (fork, `.github/pages-sites/shared/gate.js`) passes the attribute's value straight to
  its `MESSAGES` table, which has no `nogrf` key: it needs a `nogrf` message (or to fold it into `off`)
  before a 0.3.0 relay meets it, or it shows an empty message.

## Use

1. Install (below). The welcome page opens: **Allow access to the game pages and cyro.live** if shown.
2. Drop `iRO_ver12.0-full-client-data/cyro` on the page, or click it to pick the folder (later: the icon →
   **Choose the client folder…**). Expect `loose files: 195 (BGM: 185)` and ✓ **Ready**.
   Firefox's folder picker does not follow symlinks: a linked `BGM/` comes in empty, so copy it instead.
3. Open `https://cyro.localhost:6988/api.html?app=ONLINE` with `wtf robrowser prod --local-grf` running,
   and reload once: the service worker caches the shell from its second load.
4. From then on the page loads with the servers down.

The service worker's own traffic (the direct `cyro.live/api` calls) is in `about:debugging` → **Service
Workers** → `cyro.localhost:6988` → **Inspect**, not in the page's network panel.

## Known limits

- Switching the relay off reaches the service worker at the next page load; the badge clears at once.
- The client's `/userconfig` call gives up after 5 s (`xhr.timeout` in `ShortCut.js`), whatever the route.
- Firefox for macOS does not install PWAs; the offline shell works in a normal tab.

## Develop

```bash
npx web-ext@10.7.0 lint --source-dir robrowser/tools/firefox-ext/relay/ext
```

Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → `relay/ext/manifest.json`.
A temporary add-on is removed when Firefox quits.

The icons are drawn in `icons-src/` (`poring-small.svg` for 16 and 32 px, `poring-grf.svg` for 48 and
96 and 128 px) and exported to `ext/icons/` with sharp (`tools/client-data/node_modules`). The 128 px
one is the icon AMO shows on the listing.

## Release (host only)

Signing needs the AMO API keys, which stay on the host. From the workspace root, on the host:

```bash
export AMO_JWT_ISSUER=… AMO_JWT_SECRET=…   # addons.mozilla.org > Developer Hub > Manage API Keys
cd robrowser/tools/firefox-ext/relay && ./sign.sh --channel=listed     # public AMO page
cd robrowser/tools/firefox-ext/relay && ./sign.sh --channel=unlisted   # or: signed xpi, direct link only
```

Bump `version` in `ext/manifest.json` first: AMO refuses a version it has already seen. `./sign.sh` alone is
`--channel=unlisted`. `--dry-run` prints the `web-ext sign` command line and stops (no lint, no network, no
keys needed). Otherwise the script lints, then signs; its output goes to `sign-<date>.log`.

| | `unlisted` (default) | `listed` |
|---|---|---|
| Who finds it | whoever has the xpi or its link | anyone, on addons.mozilla.org |
| Review | automatic, minutes | automatic signing, then a human review that can come later and ask questions |
| Sent with it | the xpi | the xpi + the listing in [`amo/metadata.json`](amo/metadata.json) (`--amo-metadata`) |
| Updates | by hand (no `update_url`) | Firefox updates it from AMO |
| Signed xpi | `web-ext-artifacts/`, once approved | the same, and the AMO page |

`sign.sh` waits up to 45 min for approval. If it times out, the version is still in the queue: the signed
file is downloaded later from the Developer Hub page that web-ext prints.

### The listing (`amo/`)

| File | Goes to |
|---|---|
| [`metadata.json`](amo/metadata.json) | sent by `--channel=listed`: name, summary (≤ 250 characters), description, category `games-entertainment`, homepage and support URL `https://robrowser.suuuper.app/`, licence `GPL-3.0-or-later`, and the reviewer notes (`version.approval_notes`) |
| [`REVIEWER-NOTES.md`](amo/REVIEWER-NOTES.md) | the readable copy of `version.approval_notes`: why `webRequestBlocking`, `unlimitedStorage` and each of the three hosts |
| [`PRIVACY.md`](amo/PRIVACY.md) | pasted by hand into Developer Hub → the add-on → **Edit Product Page** → privacy policy (the submission API does not take it) |

The licence is GPL-3.0, the licence of roBrowserLegacy, whose page this extension serves; this repo has no
licence file of its own. Edit `REVIEWER-NOTES.md`, then copy it into `metadata.json`:

```bash
cd robrowser/tools/firefox-ext/relay && node -e 'const f=require("fs"),m=JSON.parse(f.readFileSync("amo/metadata.json"));m.version.approval_notes=f.readFileSync("amo/REVIEWER-NOTES.md","utf8").trimEnd();f.writeFileSync("amo/metadata.json",JSON.stringify(m,null,"\t")+"\n")'
```

The metadata is sent again with every listed version: AMO overwrites the listing with it.

### The add-on id

The id stays `robrowser-relay@robrowser.local` (`browser_specific_settings.gecko.id`), the id 0.1.0 and
0.2.0 were signed under, so AMO already knows the add-on by it. Firefox ties an
installed copy, its updates and its stored folder to that id: a new id is a new add-on, and copies installed
under the old one neither update to it nor keep their folder (the player installs again and drops the folder
again). The cost of keeping it: `.local` is not a domain anyone owns, which AMO accepts (an id only has to be
unique) but which reads as a placeholder on a public add-on. Change it, if at all, before the first listed
version, never after.

Install a signed xpi by dropping it on Firefox; it stays across restarts, and installing a newer version over it
keeps the stored folder.
