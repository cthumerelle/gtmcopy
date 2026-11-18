const DB_NAME = 'gtm-copy';
const DB_VERSION = 1;
const STORE = 'copyReports';

let dbPromise = null;

const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
};

const run = async (mode, operation) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

const toStorable = (report) => JSON.parse(JSON.stringify(report));

export const saveReport = (report) => run('readwrite', store => store.put(toStorable(report)));

export const getReport = (id) => run('readonly', store => store.get(id));

export const listReports = async () => {
  const reports = await run('readonly', store => store.getAll());
  return (reports || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const clearReports = () => run('readwrite', store => store.clear());

export const downloadJson = (filename, data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
