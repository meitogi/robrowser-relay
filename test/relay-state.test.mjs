import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

// state.js is a plain script (popup <script>, content script), not a module: run it and read the global.
const { relayState } = runInNewContext(`${readFileSync(new URL('../ext/state.js', import.meta.url), 'utf8')}; ({ relayState })`);

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
