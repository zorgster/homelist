import { useState, useRef } from 'react';
import { useHousehold } from '../../context/HouseholdContext';

export default function ShoppingTab({ active }) {
  const { items, cats, addItem, toggleItem, deleteItem, clearChecked, canEdit } = useHousehold();
  const [name, setName]     = useState('');
  const [qty, setQty]       = useState('');
  const [selCat, setSelCat] = useState(null);
  const nameRef = useRef(null);

  function handleAdd() {
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    addItem(name.trim(), qty.trim(), selCat || '');
    setName(''); setQty('');
    nameRef.current?.focus();
  }

  function toggleCat(id) {
    setSelCat(prev => prev === id ? null : id);
  }

  const all       = Object.values(items).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const unchecked = all.filter(i => !i.checked);
  const checked   = all.filter(i => i.checked);

  function catFor(id) { return cats.find(c => c.id === id); }

  return (
    <div className={`tab-panel${active ? ' active' : ''}`} style={{ position: 'relative' }}>
      {canEdit && <div className="add-form">
        <div className="add-row">
          <input
            ref={nameRef}
            className="item-in"
            type="text"
            placeholder="Add an item…"
            autoComplete="off"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <input
            className="qty-in"
            type="text"
            placeholder="qty"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button className="add-btn" onClick={handleAdd}>+</button>
        </div>
        <div className="cat-scroll">
          {cats.map(c => (
            <div
              key={c.id}
              className={`chip${selCat === c.id ? ' on' : ''}`}
              onClick={() => toggleCat(c.id)}
            >
              {c.emoji} {c.name}
            </div>
          ))}
        </div>
      </div>}

      <div id="shop-list">
        {all.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🛒</div>
            <div className="empty-txt">Your list is empty.<br />Type something above and tap +</div>
          </div>
        ) : (
          <>
            {unchecked.map(item => <ShopItem key={item.id} item={item} catFor={catFor} onToggle={toggleItem} onDelete={canEdit ? deleteItem : null} />)}
            {checked.length > 0 && (
              <>
                <div className="sec-head">Checked ({checked.length})</div>
                {checked.map(item => <ShopItem key={item.id} item={item} catFor={catFor} onToggle={toggleItem} onDelete={canEdit ? deleteItem : null} />)}
              </>
            )}
          </>
        )}
      </div>

      <div className="shop-foot">
        {canEdit && <button className="clear-btn" onClick={clearChecked}>Clear checked</button>}
        <span className="count">
          {all.length ? `${checked.length} / ${all.length} done` : ''}
        </span>
      </div>
    </div>
  );
}

function ShopItem({ item, catFor, onToggle, onDelete }) {
  const cat = item.cat ? catFor(item.cat) : null;
  return (
    <div className={`item${item.checked ? ' checked' : ''}`} onClick={() => onToggle(item.id)}>
      <div className="check-ring" />
      <div className="item-body">
        <div className="item-name">{item.name}</div>
        {(item.qty || cat) && (
          <div className="item-meta">
            {item.qty && <span className="item-qty">{item.qty}</span>}
            {cat && (
              <span className="cat-tag" style={{ background: cat.color + '22', color: cat.color }}>
                {cat.emoji} {cat.name}
              </span>
            )}
          </div>
        )}
      </div>
      {onDelete && (
        <button className="del-btn" onClick={e => { e.stopPropagation(); onDelete(item.id); }}>✕</button>
      )}
    </div>
  );
}
