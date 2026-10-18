import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chromeManifest } from '../build.mjs';

const firefox = JSON.parse(readFileSync(new URL('../ext/manifest.json', import.meta.url), 'utf8'));
const chrome = chromeManifest(firefox);

test('chrome: a service worker, no Firefox keys', () => {
	assert.deepEqual(chrome.background, { service_worker: 'background.js' });
	assert.equal(chrome.browser_specific_settings, undefined);
});

test('chrome: a description the Chrome Web Store takes', () => {
	assert.ok(chrome.description.length <= 132, `${chrome.description.length} characters`);
});

test('chrome: declarativeNetRequest instead of blocking webRequest, webRequest kept to observe', () => {
	assert.ok(chrome.permissions.includes('declarativeNetRequestWithHostAccess'));
	assert.ok(!chrome.permissions.includes('webRequestBlocking'));
	assert.ok(chrome.permissions.includes('webRequest'), 'observing only, for the popup trace');
	assert.ok(chrome.permissions.includes('unlimitedStorage'));
});

test('chrome: the bridge frame is open to the game pages only', () => {
	assert.deepEqual(chrome.web_accessible_resources, [{ resources: ['bridge.html'], matches: firefox.content_scripts[0].matches }]);
	assert.equal(chrome.content_scripts[0].js[0], 'browser.js');
});

test('the Firefox manifest is left as it is', () => {
	assert.ok(firefox.background.scripts);
	assert.ok(firefox.permissions.includes('webRequestBlocking'));
	assert.equal(firefox.web_accessible_resources, undefined);
	assert.equal(chrome.version, firefox.version);
});
