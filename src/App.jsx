import { useState, useEffect } from 'react';
import { useHousehold } from './context/HouseholdContext';
import Setup            from './components/Setup';
import Header           from './components/Header';
import TabBar           from './components/TabBar';
import Toast            from './components/Toast';
import ShoppingTab      from './components/shopping/ShoppingTab';
import TodoTab          from './components/todos/TodoTab';
import TradesTab        from './components/trades/TradesTab';
import BirthdaysTab     from './components/birthdays/BirthdaysTab';
import CategoryEditor   from './components/shopping/CategoryEditor';
import HouseholdSettings from './components/settings/HouseholdSettings';

const TABS = ['shop', 'todo', 'trades', 'bdays'];
const tabFromHash = () => {
  const h = location.hash.replace('#', '');
  return TABS.includes(h) ? h : 'shop';
};

export default function App() {
  const { isLoggedIn } = useHousehold();
  const [activeTab, setActiveTab]         = useState(tabFromHash);
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [catEditorOpen, setCatEditorOpen] = useState(false);

  useEffect(() => {
    const onPop = () => setActiveTab(tabFromHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (isLoggedIn && !TABS.includes(location.hash.replace('#', ''))) {
      history.replaceState(null, '', '#' + activeTab);
    }
  }, [isLoggedIn]);

  function switchTab(tab) {
    history.pushState(null, '', '#' + tab);
    setActiveTab(tab);
  }

  if (!isLoggedIn) return <Setup />;

  return (
    <div id="main-wrapper">
      <Header onOpenSettings={() => setSettingsOpen(true)} />

      <ShoppingTab  active={activeTab === 'shop'} />
      <TodoTab      active={activeTab === 'todo'} />
      <TradesTab    active={activeTab === 'trades'} />
      <BirthdaysTab active={activeTab === 'bdays'} />

      <TabBar activeTab={activeTab} onSwitch={switchTab} />

      {settingsOpen && (
        <HouseholdSettings
          isOpen
          onClose={() => setSettingsOpen(false)}
          onOpenCatEditor={() => { setSettingsOpen(false); setCatEditorOpen(true); }}
        />
      )}
      {catEditorOpen && (
        <CategoryEditor isOpen onClose={() => setCatEditorOpen(false)} />
      )}

      <Toast />
    </div>
  );
}
