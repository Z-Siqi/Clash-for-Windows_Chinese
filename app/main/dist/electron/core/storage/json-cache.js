"use strict";

function createJsonCache(storage) {
    return {
        put(key, value) { storage.setItem(key, JSON.stringify(value)); },
        get(key) {
            const value = storage.getItem(key);
            if (value === "" || value === null) return null;
            try { return JSON.parse(value); }
            catch (_error) { return undefined; }
        }
    };
}

module.exports = { createJsonCache };
