import { useState, useRef } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { shortId } from '../../lib/crypto';

export default function HouseholdSettings({ isOpen, onClose, onOpenCatEditor }) {
  const {
    token, hhName, firebaseConfig, syncStatus,
    saveFirebaseConfig, clearFirebaseConfig,
    leaveHousehold, refreshHouseholdKey, toast,
  } = useHousehold();

  const [fbInput, setFbInput] = useState('');
  const textRef = useRef(null);

  function copyJoinLink() {
    const link = `${location.href.split('#')[0]}#join=${token}`;
    navigator.clipboard.writeText(link)
      .then(() => { toast('Join link copied! Send it to your household 🔗'); onClose(); })
      .catch(() => toast('Copy failed — try selecting manually'));
  }

  async function applyFirebase() {
    const raw = fbInput.trim();
    if (!raw) return;
    try {
      const config = JSON.parse(raw);
      if (!config.apiKey || !config.projectId) {
        toast('Config needs at least apiKey and projectId'); return;
      }
      await saveFirebaseConfig(config);
      setFbInput('');
    } catch {
      toast('Invalid JSON — paste the full Firebase config object');
    }
  }

  async function handleLeave() {
    onClose();
    await leaveHousehold();
  }

  async function handleRefreshKey() {
    onClose();
    await refreshHouseholdKey();
  }

  return (
    <div className={`overlay${isOpen ? ' open' : ''}`} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h3>Household settings</h3>

        <div className="short-id">
          {shortId(token)}
          <small>Household short ID (display only)</small>
        </div>

        <div className="enc-badge">🔒 End-to-end encrypted · server sees only ciphertext</div>

        {/* Firebase sync */}
        <div className="fb-section">
          <label>Firebase sync</label>
          {firebaseConfig ? (
            <>
              <div className={`fb-status${syncStatus === 'online' ? ' connected' : ''}`}>
                {syncStatus === 'online'   ? '✓ Connected to Firestore'
               : syncStatus === 'syncing' ? 'Connecting…'
               : '⚠ Connection error — check config'}
              </div>
              <button className="fb-disconnect" onClick={clearFirebaseConfig}>
                Disconnect Firebase
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: '.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                Paste your Firebase project config JSON to enable real-time sync across devices.
              </p>
              <textarea
                ref={textRef}
                className="fb-textarea"
                placeholder={'{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "..."\n}'}
                value={fbInput}
                onChange={e => setFbInput(e.target.value)}
              />
              <button className="fb-apply" onClick={applyFirebase}>
                Connect Firebase →
              </button>
            </>
          )}
        </div>

        <div className="modal-btns">
          <button className="btn btn-primary" onClick={copyJoinLink}>📋 Copy join link</button>
          <button className="btn btn-ghost" onClick={handleLeave}>Leave</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="cat-edit-link" onClick={() => { onClose(); onOpenCatEditor(); }}>
            ✏️ Edit categories →
          </button>
          <button className="refresh-key-btn" onClick={handleRefreshKey}>
            🔄 Refresh key
          </button>
        </div>
      </div>
    </div>
  );
}
