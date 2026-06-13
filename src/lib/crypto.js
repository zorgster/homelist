import raw from './wordlist.txt?raw';
const WORDLIST = raw.trim().split('\n');

// Pick 4 random words from the BIP39 wordlist using the browser CSPRNG.
// 2048 words → 2048^4 ≈ 2^44 combinations before PBKDF2 hardening.
export function genToken() {
  const idx = new Uint32Array(4);
  crypto.getRandomValues(idx);
  return Array.from(idx).map(n => WORDLIST[n % WORDLIST.length]).join('-');
}

// Normalise a user-typed passphrase into a canonical token.
// Accepts words separated by spaces, dashes, or commas.
// Returns "word1-word2-word3" or null if fewer than 3 alpha words found.
export function normalizePassphrase(input) {
  const words = (input || '').trim().toLowerCase()
    .split(/[\s\-_,]+/)
    .filter(w => /^[a-z]+$/.test(w));
  return words.length >= 4 ? words.slice(0, 4).join('-') : null;
}

export async function tokenToHouseholdId(tok) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('homelist|' + tok));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function deriveEncKey(tok) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(tok), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('homelist-v1'), iterations: 100000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function enc(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...out));
}

export async function dec(b64, key) {
  try {
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null;
  }
}

export function shortId(tok) {
  const words = (tok || '').split('-').filter(w => w.length > 0);
  if (words.length >= 2) return words.join(' · ');
  // fallback for any legacy token format
  const t = (tok || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().padEnd(9, '·');
  return `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6, 9)}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
