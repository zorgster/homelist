import { useState, useRef } from 'react';
import { useHousehold } from '../context/HouseholdContext';

export default function Setup() {
  const { createHousehold, joinHousehold, pendingJoinToken, toast } = useHousehold();
  const [hhName, setHhName]       = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [parsedToken, setParsedToken] = useState(null);
  const [joinName, setJoinName]   = useState('');

  // Pre-filled join from URL fragment
  if (pendingJoinToken) {
    return (
      <div id="setup">
        <div className="hero">
          <div className="logo">home<em>list</em></div>
          <p className="tagline">Your household, always in sync</p>
        </div>
        <div className="card">
          <div className="lock-badge">
            🔒 Encrypted join link detected — your list is end-to-end encrypted
          </div>
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
        <p className="setup-note">The join link contains your encrypted household secret.</p>
      </div>
    );
  }

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
      <div className="hero">
        <div className="logo">home<em>list</em></div>
        <p className="tagline">Your household, always in sync</p>
      </div>
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
          <label>Paste a join link</label>
          <input
            className="join-paste"
            type="text"
            placeholder="Paste the join link your household shared…"
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
      <p className="setup-note">
        No account needed. Data is end-to-end encrypted — the server never sees plaintext.
      </p>
    </div>
  );
}
