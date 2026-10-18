import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

// state.js is a plain script (popup <script>, content script), not a module: run it and read the global.
const { relayState, gamePage, tabChecks } = runInNewContext(
	`${readFileSync(new URL('../ext/state.js', import.meta.url), 'utf8')}; ({ relayState, gamePage, tabChecks })`,
	{ URL }
);

test('switched on with a folder: ready', () => {
	assert.equal(relayState(true, true), 'ready');
});

test('switched on without a folder: nogrf', () => {
	assert.equal(relayState(true, false), 'nogrf');
});

test('switched off: off, folder or not', () => {
	assert.equal(relayState(false, true), 'off');
	assert.equal(relayState(false, false), 'off');
});

test('game pages: the native client pages, and cyro.live/rb2/ for the patch', () => {
	assert.equal(gamePage('https://robrowser.suuuper.app/upstream/cyro.live/api.html?app=ONLINE'), 'native');
	assert.equal(gamePage('https://cyro.localhost:6988/api.html?app=ONLINE'), 'native');
	assert.equal(gamePage('https://cyro.live/rb2/'), 'patch');
	assert.equal(gamePage('https://cyro.localhost:6988/rb2/'), 'patch');
	assert.equal(gamePage('https://robrowser.suuuper.app/upstream/cyro.live/'), null);
	assert.equal(gamePage('https://cyro.live/'), null);
	assert.equal(gamePage('https://example.com/rb2/'), null);
	assert.equal(gamePage('chrome://extensions'), null);
});

const levels = (checks) => checks.map(([level]) => level).join(' ');

test('checks: all green when the page took the folder and fetched nothing', () => {
	assert.equal(levels(tabChecks({ page: 'native', patch: null, used: true, network: 0 })), 'pass pass pass');
	assert.equal(levels(tabChecks({ page: 'patch', patch: '0.1.1', used: true, network: 0 })), 'pass pass pass');
	assert.match(tabChecks({ page: 'patch', patch: '0.1.1', used: true, network: 0 })[0][1], /0\.1\.1/);
});

test('checks: files from the server are a warning, with their count', () => {
	const checks = tabChecks({ page: 'native', patch: null, used: true, network: 3 });
	// Arrays from the vm context are another realm's: compare their JSON.
	assert.equal(JSON.stringify(checks[2]), JSON.stringify(['warn', '3 game files from the server: your folder lacks them']));
	assert.equal(tabChecks({ page: 'native', patch: null, used: true, network: 1 })[2][1], '1 game file from the server: your folder lacks them');
});

test('checks: cyro.live without the patch fails', () => {
	assert.equal(levels(tabChecks({ page: 'patch', patch: null, used: false, network: 40 })), 'fail wait warn');
});

test('checks: a page that did not answer asks for a reload', () => {
	assert.equal(
		JSON.stringify(tabChecks({ page: 'patch', patch: undefined, used: false, network: 0 })),
		JSON.stringify([['wait', 'Reload this page to check it.']])
	);
});
