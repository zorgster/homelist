import { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { URGENCY } from '../../lib/constants';
import TodoSheet from './TodoSheet';

export default function TodoTab({ active }) {
  const { todos, todoCats, toggleTodoDone, deleteTodo, canEdit } = useHousehold();
  const [showDone,   setShowDone]   = useState(false);
  const [selCat,     setSelCat]     = useState(null);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  function openSheet(id = null) { setEditId(id); setSheetOpen(true); }
  function closeSheet()         { setSheetOpen(false); setEditId(null); }

  function daysUntil(due) {
    if (!due) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(due); d.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  }

  function dueLabel(days) {
    if (days === null) return { txt: '', cls: '' };
    if (days < 0)  return { txt: `Overdue by ${Math.abs(days)}d`, cls: 'overdue' };
    if (days === 0) return { txt: 'Due today', cls: 'soon' };
    if (days === 1) return { txt: 'Due tomorrow', cls: 'soon' };
    if (days <= 7)  return { txt: `${days} days`, cls: 'soon' };
    return { txt: `${days} days`, cls: '' };
  }

  const all    = Object.values(todos).filter(t => !t._deleted);
  const active_ = all.filter(t => !t.done);
  const done   = all.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  const urgOrder = u => URGENCY[u]?.order ?? 2;
  active_.sort((a, b) => {
    const da = daysUntil(a.due), db = daysUntil(b.due);
    const aOver = da !== null && da < 0, bOver = db !== null && db < 0;
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (da !== null && db !== null && da !== db) return da - db;
    if (da !== null && db === null) return -1;
    if (da === null && db !== null) return 1;
    return urgOrder(a.urgency) - urgOrder(b.urgency);
  });

  const filter = t => selCat === null || t.cat === selCat;
  const shown  = active_.filter(filter);
  const shownDone = done.filter(filter);

  function TodoCard({ t }) {
    const days = daysUntil(t.due);
    const { txt: dueTxt, cls: dueCls } = dueLabel(days);
    const urg  = URGENCY[t.urgency] || URGENCY.normal;
    const expanded = expandedId === t.id;

    return (
      <div className={`todo-card${t.done ? ' done' : ''}${days !== null && days < 0 && !t.done ? ' overdue' : ''}`}>
        <div className="todo-card-top" onClick={() => setExpandedId(expanded ? null : t.id)}>
          <div
            className="todo-check"
            onClick={e => { e.stopPropagation(); toggleTodoDone(t.id); }}
          />
          <div className="todo-body">
            <div className="todo-header">{t.title}</div>
            {t.desc && !expanded && (
              <div className="todo-preview">
                {t.desc.split('\n').slice(0, 2).join(' ').slice(0, 120)}
              </div>
            )}
            <div className="todo-meta">
              {t.cat && <span className="todo-cat-tag">{t.cat}</span>}
              {t.urgency && t.urgency !== 'normal' && (
                <span className={`urgency-badge ${t.urgency}`}>{urg.icon} {urg.label}</span>
              )}
              {dueTxt && <span className={`todo-due ${dueCls}`}>{dueTxt}</span>}
            </div>
          </div>
        </div>
        {t.desc && expanded && (
          <div className="todo-full-desc open">{t.desc}</div>
        )}
        {canEdit && (
          <div className="todo-card-foot">
            <div className="todo-foot-actions">
              <button className="todo-act-btn" onClick={() => openSheet(t.id)}>✏️ Edit</button>
            </div>
            <button className="todo-del-btn" onClick={() => deleteTodo(t.id)}>🗑 Delete</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`tab-panel${active ? ' active' : ''}`} style={{ position: 'relative' }}>
      <div className="todo-toolbar">
        <div className="todo-filter-scroll">
          <div
            className={`chip${selCat === null ? ' on' : ''}`}
            onClick={() => setSelCat(null)}
          >
            All
          </div>
          {todoCats.map(c => (
            <div
              key={c}
              className={`chip${selCat === c ? ' on' : ''}`}
              onClick={() => setSelCat(prev => prev === c ? null : c)}
            >
              {c}
            </div>
          ))}
        </div>
        <button
          className={`todo-toggle${showDone ? ' showing-done' : ''}`}
          onClick={() => setShowDone(p => !p)}
        >
          ✓ Done
        </button>
      </div>

      <div id="todo-list">
        {shown.length === 0 && (!showDone || shownDone.length === 0) ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            <div className="empty-txt">
              {selCat ? `No "${selCat}" reminders` : 'No reminders yet'}.<br />Tap + to add one
            </div>
          </div>
        ) : (
          <>
            {shown.map(t => <TodoCard key={t.id} t={t} />)}
            {showDone && shownDone.length > 0 && (
              <>
                <div className="todo-section-head">Completed ({shownDone.length})</div>
                {shownDone.map(t => <TodoCard key={t.id} t={t} />)}
              </>
            )}
          </>
        )}
      </div>

      {canEdit && <button className="fab" onClick={() => openSheet(null)}>+</button>}

      <TodoSheet editId={editId} isOpen={sheetOpen} onClose={closeSheet} />
    </div>
  );
}
