const enabled = async () => (await dbGet('enabled')) !== false;

// Clears the "taken" badge on every tab (the relay was switched off or the GRF replaced).
async function clearBadges() {
	for (const tab of await browser.tabs.query({ url: ['https://cyro.localhost/*', 'https://robrowser.suuuper.app/*'] })) {
		browser.action.setBadgeText({ tabId: tab.id, text: '' });
	}
}

browser.runtime.onMessage.addListener(async (msg, sender) => {
	switch (msg.type) {
		// Asked by the content script at document_start: is there a relay for this page?
		case 'state': {
			const file = await dbGet('grf');
			return { enabled: await enabled(), name: file ? file.name : null, size: file ? file.size : 0 };
		}
		// The client folder by structured clone (Files go by reference). Nothing while the relay is off.
		case 'files':
			return (await enabled()) ? { grf: (await dbGet('grf')) || null, root: (await dbGet('root')) || {} } : null;
		// The page reports that it took the GRF: mark its tab.
		case 'used':
			browser.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#2e7d32' });
			browser.action.setBadgeText({ tabId: sender.tab.id, text: 'GRF' });
			return;
		// From the store page.
		case 'changed':
			relayOn = await enabled();
			await clearBadges();
			return;
	}
});

// cyro.live/api sends no Access-Control-Allow-Origin. While the relay is on the game page calls it
// directly instead of through its server's /api proxy (relay-sw.js): allow the game page origins.
const GAMES = ['https://cyro.localhost:6988', 'https://robrowser.suuuper.app'];
let relayOn = true;
enabled().then((on) => (relayOn = on));

browser.webRequest.onHeadersReceived.addListener(
	(details) => {
		const game = relayOn && details.originUrl && GAMES.find((o) => details.originUrl.startsWith(o + '/'));
		if (!game) {
			return;
		}
		const headers = details.responseHeaders.filter((h) => !/^access-control-allow-/i.test(h.name));
		headers.push({ name: 'Access-Control-Allow-Origin', value: game });
		if (details.method === 'OPTIONS') {
			headers.push({ name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' });
			headers.push({ name: 'Access-Control-Allow-Headers', value: '*' });
		}
		return { responseHeaders: headers };
	},
	{ urls: ['https://cyro.live/api/*'] },
	['blocking', 'responseHeaders']
);
