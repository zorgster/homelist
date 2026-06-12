import { useState, useRef } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { PALETTE } from '../../lib/constants';

export default function CategoryEditor({ isOpen, onClose }) {
  const { cats, saveCats, toast } = useHousehold();
  const [newEmoji, setNewEmoji]   = useState('');
  const [newName, setNewName]     = useState('');
  const [newColor, setNewColor]   = useState(PALETTE[0]);
  const [colorPickOpen, setColorPickOpen] = useState(false);
  const dragSrc = useRef(null);
  const debounce = useRef(null);

  function pushCats(updated) {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => saveCats(updated), 600);
  }

  function updateField(i, field, val) {
    const next = cats.map((c, idx) => idx === i ? { ...c, [field]: val } : c);
    pushCats(next);
  }

  function cycleCatColor(i) {
    const next = cats.map((c, idx) => {
      if (idx !== i) return c;
      const ni = (PALETTE.indexOf(c.color) + 1) % PALETTE.length;
      return { ...c, color: PALETTE[ni] };
    });
    saveCats(next);
  }

  function deleteCat(i) {
    if (cats.length <= 1) { toast("Can't delete the last category"); return; }
    const next = cats.filter((_, idx) => idx !== i);
    saveCats(next);
    toast(`Removed "${cats[i].name}"`);
  }

  function addCat() {
    const name = newName.trim();
    if (!name) return;
    const next = [...cats, {
      id: 'cat_' + Date.now().toString(36),
      emoji: newEmoji.trim() || '🏷️',
      name,
      color: newColor,
    }];
    saveCats(next);
    setNewEmoji(''); setNewName('');
    toast(`Added "${name}"`);
  }

  function onDragStart(i) { dragSrc.current = i; }
  function onDragOver(e)  { e.preventDefault(); }
  function onDrop(e, i) {
    e.preventDefault();
    const src = dragSrc.current;
    if (src === null || src === i) return;
    const next = [...cats];
    const [moved] = next.splice(src, 1);
    next.splice(i, 0, moved);
    dragSrc.current = null;
    saveCats(next);
  }

  return (
    <div className={`overlay${isOpen ? ' open' : ''}`} onClick={onClose}>
      <div className="modal cat-editor-modal" onClick={e => e.stopPropagation()} style={{ gap: 10 }}>
        <div className="modal-handle" />
        <h3>Household categories</h3>
        <p style={{ fontSize: '.78rem', color: 'var(--muted)', lineHeight: 1.5, marginTop: -4 }}>
          Drag ⠿ to reorder · tap to rename · changes sync to all devices
        </p>

        <div className="cat-editor-list">
          {cats.map((c, i) => (
            <div
              key={c.id}
              className="cat-row"
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={onDragOver}
              onDrop={e => onDrop(e, i)}
              onDragEnd={() => { dragSrc.current = null; }}
            >
              <span className="cat-drag">⠿</span>
              <input
                className="cat-emoji-in"
                defaultValue={c.emoji}
                maxLength={2}
                onChange={e => updateField(i, 'emoji', e.target.value)}
              />
              <input
                className="cat-name-in"
                defaultValue={c.name}
                onChange={e => updateField(i, 'name', e.target.value)}
              />
              <div
                className="cat-color-dot"
                style={{ background: c.color, borderColor: 'transparent' }}
                onClick={() => cycleCatColor(i)}
              />
              <button className="cat-del" onClick={() => deleteCat(i)}>✕</button>
            </div>
          ))}
        </div>

        <div className="cat-add-row">
          <input
            className="cat-emoji-in"
            type="text"
            placeholder="🛒"
            maxLength={2}
            value={newEmoji}
            onChange={e => setNewEmoji(e.target.value)}
          />
          <input
            className="cat-name-in"
            type="text"
            placeholder="New category…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCat()}
          />
          <div style={{ position: 'relative' }}>
            <div
              className="cat-color-dot"
              style={{ background: newColor, borderColor: 'var(--text)' }}
              onClick={() => setColorPickOpen(p => !p)}
            />
            {colorPickOpen && (
              <div style={{
                position: 'absolute', bottom: 32, right: 0,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 10, zIndex: 10, width: 160,
              }}>
                <div className="color-picker-row">
                  {PALETTE.map(col => (
                    <div
                      key={col}
                      className={`cp-swatch${newColor === col ? ' sel' : ''}`}
                      style={{ background: col }}
                      onClick={() => { setNewColor(col); setColorPickOpen(false); }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="add-cat-btn" onClick={addCat}>Add</button>
        </div>
      </div>
    </div>
  );
}
