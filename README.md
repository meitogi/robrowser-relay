# roBrowser relay — Firefox extension

**Private beta.** Plays the roBrowser Ragnarok Online web client on
[robrowser.suuuper.app](https://robrowser.suuuper.app/) with your own game files. It works only with those
game pages:

| Page | Client build |
|---|---|
| <https://robrowser.suuuper.app/upstream/cyro.live/> | roBrowser as published upstream, plus the fixes the relay needs. Open to everyone. |
| <https://robrowser.suuuper.app/native-plugin-manager/cyro.live/> | the build with the native plugin manager. Asks for a beta access key. |

You give the extension your client folder once (`data.grf` plus its loose files: `BGM/`, `AI/`, `System/`…).
It stays in Firefox, on your computer; nothing is uploaded. While the relay is on, the game page reads its
assets from that folder and calls the cyro.live API directly. The game socket goes straight to
`wss://cyro.live`.

Bugs and questions: [issues](https://github.com/meitogi/robrowser-relay/issues).

## Install and play

1. Install the extension (addons.mozilla.org, or a signed `.xpi` from the
   [releases](https://github.com/meitogi/robrowser-relay/releases) dropped on Firefox). The welcome page
   opens: click **Allow access to the game pages and cyro.live** if it is shown.
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
  `File`), `root` (`{ <lowercased path>: File }` for the loose files), `enabled`. Choosing the same
  `data.grf` again does not copy it again (same name, size and date).
- **Hand-over.** `content.js` runs on `robrowser.suuuper.app` and `cyro.localhost:6988` only. The page posts
  `{ roRelay: 'want-files' }`; the background answers with the stored `File`s, by structured clone, which
  passes references: 18 ms for the 4.4 GB archive, nothing copied.
- **Reads.** `relay-sw.js` parses the GRF (0x200 / 0x300) and resolves a request as a GRF file server
  would: loose files, then the archive, then the `data/resnametable.txt` alias. `POST /grf/`
  (`FileManager.search`) is answered from the file table. DES-encrypted entries are left to the network
  (the cyro archive has none).
- **Load-time signal.** Soon after `document_start` the page gets the relay's state, see
  [Page contract](#page-contract). The hosted pages' `gate.js` boots the client on `ready` only: no signal
  within 1.5 s means no extension, and the page says so instead of loading the client.
- **Badge.** When the page took the folder (`{ roRelay: 'used' }`) its tab's toolbar icon shows **GRF**.
- **CORS.** `cyro.live/api` sends no `Access-Control-Allow-Origin`. `webRequest.onHeadersReceived` adds it
  for the two game origins only (`https://robrowser.suuuper.app`, `https://cyro.localhost:6988`), while the
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

```bash
node --test test/*.test.mjs
npx web-ext@10.8.0 lint --source-dir ext
```

Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → `ext/manifest.json`. A
temporary add-on is removed when Firefox quits; it counts as an install, so the welcome page opens.

`https://cyro.localhost:6988/` is a local copy of the game page served from the player's own machine
(`*.localhost` resolves to loopback only); the relay treats it as a game page too. Its service worker's own
traffic (the direct `cyro.live/api` calls) is in `about:debugging` → **Service Workers** → the page's
origin → **Inspect**, not in the page's network panel.

The icons are drawn in `icons-src/` (`poring-small.svg` for 16 and 32 px, `poring-grf.svg` for 48 and
96 and 128 px) and exported to `ext/icons/` with [sharp](https://sharp.pixelplumbing.com/). The 128 px
one is the icon AMO shows on the listing.

## Release

Signing needs the AMO API keys, which stay on the maintainer's machine:

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
| [`metadata.json`](amo/metadata.json) | sent by `--channel=listed`: name, summary (≤ 250 characters), description, category `games-entertainment`, homepage (this repository) and support URL (its issues), licence `GPL-3.0-or-later`, and the reviewer notes (`version.approval_notes`) |
| [`REVIEWER-NOTES.md`](amo/REVIEWER-NOTES.md) | the readable copy of `version.approval_notes`: why `webRequestBlocking`, `unlimitedStorage` and each of the three hosts |
| [`PRIVACY.md`](amo/PRIVACY.md) | pasted by hand into Developer Hub → the add-on → **Edit Product Page** → privacy policy (the submission API does not take it) |

Edit `REVIEWER-NOTES.md`, then copy it into `metadata.json`:

```bash
node -e 'const f=require("fs"),m=JSON.parse(f.readFileSync("amo/metadata.json"));m.version.approval_notes=f.readFileSync("amo/REVIEWER-NOTES.md","utf8").trimEnd();f.writeFileSync("amo/metadata.json",JSON.stringify(m,null,"\t")+"\n")'
```

The metadata is sent again with every listed version: AMO overwrites the listing with it.

### The add-on id

The id stays `robrowser-relay@robrowser.local` (`browser_specific_settings.gecko.id`), the id 0.1.0 and
0.2.0 were signed under, so AMO already knows the add-on by it. Firefox ties an installed copy, its updates
and its stored folder to that id: a new id is a new add-on, and copies installed under the old one neither
update to it nor keep their folder (the player installs again and drops the folder again).

Install a signed xpi by dropping it on Firefox; it stays across restarts, and installing a newer version over it
keeps the stored folder.

## Licence

[GPL-3.0-or-later](LICENSE), the licence of roBrowserLegacy, whose pages this extension serves.

Ragnarok Online is a trademark of Gravity Co., Ltd. This project is not affiliated with or endorsed by Gravity.
