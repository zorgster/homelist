const TABS = [
  { id: 'shop',   icon: '🛒', label: 'Shopping' },
  { id: 'todo',   icon: '✅', label: 'To Do' },
  { id: 'trades', icon: '🔧', label: 'Trades' },
  { id: 'bdays',  icon: '🎂', label: 'Birthdays' },
];

export default function TabBar({ activeTab, onSwitch }) {
  return (
    <nav className="tab-bar">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
          onClick={() => onSwitch(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
