import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, deleteDoc, writeBatch,
} from 'firebase/firestore';
import {
  GoogleAuthProvider, signInWithPopup, linkWithPopup,
  signInAnonymously, signOut, onAuthStateChanged,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import {
  genToken, normalizePassphrase, tokenToHouseholdId,
  genRawKey, importEncKey, enc, dec, uid,
} from '../lib/crypto';
import { storeSave, storeLoad, storeDel } from '../lib/storage';
import { DEFAULT_CATS, DEFAULT_TODO_CATS, DEVICE_ID } from '../lib/constants';

const HouseholdCtx = createContext(null);
export const useHousehold = () => useContext(HouseholdCtx);

// ── storage helpers (per-user household list) ──────────────────────────────

async function loadAllHouseholds(user) {
  if (!user.isAnonymous) {
    const snap = await getDocs(collection(db, 'users', user.uid, 'households'));
    if (!snap.empty) return snap.docs.map(d => ({ hid: d.id, ...d.data() }));
    // migrate: old single-doc format
    try {
      const old = await getDoc(doc(db, 'users', user.uid, 'profile', 'household'));
      if (old.exists() && old.data().token) {
        const tok = old.data().token;
        const hid = await tokenToHouseholdId(tok);
        const entry = { token: tok, name: 'My Household', lastVisited: Date.now(), status: 'active' };
        await setDoc(doc(db, 'users', user.uid, 'households', hid), entry);
        return [{ hid, ...entry }];
      }
    } catch {}
    return [];
  } else {
    const saved = await storeLoad('homelist-households');
    if (saved) return saved;
    // migrate: old single-session format
    const old = await storeLoad('homelist-sess');
    if (old?.token) {
      const hid = await tokenToHouseholdId(old.token);
      const list = [{ hid, token: old.token, name: old.hhName || 'My Household', lastVisited: Date.now(), status: 'active' }];
      await storeSave('homelist-households', list);
      await storeDel('homelist-sess');
      return list;
    }
    return [];
  }
}

async function persistHousehold(user, hid, token, name, status = 'active') {
  if (!user) return;
  const entry = { token, name, lastVisited: Date.now(), status };
  if (!user.isAnonymous) {
    await setDoc(doc(db, 'users', user.uid, 'households', hid), entry);
  } else {
    const list = (await storeLoad('homelist-households')) || [];
    const idx  = list.findIndex(h => h.hid === hid);
    const item = { hid, ...entry };
    if (idx >= 0) list[idx] = item; else list.push(item);
    await storeSave('homelist-households', list);
  }
}

async function forgetHousehold(user, hid) {
  if (!user) return;
  if (!user.isAnonymous) {
    await deleteDoc(doc(db, 'users', user.uid, 'households', hid));
  } else {
    const list = (await storeLoad('homelist-households')) || [];
    await storeSave('homelist-households', list.filter(h => h.hid !== hid));
  }
}

// ──────────────────────────────────────────────────────────────────────────

export function HouseholdProvider({ children }) {
  // ── auth ──
  const [firebaseUser, setFirebaseUser]   = useState(null);
  const [authMode, setAuthMode]           = useState(null); // 'google'|'email'|'anonymous'
  const [authLoading, setAuthLoading]     = useState(true);
  const [emailLinkSent, setEmailLinkSent] = useState(false); // waiting for magic link click
  const [needsEmailForLink, setNeedsEmailForLink] = useState(false); // opened link on new device

  // ── household list ──
  const [myHouseholds, setMyHouseholds] = useState([]); // [{ hid, token, name, lastVisited, status }]

  // ── active household ──
  const [token, setToken]             = useState(null);
  const [hhName, setHhName]           = useState('My Household');
  const [encKey, setEncKey]           = useState(null);
  const [householdId, setHouseholdId] = useState(null);
  const [myRole, setMyRole]           = useState(null);
  const [isKnocking, setIsKnocking]   = useState(false);

  // ── incoming join URL ──
  const [pendingJoinToken, setPendingJoinToken] = useState(null);

  // ── membership ──
  const [members, setMembers]               = useState({});
  const [pendingMembers, setPendingMembers] = useState({});

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

  // ── always-current refs ──
  const encKeyRef      = useRef(null);
  const householdIdRef = useRef(null);
  useEffect(() => { encKeyRef.current = encKey; }, [encKey]);
  useEffect(() => { householdIdRef.current = householdId; }, [householdId]);

  function toast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2800);
  }

  // ── boot ──
  useEffect(() => {
    const frag = new URLSearchParams(location.hash.replace(/^#/, ''));
    const joinTok = frag.get('join');
    if (joinTok) {
      history.replaceState(null, '', location.pathname + location.search);
      setPendingJoinToken(joinTok);
    }

    // Complete magic link sign-in if returning from email link
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const savedEmail = localStorage.getItem('homelist-email-link');
      if (savedEmail) {
        signInWithEmailLink(auth, savedEmail, window.location.href)
          .then(() => {
            localStorage.removeItem('homelist-email-link');
            history.replaceState(null, '', window.location.pathname);
          })
          .catch(e => console.warn('Magic link sign-in failed:', e));
      } else {
        // Opened on a different device — need to ask for email
        setNeedsEmailForLink(true);
        history.replaceState(null, '', window.location.pathname);
      }
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setAuthLoading(false); return; }
      setFirebaseUser(user);
      if (user.isAnonymous) {
        setAuthMode('anonymous');
      } else if (user.providerData.some(p => p.providerId === 'google.com')) {
        setAuthMode('google');
      } else {
        setAuthMode('email');
      }

      const households = await loadAllHouseholds(user);
      setMyHouseholds(households);

      if (households.length > 0) {
        const sorted  = [...households].sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0));
        const latest  = sorted.find(h => h.status === 'active') || sorted[0];
        await resumeSession(user, latest);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  async function resumeSession(user, entry) {
    const { hid, token: tok, name, status } = entry;
    try {
      if (status === 'pending') {
        // Still waiting for approval
        const pendSnap = await getDoc(doc(db, 'households', hid, 'pending', user.uid));
        if (pendSnap.exists()) {
          setToken(tok); setHouseholdId(hid); setHhName(name); setIsKnocking(true);
        }
        return;
      }
      const memberSnap = await getDoc(doc(db, 'households', hid, 'members', user.uid));
      if (!memberSnap.exists()) return; // stale entry
      const keySnap  = await getDoc(doc(db, 'households', hid, 'profile', 'encKey'));
      const key      = await importEncKey(keySnap.data().k);
      const metaSnap = await getDoc(doc(db, 'households', hid, 'profile', 'meta'));
      const n        = metaSnap.exists() ? metaSnap.data().name : name;
      setToken(tok); setHouseholdId(hid); setEncKey(key);
      setHhName(n);  setMyRole(memberSnap.data().role);
    } catch (e) {
      console.warn('Session resume failed:', e);
    }
  }

  // ── watch for approval on all pending households ──
  const pendingHids = myHouseholds.filter(h => h.status === 'pending').map(h => h.hid).join(',');
  useEffect(() => {
    if (!firebaseUser || !pendingHids) return;
    const pending = myHouseholds.filter(h => h.status === 'pending');

    const unsubs = pending.map(({ hid, token: tok, name }) =>
      onSnapshot(
        doc(db, 'households', hid, 'members', firebaseUser.uid),
        async snap => {
          if (!snap.exists()) return;
          // Approved
          setMyHouseholds(prev => prev.map(h =>
            h.hid === hid ? { ...h, status: 'active', role: snap.data().role } : h
          ));
          await persistHousehold(firebaseUser, hid, tok, name, 'active');

          if (householdIdRef.current === hid) {
            // This is the one we're waiting at full-screen
            try {
              const keySnap = await getDoc(doc(db, 'households', hid, 'profile', 'encKey'));
              const key = await importEncKey(keySnap.data().k);
              setEncKey(key); setMyRole(snap.data().role); setIsKnocking(false);
              toast('You\'ve been let in! Welcome 🏠');
            } catch {}
          } else {
            toast(`Approved to join ${name}! Tap to switch.`);
          }
        }
      )
    );
    return () => unsubs.forEach(u => u());
  }, [pendingHids, firebaseUser?.uid]);

  // ── Firestore data listeners (active household only) ──
  useEffect(() => {
    if (!householdId || !encKey) { setSyncStatus('offline'); return; }

    let mounted = true;
    const unsubs = [];
    const loaded = { items: false, trades: false, bdays: false, todos: false };

    function collListener(colName, setter, validate) {
      return onSnapshot(
        collection(db, 'households', householdId, colName),
        async snap => {
          if (!mounted) return;
          const ek = encKeyRef.current;
          if (!loaded[colName]) {
            loaded[colName] = true;
            const fresh = {};
            await Promise.all(snap.docs.map(async d => {
              const data = await dec(d.data().c, ek);
              if (data && !data._deleted && validate(data)) fresh[d.id] = { id: d.id, ...data };
            }));
            if (mounted) setter(fresh);
          } else {
            const changes = await Promise.all(
              snap.docChanges().map(async ch => ({
                ch, data: ch.type !== 'removed' ? await dec(ch.doc.data().c, ek) : null,
              }))
            );
            if (mounted) setter(prev => {
              const next = { ...prev };
              for (const { ch, data } of changes) {
                if (ch.type === 'removed' || !data || data._deleted || !validate(data)) delete next[ch.doc.id];
                else next[ch.doc.id] = { id: ch.doc.id, ...data };
              }
              return next;
            });
          }
          if (mounted) setSyncStatus('online');
        },
        () => { if (mounted) setSyncStatus('offline'); }
      );
    }

    function docListener(path, onData) {
      return onSnapshot(doc(db, 'households', householdId, ...path), async snap => {
        if (!mounted || !snap.exists()) return;
        const data = await dec(snap.data().c, encKeyRef.current);
        if (data) onData(data);
      });
    }

    setSyncStatus('syncing');
    unsubs.push(collListener('items',  setItems,  d => !!d.name));
    unsubs.push(collListener('trades', setTrades, d => !!d.name));
    unsubs.push(collListener('bdays',  setBdays,  d => !!d.name && !!d.date));
    unsubs.push(collListener('todos',  setTodos,  d => !!d.title));
    unsubs.push(docListener(['meta', 'cats'],     d => { if (Array.isArray(d) && d.length) setCats(d); }));
    unsubs.push(docListener(['meta', 'todoCats'], d => { if (Array.isArray(d) && d.length) setTodoCats(d); }));
    unsubs.push(docListener(['meta', 'hhName'],   d => { if (d.v) setHhName(d.v); }));

    unsubs.push(onSnapshot(collection(db, 'households', householdId, 'members'), snap => {
      if (!mounted) return;
      const mems = {};
      snap.docs.forEach(d => { mems[d.id] = { uid: d.id, ...d.data() }; });
      setMembers(mems);
      if (firebaseUser && mems[firebaseUser.uid]) setMyRole(mems[firebaseUser.uid].role);
    }));

    unsubs.push(onSnapshot(collection(db, 'households', householdId, 'pending'), snap => {
      if (!mounted) return;
      const pend = {};
      snap.docs.forEach(d => { pend[d.id] = { uid: d.id, ...d.data() }; });
      setPendingMembers(pend);
    }));

    return () => { mounted = false; unsubs.forEach(fn => fn()); };
  }, [householdId, encKey]);

  // ── write helpers ──

  async function ensureAuth() {
    if (!auth.currentUser) await signInAnonymously(auth);
  }

  async function fsEncWrite(segments, payload) {
    const ek  = encKeyRef.current;
    const hid = householdIdRef.current;
    if (!hid || !ek) return;
    try {
      const c = await enc(payload, ek);
      await setDoc(doc(db, 'households', hid, ...segments), { c });
    } catch (e) { console.warn('Firestore write failed:', e); }
  }

  // ══ AUTH ══════════════════════════════════════════════════════════════════

  async function signInWithGoogle() {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { if (e.code !== 'auth/popup-closed-by-user') toast('Google sign-in failed'); }
  }

  async function signInAnonymous() {
    try { await signInAnonymously(auth); }
    catch { toast('Sign-in failed — please try again'); }
  }

  async function signOutUser() {
    await storeDel('homelist-households');
    await signOut(auth);
    setFirebaseUser(null); setAuthMode(null);
    setToken(null); setHhName('My Household'); setEncKey(null);
    setHouseholdId(null); setMyRole(null); setMyHouseholds([]);
    setMembers({}); setPendingMembers({}); setIsKnocking(false);
    setItems({}); setCats(DEFAULT_CATS.map(c => ({ ...c }))); setTrades({});
    setBdays({}); setTodos({}); setTodoCats([...DEFAULT_TODO_CATS]);
    setSyncStatus('offline');
  }

  async function sendMagicLink(email) {
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: window.location.origin,
        handleCodeInApp: true,
      });
      localStorage.setItem('homelist-email-link', email);
      setEmailLinkSent(true);
    } catch (e) {
      toast('Failed to send link — check the email address');
      console.warn(e);
    }
  }

  async function completeEmailLink(email) {
    try {
      await signInWithEmailLink(auth, email, window.location.href);
      localStorage.removeItem('homelist-email-link');
      setNeedsEmailForLink(false);
      history.replaceState(null, '', window.location.pathname);
    } catch (e) {
      toast('Sign-in failed — the link may have expired');
      console.warn(e);
    }
  }

  async function linkWithGoogle() {
    try {
      const result = await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      setFirebaseUser(result.user);
      setAuthMode('google');
      // migrate household list from localStorage → Firestore
      const localList = (await storeLoad('homelist-households')) || [];
      for (const h of localList) {
        await setDoc(doc(db, 'users', result.user.uid, 'households', h.hid), {
          token: h.token, name: h.name, lastVisited: h.lastVisited || Date.now(), status: h.status || 'active',
        });
      }
      await storeDel('homelist-households');
      toast('Google account linked — all your households are now recoverable ✓');
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') toast('Google link failed');
    }
  }

  // ══ HOUSEHOLD SWITCHING ═══════════════════════════════════════════════════

  async function switchHousehold(hid) {
    if (hid === householdIdRef.current) return;
    const entry = myHouseholds.find(h => h.hid === hid);
    if (!entry || entry.status === 'pending') return;

    // Tear down active state
    setEncKey(null); setMyRole(null); setMembers({}); setPendingMembers({});
    setItems({}); setTrades({}); setBdays({}); setTodos({});
    setCats(DEFAULT_CATS.map(c => ({ ...c }))); setTodoCats([...DEFAULT_TODO_CATS]);
    setSyncStatus('offline');

    const user = auth.currentUser;
    try {
      const memberSnap = await getDoc(doc(db, 'households', hid, 'members', user.uid));
      if (!memberSnap.exists()) {
        toast('You are no longer a member of that household');
        setMyHouseholds(prev => prev.filter(h => h.hid !== hid));
        await forgetHousehold(user, hid);
        return;
      }
      const keySnap  = await getDoc(doc(db, 'households', hid, 'profile', 'encKey'));
      const key      = await importEncKey(keySnap.data().k);
      const metaSnap = await getDoc(doc(db, 'households', hid, 'profile', 'meta'));
      const name     = metaSnap.exists() ? metaSnap.data().name : entry.name;

      setToken(entry.token); setHouseholdId(hid); setEncKey(key);
      setHhName(name); setMyRole(memberSnap.data().role);

      await persistHousehold(user, hid, entry.token, name, 'active');
      setMyHouseholds(prev => prev.map(h =>
        h.hid === hid ? { ...h, lastVisited: Date.now(), name } : h
      ));
    } catch (e) {
      toast('Failed to switch household');
      console.warn(e);
    }
  }

  // ══ SETUP ═════════════════════════════════════════════════════════════════

  async function createHousehold(name, passphrase) {
    await ensureAuth();
    const tok   = passphrase || genToken();
    const hid   = await tokenToHouseholdId(tok);
    const n     = name || 'My Household';
    const rawK  = genRawKey();
    const key   = await importEncKey(rawK);
    const myUid = auth.currentUser.uid;
    const user  = auth.currentUser;

    const batch = writeBatch(db);
    batch.set(doc(db, 'households', hid, 'profile', 'encKey'), { k: rawK });
    batch.set(doc(db, 'households', hid, 'profile', 'meta'), {
      name: n, createdAt: Date.now(), primaryUid: myUid, inviteOpen: false,
    });
    batch.set(doc(db, 'households', hid, 'members', myUid), {
      role: 'primary', name: n, joinedAt: Date.now(), invitedBy: null,
    });
    await batch.commit();

    await persistHousehold(user, hid, tok, n, 'active');
    setMyHouseholds(prev => [...prev.filter(h => h.hid !== hid), { hid, token: tok, name: n, lastVisited: Date.now(), status: 'active' }]);

    // Tear down old household state cleanly
    setMembers({}); setPendingMembers({}); setItems({});
    setCats(DEFAULT_CATS.map(c => ({ ...c }))); setTrades({});
    setBdays({}); setTodos({}); setTodoCats([...DEFAULT_TODO_CATS]);

    setToken(tok); setHhName(n); setEncKey(key); setHouseholdId(hid); setMyRole('primary');
    toast('Household created! Open the doorbell to invite someone 🏠');
    return tok;
  }

  async function knockOnHousehold(tok, knockerName) {
    await ensureAuth();
    const hid   = await tokenToHouseholdId(tok);
    const myUid = auth.currentUser.uid;
    const user  = auth.currentUser;
    const n     = knockerName || 'Someone';

    // Already a member? Just switch.
    try {
      const memberSnap = await getDoc(doc(db, 'households', hid, 'members', myUid));
      if (memberSnap.exists()) {
        await persistHousehold(user, hid, tok, hhName, 'active');
        setMyHouseholds(prev => {
          if (prev.find(h => h.hid === hid)) return prev;
          return [...prev, { hid, token: tok, name: hhName, lastVisited: Date.now(), status: 'active' }];
        });
        await switchHousehold(hid);
        setPendingJoinToken(null);
        return;
      }
    } catch {}

    let householdName = 'My Household';
    try {
      const metaSnap = await getDoc(doc(db, 'households', hid, 'profile', 'meta'));
      if (metaSnap.exists()) householdName = metaSnap.data().name;
    } catch {}

    await setDoc(doc(db, 'households', hid, 'pending', myUid), {
      name: n, requestedAt: Date.now(), uid: myUid,
    });

    await persistHousehold(user, hid, tok, householdName, 'pending');
    setMyHouseholds(prev => {
      if (prev.find(h => h.hid === hid)) return prev;
      return [...prev, { hid, token: tok, name: householdName, lastVisited: Date.now(), status: 'pending' }];
    });
    setPendingJoinToken(null);

    if (!encKey) {
      // No active household — show full-screen wait
      setToken(tok); setHouseholdId(hid); setHhName(householdName); setIsKnocking(true);
    } else {
      toast(`Knock sent to ${householdName}! You'll be notified when let in.`);
    }
  }

  async function withdrawKnock(hid) {
    const targetHid = hid || householdIdRef.current;
    const user      = auth.currentUser;
    if (!targetHid || !user) return;
    try { await deleteDoc(doc(db, 'households', targetHid, 'pending', user.uid)); } catch {}
    await forgetHousehold(user, targetHid);
    setMyHouseholds(prev => prev.filter(h => h.hid !== targetHid));

    if (householdIdRef.current === targetHid) {
      setIsKnocking(false); setToken(null); setHouseholdId(null);
    }
  }

  // ══ INVITE MANAGEMENT ═════════════════════════════════════════════════════

  async function openDoorbell() {
    const hid = householdIdRef.current;
    if (!hid) return;
    await setDoc(doc(db, 'households', hid, 'profile', 'meta'), { inviteOpen: true }, { merge: true });
  }

  async function copyJoinLink() {
    await openDoorbell();
    const link = `${location.href.split('#')[0]}#join=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Join link copied! Doorbell is open — approve when they knock 🔔');
    } catch {
      toast('Copy failed — try selecting manually');
    }
  }

  async function approveMember(knockerUid, knockerName, role = 'editor') {
    const hid   = householdIdRef.current;
    const myUid = auth.currentUser?.uid;
    if (!hid) return;
    const batch = writeBatch(db);
    batch.set(doc(db, 'households', hid, 'members', knockerUid), {
      role, name: knockerName, joinedAt: Date.now(), invitedBy: myUid,
    });
    batch.delete(doc(db, 'households', hid, 'pending', knockerUid));
    batch.set(doc(db, 'households', hid, 'profile', 'meta'), { inviteOpen: false }, { merge: true });
    await batch.commit();
    toast(`${knockerName} has been let in ✓`);
  }

  async function rejectKnock(knockerUid) {
    const hid = householdIdRef.current;
    if (!hid) return;
    await deleteDoc(doc(db, 'households', hid, 'pending', knockerUid));
  }

  async function removeMember(memberUid) {
    const hid = householdIdRef.current;
    if (!hid || !confirm('Remove this member?')) return;
    await deleteDoc(doc(db, 'households', hid, 'members', memberUid));
    toast('Member removed');
  }

  async function updateMemberRole(memberUid, newRole) {
    const hid = householdIdRef.current;
    if (!hid) return;
    await setDoc(doc(db, 'households', hid, 'members', memberUid), { role: newRole }, { merge: true });
    toast('Role updated ✓');
  }

  async function renameMember(memberUid, newName) {
    const hid = householdIdRef.current;
    if (!hid || !newName.trim()) return;
    await setDoc(doc(db, 'households', hid, 'members', memberUid), { name: newName.trim() }, { merge: true });
    toast('Name updated ✓');
  }

  async function transferPrimary(memberUid) {
    const hid   = householdIdRef.current;
    const myUid = auth.currentUser?.uid;
    if (!hid || !confirm('Transfer primary keyholder to this member? You will become an admin.')) return;
    const batch = writeBatch(db);
    batch.set(doc(db, 'households', hid, 'members', memberUid), { role: 'primary' }, { merge: true });
    batch.set(doc(db, 'households', hid, 'members', myUid),     { role: 'admin'   }, { merge: true });
    batch.set(doc(db, 'households', hid, 'profile', 'meta'),    { primaryUid: memberUid }, { merge: true });
    await batch.commit();
    toast('Primary keyholder transferred');
  }

  async function leaveHousehold() {
    if (!confirm('Leave this household?')) return;
    const hid   = householdIdRef.current;
    const user  = auth.currentUser;
    if (hid && user) {
      try { await deleteDoc(doc(db, 'households', hid, 'members', user.uid)); } catch {}
      await forgetHousehold(user, hid);
    }
    const remaining = myHouseholds.filter(h => h.hid !== hid && h.status === 'active');
    setMyHouseholds(prev => prev.filter(h => h.hid !== hid));

    setToken(null); setHhName('My Household'); setEncKey(null); setHouseholdId(null);
    setMyRole(null); setMembers({}); setPendingMembers({}); setIsKnocking(false);
    setItems({}); setCats(DEFAULT_CATS.map(c => ({ ...c }))); setTrades({});
    setBdays({}); setTodos({}); setTodoCats([...DEFAULT_TODO_CATS]);
    setSyncStatus('offline');

    if (remaining.length > 0) {
      const next = [...remaining].sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0))[0];
      await switchHousehold(next.hid);
    }
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
    setItems(prev => { const next = { ...prev }; toDelete.forEach(id => delete next[id]); return next; });
    await Promise.all(toDelete.map(id => fsEncWrite(['items', id], { _deleted: true, name: null, _dev: DEVICE_ID })));
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
    token, hhName, householdId,
    isLoggedIn: !!encKey,
    pendingJoinToken, isKnocking,
    authMode, firebaseUser, authLoading,
    myRole, members, pendingMembers,
    myHouseholds,
    items, cats, trades, bdays, todos, todoCats,
    syncStatus, toastMsg,
    emailLinkSent, needsEmailForLink,
    canEdit: myRole !== 'viewer' && !!encKey,
    // auth
    signInWithGoogle, signInAnonymous, signOutUser, linkWithGoogle,
    sendMagicLink, completeEmailLink,
    // household
    createHousehold, knockOnHousehold, withdrawKnock, leaveHousehold, switchHousehold,
    // invite
    copyJoinLink, openDoorbell,
    approveMember, rejectKnock, removeMember, updateMemberRole, renameMember, transferPrimary,
    // shopping
    addItem, toggleItem, deleteItem, clearChecked,
    saveCats,
    saveTrade, deleteTrade,
    saveBday, deleteBday,
    saveTodo, toggleTodoDone, deleteTodo, saveTodoCats,
    toast,
  };

  return <HouseholdCtx.Provider value={value}>{children}</HouseholdCtx.Provider>;
}
