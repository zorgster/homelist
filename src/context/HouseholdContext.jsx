import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import {
  GoogleAuthProvider, signInWithPopup, linkWithPopup,
  signInAnonymously, onAuthStateChanged,
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import {
  genToken, normalizePassphrase, tokenToHouseholdId, deriveEncKey, enc, dec, uid,
} from '../lib/crypto';
import { storeSave, storeLoad, storeDel } from '../lib/storage';
import { DEFAULT_CATS, DEFAULT_TODO_CATS, DEVICE_ID } from '../lib/constants';

const HouseholdCtx = createContext(null);
export const useHousehold = () => useContext(HouseholdCtx);

export function HouseholdProvider({ children }) {
  // ── auth ──
  const [token, setToken]               = useState(null);
  const [hhName, setHhName]             = useState('My Household');
  const [encKey, setEncKey]             = useState(null);
  const [householdId, setHouseholdId]   = useState(null);
  const [pendingJoinToken, setPendingJoinToken] = useState(null);
  const [authMode, setAuthMode]         = useState(null); // 'google' | 'anonymous'
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);

  // ── data ──
  const [items, setItems]       = useState({});
  const [cats, setCats]         = useState(DEFAULT_CATS.map(c => ({ ...c })));
  const [trades, setTrades]     = useState({});
  const [bdays, setBdays]       = useState({});
  const [todos, setTodos]       = useState({});
  const [todoCats, setTodoCats] = useState([...DEFAULT_TODO_CATS]);

  // ── sync ──
  const [syncStatus, setSyncStatus] = useState('offline');

  // ── toast ──
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  // ── refs always current ──
  const encKeyRef      = useRef(null);
  const householdIdRef = useRef(null);

  useEffect(() => { encKeyRef.current = encKey; }, [encKey]);
  useEffect(() => { householdIdRef.current = householdId; }, [householdId]);

  function toast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2800);
  }

  // ── session persistence (anonymous only — Google users store token in Firestore) ──
  useEffect(() => {
    if (!token || authMode !== 'anonymous') return;
    storeSave('homelist-sess', { token, hhName });
  }, [token, hhName, authMode]);

  // ── boot: single auth state listener drives all session loading ──
  useEffect(() => {
    const frag = new URLSearchParams(location.hash.replace(/^#/, ''));
    const joinTok = frag.get('join');
    if (joinTok) {
      history.replaceState(null, '', location.pathname + location.search);
      setPendingJoinToken(joinTok);
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthLoading(false);
        return;
      }
      setFirebaseUser(user);

      if (!user.isAnonymous) {
        setAuthMode('google');
        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'profile', 'household'));
          if (snap.exists() && snap.data().token) {
            const tok = snap.data().token;
            const key = await deriveEncKey(tok);
            const hid = await tokenToHouseholdId(tok);
            setToken(tok); setEncKey(key); setHouseholdId(hid);
          }
        } catch (e) {
          console.warn('Failed to load Google user household:', e);
        }
      } else {
        setAuthMode('anonymous');
        const sess = await storeLoad('homelist-sess');
        if (sess?.token) {
          const key = await deriveEncKey(sess.token);
          const hid = await tokenToHouseholdId(sess.token);
          setToken(sess.token);
          setHhName(sess.hhName || 'My Household');
          setEncKey(key); setHouseholdId(hid);
        }
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // ── Firestore setup / teardown ──
  useEffect(() => {
    if (!token || !householdId || !encKey) {
      setSyncStatus('offline');
      return;
    }

    let mounted = true;
    const unsubs = [];
    const loadedFlags = { items: false, trades: false, bdays: false, todos: false };

    function makeCollListener(colName, setter, validate) {
      return onSnapshot(
        collection(db, 'households', householdId, colName),
        async snap => {
          if (!mounted) return;
          const ek = encKeyRef.current;
          if (!loadedFlags[colName]) {
            loadedFlags[colName] = true;
            const fresh = {};
            await Promise.all(snap.docs.map(async d => {
              const data = await dec(d.data().c, ek);
              if (data && !data._deleted && validate(data))
                fresh[d.id] = { id: d.id, ...data };
            }));
            if (mounted) setter(fresh);
          } else {
            const changes = await Promise.all(
              snap.docChanges().map(async ch => ({
                ch,
                data: ch.type !== 'removed' ? await dec(ch.doc.data().c, ek) : null,
              }))
            );
            if (mounted) setter(prev => {
              const next = { ...prev };
              for (const { ch, data } of changes) {
                if (ch.type === 'removed' || !data || data._deleted || !validate(data))
                  delete next[ch.doc.id];
                else
                  next[ch.doc.id] = { id: ch.doc.id, ...data };
              }
              return next;
            });
          }
          if (mounted) setSyncStatus('online');
        },
        () => { if (mounted) setSyncStatus('offline'); }
      );
    }

    function makeDocListener(docPath, onData) {
      return onSnapshot(
        doc(db, 'households', householdId, ...docPath),
        async snap => {
          if (!mounted || !snap.exists()) return;
          const data = await dec(snap.data().c, encKeyRef.current);
          if (data) onData(data);
        }
      );
    }

    setSyncStatus('syncing');
    unsubs.push(makeCollListener('items',  setItems,  d => !!d.name));
    unsubs.push(makeCollListener('trades', setTrades, d => !!d.name));
    unsubs.push(makeCollListener('bdays',  setBdays,  d => !!d.name && !!d.date));
    unsubs.push(makeCollListener('todos',  setTodos,  d => !!d.title));
    unsubs.push(makeDocListener(['meta', 'cats'],     d => { if (Array.isArray(d) && d.length) setCats(d); }));
    unsubs.push(makeDocListener(['meta', 'todoCats'], d => { if (Array.isArray(d) && d.length) setTodoCats(d); }));
    unsubs.push(makeDocListener(['meta', 'hhName'],   d => { if (d.v) setHhName(d.v); }));

    return () => {
      mounted = false;
      unsubs.forEach(fn => fn());
    };
  }, [token, householdId, encKey]);

  // ── write helpers ──

  async function ensureAuth() {
    if (!auth.currentUser) await signInAnonymously(auth);
  }

  async function saveGoogleToken(tok) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    await setDoc(doc(db, 'users', user.uid, 'profile', 'household'), { token: tok });
  }

  async function fsEncWrite(segments, payload) {
    const ek  = encKeyRef.current;
    const hid = householdIdRef.current;
    if (!hid || !ek) return;
    try {
      const c = await enc(payload, ek);
      await setDoc(doc(db, 'households', hid, ...segments), { c });
    } catch (e) {
      console.warn('Firestore write failed:', e);
    }
  }

  // ══ AUTH ACTIONS ══════════════════════════════════════════════════════════

  async function signInWithGoogle() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') toast('Google sign-in failed');
    }
  }

  async function signInAnonymous() {
    try {
      await signInAnonymously(auth);
    } catch {
      toast('Sign-in failed — please try again');
    }
  }

  async function linkWithGoogle() {
    try {
      const result = await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      setFirebaseUser(result.user);
      setAuthMode('google');
      await saveGoogleToken(token);
      toast('Google account linked — your household is now recoverable ✓');
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') toast('Google link failed');
    }
  }

  // ══ SETUP ACTIONS ══════════════════════════════════════════════════════════

  async function createHousehold(name, passphrase) {
    await ensureAuth();
    const tok = passphrase || genToken();
    const key = await deriveEncKey(tok);
    const hid = await tokenToHouseholdId(tok);
    const n   = name || 'My Household';
    setToken(tok); setHhName(n); setEncKey(key); setHouseholdId(hid);
    setItems({}); setCats(DEFAULT_CATS.map(c => ({ ...c }))); setTrades({});
    setBdays({}); setTodos({}); setTodoCats([...DEFAULT_TODO_CATS]);
    await saveGoogleToken(tok);
    toast('Household created! Share your key with your household 🏠');
    return tok;
  }

  async function joinHousehold(tok, name) {
    await ensureAuth();
    const key = await deriveEncKey(tok);
    const hid = await tokenToHouseholdId(tok);
    const n   = name || 'My Household';
    setToken(tok); setHhName(n); setEncKey(key); setHouseholdId(hid);
    setItems({}); setTrades({}); setBdays({}); setTodos({});
    setPendingJoinToken(null);
    await saveGoogleToken(tok);
    toast('Joining household…');
  }

  async function leaveHousehold() {
    if (!confirm('Leave this household? Local data will be cleared.')) return;
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'profile', 'household'), { token: null });
      } catch {}
    }
    setToken(null); setHhName('My Household'); setEncKey(null); setHouseholdId(null);
    setItems({}); setCats(DEFAULT_CATS.map(c => ({ ...c }))); setTrades({});
    setBdays({}); setTodos({}); setTodoCats([...DEFAULT_TODO_CATS]);
    setSyncStatus('offline');
    await storeDel('homelist-sess');
  }

  async function refreshHouseholdKey() {
    const input = window.prompt('Enter 3 new words for your household key (e.g. horse waffle somerset):');
    if (!input) return;
    const tok = normalizePassphrase(input);
    if (!tok) { toast('Please enter at least 3 words'); return; }
    if (!confirm(`New key will be "${tok}". All members will need to rejoin. Continue?`)) return;
    const key = await deriveEncKey(tok);
    const hid = await tokenToHouseholdId(tok);
    setToken(tok); setEncKey(key); setHouseholdId(hid);
    setItems({}); setTrades({}); setBdays({}); setTodos({});
    await saveGoogleToken(tok);
    toast('New key set. Share your new words with your household.');
  }

  // ══ SHOPPING ═══════════════════════════════════════════════════════════════

  async function addItem(name, qty, cat) {
    const id      = uid();
    const payload = { name, qty: qty || '', cat: cat || '', checked: false, _deleted: false, ts: Date.now(), _dev: DEVICE_ID };
    setItems(prev => ({ ...prev, [id]: { id, ...payload } }));
    await fsEncWrite(['items', id], payload);
  }

  async function toggleItem(id) {
    setItems(prev => {
      const updated = { ...prev, [id]: { ...prev[id], checked: !prev[id].checked } };
      fsEncWrite(['items', id], updated[id]);
      return updated;
    });
  }

  async function deleteItem(id) {
    setItems(prev => { const next = { ...prev }; delete next[id]; return next; });
    await fsEncWrite(['items', id], { _deleted: true, name: null, _dev: DEVICE_ID });
  }

  async function clearChecked() {
    const toDelete = Object.keys(items).filter(id => items[id].checked);
    if (!toDelete.length) { toast('No checked items'); return; }
    setItems(prev => {
      const next = { ...prev };
      toDelete.forEach(id => delete next[id]);
      return next;
    });
    await Promise.all(toDelete.map(id =>
      fsEncWrite(['items', id], { _deleted: true, name: null, _dev: DEVICE_ID })
    ));
    toast(`Cleared ${toDelete.length} item${toDelete.length > 1 ? 's' : ''}`);
  }

  // ══ CATEGORIES ════════════════════════════════════════════════════════════

  async function saveCats(newCats) {
    setCats(newCats);
    await fsEncWrite(['meta', 'cats'], newCats);
  }

  // ══ TRADES ════════════════════════════════════════════════════════════════

  async function saveTrade(id, payload) {
    const isNew = !id;
    const tid   = id || uid();
    const full  = { ...payload, ts: trades[tid]?.ts || Date.now(), _deleted: false };
    setTrades(prev => ({ ...prev, [tid]: { id: tid, ...full } }));
    await fsEncWrite(['trades', tid], full);
    toast(isNew ? 'Added to tradespeople ✓' : 'Updated ✓');
  }

  async function deleteTrade(id) {
    if (!confirm(`Remove ${trades[id]?.name || 'this person'} from tradespeople?`)) return;
    setTrades(prev => { const next = { ...prev }; delete next[id]; return next; });
    await fsEncWrite(['trades', id], { _deleted: true });
  }

  // ══ BIRTHDAYS ════════════════════════════════════════════════════════════

  async function saveBday(id, payload) {
    const isNew = !id;
    const bid   = id || uid();
    const full  = { ...payload, ts: bdays[bid]?.ts || Date.now(), _deleted: false };
    setBdays(prev => ({ ...prev, [bid]: { id: bid, ...full } }));
    await fsEncWrite(['bdays', bid], full);
    toast(isNew ? 'Birthday added 🎂' : 'Updated ✓');
  }

  async function deleteBday(id) {
    if (!confirm(`Remove ${bdays[id]?.name || 'this birthday'}?`)) return;
    setBdays(prev => { const next = { ...prev }; delete next[id]; return next; });
    await fsEncWrite(['bdays', id], { _deleted: true });
  }

  // ══ TODOS ════════════════════════════════════════════════════════════════

  async function saveTodo(id, payload) {
    const isNew = !id;
    const tid   = id || uid();
    const full  = { ...payload, done: todos[tid]?.done || false, ts: todos[tid]?.ts || Date.now(), _deleted: false };
    setTodos(prev => ({ ...prev, [tid]: { id: tid, ...full } }));
    await fsEncWrite(['todos', tid], full);
    toast(isNew ? 'Reminder added ✓' : 'Updated ✓');
  }

  async function toggleTodoDone(id) {
    setTodos(prev => {
      const t   = prev[id];
      const upd = { ...t, done: !t.done, doneAt: !t.done ? Date.now() : null };
      fsEncWrite(['todos', id], upd);
      return { ...prev, [id]: upd };
    });
  }

  async function deleteTodo(id) {
    if (!confirm(`Delete "${todos[id]?.title || 'this reminder'}"?`)) return;
    setTodos(prev => { const next = { ...prev }; delete next[id]; return next; });
    await fsEncWrite(['todos', id], { _deleted: true });
  }

  async function saveTodoCats(newCats) {
    setTodoCats(newCats);
    await fsEncWrite(['meta', 'todoCats'], newCats);
  }

  // ══ CONTEXT VALUE ════════════════════════════════════════════════════════

  const value = {
    token, hhName, householdId, isLoggedIn: !!token, pendingJoinToken,
    authMode, firebaseUser, authLoading,
    items, cats, trades, bdays, todos, todoCats,
    syncStatus, toastMsg,
    // auth
    signInWithGoogle, signInAnonymous, linkWithGoogle,
    // setup
    createHousehold, joinHousehold, leaveHousehold, refreshHouseholdKey,
    // shopping
    addItem, toggleItem, deleteItem, clearChecked,
    // categories
    saveCats,
    // trades
    saveTrade, deleteTrade,
    // birthdays
    saveBday, deleteBday,
    // todos
    saveTodo, toggleTodoDone, deleteTodo, saveTodoCats,
    // toast
    toast,
  };

  return <HouseholdCtx.Provider value={value}>{children}</HouseholdCtx.Provider>;
}
