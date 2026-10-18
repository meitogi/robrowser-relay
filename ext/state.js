// The relay's state, as the game page and the popup see it:
// - `off`: switched off in the popup (whether or not a folder is stored);
// - `nogrf`: on, but no client folder stored yet;
// - `ready`: on, with a client folder.
const relayState = (enabled, hasGrf) => (!enabled ? 'off' : hasGrf ? 'ready' : 'nogrf');

// Which game page an address is, for the popup's checks: `native` (the page carries the relay's page side),
// `patch` (cyro.live's own page, which needs the cyro-live-patch userscript) or null.
function gamePage(url) {
	let u;
	try {
		u = new URL(url);
	} catch {
		return null;
	}
	// cyro.localhost:6988 is the local copy of either kind of page.
	const local = u.hostname === 'cyro.localhost' && u.port === '6988';
	if (u.hostname === 'cyro.live' || (local && u.pathname.startsWith('/rb2/'))) {
		return u.pathname.startsWith('/rb2/') ? 'patch' : null;
	}
	return (local || u.hostname === 'robrowser.suuuper.app') && u.pathname.endsWith('/api.html') ? 'native' : null;
}

// The popup's checks for a game tab, as [level, text]: `pass`, `warn`, `fail` or `wait` (not yet).
// - page: gamePage(); patch: the userscript's version, null when the page has none, undefined when the
//   page did not answer (opened before the extension);
// - used: the page took the folder (its badge); network: game files it fetched from the server since it loaded.
function tabChecks({ page, patch, used, network }) {
	const checks = [];
	if (patch === undefined) {
		return [['wait', 'Reload this page to check it.']];
	}
	if (page === 'native') {
		checks.push(['pass', 'Game page with the relay built in']);
	} else if (patch) {
		checks.push(['pass', `cyro.live patch ${patch}`]);
	} else {
		checks.push(['fail', 'cyro.live patch not installed']);
	}
	checks.push(used ? ['pass', 'The page took your folder'] : ['wait', 'The page has not taken your folder: reload it']);
	if (!network) {
		checks.push(['pass', 'No game file from the server']);
	} else {
		const files = `${network} game file${network === 1 ? '' : 's'} from the server`;
		checks.push(['warn', used ? `${files}: your folder lacks them` : files]);
	}
	return checks;
}
