import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { kitVars, parseEnv, render } from '../player-kit/render.mjs';

const html = readFileSync(new URL('../player-kit/START-HERE.template.html', import.meta.url), 'utf8');
const txt = readFileSync(new URL('../player-kit/README.template.txt', import.meta.url), 'utf8');
const FF = 'https://addons.mozilla.org/firefox/addon/robrowser-relay/';
const CWS = 'https://chromewebstore.google.com/detail/robrowser-relay/abc';
const both = (env) => {
	const vars = kitVars(env, '9.9.9', '5.7 GB');
	return { html: render(html, vars), txt: render(txt, vars) };
};

test('store-links.env: the two keys, empty, and comments ignored', () => {
	const env = parseEnv(readFileSync(new URL('../player-kit/store-links.env', import.meta.url), 'utf8'));
	assert.deepEqual(env, { FIREFOX_STORE_URL: '', CHROME_STORE_URL: '' });
	assert.deepEqual(parseEnv('# X=1\nA_B = https://x/y \r\n'), { A_B: 'https://x/y' });
});

test('no store link: the manual installs, no store wording, no template left', () => {
	const out = both({});
	for (const text of [out.html, out.txt]) {
		assert.doesNotMatch(text, /\{\{|\}\}/);
		assert.doesNotMatch(text, /Without the store|Add to Firefox|Add to Chrome/);
		assert.match(text, /Install Add-on From File/);
		assert.match(text, /Load unpacked/);
		assert.match(text, /roBrowser-relay-9\.9\.9\.xpi/);
	}
	assert.match(out.html, /\(5\.7 GB\)/);
	assert.match(out.html, /src="data:image\/png;base64,/);
});

test('Firefox link only: Firefox from the store, its manual install folded, Chrome unchanged', () => {
	const out = both({ FIREFOX_STORE_URL: FF });
	for (const text of [out.html, out.txt]) {
		assert.ok(text.includes(FF));
		assert.match(text, /Add to Firefox/);
		assert.doesNotMatch(text, /Add to Chrome/);
		assert.equal(text.split('Without the store').length - 1, 1);
		assert.ok(text.indexOf(FF) < text.indexOf('Install Add-on From File'), 'the store first, the kit as the fallback');
	}
});

test('both links: two store installs, two folded fallbacks, the details balanced', () => {
	const out = both({ FIREFOX_STORE_URL: FF, CHROME_STORE_URL: CWS });
	for (const text of [out.html, out.txt]) {
		assert.ok(text.includes(FF) && text.includes(CWS));
		assert.equal(text.split('Without the store').length - 1, 2);
		assert.match(text, /Load unpacked/, 'the manual install stays, as the fallback');
	}
	assert.equal(out.html.split('<details').length, out.html.split('</details>').length);
});

test('a block left out leaves no blank line behind', () => {
	assert.equal(render('a\n{{#x}}\nb\n{{/x}}\nc\n', {}), 'a\nc\n');
	assert.equal(render('a\n{{#x}}\nb\n{{/x}}\nc\n', { x: true }), 'a\nb\nc\n');
	assert.throws(() => render('{{NOPE}}', {}), /NOPE/);
});

test('README.txt: 80 columns, except a URL', () => {
	for (const line of both({}).txt.split('\n')) {
		assert.ok(line.length <= 80 || /^\s*https:\/\/\S+$/.test(line), `${line.length}: ${line}`);
	}
});

test('the guides name no private-beta page', () => {
	for (const text of [html, txt]) {
		assert.doesNotMatch(text, /native-plugin-manager/);
	}
});

test('the game pages: cyro.live first, then the two robrowser.suuuper.app pages', () => {
	for (const text of [both({}).html, both({}).txt]) {
		const rb2 = text.indexOf('https://cyro.live/rb2/');
		assert.ok(rb2 > 0 && rb2 < text.indexOf('https://robrowser.suuuper.app/upstream/cyro.live/'));
		assert.ok(text.indexOf('https://robrowser.suuuper.app/upstream/cyro.live/') < text.indexOf('https://robrowser.suuuper.app/cyro/cyro.live/'));
	}
});

test('online copy: the extension alone, so it installs while the kit downloads', () => {
	const { html } = both({});
	assert.match(html, /class="online"[\s\S]*href="\.\.\/grf-offline-cyro\.zip"/);
	assert.match(html, /href="\.\.\/extensions\/roBrowser-relay-firefox\.xpi"/);
	assert.match(html, /href="\.\.\/extensions\/roBrowser-relay-chrome\.zip"/);
});

test('the announce: four links, the store pages once they exist', () => {
	const discord = readFileSync(new URL('../player-kit/DISCORD.template.md', import.meta.url), 'utf8');
	const kit = render(discord, kitVars({}, '9.9.9', '5.7 GB', 'https://files.example'));
	assert.doesNotMatch(kit, /\{\{|\}\}/);
	for (const link of ['/grf-offline-cyro.zip', '/extensions/roBrowser-relay-firefox.xpi', '/extensions/roBrowser-relay-chrome.zip', '/guide/START-HERE.html']) {
		assert.ok(kit.includes(`https://files.example${link}`), link);
	}
	assert.ok(kit.indexOf('https://cyro.live/rb2/') < kit.indexOf('https://robrowser.suuuper.app/upstream/cyro.live/'));
	const stores = render(discord, kitVars({ FIREFOX_STORE_URL: FF, CHROME_STORE_URL: CWS }, '9.9.9', '5.7 GB', 'https://files.example'));
	assert.ok(stores.includes(FF) && stores.includes(CWS));
	assert.doesNotMatch(stores, /\/extensions\/roBrowser-relay-/);
});
