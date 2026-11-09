import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../lib/theme';

/** Alterna entre modo claro e escuro. O ícone mostra o modo para o qual o clique leva. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={clsx('rounded-lg p-2 text-muted transition hover:bg-subtle hover:text-fg', className)}
      aria-label={label}
      title={label}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
