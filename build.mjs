// Writes the two packages from ext/: dist/firefox (ext/ as is) and dist/chrome (the manifest rewritten for
// Chrome). ext/manifest.json is Firefox's and the only one edited by hand.
//   node build.mjs
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const SRC = new URL('ext/', import.meta.url);
const DIST = new URL('dist/', import.meta.url);
// Chrome only: the frame that hands the folder to the page (Firefox does it through runtime messaging).
const CHROME_ONLY = ['bridge.html', 'bridge.js'];
// Kept across builds: web-ext sign resumes a submission that timed out from it.
const KEEP = '.amo-upload-uuid';

const firefox = JSON.parse(readFileSync(new URL('manifest.json', SRC), 'utf8'));

export function chromeManifest(m) {
	const { browser_specific_settings, ...chrome } = structuredClone(m);
	const [content] = chrome.content_scripts;
	// The Chrome Web Store takes 132 characters at most.
	chrome.description =
		'Private beta. Plays the roBrowser game pages on robrowser.suuuper.app from your own game client folder (GRF + BGM).';
	chrome.background = { service_worker: 'background.js' };
	// No blocking webRequest for a store extension: the CORS header comes from declarativeNetRequest rules.
	// webRequest stays, to observe (the popup's trace).
	chrome.permissions = m.permissions.filter((p) => p !== 'webRequestBlocking').concat('declarativeNetRequestWithHostAccess');
	content.js = ['browser.js', ...content.js];
	chrome.web_accessible_resources = [{ resources: ['bridge.html'], matches: content.matches }];
	return chrome;
}

function write(target, manifest, skip) {
	const out = new URL(`${target}/`, DIST);
	mkdirSync(out, { recursive: true });
	for (const name of readdirSync(out)) {
		if (name !== KEEP) {
			rmSync(new URL(name, out), { recursive: true });
		}
	}
	for (const name of readdirSync(SRC)) {
		if (name !== 'manifest.json' && name !== KEEP && !skip.includes(name)) {
			cpSync(new URL(name, SRC), new URL(name, out), { recursive: true });
		}
	}
	writeFileSync(new URL('manifest.json', out), JSON.stringify(manifest, null, '\t') + '\n');
	console.log(`dist/${target} ${manifest.version}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	write('firefox', firefox, CHROME_ONLY);
	write('chrome', chromeManifest(firefox), []);
}
