// One key/value store in the extension's IndexedDB: `grf` (the dropped File).
const DB = 'relay';
const STORE = 'kv';

let opening = null;

function open() {
	if (!opening) {
		opening = new Promise((resolve, reject) => {
			const req = indexedDB.open(DB, 1);
			req.onupgradeneeded = () => req.result.createObjectStore(STORE);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}
	return opening;
}

function run(mode, op) {
	return open().then(
		(db) =>
			new Promise((resolve, reject) => {
				const tx = db.transaction(STORE, mode);
				const req = op(tx.objectStore(STORE));
				tx.oncomplete = () => resolve(req.result);
				tx.onerror = () => reject(tx.error);
				tx.onabort = () => reject(tx.error);
			})
	);
}

const dbGet = (key) => run('readonly', (s) => s.get(key));
const dbPut = (key, value) => run('readwrite', (s) => s.put(value, key));

// The client folder handed to a game page; null while the relay is off.
async function storedFiles() {
	if ((await dbGet('enabled')) === false) {
		return null;
	}
	return { grf: (await dbGet('grf')) || null, root: (await dbGet('root')) || {} };
}
