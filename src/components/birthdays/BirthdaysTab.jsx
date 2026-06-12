import { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { BDAY_GROUPS, MONTHS } from '../../lib/constants';
import BirthdaySheet from './BirthdaySheet';

function nextBdayDate(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [, m, d] = dateStr.split('-').map(Number);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return next;
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((nextBdayDate(dateStr) - today) / 86400000);
}

function bdayAge(dateStr) {
  const year = parseInt(dateStr.split('-')[0]);
  if (year <= 1900 || year > new Date().getFullYear()) return null;
  return nextBdayDate(dateStr).getFullYear() - year;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const showYear = y > 1900 && y < new Date().getFullYear() + 1;
  return `${d} ${MONTHS[m - 1]}${showYear ? ' ' + y : ''}`;
}

function countdownLabel(days) {
  if (days === 0) return { txt: 'Today! 🎉', cls: 'today' };
  if (days === 1) return { txt: 'Tomorrow', cls: '' };
  if (days <= 14) return { txt: `${days} days`, cls: '' };
  return null;
}

export default function BirthdaysTab() {
  const { bdays, deleteBday } = useHousehold();
  const [sheetOpen,   setSheetOpen]   = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [openNotes,   setOpenNotes]   = useState({});
  const [openMonths,  setOpenMonths]  = useState({});

  function openSheet(id = null) { setEditId(id); setSheetOpen(true); }
  function closeSheet()         { setSheetOpen(false); setEditId(null); }
  function toggleNotes(id)  { setOpenNotes(p  => ({ ...p, [id]:  !p[id] })); }
  function toggleMonth(key) { setOpenMonths(p => ({ ...p, [key]: !p[key] })); }

  const list = Object.values(bdays)
    .filter(b => !b._deleted && b.date)
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

  const soon     = list.filter(b => daysUntil(b.date) <= 14);
  const upcoming = list.filter(b => daysUntil(b.date) > 14);

  function BdayRow({ b }) {
    const days = daysUntil(b.date);
    const cdl  = countdownLabel(days);
    const grp  = BDAY_GROUPS[b.group] || BDAY_GROUPS.other;
    const age  = bdayAge(b.date);
    const notesOpen = !!openNotes[b.id];

    return (
      <div className={`bday-row${days <= 14 ? ' soon' : ''}`} onClick={() => toggleNotes(b.id)}>
        <div className="bday-avatar">{grp.icon}</div>
        <div className="bday-info">
          <div className="bday-name">{b.name}</div>
          <div className="bday-date-line">
            <span className="bday-date">{formatDate(b.date)}{age ? ` · turns ${age}` : ''}</span>
            {cdl && <span className={`bday-countdown${cdl.cls ? ' ' + cdl.cls : ''}`}>{cdl.txt}</span>}
          </div>
          {b.notes?.trim() && (
            <div className={`bday-notes${notesOpen ? ' open' : ''}`}>{b.notes}</div>
          )}
        </div>
        <div className="bday-actions">
          {b.tel && (
            <a className="bday-call" href={`tel:${b.tel}`} onClick={e => e.stopPropagation()}>📞</a>
          )}
          <button className="bday-edit" onClick={e => { e.stopPropagation(); openSheet(b.id); }}>✏️</button>
          <button className="bday-del"  onClick={e => { e.stopPropagation(); deleteBday(b.id); }}>🗑</button>
        </div>
      </div>
    );
  }

  // Group upcoming by month
  const byMonth = {};
  upcoming.forEach(b => {
    const key = nextBdayDate(b.date).getMonth();
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(b);
  });
  const sortedMonths = Object.keys(byMonth).map(Number).sort((a, b) => {
    return daysUntil(byMonth[a][0].date) - daysUntil(byMonth[b][0].date);
  });

  return (
    <div className="tab-panel active" style={{ position: 'relative' }}>
      <div id="bday-list">
        {list.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎂</div>
            <div className="empty-txt">No birthdays yet.<br />Tap + to add someone</div>
          </div>
        ) : (
          <>
            {soon.length > 0 && (
              <>
                <div className="bday-soon-head">🎂 Coming up — next 2 weeks</div>
                {soon.map(b => <BdayRow key={b.id} b={b} />)}
              </>
            )}
            {sortedMonths.map(mIdx => {
              const label     = MONTHS[mIdx];
              const count     = byMonth[mIdx].length;
              const autoOpen  = mIdx === sortedMonths[0] && daysUntil(byMonth[mIdx][0].date) <= 30;
              const isOpen    = openMonths[mIdx] !== undefined ? openMonths[mIdx] : autoOpen;
              return (
                <div className="bday-month-sec" key={mIdx}>
                  <button
                    className={`bday-month-btn${isOpen ? ' open' : ''}`}
                    onClick={() => toggleMonth(mIdx)}
                  >
                    <span>{label}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="bm-count">{count} birthday{count > 1 ? 's' : ''}</span>
                      <span className="bm-arrow">▾</span>
                    </span>
                  </button>
                  <div className={`bday-month-body${isOpen ? ' open' : ''}`}>
                    {byMonth[mIdx].map(b => <BdayRow key={b.id} b={b} />)}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <button className="fab" onClick={() => openSheet(null)}>+</button>
      <BirthdaySheet editId={editId} isOpen={sheetOpen} onClose={closeSheet} />
    </div>
  );
}
