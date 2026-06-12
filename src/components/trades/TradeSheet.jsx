import { useState, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { TRADE_EMOJIS } from '../../lib/constants';

export default function TradeSheet({ editId, isOpen, onClose }) {
  const { trades, saveTrade } = useHousehold();
  const editing = editId ? trades[editId] : null;

  const [emoji,   setEmoji]  = useState('🔧');
  const [name,    setName]   = useState('');
  const [trade,   setTrade]  = useState('');
  const [tel,     setTel]    = useState('');
  const [mobile,  setMobile] = useState('');
  const [notes,   setNotes]  = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setEmoji( editing?.emoji  || '🔧');
    setName(  editing?.name   || '');
    setTrade( editing?.trade  || '');
    setTel(   editing?.tel    || '');
    setMobile(editing?.mobile || '');
    setNotes( editing?.notes  || '');
  }, [isOpen, editId]);

  async function handleSave() {
    if (!name.trim()) return;
    await saveTrade(editId || null, { emoji, name: name.trim(), trade, tel, mobile, notes });
    onClose();
  }

  return (
    <div className={`overlay${isOpen ? ' open' : ''}`} onClick={onClose}>
      <div className="modal sheet-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h3>{editId ? 'Edit tradesperson' : 'Add tradesperson'}</h3>

        <div className="trade-form">
          <div>
            <span className="form-label">Icon</span>
            <div className="emoji-grid">
              {TRADE_EMOJIS.map(e => (
                <div
                  key={e}
                  className={`emoji-opt${emoji === e ? ' sel' : ''}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="form-label">Name</span>
            <input
              type="text"
              placeholder="e.g. Mike Boyle"
              autoComplete="off"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <span className="form-label">Trade / role</span>
            <input
              type="text"
              placeholder="e.g. Plumber"
              value={trade}
              onChange={e => setTrade(e.target.value)}
            />
          </div>
          <div className="frow">
            <div>
              <span className="form-label">Landline</span>
              <input type="tel" placeholder="01234 567890" value={tel} onChange={e => setTel(e.target.value)} />
            </div>
            <div>
              <span className="form-label">Mobile</span>
              <input type="tel" placeholder="07700 900000" value={mobile} onChange={e => setMobile(e.target.value)} />
            </div>
          </div>
          <div>
            <span className="form-label">Notes</span>
            <textarea
              placeholder="What they did, when, any details…"
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
