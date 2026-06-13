import { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';

function Hero() {
  return (
    <div className="hero">
      <div className="logo">home<em>list</em></div>
      <p className="tagline">Your household, always in sync</p>
    </div>
  );
}

export default function Setup() {
  const {
    createHousehold, joinHousehold, pendingJoinToken, toast,
    signInWithGoogle, signInAnonymous,
    authMode, firebaseUser,
  } = useHousehold();

  const [hhName, setHhName]       = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [parsedToken, setParsedToken] = useState(null);
  const [joinName, setJoinName]   = useState('');

  // ── Step 1: choose auth method ──
  if (!firebaseUser) {
    return (
      <div id="setup">
        <Hero />
        <div className="card">
          {pendingJoinToken && (
            <div className="lock-badge">🔒 Encrypted join link detected</div>
          )}
          <button className="btn btn-primary" onClick={signInWithGoogle}>
            Sign in with Google
          </button>
          <div className="divider">or</div>
          <button className="btn btn-ghost" onClick={signInAnonymous}>
            Continue without an account
          </button>
        </div>
        <p className="setup-note">
          Google sign-in lets you recover your household from any device.<br />
          Without an account, your join link is the only way back in — keep it safe.
        </p>
      </div>
    );
  }

  // ── Pending join (auth established) ──
  if (pendingJoinToken) {
    return (
      <div id="setup">
        <Hero />
        <div className="card">
          <div className="lock-badge">
            🔒 Encrypted join link — your list is end-to-end encrypted
          </div>
          {authMode === 'anonymous' && (
            <div className="anon-warning">
              ⚠ You're joining without an account. Save your join link — it's the only way to reconnect if you clear your browser data.
            </div>
          )}
          <div className="group">
            <label>Your name for this household</label>
            <input
              type="text"
              placeholder="e.g. The Smiths"
              maxLength={30}
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinHousehold(pendingJoinToken, joinName)}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={() => joinHousehold(pendingJoinToken, joinName)}>
            Join household →
          </button>
        </div>
        {authMode === 'google' && firebaseUser && (
          <p className="setup-note">Signed in as {firebaseUser.email}</p>
        )}
      </div>
    );
  }

  // ── Step 2: create or join household ──

  function parseJoinInput(val) {
    setJoinInput(val);
    setParsedToken(null);
    try {
      let frag = val;
      if (val.includes('#')) frag = val.split('#')[1];
      const p = new URLSearchParams(frag);
      const t = p.get('join') || (val.trim().length > 15 && !val.includes(' ') ? val.trim() : null);
      if (t) setParsedToken(t);
    } catch {}
  }

  async function handleCreate() {
    if (!hhName.trim()) { toast('Please enter a household name'); return; }
    await createHousehold(hhName.trim());
  }

  async function handleJoin() {
    if (!parsedToken) { toast('Paste a valid join link first'); return; }
    await joinHousehold(parsedToken, 'My Household');
  }

  return (
    <div id="setup">
      <Hero />
      {authMode === 'anonymous' && (
        <div className="anon-warning">
          ⚠ Without an account, your join link is the only way back in. Store it somewhere safe after creating your household.
        </div>
      )}
      <div className="card">
        <div className="group">
          <label>Create a new household</label>
          <input
            type="text"
            placeholder="e.g. The Smiths"
            maxLength={30}
            value={hhName}
            onChange={e => setHhName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button className="btn btn-primary" onClick={handleCreate}>
            Create household →
          </button>
        </div>
        <div className="divider">or join an existing one</div>
        <div className="group">
          <label>Paste a join link or household key</label>
          <input
            className="join-paste"
            type="text"
            placeholder="Paste a join link or enter the household key…"
            value={joinInput}
            onChange={e => parseJoinInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <button
            className="btn btn-ghost"
            onClick={handleJoin}
            style={{ opacity: parsedToken ? 1 : 0.4, pointerEvents: parsedToken ? 'auto' : 'none' }}
          >
            Join household →
          </button>
        </div>
      </div>
      {authMode === 'google' && firebaseUser ? (
        <p className="setup-note">Signed in as {firebaseUser.email}</p>
      ) : (
        <p className="setup-note">
          Data is end-to-end encrypted — the server never sees plaintext.
        </p>
      )}
    </div>
  );
}
