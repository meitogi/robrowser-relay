const toggle = document.getElementById('enabled');
const grant = document.getElementById('grant');
const ORIGINS = { origins: ['https://cyro.localhost/*', 'https://robrowser.suuuper.app/*', 'https://cyro.live/*'] };

async function show() {
	const file = await dbGet('grf');
	toggle.checked = (await dbGet('enabled')) !== false;
	toggle.disabled = !file;
	const loose = Object.keys((await dbGet('root')) || {}).length;
	document.getElementById('grf').textContent = file
		? `${file.name}, ${(file.size / 1e9).toFixed(2)} GB + ${loose} loose files`
		: 'No GRF stored.';
	// Without host access the content script never runs on the game page.
	grant.hidden = await browser.permissions.contains(ORIGINS);
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

grant.addEventListener('click', async () => {
	await browser.permissions.request(ORIGINS);
	show();
});

document.getElementById('store').addEventListener('click', () => {
	browser.tabs.create({ url: browser.runtime.getURL('store.html') });
	window.close();
});

show();
