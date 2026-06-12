import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../hooks/useTheme';

export default function Header({ onOpenSettings }) {
  const { hhName, syncStatus } = useHousehold();
  const { theme, toggle } = useTheme();

  const label = syncStatus === 'online' ? 'synced'
              : syncStatus === 'syncing' ? 'connecting…'
              : 'local only';

  return (
    <header>
      <div className="h-left">
        <div className="logo sm">home<em>list</em></div>
        <div className="hhname">{hhName}</div>
      </div>
      <div className="h-right">
        <div className={`sync-pill ${syncStatus}`}>
          <div className="dot" />
          <span>{label}</span>
        </div>
        <button className="ic-btn" onClick={toggle} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="ic-btn" onClick={onOpenSettings} title="Settings">⚙</button>
      </div>
    </header>
  );
}
