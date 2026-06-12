import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('homelist-theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('homelist-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return { theme, toggle };
}
