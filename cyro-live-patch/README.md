# cyro-live-patch — the relay on cyro.live's own page

A Tampermonkey userscript that lets <https://cyro.live/rb2/> play from the client folder the roBrowser relay
extension holds, as the robrowser.suuuper.app pages do. Nothing changes on cyro.live's side.

## Install

1. The roBrowser relay extension, with a client folder stored (✓ **Ready** in its popup).
2. [Tampermonkey](https://www.tampermonkey.net/), then open
   [robrowser-relay-cyro.user.js](https://raw.githubusercontent.com/meitogi/robrowser-relay/main/cyro-live-patch/robrowser-relay-cyro.user.js)
   and click **Install**. Tampermonkey updates it from the same link.
3. Open <https://cyro.live/rb2/>: the extension's toolbar icon shows **GRF** once the page took the folder.

Without the extension, with the relay switched off or with no folder stored, the page plays as before,
from cyro.live's servers.

## How it works

The cyro client can already read a player's own client files: at boot it sends its asset worker one
message, `CLIENT_INIT`, with the list of files to read before the network. On cyro.live that list is empty.
The userscript wraps `Worker.prototype.postMessage` at `document-start`; when that empty `CLIENT_INIT` goes
out and the page carries `data-ro-relay="ready"`, it asks the relay for the folder (the extension's
[page contract](../README.md#page-contract)) and fills the list with `data.grf` and the loose files. The
worker then reads them itself; whatever the folder lacks still comes from cyro.live. Messages sent to the
worker while the folder is asked for are held and sent after it, in order.

The extension side is `content.js` running on `https://cyro.live/*`: it publishes the relay's state and
answers `want-files` there as on the other game pages. No CORS rule is needed: the API is on the page's
own origin.

Checked in Chromium on cyro's production bundle (`Online.js`, `ThreadEventHandler.js`) served locally with
cyro.live unreachable: without the userscript the page stays on its loading bar; with it, the login screen
renders from the folder and the badge shows **GRF**; relay switched off, the page is the same as without.
