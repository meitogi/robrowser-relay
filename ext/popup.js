const toggle = document.getElementById('enabled');
const store = document.getElementById('store');

document.getElementById('version').textContent = `version ${browser.runtime.getManifest().version}`;

async function show() {
	const { enabled, grf } = await showStatus();
	toggle.checked = enabled;
	store.classList.toggle('primary', !grf);
	showGrant();
	// The badge of the active tab says whether its page took the GRF.
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	const badge = tab ? await browser.action.getBadgeText({ tabId: tab.id }) : '';
	document.getElementById('tab').textContent = badge ? 'This tab uses the relay.' : '';
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
