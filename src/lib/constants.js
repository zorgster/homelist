export const DEFAULT_CATS = [
  { id: 'produce', emoji: '🥬', name: 'Produce',     color: '#4ADE80' },
  { id: 'pdairy',  emoji: '🌱', name: 'Plant Dairy', color: '#7DD3FC' },
  { id: 'eggs',    emoji: '🥚', name: 'Eggs',        color: '#FDE68A' },
  { id: 'bakery',  emoji: '🍞', name: 'Bakery',      color: '#FDBA74' },
  { id: 'pantry',  emoji: '🥫', name: 'Pantry',      color: '#C4B5FD' },
  { id: 'frozen',  emoji: '❄️', name: 'Frozen',      color: '#BAE6FD' },
  { id: 'drinks',  emoji: '🍷', name: 'Drinks',      color: '#E879F9' },
  { id: 'home',    emoji: '🧹', name: 'Household',   color: '#94A3B8' },
  { id: 'health',  emoji: '💊', name: 'Health',      color: '#F9A8D4' },
  { id: 'other',   emoji: '📦', name: 'Other',       color: '#D4D4D8' },
];

export const DEFAULT_TODO_CATS = ['Cars', 'Pets', 'Kitchen', 'Bills', 'Meeting', 'Home', 'Health', 'Other'];

export const PALETTE = [
  '#4ADE80', '#7DD3FC', '#FDE68A', '#FDBA74', '#C4B5FD',
  '#BAE6FD', '#E879F9', '#F9A8D4', '#94A3B8', '#D4D4D8', '#E8A838', '#F87171',
];

export const TRADE_EMOJIS = [
  '🔧', '⚡', '🪠', '🏗️', '🪟', '🌿', '🎨', '🔒', '🧹', '🐾', '💻', '🚗', '🌡️', '🛁', '🪚',
];

export const BDAY_GROUPS = {
  family:  { icon: '👨‍👩‍👧', label: 'Family' },
  friends: { icon: '👫',     label: 'Friends' },
  work:    { icon: '💼',     label: 'Work' },
  other:   { icon: '⭐',     label: 'Other' },
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const URGENCY = {
  urgent: { label: 'Urgent', icon: '🔴', order: 0 },
  high:   { label: 'High',   icon: '🟠', order: 1 },
  normal: { label: 'Normal', icon: '🟡', order: 2 },
  low:    { label: 'Low',    icon: '⚪', order: 3 },
};

export const DEVICE_ID = Math.random().toString(36).slice(2, 10);
