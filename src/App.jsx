import { useState, useEffect, lazy, Suspense } from 'react';
import { useHousehold } from './context/HouseholdContext';
import Setup  from './components/Setup';
import Header from './components/Header';
import TabBar from './components/TabBar';
import Toast  from './components/Toast';

const ShoppingTab       = lazy(() => import('./components/shopping/ShoppingTab'));
const CategoryEditor    = lazy(() => import('./components/shopping/CategoryEditor'));
const TodoTab           = lazy(() => import('./components/todos/TodoTab'));
const TradesTab         = lazy(() => import('./components/trades/TradesTab'));
const BirthdaysTab      = lazy(() => import('./components/birthdays/BirthdaysTab'));
const HouseholdSettings = lazy(() => import('./components/settings/HouseholdSettings'));

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

  // Keep hash in sync when browser back/forward is used
  useEffect(() => {
    const onPop = () => setActiveTab(tabFromHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Stamp the initial hash when first entering the app
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

      <Suspense fallback={null}>
        {activeTab === 'shop'   && <ShoppingTab />}
        {activeTab === 'todo'   && <TodoTab />}
        {activeTab === 'trades' && <TradesTab />}
        {activeTab === 'bdays'  && <BirthdaysTab />}
      </Suspense>

      <TabBar activeTab={activeTab} onSwitch={switchTab} />

      <Suspense fallback={null}>
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
      </Suspense>

      <Toast />
    </div>
  );
}
