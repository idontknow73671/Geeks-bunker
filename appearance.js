// Keep personal images on this browser, outside the g8me save quota.
async function appearanceDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('gbAppearanceV1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('backgrounds');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function loadBackgrounds() {
    try {
        const db = await appearanceDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction('backgrounds', 'readonly'), result = {};
            for (const key of ['dashboard', 'geekfox']) {
                const request = tx.objectStore('backgrounds').get(key);
                request.onsuccess = () => { result[key] = request.result || null; };
            }
            tx.oncomplete = () => { db.close(); resolve(result); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        });
    } catch { return {dashboard:null, geekfox:null}; }
}
export async function saveBackgrounds(images) {
    const db = await appearanceDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('backgrounds', 'readwrite'), store = tx.objectStore('backgrounds');
        for (const key of ['dashboard', 'geekfox']) images[key] ? store.put(images[key], key) : store.delete(key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
    });
}
export async function prepareBackground(file) {
    if (!['image/png','image/jpeg','image/webp','image/avif'].includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP, or AVIF image.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
    const source = URL.createObjectURL(file), image = new Image();
    try {
        image.src = source; await image.decode();
        const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .88));
        if (!blob) throw new Error('This image could not be prepared. Try another image.');
        return blob;
    } finally { URL.revokeObjectURL(source); }
}
