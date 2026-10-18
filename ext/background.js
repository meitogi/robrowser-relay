// Chrome runs this file alone, as the service worker: it loads the shared scripts itself.
if (typeof importScripts === 'function') {
	importScripts('browser.js', 'db.js');
}

const enabled = async () => (await dbGet('enabled')) !== false;

// First install: the folder page, on its welcome step.
browser.runtime.onInstalled.addListener(({ reason }) => {
	if (reason === 'install') {
		browser.tabs.create({ url: browser.runtime.getURL('store.html#welcome') });
	}
});

// Clears the "taken" badge on every tab (the relay was switched off or the GRF replaced).
async function clearBadges() {
	for (const tab of await browser.tabs.query({ url: ['https://cyro.localhost/*', 'https://robrowser.suuuper.app/*'] })) {
		browser.action.setBadgeText({ tabId: tab.id, text: '' });
	}
}

async function answer(msg, sender) {
	switch (msg.type) {
		// Asked by the content script at document_start: is there a relay for this page?
		case 'state': {
			const file = await dbGet('grf');
			return { enabled: await enabled(), name: file ? file.name : null, size: file ? file.size : 0 };
		}
		// The client folder by structured clone (Files go by reference), Firefox only. Nothing while the relay is off.
		case 'files':
			return storedFiles();
		// The page reports that it took the GRF: mark its tab.
		case 'used':
			browser.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#2e7d32' });
			browser.action.setBadgeText({ tabId: sender.tab.id, text: 'GRF' });
			return;
		// From the store page.
		case 'changed':
			await cors();
			await clearBadges();
			return;
	}
}

// sendResponse rather than a returned promise: Chrome does not take the promise.
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	answer(msg, sender).then(sendResponse);
	return true;
});

// cyro.live/api sends no Access-Control-Allow-Origin. While the relay is on the game page calls it
// directly instead of through its server's /api proxy (relay-sw.js): allow the game page origins.
// Firefox adds the header with blocking webRequest; Chrome has none for a store extension, so there
// declarativeNetRequest rules (the manifest asks for one or the other) exist while the relay is on.
const GAMES = ['https://cyro.localhost:6988', 'https://robrowser.suuuper.app'];
const DNR = browser.declarativeNetRequest;
const RULES = GAMES.map((game, i) => ({
	id: i + 1,
	priority: 1,
	action: {
		type: 'modifyHeaders',
		responseHeaders: [
			{ header: 'Access-Control-Allow-Origin', operation: 'set', value: game },
			{ header: 'Access-Control-Allow-Methods', operation: 'set', value: 'GET, POST, OPTIONS' },
			{ header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' }
		]
	},
	condition: { urlFilter: '|https://cyro.live/api/', initiatorDomains: [new URL(game).hostname] }
}));
let relayOn = true;

async function cors() {
	relayOn = await enabled();
	if (DNR) {
		await DNR.updateDynamicRules({ removeRuleIds: RULES.map((r) => r.id), addRules: relayOn ? RULES : [] });
	}
}
cors();

if (!DNR) {
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
}
