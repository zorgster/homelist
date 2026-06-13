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
      placeholder={placeholder || 'four words, e.g. horse waffle somerset bloom'}
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
    createHousehold, knockOnHousehold, withdrawKnock,
    pendingJoinToken, isKnocking, hhName, token,
    emailLinkSent, needsEmailForLink,
    toast, signInWithGoogle, signInAnonymous,
    sendMagicLink, completeEmailLink,
    authMode, firebaseUser,
  } = useHousehold();

  const [generated, setGenerated]   = useState(() => genToken());
  const [newHhName, setNewHhName]   = useState('');
  const [joinWords, setJoinWords]   = useState('');
  const [knockerName, setKnockerName] = useState('');
  const [email, setEmail]           = useState('');
  const [emailForLink, setEmailForLink] = useState(''); // cross-device link completion

  // ── Cross-device magic link: needs email to complete ──
  if (needsEmailForLink) {
    return (
      <div id="setup">
        <Hero />
        <div className="card">
          <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: 8 }}>
            Enter the email address you used to request the sign-in link.
          </p>
          <div className="group">
            <input
              type="email"
              placeholder="your@email.com"
              value={emailForLink}
              autoFocus
              onChange={e => setEmailForLink(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && completeEmailLink(emailForLink)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => completeEmailLink(emailForLink)}>
            Sign in →
          </button>
        </div>
      </div>
    );
  }

  // ── Magic link sent — waiting for click ──
  if (emailLinkSent) {
    return (
      <div id="setup">
        <Hero />
        <div className="card">
          <div className="knock-waiting">
            <div className="knock-icon">✉️</div>
            <h3>Check your email</h3>
            <p>We sent a sign-in link to <strong>{email}</strong>.<br />Click it to continue.</p>
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => sendMagicLink(email)}>
            Resend link
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: no auth yet ──
  if (!firebaseUser) {
    async function handleSendLink() {
      if (!email.trim() || !email.includes('@')) { toast('Enter a valid email address'); return; }
      await sendMagicLink(email.trim());
    }

    return (
      <div id="setup">
        <Hero />
        <div className="card">
          {pendingJoinToken && <div className="lock-badge">🔔 Join link detected</div>}

          <button className="btn btn-primary" onClick={signInWithGoogle}>
            Sign in with Google
          </button>

          <div className="divider">or</div>

          <div className="group">
            <label>Sign in with email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              autoComplete="email"
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendLink()}
            />
            <button
              className="btn btn-ghost"
              onClick={handleSendLink}
              style={{ opacity: email.includes('@') ? 1 : 0.4, pointerEvents: email.includes('@') ? 'auto' : 'none' }}
            >
              Send magic link →
            </button>
          </div>

          <div className="divider">or</div>

          <button className="btn btn-ghost" onClick={signInAnonymous} style={{ fontSize: '.8rem' }}>
            Just joining someone's household →
          </button>
        </div>
        <p className="setup-note">
          An account lets you recover and switch between households from any device.
        </p>
      </div>
    );
  }

  // ── Waiting for knock approval ──
  if (isKnocking) {
    return (
      <div id="setup">
        <Hero />
        <div className="card">
          <div className="knock-waiting">
            <div className="knock-icon">🔔</div>
            <h3>Waiting at the door…</h3>
            <p>
              Your request to join <strong>{hhName}</strong> has been sent.
              A household member needs to let you in.
            </p>
            {token && (
              <div className="short-id" style={{ margin: '12px 0' }}>
                {shortId(token)}
                <small>Household address</small>
              </div>
            )}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => withdrawKnock()}>
            Withdraw request
          </button>
        </div>
        {authMode === 'google' && firebaseUser && (
          <p className="setup-note">Signed in as {firebaseUser.email}</p>
        )}
        {authMode === 'email' && firebaseUser && (
          <p className="setup-note">Signed in as {firebaseUser.email}</p>
        )}
      </div>
    );
  }

  // ── Pending join via URL (confirm knock) ──
  if (pendingJoinToken) {
    async function handleKnock() {
      let tok = null;
      if (pendingJoinToken.includes('#')) {
        tok = new URLSearchParams(pendingJoinToken.split('#')[1]).get('join') || null;
      }
      if (!tok) tok = normalizePassphrase(pendingJoinToken);
      if (!tok) tok = pendingJoinToken;
      await knockOnHousehold(tok, knockerName || 'Someone');
    }

    return (
      <div id="setup">
        <Hero />
        <div className="card">
          <div className="lock-badge">🔔 You've been invited — knock to join</div>
          {authMode === 'anonymous' && (
            <div className="anon-warning">
              ⚠ Without an account you can join but not create households.
            </div>
          )}
          <div className="group">
            <label>Your name for this household</label>
            <input
              type="text"
              placeholder="e.g. Alex"
              maxLength={30}
              value={knockerName}
              onChange={e => setKnockerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleKnock()}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={handleKnock}>
            Knock on the door →
          </button>
        </div>
        {firebaseUser?.email && (
          <p className="setup-note">Signed in as {firebaseUser.email}</p>
        )}
      </div>
    );
  }

  // ── Step 2: create or join ──

  async function handleCreate() {
    if (authMode === 'anonymous') {
      toast('You need an account to create a household');
      return;
    }
    if (!newHhName.trim()) { toast('Enter a name for your household'); return; }
    await createHousehold(newHhName.trim(), generated);
  }

  async function handleJoin() {
    let tok = null;
    if (joinWords.includes('#')) {
      tok = new URLSearchParams(joinWords.split('#')[1]).get('join') || null;
    }
    if (!tok) tok = normalizePassphrase(joinWords);
    if (!tok) { toast('Enter at least four words to join'); return; }
    await knockOnHousehold(tok, 'Someone');
  }

  const isAnon = authMode === 'anonymous';

  return (
    <div id="setup">
      <Hero />
      {isAnon && (
        <div className="anon-warning">
          ⚠ You're in guest mode — you can join households but not create them.
        </div>
      )}
      <div className="card">
        {!isAnon && (
          <>
            <div className="group">
              <label>Create a new household</label>
              <div className="generated-key">
                <span>{shortId(generated)}</span>
                <button className="regen-btn" onClick={() => setGenerated(genToken())} title="Generate new words">↻</button>
              </div>
              <small style={{ color: 'var(--muted)', fontSize: '.72rem' }}>
                Your four-word address — share these to invite someone
              </small>
              <input
                type="text"
                placeholder="Household name, e.g. The Smiths"
                maxLength={30}
                value={newHhName}
                onChange={e => setNewHhName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <button className="btn btn-primary" onClick={handleCreate}>
                Create household →
              </button>
            </div>
            <div className="divider">or join an existing one</div>
          </>
        )}
        <div className="group">
          <label>Join with four words or a join link</label>
          <WordInput
            value={joinWords}
            onChange={setJoinWords}
            onEnter={handleJoin}
            placeholder="your four words or paste a join link…"
            autoFocus={isAnon}
          />
          <button
            className="btn btn-ghost"
            onClick={handleJoin}
            style={{ opacity: joinWords.trim() ? 1 : 0.4, pointerEvents: joinWords.trim() ? 'auto' : 'none' }}
          >
            Knock on the door →
          </button>
        </div>
      </div>
      {firebaseUser?.email && (
        <p className="setup-note">Signed in as {firebaseUser.email}</p>
      )}
    </div>
  );
}
