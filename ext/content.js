// Bridge between the game page (https://cyro.localhost:6988, https://robrowser.suuuper.app/cyro.live/)
// and the extension.
// - <html data-ro-relay="ready|off"> and a `ro-relay` event once the extension state is known.
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
		const ready = state.enabled && !!state.name;
		document.documentElement.dataset.roRelay = ready ? 'ready' : 'off';
		window.dispatchEvent(new CustomEvent('ro-relay', { detail: cloneInto({ ready, name: state.name }, window) }));
	});
}
