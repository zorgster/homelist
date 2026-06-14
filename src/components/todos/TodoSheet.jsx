import { useState, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';

const URGENCY_OPTS = [
  { id: 'urgent', icon: '🔴', label: 'Urgent' },
  { id: 'high',   icon: '🟠', label: 'High' },
  { id: 'normal', icon: '🟡', label: 'Normal' },
  { id: 'low',    icon: '⚪', label: 'Low' },
];

export default function TodoSheet({ editId, isOpen, onClose }) {
  const { todos, todoCats, saveTodo, saveTodoCats, toast } = useHousehold();
  const editing = editId ? todos[editId] : null;

  const [title,    setTitle]   = useState('');
  const [desc,     setDesc]    = useState('');
  const [cat,      setCat]     = useState('');
  const [urgency,  setUrgency] = useState('normal');
  const [due,      setDue]     = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitle(editing?.title  || '');
    setDesc( editing?.desc   || '');
    setCat(  editing?.cat    || '');
    setUrgency(editing?.urgency || 'normal');
    setDue(  editing?.due    || '');
  }, [isOpen, editId]);

  async function handleSave() {
    if (!title.trim()) { toast('Please add a title'); return; }
    await saveTodo(editId || null, { title: title.trim(), desc, cat, urgency, due });
    onClose();
  }

  async function addNewCat() {
    const name = prompt('New category name:')?.trim();
    if (!name) return;
    if (todoCats.includes(name)) { toast('Category already exists'); return; }
    await saveTodoCats([...todoCats, name]);
    setCat(name);
  }

  return (
    <div className={`overlay${isOpen ? ' open' : ''}`} onClick={onClose}>
      <div className="modal todo-sheet-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h3>{editId ? 'Edit reminder' : 'Add reminder'}</h3>

        <div className="todo-form">
          <div>
            <span className="form-label">Title</span>
            <input
              type="text"
              placeholder="e.g. Book car service"
              maxLength={120}
              autoComplete="off"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus={isOpen}
            />
          </div>
          <div>
            <span className="form-label">Description</span>
            <textarea
              placeholder="Details, notes, links…"
              maxLength={1000}
              style={{ minHeight: 80 }}
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>
          <div>
            <span className="form-label">Category</span>
            <div className="todo-cat-row">
              {todoCats.map(c => (
                <div
                  key={c}
                  className={`todo-cat-chip${cat === c ? ' sel' : ''}`}
                  onClick={() => setCat(prev => prev === c ? '' : c)}
                >
                  {c}
                </div>
              ))}
              <button className="add-todo-cat-btn" onClick={addNewCat}>+ New</button>
            </div>
          </div>
          <div>
            <span className="form-label">Urgency</span>
            <div className="urgency-grid">
              {URGENCY_OPTS.map(u => (
                <div
                  key={u.id}
                  className={`urgency-opt${urgency === u.id ? ' sel' : ''}`}
                  onClick={() => setUrgency(u.id)}
                >
                  <span className="u-icon">{u.icon}</span>
                  {u.label}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="todo-due">Due date (optional)</label>
            <input id="todo-due" type="date" value={due} onChange={e => setDue(e.target.value)} />
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
