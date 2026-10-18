// Bridge between the game pages (https://cyro.localhost:6988, https://robrowser.suuuper.app/<build>/<server>/)
// and the extension.
// - <html data-ro-relay="ready|off|nogrf"> and a `ro-relay` event, detail { ready, state, name }, once the
//   extension state is known (relayState, state.js).
// - The page posts { roRelay: 'want-files' }, gets { roRelay: 'files', files: { grf, root } | null }.
// - The page posts { roRelay: 'used' } once it took the files: the toolbar icon of this tab is marked.
if (location.port === '6988' || location.hostname === 'robrowser.suuuper.app') {
	// Firefox only: objects handed to the page cross from this script's compartment.
	const FIREFOX = typeof cloneInto === 'function';
	const clone = (value) => (FIREFOX ? cloneInto(value, window) : value);

	// Firefox structured-clones the Files through runtime messaging. Chrome's is JSON: a hidden frame of the
	// extension (bridge.html) reads them and posts them here.
	function storedFiles() {
		if (FIREFOX) {
			return browser.runtime.sendMessage({ type: 'files' });
		}
		return new Promise((resolve) => {
			const frame = document.createElement('iframe');
			frame.src = browser.runtime.getURL('bridge.html');
			frame.hidden = true;
			window.addEventListener('message', function on(e) {
				if (e.source === frame.contentWindow && e.data && 'roRelayBridge' in e.data) {
					window.removeEventListener('message', on);
					frame.remove();
					resolve(e.data.roRelayBridge);
				}
			});
			document.documentElement.append(frame);
		});
	}

	window.addEventListener('message', async (e) => {
		if (e.source !== window || !e.data) {
			return;
		}
		if (e.data.roRelay === 'used') {
			browser.runtime.sendMessage({ type: 'used' });
		} else if (e.data.roRelay === 'want-files') {
			let files = null;
			try {
				files = await storedFiles();
			} catch (err) {
				console.warn('[roBrowser relay]', err);
			}
			window.postMessage(clone({ roRelay: 'files', files }), location.origin);
		}
	});

	browser.runtime.sendMessage({ type: 'state' }).then((state) => {
		const relay = relayState(state.enabled, !!state.name);
		document.documentElement.dataset.roRelay = relay;
		window.dispatchEvent(
			new CustomEvent('ro-relay', { detail: clone({ ready: relay === 'ready', state: relay, name: state.name }) })
		);
	});
}
