// Writes the player guides of the kit, START-HERE.html and README.txt, from their templates.
//   node player-kit/render.mjs <out-dir> [--size "5.7 GB"] [--discord <public url>]
// --discord writes DISCORD.md instead: the announce, with the bucket's public address in its links.
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

export function kitVars(env, version, size, publicUrl = '') {
	return {
		VERSION: version,
		PUBLIC_URL: publicUrl,
		XPI: `roBrowser-relay-${version}.xpi`,
		SIZE: size,
		FIREFOX_STORE_URL: env.FIREFOX_STORE_URL || '',
		CHROME_STORE_URL: env.CHROME_STORE_URL || '',
		firefoxStore: !!env.FIREFOX_STORE_URL,
		chromeStore: !!env.CHROME_STORE_URL
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const [out, ...flags] = process.argv.slice(2);
	const opts = {};
	for (let i = 0; i < flags.length; i += 2) {
		opts[flags[i]] = flags[i + 1];
	}
	if (!out || Object.keys(opts).some((k) => k !== '--size' && k !== '--discord')) {
		console.error('usage: node player-kit/render.mjs <out-dir> [--size "5.7 GB"] [--discord <public url>]');
		process.exit(2);
	}
	const env = parseEnv(readFileSync(new URL('store-links.env', HERE), 'utf8'));
	const { version } = JSON.parse(readFileSync(new URL('../ext/manifest.json', import.meta.url), 'utf8'));
	const vars = kitVars(env, version, opts['--size'] || 'about 6 GB', opts['--discord']);
	const files = opts['--discord']
		? [['DISCORD.template.md', 'DISCORD.md']]
		: [['START-HERE.template.html', 'START-HERE.html'], ['README.template.txt', 'README.txt']];
	mkdirSync(out, { recursive: true });
	for (const [template, name] of files) {
		writeFileSync(`${out}/${name}`, render(readFileSync(new URL(template, HERE), 'utf8'), vars));
	}
	console.log(`${files.map(([, name]) => `${out}/${name}`).join(', ')} — ${version}, store links: firefox ${vars.firefoxStore ? 'yes' : 'no'}, chrome ${vars.chromeStore ? 'yes' : 'no'}`);
}
