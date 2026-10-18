// Chrome only: a hidden frame that content.js adds to the game page when the page asks for the folder.
// Chrome's runtime messaging is JSON, which drops a File; window messaging structured-clones it, by
// reference: the multi-GB archive is not copied.
storedFiles()
	.catch((err) => {
		console.warn('[roBrowser relay]', err);
		return null;
	})
	.then((files) => parent.postMessage({ roRelayBridge: files }, location.ancestorOrigins[0]));
