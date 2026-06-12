import { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import TradeSheet from './TradeSheet';

export default function TradesTab() {
  const { trades, deleteTrade } = useHousehold();
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [openNotes,  setOpenNotes]  = useState({});

  function openSheet(id = null) { setEditId(id); setSheetOpen(true); }
  function closeSheet()         { setSheetOpen(false); setEditId(null); }

  function toggleNotes(id) {
    setOpenNotes(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const list = Object.values(trades)
    .filter(t => !t._deleted)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="tab-panel active" style={{ position: 'relative' }}>
      <div id="trades-list">
        {list.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔧</div>
            <div className="empty-txt">No tradespeople yet.<br />Tap + to add your first contact</div>
          </div>
        ) : (
          list.map(t => {
            const notesOpen = !!openNotes[t.id];
            return (
              <div className="trade-card" key={t.id}>
                <div className="trade-header">
                  <div className="trade-avatar">{t.emoji || '🔧'}</div>
                  <div className="trade-info">
                    <div className="trade-name">{t.name}</div>
                    {t.trade && <div className="trade-role">{t.trade}</div>}
                  </div>
                  <div className="trade-actions">
                    {t.tel    && <a className="call-btn"        href={`tel:${t.tel}`}    onClick={e => e.stopPropagation()}>📞 {t.tel}</a>}
                    {t.mobile && <a className="call-btn mobile" href={`tel:${t.mobile}`} onClick={e => e.stopPropagation()}>📱 {t.mobile}</a>}
                  </div>
                </div>
                {t.notes?.trim() && (
                  <>
                    <div className="trade-divider" />
                    <button
                      className={`trade-notes-toggle${notesOpen ? ' open' : ''}`}
                      onClick={() => toggleNotes(t.id)}
                    >
                      📋 Notes <span className="arrow">▾</span>
                    </button>
                    <div className={`trade-notes-body${notesOpen ? ' open' : ''}`}>
                      {t.notes}
                    </div>
                  </>
                )}
                <div className="trade-footer">
                  <button className="trade-edit-btn" onClick={() => openSheet(t.id)}>✏️ Edit</button>
                  <button className="trade-del-btn"  onClick={() => deleteTrade(t.id)}>🗑 Remove</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button className="fab" onClick={() => openSheet(null)}>+</button>
      <TradeSheet editId={editId} isOpen={sheetOpen} onClose={closeSheet} />
    </div>
  );
}
