The extension hands a Ragnarok Online client folder the user owns (data.grf, several GB, plus loose files) to one browser game page, https://robrowser.suuuper.app/cyro.live/ (or its local copy on https://cyro.localhost/), so the page can load its assets without a file server. The code is not minified or bundled: the submitted files are the source.

Test: install, open the welcome page (it opens on install), click "Allow access…", then drop any folder holding a .grf file (an empty file renamed test.grf is enough for the extension; the game itself needs a real client). The popup then shows "Ready". On https://robrowser.suuuper.app/cyro.live/ the <html> element gets data-ro-relay="ready".

Permissions:
- webRequest + webRequestBlocking: https://cyro.live/api/ (the game server's API) sends no Access-Control-Allow-Origin header. While the relay is switched on, background.js adds it on the responses of https://cyro.live/api/* only, with the requesting origin as the value, and only when that origin is one of the two game pages. Nothing is read, logged or redirected.
- unlimitedStorage: the client folder is stored in the extension's IndexedDB; the archive alone is about 4.4 GB.
- Host https://cyro.live/*: needed for the webRequest listener on https://cyro.live/api/*.
- Host https://robrowser.suuuper.app/*: the hosted game page; content.js runs on /cyro.live/* only, and the background clears its toolbar badge on those tabs (tabs.query by URL).
- Host https://cyro.localhost/*: the same game page served by the player's own machine (*.localhost resolves to loopback only).

No remote code, no data collection (data_collection_permissions: none), no network request made by the extension itself.
