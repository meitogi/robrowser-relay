# roBrowser relay — privacy policy

roBrowser relay collects no data and sends nothing anywhere. It has no analytics, no telemetry and no
server of its own; its manifest declares `data_collection_permissions: none`.

## What it stores, and where

Only on your computer, in the extension's own storage (IndexedDB in your Firefox profile):

- the client folder you choose: the game archive (`data.grf`) and its loose files (`BGM/`, `AI/`, `System/`…);
- whether the relay is switched on or off.

Nothing else: no account, no password, no browsing history. Uninstalling the extension deletes this
storage. Choosing another folder replaces the stored one.

## What it hands over, and to whom

- **The client folder, to the game pages only**, inside Firefox: the roBrowser pages on
  `https://robrowser.suuuper.app/` and their local copy on your own machine, `https://cyro.localhost/`. The page asks for the files and gets
  them within the browser; they are never uploaded.
- **One response header on the game API.** While the relay is on, it adds `Access-Control-Allow-Origin` to
  the responses of `https://cyro.live/api/`, so that the game pages above may read them. It does not
  read, log or change anything else in those requests or responses, and it touches no other site.

The game page itself talks to the game server (`cyro.live`) as any online game client does; that traffic is
the page's, not the extension's.

## Contact

Questions: <https://github.com/meitogi/robrowser-relay/issues>.
