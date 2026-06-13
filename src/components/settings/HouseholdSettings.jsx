import { useHousehold } from '../../context/HouseholdContext';
import { shortId } from '../../lib/crypto';

export default function HouseholdSettings({ isOpen, onClose, onOpenCatEditor }) {
  const {
    token, syncStatus, authMode, firebaseUser,
    leaveHousehold, refreshHouseholdKey, toast,
  } = useHousehold();

  function copyJoinLink() {
    const link = `${location.href.split('#')[0]}#join=${token}`;
    navigator.clipboard.writeText(link)
      .then(() => { toast('Join link copied! Send it to your household 🔗'); onClose(); })
      .catch(() => toast('Copy failed — try selecting manually'));
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

        {authMode === 'google' && firebaseUser ? (
          <div className="auth-mode-badge google">
            Signed in as {firebaseUser.email}
          </div>
        ) : (
          <div className="auth-mode-badge anon">
            ⚠ Anonymous — keep your join link safe
          </div>
        )}

        <div className={`fb-status${syncStatus === 'online' ? ' connected' : ''}`}>
          {syncStatus === 'online'   ? '✓ Synced with Firestore'
         : syncStatus === 'syncing' ? 'Connecting…'
         : '⚠ Offline'}
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
