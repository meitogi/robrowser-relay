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
96 px) and exported to `ext/icons/` with sharp (`tools/client-data/node_modules`).

## Sign (host only)

Bump `version` in `ext/manifest.json`, then:

```bash
export AMO_JWT_ISSUER=… AMO_JWT_SECRET=…
bash robrowser/tools/firefox-ext/relay/sign.sh
```

The signed xpi (unlisted: installable, not listed on AMO) goes to `relay/web-ext-artifacts/`. Install it by
dropping it on Firefox; it stays across restarts, and installing a newer version over it keeps the stored
folder.
