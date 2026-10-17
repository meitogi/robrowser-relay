// Bridge between the game page (https://cyro.localhost:6988, https://robrowser.suuuper.app/cyro.live/)
// and the extension.
// - <html data-ro-relay="ready|off|nogrf"> and a `ro-relay` event, detail { ready, state, name }, once the
//   extension state is known (relayState, state.js).
// - The page posts { roRelay: 'want-files' }, gets { roRelay: 'files', files: { grf, root } | null }.
// - The page posts { roRelay: 'used' } once it took the files: the toolbar icon of this tab is marked.
if (location.port === '6988' || location.hostname === 'robrowser.suuuper.app') {
	window.addEventListener('message', async (e) => {
		if (e.source !== window || !e.data) {
			return;
		}
		if (e.data.roRelay === 'used') {
			browser.runtime.sendMessage({ type: 'used' });
		} else if (e.data.roRelay === 'want-files') {
			let files = null;
			try {
				files = await browser.runtime.sendMessage({ type: 'files' });
			} catch (err) {
				console.warn('[roBrowser relay]', err);
			}
			window.postMessage(cloneInto({ roRelay: 'files', files }, window), location.origin);
		}
	});

	browser.runtime.sendMessage({ type: 'state' }).then((state) => {
		const relay = relayState(state.enabled, !!state.name);
		document.documentElement.dataset.roRelay = relay;
		window.dispatchEvent(
			new CustomEvent('ro-relay', { detail: cloneInto({ ready: relay === 'ready', state: relay, name: state.name }, window) })
		);
	});
}
