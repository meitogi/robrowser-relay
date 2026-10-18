const toggle = document.getElementById('enabled');
const store = document.getElementById('store');

document.getElementById('version').textContent = `version ${browser.runtime.getManifest().version}`;

async function show() {
	const { state, enabled, grf } = await showStatus();
	toggle.checked = enabled;
	// One highlighted button at a time: host access first, then the folder.
	store.classList.toggle('primary', (await showGrant()) && !grf);
	showChecks(state);
}

const CHECK_MARKS = { pass: '✓', warn: '⚠︎', fail: '✗', wait: '◷' };

// The active tab, when it is a game page and the relay is ready: one line per check (tabChecks, state.js).
async function showChecks(state) {
	const list = document.getElementById('checks');
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	const page = tab && gamePage(tab.url);
	list.hidden = !page || state !== 'ready';
	if (list.hidden) {
		return;
	}
	// The badge says the page took the folder; the content script, which userscript version it has.
	const used = !!(await browser.action.getBadgeText({ tabId: tab.id }));
	const reply = await browser.tabs.sendMessage(tab.id, { type: 'page' }).catch(() => undefined);
	const { network } = await browser.storage.session.get('network');
	// What the tab fetched, and what its page's service worker fetched for it (background.js, trace).
	const n = network || {};
	const fetched = (n[tab.id] || 0) + (n[`origin:${new URL(tab.url).origin}`] || 0);
	const checks = tabChecks({ page, patch: reply && reply.patch, used, network: fetched });
	list.replaceChildren(
		...checks.map(([level, text]) => {
			const li = document.createElement('li');
			li.dataset.level = level;
			li.append(Object.assign(document.createElement('span'), { className: 'mark', textContent: CHECK_MARKS[level] }), text);
			return li;
		})
	);
	document.getElementById('patch').hidden = !(page === 'patch' && reply && !reply.patch);
}

toggle.addEventListener('change', async () => {
	await dbPut('enabled', toggle.checked);
	await browser.runtime.sendMessage({ type: 'changed' });
	show();
});

store.addEventListener('click', () => {
	browser.tabs.create({ url: browser.runtime.getURL('store.html') });
	window.close();
});

show();
