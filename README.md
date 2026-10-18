# roBrowser relay — Firefox and Chrome extension

**Private beta.** Plays roBrowser, the web client of the classic Midgard MMO, on
[robrowser.suuuper.app](https://robrowser.suuuper.app/) with your own game files. It works only with those
game pages:

| Page | Client build |
|---|---|
| <https://robrowser.suuuper.app/upstream/cyro.live/> | roBrowser as published upstream, plus the fixes the relay needs. Open to everyone. |
| <https://robrowser.suuuper.app/native-plugin-manager/cyro.live/> | the build with the native plugin manager. Asks for a beta access key. |
| <https://robrowser.suuuper.app/cyro/cyro.live/> | the client cyro.live serves on its own site. Open to everyone. |
| <https://cyro.live/rb2/> | cyro.live's own page, with the [cyro-live-patch](cyro-live-patch/) userscript installed next to the extension. |

You give the extension your client folder once (`data.grf` plus its loose files: `BGM/`, `AI/`, `System/`…).
It stays in the browser, on your computer; nothing is uploaded. While the relay is on, the game page reads its
assets from that folder and calls the cyro.live API directly. The game socket goes straight to
`wss://cyro.live`.

Bugs and questions: [issues](https://github.com/meitogi/robrowser-relay/issues).

## Install and play

1. Install the extension. Firefox: addons.mozilla.org, or a signed `.xpi` from the
   [releases](https://github.com/meitogi/robrowser-relay/releases) dropped on Firefox. Chrome (and Edge):
   the Chrome Web Store, or the release's `-chrome.zip` unzipped and loaded with **Load unpacked** in
   `chrome://extensions` (developer mode on). The welcome page opens: click **Allow access to the game pages
   and cyro.live** if it is shown.
2. Drop your client folder on the page (the folder that holds `data.grf`), or click to pick it. Expect ✓
   **Ready**. Firefox's folder picker does not follow symlinks: a linked `BGM/` comes in empty, so copy it.
3. **Ready — open the game**, or open one of the pages above.

The toolbar icon opens the popup: the relay's state, the stored archive, the on/off switch and **Choose the
client folder…**. When a page took the folder, its tab's icon shows **GRF**.

## How it runs

It is the second half of a pair. The first half is served by the game page itself: a service worker
(`sw.js`) that imports `pwa/relay-sw.js`, and `pwa/relay-client.js` in the page. On the hosted pages they
come from the roBrowserLegacy fork, `.github/pages-sites/shared/`.

| File | Layer | Role |
|---|---|---|
| `sw.js` | page shell | Service worker. `api.html`, scripts, workers, plugins: network first, the last good copy when the server is down. Never caches `/grf/` nor the API. |
| `pwa/relay-sw.js` | relay | Imported by `sw.js`. Its fetch listener answers `/grf/` from the relay's folder and sends `/userconfig`, `/emblem`, `/api` to `https://cyro.live/api`, while the relay is on. Off: the network, as before. |
| `pwa/relay-client.js` | relay | Gets the folder from this extension and hands it to the service worker (again when a restarted worker asks). |
| `ext/` | relay | This extension. |

- **Storage.** The folder is kept in the extension's IndexedDB (`unlimitedStorage`): `grf` (the archive
  `File`), `root` (`{ <lowercased path>: File }` for the loose files), `enabled`. Both browsers copy the
  archive into the profile (Chrome: 4.4 GB in 22 s); choosing the same `data.grf` again does not copy it
  again (same name, size and date).
- **Hand-over.** `content.js` runs on `robrowser.suuuper.app` and `cyro.localhost:6988` only. The page posts
  `{ roRelay: 'want-files' }` and gets the stored `File`s by structured clone, which passes references:
  nothing copied. Firefox: the background answers over runtime messaging, 18 ms for the 4.4 GB archive.
  Chrome's runtime messaging is JSON, which drops a `File`: `content.js` adds a hidden frame of the
  extension, `bridge.html`, which reads the IndexedDB and posts the `File`s to the page by window messaging
  (4 ms, the page's heap flat).
- **Reads.** `relay-sw.js` parses the GRF (0x200 / 0x300) and resolves a request as a GRF file server
  would: loose files, then the archive, then the `data/resnametable.txt` alias. `POST /grf/`
  (`FileManager.search`) is answered from the file table. DES-encrypted entries are left to the network
  (the cyro archive has none).
- **Load-time signal.** Soon after `document_start` the page gets the relay's state, see
  [Page contract](#page-contract). The hosted pages' `gate.js` boots the client on `ready` only: no signal
  within 1.5 s means no extension, and the page says so instead of loading the client.
- **Badge.** When the page took the folder (`{ roRelay: 'used' }`) its tab's toolbar icon shows **GRF**.
- **Checks.** On a game page, the popup lists, for its tab: the kind of page (one with the relay's page side
  built in, or cyro.live's own page with the [cyro-live-patch](cyro-live-patch/) userscript, whose version the
  page carries in `data-ro-relay-patch`), whether the page took the folder, and how many game files it still
  fetched from the server (✓ none, ⚠︎ some: the folder lacks them). That count comes from observing the
  `/grf/` requests of the game hosts (`webRequest.onBeforeRequest`, no blocking), per tab, and per page
  origin for those a page's service worker sends with no tab; it starts again when the tab loads a page and
  is kept in `storage.session`. `gamePage()` and `tabChecks()` in `ext/state.js` decide, tested in
  `test/relay-state.test.mjs`.
- **CORS.** `cyro.live/api` sends no `Access-Control-Allow-Origin`. It is added for the two game origins
  only (`https://robrowser.suuuper.app`, `https://cyro.localhost:6988`), while the relay is on. Firefox:
  `webRequest.onHeadersReceived`. Chrome has no blocking webRequest for a store extension: two
  `declarativeNetRequest` dynamic rules (`modifyHeaders`, by initiator), added when the relay is switched on
  and removed when it is switched off. Preflights and the service worker's own requests are covered.
- **Popup.** The relay's name and version, one status line with a mark — ✓ **Ready**, ⚠︎ **No client
  folder**, ✗ **Relay off** (the [page contract](#page-contract) states) — and the stored archive's name,
  size and loose-file count, then whether this tab uses the relay, the on/off switch, **Allow access to the
  game pages and cyro.live** (only while that host access is missing) and **Choose the client folder…**
  (highlighted while no folder is stored). Light and dark follow the system theme.
- **Install page.** On a first install (`runtime.onInstalled`, `reason === 'install'`) the background opens
  `store.html#welcome`: the same folder page, titled as a welcome step. It says in three lines what the relay
  does, shows the same status line and access button as the popup, takes the client folder by drag and drop
  or the picker (or only a `.grf`), shows progress while it reads and stores, then **Ready — open the game**
  (`https://robrowser.suuuper.app/upstream/cyro.live/`) once the state is `ready`. Updates do not open it.
- **Shared files.** `state.js` (the state), `ui.css` (the look, light and dark), `ui.js` (status line and
  access button) are loaded by both the popup and the folder page.

Measured in Firefox on the cyro archive (4.42 GB, v0x300, 290 305 entries): file table inflated in 95 ms
and parsed in 23 ms (once per service-worker start), 1000 random entries at 1.75 ms average (worst 123 ms).

## Page contract

On the game pages only (`https://robrowser.suuuper.app/*`, `https://cyro.localhost/*`), `content.js` asks
the background for the state once, right after `document_start`, then publishes it twice, in this order:

1. `document.documentElement.dataset.roRelay` (the `data-ro-relay` attribute of `<html>`) = the state;
2. a `ro-relay` `CustomEvent` on `window`, `detail` = `{ ready, state, name }`.

| `state` | Meaning | `ready` | `name` |
|---|---|---|---|
| `ready` | relay on, client folder stored | `true` | the stored archive's file name (`"data.grf"`) |
| `nogrf` | relay on, no client folder stored | `false` | `null` |
| `off` | relay switched off in the popup, folder or not | `false` | the stored archive's name, or `null` |
| *(nothing)* | extension not installed, disabled, or no host access | — | — |

- One function decides the state, `relayState(enabled, hasGrf)` in `ext/state.js`, shared by the popup and
  the content script (tested in `test/relay-state.test.mjs`).
- The state is read once per page load: switching the relay or choosing a folder shows on the next load.
- A page that only cares about booting keeps reading `ready` (or `data-ro-relay === 'ready'`); `state`
  tells it which message to show. A page script may run after the attribute is set and miss the event:
  read the attribute first, then listen.
- 0.2.0 and older publish `ready|off` only and no `state` (`nogrf` was folded into `off`).

## Known limits

- Switching the relay off reaches the service worker at the next page load; the badge clears at once.
- The client's `/userconfig` call gives up after 5 s (`xhr.timeout` in `ShortCut.js`), whatever the route.
- Firefox for macOS does not install PWAs; the offline shell works in a normal tab.

## Develop

`ext/` is the source of both packages, and `ext/manifest.json` is Firefox's. `node build.mjs` writes
`dist/firefox` (`ext/` without the Chrome-only `bridge.*`) and `dist/chrome` (all of `ext/`, its manifest
derived from Firefox's: service worker, `declarativeNetRequestWithHostAccess` instead of `webRequest*`,
`bridge.html` web-accessible to the game pages, no `browser_specific_settings`). Edit `ext/`, never `dist/`.
The code is shared: `browser.js` aliases `browser` to `chrome`, and where the two differ the manifest
decides (`declarativeNetRequest` present or not) or Firefox's `cloneInto` does.

```bash
node build.mjs
node --test test/*.test.mjs
npx web-ext@10.8.0 lint --source-dir dist/firefox
```

Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → `dist/firefox/manifest.json`.
A temporary add-on is removed when Firefox quits; it counts as an install, so the welcome page opens.

Chrome: `chrome://extensions` → developer mode → **Load unpacked** → `dist/chrome`. After a rebuild, its
reload arrow on that page.

`https://cyro.localhost:6988/` is a local copy of the game page served from the player's own machine
(`*.localhost` resolves to loopback only); the relay treats it as a game page too. Its service worker's own
traffic (the direct `cyro.live/api` calls) is in `about:debugging` → **Service Workers** → the page's
origin → **Inspect**, not in the page's network panel.

The icons are drawn in `icons-src/` (`poring-small.svg` for 16 and 32 px, `poring-grf.svg` for 48 and
96 and 128 px) and exported to `ext/icons/` with [sharp](https://sharp.pixelplumbing.com/). The 128 px
one is the icon AMO and the Chrome Web Store show on the listing.

## Release

The same version goes to both stores, from `ext/manifest.json`.

Firefox: signing needs the AMO API keys, which stay on the maintainer's machine:

```bash
export AMO_JWT_ISSUER=… AMO_JWT_SECRET=…   # addons.mozilla.org > Developer Hub > Manage API Keys
./sign.sh --channel=listed     # public AMO page
./sign.sh --channel=unlisted   # or: signed xpi, direct link only
```

Bump `version` in `ext/manifest.json` first: AMO refuses a version it has already seen. `./sign.sh` alone is
`--channel=unlisted`. `--dry-run` prints the `web-ext sign` command line and stops (no lint, no network, no
keys needed). Otherwise the script lints, then signs; its output goes to `sign-<date>.log`. Attach the signed
xpi from `web-ext-artifacts/` to a GitHub release named after the version.

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
| [`metadata.json`](amo/metadata.json) | sent by `--channel=listed`: name, summary (≤ 250 characters), description, category `games-entertainment`, homepage (this repository) and support URL (its issues), licence `GPL-3.0-only` (AMO has no or-later slug; the repository stays GPL-3.0-or-later, which allows it), and the reviewer notes (`version.approval_notes`) |
| [`REVIEWER-NOTES.md`](amo/REVIEWER-NOTES.md) | the readable copy of `version.approval_notes`: why `webRequestBlocking`, `unlimitedStorage` and each of the three hosts |
| [`PRIVACY.md`](amo/PRIVACY.md) | pasted by hand into Developer Hub → the add-on → **Edit Product Page** → privacy policy (the submission API does not take it) |

Edit `REVIEWER-NOTES.md`, then copy it into `metadata.json`:

```bash
node -e 'const f=require("fs"),m=JSON.parse(f.readFileSync("amo/metadata.json"));m.version.approval_notes=f.readFileSync("amo/REVIEWER-NOTES.md","utf8").trimEnd();f.writeFileSync("amo/metadata.json",JSON.stringify(m,null,"\t")+"\n")'
```

The metadata is sent again with every listed version: AMO overwrites the listing with it.

### The add-on id

The id is `robrowser-relay@meitogi.github.io` (`browser_specific_settings.gecko.id`) from 0.3.0 on, the
first version signed by meitogi's AMO account. 0.1.0 and 0.2.0 (release v0.2.0) were signed under
`robrowser-relay@robrowser.local` by another account: for Firefox and AMO that is another add-on. A copy
installed under the old id does not update to 0.3.0 and does not hand its folder over: remove it from
`about:addons`, install 0.3.0, drop the folder again. Two copies installed side by side would both answer
the page, so the old one has to go.

Firefox ties an installed copy, its updates and its stored folder to the id: never change it again.

Install a signed xpi by dropping it on Firefox; it stays across restarts, and installing a newer version over it
keeps the stored folder.

### Chrome Web Store (`cws/`)

Chrome has no signing step on this side: the store signs what it publishes. Build the zip, then upload it
by hand in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) (meitogi's Google
account):

```bash
node build.mjs
npx web-ext@10.8.0 build --source-dir dist/chrome --artifacts-dir web-ext-artifacts \
	--filename 'robrowser-relay-chrome-{version}.zip' --overwrite-dest
```

The store also refuses a version it has already seen. Attach the same zip to the GitHub release, for loading
unpacked.

| File | Goes to |
|---|---|
| [`PUBLISH.md`](cws/PUBLISH.md) | the steps: developer account, first submission, updates |
| [`LISTING.md`](cws/LISTING.md) | the dashboard's **Store listing** and **Privacy** tabs, field by field: summary, description, category, single purpose, the reason for each permission, the data usage answers |
| [`PRIVACY.md`](cws/PRIVACY.md) | the privacy policy, linked by its GitHub URL in the **Privacy** tab |

Chrome's extension id comes from the store at the first upload (an unpacked copy gets another one, from its
folder's path). As in Firefox, the stored folder belongs to that id: a player moving from an unpacked copy
to the store's drops the folder again.

### The players' kit (`player-kit/`)

Players get one zip, `grf-offline-cyro.zip`: the guides at its root (`START-HERE.html`, `README.txt`),
`extensions/` (the signed xpi, `dist/chrome` for **Load unpacked**, the cyro-live-patch userscript) and
`game/` (the client folder). `player-kit/render.mjs` writes the guides from the two templates beside it,
screenshots from `cws/screenshots/` inlined. The zip and the online copy of the guide are built and
uploaded by `wtf relay kit-publish` from the monorepo (`robrowser/tools/client-data/grf-offline-publish.sh`),
after `./sign.sh` signed the manifest's version.

When a store publishes the extension: paste its page's URL in
[`player-kit/store-links.env`](player-kit/store-links.env) and publish the kit again. That browser's step
becomes the store install, the manual one folds under it.

## Licence

[GPL-3.0-or-later](LICENSE), the licence of roBrowserLegacy, whose pages this extension serves.

An independent, unofficial project, not affiliated with or endorsed by any game publisher.
