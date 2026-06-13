import { useHousehold } from '../../context/HouseholdContext';
import { shortId } from '../../lib/crypto';

const ROLE_LABELS = {
  primary: { label: 'Primary', badge: 'badge-primary' },
  admin:   { label: 'Admin',   badge: 'badge-admin' },
  editor:  { label: 'Editor',  badge: 'badge-editor' },
  viewer:  { label: 'Viewer',  badge: 'badge-viewer' },
};

export default function HouseholdSettings({ isOpen, onClose, onOpenCatEditor }) {
  const {
    token, hhName, syncStatus, authMode, firebaseUser,
    myRole, members, pendingMembers,
    leaveHousehold, linkWithGoogle,
    copyJoinLink, closeDoorbell,
    approveMember, rejectKnock, removeMember, updateMemberRole, transferPrimary,
    toast,
  } = useHousehold();

  const canInvite  = myRole === 'primary' || myRole === 'admin';
  const isPrimary  = myRole === 'primary';
  const memberList = Object.values(members).sort((a, b) => {
    const order = { primary: 0, admin: 1, editor: 2, viewer: 3 };
    return (order[a.role] ?? 4) - (order[b.role] ?? 4);
  });
  const pendingList = Object.values(pendingMembers);

  async function handleLeave() {
    onClose();
    await leaveHousehold();
  }

  async function handleCopyInvite() {
    await copyJoinLink();
  }

  return (
    <div className={`overlay${isOpen ? ' open' : ''}`} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h3>Household settings</h3>

        <div className="short-id">
          {shortId(token)}
          <small>Four-word address for this household</small>
        </div>

        {authMode === 'google' && firebaseUser ? (
          <div className="auth-mode-badge google">
            Signed in as {firebaseUser.email}
          </div>
        ) : (
          <>
            <div className="auth-mode-badge anon">
              ⚠ Anonymous — your four-word key is the only way back in
            </div>
            <button className="btn btn-ghost" onClick={linkWithGoogle}>
              Link Google account →
            </button>
          </>
        )}

        <div className={`fb-status${syncStatus === 'online' ? ' connected' : ''}`}>
          {syncStatus === 'online'   ? '✓ Synced with Firestore'
         : syncStatus === 'syncing' ? 'Connecting…'
         : '⚠ Offline'}
        </div>

        {/* ── Pending knocks ── */}
        {canInvite && pendingList.length > 0 && (
          <div className="pending-section">
            <h4>🔔 Knocking ({pendingList.length})</h4>
            {pendingList.map(p => (
              <div key={p.uid} className="pending-row">
                <span className="pending-name">{p.name}</span>
                <div className="pending-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => approveMember(p.uid, p.name)}
                  >
                    Let in
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => rejectKnock(p.uid)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Members ── */}
        {memberList.length > 0 && (
          <div className="members-section">
            <h4>Members</h4>
            {memberList.map(m => {
              const isSelf = m.uid === firebaseUser?.uid;
              const info = ROLE_LABELS[m.role] || { label: m.role, badge: '' };
              return (
                <div key={m.uid} className="member-row">
                  <div className="member-info">
                    <span className="member-name">{m.name}{isSelf ? ' (you)' : ''}</span>
                    <span className={`role-badge ${info.badge}`}>{info.label}</span>
                  </div>
                  {canInvite && !isSelf && m.role !== 'primary' && (
                    <div className="member-actions">
                      <select
                        className="role-select"
                        value={m.role}
                        onChange={e => updateMemberRole(m.uid, e.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      {isPrimary && (
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Transfer primary keyholder"
                          onClick={() => transferPrimary(m.uid)}
                        >
                          ↑ Make primary
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm btn-danger"
                        onClick={() => removeMember(m.uid)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Invite ── */}
        {canInvite && (
          <div className="modal-btns">
            <button className="btn btn-primary" onClick={handleCopyInvite}>
              🔔 Copy invite link
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button className="cat-edit-link" onClick={() => { onClose(); onOpenCatEditor(); }}>
            ✏️ Edit categories →
          </button>
          <button className="btn btn-ghost" onClick={handleLeave}>Leave household</button>
        </div>
      </div>
    </div>
  );
}
