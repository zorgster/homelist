import { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { genToken, normalizePassphrase, shortId } from '../lib/crypto';

function Hero() {
  return (
    <div className="hero">
      <div className="logo">home<em>list</em></div>
      <p className="tagline">Your household, always in sync</p>
    </div>
  );
}

function WordInput({ value, onChange, onEnter, placeholder, autoFocus }) {
  return (
    <input
      type="text"
      placeholder={placeholder || 'four words, e.g. horse waffle somerset'}
      value={value}
      autoFocus={autoFocus}
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onEnter?.()}
    />
  );
}

export default function Setup() {
  const {
    createHousehold, joinHousehold, pendingJoinToken, toast,
    signInWithGoogle, signInAnonymous,
    authMode, firebaseUser,
  } = useHousehold();

  const [generated, setGenerated] = useState(() => genToken());
  const [hhName, setHhName]       = useState('');
  const [joinWords, setJoinWords] = useState('');
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
          Without an account, your four-word key is the only way back in — remember it.
        </p>
      </div>
    );
  }

  // ── Pending join via URL fragment ──
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
              ⚠ Without an account, your four-word key is the only way back in if you clear your browser data.
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

  // ── Step 2: create or join ──

  async function handleCreate() {
    if (!hhName.trim()) { toast('Enter a name for your household'); return; }
    await createHousehold(hhName.trim(), generated);
  }

  async function handleJoin() {
    // Accept a join URL or raw words
    let tok = null;
    if (joinWords.includes('#')) {
      tok = new URLSearchParams(joinWords.split('#')[1]).get('join') || null;
    }
    if (!tok) tok = normalizePassphrase(joinWords);
    if (!tok) { toast('Enter at least four words to join'); return; }
    await joinHousehold(tok, 'My Household');
  }

  return (
    <div id="setup">
      <Hero />
      {authMode === 'anonymous' && (
        <div className="anon-warning">
          ⚠ Without an account, your four-word key is the only way back in. Remember it.
        </div>
      )}
      <div className="card">
        <div className="group">
          <label>Create a new household</label>
          <div className="generated-key">
            <span>{shortId(generated)}</span>
            <button className="regen-btn" onClick={() => setGenerated(genToken())} title="Generate new words">↻</button>
          </div>
          <small style={{ color: 'var(--muted)', fontSize: '.72rem' }}>
            Your household key — share these words to invite someone
          </small>
          <input
            type="text"
            placeholder="Household name, e.g. The Smiths"
            maxLength={30}
            value={hhName}
            onChange={e => setHhName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button className="btn btn-primary" onClick={handleCreate}>
            Create household →
          </button>
        </div>
        <div className="divider">or join an existing one</div>
        <div className="group">
          <label>Join with four words or a join link</label>
          <WordInput
            value={joinWords}
            onChange={setJoinWords}
            onEnter={handleJoin}
            placeholder="your four words or paste a join link…"
          />
          <button
            className="btn btn-ghost"
            onClick={handleJoin}
            style={{ opacity: joinWords.trim() ? 1 : 0.4, pointerEvents: joinWords.trim() ? 'auto' : 'none' }}
          >
            Join household →
          </button>
        </div>
      </div>
      {authMode === 'google' && firebaseUser ? (
        <p className="setup-note">Signed in as {firebaseUser.email}</p>
      ) : (
        <p className="setup-note">Data is end-to-end encrypted — the server never sees plaintext.</p>
      )}
    </div>
  );
}
