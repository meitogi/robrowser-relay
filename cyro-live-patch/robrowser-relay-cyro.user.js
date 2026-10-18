// ==UserScript==
// @name         roBrowser relay for cyro.live
// @namespace    https://github.com/meitogi/robrowser-relay
// @version      0.1.1
// @description  Plays https://cyro.live/rb2/ from your own client folder, held by the roBrowser relay extension. Without the extension the page plays as before.
// @homepageURL  https://github.com/meitogi/robrowser-relay/tree/main/cyro-live-patch
// @supportURL   https://github.com/meitogi/robrowser-relay/issues
// @match        https://cyro.live/rb2/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/meitogi/robrowser-relay/main/cyro-live-patch/robrowser-relay-cyro.user.js
// @downloadURL  https://raw.githubusercontent.com/meitogi/robrowser-relay/main/cyro-live-patch/robrowser-relay-cyro.user.js
// @license      GPL-3.0-or-later
// ==/UserScript==

// The client hands its asset worker the player's own client files in one message, CLIENT_INIT
// ({ type, data: { files: [{ file, path }], … }, uid }); on cyro.live that list is empty, so every asset
// comes from cyro.live/grf/. This fills it with the folder the relay holds: the worker then reads data.grf
// and the loose files itself, before the network. Asked through the relay's page contract (README § Page
// contract): { roRelay: 'want-files' } → { roRelay: 'files', files: { grf, root } | null }.
(() => {
	const VERSION = '0.1.1';
	const WAIT = 1000;
	const post = Worker.prototype.postMessage;
	// Messages a worker is sent while the folder is being asked for, kept in order.
	const held = new WeakMap();

	function relayFiles() {
		return new Promise((resolve) => {
			const timer = setTimeout(() => resolve(null), WAIT);
			window.addEventListener('message', function on(e) {
				if (e.source === window && e.data && e.data.roRelay === 'files') {
					window.removeEventListener('message', on);
					clearTimeout(timer);
					resolve(e.data.files || null);
				}
			});
			window.postMessage({ roRelay: 'want-files' }, location.origin);
		});
	}

	// The relay's folder as the client's file list: paths relative to the client folder (case does not matter
	// to the worker).
	function fileList(files) {
		const list = [{ file: files.grf, path: files.grf.name }];
		for (const path in files.root) {
			list.push({ file: files.root[path], path });
		}
		return list;
	}

	Worker.prototype.postMessage = function (message, ...rest) {
		const queue = held.get(this);
		if (queue) {
			// Thread.js reuses one message object for every send: keep a copy.
			queue.push([structuredClone(message), rest]);
			return;
		}
		const init = message && message.type === 'CLIENT_INIT' && message.data && message.data.files;
		// Only when the relay said it is ready (data-ro-relay, set long before the client boots) and the
		// client brought no files of its own.
		if (!init || init.length || document.documentElement.dataset.roRelay !== 'ready') {
			return post.call(this, message, ...rest);
		}
		const pending = [[structuredClone(message), rest]];
		held.set(this, pending);
		relayFiles().then((files) => {
			if (files && files.grf) {
				pending[0][0].data.files = fileList(files);
				window.postMessage({ roRelay: 'used' }, location.origin);
			}
			held.delete(this);
			for (const [m, r] of pending) {
				post.call(this, m, ...r);
			}
		});
	};

	// Tells the relay's popup that the patch is on this page. At document-start <html> may not exist yet.
	const mark = () => (document.documentElement.dataset.roRelayPatch = VERSION);
	if (document.documentElement) {
		mark();
	} else {
		new MutationObserver((records, observer) => {
			if (document.documentElement) {
				observer.disconnect();
				mark();
			}
		}).observe(document, { childList: true });
	}
})();
