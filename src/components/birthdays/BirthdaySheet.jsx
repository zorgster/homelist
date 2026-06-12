import { useState, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { BDAY_GROUPS } from '../../lib/constants';

export default function BirthdaySheet({ editId, isOpen, onClose }) {
  const { bdays, saveBday, toast } = useHousehold();
  const editing = editId ? bdays[editId] : null;

  const [group, setGroup] = useState('family');
  const [name,  setName]  = useState('');
  const [date,  setDate]  = useState('');
  const [tel,   setTel]   = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setGroup(editing?.group || 'family');
    setName( editing?.name  || '');
    setDate( editing?.date  || '');
    setTel(  editing?.tel   || '');
    setNotes(editing?.notes || '');
  }, [isOpen, editId]);

  async function handleSave() {
    if (!name.trim()) { toast('Please enter a name'); return; }
    if (!date)        { toast('Please pick a date'); return; }
    await saveBday(editId || null, { name: name.trim(), date, group, tel, notes });
    onClose();
  }

  return (
    <div className={`overlay${isOpen ? ' open' : ''}`} onClick={onClose}>
      <div className="modal sheet-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h3>{editId ? 'Edit birthday' : 'Add birthday'}</h3>

        <div className="bday-form">
          <div>
            <span className="form-label">Group</span>
            <div className="bday-group-grid">
              {Object.entries(BDAY_GROUPS).map(([key, g]) => (
                <div
                  key={key}
                  className={`bday-group-opt${group === key ? ' sel' : ''}`}
                  onClick={() => setGroup(key)}
                >
                  <span className="bg-icon">{g.icon}</span>
                  {g.label}
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="form-label">Name</span>
            <input
              type="text"
              placeholder="e.g. Grandma Jean"
              autoComplete="off"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <span className="form-label">Birthday</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <p style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 5 }}>
              Year is optional — leave as 1900 if unknown
            </p>
          </div>
          <div>
            <span className="form-label">Phone (optional)</span>
            <input type="tel" placeholder="07700 900000" value={tel} onChange={e => setTel(e.target.value)} />
          </div>
          <div>
            <span className="form-label">Notes</span>
            <textarea
              placeholder="Who they are, relationship, gift ideas…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-btns" style={{ marginTop: 4 }}>
          <button className="btn btn-primary" onClick={handleSave}>Save →</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
