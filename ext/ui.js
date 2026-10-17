// Shared by the popup and the folder page: the status line (#status) and the host access button (#grant).
const ORIGINS = { origins: ['https://cyro.localhost/*', 'https://robrowser.suuuper.app/*', 'https://cyro.live/*'] };
const MARKS = { ready: '✓', nogrf: '⚠︎', off: '✗' };
const TITLES = { ready: 'Ready', nogrf: 'No client folder', off: 'Relay off' };

const gb = (size) => `${(size / 1e9).toFixed(2)} GB`;

// Fills #status from the stored folder and switch; returns what it read.
async function showStatus() {
	const grf = await dbGet('grf');
	const root = (await dbGet('root')) || {};
	const enabled = (await dbGet('enabled')) !== false;
	const state = relayState(enabled, !!grf);
	let loose = 0;
	for (const key in root) {
		loose++;
	}
	const box = document.getElementById('status');
	box.dataset.state = state;
	box.querySelector('.mark').textContent = MARKS[state];
	box.querySelector('strong').textContent = TITLES[state];
	box.querySelector('.detail').textContent = grf
		? `${grf.name} · ${gb(grf.size)} · ${loose} loose files`
		: 'Choose the folder that holds data.grf.';
	return { state, enabled, grf, root };
}

// Without host access the content script never runs on the game page: the button shows until it is granted.
// Returns whether access is granted.
async function showGrant() {
	const granted = await browser.permissions.contains(ORIGINS);
	document.getElementById('grant').hidden = granted;
	return granted;
}

document.getElementById('grant').addEventListener('click', async () => {
	await browser.permissions.request(ORIGINS);
	showGrant();
});
