const out = document.getElementById('out');
const progress = document.getElementById('progress');
const drop = document.getElementById('drop');

document.getElementById('version').textContent = `version ${browser.runtime.getManifest().version}`;
// Opened by the background right after install.
if (location.hash === '#welcome') {
	document.getElementById('title').textContent = 'Welcome — one step left';
}

async function show(extra = '') {
	const { state, grf, root } = await showStatus();
	showGrant();
	let loose = 0;
	let bgm = 0;
	let system = 0;
	for (const key in root) {
		loose++;
		if (key.startsWith('bgm/')) {
			bgm++;
		} else if (key.startsWith('system/')) {
			system++;
		}
	}
	out.textContent = grf ? `loose files: ${loose} (BGM: ${bgm}, System: ${system})${extra}` : extra.trim();
	document.getElementById('play').hidden = state !== 'ready';
}

const same = (a, b) => a && b && a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

async function store(grf, root) {
	await navigator.storage.persist();
	progress.hidden = false;
	out.textContent = grf ? `Storing ${grf.name} (${gb(grf.size)})…` : 'Storing…';
	const t0 = performance.now();
	try {
		if (grf) {
			await dbPut('grf', grf);
		}
		if (root) {
			await dbPut('root', root);
		}
	} catch (err) {
		progress.hidden = true;
		out.textContent = `Store failed: ${err}`;
		return;
	}
	progress.hidden = true;
	browser.runtime.sendMessage({ type: 'changed' });
	await show(`\nstored in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

// The folder, as [{ file, path }] with `path` inside it: the top-level .grf (data.grf first) is the
// archive, every other file is a loose file keyed by its lowercased path. The archive already stored is
// not copied again.
async function storeFolder(entries) {
	const grfs = entries.filter((e) => /^[^/]+\.grf$/i.test(e.path));
	const top = grfs.find((e) => /^data\.grf$/i.test(e.path)) || grfs[0];
	const grf = top ? top.file : null;
	const root = {};
	for (const e of entries) {
		if (e.file !== grf && !/\.grf$/i.test(e.file.name) && e.file.name !== '.DS_Store') {
			root[e.path.toLowerCase()] = e.file;
		}
	}
	if (!grf && !(await dbGet('grf'))) {
		out.textContent = 'No .grf at the top of this folder: choose the folder that holds data.grf.';
		return;
	}
	await store(grf && !same(grf, await dbGet('grf')) ? grf : null, root);
}

document.getElementById('folder').addEventListener('change', (e) => {
	const files = [...e.target.files];
	if (files.length) {
		storeFolder(files.map((file) => ({ file, path: file.webkitRelativePath.split('/').slice(1).join('/') })));
	}
});

document.getElementById('grf').addEventListener('change', (e) => {
	if (e.target.files[0]) {
		store(e.target.files[0], null);
	}
});

// Drag and drop: the folder, or several of the files and folders it holds, go through the same path as the
// picker; a lone .grf as the GRF picker.
const readAll = (reader) =>
	new Promise((resolve, reject) => {
		const all = [];
		const next = () =>
			reader.readEntries((batch) => {
				if (!batch.length) {
					resolve(all);
					return;
				}
				all.push(...batch);
				next();
			}, reject);
		next();
	});

const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject));

async function walk(dir, prefix, into) {
	for (const entry of await readAll(dir.createReader())) {
		const path = prefix + entry.name;
		if (entry.isDirectory) {
			await walk(entry, path + '/', into);
		} else {
			into.push({ file: await fileOf(entry), path });
			if (into.length % 500 === 0) {
				out.textContent = `Reading the folder… ${into.length} files`;
			}
		}
	}
	return into;
}

drop.addEventListener('dragover', (e) => {
	e.preventDefault();
	drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', async (e) => {
	e.preventDefault();
	drop.classList.remove('over');
	const entries = [...e.dataTransfer.items].map((item) => item.webkitGetAsEntry()).filter(Boolean);
	const [entry] = entries;
	if (entries.length === 1 && !entry.isDirectory && /\.grf$/i.test(entry.name)) {
		store(e.dataTransfer.files[0], null);
		return;
	}
	if (!entries.length || (entries.length === 1 && !entry.isDirectory)) {
		out.textContent = 'Drop the client folder (the one that holds data.grf), or what it holds.';
		return;
	}
	progress.hidden = false;
	out.textContent = 'Reading the folder…';
	try {
		const files = [];
		if (entries.length === 1) {
			await walk(entry, '', files);
		} else {
			// What the folder holds, selected in it: each item keeps its name as the top of its path.
			for (const item of entries) {
				if (item.isDirectory) {
					await walk(item, item.name + '/', files);
				} else {
					files.push({ file: await fileOf(item), path: item.name });
				}
			}
		}
		await storeFolder(files);
	} catch (err) {
		out.textContent = `Reading the folder failed: ${err}`;
	}
	progress.hidden = true;
});

show();
