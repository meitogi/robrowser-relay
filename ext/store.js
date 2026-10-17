const out = document.getElementById('out');

async function show(extra = '') {
	const file = await dbGet('grf');
	const root = (await dbGet('root')) || {};
	const keys = Object.keys(root);
	const bgm = keys.filter((k) => k.startsWith('bgm/')).length;
	out.textContent =
		(file ? `archive: ${file.name}, ${(file.size / 1e9).toFixed(2)} GB` : 'archive: none') +
		`\nloose files: ${keys.length} (BGM: ${bgm})` +
		`\npersisted storage: ${await navigator.storage.persisted()}` +
		extra;
}

const same = (a, b) => a && b && a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

async function store(grf, root) {
	await navigator.storage.persist();
	out.textContent = 'storing…';
	const t0 = performance.now();
	try {
		if (grf) {
			await dbPut('grf', grf);
		}
		if (root) {
			await dbPut('root', root);
		}
	} catch (err) {
		out.textContent = `store failed: ${err}`;
		return;
	}
	browser.runtime.sendMessage({ type: 'changed' });
	await show(`\nstore took ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

// The folder: the top-level .grf (data.grf first) is the archive, every other file is a loose file
// keyed by its lowercased path inside the folder. The archive already stored is not copied again.
document.getElementById('folder').addEventListener('change', async (e) => {
	const files = [...e.target.files];
	if (!files.length) {
		return;
	}
	const rel = (f) => f.webkitRelativePath.split('/').slice(1).join('/');
	const grfs = files.filter((f) => /^[^/]+\.grf$/i.test(rel(f)));
	const grf = grfs.find((f) => /^data\.grf$/i.test(rel(f))) || grfs[0] || null;
	const root = {};
	for (const f of files) {
		if (f !== grf && !/\.grf$/i.test(f.name) && f.name !== '.DS_Store') {
			root[rel(f).toLowerCase()] = f;
		}
	}
	await store(grf && !same(grf, await dbGet('grf')) ? grf : null, root);
});

document.getElementById('grf').addEventListener('change', (e) => {
	if (e.target.files[0]) {
		store(e.target.files[0], null);
	}
});

show();
