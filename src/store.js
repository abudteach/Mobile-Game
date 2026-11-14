// Small persistent profile (coins, bought weapon skins, what each hero has equipped).
// Everything is wrapped so the game still works when storage is unavailable.
const get = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const set = (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage may be unavailable */ } };

export const store = { get, set };
export const getCoins = () => parseInt(get('dc_coins', '150'), 10) || 0;
export const addCoins = (n) => { const v = Math.max(0, getCoins() + n); set('dc_coins', String(v)); return v; };
export const ownedSkins = () => { try { return JSON.parse(get('dc_owned', '["std"]')); } catch { return ['std']; } };
export const ownSkin = (id) => { const o = ownedSkins(); if (!o.includes(id)) { o.push(id); set('dc_owned', JSON.stringify(o)); } };
export const equippedSkin = (heroId) => get(`dc_skin_${heroId}`, 'std');
export const equipSkin = (heroId, id) => set(`dc_skin_${heroId}`, id);
