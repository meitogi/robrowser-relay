PLAY FROM YOUR OWN GAME FILES
=============================

The roBrowser relay is a browser extension. It lets the game pages load the
game from the files on your computer instead of downloading them again from
the server every time. Nothing is uploaded; your files stay in your browser.

About 10 minutes, once. Firefox, Chrome, Edge, Brave or Opera, on a computer.

START-HERE.html (double click it) is this same guide, with pictures.


1. BEFORE YOU START
-------------------

The kit holds:

  START-HERE.html     the guide, with pictures
  README.txt          this file
  extensions/
    firefox/          the extension for Firefox
    chrome/           the extension for Chrome, Edge, Brave, Opera
    tampermonkey/     the cyro.live patch (optional, step 6)
  game/               the game files: data.grf, BGM/, AI/, System/

Extract the whole zip into a folder you will keep, for example
Documents\grf-offline-cyro. Do not work from inside the zip. Keep about 12 GB
free while you install; once the game is ready you can delete the zip and
game/ (step 7).


2. INSTALL THE EXTENSION
------------------------

FIREFOX
{{#firefoxStore}}
  a. Open {{FIREFOX_STORE_URL}}
  b. Click "Add to Firefox", then "Add".

  Without the store (from the kit):
{{/firefoxStore}}
  a. Menu (three lines) > "Add-ons and themes" (or type about:addons in the
     address bar).
  b. The gear icon > "Install Add-on From File..."
  c. Pick extensions/firefox/{{XPI}}
  d. Firefox asks "Add roBrowser relay?" > "Add".
  (Dropping the .xpi file on a Firefox window does the same.)

CHROME, EDGE, BRAVE, OPERA
{{#chromeStore}}
  a. Open {{CHROME_STORE_URL}}
  b. Click "Add to Chrome", then "Add extension".

  Without the store (from the kit):
{{/chromeStore}}
  a. Type in the address bar: chrome://extensions
     (Edge: edge://extensions  Brave: brave://extensions
      Opera: opera://extensions)
  b. Turn on "Developer mode" (top right; in Edge, on the left).
  c. Click "Load unpacked".
  d. Select the folder extensions/chrome (the one that holds manifest.json)
     > "Select Folder".
  e. Pin it: the puzzle icon in the toolbar > the pin next to
     "roBrowser relay".
  ! The browser runs the extension FROM THAT FOLDER. Do not move, rename or
    delete extensions/chrome afterwards, or you start over.

Either way, a "Welcome - one step left" tab opens.


3. GIVE IT THE GAME FOLDER
--------------------------

  a. If you see "Allow access to the game pages and cyro.live", click it,
     then "Allow".
  b. Drag the game folder of the kit onto "Drop your client folder here"
     (or click that box and choose the game folder).
  c. If the browser asks "Upload files to this site?", answer yes: the "site"
     is the extension's own page, nothing leaves your computer.
  d. Wait about a minute. It shows "Ready".
  e. Click "Ready - open the game".

Later: the extension's icon in the toolbar > "Choose the client folder...".


4. OPEN THE GAME
----------------

Any of these, then log in with your cyro.live account as usual:

  https://robrowser.suuuper.app/upstream/cyro.live/
      Start here. roBrowser with the latest fixes.
  https://robrowser.suuuper.app/cyro/cyro.live/
      The client cyro.live serves on its own site, from this page.
  https://cyro.live/rb2/
      cyro.live's own page. Needs the patch of step 6 first.


5. CHECK THAT IT WORKS
----------------------

On the game page the extension's icon shows GRF. Click it, you should read:

  Ready                         the extension holds your game folder
  The page took your folder     this page uses it
  No game file from the server  everything came from your computer


6. OPTIONAL: CYRO.LIVE'S OWN PAGE
---------------------------------

Only for https://cyro.live/rb2/ - the robrowser.suuuper.app pages do not
need this.

  a. Install Tampermonkey for your browser: https://www.tampermonkey.net/
  b. Chrome, Edge, Brave, Opera: chrome://extensions > Tampermonkey >
     "Details" > turn on "Allow User Scripts" (older versions: "Developer
     mode", as in step 2).
  c. Open
     https://raw.githubusercontent.com/meitogi/robrowser-relay/main/cyro-live-patch/robrowser-relay-cyro.user.js
     Tampermonkey shows it > "Install".
  d. Reload https://cyro.live/rb2/ - the popup shows "cyro.live patch".

  The link does not open? Open
  extensions/tampermonkey/cyro-live-patch.user.js in a text editor, copy
  everything; Tampermonkey's icon > "Create a new script..." > paste over
  everything > File > Save.


7. FREE THE DISK SPACE
----------------------

Once it says "Ready", the browser keeps its own copy of the game files: you
can delete the zip and the game folder.

Installed from the kit on Chrome, Edge, Brave or Opera? KEEP
extensions/chrome: the browser runs the extension from it.


SOMETHING IS WRONG?
-------------------

"This page runs only with the roBrowser relay extension..."
    The extension is missing, off, or not allowed on the page. Step 2 again,
    or open its popup and click "Allow access..." if it is there. Reload.

"The roBrowser relay is off or holds no client folder..."
    Popup: turn "Relay on", or "Choose the client folder..." (step 3).
    Reload.

"The service worker does not control this page..."
    Reload normally (F5, Ctrl+R), not a forced reload. Private windows do
    not work.

"The page has not taken your folder: reload it"
    Reload the page.

"N game files from the server"
    The game still plays; those files came from the server because your
    game folder lacks them. A newer kit has them.

"cyro.live patch not installed"
    Only matters on cyro.live/rb2: step 6.

The extension vanished or shows an error (Chrome, Edge...)
    extensions/chrome was moved or deleted. Put it back, or load it again
    from its new place (step 2), then give the game folder again (step 3).


A NEW VERSION
-------------

New extension, Firefox: install the new .xpi as in step 2. Your game folder
stays.

New extension, Chrome, Edge, Brave, Opera (from the kit): replace the
content of extensions/chrome with the new one, AT THE SAME PLACE, then
chrome://extensions > the reload arrow on roBrowser relay. Your game folder
stays.

New game files: popup > "Choose the client folder..." > drop the new game
folder.


roBrowser relay {{VERSION}} - an independent, unofficial project.
Bugs and questions: https://github.com/meitogi/robrowser-relay/issues
