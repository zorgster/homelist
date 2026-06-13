import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../hooks/useTheme';

export default function Header({ onOpenSettings, onOpenSwitcher }) {
  const { hhName, syncStatus, pendingMembers, myRole, myHouseholds } = useHousehold();
  const { theme, toggle } = useTheme();

  const label = syncStatus === 'online'   ? 'synced'
              : syncStatus === 'syncing'  ? 'connecting…'
              : 'local only';

  const knockCount    = Object.keys(pendingMembers || {}).length;
  const canInvite     = myRole === 'primary' || myRole === 'admin';
  const hasBadge      = canInvite && knockCount > 0;
  const hasMultiple   = myHouseholds && myHouseholds.length > 1;
  const hasPending    = myHouseholds && myHouseholds.some(h => h.status === 'pending');

  return (
    <header>
      <div className="h-left">
        <div className="logo sm">home<em>list</em></div>
        <button
          className={`hhname-btn${hasMultiple || hasPending ? ' switchable' : ''}`}
          onClick={onOpenSwitcher}
          title="Switch household"
        >
          <span className="hhname">{hhName}</span>
          {(hasMultiple || hasPending) && <span className="switch-chevron">⌄</span>}
          {hasPending && !hasMultiple && <span className="pending-dot" />}
        </button>
      </div>
      <div className="h-right">
        <div className={`sync-pill ${syncStatus}`}>
          <div className="dot" />
          <span>{label}</span>
        </div>
        <button className="ic-btn" onClick={toggle} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="ic-btn settings-btn" onClick={onOpenSettings} title="Settings">
          ⚙
          {hasBadge && <span className="knock-badge">{knockCount}</span>}
        </button>
      </div>
    </header>
  );
}
