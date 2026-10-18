// Writes the player guides of the kit, START-HERE.html and README.txt, from their templates.
//   node player-kit/render.mjs <out-dir> [--size "5.7 GB"]
// Templates: {{NAME}} is a value; {{#key}}…{{/key}} is kept when key is set, {{^key}}…{{/key}} when it
// is not; {{img:<name>}} is cws/screenshots/<name>.png as a data: URI, so the guide is one file.
// The store links come from store-links.env: empty, the guide teaches the manual install from the kit.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const HERE = new URL('./', import.meta.url);
const SHOTS = new URL('../cws/screenshots/', import.meta.url);

export function parseEnv(text) {
	const env = {};
	for (const line of text.split(/\r?\n/)) {
		const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
		if (m) {
			env[m[1]] = m[2];
		}
	}
	return env;
}

export function render(text, vars) {
	return text
		.replace(/\{\{([#^])(\w+)\}\}\n?([\s\S]*?)\{\{\/\2\}\}\n?/g, (_, kind, key, body) => ((kind === '#') === !!vars[key] ? body : ''))
		.replace(/\{\{img:([\w-]+)\}\}/g, (_, name) => `data:image/png;base64,${readFileSync(new URL(`${name}.png`, SHOTS)).toString('base64')}`)
		.replace(/\{\{(\w+)\}\}/g, (_, key) => {
			if (vars[key] === undefined) {
				throw new Error(`template value ${key} not set`);
			}
			return vars[key];
		});
}

export function kitVars(env, version, size) {
	return {
		VERSION: version,
		XPI: `roBrowser-relay-${version}.xpi`,
		SIZE: size,
		FIREFOX_STORE_URL: env.FIREFOX_STORE_URL || '',
		CHROME_STORE_URL: env.CHROME_STORE_URL || '',
		firefoxStore: !!env.FIREFOX_STORE_URL,
		chromeStore: !!env.CHROME_STORE_URL
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const [out, flag, size] = process.argv.slice(2);
	if (!out || (flag && flag !== '--size')) {
		console.error('usage: node player-kit/render.mjs <out-dir> [--size "5.7 GB"]');
		process.exit(2);
	}
	const env = parseEnv(readFileSync(new URL('store-links.env', HERE), 'utf8'));
	const { version } = JSON.parse(readFileSync(new URL('../ext/manifest.json', import.meta.url), 'utf8'));
	const vars = kitVars(env, version, size || 'about 6 GB');
	mkdirSync(out, { recursive: true });
	for (const [template, name] of [['START-HERE.template.html', 'START-HERE.html'], ['README.template.txt', 'README.txt']]) {
		writeFileSync(`${out}/${name}`, render(readFileSync(new URL(template, HERE), 'utf8'), vars));
	}
	console.log(`${out}/START-HERE.html, ${out}/README.txt — ${version}, store links: firefox ${vars.firefoxStore ? 'yes' : 'no'}, chrome ${vars.chromeStore ? 'yes' : 'no'}`);
}
