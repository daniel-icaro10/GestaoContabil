import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

// Mesma chave usada pelo script inline do index.html (evita o "piscar" claro ao carregar).
const KEY = 'theme';

/** Tema salvo; na primeira visita, parte do tema do sistema operacional. */
export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* armazenamento indisponível */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignora */
    }
  }, [theme]);

  return [theme, setTheme] as const;
}
