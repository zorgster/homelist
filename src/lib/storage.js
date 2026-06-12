export async function storeSave(k, v) {
  const s = JSON.stringify(v);
  try { await window.storage?.set(k, s); return; } catch {}
  try { localStorage.setItem(k, s); } catch {}
}

export async function storeLoad(k) {
  try { const r = await window.storage?.get(k); if (r) return JSON.parse(r.value); } catch {}
  try { const r = localStorage.getItem(k); if (r) return JSON.parse(r); } catch {}
  return null;
}

export async function storeDel(k) {
  try { await window.storage?.delete(k); } catch {}
  try { localStorage.removeItem(k); } catch {}
}
