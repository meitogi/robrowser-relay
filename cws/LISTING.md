# Chrome Web Store — what goes in each field

Pasted by hand in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) for the item
uploaded from `web-ext-artifacts/robrowser-relay-chrome-<version>.zip`. The summary is not here: the store
takes it from the manifest's `description` (`build.mjs`, 132 characters at most).

## Store listing

**Description**

```text
One GRF to rule them all, one GRF to find them,
One GRF to bring them all, and in the browser bind them.

roBrowser is a web client for the classic Midgard MMO (yes, the one with the bouncing pink jellies): it runs in a web page. It needs the game files (data.grf and its folder), which cannot be put on a web server for everyone: you bring your own.

roBrowser relay keeps that client folder inside Chrome, once, and hands it to the roBrowser game page you open: one folder for every server, no download per server, no copy of your files on anyone's server.

And no more staring at a loading bar that crawls because the server lags: maps, sprites and music come straight from your own disk, while the server only has to carry the game itself.

Private beta: for now it works only with the roBrowser game pages on https://robrowser.suuuper.app/, and nowhere else. They play one server today, cyro.live, in three builds:
- https://robrowser.suuuper.app/upstream/cyro.live/ — the roBrowser client as published upstream, open to everyone;
- https://robrowser.suuuper.app/native-plugin-manager/cyro.live/ — the build with the plugin manager, behind a beta access key;
- https://robrowser.suuuper.app/cyro/cyro.live/ — the client cyro.live serves on its own site, open to everyone.

cyro.live's own page, https://cyro.live/rb2/, plays from your folder too with a small userscript installed next to the extension: https://github.com/meitogi/robrowser-relay/tree/main/cyro-live-patch

How it works:
- Drop your client folder once on the welcome page (or pick it). It is stored in Chrome on your computer, never uploaded.
- Open a game page: it loads its maps, sprites and music from your folder.
- Switch the relay off from its toolbar button at any time.

The extension does not include any game data. You need a client folder of your own.

Source code and bug reports: https://github.com/meitogi/robrowser-relay

This extension is an independent, unofficial project, not affiliated with or endorsed by any game publisher.
```

| Field | Value |
|---|---|
| Category | Games or Entertainment, whichever the dashboard lists |
| Language | English |
| Store icon (128×128) | `ext/icons/icon-128.png` |
| Screenshots (1280×800) | `plans/public-release/shots/chrome-*.png` in the dev monorepo, taken in Chrome |
| Official URL | none |
| Homepage URL | `https://github.com/meitogi/robrowser-relay` |
| Support URL | `https://github.com/meitogi/robrowser-relay/issues` |

## Privacy

**Single purpose**

```text
Hands the user's own game client folder (data.grf and its loose files), stored once in the extension, to the roBrowser game pages on https://robrowser.suuuper.app/ (and https://cyro.live/rb2/ with the project's userscript) so they load their assets from it, and lets those pages read the responses of the game server's API (https://cyro.live/api/).
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `unlimitedStorage` | The client folder is stored in the extension's IndexedDB; the game archive alone is about 4.4 GB. |
| `webRequest` | Observing only, never blocking: the requests for game files (https://cyro.localhost/grf/*, https://robrowser.suuuper.app/grf/*, https://cyro.live/grf/*) are counted per tab, so the popup can say whether a game page still loads files from the server instead of the player's folder. Only the count is kept, in session storage. |
| `storage` | Session storage holds that per-tab count, so it survives the service worker going to sleep. |
| `declarativeNetRequestWithHostAccess` | https://cyro.live/api/ sends no Access-Control-Allow-Origin header. While the relay is switched on, two dynamic rules set it on the responses of https://cyro.live/api/ only, for requests made by the two game origins (https://robrowser.suuuper.app, https://cyro.localhost). Nothing is read, logged or redirected; the rules are removed when the relay is switched off. |
| Host permissions | https://robrowser.suuuper.app/*: the hosted game pages, where the content script runs and the extension frame that hands over the folder is embedded. https://cyro.localhost/*: the same game page served by the player's own machine (*.localhost resolves to loopback only). https://cyro.live/*: the API whose responses get the CORS header above, and the content script on https://cyro.live/rb2/, which hands the folder to that page when the project's cyro-live-patch userscript asks for it. |
| Remote code | No, I am not using remote code. Every script is in the package; the code is not minified or bundled. |

**Data usage**: tick none of the data types. Tick the three certifications (no sale to third parties, no
use unrelated to the single purpose, no use for creditworthiness or lending).

**Privacy policy URL**: `https://github.com/meitogi/robrowser-relay/blob/main/cws/PRIVACY.md`

## Distribution

| Field | Value |
|---|---|
| Visibility | **Unlisted** for the private beta: installable from the item's link, not shown in search. **Public** later. |
| Regions | all |
