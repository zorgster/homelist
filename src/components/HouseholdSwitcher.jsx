import { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { genToken, normalizePassphrase, shortId } from '../lib/crypto';

const ROLE_LABELS = { primary: 'Primary', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };

export default function HouseholdSwitcher({ isOpen, onClose }) {
  const {
    householdId, myHouseholds, switchHousehold,
    createHousehold, knockOnHousehold, withdrawKnock,
    toast,
  } = useHousehold();

  const [mode, setMode]           = useState(null); // null | 'create' | 'join'
  const [generated, setGenerated] = useState(() => genToken());
  const [newName, setNewName]     = useState('');
  const [joinWords, setJoinWords] = useState('');
  const [knockerName, setKnockerName] = useState('');

  function close() { setMode(null); setNewName(''); setJoinWords(''); setKnockerName(''); onClose(); }

  async function handleSwitch(hid) {
    if (hid === householdId) { close(); return; }
    close();
    await switchHousehold(hid);
  }

  async function handleCreate() {
    if (!newName.trim()) { toast('Enter a household name'); return; }
    await createHousehold(newName.trim(), generated);
    close();
  }

  async function handleJoin() {
    let tok = null;
    if (joinWords.includes('#')) tok = new URLSearchParams(joinWords.split('#')[1]).get('join') || null;
    if (!tok) tok = normalizePassphrase(joinWords);
    if (!tok) { toast('Enter at least four words'); return; }
    await knockOnHousehold(tok, knockerName || 'Someone');
    close();
  }

  const sorted = [...myHouseholds].sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0));

  return (
    <div className={`overlay${isOpen ? ' open' : ''}`} onClick={close}>
      <div className="modal switcher-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h3>Your households</h3>

        {/* ── Household list ── */}
        <div className="switcher-list">
          {sorted.map(h => {
            const isActive  = h.hid === householdId;
            const isPending = h.status === 'pending';
            return (
              <div
                key={h.hid}
                className={`switcher-row${isActive ? ' active' : ''}${isPending ? ' pending' : ''}`}
                onClick={() => !isPending && handleSwitch(h.hid)}
              >
                <div className="switcher-info">
                  <span className="switcher-name">{h.name}</span>
                  {h.role && !isPending && (
                    <span className="switcher-role">{ROLE_LABELS[h.role] || h.role}</span>
                  )}
                  {isPending && <span className="switcher-pending">⏳ Waiting to be let in</span>}
                </div>
                {isPending ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={e => { e.stopPropagation(); withdrawKnock(h.hid); }}
                  >
                    Withdraw
                  </button>
                ) : isActive ? (
                  <span className="switcher-check">✓</span>
                ) : (
                  <span className="switcher-arrow">→</span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Add another ── */}
        {!mode && (
          <div className="switcher-add-row">
            <button className="btn btn-ghost" onClick={() => setMode('join')}>
              + Join a household
            </button>
            <button className="btn btn-ghost" onClick={() => setMode('create')}>
              + Create new
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="switcher-form">
            <div className="generated-key" style={{ marginBottom: 6 }}>
              <span>{shortId(generated)}</span>
              <button className="regen-btn" onClick={() => setGenerated(genToken())}>↻</button>
            </div>
            <input
              type="text"
              placeholder="Household name"
              maxLength={30}
              value={newName}
              autoFocus
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <div className="switcher-form-btns">
              <button className="btn btn-primary" onClick={handleCreate}>Create →</button>
              <button className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="switcher-form">
            <input
              type="text"
              placeholder="Four words or paste a join link…"
              value={joinWords}
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
              onChange={e => setJoinWords(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <input
              type="text"
              placeholder="Your name (optional)"
              maxLength={30}
              value={knockerName}
              onChange={e => setKnockerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <div className="switcher-form-btns">
              <button className="btn btn-primary" onClick={handleJoin}>Knock →</button>
              <button className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
